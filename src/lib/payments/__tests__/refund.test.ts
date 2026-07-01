/**
 * Story PI-2 (Sprint 7.2) — Refund flow tests.
 *
 * Acceptance criteria (mirrors the manual QA checklist in
 * SPRINT_7_2_EXECUTION_PLAN.md §10.4):
 *
 *  1. Refund against a non-existent payment → `RefundError('original_not_found')`.
 *  2. Refund against a `pending` payment → `RefundError('original_not_confirmed')`.
 *  3. Refund against an already-refund payment → `RefundError('original_is_refund')`.
 *  4. Refund with amount ≤ 0 or non-integer → `RefundError('amount_invalid')`.
 *  5. Refund with amount > original.amount → `RefundError('amount_exceeds_original')`.
 *  6. Refund against an original that was already partially refunded beyond
 *     capacity → `RefundError('amount_exceeds_remaining')`.
 *  7. Happy path: refund < original.amount, original confirmed, no prior
 *     refunds → new Payment persisted with `paymentType: 'refund'`,
 *     `status: 'confirmed'`, note carrying `[refund-of:<id>]`, and
 *     `recalculateCasePayment()` invoked with the caseId.
 *  8. Partial refund followed by a second partial refund that together
 *     exceed the original → second refund rejected with `amount_exceeds_remaining`.
 *  9. `sumRefundsAgainst()` correctly aggregates refund payments against a
 *     given original, ignoring unconfirmed refunds and refunds of other
 *     originals.
 * 10. `extractRefundOriginalId()` parses the `[refund-of:<id>]` marker out
 *     of a refund payment's note; returns null for non-refund or legacy
 *     free-text refunds.
 *
 * The tests mock `@/lib/firestore/payments` and `@/lib/firestore/cases` so
 * they run in isolation, without booting the in-memory mock store.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Payment, CaseRecord, PaymentMethod } from '@/lib/types';

// ─── Module mocks ─────────────────────────────────────────────────────────

const mockGetPayment = vi.fn();
const mockGetPaymentsByCase = vi.fn();
const mockSetDocument = vi.fn();
const mockRecalculateCasePayment = vi.fn();
const mockGetCase = vi.fn();
const mockUpdateCase = vi.fn();

vi.mock('@/lib/firestore/payments', () => ({
  getPayment: (...args: unknown[]) => mockGetPayment(...args),
  getPaymentsByCase: (...args: unknown[]) => mockGetPaymentsByCase(...args),
  recalculateCasePayment: (...args: unknown[]) =>
    mockRecalculateCasePayment(...args),
}));

vi.mock('@/lib/firebase/firestore', () => ({
  setDocument: (...args: unknown[]) => mockSetDocument(...args),
}));

vi.mock('@/lib/firestore/cases', () => ({
  getCase: (...args: unknown[]) => mockGetCase(...args),
  updateCase: (...args: unknown[]) => mockUpdateCase(...args),
}));

// Dynamic import AFTER mocks so the module picks up our mocked firestore.
import {
  createRefund,
  sumRefundsAgainst,
  extractRefundOriginalId,
  RefundError,
} from '@/lib/payments/refund';

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeOriginal(overrides: Partial<Payment> = {}): Payment {
  return {
    id: overrides.id ?? 'pay-100',
    caseId: overrides.caseId ?? 'case-100',
    customerId: overrides.customerId ?? 'cus-100',
    amount: overrides.amount ?? 10_000_000,
    paymentMethod: overrides.paymentMethod ?? 'cash',
    paymentType: overrides.paymentType ?? 'deposit',
    receivedBy: overrides.receivedBy ?? 'user-004',
    paymentDate: overrides.paymentDate ?? '2026-06-15T00:00:00.000Z',
    confirmedBy: overrides.confirmedBy ?? 'user-007',
    confirmedAt: overrides.confirmedAt ?? '2026-06-15T00:00:01.000Z',
    status: overrides.status ?? 'confirmed',
    note: overrides.note,
    createdBy: overrides.createdBy ?? 'user-004',
    createdAt: overrides.createdAt ?? '2026-06-15T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-06-15T00:00:01.000Z',
  };
}

function makeRefund(overrides: Partial<Payment> = {}): Payment {
  return {
    id: overrides.id ?? 'pay-200',
    caseId: overrides.caseId ?? 'case-100',
    customerId: overrides.customerId ?? 'cus-100',
    amount: overrides.amount ?? 1_000_000,
    paymentMethod: overrides.paymentMethod ?? 'cash',
    paymentType: overrides.paymentType ?? 'refund',
    receivedBy: overrides.receivedBy ?? 'user-004',
    paymentDate: overrides.paymentDate ?? '2026-06-20T00:00:00.000Z',
    confirmedBy: overrides.confirmedBy ?? 'user-007',
    confirmedAt: overrides.confirmedAt ?? '2026-06-20T00:00:01.000Z',
    status: overrides.status ?? 'confirmed',
    note: overrides.note ?? `[refund-of:pay-100] — Hoàn một phần`,
    createdBy: overrides.createdBy ?? 'user-007',
    createdAt: overrides.createdAt ?? '2026-06-20T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-06-20T00:00:01.000Z',
  };
}

function makeCase(overrides: Partial<CaseRecord> = {}): CaseRecord {
  return {
    id: overrides.id ?? 'case-100',
    caseCode: overrides.caseCode ?? 'SW-260615-100',
    customerId: overrides.customerId ?? 'cus-100',
    caseDate: overrides.caseDate ?? '2026-06-15T00:00:00.000Z',
    mainServiceGroup: overrides.mainServiceGroup ?? 'nose',
    status: overrides.status ?? 'scheduled',
    priority: overrides.priority ?? 'normal',
    totalBillBeforeDiscount: overrides.totalBillBeforeDiscount ?? 10_000_000,
    totalBillAfterDiscount: overrides.totalBillAfterDiscount ?? 10_000_000,
    amountPaid: overrides.amountPaid ?? 0,
    remainingAmount: overrides.remainingAmount ?? 10_000_000,
    paymentStatus: overrides.paymentStatus ?? 'unpaid',
    privacyLevel: overrides.privacyLevel ?? 'normal',
    createdBy: overrides.createdBy ?? 'user-004',
    createdAt: overrides.createdAt ?? '2026-06-15T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-06-15T00:00:00.000Z',
  };
}

const ACTOR = {
  uid: 'user-007',
  displayName: 'Hồ Thị Lan',
  role: 'accountant',
};

// ─── Suite ────────────────────────────────────────────────────────────────

describe('createRefund — Story PI-2 (Sprint 7.2)', () => {
  beforeEach(() => {
    mockGetPayment.mockReset();
    mockGetPaymentsByCase.mockReset();
    mockSetDocument.mockReset();
    mockRecalculateCasePayment.mockReset();
    mockGetCase.mockReset();
    mockUpdateCase.mockReset();

    // Defaults: empty payment history for the case, and a successful case fetch.
    mockGetPaymentsByCase.mockResolvedValue([]);
    mockGetCase.mockResolvedValue(makeCase());
    mockSetDocument.mockResolvedValue(undefined);
    mockRecalculateCasePayment.mockResolvedValue(undefined);
    mockUpdateCase.mockResolvedValue(undefined);
  });

  // ── 1. Original payment must exist ──────────────────────────────────
  it('throws original_not_found when the original payment does not exist', async () => {
    mockGetPayment.mockResolvedValue(null);

    await expect(
      createRefund(
        'pay-missing',
        {
          amount: 1_000_000,
          paymentMethod: 'cash',
          paymentDate: '2026-07-01',
        },
        ACTOR,
      ),
    ).rejects.toMatchObject({
      name: 'RefundError',
      code: 'original_not_found',
    });

    expect(mockSetDocument).not.toHaveBeenCalled();
    expect(mockRecalculateCasePayment).not.toHaveBeenCalled();
  });

  // ── 2. Original must be confirmed ───────────────────────────────────
  it('throws original_not_confirmed when the original is pending', async () => {
    mockGetPayment.mockResolvedValue(
      makeOriginal({ id: 'pay-pending', status: 'pending' }),
    );

    await expect(
      createRefund(
        'pay-pending',
        { amount: 1_000_000, paymentMethod: 'cash', paymentDate: '2026-07-01' },
        ACTOR,
      ),
    ).rejects.toMatchObject({ code: 'original_not_confirmed' });
  });

  it('throws original_not_confirmed when the original is rejected', async () => {
    mockGetPayment.mockResolvedValue(
      makeOriginal({ id: 'pay-rejected', status: 'rejected' }),
    );

    await expect(
      createRefund(
        'pay-rejected',
        { amount: 1_000_000, paymentMethod: 'cash', paymentDate: '2026-07-01' },
        ACTOR,
      ),
    ).rejects.toMatchObject({ code: 'original_not_confirmed' });
  });

  // ── 3. Original cannot itself be a refund ───────────────────────────
  it('throws original_is_refund when the original is itself a refund', async () => {
    mockGetPayment.mockResolvedValue(
      makeOriginal({ id: 'pay-already-refund', paymentType: 'refund' }),
    );

    await expect(
      createRefund(
        'pay-already-refund',
        { amount: 1_000_000, paymentMethod: 'cash', paymentDate: '2026-07-01' },
        ACTOR,
      ),
    ).rejects.toMatchObject({ code: 'original_is_refund' });
  });

  // ── 4. Amount must be a positive integer ───────────────────────────
  it('throws amount_invalid when amount is zero', async () => {
    mockGetPayment.mockResolvedValue(makeOriginal());
    await expect(
      createRefund(
        'pay-100',
        { amount: 0, paymentMethod: 'cash', paymentDate: '2026-07-01' },
        ACTOR,
      ),
    ).rejects.toMatchObject({ code: 'amount_invalid' });
  });

  it('throws amount_invalid when amount is negative', async () => {
    mockGetPayment.mockResolvedValue(makeOriginal());
    await expect(
      createRefund(
        'pay-100',
        { amount: -500_000, paymentMethod: 'cash', paymentDate: '2026-07-01' },
        ACTOR,
      ),
    ).rejects.toMatchObject({ code: 'amount_invalid' });
  });

  it('throws amount_invalid when amount is not an integer', async () => {
    mockGetPayment.mockResolvedValue(makeOriginal());
    await expect(
      createRefund(
        'pay-100',
        {
          amount: 1_000_000.5,
          paymentMethod: 'cash',
          paymentDate: '2026-07-01',
        },
        ACTOR,
      ),
    ).rejects.toMatchObject({ code: 'amount_invalid' });
  });

  // ── 5. Single-shot cap ──────────────────────────────────────────────
  it('throws amount_exceeds_original when amount > original.amount', async () => {
    mockGetPayment.mockResolvedValue(makeOriginal({ amount: 5_000_000 }));
    await expect(
      createRefund(
        'pay-100',
        {
          amount: 6_000_000,
          paymentMethod: 'cash',
          paymentDate: '2026-07-01',
        },
        ACTOR,
      ),
    ).rejects.toMatchObject({ code: 'amount_exceeds_original' });
  });

  it('accepts refund exactly equal to original.amount (full refund)', async () => {
    mockGetPayment.mockResolvedValue(makeOriginal({ amount: 5_000_000 }));

    const result = await createRefund(
      'pay-100',
      {
        amount: 5_000_000,
        paymentMethod: 'cash',
        paymentDate: '2026-07-01',
      },
      ACTOR,
    );

    expect(result.refund.amount).toBe(5_000_000);
    expect(result.refund.paymentType).toBe('refund');
    expect(result.refund.status).toBe('confirmed');
    expect(mockRecalculateCasePayment).toHaveBeenCalledWith(
      'case-100',
      ACTOR.uid,
    );
  });

  // ── 6. Cumulative cap ───────────────────────────────────────────────
  it('throws amount_exceeds_remaining when prior refunds already fill the bucket', async () => {
    mockGetPayment.mockResolvedValue(makeOriginal({ amount: 5_000_000 }));
    // Prior partial refunds of 3M + 1.5M against the same original → only 500k remains.
    mockGetPaymentsByCase.mockResolvedValue([
      makeRefund({ id: 'pay-r1', amount: 3_000_000 }),
      makeRefund({ id: 'pay-r2', amount: 1_500_000 }),
    ]);

    await expect(
      createRefund(
        'pay-100',
        { amount: 1_000_000, paymentMethod: 'cash', paymentDate: '2026-07-01' },
        ACTOR,
      ),
    ).rejects.toMatchObject({ code: 'amount_exceeds_remaining' });
  });

  it('accepts a partial refund that exactly fits the remaining bucket', async () => {
    mockGetPayment.mockResolvedValue(makeOriginal({ amount: 5_000_000 }));
    mockGetPaymentsByCase.mockResolvedValue([
      makeRefund({ id: 'pay-r1', amount: 3_000_000 }),
    ]);

    const result = await createRefund(
      'pay-100',
      {
        amount: 2_000_000,
        paymentMethod: 'bank_transfer',
        paymentDate: '2026-07-01',
        note: 'Hoàn phần còn lại',
      },
      ACTOR,
    );

    expect(result.refund.amount).toBe(2_000_000);
    expect(result.refund.paymentType).toBe('refund');
    expect(result.refund.status).toBe('confirmed');
    expect(result.refund.confirmedBy).toBe(ACTOR.uid);
    expect(result.refund.note).toContain('[refund-of:pay-100]');
    expect(result.refund.note).toContain('Hoàn phần còn lại');
  });

  it('ignores prior refunds that target a DIFFERENT original (no double-count)', async () => {
    mockGetPayment.mockResolvedValue(makeOriginal({ id: 'pay-A', amount: 5_000_000 }));
    // A refund that targets pay-B (different original) — should NOT count
    // against the pay-A bucket.
    mockGetPaymentsByCase.mockResolvedValue([
      makeRefund({
        id: 'pay-rB',
        amount: 9_000_000,
        note: '[refund-of:pay-B] — refund of another original',
      }),
    ]);

    const result = await createRefund(
      'pay-A',
      { amount: 5_000_000, paymentMethod: 'cash', paymentDate: '2026-07-01' },
      ACTOR,
    );

    expect(result.refund.amount).toBe(5_000_000);
    expect(mockSetDocument).toHaveBeenCalledTimes(1);
  });

  it('ignores unconfirmed (pending) refunds when computing the remaining bucket', async () => {
    mockGetPayment.mockResolvedValue(makeOriginal({ amount: 5_000_000 }));
    mockGetPaymentsByCase.mockResolvedValue([
      makeRefund({ id: 'pay-r-pending', amount: 4_000_000, status: 'pending' }),
    ]);

    const result = await createRefund(
      'pay-100',
      { amount: 5_000_000, paymentMethod: 'cash', paymentDate: '2026-07-01' },
      ACTOR,
    );

    expect(result.refund.amount).toBe(5_000_000);
  });

  // ── 7. Happy path ───────────────────────────────────────────────────
  it('persists the refund with correct shape and triggers recompute', async () => {
    mockGetPayment.mockResolvedValue(
      makeOriginal({
        id: 'pay-original',
        amount: 10_000_000,
        paymentMethod: 'bank_transfer',
        receivedBy: 'user-005',
      }),
    );

    const result = await createRefund(
      'pay-original',
      {
        amount: 4_000_000,
        paymentMethod: 'cash',
        paymentDate: '2026-07-01',
        note: 'Khách hàng yêu cầu hoàn một phần',
      },
      ACTOR,
    );

    // Persisted via setDocument with (collection, id, payload)
    expect(mockSetDocument).toHaveBeenCalledTimes(1);
    const [collection, id, payload] = mockSetDocument.mock.calls[0];
    expect(collection).toBe('payments');
    expect(typeof id).toBe('string');
    expect(id).toMatch(/^pay-/);

    expect(payload.paymentType).toBe('refund');
    expect(payload.status).toBe('confirmed');
    expect(payload.amount).toBe(4_000_000);
    expect(payload.paymentMethod).toBe('cash');
    expect(payload.paymentDate).toBe('2026-07-01');
    expect(payload.caseId).toBe('case-100');
    expect(payload.customerId).toBe('cus-100');
    expect(payload.confirmedBy).toBe(ACTOR.uid);
    expect(payload.createdBy).toBe(ACTOR.uid);
    expect(payload.receivedBy).toBe('user-005');
    expect(payload.note).toContain('[refund-of:pay-original]');
    expect(payload.note).toContain('Khách hàng yêu cầu hoàn một phần');

    // Result mirrors the persisted payload + the recomputed case.
    expect(result.refund.id).toBe(id);
    expect(result.refund.paymentType).toBe('refund');
    expect(result.caseRecord?.id).toBe('case-100');

    // Recompute is delegated to the existing helper (F-HIGH-28 owns the
    // refactor; PI-2 does not reimplement it).
    expect(mockRecalculateCasePayment).toHaveBeenCalledWith(
      'case-100',
      ACTOR.uid,
    );
  });

  it('omits the note suffix when the user did not provide a note', async () => {
    mockGetPayment.mockResolvedValue(makeOriginal());

    await createRefund(
      'pay-100',
      { amount: 1_000_000, paymentMethod: 'cash', paymentDate: '2026-07-01' },
      ACTOR,
    );

    const [, , payload] = mockSetDocument.mock.calls[0];
    expect(payload.note).toBe('[refund-of:pay-100]');
  });

  // ── 8. Recompute side-effect propagation ───────────────────────────
  it('returns the recomputed case snapshot in the result', async () => {
    mockGetPayment.mockResolvedValue(makeOriginal({ amount: 10_000_000 }));
    const recomputedCase = makeCase({ amountPaid: 6_000_000, remainingAmount: 4_000_000 });
    mockGetCase.mockResolvedValue(recomputedCase);

    const result = await createRefund(
      'pay-100',
      { amount: 4_000_000, paymentMethod: 'cash', paymentDate: '2026-07-01' },
      ACTOR,
    );

    expect(result.caseRecord).toEqual(recomputedCase);
  });

  it('returns caseRecord=null when the case is missing after recompute (rare)', async () => {
    mockGetPayment.mockResolvedValue(makeOriginal());
    mockGetCase.mockResolvedValue(null);

    const result = await createRefund(
      'pay-100',
      { amount: 1_000_000, paymentMethod: 'cash', paymentDate: '2026-07-01' },
      ACTOR,
    );

    expect(result.caseRecord).toBeNull();
    // The refund was still persisted and the recompute was still called.
    expect(mockSetDocument).toHaveBeenCalledTimes(1);
    expect(mockRecalculateCasePayment).toHaveBeenCalledTimes(1);
  });

  // ── 9. Different payment methods allowed (refund can use a different channel) ─
  it('accepts a refund on a different payment method than the original', async () => {
    mockGetPayment.mockResolvedValue(
      makeOriginal({ paymentMethod: 'bank_transfer' }),
    );

    const result = await createRefund(
      'pay-100',
      {
        amount: 2_000_000,
        paymentMethod: 'cash' as PaymentMethod,
        paymentDate: '2026-07-01',
      },
      ACTOR,
    );

    expect(result.refund.paymentMethod).toBe('cash');
  });
});

// ─── sumRefundsAgainst — pure helper ─────────────────────────────────────

describe('sumRefundsAgainst() — Story PI-2', () => {
  it('returns 0 for a payment with no refunds', () => {
    const sum = sumRefundsAgainst('pay-X', [
      makeRefund({ note: '[refund-of:pay-Y] — refund of another' }),
    ]);
    expect(sum).toBe(0);
  });

  it('sums only confirmed refunds targeting the given original', () => {
    const sum = sumRefundsAgainst('pay-A', [
      makeRefund({ id: 'r1', amount: 1_000_000, note: '[refund-of:pay-A]' }),
      makeRefund({ id: 'r2', amount: 2_000_000, note: '[refund-of:pay-A]' }),
      makeRefund({ id: 'r3', amount: 999_999, status: 'pending', note: '[refund-of:pay-A]' }),
      makeRefund({ id: 'r4', amount: 5_000_000, note: '[refund-of:pay-B]' }),
    ]);
    expect(sum).toBe(3_000_000);
  });

  it('skips refunds whose note lacks the marker (legacy free-text refunds)', () => {
    const sum = sumRefundsAgainst('pay-A', [
      makeRefund({ id: 'r1', amount: 1_000_000, note: 'legacy free-text' }),
    ]);
    expect(sum).toBe(0);
  });
});

// ─── extractRefundOriginalId — pure helper ────────────────────────────────

describe('extractRefundOriginalId() — Story PI-2', () => {
  it('returns null for non-refund payments', () => {
    expect(
      extractRefundOriginalId(makeOriginal({ paymentType: 'deposit' })),
    ).toBeNull();
  });

  it('returns the original id for refunds with the marker', () => {
    expect(
      extractRefundOriginalId(
        makeRefund({ note: '[refund-of:pay-XYZ] — partial refund' }),
      ),
    ).toBe('pay-XYZ');
  });

  it('returns null for legacy refunds without the marker', () => {
    expect(
      extractRefundOriginalId(makeRefund({ note: 'Hoàn tiền cọc' })),
    ).toBeNull();
  });
});

// ─── RefundError — type sanity ────────────────────────────────────────────

describe('RefundError — Story PI-2', () => {
  it('exposes the typed `code` field for downstream API mapping', () => {
    const err = new RefundError('amount_exceeds_original', 'oops');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('RefundError');
    expect(err.code).toBe('amount_exceeds_original');
    expect(err.message).toBe('oops');
  });
});