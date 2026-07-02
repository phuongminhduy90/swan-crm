# F-CRIT-08 — Transactional Payment Confirm — Migration Notes

> **Story ID:** F-CRIT-08 (TD-3)
> **Sprint:** 7.2 (Payment Integrity, Bill Recompute, Currency Hardening)
> **Audience:** engineers picking up the transactional confirm path; on-call during the production rollout.

---

## 1. What changed at a glance

`PATCH /api/payments/[id]/confirm` now supports a transactional write path gated by `NEXT_PUBLIC_FEATURE_PAYMENT_TX`. When the flag is OFF (default in production), the behavior is **byte-identical to Sprint 6.4 / 7.1**. When the flag is ON, the route uses a new helper (`confirmPaymentTransaction` in `@/lib/payments/transaction`) that wraps three writes in a single Firestore transaction.

The helper is reusable for any future payment state transition that needs atomicity (e.g. partial-refund + recompute in a later sprint).

---

## 2. For backend engineers

### 2.1 The transactional helper

**Location:** `src/lib/payments/transaction.ts`

```ts
import { confirmPaymentTransaction } from '@/lib/payments/transaction';

await confirmPaymentTransaction(
  {
    paymentId,
    confirmedBy,
    note,
    expectedPreviousStatus: 'pending',
    preCaseRecord: { id: caseId, totalBillAfterDiscount: 0 },
  },
  { uid, displayName, role },
);
```

The helper takes a pre-read `preCaseRecord` from the caller (for the `before` audit snapshot) but re-reads both the payment and the case inside the transaction body to validate freshness. This is the standard Firestore transaction pattern: the read-inside-tx is the authoritative check; the pre-read is just for the audit log's `before` snapshot.

### 2.2 The transaction shim

**Location:** `src/lib/firebase/firestore.ts`

```ts
import { runTransaction, type TransactionHandle } from '@/lib/firebase/firestore';

await runTransaction(async (tx: TransactionHandle) => {
  const snap = await tx.get<Payment>('payments', paymentId);
  if (!snap.exists) throw new Error('not found');
  tx.update('payments', paymentId, { status: 'confirmed' });
  tx.set('auditLogs', auditId, { ... });
});
```

The shim exposes a uniform `TransactionHandle` with `get / update / set / delete` so callers can be written once and work in both real Firestore (delegates to `firebase-admin` `runTransaction`) and the in-memory mock store (delegates to `runMockTransaction`).

### 2.3 The mock transaction simulator

**Location:** `src/lib/mock/store.ts`

The mock store has a new `runMockTransaction(callback)` function that:
- Snapshots every document the callback `get()`s
- Buffers every `update` / `set` / `delete`
- Applies the buffer on callback resolve (COMMIT)
- Discards the buffer on callback throw (ROLLBACK)

The simulator supports reads-after-writes (subsequent `get()`s on the same document return the buffered pending data). It does **not** support nested transactions or concurrent transactions — the mock is single-threaded. Real Firestore's `runTransaction` provides stronger guarantees (auto-retry on conflict) that the mock does not attempt to emulate. This is documented in the file's docstring.

### 2.4 Error handling

The transactional helper throws `TransactionAbortError` with a typed `code` and `stage`:

```ts
class TransactionAbortError extends Error {
  readonly code:
    | 'payment_not_found'
    | 'payment_already_processed'
    | 'case_not_found'
    | 'write_failed';
  readonly stage: 'payment' | 'case' | 'audit';
}
```

Callers (e.g. API routes) should map these codes to HTTP status codes per §2.5 of the implementation report:
- `payment_not_found` → 404
- `payment_already_processed` → 409
- `case_not_found` → 404
- `write_failed` → 500

### 2.5 Audit log integration

The transactional helper writes its own audit log entry (`payment_transaction_committed`) INSIDE the transaction via `tx.set`. On abort, it writes a separate `payment_transaction_aborted` entry OUTSIDE the transaction (so the forensic log is preserved even when the financial state rolls back). Both new actions are added to the `AuditAction` union — see §3 below for migration.

### 2.6 Backward compatibility

The legacy `confirmPayment(paymentId, input, updatedBy)` function in `src/lib/firestore/payments.ts` is preserved as a public API. It branches on the `PAYMENT_TX` flag:
- Flag ON → delegates to `confirmPaymentTransaction` (in the new module)
- Flag OFF → preserves the legacy two-step path exactly

The `PAYMENT_CONFIRM_ROLES` allow-list and the `PAYMENT_SOD` flag are both checked at the API route, BEFORE either the legacy or the transactional path is invoked. The SoD guard is intentionally not in the transaction — SoD is a permission concern, not a data-consistency concern. The SoD check fires first, then the transaction starts.

---

## 3. For data + audit consumers

### 3.1 Two new `AuditAction` values

The `AuditAction` union (`src/lib/types/audit.ts`) gained two new values:

| Action | Meaning | Source |
|:-------|:--------|:-------|
| `payment_transaction_committed` | A payment confirmation was atomically committed. Carries before/after snapshot of payment AND case (amountPaid, remainingAmount, paymentStatus). | `confirmPaymentTransaction` (PAYMENT_TX flag ON) |
| `payment_transaction_aborted` | A payment confirmation was rolled back. The payment remains in `pending`. The `after` payload carries `{ aborted: true, stage, reason, caseId }`. | `confirmPaymentTransaction` catch block (PAYMENT_TX flag ON) |

### 3.2 How to interpret a sequence

For a single payment confirmation, an auditor should see either:
- **Success:** one `payment_transaction_committed` entry.
- **Failure (SoD):** one `payment_confirmed` entry with `after.denied = true, after.reason = 'sod_violation'`. (The transaction is never invoked.)
- **Failure (concurrent):** one `payment_transaction_aborted` entry with `after.stage = 'payment', after.reason = 'Thanh toán không ở trạng thái chờ xác nhận'`. The auditor should reconcile with a (potentially earlier) `payment_transaction_committed` entry for the same payment.
- **Failure (infrastructure):** one `payment_transaction_aborted` entry with `after.stage` indicating which write failed. If the stage is `payment` and no `payment_transaction_committed` exists, the confirmation is uncommitted.

### 3.3 PII redaction

The new audit entries flow through the same `redactPiiFields()` pipeline as the existing `payment_confirmed` entries, so any future PII fields added to the payment or case payloads are auto-redacted. The current payload (status, amount, caseId, etc.) contains no PII.

---

## 4. For frontend engineers

### 4.1 No UI changes

`payment-confirm-dialog.tsx` is unchanged. The dialog calls the same `PATCH /api/payments/[id]/confirm` endpoint, gets the same `{ success: true }` response on success, and the existing toast on error continues to work.

### 4.2 Error messages

The Vietnamese error messages are preserved from the legacy path. The new `TransactionAbortError` carries the same messages:
- "Không tìm thấy thanh toán" (404)
- "Thanh toán không ở trạng thái chờ xác nhận" (409)
- "Không tìm thấy hồ sơ" (404)
- "Không thể xác nhận thanh toán: giao dịch đã bị hủy" (500 — generic, includes the abort reason in the audit log but not the toast)

The 409 status is new — previously, a concurrent confirm would have failed silently in the legacy non-transactional path. The 409 lets the UI show "Phiếu thanh toán này đã được xác nhận bởi người khác" and prompt the user to refresh.

### 4.3 Audit log UI

The audit-logs page (`/audit-logs`) shows the two new action types with Vietnamese labels:
- `payment_transaction_committed` → "Giao dịch xác nhận thanh toán (commit)" (green check icon)
- `payment_transaction_aborted` → "Giao dịch xác nhận thanh toán (hủy)" (red triangle icon)

The `before/after` JSON diff is expandable per-entry (same UX as existing entries). The diff is intentionally PII-safe (medicalNote, privacyNote, nationalIdNumber are redacted per the B.2.3 contract — applies automatically to the new entries too).

---

## 5. For the production rollout

### 5.1 Pre-flight checklist (Sprint 7.2 §3.3 sign-off gates)

- [ ] **C-6** — accountant pairing (F-CRIT-08 happy path + concurrent confirm + audit failure simulation)
- [ ] **C-7** — accountant pairing (F-HIGH-28 recompute — F-CRIT-08 reuses the pure function)
- [ ] **C-8** — full revenue walkthrough of mock store
- [ ] **C-9** — rollback drill timed (target: < 5 min for F-CRIT-08 revert)
- [ ] tech-lead code review
- [ ] qa-architect test pyramid density (≥ 5 tests/KLOC)
- [ ] release-manager flag inventory + rollback SOP

### 5.2 Deployment steps

1. Deploy code (F-CRIT-08 is in the bundle, but flag is OFF → no behavior change).
2. Run the reconciliation script (`scripts/reconcile-payments.ts`, Sprint 7.2 PI-6) to verify no drift.
3. In dev/staging, set `NEXT_PUBLIC_FEATURE_PAYMENT_TX=true` and run through the manual QA checklist (Sprint 7.2 §10.2).
4. Once C-6 + C-7 + C-8 sign-off is complete, set the flag in production via a config change (no code redeploy).
5. Monitor the audit-logs page for 48 hours. If any `payment_transaction_aborted` entries appear with `after.stage = 'payment'`, investigate.
6. After 48h of clean commits, the flag can be promoted to "default ON" in a future sprint.

### 5.3 Rollback

```bash
# Revert the F-CRIT-08 commit(s)
git revert <sha>...

# Verify build + tests pass
npx tsc --noEmit && npm run lint && npm run build && npx vitest run

# Run reconciliation script
NEXT_PUBLIC_DEV_MODE=true npx tsx scripts/reconcile-payments.ts
```

RTO: < 5 minutes (per Sprint 7.2 §7.1).

If production drift is detected post-revert (extremely unlikely given the helper writes to the same collections as the legacy path), follow the procedure in Sprint 7.2 §7.4.

---

## 6. Schema + type changes

### 6.1 `AuditAction` union — additive only

Two new values added; existing values unchanged. **No migration required for existing audit log entries.** The `audit-logs/page.tsx` UI gracefully handles unknown action types (falls back to the raw string), so a database row with an old `AuditAction` value continues to render correctly.

### 6.2 New error class

`TransactionAbortError` is exported from `@/lib/payments/transaction`. Existing code that catches `Error` continues to work; new code can `instanceof TransactionAbortError` to read the typed `code` + `stage` fields.

### 6.3 New shim function

`runTransaction` is exported from `@/lib/firebase/firestore`. Existing code that does not use transactions is unaffected.

### 6.4 New mock store export

`runMockTransaction` and `MockTransaction` are exported from `@/lib/mock/store`. Existing test mocks are unaffected (the existing `vi.mock('@/lib/mock/store', ...)` pattern in the project's test suite mocks the surface and does not import `runMockTransaction`).

---

## 7. Future work (out of F-CRIT-08 scope)

1. **Pay-2-PI-3 integration** — the audit enrichment story (PI-3) was scoped for the same sprint. PI-3 would add structured before/after diffs to the payment audit entries. F-CRIT-08's `payment_transaction_committed` entry is structured but minimal (only the financial fields). PI-3 could expand it to include the full payment record.
2. **Transactional reject** — the `rejectPayment` flow has the same two-non-atomic-writes vulnerability as the pre-F-CRIT-08 confirm. A future `rejectPaymentTransaction` helper would mirror this story.
3. **Transactional refund** — the `createRefund` flow in PI-2 is currently a single-write (refund payment + recompute as a follow-up call). A future `createRefundTransaction` would wrap the refund write + case recompute in a transaction.
4. **Audit-on-abort visibility** — currently visible to all roles with `/audit-logs` access. Could be restricted to admin + accountant in a future RBAC story.

---

*End of F-CRIT-08 Migration Notes.*
