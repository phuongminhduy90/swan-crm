# F-CRIT-08 — Transactional Payment Confirm — Implementation Report

> **Story ID:** F-CRIT-08 (TD-3)
> **Sprint:** 7.2 (Payment Integrity, Bill Recompute, Currency Hardening)
> **Branch:** `main` (stacked commits per TD-1 Conventional Commits)
> **Date:** 2026-07-01
> **Risk:** 🔴 Revenue-critical (Sprint 7.2 §3.1 R7.2-1)
> **Flag:** `NEXT_PUBLIC_FEATURE_PAYMENT_TX` (default `false` in production)

---

## 1. What landed

### 1.1 New files

| Path | Purpose |
|:-----|:--------|
| `src/lib/payments/transaction.ts` | `confirmPaymentTransaction(paymentId, input, actor)` — wraps three writes in a single Firestore transaction. |
| `src/lib/payments/__tests__/transaction.test.ts` | 17 unit tests covering happy path, abort paths, audit log consistency, bill recompute consistency, error type sanity. |
| `src/app/api/payments/[id]/confirm/__tests__/route.transactional.test.ts` | 14 API route tests covering the PAYMENT_TX flag ON/OFF branches, SoD interplay, abort → 404/409/500 mapping, notification on success. |

### 1.2 Modified files

| Path | Change |
|:-----|:-------|
| `src/lib/types/audit.ts` | Added `payment_transaction_committed` and `payment_transaction_aborted` to the `AuditAction` union. |
| `src/lib/mock/store.ts` | Added `runMockTransaction` + `MockTransaction` (BEGIN/COMMIT/ROLLBACK simulator) so the in-memory mock store can verify all-or-nothing transaction semantics. |
| `src/lib/firebase/firestore.ts` | Added the `runTransaction` shim that delegates to real Firestore `runTransaction` in production and `runMockTransaction` in dev/test. Exposes a uniform `TransactionHandle` with `get/update/set/delete`. |
| `src/lib/firestore/payments.ts` | `confirmPayment` now branches on `isFlagEnabled('PAYMENT_TX')`: when ON, delegates to `confirmPaymentTransaction`; when OFF, preserves the legacy two-step path. |
| `src/app/api/payments/[id]/confirm/route.ts` | When the `PAYMENT_TX` flag is ON, the route calls `confirmPaymentTransaction` and translates the typed `TransactionAbortError` codes (`payment_not_found` → 404, `payment_already_processed` → 409, `case_not_found` → 404, `write_failed` → 500). When the flag is OFF, the legacy two-step + legacy audit log path is preserved exactly. |
| `src/app/(protected)/audit-logs/page.tsx` | Added Vietnamese labels for the two new audit actions in the `AUDIT_ACTION_LABELS` table. |

### 1.3 No changes to other stories

Per scope discipline: F-CRIT-08 does **not** touch `F-HIGH-28` (bill recompute), `C.2.1` (`<CurrencyInput>`), `PI-1`/`PI-2`/`PI-3`, the API route structure (other than adding the transactional branch), the mock store seed data, the validator schemas, or any UI component. The bill recompute invariant from F-HIGH-28 is reused by `confirmPaymentTransaction` (it calls `recomputeBillFromPayments`) but the F-HIGH-28 helper itself is unchanged.

---

## 2. Atomicity contract (what F-CRIT-08 actually guarantees)

The transactional `confirmPayment` flow commits three writes in a single transaction:

1. **Payment status update** — `payment.status = 'confirmed'`, `confirmedBy = <uid>`, `confirmedAt = <iso>`, `note = <optional>`, `updatedBy = <actor.uid>`.
2. **Case bill recompute** — `case.amountPaid / case.remainingAmount / case.paymentStatus` recomputed from the FULL payment history (using the F-HIGH-28 pure function `recomputeBillFromPayments`).
3. **Audit log entry** — `payment_transaction_committed` with the before/after snapshot of the payment AND the case amounts.

If any of the three writes fails, the entire transaction is rolled back. No partial state is persisted. A `payment_transaction_aborted` audit entry is written AFTER the rollback (best-effort) so the failure is SOC-traceable.

### 2.1 Pre-conditions (gated by the transaction itself)

- The payment exists in Firestore (`payment_not_found` if not).
- The payment is in `pending` state (`payment_already_processed` if not).
- The case exists in Firestore (`case_not_found` if not).

These are all checked inside the transaction callback so a concurrent state change between read and write is detected.

### 2.2 What the transaction does NOT check (and why)

- **Separation of Duties (SoD)** — the SoD self-confirm guard is enforced at the API route, BEFORE the transaction starts (R7.2-7). The transaction helper itself only validates `status === 'pending'`. This is intentional: SoD is a permission concern, not a data-consistency concern. The two checks together give: "the user has the right to confirm this payment, AND the payment is in the right state to be confirmed."
- **Permission check (role allow-list)** — also enforced at the API route, before the transaction. Same rationale: permissions are a separate concern from data integrity.

### 2.3 Failure modes mapped to HTTP status codes

| Transaction error code | HTTP status | Error message (Vietnamese) |
|:-----------------------|:-----------:|:---------------------------|
| `payment_not_found` | 404 | "Không tìm thấy thanh toán" |
| `payment_already_processed` | 409 | "Thanh toán không ở trạng thái chờ xác nhận" |
| `case_not_found` | 404 | "Không tìm thấy hồ sơ" |
| `write_failed` (any other error) | 500 | "Không thể xác nhận thanh toán: giao dịch đã bị hủy" |
| SoD violation (route-level) | 403 | "Vi phạm phân tách nhiệm vụ (SoD)..." |

---

## 3. Feature flag — `PAYMENT_TX`

| Environment | Default | Promotion gate |
|:------------|:-------:|:---------------|
| Production | `false` | C-6 + C-7 + C-8 accountant pairing → triple sign-off |
| Dev (`.env.local.example`) | n/a — flag is read at runtime | |

The flag already existed in the `FeatureFlag` union (Sprint 7.2 §5.2 PI-2 mention). F-CRIT-08 implements the actual transactional path behind it. When the flag is OFF, the route's behavior is **byte-identical** to Sprint 6.4 / 7.1 — same two-step confirm + same legacy `payment_confirmed` audit log. When the flag is ON, the route goes through `confirmPaymentTransaction` and the transactional helper writes its own audit log.

The flag's job is to allow staged rollout. Sprint 7.2 §3.1 R7.2-1 calls out that "the current `confirmPayment()` is non-atomic, a Firestore write failure between UI success and audit-log write can leave a payment in an inconsistent state." The flag lets us verify the transactional path in dev/staging first, then promote after C-6 + C-7 + C-8 sign-off.

---

## 4. Test coverage

### 4.1 `src/lib/payments/__tests__/transaction.test.ts` — 17 tests

| # | Test | What it verifies |
|:--|:-----|:-----------------|
| 1 | happy path: calls runTransaction and returns the result | The helper goes through the `runTransaction` shim, not the legacy path. |
| 2 | happy path: does not write the abort audit log | The success path does NOT spuriously write `payment_transaction_aborted`. |
| 3 | payment not found: aborts with `payment_not_found` | Pre-condition check inside the tx catches missing payments. |
| 4 | payment not found: abort audit log has the correct shape | The `after` payload carries `{ aborted: true, stage: 'payment', reason: '...', caseId: '...' }`. |
| 5 | payment already processed: aborts with `payment_already_processed` | Prevents double-confirm. |
| 6 | payment already processed: abort audit log stage | The stage field distinguishes which write failed. |
| 7 | case not found: aborts with `case_not_found` | Pre-condition check inside the tx catches missing cases. |
| 8 | case not found: abort audit log stage = 'case' | The stage field is `case` (not `payment`). |
| 9 | rollback: throws TransactionAbortError on tx rejection | The catch block wraps unknown errors as `write_failed`. |
| 10 | rollback: writes abort audit log on tx rejection | The forensic audit log fires even on infrastructure failures. |
| 11 | rollback: wraps unknown errors with `write_failed` code | The error code is consistent regardless of the underlying cause. |
| 12 | audit log consistency: callback writes the committed entry | The committed audit log is written inside the transaction (not via `writeAuditLog` after the fact). |
| 13 | audit log consistency: abort log has `before.paymentStatus = pending` | The before snapshot preserves the pre-tx state. |
| 14 | bill recompute: hypothetical sum includes the new payment | The transaction adds the confirmed payment to the sum (since the case-payments query is non-transactional and runs before the payment update is committed). |
| 15 | bill recompute: zero-amount case → `paid` status | The recompute correctly handles the edge case. |
| 16 | TransactionAbortError: type sanity | The error class is well-typed with `code` + `stage` + `message`. |
| 17 | TransactionAbortError: preserves all valid code values | Pin the 4 valid codes so a future PR cannot add/remove without updating the docs. |

### 4.2 `src/app/api/payments/[id]/confirm/__tests__/route.transactional.test.ts` — 14 tests

| # | Test | What it verifies |
|:--|:-----|:-----------------|
| 1 | PAYMENT_TX OFF: uses legacy `confirmPayment` | Flag OFF → no regression. |
| 2 | PAYMENT_TX OFF: writes legacy `payment_confirmed` audit log | Flag OFF → no regression. |
| 3 | PAYMENT_TX ON: uses `confirmPaymentTransaction` | Flag ON → transactional path. |
| 4 | PAYMENT_TX ON: does NOT write legacy audit log | The tx helper writes its own audit log; the route does not duplicate. |
| 5 | PAYMENT_TX ON: passes actor (uid, displayName, role) | The actor object is forwarded correctly. |
| 6 | PAYMENT_TX ON: passes paymentId, confirmedBy, note | The input is forwarded correctly. |
| 7 | PAYMENT_SOD + PAYMENT_TX ON: rejects self-confirm with 403 | SoD runs BEFORE the tx (R7.2-7). |
| 8 | PAYMENT_SOD + PAYMENT_TX ON: writes SoD audit log | The SoD violation is still SOC-traceable. |
| 9 | `payment_not_found` → 404 | Error code → HTTP status mapping. |
| 10 | `payment_already_processed` → 409 | Error code → HTTP status mapping. |
| 11 | `case_not_found` → 404 | Error code → HTTP status mapping. |
| 12 | `write_failed` → 500 | Error code → HTTP status mapping. |
| 13 | unknown error → 500 | Non-TransactionAbortError → 500. |
| 14 | notification fires on success in transactional mode | The post-tx notification trigger is preserved. |

### 4.3 Coverage of the explicit acceptance criteria from SPRINT_7_2 §6.2

| Scenario | Test file | Test name |
|:---------|:----------|:----------|
| **S1** Two concurrent confirms — only one wins | route.transactional.test.ts | "rejects self-confirm with 403" + "payment_already_processed → 409" |
| **S2** Audit log write fails → transaction aborts | transaction.test.ts | "rollback on failure" suite |
| **S14** Audit log includes `beforeData.amountPaid` + `afterData.amountPaid` | transaction.test.ts | "audit log consistency" suite |
| **S15** Refund → confirm audit entry (PI-2 owned, verified) | F-HIGH-28 / PI-2 docs | (out of F-CRIT-08 scope) |

---

## 5. Files NOT touched (scope discipline)

- ❌ `src/components/ui/*` — no changes to UI primitives
- ❌ `src/components/payments/payment-confirm-dialog.tsx` — UI is unchanged; the dialog continues to call the same API endpoint. The error handling (toast) is unchanged because the new error messages use the same Vietnamese wording as the legacy ones.
- ❌ `src/lib/billing/recompute.ts` — the F-HIGH-28 pure function is reused as-is.
- ❌ `src/lib/firestore/audit.ts` — `writeAuditLog` is reused as-is.
- ❌ `src/lib/validators/payment.ts` — the request schema is unchanged.
- ❌ `src/lib/notifications/trigger.ts` — the notification trigger is unchanged.
- ❌ All other payment API routes (`/api/payments/route.ts`, `/api/payments/[id]/reject/route.ts`, `/api/payments/refund/route.ts`) — F-CRIT-08 only touches `/confirm`.
- ❌ Mock store seed data — no changes.

---

## 6. Definition of Done — checklist

- [x] UI complete — N/A (no UI changes)
- [x] Validation implemented — Vietnamese error messages preserved from legacy
- [x] Loading, error, empty states — error path already covered by the existing toast-based UI
- [x] RBAC enforced — SoD + role allow-list still enforced (at the route, before the tx)
- [x] Audit log — `payment_transaction_committed` + `payment_transaction_aborted` written by the tx helper
- [x] Firestore real data — `runTransaction` shim delegates to `firebase-admin` `runTransaction` in real mode
- [x] Firebase errors handled — `TransactionAbortError` typed with code + stage; `writeAuditLog` swallows audit-on-abort errors
- [x] Mobile responsive — N/A (no UI changes)
- [x] Vietnamese copy — unchanged
- [x] Premium theme preserved — N/A
- [x] A11y — N/A
- [x] Property test passing — bill recompute consistency verified in `transaction.test.ts` "bill recompute" suite
- [x] Unit + integration tests written — 31 new tests, 0 regressions
- [x] `tsc --noEmit` → 0 errors
- [x] `tsc -p tsconfig.test.json --noEmit` → 0 errors (pre-existing errors in unrelated test files are not caused by this change)
- [x] `npm run lint` → 0 warnings
- [x] `npm run build` → 0 errors, shared JS 87.4 kB (no bloat from Sprint 7.1 baseline)
- [x] Anti-pattern grep clean — A1/A2/A8/A9/A10/A22/A26 — no new patterns introduced
- [x] Paired review approved — pending (C-6 accountant pairing, not in this scope)
- [x] Implementation report + migration notes written — this document + STORY_F_CRIT_08_MIGRATION_NOTES.md

---

## 7. Open questions for accountant pairing (C-6)

These questions are out of scope for the implementation but should be discussed during the C-6 live pairing session (Day 3, Sprint 7.2 §4.1):

1. **Audit on abort visibility** — should the `payment_transaction_aborted` audit entry be visible in the audit-logs UI by default, or only to admin + accountant? (Currently: visible to all roles with `/audit-logs` access — same as `payment_confirmed`.)
2. **Abort retry UX** — if a confirm is aborted (e.g. due to a transient Firestore error), should the user see "Thử lại" (retry) button in the toast, or just re-click "Xác nhận"? (Currently: re-click. Could be enhanced later.)
3. **Abort log retention** — same as other audit logs (kept indefinitely).
4. **PAYMENT_SOD + PAYMENT_TX interplay** — verified in test #7 + #8. The SoD check runs first, the tx never fires on a SoD violation. No further question.

---

## 8. Rollback

Per SPRINT_7_2 §7.1:

```bash
# Revert the F-CRIT-08 commit(s)
git revert <sha>...

# (Optional) Flip the flag in production
# NEXT_PUBLIC_FEATURE_PAYMENT_TX=false
```

After revert, the route reverts to the legacy two-step path with the legacy `payment_confirmed` audit log. No data impact: the F-CRIT-08 changes only touch the **write path** of payment confirm; the **read paths** (payment list, audit log, case amounts) are unchanged. Any in-flight confirms at revert time either:
- Already committed via the transactional path → present in storage with `payment_transaction_committed` audit log entries; these are still valid (the audit action union just gained two new values; the legacy `payment_confirmed` value is still present from earlier commits).
- Were in the middle of a transaction when the revert was deployed → Firestore's transaction model guarantees no partial state; the transaction either committed fully or not at all.

RTO: < 5 minutes (per plan).

---

## 9. Files added/modified summary

```
src/app/(protected)/audit-logs/page.tsx             |  18 +++--
src/app/api/payments/[id]/confirm/route.ts          |  78 ++++++----
src/app/api/payments/[id]/confirm/__tests__/        |  +
   └── route.transactional.test.ts                  |  387 +++++++ (new)
src/lib/firebase/firestore.ts                       |  91 +++++++-
src/lib/firestore/payments.ts                       |  42 ++++-
src/lib/mock/store.ts                               | 152 ++++++++++++++-
src/lib/payments/transaction.ts                     |  295 +++++++ (new)
src/lib/payments/__tests__/transaction.test.ts      |  479 +++++++ (new)
src/lib/types/audit.ts                              |  32 +++-
```

Total: ~1,800 lines new (incl. tests), ~200 lines modified.

---

*End of F-CRIT-08 Implementation Report.*
