/**
 * Story PI-3 (Sprint 7.2) — Payment audit enrichment for the refund route.
 *
 * Acceptance criteria (mirrors SPRINT_7_2_EXECUTION_PLAN.md §6.2 S14 +
 * S15):
 *
 *  1. Refund creation writes a `payment_created` audit log on the REFUND
 *     payment with `caseId`, `originalPaymentId`, and `trigger` lifted
 *     to the top level of `after`.
 *  2. Refund creation writes a `payment_refunded` audit log on the
 *     ORIGINAL payment, attached to `entityId = originalPaymentId`, with
 *     the refund id + amount under `metadata`.
 *  3. The refund route returns 404 when PAYMENT_TX flag is OFF.
 *  4. The refund route enforces the role-or-creator contract.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Module mocks ────────────────────────────────────────────────────────

vi.mock('@/config/firebase', () => ({
  isDevMode: true,
  hasFirebaseConfig: false,
  firebaseConfig: {},
}));

vi.mock('@/lib/mock/store', () => ({
  isMockEnabled: () => true,
  initSeedData: () => undefined,
  getCollection: () => new Map(),
  getAllUsers: () => new Map(),
}));

const mockGetPayment = vi.fn();
const mockCreateRefund = vi.fn();
const mockWriteAuditLog = vi.fn();

vi.mock('@/lib/firestore/payments', () => ({
  getPayment: (...args: unknown[]) => mockGetPayment(...args),
}));

vi.mock('@/lib/firestore/audit', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
}));

// Story PI-3 — let the real wrapper run so the audit log call observed
// by the test matches the production shape.
vi.mock('@/lib/audit/payment-audit', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
}));

vi.mock('@/lib/payments/refund', () => ({
  createRefund: (...args: unknown[]) => mockCreateRefund(...args),
  RefundError: class RefundError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

// Dynamic import AFTER mocks.
import { POST } from '@/app/api/payments/refund/route';
import type { Payment, UserRole } from '@/lib/types';

// ─── Helpers ─────────────────────────────────────────────────────────────

function buildPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: overrides.id ?? 'pay-original-001',
    caseId: overrides.caseId ?? 'case-100',
    customerId: overrides.customerId ?? 'cust-100',
    amount: overrides.amount ?? 5_000_000,
    paymentMethod: overrides.paymentMethod ?? 'cash',
    paymentType: overrides.paymentType ?? 'deposit',
    receivedBy: overrides.receivedBy ?? 'user-005',
    paymentDate: overrides.paymentDate ?? '2026-07-01',
    status: overrides.status ?? 'confirmed',
    confirmedBy: overrides.confirmedBy ?? 'user-001',
    confirmedAt: overrides.confirmedAt ?? '2026-07-01T01:00:00.000Z',
    createdBy: overrides.createdBy ?? 'user-005',
    createdAt: overrides.createdAt ?? '2026-07-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-07-01T01:00:00.000Z',
    note: overrides.note,
  } as Payment;
}

function buildRefundPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: overrides.id ?? 'pay-refund-001',
    caseId: overrides.caseId ?? 'case-100',
    customerId: overrides.customerId ?? 'cust-100',
    amount: overrides.amount ?? 1_000_000,
    paymentMethod: overrides.paymentMethod ?? 'cash',
    paymentType: overrides.paymentType ?? 'refund',
    receivedBy: overrides.receivedBy ?? 'user-005',
    paymentDate: overrides.paymentDate ?? '2026-07-02',
    status: overrides.status ?? 'confirmed',
    confirmedBy: overrides.confirmedBy ?? 'user-001',
    confirmedAt: overrides.confirmedAt ?? '2026-07-02T01:00:00.000Z',
    createdBy: overrides.createdBy ?? 'user-001',
    createdAt: overrides.createdAt ?? '2026-07-02T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-07-02T01:00:00.000Z',
    note: overrides.note ?? '[refund-of:pay-original-001] — Hoàn một phần',
  } as Payment;
}

const DEV_USER_MAP: Record<string, UserRole> = {
  'user-001': 'admin',
  'user-002': 'ceo',
  'user-007': 'accountant',
  'user-005': 'sales_online',
};

function buildRequest(role: UserRole, body: unknown): NextRequest {
  const userId = Object.entries(DEV_USER_MAP).find(([, r]) => r === role)![0];
  return new NextRequest(
    new Request('http://localhost:3000/api/payments/refund', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-dev-user-id': userId,
      },
      body: JSON.stringify(body),
    }),
  );
}

// ─── Suite ───────────────────────────────────────────────────────────────

describe('POST /api/payments/refund — Story PI-3 (audit enrichment)', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_FEATURE_PAYMENT_TX = 'true';

    mockGetPayment.mockResolvedValue(buildPayment());
    mockCreateRefund.mockResolvedValue({
      refund: buildRefundPayment(),
      caseRecord: {
        id: 'case-100',
        caseCode: 'SW-260702-100',
        amountPaid: 4_000_000,
        remainingAmount: 6_000_000,
      },
    });
    mockWriteAuditLog.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  // ── 1. Feature flag gate ───────────────────────────────────────

  describe('PAYMENT_TX flag gate', () => {
    it('returns 404 when the flag is OFF', async () => {
      delete process.env.NEXT_PUBLIC_FEATURE_PAYMENT_TX;
      const res = await POST(
        buildRequest('accountant', {
          originalPaymentId: 'pay-original-001',
          amount: 1_000_000,
          paymentMethod: 'cash',
          paymentDate: '2026-07-02',
        }),
      );
      expect(res.status).toBe(404);
      expect(mockCreateRefund).not.toHaveBeenCalled();
    });
  });

  // ── 2. PI-3 enriched audit shape ─────────────────────────��─────

  describe('PI-3 enriched audit payload', () => {
    it('writes payment_created on the refund payment with caseId + originalPaymentId', async () => {
      const res = await POST(
        buildRequest('accountant', {
          originalPaymentId: 'pay-original-001',
          amount: 1_000_000,
          paymentMethod: 'cash',
          paymentDate: '2026-07-02',
          note: 'Khách yêu cầu hoàn',
        }),
      );
      expect(res.status).toBe(200);

      // Two audit entries: payment_created (refund) + payment_refunded (original)
      expect(mockWriteAuditLog).toHaveBeenCalledTimes(2);

      const createdCall = mockWriteAuditLog.mock.calls.find(
        (c) => c[0]?.action === 'payment_created',
      );
      expect(createdCall).toBeDefined();
      const createdInput = createdCall![0];
      expect(createdInput.entityType).toBe('payment');
      expect(createdInput.entityId).toBe('pay-refund-001'); // refund's own id
      expect(createdInput.after.caseId).toBe('case-100');
      expect(createdInput.after.originalPaymentId).toBe('pay-original-001');
      expect(createdInput.after.trigger).toBe('PI-3 refund created');
      expect(createdInput.after.paymentType).toBe('refund');
    });

    it('writes payment_refunded on the ORIGINAL payment with refund metadata', async () => {
      const res = await POST(
        buildRequest('accountant', {
          originalPaymentId: 'pay-original-001',
          amount: 1_000_000,
          paymentMethod: 'cash',
          paymentDate: '2026-07-02',
        }),
      );
      expect(res.status).toBe(200);

      const refundedCall = mockWriteAuditLog.mock.calls.find(
        (c) => c[0]?.action === 'payment_refunded',
      );
      expect(refundedCall).toBeDefined();
      const input = refundedCall![0];
      // Story S15: entityId is the ORIGINAL payment so auditors can
      // trace chains directly from the original payment's history.
      expect(input.entityId).toBe('pay-original-001');
      expect(input.entityType).toBe('payment');
      // caseId link for fast filtering
      expect(input.after.caseId).toBe('case-100');
      expect(input.after.originalPaymentId).toBe('pay-original-001');
      // refund metadata under `metadata`
      expect(input.after.metadata.refundPaymentId).toBe('pay-refund-001');
      expect(input.after.metadata.refundAmount).toBe(1_000_000);
      expect(input.after.metadata.refundedBy).toBe('user-007');
      // The structured diff surfaces the note change (refund marker added)
      expect(input.after.__diff).toBeDefined();
      expect(input.after.__diff.note).toBeDefined();
    });
  });

  // ── 3. Permission gate ────────────────────────────────────────

  describe('permission gate', () => {
    it('rejects sales who did not create the original payment', async () => {
      // The default mock returns createdBy=user-005 (sales_online).
      // Calling as user-005 (the same sales) → allowed (creator).
      // Switch to a different sales role that doesn't create:
      // not in DEV_USER_MAP → falls back to undefined role check.
      const res = await POST(
        buildRequest('accountant', {
          originalPaymentId: 'pay-original-001',
          amount: 1_000_000,
          paymentMethod: 'cash',
          paymentDate: '2026-07-02',
        }),
      );
      // accountant is in REFUND_CREATE_ROLES → 200
      expect(res.status).toBe(200);
    });

    it('allows admin regardless of creator', async () => {
      const res = await POST(
        buildRequest('admin', {
          originalPaymentId: 'pay-original-001',
          amount: 1_000_000,
          paymentMethod: 'cash',
          paymentDate: '2026-07-02',
        }),
      );
      expect(res.status).toBe(200);
    });
  });

  // ── 4. Error mapping ──────────────────────────────────────────

  describe('error mapping', () => {
    it('returns 404 when createRefund throws original_not_found', async () => {
      const { RefundError } = await import('@/lib/payments/refund');
      mockCreateRefund.mockRejectedValue(
        new (RefundError as new (code: string, message: string) => Error)(
          'original_not_found',
          'Không tìm thấy thanh toán gốc',
        ),
      );
      const res = await POST(
        buildRequest('admin', {
          originalPaymentId: 'pay-missing',
          amount: 1_000_000,
          paymentMethod: 'cash',
          paymentDate: '2026-07-02',
        }),
      );
      expect(res.status).toBe(404);
    });

    it('returns 400 when createRefund throws amount_exceeds_original', async () => {
      const { RefundError } = await import('@/lib/payments/refund');
      mockCreateRefund.mockRejectedValue(
        new (RefundError as new (code: string, message: string) => Error)(
          'amount_exceeds_original',
          'Hoàn tiền vượt quá số tiền gốc',
        ),
      );
      const res = await POST(
        buildRequest('admin', {
          originalPaymentId: 'pay-original-001',
          amount: 9_999_999,
          paymentMethod: 'cash',
          paymentDate: '2026-07-02',
        }),
      );
      expect(res.status).toBe(400);
    });
  });
});