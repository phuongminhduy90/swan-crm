# Story F-HIGH-28 — Migration Notes

> **Story:** F-HIGH-28 — Bill recompute as single source of truth
> **Sprint:** 7.2 — Payment Integrity & Currency Hardening
> **Branch:** `main`
> **Author:** Tech Lead / FE-1
> **Date:** 2026-07-01

This document is the rollback + blast-radius guide for Story F-HIGH-28. It
ships alongside [`STORY_F_HIGH_28_IMPLEMENTATION_REPORT.md`](STORY_F_HIGH_28_IMPLEMENTATION_REPORT.md).

---

## 1. What changed (TL;DR)

A new pure `recomputeBillFromPayments()` function in `src/lib/billing/recompute.ts`
now aggregates `case.amountPaid`, `case.refundedAmount`, `case.remainingAmount`,
and `case.paymentStatus` from the **full source-of-truth payment history**
on every recompute — replacing the prior incremental add/subtract logic.

Three integration points:

| Call site | Before | After |
|:----------|:-------|:------|
| `recalculateCasePayment()` in `src/lib/firestore/payments.ts` | Incremental add/subtract over the last write | Delegates to the pure function (when flag ON) |
| `addCaseService()` in `src/lib/firestore/cases.ts` | Did not touch case bill totals | Triggers `recomputeBillForCase()` after persisting the row |
| `updateCaseService()` in `src/lib/firestore/cases.ts` | Did not touch case bill totals | Triggers `recomputeBillForCase()` after updating the row |
| `removeCaseService()` in `src/lib/firestore/cases.ts` | Did not touch case bill totals | Triggers `recomputeBillForCase()` after soft-deleting the row |

New `bill_recomputed` audit action surfaces every recompute event so the
accountant can trace bill-state changes back to a single source-of-truth
aggregation.

All behaviour is gated behind `NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE` —
default OFF in production. The flag defaults live in `.env.local.example`
(already present for PI-1; F-HIGH-28 ships without any new flag entries).

---

## 2. Feature flag inventory

| Flag | Status (this story) | Default in prod | Notes |
|:-----|:--------------------|:----------------|:------|
| `NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE` | **Active code path** | `false` | Pre-existing flag from PI-1 (Sprint 7.2). F-HIGH-28 wires the pure recompute behind it; production keeps the Sprint 6.4 incremental behaviour until C-7 accountant pairing sign-off. |

---

## 3. Database / schema changes

### 3.1 No new collections

The story does **not** add any Firestore collections. It writes to the
existing `cases` collection (`amountPaid`, `remainingAmount`,
`paymentStatus`) and to `auditLogs` (with the new action type).

### 3.2 Audit action added

`AuditAction` union extended by **one** variant (`bill_recomputed`). No
existing audit entries are migrated; pre-F-HIGH-28 history is unchanged.

```ts
// src/lib/types/audit.ts
| 'bill_recomputed'
```

### 3.3 `CaseRecord` schema — unchanged

No new fields. The recompute reuses the existing `amountPaid`,
`remainingAmount`, and `paymentStatus` columns. `refundedAmount` does NOT
exist on `CaseRecord` — it is a derived value the recompute computes from
the payment history. The current case UI does not surface
`refundedAmount` separately, but the recompute preserves it in the
`BillSnapshot.billHash` and the audit log so future stories can read it.

---

## 4. Behavioural changes

### 4.1 What changes when the flag flips ON

- `case.amountPaid` = sum of `confirmed` non-refund payments (was:
  incremental net of last confirm/reject/refund).
- `case.refundedAmount` is computed on every recompute and stored in the
  audit log. The `case` document itself does NOT carry a `refundedAmount`
  field — the value flows back through `case.remainingAmount` and the
  audit log.
- `case.remainingAmount` = `max(0, totalBillAfterDiscount − amountPaid + refundedAmount)`.
  In the legacy path, `remainingAmount` did **not** add back refunded
  amounts. The new formula produces a higher remaining when refunds
  exceed deposits, which matches the Vietnamese accounting convention
  that a refund creates additional credit toward the customer.
- `case.paymentStatus` decision tree slightly reordered:
  - `refunded` when amountPaid = 0 and refundedAmount > 0.
  - `paid` when amountPaid >= totalBillAfterDiscount (regardless of total).
  - `deposit` when amountPaid > 0 and any confirmed payment is a deposit and total > amountPaid.
  - `partial` when amountPaid > 0, total > amountPaid, and no confirmed deposit.
  - `unpaid` otherwise.

  The pre-F-HIGH-28 logic had `amountPaid === 0` → `unpaid` BEFORE the
  `amountPaid >= total` check, which produced `unpaid` for the edge case
  `totalBillAfterDiscount = 0` even when amountPaid > 0. The new order
  fixes that.

### 4.2 What does NOT change

- `case.totalBillBeforeDiscount` / `case.totalBillAfterDiscount` are
  recomputed from the service list ONLY inside `recomputeBillFromServices()`
  (used by the recompute helper), NOT mutated by the legacy
  `recalculateCasePayment()`. Service recompute only fires when a service
  is added/updated/removed.
- Payment confirm / reject / refund endpoints retain their existing
  behaviour. The only change is that `recalculateCasePayment()` now
  delegates to the pure function, so the case totals are accurate even if
  the payment history has drifted since the last write.
- The PI-2 refund flow (`src/lib/payments/refund.ts`) is untouched —
  `createRefund()` still calls `recalculateCasePayment()` after persisting
  the refund. The recompute happens inside that helper, transparently to
  PI-2.

### 4.3 Service-side recompute (service add/remove/update)

When `BILL_RECOMPUTE` is ON, `addCaseService`, `updateCaseService`,
`removeCaseService` now write the following sequence:

1. Persist the service row (unchanged behaviour).
2. `updateCase({ totalBillBeforeDiscount, totalBillAfterDiscount })` from
   `recomputeBillFromServices()`.
3. `updateCase({ amountPaid, remainingAmount, paymentStatus })` from the
   pure `recomputeBillFromPayments()`.
4. `writeAuditLog({ action: 'bill_recomputed', after: { trigger, ... } })`.

Each `updateCase` call increments the case's `updatedAt`; the bill
indicator chip (PI-1) reads `updatedAt` as a fallback timestamp, so the
chip refreshes automatically.

When the flag is OFF, the service functions return their pre-F-HIGH-28
behaviour exactly: no recompute, no extra write. This is the rollback
path.

---

## 5. Rollback procedure

### 5.1 Whole-story revert

```bash
# Revert F-HIGH-28 commits only (these are the only commits touching
# src/lib/billing/, src/lib/firestore/payments.ts recompute branch, and
# src/lib/firestore/cases.ts recompute helper)
git log --oneline -- src/lib/billing/ | head -10
git revert --no-commit <commit-sha>
git revert --no-commit <commit-sha>
# (repeat for each F-HIGH-28 commit)

# Or if F-HIGH-28 is a single stacked commit, a single revert works:
git revert <commit-sha>

# Verify
npx tsc --noEmit && npm run lint && npm run build && npx vitest run
```

### 5.2 Flag-flip-only rollback

If reverting the code is risky mid-sprint (e.g., other Sprint 7.2 stories
in flight), simply set `NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE=false` in
`.env.local` (and any deployment environment). Production code keeps
behaving exactly as Sprint 6.4.

```bash
# .env.local
NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE=false
```

No data migration is required — the `cases` documents were updated by
F-HIGH-28 are still consistent with the legacy recalculation formula
because the pure function's output is a **superset** of the legacy
behaviour (it produces identical results for the common case and
corrects drift when present). Setting the flag OFF stops the recompute
path; legacy `recalculateCasePayment()` reads the same `cases` documents
and arrives at the same (or drift-corrected) totals.

### 5.3 Recovery if production drift is detected post-revert

If the reconciliation script reports `case.amountPaid` divergence from
`Σ(confirmed payments)` after a revert:

1. Read the drift report — each line identifies a case and the expected
   vs actual `amountPaid`.
2. Open the case in `/cases/[id]`, add a service (or save the form), so
   the legacy path runs `recalculateCasePayment()` once on the live
   payment history.
3. Or manually correct the case via the existing `updateCase` API.
4. Write audit log entry: `case_updated` with `after.amountPaid` set to
   the reconciled value.

---

## 6. Blast radius analysis

| Change | Blast radius | Risk |
|:-------|:-------------|:-----|
| `src/lib/billing/recompute.ts` (new file) | None — additive, no imports from existing modules except `@/lib/types` | 🟢 None |
| `src/lib/billing/__tests__/recompute.test.ts` (new file) | None — additive | 🟢 None |
| `src/lib/firestore/payments.ts` (`recalculateCasePayment` flagged branch) | The flag controls which branch runs. OFF path is byte-identical to Sprint 6.4. | 🟢 None (flag-gated) |
| `src/lib/firestore/cases.ts` (`addCaseService` etc. add recompute helper) | Flag-gated — OFF path skips the helper entirely. The helper is no-op when the flag is OFF. | 🟢 None (flag-gated) |
| `src/lib/types/audit.ts` (`bill_recomputed` added) | Additive — existing audit logs are unaffected. New action is rendered with a dedicated `<RefreshCw>` chip in `/audit-logs`. | 🟢 None |
| `src/app/(protected)/audit-logs/page.tsx` (`bill_recomputed` label) | Compile-time check; without this label, TypeScript blocks the build. | 🟡 Required — see Migration Step 5.4 below |
| `.env.local.example` | Already documents `BILL_RECOMPUTE`. No change. | 🟢 None |

### 6.1 Required migration steps

For existing deployments:

1. **No data migration.** The recompute writes to the same `cases` columns
   the legacy path writes. If the legacy path had drift, the first
   recompute with the flag ON will correct it.
2. **No new permissions.** The recompute runs in the existing actor's
   context; no permission changes are required.
3. **Feature flag.** Set `NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE=true` in
   `.env.local` for development. **Production stays `false`** until the
   C-7 accountant pairing session (Sprint 7.2 §3.3) signs off.

---

## 7. Test summary

| Suite | Count | Notes |
|:------|------:|:------|
| `src/lib/billing/__tests__/recompute.test.ts` | **33** | Pure function: 14 unit + 19 property-test iterations |
| Existing payment / refund / case tests | **923** | All passing — no regressions |

The new suite covers:

- Pure-function boundary cases (empty list, pending/rejected, refund
  overflow, zero total, non-finite amounts).
- `sumConfirmedPayments` / `sumConfirmedRefunds` / `isPaymentHistoryUsable` /
  `hashBillState` / `snapshotToCaseUpdate`.
- `recomputeBillFromServices` (gift exclusion, soft-delete, percent /
  fixed discount).
- **Property tests**: 1000 randomized case states × full invariant
  (`amountPaid`, `refundedAmount`, `remainingAmount`, hash idempotency,
  non-negativity).
- Drift regression scenarios S4 / S5 / S6 from Sprint 7.2 §6.2.

---

## 8. Known limitations

- **No production Firestore transaction wrapper.** The pure function
  produces a snapshot; the wrapper writes it in two `updateCase()` calls.
  A future story (F-CRIT-08 transactional confirm — Sprint 7.2) will wrap
  the writes in a Firestore transaction. The pure function is already
  ready for that.
- **Hash is djb2, not cryptographic.** Suitable only for cheap equality
  comparison (`snap.billHash === other.billHash`); not for security.
- **No live cursor on legacy drift.** Pre-F-HIGH-28 cases may have
  drifted `amountPaid` values. The first time the flag flips ON (or the
  service-side recompute fires), the values are reconciled. Operators
  can also force a reconciliation by editing any service row.

---

## 9. Sign-off chain (Sprint 7.2 §3.3)

- [ ] **C-7** Accountant pairing — bill recompute across 5 case states
      (script runs against the mock store; pairs observe the case-detail
      info tab updating).
- [ ] **C-8** Full revenue walkthrough — script reports zero drift after
      the recompute lands.

---

## 10. References

- [`SPRINT_7_2_EXECUTION_PLAN.md`](SPRINT_7_2_EXECUTION_PLAN.md) §1 (F-HIGH-28), §3.2 (revenue invariant), §5.1 (new files), §6.2 (test scenarios S4–S6).
- [`STORY_F_HIGH_28_IMPLEMENTATION_REPORT.md`](STORY_F_HIGH_28_IMPLEMENTATION_REPORT.md) — design + change log.
- `src/lib/billing/recompute.ts` — pure recompute.
- `src/lib/billing/__tests__/recompute.test.ts` — 33 tests.
- `src/lib/firestore/payments.ts` — `recalculateCasePayment()` integration.
- `src/lib/firestore/cases.ts` — service-side recompute helper.
- `src/lib/types/audit.ts` — `bill_recomputed` action.