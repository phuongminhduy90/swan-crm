/**
 * Story PI-2 (Sprint 7.2) — Refund flow.
 *
 * `createRefund(originalPaymentId, input, actor)` produces a refund payment
 * (a separate Payment record with `paymentType: 'refund'` and
 * `status: 'confirmed'`) that reduces `case.amountPaid` by the refund amount.
 *
 * Domain rules enforced here (Vietnamese clinic accounting practice —
 * single-entry bookkeeping, bank-statement reconciliation):
 *
 * 1. Refund amount must be > 0. A zero or negative refund is not a refund.
 * 2. Refund amount must be ≤ the original payment's amount. By accounting
 *    convention, a refund cannot exceed the original payment (would require
 *    an offsetting sale — out of scope here).
 * 3. Cumulative refunds against the same original payment must not exceed
 *    the original payment. A 5,000,000 VNĐ payment cannot be refunded 3,000,000
 *    twice (= 6,000,000 > 5,000,000). Partial refunds are allowed but capped
 *    by the running total.
 * 4. The original payment must be `confirmed` (not `pending` or `rejected`).
 *    You cannot refund money the clinic hasn't received, or money that was
 *    already rejected.
 * 5. The original payment itself cannot already be a refund. Refunds-of-refunds
 *    would invert the accounting intent; create a new positive payment if you
 *    need to reconcile.
 *
 * After validation, the function:
 *   - Persists a new `Payment` with `paymentType: 'refund'`, `status: 'confirmed'`
 *   - Reuses the existing `recalculateCasePayment()` to refresh case totals
 *     (F-HIGH-28 will refactor that helper to a pure function in the same
 *     sprint — PI-2 calls the current implementation by design to keep
 *     blast radius small).
 *
 * The refund payment starts as `confirmed` (not `pending`) because refunds
 * are an accountant-driven single-step action. There is no "two-phase"
 * confirm flow — the accountant creates the refund in one transaction,
 * which mirrors the bank statement debit on the same day.
 */

import {
  getPayment,
  getPaymentsByCase,
  recalculateCasePayment,
} from '@/lib/firestore/payments';
import { setDocument } from '@/lib/firebase/firestore';
import { getCase } from '@/lib/firestore/cases';
import type {
  Payment,
  PaymentMethod,
  CaseRecord,
} from '@/lib/types';

const COLLECTION = 'payments';

export interface CreateRefundInput {
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  note?: string;
}

export interface RefundActor {
  uid: string;
  displayName: string;
  role: string;
}

export interface CreateRefundResult {
  refund: Payment;
  caseRecord: CaseRecord | null;
}

/**
 * Domain errors thrown by `createRefund()`. The API route maps each variant
 * to an HTTP status:
 *
 *   - `original_not_found`        → 404
 *   - `original_not_confirmed`    → 400
 *   - `original_is_refund`        → 400
 *   - `amount_invalid`            → 400
 *   - `amount_exceeds_original`   → 400  (the single-shot cap)
 *   - `amount_exceeds_remaining`  → 400  (the cumulative-refund cap)
 *
 * All error messages are Vietnamese and safe to surface in the UI.
 */
export type RefundErrorCode =
  | 'original_not_found'
  | 'original_not_confirmed'
  | 'original_is_refund'
  | 'amount_invalid'
  | 'amount_exceeds_original'
  | 'amount_exceeds_remaining';

export class RefundError extends Error {
  readonly code: RefundErrorCode;

  constructor(code: RefundErrorCode, message: string) {
    super(message);
    this.name = 'RefundError';
    this.code = code;
  }
}

/**
 * Create a refund payment against an existing confirmed payment.
 *
 * Throws `RefundError` on any domain violation. Returns `{ refund, caseRecord }`
 * on success — `caseRecord` is the post-recompute snapshot of the case so
 * callers (the API route) can surface the updated totals in the response.
 */
export async function createRefund(
  originalPaymentId: string,
  input: CreateRefundInput,
  actor: RefundActor,
): Promise<CreateRefundResult> {
  // ── 1. Original payment must exist ────────────────────────────────
  const original = await getPayment(originalPaymentId);
  if (!original) {
    throw new RefundError(
      'original_not_found',
      'Không tìm thấy thanh toán gốc',
    );
  }

  // ── 2. Original must be confirmed (cannot refund pending/rejected) ─
  if (original.status !== 'confirmed') {
    throw new RefundError(
      'original_not_confirmed',
      'Chỉ có thể hoàn tiền cho thanh toán đã xác nhận',
    );
  }

  // ── 3. Original cannot itself be a refund ─────────────────────────
  if (original.paymentType === 'refund') {
    throw new RefundError(
      'original_is_refund',
      'Không thể hoàn tiền cho một giao dịch hoàn tiền',
    );
  }

  // ── 4. Amount must be a positive finite integer ───────────────────
  if (
    !Number.isFinite(input.amount) ||
    !Number.isInteger(input.amount) ||
    input.amount <= 0
  ) {
    throw new RefundError(
      'amount_invalid',
      'Số tiền hoàn phải là số nguyên dương',
    );
  }

  // ── 5. Single-shot cap: refund cannot exceed the original amount ──
  if (input.amount > original.amount) {
    throw new RefundError(
      'amount_exceeds_original',
      `Hoàn tiền vượt quá số tiền gốc (tối đa ${original.amount.toLocaleString('vi-VN')} VNĐ)`,
    );
  }

  // ── 6. Cumulative cap: existing refunds + this refund ≤ original ──
  // Pull the full case payment history (one query — already cached for the
  // recompute step that follows, so no extra round-trip in practice) and
  // sum the refund records that target this original.
  const casePayments = await getPaymentsByCase(original.caseId);
  const existingRefundSum = casePayments
    .filter(
      (p) =>
        p.status === 'confirmed' &&
        p.paymentType === 'refund' &&
        p.note?.includes(`[refund-of:${originalPaymentId}]`),
    )
    .reduce((sum, p) => sum + p.amount, 0);

  const remainingRefundable = original.amount - existingRefundSum;
  if (input.amount > remainingRefundable) {
    throw new RefundError(
      'amount_exceeds_remaining',
      `Hoàn tiền vượt quá số tiền còn lại có thể hoàn (tối đa ${remainingRefundable.toLocaleString('vi-VN')} VNĐ)`,
    );
  }

  // ── 7. Persist the refund payment (confirmed) ─────────────────────
  const id = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  // The `[refund-of:<originalId>]` marker in the note is the link auditors
  // rely on (see §6.2 S15 in the Sprint 7.2 plan). We don't introduce a new
  // column on `Payment` because the marker stays inside the existing
  // `note?: string` field — minimal schema impact, full reversibility.
  const linkedNote = `[refund-of:${originalPaymentId}]${input.note ? ` — ${input.note}` : ''}`;

  const refund: Payment = {
    id,
    caseId: original.caseId,
    customerId: original.customerId,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    paymentType: 'refund',
    receivedBy: original.receivedBy ?? actor.uid,
    paymentDate: input.paymentDate,
    confirmedBy: actor.uid,
    confirmedAt: now,
    note: linkedNote,
    status: 'confirmed',
    createdBy: actor.uid,
    createdAt: now,
    updatedAt: now,
  };

  await setDocument(COLLECTION, id, refund);

  // ── 8. Recompute the case totals via the existing helper ─────────
  // This re-reads the case, sums all confirmed non-refund payments, subtracts
  // refunds, and writes amountPaid/remainingAmount/paymentStatus. The
  // behaviour is identical to what `confirmPayment` and `rejectPayment` do.
  await recalculateCasePayment(original.caseId, actor.uid);

  // Read the recomputed case for the API response.
  const caseRecord = await getCase(original.caseId);

  return { refund, caseRecord };
}

/**
 * Sum of all confirmed refunds against a given original payment.
 * Exported for the payments page UI (so the row can show
 * "Đã hoàn X / Y" without an extra server round-trip when the row already
 * has the full payment list).
 */
export function sumRefundsAgainst(
  originalPaymentId: string,
  allPayments: Payment[],
): number {
  return allPayments
    .filter(
      (p) =>
        p.status === 'confirmed' &&
        p.paymentType === 'refund' &&
        p.note?.includes(`[refund-of:${originalPaymentId}]`),
    )
    .reduce((sum, p) => sum + p.amount, 0);
}

/**
 * Extract the original payment id from a refund payment's note marker, if
 * present. Returns `null` for non-refund payments or legacy refunds created
 * before this story (which used free-text notes without the marker).
 */
export function extractRefundOriginalId(payment: Payment): string | null {
  if (payment.paymentType !== 'refund') return null;
  const match = payment.note?.match(/\[refund-of:([^\]]+)\]/);
  return match ? (match[1] ?? null) : null;
}