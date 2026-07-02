/**
 * Story F-CRIT-08 (Sprint 7.2) — Transactional confirm path tests.
 *
 * Acceptance criteria (mirrors SPRINT_7_2_EXECUTION_PLAN.md §6.2 + §10.2):
 *
 *  1. PAYMENT_TX flag OFF (default) — confirm uses the legacy
 *     `confirmPayment(...)` helper and writes the `payment_confirmed`
 *     audit log entry (preserving Sprint 6.1 B.3.1 + 6.4 behavior).
 *  2. PAYMENT_TX flag ON — confirm uses
 *     `confirmPaymentTransaction(...)` and writes NO `payment_confirmed`
 *     audit log entry (the transactional helper writes its own
 *     `payment_transaction_committed` entry).
 *  3. SoD guard runs BEFORE the transaction starts (R7.2-7) — when
 *     PAYMENT_TX + PAYMENT_SOD are both ON, the SoD self-confirm attempt
 *     returns 403 and the transaction is never invoked.
 *  4. Transaction abort on case_not_found — route returns 404, no
 *     `payment_confirmed` audit log written.
 *  5. Transaction abort on payment_already_processed — route returns 409.
 *  6. Transaction write_failed (other errors) — route returns 500.
 *
 * The existing `route.test.ts` covers the PAYMENT_TX=OFF paths (auth,
 * SoD, role-allow-list, happy path, etc.) — those are not duplicated
 * here. This file focuses on the new transactional path.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Module mocks ─────────────────────────────────────────────────────────

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
const mockConfirmPayment = vi.fn();
const mockConfirmPaymentTransaction = vi.fn();
const mockWriteAuditLog = vi.fn();

vi.mock('@/lib/firestore/payments', () => ({
  confirmPayment: (...args: unknown[]) => mockConfirmPayment(...args),
  getPayment: (...args: unknown[]) => mockGetPayment(...args),
}));

vi.mock('@/lib/payments/transaction', () => ({
  confirmPaymentTransaction: (...args: unknown[]) =>
    mockConfirmPaymentTransaction(...args),
  TransactionAbortError: class TransactionAbortError extends Error {
    readonly name = 'TransactionAbortError';
    readonly code: string;
    readonly stage: string;
    constructor(code: string, stage: string, message: string) {
      super(message);
      this.code = code;
      this.stage = stage;
    }
  },
}));

vi.mock('@/lib/firestore/audit', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
}));

// Story PI-3 (Sprint 7.2) — the route now calls `writePaymentAudit` which
// internally calls `writeAuditLog`. We let the real wrapper run so the
// audit log call observed by the test matches the production shape
// (transformed actor→actorId/actorName/actorRole, redacted PII, diff
// injected into `after`).
vi.mock('@/lib/audit/payment-audit', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
}));

vi.mock('@/lib/notifications/trigger', () => ({
  triggerPaymentConfirmedNotification: vi.fn(),
}));

const mockGetCase = vi.fn();
vi.mock('@/lib/firestore/cases', () => ({
  getCase: (...args: unknown[]) => mockGetCase(...args),
}));

// Dynamic import AFTER mocks
import { PATCH } from '@/app/api/payments/[id]/confirm/route';
import type { Payment, UserRole } from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────────────────

function buildPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay-001',
    caseId: 'case-001',
    customerId: 'cust-001',
    amount: 1_000_000,
    paymentMethod: 'cash',
    paymentType: 'deposit',
    paymentDate: '2026-07-01',
    status: 'pending',
    createdBy: 'user-005', // different from admin's uid
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  } as Payment;
}

const DEV_USER_MAP: Record<string, UserRole> = {
  'user-001': 'admin',
  'user-002': 'ceo',
  'user-003': 'cso',
  'user-004': 'master_sales',
  'user-005': 'sales_online',
  'user-006': 'sales_offline',
  'user-007': 'accountant',
  'user-008': 'doctor',
  'user-009': 'nurse',
  'user-010': 'coordinator',
  'user-011': 'cskh_postop',
  'user-012': 'media',
};

function userIdForRole(role: UserRole): string {
  return Object.entries(DEV_USER_MAP).find(([, r]) => r === role)![0];
}

function buildRequest(role: UserRole, paymentId: string, body: unknown): NextRequest {
  return new NextRequest(
    new Request(`http://localhost:3000/api/payments/${paymentId}/confirm`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-dev-user-id': userIdForRole(role),
      },
      body: JSON.stringify(body),
    }),
  );
}

// ─── Suite ────────────────────────────────────────────────────────────────

describe('PATCH /api/payments/[id]/confirm — Story F-CRIT-08 (transactional)', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.clearAllMocks();
    mockGetPayment.mockResolvedValue(buildPayment());
    mockConfirmPayment.mockResolvedValue(undefined);
    mockConfirmPaymentTransaction.mockResolvedValue({
      committedAt: '2026-07-01T00:00:00.000Z',
      caseId: 'case-001',
      previousStatus: 'pending',
      previousAmountPaid: 0,
      newAmountPaid: 1_000_000,
      newRemainingAmount: 9_000_000,
      newPaymentStatus: 'partial',
    });
    mockWriteAuditLog.mockResolvedValue(undefined);
    mockGetCase.mockResolvedValue({
      id: 'case-001',
      caseCode: 'CASE-001',
      totalBillAfterDiscount: 10_000_000,
      amountPaid: 0,
      remainingAmount: 10_000_000,
      paymentStatus: 'unpaid',
    });
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  // ── 1. PAYMENT_TX flag OFF (default) ──────────────────────────────

  describe('when FEATURE_PAYMENT_TX is OFF (default)', () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_FEATURE_PAYMENT_TX;
    });

    it('uses the legacy confirmPayment helper (not confirmPaymentTransaction)', async () => {
      const res = await PATCH(
        buildRequest('admin', 'pay-001', { confirmedBy: 'user-001' }),
        { params: { id: 'pay-001' } },
      );
      expect(res.status).toBe(200);
      expect(mockConfirmPayment).toHaveBeenCalledOnce();
      expect(mockConfirmPaymentTransaction).not.toHaveBeenCalled();
    });

    it('writes the legacy payment_confirmed audit log entry', async () => {
      await PATCH(buildRequest('admin', 'pay-001', { confirmedBy: 'user-001' }), {
        params: { id: 'pay-001' },
      });
      expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'payment_confirmed',
          // Story PI-3 — legacy path now goes through writePaymentAudit,
          // which lifts caseId + trigger to the top of `after`.
          after: expect.objectContaining({
            caseId: 'case-001',
            trigger: 'PI-3 legacy confirm',
          }),
        }),
      );
    });
  });

  // ── 2. PAYMENT_TX flag ON — transactional path ───────────────────

  describe('when FEATURE_PAYMENT_TX is ON', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_FEATURE_PAYMENT_TX = 'true';
    });

    it('uses confirmPaymentTransaction (not the legacy confirmPayment)', async () => {
      const res = await PATCH(
        buildRequest('admin', 'pay-001', { confirmedBy: 'user-001' }),
        { params: { id: 'pay-001' } },
      );
      expect(res.status).toBe(200);
      expect(mockConfirmPaymentTransaction).toHaveBeenCalledOnce();
      expect(mockConfirmPayment).not.toHaveBeenCalled();
    });

    it('does NOT write the legacy payment_confirmed audit log entry', async () => {
      // The transactional helper writes its own audit log; the route
      // does not duplicate it.
      await PATCH(buildRequest('admin', 'pay-001', { confirmedBy: 'user-001' }), {
        params: { id: 'pay-001' },
      });
      const legacyCalls = mockWriteAuditLog.mock.calls.filter(
        (c) => c[0]?.action === 'payment_confirmed',
      );
      expect(legacyCalls).toHaveLength(0);
    });

    it('passes the actor (uid, displayName, role) to the transaction', async () => {
      await PATCH(buildRequest('admin', 'pay-001', { confirmedBy: 'user-001' }), {
        params: { id: 'pay-001' },
      });
      const [, actor] = mockConfirmPaymentTransaction.mock.calls[0];
      expect(actor).toEqual(
        expect.objectContaining({
          uid: 'user-001',
          role: 'admin',
        }),
      );
    });

    it('passes the paymentId and confirmedBy to the transaction', async () => {
      await PATCH(
        buildRequest('admin', 'pay-001', { confirmedBy: 'user-001', note: 'ok' }),
        { params: { id: 'pay-001' } },
      );
      const [input] = mockConfirmPaymentTransaction.mock.calls[0];
      expect(input.paymentId).toBe('pay-001');
      expect(input.confirmedBy).toBe('user-001');
      expect(input.note).toBe('ok');
    });
  });

  // ── 3. SoD guard runs BEFORE the transaction (R7.2-7) ─────────────

  describe('when PAYMENT_TX + PAYMENT_SOD are both ON', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_FEATURE_PAYMENT_TX = 'true';
      process.env.NEXT_PUBLIC_FEATURE_PAYMENT_SOD = 'true';
    });

    it('rejects self-confirm with 403 and does NOT invoke the transaction', async () => {
      // admin user-001 tries to confirm a payment they themselves created.
      mockGetPayment.mockResolvedValue(buildPayment({ createdBy: 'user-001' }));

      const res = await PATCH(
        buildRequest('admin', 'pay-001', { confirmedBy: 'user-001' }),
        { params: { id: 'pay-001' } },
      );
      expect(res.status).toBe(403);
      expect(mockConfirmPaymentTransaction).not.toHaveBeenCalled();
    });

    it('writes the SoD-violation audit log when self-confirm is rejected', async () => {
      mockGetPayment.mockResolvedValue(buildPayment({ createdBy: 'user-001' }));

      await PATCH(buildRequest('admin', 'pay-001', { confirmedBy: 'user-001' }), {
        params: { id: 'pay-001' },
      });
      // Story PI-3 — SoD denial now goes through `writePaymentAudit`,
      // which nests abort metadata under `after.metadata` and lifts
      // `caseId` / `trigger` to the top level of `after`.
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'payment_confirmed',
          after: expect.objectContaining({
            caseId: 'case-001',
            trigger: 'SoD self-confirm blocked',
            metadata: expect.objectContaining({
              denied: true,
              reason: 'sod_violation',
            }),
          }),
        }),
      );
    });
  });

  // ── 4. Transaction abort on payment_not_found → 404 ──────────────

  describe('transaction abort on payment_not_found', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_FEATURE_PAYMENT_TX = 'true';
    });

    it('returns 404 when the transaction throws payment_not_found', async () => {
      const { TransactionAbortError } = await import('@/lib/payments/transaction');
      mockConfirmPaymentTransaction.mockRejectedValue(
        new (TransactionAbortError as new (code: string, stage: string, msg: string) => Error)(
          'payment_not_found',
          'payment',
          'Không tìm thấy thanh toán',
        ),
      );

      const res = await PATCH(
        buildRequest('admin', 'pay-missing', { confirmedBy: 'user-001' }),
        { params: { id: 'pay-missing' } },
      );
      expect(res.status).toBe(404);
      const json = (await res.json()) as { error: string };
      expect(json.error).toMatch(/Không tìm thấy thanh toán/);
    });
  });

  // ── 5. Transaction abort on payment_already_processed → 409 ──────

  describe('transaction abort on payment_already_processed', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_FEATURE_PAYMENT_TX = 'true';
    });

    it('returns 409 when the transaction throws payment_already_processed', async () => {
      const { TransactionAbortError } = await import('@/lib/payments/transaction');
      mockConfirmPaymentTransaction.mockRejectedValue(
        new (TransactionAbortError as new (code: string, stage: string, msg: string) => Error)(
          'payment_already_processed',
          'payment',
          'Thanh toán không ở trạng thái chờ xác nhận',
        ),
      );

      const res = await PATCH(
        buildRequest('admin', 'pay-001', { confirmedBy: 'user-001' }),
        { params: { id: 'pay-001' } },
      );
      expect(res.status).toBe(409);
      const json = (await res.json()) as { error: string };
      expect(json.error).toMatch(/không ở trạng thái chờ xác nhận/);
    });
  });

  // ── 6. Transaction abort on case_not_found → 404 ─────────────────

  describe('transaction abort on case_not_found', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_FEATURE_PAYMENT_TX = 'true';
    });

    it('returns 404 when the transaction throws case_not_found', async () => {
      const { TransactionAbortError } = await import('@/lib/payments/transaction');
      mockConfirmPaymentTransaction.mockRejectedValue(
        new (TransactionAbortError as new (code: string, stage: string, msg: string) => Error)(
          'case_not_found',
          'case',
          'Không tìm thấy hồ sơ',
        ),
      );

      const res = await PATCH(
        buildRequest('admin', 'pay-001', { confirmedBy: 'user-001' }),
        { params: { id: 'pay-001' } },
      );
      expect(res.status).toBe(404);
    });
  });

  // ── 7. Unknown transaction error → 500 ───────────────────────────

  describe('unknown transaction error', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_FEATURE_PAYMENT_TX = 'true';
    });

    it('returns 500 on write_failed (unknown) error', async () => {
      const { TransactionAbortError } = await import('@/lib/payments/transaction');
      mockConfirmPaymentTransaction.mockRejectedValue(
        new (TransactionAbortError as new (code: string, stage: string, msg: string) => Error)(
          'write_failed',
          'case',
          'Firestore is down',
        ),
      );
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const res = await PATCH(
        buildRequest('admin', 'pay-001', { confirmedBy: 'user-001' }),
        { params: { id: 'pay-001' } },
      );
      expect(res.status).toBe(500);
      const json = (await res.json()) as { error: string };
      expect(json.error).toMatch(/đã bị hủy/);
      errorSpy.mockRestore();
    });

    it('returns 500 on non-TransactionAbortError thrown from the helper', async () => {
      mockConfirmPaymentTransaction.mockRejectedValue(new Error('boom'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const res = await PATCH(
        buildRequest('admin', 'pay-001', { confirmedBy: 'user-001' }),
        { params: { id: 'pay-001' } },
      );
      expect(res.status).toBe(500);
      errorSpy.mockRestore();
    });
  });

  // ── 8. Notification fires on success in transactional mode ───────

  describe('notification on transactional success', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_FEATURE_PAYMENT_TX = 'true';
    });

    it('triggers the payment-confirmed notification on success', async () => {
      const { triggerPaymentConfirmedNotification } = await import(
        '@/lib/notifications/trigger'
      );
      await PATCH(buildRequest('admin', 'pay-001', { confirmedBy: 'user-001' }), {
        params: { id: 'pay-001' },
      });
      expect(triggerPaymentConfirmedNotification).toHaveBeenCalled();
    });
  });
});
