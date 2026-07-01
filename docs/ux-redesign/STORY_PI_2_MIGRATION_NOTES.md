# Story PI-2 — Refund Flow — Migration Notes

> **Audience:** engineers picking up the codebase after PI-2 ships; reviewers auditing the diff; on-call during the rollout window.

This document captures the non-obvious decisions, traps, and follow-up steps for the refund feature. It complements the [Implementation Report](STORY_PI_2_IMPLEMENTATION_REPORT.md) (which is the "what") with the "why" and "watch out for".

---

## 1. How to enable the refund feature

```bash
# .env.local (or .env.production)
NEXT_PUBLIC_FEATURE_PAYMENT_TX=true
```

The flag is **OFF by default** in production per the Sprint 7.2 plan §0.3 D7.2-5. Promotion to ON requires:
- Accountant-lead pairing session (C-6) — they walk through the happy path
- Tech-lead code review (single PR, single flag)
- Release-manager flag inventory update

The flag is read in two places:
1. `src/app/api/payments/refund/route.ts` — endpoint short-circuits to 404 when OFF
2. `src/components/payments/payment-list.tsx` — UI button is hidden when OFF

Both reads use the `isFlagEnabled('PAYMENT_TX')` helper from `src/lib/feature-flags.ts`.

---

## 2. Where the new code lives

```
src/lib/payments/                           ← new module directory (created for PI-2)
  refund.ts                                 ← domain logic
  __tests__/refund.test.ts                  ← 25 Vitest cases
src/app/api/payments/refund/
  route.ts                                  ← POST endpoint
src/components/payments/
  payment-refund-dialog.tsx                 ← modal dialog
  payment-list.tsx                          ← modified to render "Hoàn tiền" button
  index.ts                                  ← exports the new dialog
src/lib/feature-flags.ts                    ← PAYMENT_TX added
src/constants/permissions.ts                ← REFUND_CREATE_ROLES added
src/lib/types/audit.ts                      ← payment_refunded action added
src/lib/firestore/payments.ts               ← recalculateCasePayment now exported
src/lib/validators/payment.ts               ← createRefundSchema added
src/app/(protected)/audit-logs/page.tsx     ← payment_refunded label + Undo2 icon
.env.local.example                          ← PAYMENT_TX documented
```

---

## 3. The `[refund-of:<id>]` audit-chain marker

### Why

The plan §6.2 S15 says: "Audit log: refund → confirm audit entry has `paymentType: 'refund'` and links to original". We had two options:

| Option | Pro | Con |
|:-------|:----|:----|
| New `originalPaymentId?: string` field on `Payment` | Strongly typed; indexable | Schema migration, B.2.3 PII redaction needs updating, breaks prior data |
| Marker prefix in existing `note?: string` | No schema change; backwards-compatible; queryable with `note?.includes(...)` | Hidden inside a free-text field; humans could accidentally edit it away |

We chose option 2 because it preserves the existing schema and audit redaction layer. The marker is rendered inside `<RefundDialog>`'s note suffix as `[refund-of:<id>] — <user note>`, so even if a human later edits the note, the prefix portion survives (any edit would need to deliberately delete the bracketed token).

### How to query the chain

```ts
import { sumRefundsAgainst, extractRefundOriginalId } from '@/lib/payments/refund';

// "Đã hoàn X / Y" for a row in the payments list
const refundedSoFar = sumRefundsAgainst(payment.id, allPayments);

// "Hoàn tiền cho <originalId>" on a refund row
const originalId = extractRefundOriginalId(refundRow);
// → "pay-001"  (for new refunds)
// → null       (for legacy free-text refunds predating PI-2)
```

### Backwards compatibility

The existing seed data has three refund payments (pay-020, pay-024, pay-025). Two of them (pay-024, pay-025) were created without the marker. They continue to work — `recalculateCasePayment()` does not read the marker, it only looks at `paymentType === 'refund'` and `status === 'confirmed'`. The audit-chain helper returns `null` for them, which is the correct "we don't know which original this was for" signal.

If a future story needs a fully-linked view of all refunds, it can run a one-time backfill:
```ts
// pseudocode — not part of PI-2
for (const refund of allRefundPayments) {
  if (!extractRefundOriginalId(refund)) {
    // try to infer from case history / payment timing / manual reconciliation
    // then write the marker back into note
  }
}
```
This is out of scope for PI-2.

---

## 4. Recompute reuse — what changed in `payments.ts`

The only body change to `src/lib/firestore/payments.ts` is one keyword:

```diff
- async function recalculateCasePayment(caseId: string, updatedBy: string): Promise<void> {
+ export async function recalculateCasePayment(caseId: string, updatedBy: string): Promise<void> {
```

A docstring was added on top. **No behavioural change.** This was the minimum-surface modification that lets the refund flow reuse the same helper that `confirmPayment` and `rejectPayment` already call.

If F-HIGH-28 (Bill recompute refactor) lands in the same sprint, it will rewrite this function's body. The refund flow will then need to swap its `recalculateCasePayment()` call for the new `recomputeBill()` path. The PI-2 implementation report §4.1 captures this hand-off.

---

## 5. RBAC: who can refund what

The contract is:
- **Static allow-list** — `REFUND_CREATE_ROLES = ['admin', 'ceo', 'accountant']`
- **Runtime creator fallback** — anyone in `payments:write` can refund a payment they themselves created

The fallback matters because:
- Sales staff have `payments:write` (they create deposits)
- They should NOT have blanket refund permission (financial write requires management involvement)
- But the salesperson who took the original deposit is often the best person to handle the refund (they have context)
- So we allow it only for their own entries

Both checks live server-side in the API route. The UI button hides itself using the same logic but is purely cosmetic — never rely on UI hiding for security.

The audit log records the actor's UID + role for every refund, so SOC review can verify the access pattern.

---

## 6. Feature flag semantics — 404 vs 403

When `FEATURE_PAYMENT_TX=false`, the endpoint returns:
```json
{ "error": "Tính năng hoàn tiền chưa được bật (FEATURE_PAYMENT_TX)" }
```
with status **404**, not 403. Rationale:
- 404 says "this resource does not exist from your perspective"
- 403 says "this resource exists but you cannot access it"
- A 403 leaks the existence of the feature, which is bad for staged rollouts (no point telling an unauthorized user that they could theoretically get access)
- The rollback plan §7.1 says refunds revert to "the manual 'create payment with paymentType=refund' workflow" — that workflow is a generic `POST /api/payments` with `paymentType: 'refund'`, which still works when the flag is OFF

If you ever need to debug "is the flag actually off?", `process.env.NEXT_PUBLIC_FEATURE_PAYMENT_TX` is the source. The Next.js build bakes `NEXT_PUBLIC_*` values in at build time, so a flag flip requires a redeploy, not just a process restart.

---

## 7. Validation ladder (request → response)

```
POST /api/payments/refund { originalPaymentId, amount, paymentMethod, paymentDate, note }
  │
  ├─ 1. Feature flag (PAYMENT_TX)
  │     └─ OFF → 404 "Tính năng hoàn tiền chưa được bật"
  │
  ├─ 2. requireAuth()
  │     └─ no session → 401 "Bạn cần đăng nhập..."
  │
  ├─ 3. Zod (createRefundSchema)
  │     └─ bad shape → 400 with first issue.message
  │
  ├─ 4. Original payment fetch
  │     └─ not found → 404 "Không tìm thấy thanh toán gốc"
  │
  ├─ 5. RBAC (REFUND_CREATE_ROLES OR creator)
  │     └─ no permission → 403 "Bạn không có quyền hoàn tiền..."
  │
  ├─ 6. Domain validation (createRefund())
  │     ├─ status !== 'confirmed'         → 400 'original_not_confirmed'
  │     ├─ paymentType === 'refund'       → 400 'original_is_refund'
  │     ├─ amount ≤ 0 or non-integer      → 400 'amount_invalid'
  │     ├─ amount > original.amount       → 400 'amount_exceeds_original'
  │     └─ cumulative > original.amount   → 400 'amount_exceeds_remaining'
  │
  ├─ 7. setDocument (persist refund)
  │     └─ Firestore error → 500 "Không thể hoàn tiền: ..."
  │
  ├─ 8. recalculateCasePayment()
  │     └─ Firestore error → 500 (case totals may be stale; manual reconciliation needed)
  │
  ├─ 9. writeAuditLog (×2: refund + original marker)
  │     └─ audit failure is fire-and-forget; never blocks the response
  │
  └─ 10. → 200 { success: true, refund, case: <recomputed case> }
```

Steps 1–6 return errors in Vietnamese for direct UI display. Step 7's persistence error is intentionally generic ("Không thể hoàn tiền: <Firestore message>") — never expose the raw Firestore exception to the client.

---

## 8. Audit log enrichment (PI-3 sibling story interaction)

PI-2 writes two audit entries per refund:

| Entity | Action | `after` payload | Purpose |
|:-------|:-------|:----------------|:--------|
| Refund payment (`refund.id`) | `payment_created` | `{ paymentType, originalPaymentId, amount, caseId, note }` | Standard "new payment" audit row + the cross-reference |
| Original payment (`originalPaymentId`) | `payment_refunded` | `{ refundPaymentId, refundAmount, refundedBy }` | Lets auditors trace the chain directly from the original payment's audit history |

When PI-3 ships its structured diff enrichment, both of these rows will be auto-enriched with the `before`/`after` non-PII fields. No code change needed in PI-2 — the API contract is stable.

---

## 9. CurrencyInput integration (no overlap with C.2.1)

C.2.1 (CurrencyInput primitive) was already shipped by the time PI-2 was scoped. PI-2's dialog reuses the primitive directly:

```tsx
<CurrencyInput
  label="Số tiền hoàn (VNĐ) *"
  value={amount}
  onChange={(num) => setAmount(num)}
  placeholder="0"
  hint={`Tối đa có thể hoàn: ${formatCurrency(refundableRemaining)}`}
  error={error ?? undefined}
  required
/>
```

Two PI-2-specific notes:

1. The `hint` line shows the refundable remaining as `formatCurrency(refundableRemaining)` — this is the UX layer that prevents the user from even typing a value > the cap.
2. The `error` is set client-side when the user types a value > the cap, AND server-side validation kicks in as a belt-and-suspenders. If the server returns `amount_exceeds_remaining`, the dialog sets the same `error` string from the API response.

---

## 10. Common pitfalls during code review

| Pitfall | Symptom | How to catch it |
|:--------|:--------|:----------------|
| Forgetting to gate the UI button on `PAYMENT_TX` | Button visible in production when feature is off | `grep -n "PAYMENT_TX" src/components/payments/payment-list.tsx` |
| Returning the raw Firestore error to the client | Sensitive project paths leaked | Look for `error.message` in catch blocks that aren't wrapped in a generic prefix |
| Mutating `recalculateCasePayment()` body | Bills go wrong | The function is **only allowed** to gain an `export` keyword in PI-2; the diff should not touch the body |
| Adding `originalPaymentId` to the `Payment` schema | Forces a migration | All linkage goes through the `[refund-of:<id>]` note marker; never add a new column |
| Setting the refund to `status: 'pending'` | Refunds need a second confirm flow that doesn't exist | The endpoint creates refunds with `status: 'confirmed'` immediately |
| Mocking `@/lib/firestore/payments` without mocking `@/lib/firebase/firestore` `setDocument` | Tests hang waiting for the unstubbed Firestore call | When writing tests, mock the leaf-most module (firebase/firestore for `setDocument`, firestore/payments for `getPayment`, etc.) |
| Forgetting `mockResolvedValue(undefined)` on `setDocument` mock after `mockReset()` | Tests hang | `beforeEach` must re-arm every mock after `mockReset` |
| Skipping the audit log on the original payment | Auditors can't trace chains from the original side | The API route must call `writeAuditLog` twice — once with `action: 'payment_created'` on the refund, once with `action: 'payment_refunded'` on the original |

---

## 11. Smoke test for the on-call engineer

```bash
# 1. Build & quality
npx tsc --noEmit && npm run lint && npx vitest run src/lib/payments/__tests__/refund.test.ts

# 2. Enable the flag locally
echo "NEXT_PUBLIC_FEATURE_PAYMENT_TX=true" >> .env.local

# 3. Start the dev server
npm run dev

# 4. Sign in as admin (default in dev mode: /dashboard bypass)
# 5. Navigate to /payments
# 6. Find a row with status "Đã xác nhận" (e.g. pay-005 — full payment 35M)
# 7. Click "Hoàn tiền" → dialog opens with "Còn có thể hoàn: 35.000.000 ₫"
# 8. Enter 5,000,000 → click "Xác nhận hoàn tiền" → success toast
# 9. Navigate to /audit-logs → search for "pay-005" → confirm two new entries
#    (payment_created + payment_refunded)
# 10. Run the property test (if PI-6 has shipped)
npx vitest run src/test/__tests__/reconciliation-property.test.ts
```

---

## 12. Follow-ups deferred to other stories

| Item | Owner | Trigger |
|:-----|:------|:--------|
| Replace `recalculateCasePayment()` call with `recomputeBill()` (pure function) | F-HIGH-28 | When F-HIGH-28 ships |
| Wrap `createRefund()` body in Firestore `runTransaction` (mock + real) | F-CRIT-08 | When F-CRIT-08 ships |
| Property test for the §3.2 invariant | PI-6 | When PI-6 ships; `sumRefundsAgainst` is reusable |
| Backfill `[refund-of:<id>]` marker on legacy refund payments | TBD | When reconciliation reveals unlinked refunds |
| Inline display of "Hoàn tiền cho <originalId>" in the audit-logs row | PI-3 or follow-up | When audit-log UI enrichment is prioritized |

---

*End of Story PI-2 Migration Notes.*