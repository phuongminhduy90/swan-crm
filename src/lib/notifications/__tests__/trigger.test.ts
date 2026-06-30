/**
 * Story B.1.6 — Add doctor / nurse / coordinator to complaint notifications.
 *
 * Acceptance criteria (per SPRINT_6_1_EXECUTION_PLAN.md §1, B.1.6 row, and
 * Story B.1.6 DoD):
 *   1. `triggerComplaint` notifies doctor + nurse + coordinator resolved
 *      from the case's staff assignment (via `getAllUsers()`).
 *   2. The notification payload NEVER includes PII fields —
 *      `nationalIdNumber`, `medicalNote`, `privacyNote`.
 *   3. Existing complaint behavior is preserved when no staff assignment
 *      exists (baseline recipients `cso`, `admin`, `master_sales`).
 *   4. Failures during staff resolution do NOT abort the notification —
 *      baseline recipients still receive it.
 *
 * @see docs/ux-redesign/SPRINT_6_1_EXECUTION_PLAN.md §1 (B.1.6 row)
 * @see docs/ux-redesign/STORY_B1_6_MIGRATION_NOTES.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Module mocks (must be registered before importing the trigger module) ──

const mockGetStaffAssignment = vi.fn();
vi.mock('@/lib/firestore/staff-assignments', () => ({
  getStaffAssignment: (...args: unknown[]) => mockGetStaffAssignment(...args),
}));

const mockGetAllUsers = vi.fn();
vi.mock('@/lib/firestore/users', () => ({
  getAllUsers: (...args: unknown[]) => mockGetAllUsers(...args),
}));

const mockSendInAppNotification = vi.fn();
vi.mock('@/lib/notifications/in-app', () => ({
  sendInAppNotification: (...args: unknown[]) => mockSendInAppNotification(...args),
}));

// Mock @/config/firebase so importing the trigger module is safe under vitest.
vi.mock('@/config/firebase', () => ({
  isDevMode: true,
  hasFirebaseConfig: false,
  firebaseConfig: {},
}));

// Mock @/lib/mock/store so the firestore shims (which read isMockEnabled)
// resolve cleanly even if any transitive import reaches them.
vi.mock('@/lib/mock/store', () => ({
  isMockEnabled: () => false,
  getCollection: () => new Map(),
}));

// ─── Imports under test (loaded AFTER mocks) ───────────────────────────────

import {
  triggerComplaint,
  resolveCskhDisplayName,
  CSKH_FALLBACK_LABEL,
} from '@/lib/notifications/trigger';
import type { CaseRecord, User, UserRole } from '@/lib/types';

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeCase(overrides: Partial<CaseRecord> = {}): CaseRecord {
  return {
    id: 'case-006',
    caseCode: 'CASE-006',
    customerId: 'cus-006',
    caseDate: '2026-06-08T00:00:00.000Z',
    mainServiceGroup: 'breast',
    status: 'complaint',
    priority: 'high',
    totalBillBeforeDiscount: 65_000_000,
    totalBillAfterDiscount: 65_000_000,
    amountPaid: 65_000_000,
    remainingAmount: 0,
    paymentStatus: 'paid',
    privacyLevel: 'normal',
    createdBy: 'user-004',
    createdAt: '2026-06-08T00:00:00.000Z',
    updatedAt: '2026-06-30T00:00:00.000Z',
    ...overrides,
  } as CaseRecord;
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-XXX',
    email: 'user-XXX@swanclinic.vn',
    displayName: 'User XXX',
    role: 'admin' as UserRole,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as User;
}

/**
 * Wait for the inner async IIFE inside `triggerComplaint` to finish.
 *
 * The trigger function is sync (returns `void`) but kicks off an
 * `async` IIFE for staff resolution. Tests must flush the microtask
 * queue so the inner code runs before assertions.
 */
async function flushTrigger() {
  // 1. Drain the immediate microtask queue (the void IIFE is enqueued).
  await Promise.resolve();
  // 2. Allow chained promises (getStaffAssignment → getAllUsers → send)
  //    to resolve one after another.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

// ─── Suite ─────────────────────────────────────────────────────────────────

describe('triggerComplaint — Story B.1.6 (F-HIGH-21)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Baseline recipient behavior (existing) ────────────────────────────

  describe('baseline recipients (preserved from previous behavior)', () => {
    it('still targets cso + admin + master_sales roles when no staff assignment exists', async () => {
      mockGetStaffAssignment.mockResolvedValue(null);
      mockGetAllUsers.mockResolvedValue([]);

      triggerComplaint(makeCase());
      await flushTrigger();

      expect(mockSendInAppNotification).toHaveBeenCalledTimes(1);
      const call = mockSendInAppNotification.mock.calls[0]?.[0] as {
        recipientRoles?: UserRole[];
        recipientUserIds?: string[];
      };
      expect(call.recipientRoles).toEqual(
        expect.arrayContaining(['cso', 'admin', 'master_sales']),
      );
    });

    it('still fires the notification when staff resolution throws', async () => {
      mockGetStaffAssignment.mockRejectedValue(new Error('firestore down'));
      mockGetAllUsers.mockResolvedValue([]);

      // Silence the expected console.error from the catch path.
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      triggerComplaint(makeCase());
      await flushTrigger();

      expect(mockSendInAppNotification).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });

  // ── 2. Medical-team recipients (B.1.6 core requirement) ──────────────────

  describe('medical-team recipients resolved from staff assignment', () => {
    it('adds doctor + coordinator + nurse[0] as recipientUserIds', async () => {
      mockGetStaffAssignment.mockResolvedValue({
        id: 'sa-006',
        caseId: 'case-006',
        doctorId: 'user-008',
        coordinatorId: 'user-010',
        nurseIds: ['user-009'],
        assignedBy: 'user-004',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      });
      mockGetAllUsers.mockResolvedValue([
        makeUser({ id: 'user-008', displayName: 'BS. Phạm Ngọc Anh', role: 'doctor' }),
        makeUser({ id: 'user-009', displayName: 'Nguyễn Thị Mai', role: 'nurse' }),
        makeUser({ id: 'user-010', displayName: 'Trương Văn Khoa', role: 'coordinator' }),
      ]);

      triggerComplaint(makeCase());
      await flushTrigger();

      const call = mockSendInAppNotification.mock.calls[0]?.[0] as {
        recipientUserIds?: string[];
        recipientRoles?: UserRole[];
      };

      // Baseline roles preserved …
      expect(call.recipientRoles).toEqual(
        expect.arrayContaining(['cso', 'admin', 'master_sales']),
      );
      // … plus the medical team as user IDs.
      expect(call.recipientUserIds).toEqual(
        expect.arrayContaining(['user-008', 'user-009', 'user-010']),
      );
    });

    it('deduplicates recipientUserIds when doctor and coordinator share a uid', async () => {
      // (Pathological: the same user can't realistically be both doctor and
      // coordinator, but the dedupe helper must guard against the case
      // anyway — e.g. if both are unset and the same id lands twice.)
      mockGetStaffAssignment.mockResolvedValue({
        id: 'sa-006',
        caseId: 'case-006',
        doctorId: 'user-008',
        coordinatorId: 'user-008', // intentionally same uid
        nurseIds: ['user-008'],   // intentionally same uid again
        assignedBy: 'user-004',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      });
      mockGetAllUsers.mockResolvedValue([
        makeUser({ id: 'user-008', displayName: 'BS. Phạm Ngọc Anh', role: 'doctor' }),
      ]);

      triggerComplaint(makeCase());
      await flushTrigger();

      const call = mockSendInAppNotification.mock.calls[0]?.[0] as {
        recipientUserIds?: string[];
      };
      expect(call.recipientUserIds).toEqual(['user-008']);
    });

    it('handles a partial staff assignment (doctor only) without throwing', async () => {
      mockGetStaffAssignment.mockResolvedValue({
        id: 'sa-006',
        caseId: 'case-006',
        doctorId: 'user-008',
        // coordinatorId + nurseIds absent
        assignedBy: 'user-004',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      });
      mockGetAllUsers.mockResolvedValue([
        makeUser({ id: 'user-008', displayName: 'BS. Phạm Ngọc Anh', role: 'doctor' }),
      ]);

      expect(() => triggerComplaint(makeCase())).not.toThrow();
      await flushTrigger();

      const call = mockSendInAppNotification.mock.calls[0]?.[0] as {
        recipientUserIds?: string[];
      };
      expect(call.recipientUserIds).toEqual(['user-008']);
    });

    it('returns an empty recipientUserIds list when no medical roles are assigned', async () => {
      mockGetStaffAssignment.mockResolvedValue({
        id: 'sa-006',
        caseId: 'case-006',
        masterSalesId: 'user-004',
        // no doctor, no nurse, no coordinator
        assignedBy: 'user-004',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      });
      mockGetAllUsers.mockResolvedValue([]);

      triggerComplaint(makeCase());
      await flushTrigger();

      const call = mockSendInAppNotification.mock.calls[0]?.[0] as {
        recipientUserIds?: string[];
        recipientRoles?: UserRole[];
      };
      expect(call.recipientUserIds ?? []).toEqual([]);
      // Baseline roles still fire even without medical team.
      expect(call.recipientRoles).toEqual(
        expect.arrayContaining(['cso', 'admin', 'master_sales']),
      );
    });
  });

  // ── 3. Notification body — PII safety (F-HIGH-21) ─────────────────────────

  describe('notification payload excludes PII (F-HIGH-21)', () => {
    it('body contains only case code + assigned staff display names — no PII', async () => {
      mockGetStaffAssignment.mockResolvedValue({
        id: 'sa-006',
        caseId: 'case-006',
        doctorId: 'user-008',
        coordinatorId: 'user-010',
        nurseIds: ['user-009'],
        assignedBy: 'user-004',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      });
      mockGetAllUsers.mockResolvedValue([
        makeUser({ id: 'user-008', displayName: 'BS. Phạm Ngọc Anh', role: 'doctor' }),
        makeUser({ id: 'user-009', displayName: 'Nguyễn Thị Mai', role: 'nurse' }),
        makeUser({ id: 'user-010', displayName: 'Trương Văn Khoa', role: 'coordinator' }),
      ]);

      triggerComplaint(makeCase());
      await flushTrigger();

      const call = mockSendInAppNotification.mock.calls[0]?.[0] as {
        title: string;
        body: string;
      };

      // PII field names MUST NOT appear in title or body.
      expect(call.title).not.toMatch(/nationalIdNumber|nationalId|CCCD/);
      expect(call.body).not.toMatch(/nationalIdNumber|nationalId|CCCD/);
      expect(call.title).not.toMatch(/medicalNote|privacyNote/);
      expect(call.body).not.toMatch(/medicalNote|privacyNote/);
      expect(call.body).not.toMatch(/address/i);

      // No raw user IDs leak into the body.
      expect(call.body).not.toMatch(/user-00\d/);

      // Staff display names SHOULD appear (with Vietnamese role labels).
      expect(call.body).toMatch(/BS\. Phạm Ngọc Anh|Nguyễn Thị Mai|Trương Văn Khoa/);
    });

    it('does not pass customer object to sendInAppNotification', async () => {
      mockGetStaffAssignment.mockResolvedValue(null);
      mockGetAllUsers.mockResolvedValue([]);

      triggerComplaint(makeCase());
      await flushTrigger();

      const call = mockSendInAppNotification.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      // The complaint payload must not carry customer data — that's where
      // PII would naturally live.
      expect(call).not.toHaveProperty('customer');
      expect(call).not.toHaveProperty('customerId');
    });
  });

  // ── 4. Notification metadata (eventType, caseId) ─────────────────────────

  describe('notification metadata', () => {
    it('preserves the eventType = "complaint" and the caseId', async () => {
      mockGetStaffAssignment.mockResolvedValue(null);
      mockGetAllUsers.mockResolvedValue([]);

      const c = makeCase({ id: 'case-XYZ', caseCode: 'CASE-XYZ' });
      triggerComplaint(c);
      await flushTrigger();

      const call = mockSendInAppNotification.mock.calls[0]?.[0] as {
        eventType: string;
        caseId: string;
        title: string;
      };
      expect(call.eventType).toBe('complaint');
      expect(call.caseId).toBe('case-XYZ');
      expect(call.title).toMatch(/CASE-XYZ|KHIẾU NẠI/);
    });
  });

  // ── 5. Resolved display names surface in body ────────────────────────────

  describe('staff display names in body', () => {
    it('renders doctor / nurse / coordinator names when present in the users map', async () => {
      mockGetStaffAssignment.mockResolvedValue({
        id: 'sa-006',
        caseId: 'case-006',
        doctorId: 'user-008',
        coordinatorId: 'user-010',
        nurseIds: ['user-009'],
        assignedBy: 'user-004',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      });
      mockGetAllUsers.mockResolvedValue([
        makeUser({ id: 'user-008', displayName: 'BS. Phạm Ngọc Anh', role: 'doctor' }),
        makeUser({ id: 'user-009', displayName: 'Nguyễn Thị Mai', role: 'nurse' }),
        makeUser({ id: 'user-010', displayName: 'Trương Văn Khoa', role: 'coordinator' }),
      ]);

      triggerComplaint(makeCase());
      await flushTrigger();

      const call = mockSendInAppNotification.mock.calls[0]?.[0] as { body: string };
      expect(call.body).toMatch(/Bác sĩ phụ trách: BS\. Phạm Ngọc Anh/);
      expect(call.body).toMatch(/Y tá phụ trách: Nguyễn Thị Mai/);
      expect(call.body).toMatch(/Điều phối viên phụ trách: Trương Văn Khoa/);
    });

    it('omits staff lines when user lookup returns no matches (defensive)', async () => {
      mockGetStaffAssignment.mockResolvedValue({
        id: 'sa-006',
        caseId: 'case-006',
        doctorId: 'user-008',
        coordinatorId: 'user-010',
        nurseIds: ['user-009'],
        assignedBy: 'user-004',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      });
      // Empty users map — staff IDs won't resolve.
      mockGetAllUsers.mockResolvedValue([]);

      triggerComplaint(makeCase());
      await flushTrigger();

      const call = mockSendInAppNotification.mock.calls[0]?.[0] as { body: string };
      // Body should still contain the base complaint message …
      expect(call.body).toMatch(/KHIẾU NẠI|khiếu nại|xử lý khẩn/i);
      // … but NOT partial labels like "Bác sĩ phụ trách: undefined".
      expect(call.body).not.toMatch(/undefined|null/);
      // The notification still fires.
      expect(mockSendInAppNotification).toHaveBeenCalledTimes(1);
    });
  });

  // ── 6. Story B.1.7 — CSKH display name resolution (F-MED-19) ──────────────

  describe('resolveCskhDisplayName — Story B.1.7 (F-MED-19)', () => {
    it('exports the fallback label as the literal "CSKH" (not "unknown" / "general")', () => {
      // Anti-pattern A1 guard: per BACKLOG, the fallback must be an
      // intentional, locale-aware label — never a generic sentinel.
      expect(CSKH_FALLBACK_LABEL).toBe('CSKH');
      expect(CSKH_FALLBACK_LABEL).not.toBe('unknown');
      expect(CSKH_FALLBACK_LABEL).not.toBe('general');
    });

    it('returns the actual CSKH display name from the staff assignment', async () => {
      mockGetStaffAssignment.mockResolvedValue({
        id: 'sa-006',
        caseId: 'case-006',
        cskhPostopId: 'user-011',
        assignedBy: 'user-004',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      });
      mockGetAllUsers.mockResolvedValue([
        makeUser({ id: 'user-011', displayName: 'Phạm Ngọc Điệp', role: 'cskh_postop' }),
      ]);

      const result = await resolveCskhDisplayName('case-006');

      expect(result).toBe('Phạm Ngọc Điệp');
      expect(mockGetStaffAssignment).toHaveBeenCalledWith('case-006');
    });

    it('falls back to "CSKH" when no staff assignment exists for the case', async () => {
      mockGetStaffAssignment.mockResolvedValue(null);
      mockGetAllUsers.mockResolvedValue([
        makeUser({ id: 'user-011', displayName: 'Phạm Ngọc Điệp', role: 'cskh_postop' }),
      ]);

      const result = await resolveCskhDisplayName('case-without-assignment');

      expect(result).toBe(CSKH_FALLBACK_LABEL);
      expect(result).toBe('CSKH');
    });

    it('falls back to "CSKH" when the assignment has no cskhPostopId', async () => {
      mockGetStaffAssignment.mockResolvedValue({
        id: 'sa-006',
        caseId: 'case-006',
        // cskhPostopId intentionally absent — only sales roles set.
        masterSalesId: 'user-004',
        doctorId: 'user-008',
        assignedBy: 'user-004',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      });
      mockGetAllUsers.mockResolvedValue([
        makeUser({ id: 'user-011', displayName: 'Phạm Ngọc Điệp', role: 'cskh_postop' }),
      ]);

      const result = await resolveCskhDisplayName('case-006');

      expect(result).toBe('CSKH');
    });

    it('falls back to "CSKH" when the cskhPostopId is set but does not resolve to any user', async () => {
      mockGetStaffAssignment.mockResolvedValue({
        id: 'sa-006',
        caseId: 'case-006',
        cskhPostopId: 'user-deleted-zzz',
        assignedBy: 'user-004',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      });
      // User directory is empty (or only contains other users).
      mockGetAllUsers.mockResolvedValue([
        makeUser({ id: 'user-008', displayName: 'BS. Phạm Ngọc Anh', role: 'doctor' }),
      ]);

      const result = await resolveCskhDisplayName('case-006');

      expect(result).toBe('CSKH');
    });

    it('falls back to "CSKH" when the resolved user has a blank displayName', async () => {
      mockGetStaffAssignment.mockResolvedValue({
        id: 'sa-006',
        caseId: 'case-006',
        cskhPostopId: 'user-011',
        assignedBy: 'user-004',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      });
      mockGetAllUsers.mockResolvedValue([
        makeUser({ id: 'user-011', displayName: '   ', role: 'cskh_postop' }),
      ]);

      const result = await resolveCskhDisplayName('case-006');

      expect(result).toBe('CSKH');
    });

    it('never throws when getStaffAssignment rejects (defensive)', async () => {
      mockGetStaffAssignment.mockRejectedValue(new Error('firestore offline'));
      mockGetAllUsers.mockResolvedValue([]);

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const result = await resolveCskhDisplayName('case-006');

      expect(result).toBe('CSKH');
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('never throws when getAllUsers rejects (defensive)', async () => {
      mockGetStaffAssignment.mockResolvedValue({
        id: 'sa-006',
        caseId: 'case-006',
        cskhPostopId: 'user-011',
        assignedBy: 'user-004',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      });
      mockGetAllUsers.mockRejectedValue(new Error('users collection unreachable'));

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const result = await resolveCskhDisplayName('case-006');

      expect(result).toBe('CSKH');
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('returns trimmed display name (no leading/trailing whitespace leaks into the notification)', async () => {
      mockGetStaffAssignment.mockResolvedValue({
        id: 'sa-006',
        caseId: 'case-006',
        cskhPostopId: 'user-011',
        assignedBy: 'user-004',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      });
      mockGetAllUsers.mockResolvedValue([
        makeUser({ id: 'user-011', displayName: '  Phạm Ngọc Điệp  ', role: 'cskh_postop' }),
      ]);

      const result = await resolveCskhDisplayName('case-006');

      expect(result).toBe('Phạm Ngọc Điệp');
    });

    it('does NOT leak the raw user ID into the resolved name (anti-pattern A2)', async () => {
      mockGetStaffAssignment.mockResolvedValue({
        id: 'sa-006',
        caseId: 'case-006',
        cskhPostopId: 'user-011',
        assignedBy: 'user-004',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      });
      mockGetAllUsers.mockResolvedValue([
        makeUser({ id: 'user-011', displayName: 'Phạm Ngọc Điệp', role: 'cskh_postop' }),
      ]);

      const result = await resolveCskhDisplayName('case-006');

      // Anti-pattern A2 (per DESIGN_DIRECTION §18): raw user IDs in copy are
      // forbidden. The resolved name must be a real display name, not the
      // raw ID.
      expect(result).not.toMatch(/user-\d+/);
      expect(result).toBe('Phạm Ngọc Điệp');
    });
  });
});
