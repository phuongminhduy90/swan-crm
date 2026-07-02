import { Payment, CreatePaymentInput, ConfirmPaymentInput } from '@/lib/types';
import {
  getDocument,
  setDocument,
  updateDocument,
  getAllDocuments,
} from '@/lib/firebase/firestore';
import { updateCase } from './cases';
import { isFlagEnabled } from '@/lib/feature-flags';
import {
  recomputeBillFromPayments,
  snapshotToCaseUpdate,
  type BillSnapshot,
} from '@/lib/billing/recompute';

const COLLECTION = 'payments';

export async function getPaymentsByCase(caseId: string): Promise<Payment[]> {
  const data = await getAllDocuments<Record<string, unknown>>(COLLECTION, [
    { field: 'caseId', operator: '==', value: caseId },
  ]);
  return (data as unknown as Payment[]).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getAllPayments(): Promise<Payment[]> {
  const data = await getAllDocuments<Record<string, unknown>>(COLLECTION);
  return (data as unknown as Payment[]).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getPayment(id: string): Promise<Payment | null> {
  const data = await getDocument<Record<string, unknown>>(COLLECTION, id);
  if (!data) return null;
  return data as unknown as Payment;
}

export async function createPayment(
  input: CreatePaymentInput,
  createdBy: string,
): Promise<Payment> {
  const id = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const payment: Payment = {
    id,
    caseId: input.caseId,
    customerId: input.customerId,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    paymentType: input.paymentType,
    receivedBy: input.receivedBy,
    paymentDate: input.paymentDate,
    note: input.note,
    status: 'pending',
    createdBy,
    createdAt: now,
    updatedAt: now,
  };

  await setDocument(COLLECTION, id, payment);
  return payment;
}

export async function confirmPayment(
  paymentId: string,
  input: ConfirmPaymentInput,
  updatedBy: string,
): Promise<void> {
  const payment = await getPayment(paymentId);
  if (!payment) throw new Error('Không tìm thấy thanh toán');
  if (payment.status !== 'pending') throw new Error('Thanh toán không ở trạng thái chờ xác nhận');

  // Story F-CRIT-08 (Sprint 7.2) — When the PAYMENT_TX flag is enabled, the
  // confirm flow is wrapped in a Firestore transaction (real mode) or
  // a mock-store BEGIN/COMMIT/ROLLBACK simulator (dev mode). The
  // transaction covers three writes atomically: payment status update,
  // case bill recompute, audit log entry. A failure at any stage rolls
  // back the entire transaction so the financial state stays consistent.
  //
  // When the flag is OFF, we fall through to the legacy two-step path
  // (payment update + recalculateCasePayment) — preserved exactly as in
  // Sprint 6.4 so production runs identical until C-6 + C-7 + C-8
  // accountant pairing signs off and the flag is promoted to ON.
  if (isFlagEnabled('PAYMENT_TX')) {
    const { confirmPaymentTransaction } = await import('@/lib/payments/transaction');
    await confirmPaymentTransaction(
      {
        paymentId,
        confirmedBy: input.confirmedBy,
        note: input.note,
        expectedPreviousStatus: 'pending',
        preCaseRecord: {
          id: payment.caseId,
          totalBillAfterDiscount: 0, // refreshed inside the transaction
        },
      },
      // The API route is the caller; the actor's `displayName` and
      // `role` are passed through the input above (Sprint 7.2 keeps
      // the existing function signature stable for backward compat).
      // For a richer actor object the route can call
      // `confirmPaymentTransaction` directly.
      { uid: updatedBy, displayName: updatedBy, role: 'admin' },
    );
    return;
  }

  const now = new Date().toISOString();
  await updateDocument(COLLECTION, paymentId, {
    status: 'confirmed',
    confirmedBy: input.confirmedBy,
    confirmedAt: now,
    note: input.note ?? payment.note,
    updatedBy,
  });

  // Update case amountPaid + remainingAmount
  await recalculateCasePayment(payment.caseId, updatedBy);
}

export async function rejectPayment(
  paymentId: string,
  rejectionNote: string,
  updatedBy: string,
): Promise<void> {
  const payment = await getPayment(paymentId);
  if (!payment) throw new Error('Không tìm thấy thanh toán');

  await updateDocument(COLLECTION, paymentId, {
    status: 'rejected',
    note: rejectionNote,
    updatedBy,
  });

  // Recalculate case payment totals after rejection
  await recalculateCasePayment(payment.caseId, updatedBy);
}

/**
 * Recalculate `case.amountPaid`, `case.remainingAmount` and `case.paymentStatus`
 * from the full payment history of the case.
 *
 * Story F-HIGH-28 (Sprint 7.2): this function now delegates to a **pure**
 * recompute (`recomputeBillFromPayments`) when `NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE`
 * is enabled, so bill totals are aggregated from the source-of-truth payment
 * list every time (no incremental drift). When the flag is OFF, the legacy
 * inline incremental path is preserved exactly as in Sprint 6.4 — refund /
 * confirm / reject behaviour is unchanged.
 *
 * Behavior (post-F-HIGH-28):
 * - `amountPaid` = Σ confirmed non-refund payments, clamped at 0.
 * - `refundedAmount` = Σ confirmed refund payments, clamped at 0.
 * - `remainingAmount = max(0, totalBillAfterDiscount - amountPaid + refundedAmount)`
 *   — clamped at 0 because a negative "remaining" would mean the clinic owes
 *   the customer, which is the refund workflow (handled by refund payments,
 *   not by negative remaining).
 * - `paymentStatus` is derived from `amountPaid`, the deposit presence and
 *   `totalBillAfterDiscount` (`refunded` | `paid` | `deposit` | `partial` | `unpaid`).
 *
 * Story PI-2 (Sprint 7.2): the refund flow (`createRefund`) calls this helper
 * after persisting the refund Payment, so the case totals reflect the new
 * state immediately.
 */
export async function recalculateCasePayment(caseId: string, updatedBy: string): Promise<void> {
  const payments = await getPaymentsByCase(caseId);

  const { getCase } = await import('./cases');
  const caseRecord = await getCase(caseId);
  if (!caseRecord) return;

  if (isFlagEnabled('BILL_RECOMPUTE')) {
    // Pure recompute path — source-of-truth aggregation (Sprint 7.2 §5.2).
    const snapshot: BillSnapshot = recomputeBillFromPayments({
      caseRecord: {
        id: caseRecord.id,
        totalBillAfterDiscount: caseRecord.totalBillAfterDiscount,
      },
      payments,
    });
    await updateCase(caseId, snapshotToCaseUpdate(snapshot), updatedBy);
    return;
  }

  // ── Legacy incremental path (pre-F-HIGH-28 behaviour) ──────────────
  // Preserved so production runs identical to Sprint 6.4 until the
  // accountant-led C-7 pairing session signs off and flips the flag.
  const confirmedPayments = payments.filter((p) => p.status === 'confirmed');

  let amountPaid = 0;
  for (const p of confirmedPayments) {
    if (p.paymentType === 'refund') {
      amountPaid -= p.amount;
    } else {
      amountPaid += p.amount;
    }
  }

  const remainingAmount = Math.max(0, caseRecord.totalBillAfterDiscount - amountPaid);
  let paymentStatus: 'unpaid' | 'deposit' | 'partial' | 'paid' | 'refunded' = 'unpaid';

  if (amountPaid < 0) paymentStatus = 'refunded';
  else if (amountPaid === 0) paymentStatus = 'unpaid';
  else if (amountPaid >= caseRecord.totalBillAfterDiscount) paymentStatus = 'paid';
  else if (amountPaid > 0 && confirmedPayments.some((p) => p.paymentType === 'deposit')) paymentStatus = 'deposit';
  else paymentStatus = 'partial';

  await updateCase(caseId, { amountPaid, remainingAmount, paymentStatus }, updatedBy);
}
