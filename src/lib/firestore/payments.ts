import { Payment, CreatePaymentInput, ConfirmPaymentInput } from '@/lib/types';
import {
  getDocument,
  setDocument,
  updateDocument,
  getAllDocuments,
} from '@/lib/firebase/firestore';
import { updateCase } from './cases';

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

async function recalculateCasePayment(caseId: string, updatedBy: string): Promise<void> {
  const payments = await getPaymentsByCase(caseId);
  const confirmedPayments = payments.filter((p) => p.status === 'confirmed');

  let amountPaid = 0;
  for (const p of confirmedPayments) {
    if (p.paymentType === 'refund') {
      amountPaid -= p.amount;
    } else {
      amountPaid += p.amount;
    }
  }

  // We'd need to get the case to compute remainingAmount
  const { getCase } = await import('./cases');
  const caseRecord = await getCase(caseId);
  if (!caseRecord) return;

  const remainingAmount = Math.max(0, caseRecord.totalBillAfterDiscount - amountPaid);
  let paymentStatus: 'unpaid' | 'deposit' | 'partial' | 'paid' | 'refunded' = 'unpaid';

  if (amountPaid < 0) paymentStatus = 'refunded';
  else if (amountPaid === 0) paymentStatus = 'unpaid';
  else if (amountPaid >= caseRecord.totalBillAfterDiscount) paymentStatus = 'paid';
  else if (amountPaid > 0 && confirmedPayments.some((p) => p.paymentType === 'deposit')) paymentStatus = 'deposit';
  else paymentStatus = 'partial';

  await updateCase(caseId, { amountPaid, remainingAmount, paymentStatus }, updatedBy);
}
