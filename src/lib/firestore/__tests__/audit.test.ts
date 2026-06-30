import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Story B.2.3 (F-MED-17) — PII redaction in audit log diff.
 *
 * Acceptance criteria:
 *   - `writeAuditLog()` strips `medicalNote` from `beforeData` and `afterData`
 *   - `writeAuditLog()` strips `privacyNote` from `beforeData` and `afterData`
 *   - `writeAuditLog()` strips `nationalIdNumber` from `beforeData` and `afterData`
 *   - Non-PII fields are preserved unchanged
 *   - Redaction is idempotent — running it twice yields the same output
 *   - The redacted value is the literal placeholder `[ĐÃ ẨN]`
 *
 * @see docs/ux-redesign/STORY_B2_3_IMPLEMENTATION_REPORT.md
 * @see docs/ux-redesign/STORY_B2_3_MIGRATION_NOTES.md
 */

// ─── Module mocks ────────────────────────────────────────────────────────────
// We mock the firestore setter so `writeAuditLog()` can be invoked in tests
// without needing a real Firebase connection. The actual `before`/`after`
// payload passed to `setDocument` is captured for assertions.

const mockSetDocument = vi.fn();

vi.mock('@/lib/firebase/firestore', () => ({
  setDocument: (...args: unknown[]) => mockSetDocument(...args),
  getAllDocuments: vi.fn().mockResolvedValue([]),
}));

// Dynamic import AFTER mocks so the module picks up our mocked firestore.
import {
  writeAuditLog,
  redactPiiFields,
  AUDIT_REDACTED_FIELDS,
  AUDIT_REDACTED_PLACEHOLDER,
} from '@/lib/firestore/audit';
import type { CreateAuditLogInput } from '@/lib/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildInput(
  overrides: Partial<CreateAuditLogInput> = {},
): CreateAuditLogInput {
  return {
    actorId: 'user-001',
    actorName: 'Admin',
    actorRole: 'admin',
    action: 'customer_updated',
    entityType: 'customer',
    entityId: 'cust-001',
    before: { fullName: 'Original' },
    after: { fullName: 'Renamed' },
    ...overrides,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('Audit log redaction — Story B.2.3 (F-MED-17)', () => {
  beforeEach(() => {
    mockSetDocument.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Constants & pure helper ──────────────────────────────────────────

  describe('public contract', () => {
    it('exposes the canonical redacted placeholder string', () => {
      expect(AUDIT_REDACTED_PLACEHOLDER).toBe('[ĐÃ ẨN]');
    });

    it('exports the allow-list of PII field names', () => {
      expect(AUDIT_REDACTED_FIELDS).toEqual([
        'medicalNote',
        'privacyNote',
        'nationalIdNumber',
      ]);
    });

    it('freezes the allow-list against accidental mutation', () => {
      // The constant is exported as a readonly tuple — mutating it must throw
      // (TypeScript enforces readonly at compile-time; the runtime check is
      // an extra safety net).
      expect(() => {
        (AUDIT_REDACTED_FIELDS as unknown as string[]).push('hacked');
      }).toThrow();
    });
  });

  describe('redactPiiFields() — pure helper', () => {
    it('returns `undefined` for undefined input', () => {
      expect(redactPiiFields(undefined)).toBeUndefined();
    });

    it('returns `undefined` for null input (no ambiguous sentinel persisted)', () => {
      // A `null` snapshot is malformed for `AuditLog.before?: Record<string,
      // unknown>`. Normalize to `undefined` so the audit log stays
      // shape-conformant.
      expect(redactPiiFields(null)).toBeUndefined();
    });

    it('returns `undefined` for array input (arrays are not redacted at this layer)', () => {
      const arr = [{ medicalNote: 'secret' }];
      // Arrays of objects are outside the scope of B.2.3; only object
      // shapes passed as `before`/`after` get redacted. Return undefined
      // so no raw payload leaks into the persisted record.
      expect(redactPiiFields(arr as unknown as Record<string, unknown>)).toBeUndefined();
    });

    it('does not mutate the input payload', () => {
      const payload = { medicalNote: 'secret', fullName: 'Alice' };
      const before = JSON.stringify(payload);
      redactPiiFields(payload);
      expect(JSON.stringify(payload)).toBe(before);
    });

    it('redacts every PII field it owns', () => {
      const redacted = redactPiiFields({
        medicalNote: 'Bệnh nhân dị ứng với penicillin',
        privacyNote: 'Khách hàng VIP — không gọi điện',
        nationalIdNumber: '079123456789',
        fullName: 'Trần Thị B',
      });
      expect(redacted).toEqual({
        medicalNote: AUDIT_REDACTED_PLACEHOLDER,
        privacyNote: AUDIT_REDACTED_PLACEHOLDER,
        nationalIdNumber: AUDIT_REDACTED_PLACEHOLDER,
        fullName: 'Trần Thị B',
      });
    });

    it('preserves non-PII fields verbatim', () => {
      const redacted = redactPiiFields({
        fullName: 'Alice',
        phone: '0901234567',
        source: 'walk_in',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      expect(redacted).toEqual({
        fullName: 'Alice',
        phone: '0901234567',
        source: 'walk_in',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    });

    it('is idempotent — running it twice yields the same result', () => {
      const once = redactPiiFields({ medicalNote: 'secret' });
      const twice = redactPiiFields(once as Record<string, unknown>);
      expect(twice).toEqual({ medicalNote: AUDIT_REDACTED_PLACEHOLDER });
    });

    it('handles payloads that do NOT contain any PII fields', () => {
      const redacted = redactPiiFields({ status: 'draft' });
      expect(redacted).toEqual({ status: 'draft' });
    });

    it('handles payloads where a PII key is present but its value is null', () => {
      const redacted = redactPiiFields({ medicalNote: null });
      expect(redacted).toEqual({ medicalNote: AUDIT_REDACTED_PLACEHOLDER });
    });

    it('handles payloads where a PII key is present but its value is 0', () => {
      // Edge case: numeric/string-non-empty falsy values must still be
      // overwritten with the placeholder.
      const redacted = redactPiiFields({ nationalIdNumber: 0 });
      expect(redacted).toEqual({ nationalIdNumber: AUDIT_REDACTED_PLACEHOLDER });
    });
  });

  // ── 2. writeAuditLog() integration ────────────────────────────────────────

  describe('writeAuditLog() — redaction applied to before/after', () => {
    it('strips medicalNote from beforeData before persisting', async () => {
      await writeAuditLog(
        buildInput({
          action: 'customer_updated',
          before: { medicalNote: 'Bệnh nhân dị ứng với penicillin' },
          after: { medicalNote: 'Bệnh nhân dị ứng với penicillin + aspirin' },
        }),
      );

      expect(mockSetDocument).toHaveBeenCalledTimes(1);
      const [, , persisted] = mockSetDocument.mock.calls[0];
      expect(persisted.before.medicalNote).toBe(AUDIT_REDACTED_PLACEHOLDER);
      expect(persisted.after.medicalNote).toBe(AUDIT_REDACTED_PLACEHOLDER);
    });

    it('strips privacyNote from beforeData and afterData', async () => {
      await writeAuditLog(
        buildInput({
          action: 'customer_updated',
          before: { privacyNote: 'Khách hàng VIP — không gọi điện' },
          after: { privacyNote: 'Khách hàng siêu VIP — chỉ liên lạc qua email' },
        }),
      );

      const [, , persisted] = mockSetDocument.mock.calls[0];
      expect(persisted.before.privacyNote).toBe(AUDIT_REDACTED_PLACEHOLDER);
      expect(persisted.after.privacyNote).toBe(AUDIT_REDACTED_PLACEHOLDER);
    });

    it('strips nationalIdNumber from beforeData and afterData', async () => {
      await writeAuditLog(
        buildInput({
          action: 'customer_updated',
          before: { nationalIdNumber: '079123456789' },
          after: { nationalIdNumber: '079987654321' },
        }),
      );

      const [, , persisted] = mockSetDocument.mock.calls[0];
      expect(persisted.before.nationalIdNumber).toBe(AUDIT_REDACTED_PLACEHOLDER);
      expect(persisted.after.nationalIdNumber).toBe(AUDIT_REDACTED_PLACEHOLDER);
    });

    it('strips ALL three PII fields in one call', async () => {
      await writeAuditLog(
        buildInput({
          action: 'customer_updated',
          before: {
            medicalNote: 'm-secret',
            privacyNote: 'p-secret',
            nationalIdNumber: '111',
          },
          after: {
            medicalNote: 'm-secret-2',
            privacyNote: 'p-secret-2',
            nationalIdNumber: '222',
          },
        }),
      );

      const [, , persisted] = mockSetDocument.mock.calls[0];
      expect(persisted.before).toEqual({
        medicalNote: AUDIT_REDACTED_PLACEHOLDER,
        privacyNote: AUDIT_REDACTED_PLACEHOLDER,
        nationalIdNumber: AUDIT_REDACTED_PLACEHOLDER,
      });
      expect(persisted.after).toEqual({
        medicalNote: AUDIT_REDACTED_PLACEHOLDER,
        privacyNote: AUDIT_REDACTED_PLACEHOLDER,
        nationalIdNumber: AUDIT_REDACTED_PLACEHOLDER,
      });
    });

    it('preserves non-PII fields in beforeData and afterData', async () => {
      await writeAuditLog(
        buildInput({
          action: 'customer_updated',
          before: {
            fullName: 'Trần Thị A',
            phone: '0901234567',
            medicalNote: 'secret',
          },
          after: {
            fullName: 'Trần Thị B',
            phone: '0901234567',
            medicalNote: 'secret-2',
          },
        }),
      );

      const [, , persisted] = mockSetDocument.mock.calls[0];
      expect(persisted.before.fullName).toBe('Trần Thị A');
      expect(persisted.before.phone).toBe('0901234567');
      expect(persisted.after.fullName).toBe('Trần Thị B');
      expect(persisted.after.phone).toBe('0901234567');
    });

    it('persists undefined before/after when not supplied (no key added)', async () => {
      await writeAuditLog(
        buildInput({ action: 'case_status_changed', before: undefined, after: undefined }),
      );

      const [, , persisted] = mockSetDocument.mock.calls[0];
      expect(persisted.before).toBeUndefined();
      expect(persisted.after).toBeUndefined();
    });

    it('does NOT mutate the caller-provided before/after objects', async () => {
      const before = { fullName: 'A', medicalNote: 'secret-before' };
      const after = { fullName: 'B', medicalNote: 'secret-after' };

      await writeAuditLog(buildInput({ before, after }));

      // The caller's objects must be untouched — redaction must clone, not
      // overwrite the input.
      expect(before.medicalNote).toBe('secret-before');
      expect(after.medicalNote).toBe('secret-after');
    });

    it('writes the audit log even when before is undefined and after has PII', async () => {
      await writeAuditLog(
        buildInput({
          action: 'customer_created',
          before: undefined,
          after: { fullName: 'New', medicalNote: 'first-visit notes', privacyNote: 'p' },
        }),
      );

      const [, , persisted] = mockSetDocument.mock.calls[0];
      expect(persisted.before).toBeUndefined();
      expect(persisted.after.medicalNote).toBe(AUDIT_REDACTED_PLACEHOLDER);
      expect(persisted.after.privacyNote).toBe(AUDIT_REDACTED_PLACEHOLDER);
      expect(persisted.after.fullName).toBe('New');
    });

    it('persists actor metadata, action, entityType, entityId unchanged', async () => {
      await writeAuditLog(buildInput());

      const [, , persisted] = mockSetDocument.mock.calls[0];
      expect(persisted.actorId).toBe('user-001');
      expect(persisted.actorName).toBe('Admin');
      expect(persisted.actorRole).toBe('admin');
      expect(persisted.action).toBe('customer_updated');
      expect(persisted.entityType).toBe('customer');
      expect(persisted.entityId).toBe('cust-001');
    });
  });

  // ── 3. Defensive behavior ────────────────────────────────────────────────

  describe('defensive behavior', () => {
    it('swallows firestore errors and never throws to the caller', async () => {
      mockSetDocument.mockRejectedValue(new Error('firestore down'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      // writeAuditLog is fire-and-forget — a failed persist must not
      // bubble up and break the calling domain code (e.g. a customer
      // update that already succeeded).
      await expect(writeAuditLog(buildInput())).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('ignores null before/after even when the field would be PII', async () => {
      await writeAuditLog(
        buildInput({
          action: 'case_updated',
          before: null as unknown as Record<string, unknown>,
          after: { fullName: 'X' },
        }),
      );

      const [, , persisted] = mockSetDocument.mock.calls[0];
      expect(persisted.before).toBeUndefined();
      expect(persisted.after.fullName).toBe('X');
    });
  });

  // ── 4. End-to-end snapshot test (deterministic id) ────────────────────────

  it('produces a fully-redacted, deterministic snapshot for a representative customer_updated event', async () => {
    await writeAuditLog(
      buildInput({
        actorId: 'user-001',
        actorName: 'Phạm Thị Admin',
        actorRole: 'admin',
        action: 'customer_updated',
        entityId: 'cust-2026-001',
        before: {
          fullName: 'Nguyễn Văn X',
          phone: '0901234567',
          medicalNote: 'Dị ứng latex — đã ghi nhận',
          privacyNote: 'Khách VVIP',
          nationalIdNumber: '079123456789',
          source: 'walk_in',
        },
        after: {
          fullName: 'Nguyễn Văn Y',
          phone: '0901234567',
          medicalNote: 'Dị ứng latex + paracetamol',
          privacyNote: 'Khách VVIP — chỉ liên hệ sau 17h',
          nationalIdNumber: '079987654321',
          source: 'walk_in',
        },
      }),
    );

    const [, , persisted] = mockSetDocument.mock.calls[0];
    expect(persisted).toMatchObject({
      actorId: 'user-001',
      actorName: 'Phạm Thị Admin',
      actorRole: 'admin',
      action: 'customer_updated',
      entityType: 'customer',
      entityId: 'cust-2026-001',
      before: {
        fullName: 'Nguyễn Văn X',
        phone: '0901234567',
        medicalNote: AUDIT_REDACTED_PLACEHOLDER,
        privacyNote: AUDIT_REDACTED_PLACEHOLDER,
        nationalIdNumber: AUDIT_REDACTED_PLACEHOLDER,
        source: 'walk_in',
      },
      after: {
        fullName: 'Nguyễn Văn Y',
        phone: '0901234567',
        medicalNote: AUDIT_REDACTED_PLACEHOLDER,
        privacyNote: AUDIT_REDACTED_PLACEHOLDER,
        nationalIdNumber: AUDIT_REDACTED_PLACEHOLDER,
        source: 'walk_in',
      },
    });
  });
});
