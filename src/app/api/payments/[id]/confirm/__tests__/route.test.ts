import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Module mocks ────────────────────────────────────────────────────────────
// These mocks MUST be registered before the route module is imported so that
// when `route.ts` loads `@/config/firebase` and `@/lib/api/auth`, those
// modules see our test-controlled values (since `isDevMode` is captured at
// module-load time).
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

const mockConfirmPayment = vi.fn();
const mockGetPayment = vi.fn();
vi.mock('@/lib/firestore/payments', () => ({
  confirmPayment: (...args: unknown[]) => mockConfirmPayment(...args),
  getPayment: (...args: unknown[]) => mockGetPayment(...args),
}));

const mockWriteAuditLog = vi.fn();
vi.mock('@/lib/firestore/audit', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
}));

// Story PI-3 (Sprint 7.2) — let the real `writePaymentAudit` run so the
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

// Dynamic import AFTER mocks so the route module picks up the mocked deps.
import { PATCH } from '@/app/api/payments/[id]/confirm/route';
import { PAYMENT_CONFIRM_ROLES } from '@/constants/permissions';
import type { Payment, UserRole } from '@/lib/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay-001',
    caseId: 'case-001',
    customerId: 'cust-001',
    amount: 1_000_000,
    paymentMethod: 'cash',
    paymentType: 'deposit',
    paymentDate: '2026-06-29',
    status: 'pending',
    createdBy: 'user-007', // default creator = accountant
    createdAt: '2026-06-29T00:00:00.000Z',
    updatedAt: '2026-06-29T00:00:00.000Z',
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

function buildRequestAsUser(
  role: UserRole,
  userId: string,
  paymentId: string,
  body: unknown,
): NextRequest {
  return new NextRequest(
    new Request(`http://localhost:3000/api/payments/${paymentId}/confirm`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-dev-user-id': userId,
      },
      body: JSON.stringify(body),
    }),
  );
}

// ─── Suite ──────────────────────────────────────────────────────────────────

/**
 * Story B.3.1 (F-CRIT-06) — Remove accountant from PAYMENT_CONFIRM_ROLES +
 * server-side Separation-of-Duties guard.
 *
 * Decision (Appendix A, Q2, locked):
 *   `PAYMENT_CONFIRM_ROLES = ['admin']` (accountant removed, always-on).
 *   Caller cannot confirm a payment they themselves created (SoD), gated
 *   behind `NEXT_PUBLIC_FEATURE_PAYMENT_SOD` (default OFF in production).
 *
 * @see docs/ux-redesign/STORY_B3_1_IMPLEMENTATION_REPORT.md
 */
describe('PATCH /api/payments/[id]/confirm — Story B.3.1 (F-CRIT-06)', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.clearAllMocks();
    // Default: payment exists in pending state, created by user-007 (accountant)
    mockGetPayment.mockResolvedValue(buildPayment());
    mockConfirmPayment.mockResolvedValue(undefined);
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

  // ── 1. Auth & permission gate ──────────────────────────────────────────────

  describe('auth gate', () => {
    it('returns 401 when x-dev-user-id is unknown', async () => {
      const request = new NextRequest(
        new Request('http://localhost:3000/api/payments/pay-001/confirm', {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            'x-dev-user-id': 'unknown-user-zzz',
          },
          body: JSON.stringify({ confirmedBy: 'user-001' }),
        }),
      );
      const res = await PATCH(request, { params: { id: 'pay-001' } });
      expect(res.status).toBe(401);
    });

    it('returns 403 when the role lacks payments:approve (e.g. media)', async () => {
      const res = await PATCH(buildRequest('media', 'pay-001', { confirmedBy: 'user-012' }), {
        params: { id: 'pay-001' },
      });
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string };
      expect(json.error).toMatch(/payments:approve/);
    });
  });

  // ── 2. Role allow-list — `accountant` removed (always on) ──────────────────

  describe('PAYMENT_CONFIRM_ROLES allow-list', () => {
    it('returns 403 when accountant attempts to confirm (Decision A: accountant removed)', async () => {
      const res = await PATCH(
        buildRequest('accountant', 'pay-001', { confirmedBy: 'user-007' }),
        { params: { id: 'pay-001' } },
      );
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string };
      expect(json.error).toMatch(/accountant/);
      // Side-effects must NOT have run — guard happens before any data mutation.
      expect(mockConfirmPayment).not.toHaveBeenCalled();
      expect(mockWriteAuditLog).not.toHaveBeenCalled();
    });

    it('returns 403 when cso attempts to confirm (only admin can)', async () => {
      // cso has `payments:approve` permission so the auth gate passes, but
      // the B.3.1 role allow-list rejects cso at the contract level.
      const res = await PATCH(
        buildRequest('cso', 'pay-001', { confirmedBy: 'user-003' }),
        { params: { id: 'pay-001' } },
      );
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string };
      expect(json.error).toMatch(/cso/);
      expect(mockConfirmPayment).not.toHaveBeenCalled();
    });

    it('returns 200 when admin confirms a payment they did not create', async () => {
      const res = await PATCH(
        buildRequest('admin', 'pay-001', { confirmedBy: 'user-001', note: 'ok' }),
        { params: { id: 'pay-001' } },
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(true);
      expect(mockConfirmPayment).toHaveBeenCalledWith(
        'pay-001',
        { confirmedBy: 'user-001', note: 'ok' },
        'user-001',
      );
      // PI-3: legacy confirm writes through writePaymentAudit, which
      // produces a `payment_confirmed` entry with __diff in after.
      expect(mockWriteAuditLog).toHaveBeenCalledOnce();
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'payment_confirmed',
          entityType: 'payment',
          after: expect.objectContaining({
            caseId: 'case-001',
            trigger: 'PI-3 legacy confirm',
          }),
        }),
      );
    });

    it('contains exactly the 1 role specified by Decision A (pin invariant)', () => {
      // If this list changes, the B.3.1 RBAC contract changes. Pin the
      // expected size so a future PR cannot silently add/remove a role
      // without updating the documented decision.
      expect(PAYMENT_CONFIRM_ROLES).toEqual(['admin']);
    });
  });

  // ── 3. SoD guard (flag OFF → no SoD check, admin can self-confirm) ────────

  describe('when FEATURE_PAYMENT_SOD is OFF (default)', () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_FEATURE_PAYMENT_SOD;
    });

    it('allows admin to self-confirm (legacy behavior preserved)', async () => {
      // admin creates a payment (use user-001 to make createdBy === actor)
      mockGetPayment.mockResolvedValue(buildPayment({ createdBy: 'user-001' }));

      const res = await PATCH(
        buildRequest('admin', 'pay-001', { confirmedBy: 'user-001' }),
        { params: { id: 'pay-001' } },
      );
      expect(res.status).toBe(200);
      expect(mockConfirmPayment).toHaveBeenCalledOnce();
      // Success audit log IS written (always on for successful confirms).
      expect(mockWriteAuditLog).toHaveBeenCalledOnce();
      // But the SoD-denied shape (`denied: true`) must NOT appear — the
      // flag is OFF, so no SoD audit log was produced.
      const deniedCalls = mockWriteAuditLog.mock.calls.filter(
        (call) => (call[0] as { after?: { denied?: boolean } })?.after?.denied === true,
      );
      expect(deniedCalls).toHaveLength(0);
    });
  });

  // ── 4. SoD guard (flag ON → self-confirm rejected with 403 + audit log) ───

  describe('when FEATURE_PAYMENT_SOD is ON', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_FEATURE_PAYMENT_SOD = 'true';
    });

    it('returns 403 when admin attempts to confirm their own payment', async () => {
      // admin user-001 creates a payment and tries to confirm it themselves.
      mockGetPayment.mockResolvedValue(buildPayment({ createdBy: 'user-001' }));

      const res = await PATCH(
        buildRequest('admin', 'pay-001', { confirmedBy: 'user-001' }),
        { params: { id: 'pay-001' } },
      );
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string };
      expect(json.error).toMatch(/phân tách nhiệm vụ|SoD/i);
      // Side-effects must NOT have run.
      expect(mockConfirmPayment).not.toHaveBeenCalled();
    });

    it('writes a structured SoD-violation audit log on denial', async () => {
      mockGetPayment.mockResolvedValue(buildPayment({ createdBy: 'user-001' }));

      await PATCH(buildRequest('admin', 'pay-001', { confirmedBy: 'user-001' }), {
        params: { id: 'pay-001' },
      });

      // Story PI-3 (Sprint 7.2) — the SoD denial audit now goes through
      // `writePaymentAudit`, which surfaces the abort metadata under
      // `after.metadata` and lifts `caseId` to the top of `after`.
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'user-001',
          actorRole: 'admin',
          action: 'payment_confirmed',
          entityType: 'payment',
          entityId: 'pay-001',
          before: expect.objectContaining({
            status: 'pending',
            createdBy: 'user-001',
          }),
          after: expect.objectContaining({
            caseId: 'case-001',
            metadata: expect.objectContaining({
              denied: true,
              reason: 'sod_violation',
              attemptedBy: 'user-001',
            }),
          }),
        }),
      );
    });

    it('returns 200 when a different admin confirms an admin-created payment', async () => {
      // Created by user-001 (admin), confirmed by user-001b (different admin).
      // The DEV_USER_MAP only has one admin slot (user-001), so simulate a
      // different admin by sending x-dev-user-id that resolves to a user
      // whose `requirePermission('payments:approve')` succeeds AND whose
      // createdBy != uid. We patch the mock to return a payment created by
      // a different user and confirm from user-001.
      mockGetPayment.mockResolvedValue(buildPayment({ createdBy: 'user-007' })); // created by accountant

      const res = await PATCH(
        buildRequest('admin', 'pay-001', { confirmedBy: 'user-001' }),
        { params: { id: 'pay-001' } },
      );
      expect(res.status).toBe(200);
      expect(mockConfirmPayment).toHaveBeenCalledOnce();
    });

    it('does NOT write SoD audit log when admin confirms another user\'s payment', async () => {
      // payment created by user-007 (accountant); admin user-001 confirms.
      mockGetPayment.mockResolvedValue(buildPayment({ createdBy: 'user-007' }));

      await PATCH(buildRequest('admin', 'pay-001', { confirmedBy: 'user-001' }), {
        params: { id: 'pay-001' },
      });

      // The denial-audit log shape (`denied: true`) must NOT appear.
      const deniedCalls = mockWriteAuditLog.mock.calls.filter(
        (call) => (call[0] as { after?: { denied?: boolean } })?.after?.denied === true,
      );
      expect(deniedCalls).toHaveLength(0);
      // The success audit log is written once.
      expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'user-001',
          action: 'payment_confirmed',
          // PI-3: structured diff surfaces the confirmedBy change inline.
          after: expect.objectContaining({
            caseId: 'case-001',
            __diff: expect.objectContaining({
              confirmedBy: { from: undefined, to: 'user-001' },
            }),
          }),
        }),
      );
    });
  });

  // ── 5. Misc ────────────────────────────────────────────────────────────────

  describe('misc', () => {
    it('returns 404 when the payment does not exist', async () => {
      mockGetPayment.mockResolvedValue(null);
      const res = await PATCH(buildRequest('admin', 'missing', { confirmedBy: 'user-001' }), {
        params: { id: 'missing' },
      });
      expect(res.status).toBe(404);
      expect(mockConfirmPayment).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid request body (missing confirmedBy)', async () => {
      const res = await PATCH(buildRequest('admin', 'pay-001', { note: 'no confirmedBy' }), {
        params: { id: 'pay-001' },
      });
      expect(res.status).toBe(400);
      expect(mockConfirmPayment).not.toHaveBeenCalled();
    });

    it('returns 500 if the underlying confirmPayment throws (non-SoD, non-zod error)', async () => {
      mockConfirmPayment.mockRejectedValue(new Error('firestore blew up'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const res = await PATCH(
        buildRequest('admin', 'pay-001', { confirmedBy: 'user-001' }),
        { params: { id: 'pay-001' } },
      );
      expect(res.status).toBe(500);
      const json = (await res.json()) as { error: string };
      expect(json.error).toMatch(/Không thể xác nhận thanh toán/);
      errorSpy.mockRestore();
    });

    it('checks SoD AFTER loading the payment (404 wins over SoD)', async () => {
      // If the payment doesn't exist, we return 404 before evaluating SoD.
      process.env.NEXT_PUBLIC_FEATURE_PAYMENT_SOD = 'true';
      mockGetPayment.mockResolvedValue(null);
      const res = await PATCH(buildRequest('admin', 'missing', { confirmedBy: 'user-001' }), {
        params: { id: 'missing' },
      });
      expect(res.status).toBe(404);
      // No SoD audit log written for missing payment.
      expect(mockWriteAuditLog).not.toHaveBeenCalled();
    });
  });
});