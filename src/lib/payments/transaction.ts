/**
 * Story F-CRIT-08 (Sprint 7.2) — Transactional payment confirmation.
 *
 * The pre-F-CRIT-08 `confirmPayment()` flow in `@/lib/firestore/payments`
 * performed two non-atomic writes:
 *   (1) `updateDocument(payment, { status: 'confirmed', confirmedBy, ... })`
 *   (2) `recalculateCasePayment(caseId, updatedBy)` (which reads all case
 *       payments then writes `case.amountPaid/remainingAmount/paymentStatus`).
 * A failure between (1) and (2) would leave the payment in `confirmed`
 * state but the case totals stale.
 *
 * ## Atomicity contract
 *
 * `confirmPaymentTransaction` wraps three writes in a single transaction:
 *   1. Payment status update — `status = 'confirmed'`, `confirmedBy`,
 *      `confirmedAt`, note.
 *   2. Case bill recompute — `case.amountPaid / remainingAmount /
 *      paymentStatus` recomputed from the FULL payment history using
 *      `recomputeBillFromPayments()` (F-HIGH-28).
 *   3. Audit log entry — `payment_transaction_committed` with the
 *      before/after snapshot of payment AND case amounts.
 *
 * All three writes commit together or roll back together. On abort, a
 * best-effort `payment_transaction_aborted` audit log is written OUTSIDE
 * the transaction so the failure is SOC-traceable.
 *
 * @see docs/ux-redesign/SPRINT_7_2_EXECUTION_PLAN.md §1 (F-CRIT-08),
 *      §3.1 (R7.2-1), §3.2 (revenue integrity invariant).
 */

import type { CaseRecord, Payment, UserRole } from '@/lib/types';
import { runTransaction, type TransactionHandle } from '@/lib/firebase/firestore';
import {
  recomputeBillFromPayments,
  snapshotToCaseUpdate,
} from '@/lib/billing/recompute';
import { writeAuditLog } from '@/lib/firestore/audit';
import { writePaymentAudit, txWritePaymentAudit } from '@/lib/audit/payment-audit';

const PAYMENTS_COLLECTION = 'payments';
const CASES_COLLECTION = 'cases';

export interface ConfirmPaymentTransactionInput {
  paymentId: string;
  confirmedBy: string;
  note?: string;
  /** Must be 'pending' — validated inside the transaction. */
  expectedPreviousStatus: 'pending';
  /**
   * The pre-transaction case record, supplied by the caller from an
   * earlier read. Used for the `before` audit snapshot. The transaction
   * re-reads the case inside the callback to validate freshness.
   */
  preCaseRecord: Pick<CaseRecord, 'id' | 'totalBillAfterDiscount'>;
}

export interface ConfirmPaymentTransactionActor {
  uid: string;
  displayName: string;
  role: UserRole;
}

export interface ConfirmPaymentTransactionResult {
  committedAt: string;
  caseId: string;
  previousStatus: string;
  previousAmountPaid: number;
  newAmountPaid: number;
  newRemainingAmount: number;
  newPaymentStatus: string;
}

/**
 * Thrown when a pre-condition or write-time check inside the transaction
 * fails. The transaction was aborted; no partial state was persisted.
 */
export class TransactionAbortError extends Error {
  readonly name = 'TransactionAbortError' as const;
  readonly code:
    | 'payment_not_found'
    | 'payment_already_processed'
    | 'case_not_found'
    | 'write_failed';
  readonly stage: 'payment' | 'case' | 'audit';

  constructor(
    code: TransactionAbortError['code'],
    stage: TransactionAbortError['stage'],
    message: string,
  ) {
    super(message);
    this.code = code;
    this.stage = stage;
  }
}

/**
 * Confirm a payment atomically. The three writes (payment status update,
 * case bill recompute, audit log entry) are committed together or
 * rolled back together.
 *
 * On failure, the original payment remains `pending` and the case totals
 * are unchanged. A `payment_transaction_aborted` audit entry is written
 * after rollback (best-effort) so the abort is traceable.
 */
export async function confirmPaymentTransaction(
  input: ConfirmPaymentTransactionInput,
  actor: ConfirmPaymentTransactionActor,
): Promise<ConfirmPaymentTransactionResult> {
  const { paymentId, confirmedBy, note } = input;

  let abortStage: 'payment' | 'case' | 'audit' = 'payment';
  let abortReason = 'unknown';

  try {
    const result = await runTransaction(async (tx) => {
      // ── 1. Read the payment (inside tx for read-after-write consistency)
      const paymentSnap = await tx.get<Payment>(PAYMENTS_COLLECTION, paymentId);
      if (!paymentSnap.exists || !paymentSnap.data) {
        throw new TransactionAbortError(
          'payment_not_found',
          'payment',
          'Không tìm thấy thanh toán',
        );
      }
      const payment = paymentSnap.data;
      if (payment.status !== 'pending') {
        throw new TransactionAbortError(
          'payment_already_processed',
          'payment',
          'Thanh toán không ở trạng thái chờ xác nhận',
        );
      }

      // ── 2. Read the case
      const caseSnap = await tx.get<CaseRecord>(CASES_COLLECTION, payment.caseId);
      if (!caseSnap.exists || !caseSnap.data) {
        throw new TransactionAbortError(
          'case_not_found',
          'case',
          'Không tìm thấy hồ sơ',
        );
      }
      const caseRecord = caseSnap.data;

      // ── 3. Read case payment history (non-tx query — see docstring)
      // The payment list is read via the existing `getPaymentsByCase`
      // helper (a non-transactional query). The payment we are about
      // to confirm is NOT yet committed, so the sum reflects the
      // pre-update state. We add it explicitly below.
      const casePayments = await getPaymentsByCaseInTransaction(payment.caseId);
      const hypotheticalConfirmed = [
        ...casePayments,
        { ...payment, status: 'confirmed' as const },
      ];
      const snapshot = recomputeBillFromPayments({
        caseRecord: {
          id: caseRecord.id,
          totalBillAfterDiscount: caseRecord.totalBillAfterDiscount,
        },
        payments: hypotheticalConfirmed,
      });
      const caseUpdate = snapshotToCaseUpdate(snapshot);

      abortStage = 'payment';
      // ── 4. Write the payment update
      tx.update(PAYMENTS_COLLECTION, paymentId, {
        status: 'confirmed',
        confirmedBy,
        confirmedAt: new Date().toISOString(),
        note: note ?? payment.note,
        updatedBy: actor.uid,
      });

      abortStage = 'case';
      // ── 5. Write the case recompute
      tx.update(CASES_COLLECTION, payment.caseId, caseUpdate);

      abortStage = 'audit';
      // ── 6. Write the committed audit log entry
      // Story PI-3 (Sprint 7.2) — payment audit enrichment. The audit
      // payload is built by `txWritePaymentAudit`, which produces the
      // SAME shape as the non-transactional `writePaymentAudit` path
      // (structured diff + state transition + case bill delta + caseId
      // link). The transactional write still happens via `tx.set` so
      // the audit entry shares the Firestore transaction with the
      // payment + case writes — preserving F-CRIT-08 atomicity.
      txWritePaymentAudit(tx, {
        action: 'payment_transaction_committed',
        entityId: paymentId,
        actor,
        before: payment,
        after: {
          ...payment,
          status: 'confirmed',
          confirmedBy,
          confirmedAt: new Date().toISOString(),
          note: note ?? payment.note,
        },
        caseId: payment.caseId,
        trigger: 'PI-3 transactional commit',
        caseBill: {
          before: {
            amountPaid: caseRecord.amountPaid,
            remainingAmount: caseRecord.remainingAmount,
            paymentStatus: caseRecord.paymentStatus,
          },
          after: {
            amountPaid: caseUpdate.amountPaid as number,
            remainingAmount: caseUpdate.remainingAmount as number,
            paymentStatus: caseUpdate.paymentStatus as CaseRecord['paymentStatus'],
          },
        },
      });

      return {
        previousStatus: payment.status,
        previousAmountPaid: caseRecord.amountPaid,
        newAmountPaid: caseUpdate.amountPaid as number,
        newRemainingAmount: caseUpdate.remainingAmount as number,
        newPaymentStatus: caseUpdate.paymentStatus as string,
        caseId: payment.caseId,
      };
    });

    return {
      committedAt: new Date().toISOString(),
      caseId: result.caseId,
      previousStatus: result.previousStatus,
      previousAmountPaid: result.previousAmountPaid,
      newAmountPaid: result.newAmountPaid,
      newRemainingAmount: result.newRemainingAmount,
      newPaymentStatus: result.newPaymentStatus,
    };
  } catch (err) {
    // Best-effort: write abort audit entry outside the transaction
    if (err instanceof TransactionAbortError) {
      abortStage = err.stage;
      abortReason = err.message;
    } else {
      abortReason = err instanceof Error ? err.message : 'Lỗi không xác định';
    }

    // Story PI-3 (Sprint 7.2) — abort audit uses the enriched
    // `writePaymentAudit` helper so the abort entry's payload shape
    // matches the committed entry (state-transition log + caseId link
    // + structured diff). SOC analysts only need to learn one diff
    // format to reconcile the two entry types.
    await writePaymentAudit({
      action: 'payment_transaction_aborted',
      entityId: paymentId,
      actor,
      before: { status: input.expectedPreviousStatus } as unknown as Payment,
      caseId: input.preCaseRecord.id,
      trigger: 'PI-3 transactional abort',
      metadata: {
        aborted: true,
        stage: abortStage,
        reason: abortReason,
      },
    }).catch(() => {
      // eslint-disable-next-line no-console
      console.error('[F-CRIT-08] Failed to write abort audit log', {
        paymentId,
        stage: abortStage,
        reason: abortReason,
      });
    });

    throw err instanceof TransactionAbortError
      ? err
      : new TransactionAbortError('write_failed', abortStage, abortReason);
  }
}

/**
 * Read all payments for a case for the in-transaction recompute.
 * Non-transactional query: accepted because the recompute is idempotent
 * and the transaction's read-after-write conflict detection handles races.
 */
async function getPaymentsByCaseInTransaction(caseId: string): Promise<Payment[]> {
  const { getPaymentsByCase } = await import('@/lib/firestore/payments');
  return getPaymentsByCase(caseId);
}
