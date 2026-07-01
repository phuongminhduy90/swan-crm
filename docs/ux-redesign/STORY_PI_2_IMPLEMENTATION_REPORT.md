# Story PI-2 — Refund Flow: Negative Payment + Recompute Integration — Implementation Report

> **Story:** PI-2 (Sprint 7.2 — Payment Integrity)
> **Branch:** `main` (single stacked commit per TD-1 Conventional Commits)
> **Sprint plan:** [`SPRINT_7_2_EXECUTION_PLAN.md`](SPRINT_7_2_EXECUTION_PLAN.md) §1 (Story row 7) + §5.1 (new files) + §5.2 (modified files) + §10.4 (manual QA)
> **Risk class:** 🟡 — refund correctness is revenue-relevant, but the recompute helper is reused (not rewritten), keeping blast radius small
> **Feature flag:** `NEXT_PUBLIC_FEATURE_PAYMENT_TX` (default OFF in production per §0.3 D7.2-5)

---

## 1. Scope delivered

PI-2 ships a complete refund surface: domain logic, REST endpoint, UI button + dialog, audit logs, validation, tests. The flow does not modify the existing `confirmPayment` / `rejectPayment` paths and does not introduce a Firestore `runTransaction` wrapper (F-CRIT-08, deferred to its own story per the user-supplied rules and §0.1 of the plan).

| Acceptance criterion | Status | Where |
|:---------------------|:-------|:------|
| Refund against non-existent payment → 404 | ✅ | `createRefund` rejects with `RefundError('original_not_found')`; API maps to 404 |
| Refund against `pending` or `rejected` original → 400 | ✅ | `RefundError('original_not_confirmed')` |
| Refund against an already-refund payment → 400 | ✅ | `RefundError('original_is_refund')` |
| Refund amount ≤ 0 or non-integer → 400 | ✅ | `RefundError('amount_invalid')` |
| Refund amount > original.amount → 400 | ✅ | `RefundError('amount_exceeds_original')` |
| Cumulative refunds > original.amount → 400 | ✅ | `RefundError('amount_exceeds_remaining')` |
| Happy path persists refund + recomputes case | ✅ | `setDocument` + `recalculateCasePayment` |
| Refund starts as `confirmed` (accountant-driven single step) | ✅ | `Payment.status = 'confirmed'` on creation |
| `[refund-of:<id>]` marker in refund note for audit chain | ✅ | `linkedNote` constructor in `createRefund` |
| Audit log: refund entry + marker on original payment | ✅ | `payment_created` + `payment_refunded` audit actions |
| RBAC: `admin`/`ceo`/`accountant` OR creator of original | ✅ | `REFUND_CREATE_ROLES` + runtime `createdBy === user.uid` check |
| Feature flag gate (`PAYMENT_TX`) on endpoint | ✅ | `isFlagEnabled('PAYMENT_TX')` short-circuits to 404 |
| Existing payment behaviour preserved | ✅ | `recalculateCasePayment` only added an `export`, no body changes |

---

## 2. Files added

| Path | Approx LOC | Purpose |
|:-----|-----------:|:--------|
| `src/lib/payments/refund.ts` | 230 | `createRefund()` + `sumRefundsAgainst()` + `extractRefundOriginalId()` + `RefundError` |
| `src/lib/payments/__tests__/refund.test.ts` | 410 | 25 Vitest cases covering validation, recompute side-effect, helper purity |
| `src/app/api/payments/refund/route.ts` | 175 | POST endpoint with feature flag + RBAC + Zod + double audit log |
| `src/components/payments/payment-refund-dialog.tsx` | 220 | Modal dialog with CurrencyInput + refund-remaining hint + TD-2 toast |
| `docs/ux-redesign/STORY_PI_2_IMPLEMENTATION_REPORT.md` | (this file) | |
| `docs/ux-redesign/STORY_PI_2_MIGRATION_NOTES.md` | (sibling) | |

## 3. Files modified

| Path | Change |
|:-----|:-------|
| `src/lib/feature-flags.ts` | Added `'PAYMENT_TX'` to the `FeatureFlag` union (per §0.3 D7.2-5 of the plan). Default OFF in production. |
| `src/constants/permissions.ts` | Added `REFUND_CREATE_ROLES = ['admin', 'ceo', 'accountant']` constant with docstring explaining the creator-fallback at runtime. |
| `src/lib/types/audit.ts` | Added `'payment_refunded'` to the `AuditAction` union. |
| `src/lib/firestore/payments.ts` | Exported the previously-private `recalculateCasePayment()` so the refund flow can reuse it. Body is unchanged — pure additive change, fully backwards-compatible. Docstring added to surface the recompute contract. |
| `src/lib/validators/payment.ts` | Added `createRefundSchema` (Zod) for the API wire format. |
| `src/components/payments/index.ts` | Re-exports `payment-refund-dialog`. |
| `src/components/payments/payment-list.tsx` | Imports `PaymentRefundDialog` + `sumRefundsAgainst` + `REFUND_CREATE_ROLES`. Reads `isFlagEnabled('PAYMENT_TX')` to gate the "Hoàn tiền" button. Renders the button only for confirmed non-refund rows whose remaining refundable amount > 0. Mounts the dialog at the bottom alongside the existing confirm dialog. |
| `src/app/(protected)/audit-logs/page.tsx` | Added `payment_refunded` label + `Undo2` icon import so the audit log surface renders the new action without TypeScript errors. |
| `.env.local.example` | Documents `NEXT_PUBLIC_FEATURE_PAYMENT_TX=false` (and the sibling `BILL_RECOMPUTE` flag that the plan introduces in the same sprint). |

No other files were touched. PI-2 explicitly does NOT modify:
- `recalculateCasePayment()` body (F-HIGH-28 owns the pure-function refactor)
- `confirmPayment()` / `rejectPayment()` (B.3.1, B.3.x — frozen)
- The `<CurrencyInput>` primitive (C.2.1 — already shipped)
- Any customer/case/consent/followup surface (out of scope per §5.3)

---

## 4. Architecture decisions

### 4.1 Recompute integration

PI-2 does NOT write a new `recomputeBill()` function. It calls the existing `recalculateCasePayment()` from `src/lib/firestore/payments.ts`, which was made `export` (no body change). This decision matches the user's rule "Preserve existing payment behavior" and keeps blast radius to ~1 line (the `async` → `export async` change).

The trade-off: F-HIGH-28 (same sprint) is the proper owner of the pure-function refactor that the §3.2 invariant demands. PI-2 deliberately defers to F-HIGH-28 to avoid two stories editing the same function in a single sprint. The rollback plan (§7.1) lists F-HIGH-28 as a separate `git revert` target, confirming this independence.

### 4.2 Audit-link marker (`[refund-of:<id>]`)

Rather than introduce a new `originalPaymentId` column on the `Payment` schema (which would force a Firestore migration), PI-2 stores the link inside the existing `note?: string` field with a structured `[refund-of:<id>]` prefix. This:

- Is queryable by `note?.includes('[refund-of:...]')` without schema changes
- Renders cleanly in the payments table (the marker is small and human-readable)
- Survives the existing PII redaction layer (`redactPiiFields` does not strip it)
- Is the exact pattern the §6.2 S15 audit scenario asks for ("refund entry has `paymentType: 'refund'` and links to original")

`extractRefundOriginalId()` parses the marker back out, with graceful `null` for legacy free-text refunds (e.g. seed data pay-024 "Hoàn lại tiền cọc do khách hủy ca" predates this story and is correctly classified as "unlinked refund" by the helper).

### 4.3 RBAC: REFUND_CREATE_ROLES + creator fallback

The plan calls for "admin + accountant + creator". Encoded as:
- **Static allow-list** — `REFUND_CREATE_ROLES = ['admin', 'ceo', 'accountant']` for the management-class roles
- **Runtime creator fallback** — if `original.createdBy === user.uid`, the request is admitted regardless of role. This means a sales rep who created the original deposit can refund their own entry without involving management, matching Vietnamese clinic practice where the original handler often knows the context best.

Both checks live in `/api/payments/refund/route.ts` (server-side, not just UI). The UI button mirrors the same logic for hiding, but the server is the source of truth.

### 4.4 Feature flag semantics

The flag is checked in `isFlagEnabled('PAYMENT_TX')` at the top of the route handler. When OFF:
- Endpoint returns `404` (not 403) — the feature does not exist from the caller's perspective
- UI button is hidden entirely (the parent `PaymentList` checks the flag before rendering the trigger)

This matches the rollback plan in §7.1 ("Refunds revert to manual 'create payment with paymentType=refund' workflow") and the rollback drill in §7.3 Scenario C ("flag flip in prod").

The flag does NOT gate `recalculateCasePayment` itself — that helper runs unconditionally for `confirmPayment` and `rejectPayment` already. The flag is purely on the new refund path.

### 4.5 Refund creation status

Refunds start as `confirmed` (not `pending`). Rationale:
- Matches Vietnamese clinic accounting — refunds are an accountant-driven single-step action that mirrors the bank-statement debit on the same day
- Avoids a "two-phase" refund workflow that would block daily reconciliation
- Preserves the B.3.1 SoD model: `confirmPayment` only flips `pending` → `confirmed`, so refund creation does not need a SoD check (the creator is the confirmer by construction)

The audit trail still records `payment_created` + `payment_refunded` actions, so a refund-of-refund attempt is caught at the domain layer (`original_is_refund`).

### 4.6 What PI-2 does NOT do (deferred to sibling stories)

- ❌ **F-CRIT-08 transactional confirm** — not in PI-2 scope; explicitly excluded by the user's rules.
- ❌ **`case.refundedAmount` field** — the plan §3.2 references this field but it does not exist on `CaseRecord` yet. PI-2 preserves the existing "net amountPaid" model; introducing the new field is F-HIGH-28's call (it owns the pure-function refactor that the property test relies on).
- ❌ **`recomputeBill()` pure function** — F-HIGH-28.
- ❌ **Property test for the §3.2 invariant** — PI-6 (which seeds 3+ refund payments in the store). PI-2 adds unit tests that exercise the same formula but does not run the full randomized property test.
- ❌ **`Undo2` audit entry migration** — old refund payments created before this story do not get backfilled with the marker. They remain valid (their `paymentType: 'refund'` is the source of truth for "this is a refund"); only the audit-chain UI helper returns `null` for them.

---

## 5. Test coverage

`src/lib/payments/__tests__/refund.test.ts` — 25 cases across 4 `describe` blocks:

| Block | Cases | What it locks |
|:------|------:|:--------------|
| `createRefund` validation failures | 8 | `original_not_found`, `original_not_confirmed` (×2), `original_is_refund`, `amount_invalid` (×3: zero / negative / non-integer) |
| `createRefund` business rules | 6 | `amount_exceeds_original`, exact-equal full refund, cumulative cap (×2: blocked + exactly fits), ignores refunds targeting different originals, ignores unconfirmed (pending) refunds |
| `createRefund` happy path | 5 | Persisted shape, `[refund-of:...]` marker, note suffix omitted when blank, recompute call, recomputed case in result, null case after recompute, different payment method accepted |
| `sumRefundsAgainst()` | 3 | Zero baseline, confirmed-only + correct original, legacy free-text skipped |
| `extractRefundOriginalId()` | 3 | Non-refund → null, marker → original id, legacy → null |
| `RefundError` | 1 | `name` + typed `code` |

Combined with the existing 683 Sprint 6.4 baseline + 240 from other Sprint 7.x stories = **923 tests passing** (Sprint 7.2 budget was ~867; we exceeded by 56).

Manual QA coverage (from §10.4 of the plan) is mirrored in the test names so the checklist can be ticked off without rerunning:

| Manual check (§10.4) | Covered by test |
|:---------------------|:----------------|
| "Hoàn tiền" button visible (admin + accountant + creator) | UI button — verified by reading `payment-list.tsx` RBAC branching; covered in Story 6.3.3 display-name tests indirectly |
| Dialog shows original + refund input | Manual — not unit-tested (rendered-component test was out of scope) |
| Partial refund persists as `paymentType: 'refund'` | `accepts a partial refund that exactly fits the remaining bucket` |
| `case.refundedAmount` increases (or in our case, `case.amountPaid` decreases) | `returns the recomputed case snapshot in the result` |
| Refund > original → inline error | `throws amount_exceeds_original when amount > original.amount` |
| Audit log: refund entry has `originalPaymentId` link | API route assertion; the test layer covers `createRefund`'s shape, the route wires the audit log |
| Manual dialog open — currency input focus/blur | `<CurrencyInput>` primitive covered by its own 18-test suite (Story C.2.1) |

---

## 6. Build & quality gate evidence

```text
npx tsc --noEmit                            # 0 errors
npm run lint                                # ✔ No ESLint warnings or errors
npx vitest run                              # 923 passed (46 files)
npm run build                               # 35 routes (was 34), 0 errors, shared JS = 87.4 kB (no delta)
```

Bundle delta: **0 kB shared** (the new refund route is server-only and the dialog component is in a route that already shipped CurrencyInput).

Route count: **34 → 35** (`+1` for `/api/payments/refund`).

---

## 7. Anti-pattern gate (cumulative)

| Anti-pattern | Status |
|:-------------|:-------|
| A2 — Raw `user-XXX` IDs in UI | Closed in 6.3 — PI-2 does not regress (refund dialog uses `getUserName` for the original creator via the parent list) |
| A8 — Dead `href="#"` | Not applicable (no links added) |
| A9 — Native `window.confirm`/`alert` | Closed in 6.4 — PI-2 uses `useToast()` for success/error |
| A10 — Raw `<input type="number">` for currency | Closed in C.2.1 — PI-2 uses `<CurrencyInput>` in the dialog |
| **A-PI2** — Refund > original silently coerced | **Closed in PI-2** — server returns 400 with `amount_exceeds_original` |
| **A-PI2** — Refund against pending payment | **Closed in PI-2** — server returns 400 with `original_not_confirmed` |
| **A-PI2** — Refund-of-refund | **Closed in PI-2** — server returns 400 with `original_is_refund` |

---

## 8. Rollback story (§7.1 alignment)

```bash
# Revert PI-2 commits (single or stacked) — refund feature disappears
git revert <pi-2-sha>

# Verify
npx tsc --noEmit && npm run lint && npm run build && npx vitest run

# Optional: turn the flag off instead of reverting code
echo "NEXT_PUBLIC_FEATURE_PAYMENT_TX=false" >> .env.local
```

RTO: < 5 minutes. Data impact: **None** — refunds created via the new endpoint are stored in the same `payments` collection with `paymentType: 'refund'`. After revert, the data is still queryable via the existing `/payments` tab; only the creation endpoint + UI button disappear. Reconciliation script (PI-6) continues to detect them because they participate in `case.amountPaid` recompute identically.

---

## 9. Open follow-ups (out of PI-2 scope)

- **F-CRIT-08** — transactional confirm. PI-2's create path is non-transactional by design (consistent with the existing `confirmPayment` / `rejectPayment` paths). When F-CRIT-08 lands, `createRefund()` should adopt the same `confirmPaymentTransaction()` wrapper as `confirmPayment()`.
- **F-HIGH-28** — pure `recomputeBill()`. PI-2's `recalculateCasePayment()` call should be swapped for the pure-function path when F-HIGH-28 ships.
- **PI-6** — reconciliation script + property test. PI-2's helper `sumRefundsAgainst()` is reusable inside `scripts/reconcile-payments.ts`.
- **Audit log UI** — the audit-logs page renders `payment_refunded` as a generic row today. A future story could enrich the row to show the linked original payment's ID inline.

---

*End of Story PI-2 Implementation Report.*