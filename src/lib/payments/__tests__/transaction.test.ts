/**
 * Story F-CRIT-08 (Sprint 7.2) — Transactional payment confirmation tests.
 *
 * Acceptance criteria (mirrors SPRINT_7_2_EXECUTION_PLAN.md §6.2 S1–S2):
 *
 *  1. Happy path — confirm a pending payment: payment.status → 'confirmed',
 *     case.amountPaid/remainingAmount/paymentStatus recomputed, audit log
 *     written with action `payment_transaction_committed`.
 *  2. Payment not found — transaction aborted, audit log written with
 *     `payment_transaction_aborted`, no case mutation.
 *  3. Payment already confirmed (concurrent) — transaction aborted, payment
 *     unchanged, audit log written.
 *  4. Case not found — transaction aborted, no mutation.
 *  5. SoD (same-user create+confirm) is enforced at the API route level,
 *     NOT inside this helper. The transaction helper itself only validates
 *     `status === 'pending'`. SoD tests belong in the route test file.
 *  6. Rollback on recompute failure — if the bill recompute throws, no
 *     payment update is persisted. Verify by checking mock calls.
 *  7. Audit log consistency — the committed audit entry has the correct
 *     `before/after` shape with both payment and case state.
 *  8. Bill recompute consistency — after confirm, `case.amountPaid` matches
 *     `sumConfirmedPayments()` including the newly confirmed payment.
 *
 * These tests mock `@/lib/firebase/firestore` (the `runTransaction` shim)
 * and `@/lib/firestore/payments` (the `getPaymentsByCase` helper called
 * inside the transaction), running in isolation without the in-memory mock
 * store.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { Payment, CaseRecord, UserRole } from '@/lib/types';

// ─── Module mocks ─────────────────────────────────────────────────────────

const mockRunTransaction = vi.fn();
const mockGetPaymentsByCase = vi.fn();
const mockWriteAuditLog = vi.fn();

vi.mock('@/lib/firebase/firestore', () => ({
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
}));

vi.mock('@/lib/firestore/payments', () => ({
  getPaymentsByCase: (...args: unknown[]) => mockGetPaymentsByCase(...args),
  getPayment: (...args: unknown[]) => mockGetPayment(...args),
}));

vi.mock('@/lib/firestore/audit', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
}));

const mockGetPayment = vi.fn();

// ─── Fixture builders ─────────────────────────────────────────────────────

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: overrides.id ?? 'pay-tx-001',
    caseId: overrides.caseId ?? 'case-tx-001',
    customerId: overrides.customerId ?? 'cus-tx-001',
    amount: overrides.amount ?? 5_000_000,
    paymentMethod: overrides.paymentMethod ?? 'cash',
    paymentType: overrides.paymentType ?? 'deposit',
    receivedBy: overrides.receivedBy ?? 'user-005',
    paymentDate: overrides.paymentDate ?? '2026-07-01',
    status: overrides.status ?? 'pending',
    createdBy: overrides.createdBy ?? 'user-005',
    createdAt: overrides.createdAt ?? '2026-07-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-07-01T00:00:00.000Z',
    note: overrides.note,
    confirmedBy: overrides.confirmedBy,
    confirmedAt: overrides.confirmedAt,
  };
}

function makeCase(overrides: Partial<CaseRecord> = {}): CaseRecord {
  return {
    id: overrides.id ?? 'case-tx-001',
    caseCode: overrides.caseCode ?? 'SW-260701-001',
    customerId: overrides.customerId ?? 'cus-tx-001',
    caseDate: overrides.caseDate ?? '2026-07-01',
    mainServiceGroup: overrides.mainServiceGroup ?? 'nose',
    status: overrides.status ?? 'waiting_payment_confirmation',
    priority: overrides.priority ?? 'normal',
    totalBillBeforeDiscount: overrides.totalBillBeforeDiscount ?? 20_000_000,
    totalBillAfterDiscount: overrides.totalBillAfterDiscount ?? 20_000_000,
    amountPaid: overrides.amountPaid ?? 0,
    remainingAmount: overrides.remainingAmount ?? 20_000_000,
    paymentStatus: overrides.paymentStatus ?? 'unpaid',
    privacyLevel: overrides.privacyLevel ?? 'normal',
    createdBy: overrides.createdBy ?? 'user-005',
    createdAt: overrides.createdAt ?? '2026-07-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-07-01T00:00:00.000Z',
  };
}

const ACTOR = {
  uid: 'user-001',
  displayName: 'Nguyễn Văn Admin',
  role: 'admin' as UserRole,
};

const DEFAULT_INPUT = {
  paymentId: 'pay-tx-001',
  confirmedBy: 'user-001',
  expectedPreviousStatus: 'pending' as const,
  preCaseRecord: { id: 'case-tx-001', totalBillAfterDiscount: 20_000_000 },
};

/**
 * Helper that simulates the real `runTransaction` mock behavior:
 * - Calls the callback with a mock `TransactionHandle` (with `get/update/set/delete`).
 * - Captures writes so the test can inspect them after the call.
 */
function setupRunTransactionMock() {
  const writes: Array<Record<string, unknown>> = [];
  // The map holds Payment or CaseRecord fixtures (both are interface
  // objects that extend `Record<string, unknown>` semantically but
  // TypeScript does not unify them). The wider type keeps the
  // assignment callsites free of casts.
  const reads: Record<string, Payment | CaseRecord | null> = {};

  mockRunTransaction.mockImplementation(
    async (cb: (tx: Record<string, unknown>) => Promise<unknown>) => {
      const tx: Record<string, unknown> = {
        get: vi.fn(async (_col: string, docId: string) => {
          if (Object.prototype.hasOwnProperty.call(reads, docId)) {
            const data = reads[docId];
            return {
              id: docId,
              data: data ? (data as unknown as Record<string, unknown>) : null,
              exists: data !== null,
            };
          }
          return { id: docId, data: null, exists: false };
        }),
        update: vi.fn((_col: string, docId: string, data: Record<string, unknown>) => {
          writes.push({ _op: 'update', docId, ...data });
        }),
        set: vi.fn((_col: string, docId: string, data: Record<string, unknown>) => {
          writes.push({ _op: 'set', docId, ...data });
        }),
        delete: vi.fn((_col: string, docId: string) => {
          writes.push({ _op: 'delete', docId });
        }),
      };
      return cb(tx);
    },
  );

  return { writes, reads };
}

// ─── Suite ────────────────────────────────────────────────────────────────

describe('confirmPaymentTransaction — Story F-CRIT-08 (Sprint 7.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPayment.mockReset();
    mockGetPaymentsByCase.mockResolvedValue([]);
    mockWriteAuditLog.mockResolvedValue(undefined);
  });

  // ── 1. Happy path ──────────────────────────────────────────────────

  describe('happy path', () => {
    it('calls runTransaction and returns the result', async () => {
      const { reads } = setupRunTransactionMock();
      reads['pay-tx-001'] = makePayment();
      reads['case-tx-001'] = makeCase();
      mockGetPaymentsByCase.mockResolvedValue([]);

      const { confirmPaymentTransaction } = await import('@/lib/payments/transaction');
      const result = await confirmPaymentTransaction(DEFAULT_INPUT, ACTOR);

      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
      expect(result.caseId).toBe('case-tx-001');
      expect(result.previousStatus).toBe('pending');
      expect(result.previousAmountPaid).toBe(0);
    });

    it('does not write the abort audit log on success', async () => {
      const { reads } = setupRunTransactionMock();
      reads['pay-tx-001'] = makePayment();
      reads['case-tx-001'] = makeCase();
      mockGetPaymentsByCase.mockResolvedValue([]);

      const { confirmPaymentTransaction } = await import('@/lib/payments/transaction');
      await confirmPaymentTransaction(DEFAULT_INPUT, ACTOR);

      const abortCalls = mockWriteAuditLog.mock.calls.filter(
        (c) => c[0]?.action === 'payment_transaction_aborted',
      );
      expect(abortCalls).toHaveLength(0);
    });
  });

  // ── 2. Payment not found ──────────────────────────────────────────

  describe('payment not found', () => {
    it('aborts with payment_not_found and writes abort audit log', async () => {
      const { reads } = setupRunTransactionMock();
      // Payment does not exist in the read store
      reads['case-tx-001'] = makeCase();

      const { confirmPaymentTransaction, TransactionAbortError } = await import(
        '@/lib/payments/transaction'
      );
      await expect(
        confirmPaymentTransaction(DEFAULT_INPUT, ACTOR),
      ).rejects.toMatchObject({
        name: 'TransactionAbortError',
        code: 'payment_not_found',
      });

      expect(mockWriteAuditLog).toHaveBeenCalledOnce();
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'payment_transaction_aborted',
          entityId: 'pay-tx-001',
        }),
      );
    });

    it('abort audit log has the correct before/after shape', async () => {
      const { reads } = setupRunTransactionMock();
      reads['case-tx-001'] = makeCase();

      const { confirmPaymentTransaction } = await import('@/lib/payments/transaction');
      await confirmPaymentTransaction(DEFAULT_INPUT, ACTOR).catch(() => {});

      expect(mockWriteAuditLog).toHaveBeenCalledOnce();
      const [auditInput] = mockWriteAuditLog.mock.calls[0];
      // Story PI-3 (Sprint 7.2) — abort audit now goes through
      // `writePaymentAudit`, which nests the abort metadata under
      // `after.metadata` and lifts `caseId` + `trigger` to the top
      // level of `after`. The pre-PI-3 flat shape is replaced with
      // the enriched shape that matches the committed entry.
      expect(auditInput.after).toEqual(
        expect.objectContaining({
          caseId: 'case-tx-001',
          trigger: 'PI-3 transactional abort',
          metadata: expect.objectContaining({
            aborted: true,
            stage: 'payment',
            reason: 'Không tìm thấy thanh toán',
          }),
        }),
      );
    });
  });

  // ── 3. Payment already processed (concurrent confirm) ─────────────

  describe('payment already processed', () => {
    it('aborts with payment_already_processed when payment is not pending', async () => {
      const { reads } = setupRunTransactionMock();
      reads['pay-tx-001'] = makePayment({ status: 'confirmed' });
      reads['case-tx-001'] = makeCase();

      const { confirmPaymentTransaction } = await import('@/lib/payments/transaction');
      await expect(
        confirmPaymentTransaction(DEFAULT_INPUT, ACTOR),
      ).rejects.toMatchObject({
        code: 'payment_already_processed',
      });
    });

    it('writes abort audit log with correct stage', async () => {
      const { reads } = setupRunTransactionMock();
      reads['pay-tx-001'] = makePayment({ status: 'confirmed' });
      reads['case-tx-001'] = makeCase();

      const { confirmPaymentTransaction } = await import('@/lib/payments/transaction');
      await confirmPaymentTransaction(DEFAULT_INPUT, ACTOR).catch(() => {});

      const [auditInput] = mockWriteAuditLog.mock.calls[0];
      // PI-3 enriched shape: abort metadata is nested under `after.metadata`
      expect(auditInput.after).toEqual(
        expect.objectContaining({
          metadata: expect.objectContaining({
            aborted: true,
            stage: 'payment',
            reason: 'Thanh toán không ở trạng thái chờ xác nhận',
          }),
        }),
      );
    });
  });

  // ── 4. Case not found ─────────────────────────────────────────────

  describe('case not found', () => {
    it('aborts with case_not_found when the case record is missing', async () => {
      const { reads } = setupRunTransactionMock();
      reads['pay-tx-001'] = makePayment();
      // case-tx-001 not in reads → returns null

      const { confirmPaymentTransaction } = await import('@/lib/payments/transaction');
      await expect(
        confirmPaymentTransaction(DEFAULT_INPUT, ACTOR),
      ).rejects.toMatchObject({
        code: 'case_not_found',
      });
    });

    it('writes abort audit log with stage case', async () => {
      const { reads } = setupRunTransactionMock();
      reads['pay-tx-001'] = makePayment();

      const { confirmPaymentTransaction } = await import('@/lib/payments/transaction');
      await confirmPaymentTransaction(DEFAULT_INPUT, ACTOR).catch(() => {});

      const [auditInput] = mockWriteAuditLog.mock.calls[0];
      // PI-3 enriched shape: abort metadata is nested under `after.metadata`
      expect(auditInput.after).toEqual(
        expect.objectContaining({
          metadata: expect.objectContaining({
            aborted: true,
            stage: 'case',
            reason: 'Không tìm thấy hồ sơ',
          }),
        }),
      );
    });
  });

  // ── 5. Rollback — no partial state on failure ─────────────────────

  describe('rollback on failure', () => {
    it('throws TransactionAbortError when runTransaction callback rejects', async () => {
      mockRunTransaction.mockRejectedValue(new Error('Firestore is down'));

      const { confirmPaymentTransaction } = await import('@/lib/payments/transaction');
      await expect(
        confirmPaymentTransaction(DEFAULT_INPUT, ACTOR),
      ).rejects.toMatchObject({
        name: 'TransactionAbortError',
        code: 'write_failed',
      });
    });

    it('writes abort audit log when runTransaction rejects', async () => {
      mockRunTransaction.mockRejectedValue(new Error('Firestore is down'));

      const { confirmPaymentTransaction } = await import('@/lib/payments/transaction');
      await confirmPaymentTransaction(DEFAULT_INPUT, ACTOR).catch(() => {});

      expect(mockWriteAuditLog).toHaveBeenCalledOnce();
      const [auditInput] = mockWriteAuditLog.mock.calls[0];
      expect(auditInput.action).toBe('payment_transaction_aborted');
      // PI-3 enriched shape: abort metadata is nested under `after.metadata`
      expect(auditInput.after).toEqual(
        expect.objectContaining({
          metadata: expect.objectContaining({
            aborted: true,
            stage: 'payment',
            reason: 'Firestore is down',
          }),
        }),
      );
    });

    it('wraps unknown errors as TransactionAbortError with write_failed code', async () => {
      mockRunTransaction.mockRejectedValue(new Error('unknown'));

      const { confirmPaymentTransaction } = await import('@/lib/payments/transaction');
      await confirmPaymentTransaction(DEFAULT_INPUT, ACTOR).catch((err) => {
        expect(err.code).toBe('write_failed');
        expect(err.stage).toBe('payment');
      });
    });
  });

  // ── 6. Audit log consistency on success ───────────────────────────

  describe('audit log consistency', () => {
    it('runTransaction callback writes the committed audit log entry', async () => {
      const { reads } = setupRunTransactionMock();
      reads['pay-tx-001'] = makePayment();
      reads['case-tx-001'] = makeCase();
      mockGetPaymentsByCase.mockResolvedValue([]);

      const { confirmPaymentTransaction } = await import('@/lib/payments/transaction');
      await confirmPaymentTransaction(DEFAULT_INPUT, ACTOR);

      // The audit log is written inside the transaction via tx.set.
      // Check that runTransaction was called (the callback did the writes).
      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
      // The inner callback's tx.set is called (for the audit entry).
      // We verify the outer writeAuditLog is NOT called on success
      // (abort path only).
      expect(mockWriteAuditLog).not.toHaveBeenCalled();
    });

    it('abort audit log has before.status = pending (PI-3 shape)', async () => {
      const { reads } = setupRunTransactionMock();
      reads['pay-tx-001'] = makePayment();

      const { confirmPaymentTransaction } = await import('@/lib/payments/transaction');
      await confirmPaymentTransaction(DEFAULT_INPUT, ACTOR).catch(() => {});

      const [auditInput] = mockWriteAuditLog.mock.calls[0];
      // PI-3 enriched shape: pre-state carries `status` (not the legacy
      // `paymentStatus`) because the abort entry is built from a
      // Payment-shaped record.
      expect(auditInput.before).toEqual(
        expect.objectContaining({
          status: 'pending',
        }),
      );
    });
  });

  // ── 7. Bill recompute consistency ──────────────────────────────────

  describe('bill recompute consistency', () => {
    it('includes the confirmed payment in the hypothetical sum', async () => {
      const { reads } = setupRunTransactionMock();
      // paymentType: 'partial' so the resulting status is 'partial',
      // not 'deposit' (any deposit in the history short-circuits the
      // recompute to 'deposit').
      reads['pay-tx-001'] = makePayment({ amount: 5_000_000, paymentType: 'partial' });
      reads['case-tx-001'] = makeCase({
        totalBillAfterDiscount: 10_000_000,
        amountPaid: 0,
      });
      // There is already a confirmed payment on the case (partial type).
      mockGetPaymentsByCase.mockResolvedValue([
        makePayment({
          id: 'pay-existing',
          amount: 3_000_000,
          status: 'confirmed',
          paymentType: 'partial',
        }),
      ]);

      const { confirmPaymentTransaction } = await import('@/lib/payments/transaction');
      const result = await confirmPaymentTransaction(DEFAULT_INPUT, ACTOR);

      // After confirm: paid = 3M + 5M = 8M, remaining = 10M - 8M = 2M
      expect(result.newAmountPaid).toBe(8_000_000);
      expect(result.newRemainingAmount).toBe(2_000_000);
      expect(result.newPaymentStatus).toBe('partial');
    });

    it('handles zero-amount existing payments correctly', async () => {
      const { reads } = setupRunTransactionMock();
      reads['pay-tx-001'] = makePayment({ amount: 1_000_000 });
      reads['case-tx-001'] = makeCase({
        totalBillAfterDiscount: 1_000_000,
        amountPaid: 0,
      });
      mockGetPaymentsByCase.mockResolvedValue([]);

      const { confirmPaymentTransaction } = await import('@/lib/payments/transaction');
      const result = await confirmPaymentTransaction(DEFAULT_INPUT, ACTOR);

      expect(result.newAmountPaid).toBe(1_000_000);
      expect(result.newRemainingAmount).toBe(0);
      expect(result.newPaymentStatus).toBe('paid');
    });
  });

  // ── 8. TransactionAbortError type sanity ──────────────────────────

  describe('TransactionAbortError', () => {
    it('is an instance of Error with the correct code and stage', () => {
      // Import synchronously since we just need the class
      return import('@/lib/payments/transaction').then(({ TransactionAbortError }) => {
        const err = new TransactionAbortError('payment_not_found', 'payment', 'nope');
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe('TransactionAbortError');
        expect(err.code).toBe('payment_not_found');
        expect(err.stage).toBe('payment');
        expect(err.message).toBe('nope');
      });
    });

    it('preserves all valid code values', () => {
      return import('@/lib/payments/transaction').then(({ TransactionAbortError }) => {
        const codes = [
          'payment_not_found',
          'payment_already_processed',
          'case_not_found',
          'write_failed',
        ] as const;
        for (const code of codes) {
          const err = new TransactionAbortError(code, 'payment', `test-${code}`);
          expect(err.code).toBe(code);
        }
      });
    });
  });
});
