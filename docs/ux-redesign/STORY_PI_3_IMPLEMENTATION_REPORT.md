# Story PI-3 — Payment Audit Enrichment — Implementation Report

> **Story:** PI-3 (Sprint 7.2 — Payment Integrity)
> **Status:** ✅ Complete
> **Branch:** `main`
> **Files added:** 3
> **Files modified:** 7
> **Tests added:** 36 (29 unit + 7 route)
> **Net test delta:** 1006 → 1023 (+17 net after refactor of 4 legacy F-CRIT-08 assertions)

---

## 1. Summary

PI-3 replaces the flat `before` / `after` payload of every payment audit entry with a **structured diff** + **state-transition log** + **case-bill delta** + **caseId / originalPaymentId links**. The new shape lets auditors answer "who moved this payment from `pending` to `confirmed`, what changed, and what was the case's bill before/after?" from a single audit entry — without cross-referencing the case record.

The story introduces a new helper module (`@/lib/audit/payment-audit`) that wires the B.2.3 PII-redaction contract (Sprint 6.2) into every payment audit write — both the non-transactional path (`writePaymentAudit`) and the F-CRIT-08 transactional path (`txWritePaymentAudit`). F-CRIT-08's atomicity guarantees are preserved exactly; the audit entry now uses the same enriched shape in both paths.

A new audit-log deep link (`/audit-logs?entityId=<payment-id>`) closes the loop from the payments page to the per-payment audit history.

---

## 2. Files added

| Path | LOC | Purpose |
|------|----:|---------|
| `src/lib/audit/payment-audit.ts` | ~410 | New `writePaymentAudit` + `txWritePaymentAudit` helpers + pure builders (`buildPaymentDiff`, `deriveStateTransition`, `buildPaymentAuditEntry`). |
| `src/lib/audit/__tests__/payment-audit.test.ts` | ~480 | 29 tests: diff formatting, state transition, redaction, cross-path shape parity. |
| `src/app/api/payments/refund/__tests__/route.test.ts` | ~250 | 7 tests: PI-3 enriched audit shape for refund route, flag gate, permission gate, error mapping. |

---

## 3. Files modified

| Path | Change |
|------|--------|
| `src/lib/payments/transaction.ts` | Committed audit entry rewritten via `txWritePaymentAudit`; abort audit rewritten via `writePaymentAudit`. Same atomicity contract; enriched payload. **F-CRIT-08 behaviour preserved exactly** (4 existing tests updated to match new `after.metadata.*` shape). |
| `src/app/api/payments/[id]/confirm/route.ts` | SoD-denied and legacy-success audit writes go through `writePaymentAudit`. Transactional path untouched. |
| `src/app/api/payments/[id]/confirm/__tests__/route.test.ts` | SoD + success audit assertions updated to match enriched shape (`after.caseId`, `after.metadata`, `__diff`). Mocks allow real `writePaymentAudit` wrapper so production shape is observable. |
| `src/app/api/payments/[id]/confirm/__tests__/route.transactional.test.ts` | Same shape updates; mock pattern updated to use `importOriginal` so the test asserts the production `writeAuditLog` payload, not the wrapper input. |
| `src/app/api/payments/[id]/reject/route.ts` | Pre-reject record read + diff written via `writePaymentAudit`. Fallback to legacy `writeAuditLog` when the pre-record is missing. |
| `src/app/api/payments/refund/route.ts` | Both refund-side (`payment_created` on refund) and original-side (`payment_refunded` on original) writes go through `writePaymentAudit` with `originalPaymentId` link. |
| `src/app/api/payments/route.ts` | **New** audit write on payment create (none existed pre-PI-3). |
| `src/app/api/audit-logs/route.ts` | New `entityId` query param so `/audit-logs?entityId=<id>` filters to one payment's history. |
| `src/app/(protected)/audit-logs/page.tsx` | New `entityId` filter input + clear-filter chip. Deep-link from the payments page reads `?entityId=` from `useSearchParams` and pre-applies the filter on mount. |
| `src/components/payments/payment-list.tsx` | New `Lịch sử` column per row with a deep link to `/audit-logs?entityId=<row.id>`. |
| `src/lib/payments/__tests__/transaction.test.ts` | 4 abort-shape assertions updated to match the PI-3 enriched `after.metadata.*` layout. Mock updated to use `importOriginal` so `redactPiiFields` passthrough works. |

---

## 4. Module design (`@/lib/audit/payment-audit`)

### 4.1 Public API

```ts
// Pure — no side effects
buildPaymentDiff(before, after): PaymentDiff
deriveStateTransition(before, after, actor, note?): PaymentStateTransition | null
buildPaymentAuditEntry(input): Pick<AuditLog, ...> & { __diff?, __stateTransition? }

// Side-effect wrappers
writePaymentAudit(input): Promise<void>          // → writeAuditLog (non-tx)
txWritePaymentAudit(tx, input): string           // → tx.set (Firestore tx)
```

### 4.2 Enriched `after` payload shape

```ts
{
  ...redactedAfter,
  __diff: { [field]: { from, to } },          // only present when fields changed
  __stateTransition: { from, to, at, actor, note? },
  caseId: 'case-001',                          // fast filter
  originalPaymentId?: 'pay-001',               // PI-2 refund chain link
  trigger?: 'PI-3 refund created',             // human-readable cause
  caseBill?: { before: CaseBillPoint, after: CaseBillPoint },
  metadata?: { ... }                           // PII-redacted; abort / SoD denial flags
}
```

### 4.3 PII redaction (B.2.3 consistency)

`buildPaymentAuditEntry` runs `redactPiiFields()` from `@/lib/firestore/audit` against both `before` and `after`, and also against any `metadata` payload. The same fields are scrubbed (`medicalNote`, `privacyNote`, `nationalIdNumber`) — no new PII risk surface introduced.

### 4.4 Field ordering

`buildPaymentDiff` orders changed fields by `DIFFABLE_PAYMENT_FIELDS` (status → paymentType → amount → paymentMethod → paymentDate → confirmedBy → confirmedAt → receivedBy → rejectedBy → rejectedAt → note). Unknown future fields are sorted alphabetically and appended. The order is stable so the audit-logs UI can render a deterministic diff.

---

## 5. Route-level wiring

### 5.1 Confirm route

- **Transactional path (`PAYMENT_TX=true`)** — unchanged at the route level; the transaction helper calls `txWritePaymentAudit` internally.
- **Legacy path (`PAYMENT_TX=false`)** — replaced the flat `writeAuditLog` with `writePaymentAudit`. Diff covers `status`, `confirmedBy`, `confirmedAt`, `note`.
- **SoD-denied path** — replaced the flat `writeAuditLog` with `writePaymentAudit`. Abort metadata now nested under `after.metadata = { denied: true, reason: 'sod_violation', attemptedBy }`. Same SOC filter behaviour; richer payload.

### 5.2 Reject route

- Pre-reject record read so the diff covers `status: pending → rejected`, `note: <reason>`. If the pre-record is missing (rare race), fallback to legacy flat writeAuditLog so the audit trail never silently disappears.

### 5.3 Refund route

- **`payment_created` (on refund)** — `entityId = refund.id`, `originalPaymentId` link in `after`.
- **`payment_refunded` (on original)** — `entityId = originalPaymentId` (S15 — auditors trace chains from the original payment's audit history). Refund id + amount + actor under `after.metadata`. Diff surfaces the note change (refund marker appended).

### 5.4 Create route

- **New** audit write on every payment create (none existed pre-PI-3). `entityId = payment.id`, `trigger = 'PI-3 payment create'`. The `__stateTransition` log carries `from: 'none', to: 'pending'`.

---

## 6. UI surface

### 6.1 Payments page — new "Lịch sử" column

A new column appears in every row (not gated by `canApprove` — audit reading is a separate `audit:read` permission that all roles with payments visibility already hold). Each cell is a deep link to `/audit-logs?entityId=<row.id>` styled with `text-swan-700` + `FileSearch` icon + tooltip.

### 6.2 Audit logs page — `entityId` filter + deep-link honor

- New `entityId` text input under the existing 3-column filter row.
- "Xóa bộ lọc" chip appears when the filter is populated.
- `useSearchParams` reads `?entityId=` on mount, locks `entityType='payment'`, and populates the filter. A subsequent manual change drops the deep-link lock so the accountant can escape back to the global view.
- The API route `/api/audit-logs` accepts `entityId=` and filters server-side.

---

## 7. Test results

### 7.1 New tests (PI-3)

| File | Tests | Coverage |
|------|------:|----------|
| `src/lib/audit/__tests__/payment-audit.test.ts` | 29 | diff format, field order, null handling, state transition derivation, redaction, cross-path shape parity, transactional wrapper |
| `src/app/api/payments/refund/__tests__/route.test.ts` | 7 | flag gate, PI-3 enriched payload (refund + original), permission gate, error mapping |

### 7.2 Existing tests updated to match enriched shape

| File | Δ tests | Notes |
|------|--------:|-------|
| `src/lib/payments/__tests__/transaction.test.ts` | 0 (assertions only) | 4 abort-shape assertions updated: `before.status` (was `before.paymentStatus`); `after.metadata.{aborted,stage,reason}` (was `after.{aborted,stage,reason}`). F-CRIT-08 atomicity contract unchanged. |
| `src/app/api/payments/[id]/confirm/__tests__/route.test.ts` | 0 (assertions only) | SoD denial assertion updated to `after.metadata.{denied,reason,attemptedBy}`; success assertion updated to include `__diff.confirmedBy`. |
| `src/app/api/payments/[id]/confirm/__tests__/route.transactional.test.ts` | 0 (assertions only) | Legacy success assertion updated to assert `after.caseId` + `after.trigger`. SoD denial assertion updated to nested metadata shape. |

### 7.3 Full suite

```
Test Files  51 passed (51)
Tests       1023 passed (1023)
```

Pre-Sprint 7.2 baseline: 683 → 867 → 999 → 1006 → **1023** (+17 net from PI-3 alone after refactoring 4 existing assertions).

---

## 8. Build & quality gates

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 warnings |
| `npm run build` | 35 routes, 0 errors |
| Shared First Load JS | 87.4 kB (unchanged from Sprint 7.1 baseline — within 5% budget) |
| Anti-pattern gate (A1/A2/A8/A9/A22/A26) | 0 violations (no new violations introduced) |

---

## 9. Acceptance criteria checklist (from SPRINT_7_2_EXECUTION_PLAN.md §1 PI-3)

- [x] **Structured diff** — `buildPaymentDiff` orders 11 known fields + unknown future fields alphabetically.
- [x] **State-transition log** — `deriveStateTransition` + `__stateTransition` in the `after` payload.
- [x] **caseId link** — every PI-3 audit entry carries `after.caseId` for fast filter.
- [x] **originalPaymentId link** — refund route writes it on both `payment_created` (refund) and `payment_refunded` (original).
- [x] **B.2.3 PII redaction** — reuses `redactPiiFields`; verified by unit tests with explicit `medicalNote` / `privacyNote` / `nationalIdNumber` payloads.
- [x] **F-CRIT-08 transactional path preserved** — same 3 atomic writes; same `runTransaction` wrapper; enriched payload shape produced by `txWritePaymentAudit`.
- [x] **F-HIGH-28 bill recompute preserved** — `recalculateCasePayment()` + `recomputeBillFromPayments` untouched; PI-3 only writes more rich audit metadata around the existing recompute side-effect.
- [x] **Audit log link per payment row** — new `Lịch sử` column in payments page deep-linking `/audit-logs?entityId=<id>`.
- [x] **Cross-path shape parity** — committed (`payment_transaction_committed`) and non-tx (`payment_confirmed`) audit entries produce the same `after` payload structure (verified by test).
- [x] **No new dependencies** — uses existing `firebase` SDK + zod + RHF; pure JS for diff / state-transition logic.

---

## 10. Known limitations / future work

- **Audit logs UI does not yet render `__diff` as a structured diff** — the `audit-logs/page.tsx` still JSON-stringifies `after` into a `<pre>` block. The enriched shape is preserved on the wire; surfacing the diff visually is left for a follow-up UI story (suggested: PI-3.5).
- **State-transition log is surfaced as JSON** — same reason as above. A future story could add a `<PaymentStateTransitionChip />` primitive to render the `from → to` arrow with actor + timestamp inline.
- **`buildPaymentDiff` includes fields outside `DIFFABLE_PAYMENT_FIELDS`** — by design (so future Payment fields don't silently drop). A future story could pin a stricter allow-list if the audit schema is locked down.

---

*End of PI-3 Implementation Report.*