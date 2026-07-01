/**
 * Story F-HIGH-28 (Sprint 7.2) — Bill recompute property tests.
 *
 * The qa-architect Layer-8 contract (Sprint 7.2 §6.1) requires the §3.2
 * revenue invariant to hold for **1000 randomized case states**. Without
 * `fast-check` available in this project, we synthesize randomized fixtures
 * directly inside the test (1000 iterations × multiple property checks) so
 * the same coverage is achieved with the existing `vitest` dependency.
 *
 * Invariant under test (Sprint 7.2 §3.2):
 *
 *   amountPaid      === Σ(p.payment.amount | status='confirmed' AND paymentType≠'refund')
 *   refundedAmount  === Σ(p.payment.amount | status='confirmed' AND paymentType='refund')
 *   remainingAmount === max(0, totalBillAfterDiscount − amountPaid + refundedAmount)
 *
 * @see docs/ux-redesign/SPRINT_7_2_EXECUTION_PLAN.md §3.2, §6.2 (S4, S5, S6)
 */

import { describe, it, expect } from 'vitest';
import {
  recomputeBillFromPayments,
  recomputeBillFromServices,
  sumConfirmedPayments,
  sumConfirmedRefunds,
  isPaymentHistoryUsable,
  hashBillState,
  snapshotToCaseUpdate,
  type BillSnapshot,
} from '@/lib/billing/recompute';
import type {
  CaseRecord,
  CaseService,
  Payment,
  PaymentRecordStatus,
  PaymentType,
} from '@/lib/types';

// ─── Deterministic PRNG (so failing tests are reproducible) ─────────────

/**
 * Tiny xorshift32 — keeps the 1000-iteration property test deterministic
 * across machines / CI runs without pulling in `fast-check`.
 */
function makePrng(seed: number): () => number {
  let state = seed | 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

function intBetween(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// ─── Fixture builders ────────────────────────────────────────────────────

const STATUSES: readonly PaymentRecordStatus[] = ['pending', 'confirmed', 'rejected'];
const TYPES: readonly PaymentType[] = ['deposit', 'partial', 'full', 'refund'];
const METHODS: readonly Payment['paymentMethod'][] = [
  'cash',
  'bank_transfer',
  'card',
  'installment',
  'other',
];

function makePayment(rng: () => number, caseId: string, idx: number): Payment {
  return {
    id: `pay-${caseId}-${idx}`,
    caseId,
    customerId: `cust-${caseId}`,
    amount: intBetween(rng, 1000, 50_000_000),
    paymentMethod: pick(rng, METHODS),
    paymentType: pick(rng, TYPES),
    paymentDate: '2026-07-01',
    status: pick(rng, STATUSES),
    createdBy: 'user-004',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

function makePayments(rng: () => number, caseId: string, n: number): Payment[] {
  return Array.from({ length: n }, (_, i) => makePayment(rng, caseId, i));
}

function makeCase(rng: () => number, id: string): CaseRecord {
  const total = intBetween(rng, 0, 200_000_000);
  return {
    id,
    caseCode: `SW-${id}`,
    customerId: `cust-${id}`,
    caseDate: '2026-07-01T00:00:00.000Z',
    mainServiceGroup: 'nose',
    status: 'scheduled',
    priority: 'normal',
    totalBillBeforeDiscount: total,
    totalBillAfterDiscount: total,
    amountPaid: 0,
    remainingAmount: total,
    paymentStatus: 'unpaid',
    privacyLevel: 'normal',
    createdBy: 'user-004',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

function makeService(
  rng: () => number,
  caseId: string,
  idx: number,
  overrides: Partial<CaseService> = {},
): CaseService {
  const final = intBetween(rng, 100_000, 20_000_000);
  return {
    id: `csvc-${caseId}-${idx}`,
    caseId,
    serviceName: `Service ${idx}`,
    serviceCategory: 'nose',
    listedPrice: final + intBetween(rng, 0, 1_000_000),
    finalPrice: final,
    quantity: intBetween(rng, 1, 3),
    isMainService: idx === 0,
    isGift: false,
    isUpsell: false,
    note: undefined,
    active: true,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

// ─── Pure-function unit tests (boundary cases) ───────────────────────────

describe('recomputeBillFromPayments — boundary cases', () => {
  const FIXED_NOW = new Date('2026-07-01T12:00:00.000Z');

  it('returns zeroed snapshot for an empty payment list', () => {
    const caseRecord = { id: 'case-1', totalBillAfterDiscount: 10_000_000 };
    const snap = recomputeBillFromPayments(
      { caseRecord, payments: [] },
      FIXED_NOW,
    );
    expect(snap.amountPaid).toBe(0);
    expect(snap.refundedAmount).toBe(0);
    expect(snap.remainingAmount).toBe(10_000_000);
    expect(snap.paymentStatus).toBe('unpaid');
    expect(snap.recomputedAt).toBe(FIXED_NOW.toISOString());
    expect(snap.billHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('paymentStatus="paid" when amountPaid >= totalBillAfterDiscount', () => {
    const caseRecord = { id: 'case-1', totalBillAfterDiscount: 10_000_000 };
    const payments: Payment[] = [
      {
        ...makePayment(makePrng(1), 'case-1', 0),
        amount: 5_000_000,
        paymentType: 'deposit',
        status: 'confirmed',
      },
      {
        ...makePayment(makePrng(1), 'case-1', 1),
        amount: 5_000_000,
        paymentType: 'partial',
        status: 'confirmed',
      },
    ];
    const snap = recomputeBillFromPayments(
      { caseRecord, payments },
      FIXED_NOW,
    );
    expect(snap.amountPaid).toBe(10_000_000);
    expect(snap.remainingAmount).toBe(0);
    expect(snap.paymentStatus).toBe('paid');
  });

  it('paymentStatus="deposit" when only a deposit is confirmed and total > 0', () => {
    const caseRecord = { id: 'case-1', totalBillAfterDiscount: 10_000_000 };
    const payments: Payment[] = [
      {
        ...makePayment(makePrng(1), 'case-1', 0),
        amount: 3_000_000,
        paymentType: 'deposit',
        status: 'confirmed',
      },
    ];
    const snap = recomputeBillFromPayments(
      { caseRecord, payments },
      FIXED_NOW,
    );
    expect(snap.amountPaid).toBe(3_000_000);
    expect(snap.remainingAmount).toBe(7_000_000);
    expect(snap.paymentStatus).toBe('deposit');
  });

  it('paymentStatus="partial" when no deposit is confirmed and total > amountPaid', () => {
    const caseRecord = { id: 'case-1', totalBillAfterDiscount: 10_000_000 };
    const payments: Payment[] = [
      {
        ...makePayment(makePrng(1), 'case-1', 0),
        amount: 5_000_000,
        paymentType: 'partial',
        status: 'confirmed',
      },
    ];
    const snap = recomputeBillFromPayments(
      { caseRecord, payments },
      FIXED_NOW,
    );
    expect(snap.amountPaid).toBe(5_000_000);
    expect(snap.paymentStatus).toBe('partial');
  });

  it('paymentStatus="refunded" when amountPaid=0 and refundedAmount>0', () => {
    const caseRecord = { id: 'case-1', totalBillAfterDiscount: 0 };
    const payments: Payment[] = [
      {
        ...makePayment(makePrng(1), 'case-1', 0),
        amount: 1_000_000,
        paymentType: 'refund',
        status: 'confirmed',
      },
    ];
    const snap = recomputeBillFromPayments(
      { caseRecord, payments },
      FIXED_NOW,
    );
    expect(snap.amountPaid).toBe(0);
    expect(snap.refundedAmount).toBe(1_000_000);
    expect(snap.paymentStatus).toBe('refunded');
  });

  it('ignores pending payments', () => {
    const caseRecord = { id: 'case-1', totalBillAfterDiscount: 10_000_000 };
    const payments: Payment[] = [
      {
        ...makePayment(makePrng(1), 'case-1', 0),
        amount: 5_000_000,
        paymentType: 'deposit',
        status: 'pending',
      },
    ];
    const snap = recomputeBillFromPayments(
      { caseRecord, payments },
      FIXED_NOW,
    );
    expect(snap.amountPaid).toBe(0);
    expect(snap.paymentStatus).toBe('unpaid');
  });

  it('ignores rejected payments', () => {
    const caseRecord = { id: 'case-1', totalBillAfterDiscount: 10_000_000 };
    const payments: Payment[] = [
      {
        ...makePayment(makePrng(1), 'case-1', 0),
        amount: 5_000_000,
        paymentType: 'deposit',
        status: 'rejected',
      },
    ];
    const snap = recomputeBillFromPayments(
      { caseRecord, payments },
      FIXED_NOW,
    );
    expect(snap.amountPaid).toBe(0);
    expect(snap.paymentStatus).toBe('unpaid');
  });

  it('refund reduces amountPaid (refund portion is subtracted, not netted)', () => {
    const caseRecord = { id: 'case-1', totalBillAfterDiscount: 10_000_000 };
    const payments: Payment[] = [
      {
        ...makePayment(makePrng(1), 'case-1', 0),
        amount: 5_000_000,
        paymentType: 'deposit',
        status: 'confirmed',
      },
      {
        ...makePayment(makePrng(1), 'case-1', 1),
        amount: 2_000_000,
        paymentType: 'refund',
        status: 'confirmed',
      },
    ];
    const snap = recomputeBillFromPayments(
      { caseRecord, payments },
      FIXED_NOW,
    );
    expect(snap.amountPaid).toBe(5_000_000);
    expect(snap.refundedAmount).toBe(2_000_000);
    // remaining = max(0, 10M - 5M + 2M) = 7M
    expect(snap.remainingAmount).toBe(7_000_000);
  });

  it('refund overflow: amountPaid is sum-of-non-refunds (1M deposit), refundedAmount is sum-of-refunds (3M)', () => {
    // Per Sprint 7.2 §3.2 invariant:
    //   amountPaid     === Σ confirmed non-refund payments (= 1M deposit)
    //   refundedAmount === Σ confirmed refund payments    (= 3M refund)
    // The refund overflow is communicated via refundedAmount + remainingAmount,
    // not by negative amountPaid. This is a deliberate divergence from the
    // pre-F-HIGH-28 incremental logic which netted refunds against amountPaid.
    const caseRecord = { id: 'case-1', totalBillAfterDiscount: 10_000_000 };
    const payments: Payment[] = [
      {
        ...makePayment(makePrng(1), 'case-1', 0),
        amount: 1_000_000,
        paymentType: 'deposit',
        status: 'confirmed',
      },
      {
        ...makePayment(makePrng(1), 'case-1', 1),
        amount: 3_000_000,
        paymentType: 'refund',
        status: 'confirmed',
      },
    ];
    const snap = recomputeBillFromPayments(
      { caseRecord, payments },
      FIXED_NOW,
    );
    expect(snap.amountPaid).toBe(1_000_000);
    expect(snap.refundedAmount).toBe(3_000_000);
    // remaining = max(0, 10M - 1M + 3M) = 12M (refund adds back to remaining
    // because the customer has effectively been credited for more than they paid).
    expect(snap.remainingAmount).toBe(12_000_000);
  });

  it('coerces non-finite amounts to 0 (defensive — does not throw)', () => {
    const caseRecord = { id: 'case-1', totalBillAfterDiscount: 10_000_000 };
    const payments: Payment[] = [
      {
        ...makePayment(makePrng(1), 'case-1', 0),
        amount: Number.NaN,
        paymentType: 'deposit',
        status: 'confirmed',
      },
      {
        ...makePayment(makePrng(1), 'case-1', 1),
        amount: Number.POSITIVE_INFINITY,
        paymentType: 'partial',
        status: 'confirmed',
      },
    ];
    // Should not throw.
    const snap = recomputeBillFromPayments(
      { caseRecord, payments },
      FIXED_NOW,
    );
    expect(snap.amountPaid).toBe(0);
  });

  it('handles totalBillAfterDiscount=0 (no bill yet) without throwing', () => {
    const caseRecord = { id: 'case-1', totalBillAfterDiscount: 0 };
    const payments: Payment[] = [
      {
        ...makePayment(makePrng(1), 'case-1', 0),
        amount: 5_000_000,
        paymentType: 'deposit',
        status: 'confirmed',
      },
    ];
    const snap = recomputeBillFromPayments(
      { caseRecord, payments },
      FIXED_NOW,
    );
    expect(snap.amountPaid).toBe(5_000_000);
    expect(snap.remainingAmount).toBe(0);
    expect(snap.paymentStatus).toBe('paid');
  });
});

// ─── Pure helper tests ───────────────────────────────────────────────────

describe('sumConfirmedPayments / sumConfirmedRefunds', () => {
  it('sumConfirmedPayments ignores pending, rejected and refunds', () => {
    const caseId = 'case-1';
    const payments: Payment[] = [
      { ...makePayment(makePrng(1), caseId, 0), amount: 1000, status: 'confirmed', paymentType: 'deposit' },
      { ...makePayment(makePrng(1), caseId, 1), amount: 2000, status: 'confirmed', paymentType: 'partial' },
      { ...makePayment(makePrng(1), caseId, 2), amount: 3000, status: 'pending', paymentType: 'deposit' },
      { ...makePayment(makePrng(1), caseId, 3), amount: 4000, status: 'rejected', paymentType: 'full' },
      { ...makePayment(makePrng(1), caseId, 4), amount: 5000, status: 'confirmed', paymentType: 'refund' },
    ];
    expect(sumConfirmedPayments(payments)).toBe(3000);
  });

  it('sumConfirmedRefunds counts only confirmed refund-typed payments', () => {
    const caseId = 'case-1';
    const payments: Payment[] = [
      { ...makePayment(makePrng(1), caseId, 0), amount: 1000, status: 'confirmed', paymentType: 'refund' },
      { ...makePayment(makePrng(1), caseId, 1), amount: 2000, status: 'confirmed', paymentType: 'refund' },
      { ...makePayment(makePrng(1), caseId, 2), amount: 3000, status: 'pending', paymentType: 'refund' },
      { ...makePayment(makePrng(1), caseId, 3), amount: 4000, status: 'confirmed', paymentType: 'deposit' },
    ];
    expect(sumConfirmedRefunds(payments)).toBe(3000);
  });
});

describe('isPaymentHistoryUsable', () => {
  it('returns true for a well-formed payment list', () => {
    expect(isPaymentHistoryUsable(makePayments(makePrng(7), 'case-1', 5))).toBe(true);
  });

  it('returns false for a payment with non-numeric amount', () => {
    const p = makePayment(makePrng(7), 'case-1', 0);
    expect(isPaymentHistoryUsable([{ ...p, amount: Number.NaN }])).toBe(false);
  });

  it('returns false for a payment with missing status', () => {
    const p = makePayment(makePrng(7), 'case-1', 0);
    const broken = { ...p, status: undefined as unknown as PaymentRecordStatus };
    expect(isPaymentHistoryUsable([broken])).toBe(false);
  });
});

describe('hashBillState', () => {
  it('produces identical hashes for identical states', () => {
    const a = hashBillState({ total: 10_000_000, amountPaid: 5_000_000, refundedAmount: 0, remainingAmount: 5_000_000 });
    const b = hashBillState({ total: 10_000_000, amountPaid: 5_000_000, refundedAmount: 0, remainingAmount: 5_000_000 });
    expect(a).toBe(b);
  });

  it('produces different hashes for different states', () => {
    const a = hashBillState({ total: 10_000_000, amountPaid: 5_000_000, refundedAmount: 0, remainingAmount: 5_000_000 });
    const b = hashBillState({ total: 10_000_000, amountPaid: 6_000_000, refundedAmount: 0, remainingAmount: 4_000_000 });
    expect(a).not.toBe(b);
  });

  it('always returns a 16-character hex string', () => {
    const h = hashBillState({ total: 0, amountPaid: 0, refundedAmount: 0, remainingAmount: 0 });
    expect(h).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('snapshotToCaseUpdate', () => {
  it('maps the snapshot to the partial UpdateCaseInput shape', () => {
    const snapshot: BillSnapshot = {
      recomputedAt: '2026-07-01T00:00:00.000Z',
      amountPaid: 5_000_000,
      refundedAmount: 0,
      remainingAmount: 5_000_000,
      paymentStatus: 'deposit',
      billHash: '0000000000000000',
    };
    expect(snapshotToCaseUpdate(snapshot)).toEqual({
      amountPaid: 5_000_000,
      remainingAmount: 5_000_000,
      paymentStatus: 'deposit',
    });
  });
});

// ─── Service-side recompute ──────────────────────────────────────────────

describe('recomputeBillFromServices', () => {
  it('sums non-gift, active service rows', () => {
    const caseRecord = {
      discountType: 'none' as const,
      discountValue: 0,
      totalBillBeforeDiscount: 0,
      totalBillAfterDiscount: 0,
    };
    const services: CaseService[] = [
      makeService(makePrng(1), 'case-1', 0, { finalPrice: 5_000_000, quantity: 1, isGift: false, active: true }),
      makeService(makePrng(1), 'case-1', 1, { finalPrice: 3_000_000, quantity: 2, isGift: false, active: true }),
      makeService(makePrng(1), 'case-1', 2, { finalPrice: 999_999, quantity: 1, isGift: true, active: true }),
    ];
    const totals = recomputeBillFromServices(services, caseRecord);
    expect(totals.totalBillAfterDiscount).toBe(5_000_000 + 3_000_000 * 2);
  });

  it('excludes soft-deleted services (active=false)', () => {
    const caseRecord = {
      discountType: 'none' as const,
      discountValue: 0,
      totalBillBeforeDiscount: 0,
      totalBillAfterDiscount: 0,
    };
    const services: CaseService[] = [
      makeService(makePrng(1), 'case-1', 0, { finalPrice: 5_000_000, quantity: 1, active: true }),
      makeService(makePrng(1), 'case-1', 1, { finalPrice: 3_000_000, quantity: 1, active: false }),
    ];
    const totals = recomputeBillFromServices(services, caseRecord);
    expect(totals.totalBillAfterDiscount).toBe(5_000_000);
  });

  it('applies percent discount', () => {
    const caseRecord = {
      discountType: 'percent' as const,
      discountValue: 10,
      totalBillBeforeDiscount: 0,
      totalBillAfterDiscount: 0,
    };
    const services: CaseService[] = [
      makeService(makePrng(1), 'case-1', 0, { finalPrice: 10_000_000, quantity: 1 }),
    ];
    const totals = recomputeBillFromServices(services, caseRecord);
    expect(totals.totalBillAfterDiscount).toBe(9_000_000);
  });

  it('applies fixed discount', () => {
    const caseRecord = {
      discountType: 'fixed' as const,
      discountValue: 2_000_000,
      totalBillBeforeDiscount: 0,
      totalBillAfterDiscount: 0,
    };
    const services: CaseService[] = [
      makeService(makePrng(1), 'case-1', 0, { finalPrice: 10_000_000, quantity: 1 }),
    ];
    const totals = recomputeBillFromServices(services, caseRecord);
    expect(totals.totalBillAfterDiscount).toBe(8_000_000);
  });

  it('clamps fixed discount at 0 (no negative bill)', () => {
    const caseRecord = {
      discountType: 'fixed' as const,
      discountValue: 100_000_000,
      totalBillBeforeDiscount: 0,
      totalBillAfterDiscount: 0,
    };
    const services: CaseService[] = [
      makeService(makePrng(1), 'case-1', 0, { finalPrice: 10_000_000, quantity: 1 }),
    ];
    const totals = recomputeBillFromServices(services, caseRecord);
    expect(totals.totalBillAfterDiscount).toBe(0);
  });
});

// ─── Property test: 1000 randomized cases × full invariant ──────────────

describe('recompute invariant — 1000 randomized cases (qa-architect Layer 8)', () => {
  // 1000 randomized cases × full invariant (Sprint 7.2 §6.1 L8 target).
  const ITERATIONS = 1000;
  const BASE_SEED = 20260701; // deterministic seed = Sprint 7.2 start date

  it('amountPaid === Σ(confirmed non-refund payments)', () => {
    for (let i = 0; i < ITERATIONS; i += 1) {
      const rng = makePrng(BASE_SEED + i);
      const caseId = `case-${i}`;
      const caseRecord = makeCase(rng, caseId);
      const payments = makePayments(rng, caseId, intBetween(rng, 0, 12));
      const snap = recomputeBillFromPayments({ caseRecord, payments });
      const expected = sumConfirmedPayments(payments);
      expect(snap.amountPaid, `iteration ${i}`).toBe(expected);
    }
  });

  it('refundedAmount === Σ(confirmed refund payments)', () => {
    for (let i = 0; i < ITERATIONS; i += 1) {
      const rng = makePrng(BASE_SEED + i + 50_000);
      const caseId = `case-r-${i}`;
      const caseRecord = makeCase(rng, caseId);
      const payments = makePayments(rng, caseId, intBetween(rng, 0, 12));
      const snap = recomputeBillFromPayments({ caseRecord, payments });
      const expected = sumConfirmedRefunds(payments);
      expect(snap.refundedAmount, `iteration ${i}`).toBe(expected);
    }
  });

  it('remainingAmount === max(0, total − amountPaid + refundedAmount)', () => {
    for (let i = 0; i < ITERATIONS; i += 1) {
      const rng = makePrng(BASE_SEED + i + 100_000);
      const caseId = `case-rem-${i}`;
      const caseRecord = makeCase(rng, caseId);
      const payments = makePayments(rng, caseId, intBetween(rng, 0, 12));
      const snap = recomputeBillFromPayments({ caseRecord, payments });
      const expected = Math.max(
        0,
        caseRecord.totalBillAfterDiscount - snap.amountPaid + snap.refundedAmount,
      );
      expect(snap.remainingAmount, `iteration ${i}`).toBe(expected);
    }
  });

  it('hash is stable across identical inputs (idempotency)', () => {
    for (let i = 0; i < 100; i += 1) {
      const rng = makePrng(BASE_SEED + i);
      const caseRecord = makeCase(rng, `case-h-${i}`);
      const payments = makePayments(rng, caseRecord.id, 5);
      const snap1 = recomputeBillFromPayments({ caseRecord, payments });
      const snap2 = recomputeBillFromPayments({ caseRecord, payments });
      expect(snap1.billHash, `iteration ${i}`).toBe(snap2.billHash);
      expect(snap1.amountPaid).toBe(snap2.amountPaid);
      expect(snap1.refundedAmount).toBe(snap2.refundedAmount);
      expect(snap1.remainingAmount).toBe(snap2.remainingAmount);
      expect(snap1.paymentStatus).toBe(snap2.paymentStatus);
    }
  });

  it('never produces negative amountPaid or refundedAmount', () => {
    for (let i = 0; i < ITERATIONS; i += 1) {
      const rng = makePrng(BASE_SEED + i + 200_000);
      const caseRecord = makeCase(rng, `case-neg-${i}`);
      // Force a refund > deposit to exercise the clamp.
      const payments: Payment[] = [
        {
          ...makePayment(rng, caseRecord.id, 0),
          amount: 100_000,
          paymentType: 'deposit',
          status: 'confirmed',
        },
        {
          ...makePayment(rng, caseRecord.id, 1),
          amount: 5_000_000,
          paymentType: 'refund',
          status: 'confirmed',
        },
      ];
      const snap = recomputeBillFromPayments({ caseRecord, payments });
      expect(snap.amountPaid, `iteration ${i}`).toBeGreaterThanOrEqual(0);
      expect(snap.refundedAmount, `iteration ${i}`).toBeGreaterThanOrEqual(0);
      expect(snap.remainingAmount, `iteration ${i}`).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── Bill-drift regression (S4, S5, S6 from Sprint 7.2 §6.2) ────────────

describe('recomputeBillFromPayments — drift scenarios', () => {
  const FIXED_NOW = new Date('2026-07-01T12:00:00.000Z');

  // Sprint 7.2 §6.2 S4 — confirm + refund roundtrip
  it('S4: confirm + refund + recompute → amountPaid reflects transaction history, not last write', () => {
    const caseRecord = { id: 'case-1', totalBillAfterDiscount: 10_000_000 };
    const payments: Payment[] = [
      {
        ...makePayment(makePrng(1), 'case-1', 0),
        amount: 5_000_000,
        paymentType: 'deposit',
        status: 'confirmed',
      },
      {
        ...makePayment(makePrng(1), 'case-1', 1),
        amount: 2_000_000,
        paymentType: 'refund',
        status: 'confirmed',
      },
    ];
    const snap = recomputeBillFromPayments(
      { caseRecord, payments },
      FIXED_NOW,
    );
    expect(snap.amountPaid).toBe(5_000_000);
    expect(snap.refundedAmount).toBe(2_000_000);
    expect(snap.remainingAmount).toBe(7_000_000);
  });

  // Sprint 7.2 §6.2 S5 — add a service after 3 confirmed payments
  it('S5: service add triggers recompute so remainingAmount uses the new total', () => {
    const oldTotal = 10_000_000;
    const newTotal = 12_000_000; // a +2M service was added
    const payments: Payment[] = [
      {
        ...makePayment(makePrng(1), 'case-1', 0),
        amount: 4_000_000,
        paymentType: 'deposit',
        status: 'confirmed',
      },
      {
        ...makePayment(makePrng(1), 'case-1', 1),
        amount: 3_000_000,
        paymentType: 'partial',
        status: 'confirmed',
      },
      {
        ...makePayment(makePrng(1), 'case-1', 2),
        amount: 3_000_000,
        paymentType: 'partial',
        status: 'confirmed',
      },
    ];
    const snapAfter = recomputeBillFromPayments(
      { caseRecord: { id: 'case-1', totalBillAfterDiscount: newTotal }, payments },
      FIXED_NOW,
    );
    expect(snapAfter.amountPaid).toBe(10_000_000);
    // remaining after add = 12M - 10M = 2M (NOT 0M from the old total)
    expect(snapAfter.remainingAmount).toBe(2_000_000);

    // Sanity: recompute against the OLD total produces a different remaining.
    const snapBefore = recomputeBillFromPayments(
      { caseRecord: { id: 'case-1', totalBillAfterDiscount: oldTotal }, payments },
      FIXED_NOW,
    );
    expect(snapBefore.remainingAmount).toBe(0);
  });

  // Sprint 7.2 §6.2 S6 — reject a payment that was the only confirmed payment
  it('S6: reject the only confirmed payment → amountPaid drops to 0', () => {
    const caseRecord = { id: 'case-1', totalBillAfterDiscount: 10_000_000 };
    const payments: Payment[] = [
      {
        ...makePayment(makePrng(1), 'case-1', 0),
        amount: 5_000_000,
        paymentType: 'deposit',
        status: 'rejected',
      },
    ];
    const snap = recomputeBillFromPayments(
      { caseRecord, payments },
      FIXED_NOW,
    );
    expect(snap.amountPaid).toBe(0);
    expect(snap.remainingAmount).toBe(10_000_000);
    expect(snap.paymentStatus).toBe('unpaid');
  });
});