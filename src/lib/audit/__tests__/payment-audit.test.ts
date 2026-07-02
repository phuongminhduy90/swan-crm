/**
 * Story PI-3 (Sprint 7.2) — Payment audit enrichment tests.
 *
 * Acceptance criteria (mirrors SPRINT_7_2_EXECUTION_PLAN.md §6.2 S14 + S15,
 * and §10.5 of the manual QA checklist):
 *
 *  1. `buildPaymentDiff` returns changed/unchanged keys correctly.
 *  2. `buildPaymentDiff` orders changed fields per DIFFABLE_PAYMENT_FIELDS.
 *  3. `deriveStateTransition` returns null when status is unchanged.
 *  4. `deriveStateTransition` returns { from: 'none', to: <status> } for
 *     newly created payments.
 *  5. `buildPaymentAuditEntry` redacts the same PII fields as B.2.3
 *     (`medicalNote`, `privacyNote`, `nationalIdNumber`).
 *  6. `buildPaymentAuditEntry` includes `__diff` in the `after` payload
 *     when fields changed (S14).
 *  7. `buildPaymentAuditEntry` includes `originalPaymentId` for refund
 *     actions (S15).
 *  8. `buildPaymentAuditEntry` includes `caseId` for fast filtering.
 *  9. `buildPaymentAuditEntry` includes `caseBill` when supplied.
 * 10. `buildPaymentAuditEntry` tolerates null/undefined before & after
 *     without throwing.
 * 11. `writePaymentAudit` writes through `writeAuditLog` with redacted
 *     payloads.
 * 12. `txWritePaymentAudit` writes through `tx.set` with the same payload
 *     shape — preserving F-CRIT-08's transactional path semantics.
 * 13. `txWritePaymentAudit` returns the generated audit id for
 *     correlation.
 * 14. Unknown fields beyond DIFFABLE_PAYMENT_FIELDS still appear in the
 *     diff (sorted alphabetically), so future payment fields are not
 *     silently dropped.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Payment, UserRole } from '@/lib/types';

// ─── Module mocks ────────────────────────────────────────────────────────

const mockWriteAuditLog = vi.fn();

vi.mock('@/lib/firestore/audit', () => ({
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
  redactPiiFields: (payload: Record<string, unknown> | null | undefined) => {
    // Inline reproduction of the B.2.3 redaction contract so the test
    // doesn't need to mock the real implementation. If the real
    // `redactPiiFields` diverges from this, the diff-view test (S14)
    // would silently fail and the production UI would show raw PII.
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return undefined;
    }
    const PLACEHOLDER = '[ĐÃ ẨN]';
    const REDACTED = ['medicalNote', 'privacyNote', 'nationalIdNumber'];
    const out: Record<string, unknown> = { ...payload };
    for (const k of REDACTED) {
      if (Object.prototype.hasOwnProperty.call(out, k)) {
        out[k] = PLACEHOLDER;
      }
    }
    return out;
  },
}));

// Dynamic import AFTER mocks so the module sees our mocked `writeAuditLog`.
import {
  buildPaymentDiff,
  deriveStateTransition,
  buildPaymentAuditEntry,
  writePaymentAudit,
  txWritePaymentAudit,
  DIFFABLE_PAYMENT_FIELDS,
} from '@/lib/audit/payment-audit';

// ─── Fixture builders ────────────────────────────────────────────────────

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: overrides.id ?? 'pay-001',
    caseId: overrides.caseId ?? 'case-001',
    customerId: overrides.customerId ?? 'cust-001',
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

const ACTOR = {
  uid: 'user-001',
  displayName: 'Nguyễn Văn Admin',
  role: 'admin' as UserRole,
};

// ─── Suite ───────────────────────────────────────────────────────────────

describe('PI-3 payment audit enrichment', () => {
  beforeEach(() => {
    mockWriteAuditLog.mockReset();
    mockWriteAuditLog.mockResolvedValue(undefined);
  });

  // ── 1. buildPaymentDiff: changed vs unchanged ──────────────────────

  describe('buildPaymentDiff', () => {
    it('reports only the changed fields', () => {
      const before = makePayment({ status: 'pending' });
      const after = makePayment({ status: 'confirmed', confirmedBy: 'user-001' });

      const diff = buildPaymentDiff(before, after);

      expect(Object.keys(diff.changed).sort()).toEqual(
        ['confirmedBy', 'status'].sort(),
      );
      expect(diff.changed.status).toEqual({ from: 'pending', to: 'confirmed' });
      expect(diff.changed.confirmedBy).toEqual({
        from: undefined,
        to: 'user-001',
      });
    });

    it('orders changed fields per DIFFABLE_PAYMENT_FIELDS', () => {
      const before = makePayment({
        status: 'pending',
        note: 'old note',
        amount: 1_000_000,
        paymentMethod: 'cash',
      });
      const after = makePayment({
        status: 'confirmed',
        note: 'new note',
        amount: 2_000_000,
        paymentMethod: 'card',
      });

      const diff = buildPaymentDiff(before, after);
      const orderedKeys = Object.keys(diff.changed);

      // The first 4 changed keys (status, paymentMethod, amount, note)
      // must appear in the DIFFABLE_PAYMENT_FIELDS order — not the order
      // they appeared in the input records.
      const knownKeysInOrder = DIFFABLE_PAYMENT_FIELDS.filter((k) =>
        diff.changed[k as keyof typeof diff.changed],
      );
      expect(orderedKeys).toEqual(knownKeysInOrder);
    });

    it('reports empty diff when before === after', () => {
      const payment = makePayment();
      const diff = buildPaymentDiff(payment, payment);
      expect(diff.changed).toEqual({});
      expect(diff.unchanged.length).toBeGreaterThan(0);
    });

    it('handles null before (new payment) and null after (deletion)', () => {
      // Use a payment with NO optional fields populated so the diff
      // surfaces every populated key (otherwise `note`/`confirmedBy`/
      // `confirmedAt` are `undefined` on both sides and "unchanged").
      const payment = makePayment({
        note: 'initial note',
        confirmedBy: 'user-001',
        confirmedAt: '2026-07-01T00:00:00.000Z',
      });

      // null → payment: every populated field in `after` is "new"
      // relative to the missing before, so the populated keys land in
      // `changed`.
      const fromNull = buildPaymentDiff(null, payment);
      expect(fromNull.changed).toEqual(
        expect.objectContaining({
          note: { from: undefined, to: 'initial note' },
          confirmedBy: { from: undefined, to: 'user-001' },
          status: { from: undefined, to: 'pending' },
        }),
      );

      // payment → null: symmetric — every populated field in `before`
      // is "removed" relative to the missing after.
      const toNull = buildPaymentDiff(payment, null);
      expect(toNull.changed).toEqual(
        expect.objectContaining({
          note: { from: 'initial note', to: undefined },
          confirmedBy: { from: 'user-001', to: undefined },
          status: { from: 'pending', to: undefined },
        }),
      );
    });

    it('handles both null/undefined (no-op)', () => {
      const diff = buildPaymentDiff(null, undefined);
      expect(diff.changed).toEqual({});
      expect(diff.unchanged).toEqual([]);
    });

    it('still diffs unknown fields beyond DIFFABLE_PAYMENT_FIELDS (alphabetical)', () => {
      const before = makePayment({ note: 'A' } as Partial<Payment>);
      (before as Record<string, unknown>).customField = 'old';
      (before as Record<string, unknown>).zLastField = 1;
      (before as Record<string, unknown>).aFirstField = 'foo';

      const after = makePayment({ note: 'A' } as Partial<Payment>);
      (after as Record<string, unknown>).customField = 'new';
      (after as Record<string, unknown>).zLastField = 2;
      (after as Record<string, unknown>).aFirstField = 'bar';

      const diff = buildPaymentDiff(before, after);
      // Unknown fields (not in DIFFABLE_PAYMENT_FIELDS) appear in
      // alphabetical order at the end.
      const unknownKeys = Object.keys(diff.changed).filter(
        (k) => !DIFFABLE_PAYMENT_FIELDS.includes(k),
      );
      expect(unknownKeys).toEqual(['aFirstField', 'customField', 'zLastField']);
    });

    it('uses deep equality (arrays + nested objects)', () => {
      const before = makePayment();
      (before as Record<string, unknown>).tags = ['a', 'b'];
      const after = makePayment();
      (after as Record<string, unknown>).tags = ['a', 'b'];

      const diff = buildPaymentDiff(before, after);
      expect(diff.changed.tags).toBeUndefined();
      expect(diff.unchanged).toContain('tags');
    });
  });

  // ── 2. deriveStateTransition ────────────────────────────────────────

  describe('deriveStateTransition', () => {
    it('returns null when both statuses are equal', () => {
      const t = deriveStateTransition(
        makePayment({ status: 'pending' }),
        makePayment({ status: 'pending' }),
        ACTOR,
      );
      expect(t).toBeNull();
    });

    it("returns { from: 'none', to: <status> } for new payments", () => {
      const t = deriveStateTransition(
        null,
        makePayment({ status: 'pending' }),
        ACTOR,
      );
      expect(t).toEqual(
        expect.objectContaining({
          from: 'none',
          to: 'pending',
          actor: ACTOR,
        }),
      );
    });

    it("returns { from, to } with a non-equal transition", () => {
      const t = deriveStateTransition(
        makePayment({ status: 'pending' }),
        // Override updatedAt so `deriveStateTransition`'s preference order
        // (`updatedAt ?? confirmedAt ?? now`) yields the explicit time.
        makePayment({
          status: 'confirmed',
          confirmedAt: '2026-07-02T00:00:00.000Z',
          updatedAt: '2026-07-02T00:00:01.000Z',
        }),
        ACTOR,
        'Đã xác nhận',
      );
      expect(t).toEqual({
        from: 'pending',
        to: 'confirmed',
        at: '2026-07-02T00:00:01.000Z',
        actor: ACTOR,
        note: 'Đã xác nhận',
      });
    });

    it('returns null when both before and after are null', () => {
      expect(deriveStateTransition(null, null, ACTOR)).toBeNull();
    });
  });

  // ── 3. buildPaymentAuditEntry: shape + redaction ───────────────────

  describe('buildPaymentAuditEntry', () => {
    it('redacts the same PII fields as B.2.3 (medicalNote, privacyNote, nationalIdNumber)', () => {
      const before = makePayment();
      (before as Record<string, unknown>).medicalNote = 'Tiền sử dị ứng';
      (before as Record<string, unknown>).privacyNote = 'CCCD mật';
      (before as Record<string, unknown>).nationalIdNumber = '079123456789';

      const entry = buildPaymentAuditEntry({
        action: 'payment_confirmed',
        entityId: before.id,
        actor: ACTOR,
        before,
        after: { ...before, status: 'confirmed' },
      });

      // Before is redacted
      expect((entry.before as Record<string, unknown>).medicalNote).toBe('[ĐÃ ẨN]');
      expect((entry.before as Record<string, unknown>).privacyNote).toBe('[ĐÃ ẨN]');
      expect((entry.before as Record<string, unknown>).nationalIdNumber).toBe('[ĐÃ ẨN]');
      // After is redacted (the spread carries the PII over)
      expect((entry.after as Record<string, unknown>).medicalNote).toBe('[ĐÃ ẨN]');
      expect((entry.after as Record<string, unknown>).privacyNote).toBe('[ĐÃ ẨN]');
      expect((entry.after as Record<string, unknown>).nationalIdNumber).toBe('[ĐÃ ẨN]');
    });

    it('includes __diff in the after payload (S14)', () => {
      const before = makePayment({ status: 'pending' });
      const after = makePayment({ status: 'confirmed', confirmedBy: 'user-001' });

      const entry = buildPaymentAuditEntry({
        action: 'payment_confirmed',
        entityId: before.id,
        actor: ACTOR,
        before,
        after,
      });

      const diff = (entry.after as Record<string, unknown>).__diff as Record<
        string,
        { from: unknown; to: unknown }
      >;
      expect(diff).toBeDefined();
      expect(diff.status).toEqual({ from: 'pending', to: 'confirmed' });
      expect(diff.confirmedBy).toEqual({ from: undefined, to: 'user-001' });
    });

    it('includes __stateTransition when status changed', () => {
      const before = makePayment({ status: 'pending' });
      const after = makePayment({ status: 'confirmed' });

      const entry = buildPaymentAuditEntry({
        action: 'payment_confirmed',
        entityId: before.id,
        actor: ACTOR,
        before,
        after,
      });

      const t = (entry.after as Record<string, unknown>).__stateTransition as {
        from: string;
        to: string;
      };
      expect(t.from).toBe('pending');
      expect(t.to).toBe('confirmed');
    });

    it('does NOT include __diff when nothing changed', () => {
      const payment = makePayment();
      const entry = buildPaymentAuditEntry({
        action: 'payment_confirmed',
        entityId: payment.id,
        actor: ACTOR,
        before: payment,
        after: payment,
      });

      expect((entry.after as Record<string, unknown>).__diff).toBeUndefined();
    });

    it('includes originalPaymentId for refund actions (S15)', () => {
      const refund = makePayment({ id: 'pay-refund-001', paymentType: 'refund' });
      const entry = buildPaymentAuditEntry({
        action: 'payment_refunded',
        entityId: 'pay-original-001',
        actor: ACTOR,
        after: refund,
        originalPaymentId: 'pay-original-001',
      });

      expect((entry.after as Record<string, unknown>).originalPaymentId).toBe(
        'pay-original-001',
      );
      // The refund payment id is the `after.id`, NOT the entityId —
      // the entityId is the ORIGINAL payment so auditors can trace
      // chains directly from the original.
      expect((entry.after as Record<string, unknown>).id).toBe('pay-refund-001');
      expect(entry.entityId).toBe('pay-original-001');
    });

    it('includes caseId for fast filtering', () => {
      const payment = makePayment({ caseId: 'case-abc' });
      const entry = buildPaymentAuditEntry({
        action: 'payment_created',
        entityId: payment.id,
        actor: ACTOR,
        after: payment,
        caseId: 'case-abc',
      });

      expect((entry.after as Record<string, unknown>).caseId).toBe('case-abc');
    });

    it('includes caseBill (before/after) when supplied', () => {
      const entry = buildPaymentAuditEntry({
        action: 'payment_transaction_committed',
        entityId: 'pay-001',
        actor: ACTOR,
        caseBill: {
          before: { amountPaid: 0, remainingAmount: 10_000_000, paymentStatus: 'unpaid' },
          after: { amountPaid: 5_000_000, remainingAmount: 5_000_000, paymentStatus: 'partial' },
        },
        after: makePayment({ status: 'confirmed' }),
      });

      const caseBill = (entry.after as Record<string, unknown>).caseBill as {
        before: { amountPaid: number };
        after: { amountPaid: number };
      };
      expect(caseBill.before.amountPaid).toBe(0);
      expect(caseBill.after.amountPaid).toBe(5_000_000);
    });

    it('includes trigger string when supplied', () => {
      const entry = buildPaymentAuditEntry({
        action: 'payment_transaction_committed',
        entityId: 'pay-001',
        actor: ACTOR,
        after: makePayment({ status: 'confirmed' }),
        trigger: 'PI-3 refund audit',
      });

      expect((entry.after as Record<string, unknown>).trigger).toBe(
        'PI-3 refund audit',
      );
    });

    it('tolerates null before & after without throwing', () => {
      const entry = buildPaymentAuditEntry({
        action: 'payment_transaction_aborted',
        entityId: 'pay-001',
        actor: ACTOR,
        metadata: { aborted: true, reason: 'Firestore is down', stage: 'case' },
      });

      expect(entry.before).toBeUndefined();
      expect(entry.after).toEqual(
        expect.objectContaining({
          metadata: expect.objectContaining({
            aborted: true,
            reason: 'Firestore is down',
          }),
        }),
      );
    });

    it('redacts PII inside metadata (B.2.3 consistency)', () => {
      const entry = buildPaymentAuditEntry({
        action: 'payment_rejected',
        entityId: 'pay-001',
        actor: ACTOR,
        metadata: {
          medicalNote: 'should-be-redacted',
          reason: 'amount-mismatch',
        },
      });

      const metadata = (entry.after as Record<string, unknown>).metadata as Record<
        string,
        unknown
      >;
      expect(metadata.medicalNote).toBe('[ĐÃ ẨN]');
      expect(metadata.reason).toBe('amount-mismatch');
    });

    it('explicit stateTransition overrides auto-derivation', () => {
      const customTransition = {
        from: 'rejected' as const,
        to: 'confirmed' as const,
        at: '2026-07-05T00:00:00.000Z',
        actor: ACTOR,
        note: 'Override transition',
      };

      const entry = buildPaymentAuditEntry({
        action: 'payment_confirmed',
        entityId: 'pay-001',
        actor: ACTOR,
        before: makePayment({ status: 'pending' }), // would auto-derive pending→confirmed
        after: makePayment({ status: 'confirmed' }),
        stateTransition: customTransition,
      });

      const t = (entry.after as Record<string, unknown>).__stateTransition as {
        from: string;
        to: string;
      };
      expect(t.from).toBe('rejected');
      expect(t.to).toBe('confirmed');
    });

    it('stateTransition: null skips the field even when status changes', () => {
      const entry = buildPaymentAuditEntry({
        action: 'payment_rejected',
        entityId: 'pay-001',
        actor: ACTOR,
        before: makePayment({ status: 'pending' }),
        after: makePayment({ status: 'rejected' }),
        stateTransition: null,
      });

      expect((entry.after as Record<string, unknown>).__stateTransition).toBeUndefined();
    });
  });

  // ── 4. writePaymentAudit (non-transactional wrapper) ────────────────

  describe('writePaymentAudit', () => {
    it('writes through writeAuditLog with redacted before/after', async () => {
      const before = makePayment({ status: 'pending' });
      const after = makePayment({ status: 'confirmed', confirmedBy: ACTOR.uid });

      await writePaymentAudit({
        action: 'payment_confirmed',
        entityId: before.id,
        actor: ACTOR,
        before,
        after,
        caseId: before.caseId,
        trigger: 'PI-3 legacy confirm',
      });

      expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
      const arg = mockWriteAuditLog.mock.calls[0][0] as Record<string, unknown>;
      expect(arg.action).toBe('payment_confirmed');
      expect(arg.entityType).toBe('payment');
      expect(arg.entityId).toBe(before.id);
      expect(arg.actorId).toBe(ACTOR.uid);
      // The after payload must carry the diff + caseId + trigger
      const afterPayload = arg.after as Record<string, unknown>;
      expect(afterPayload.caseId).toBe(before.caseId);
      expect(afterPayload.trigger).toBe('PI-3 legacy confirm');
      expect(afterPayload.__diff).toBeDefined();
    });

    it('calls writeAuditLog exactly once with the built entry (no double-write)', async () => {
      // Sanity guard: PI-3 must not introduce a duplicate write path.
      // The real `writeAuditLog` swallows storage errors internally so
      // the route layer never has to handle them — this test pins the
      // "exactly one call" contract so a future refactor cannot double
      // up the audit writes.
      await writePaymentAudit({
        action: 'payment_confirmed',
        entityId: 'pay-001',
        actor: ACTOR,
      });
      expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
    });
  });

  // ── 5. txWritePaymentAudit (transactional wrapper) ──────────────────

  describe('txWritePaymentAudit', () => {
    it('writes through tx.set with the same payload shape as writePaymentAudit', () => {
      const tx = {
        set: vi.fn(),
      };
      const before = makePayment({ status: 'pending' });
      const after = makePayment({ status: 'confirmed', confirmedBy: ACTOR.uid });

      const auditId = txWritePaymentAudit(tx, {
        action: 'payment_transaction_committed',
        entityId: before.id,
        actor: ACTOR,
        before,
        after,
        caseId: before.caseId,
        caseBill: {
          before: { amountPaid: 0, remainingAmount: 10_000_000, paymentStatus: 'unpaid' },
          after: { amountPaid: 5_000_000, remainingAmount: 5_000_000, paymentStatus: 'partial' },
        },
      });

      expect(typeof auditId).toBe('string');
      expect(auditId).toMatch(/^audit-/);
      expect(tx.set).toHaveBeenCalledTimes(1);

      const [collection, id, payload] = tx.set.mock.calls[0];
      expect(collection).toBe('auditLogs');
      expect(id).toBe(auditId);
      expect(payload.action).toBe('payment_transaction_committed');
      expect(payload.entityType).toBe('payment');
      expect(payload.entityId).toBe(before.id);
      expect(payload.actorId).toBe(ACTOR.uid);
      expect(payload.actorRole).toBe(ACTOR.role);
      expect(payload.id).toBe(auditId);
      expect(payload.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // The transactional write carries the same diff + caseId + caseBill
      // shape that the non-transactional path produces.
      const afterPayload = payload.after as Record<string, unknown>;
      expect(afterPayload.caseId).toBe(before.caseId);
      expect(afterPayload.caseBill).toBeDefined();
      expect(afterPayload.__diff).toBeDefined();
    });

    it('returns the audit id for cross-write correlation inside the transaction', () => {
      const tx = { set: vi.fn() };
      const auditId1 = txWritePaymentAudit(tx, {
        action: 'payment_transaction_committed',
        entityId: 'pay-001',
        actor: ACTOR,
      });
      const auditId2 = txWritePaymentAudit(tx, {
        action: 'payment_transaction_aborted',
        entityId: 'pay-002',
        actor: ACTOR,
      });
      // Different ids even though they share the same wall-clock ms.
      expect(auditId1).not.toBe(auditId2);
    });

    it('redacts PII inside the transactional payload', () => {
      const tx = { set: vi.fn() };
      const payment = makePayment();
      (payment as Record<string, unknown>).medicalNote = 'raw PII';

      txWritePaymentAudit(tx, {
        action: 'payment_confirmed',
        entityId: payment.id,
        actor: ACTOR,
        after: payment,
      });

      const [, , payload] = tx.set.mock.calls[0];
      expect((payload.after as Record<string, unknown>).medicalNote).toBe('[ĐÃ ẨN]');
    });
  });

  // ── 6. Cross-path shape parity (F-CRIT-08 invariant) ──────────────

  describe('cross-path shape parity', () => {
    it('produces the same `after` payload shape from both write paths', async () => {
      const before = makePayment({ status: 'pending' });
      const after = makePayment({ status: 'confirmed', confirmedBy: ACTOR.uid });

      // Non-transactional path
      await writePaymentAudit({
        action: 'payment_confirmed',
        entityId: before.id,
        actor: ACTOR,
        before,
        after,
        caseId: before.caseId,
      });

      // Transactional path
      const tx = { set: vi.fn() };
      txWritePaymentAudit(tx, {
        action: 'payment_transaction_committed',
        entityId: before.id,
        actor: ACTOR,
        before,
        after,
        caseId: before.caseId,
      });

      const legacyAfter = (mockWriteAuditLog.mock.calls[0][0] as { after: Record<string, unknown> }).after;
      const txAfter = (tx.set.mock.calls[0][2] as { after: Record<string, unknown> }).after;

      // The two shapes are identical (modulo `id` + `createdAt` which
      // the audit-logs UI doesn't render).
      const stripServerFields = (p: Record<string, unknown>) => {
        const out = { ...p };
        delete out.id;
        delete out.createdAt;
        return out;
      };

      expect(stripServerFields(legacyAfter)).toEqual(stripServerFields(txAfter));
    });
  });
});