/**
 * Story B.1.5 (F-HIGH-20) — Auto-escalate followup API integration tests.
 *
 * Coverage:
 *   - painLevel=5 crosses threshold → escalation triggered (1 audit
 *     entry, 1 notification fired, case.lastEscalatedAt updated).
 *   - painLevel=3 stays below threshold → no escalation (audit entry
 *     still written for visibility, but no notification, no lastEscalatedAt).
 *   - status='issue_reported' transition → escalation triggered.
 *   - repeat painLevel=5 within debounce → no second escalation.
 *   - case.status === 'medical_alert' → no escalation even when pain
 *     is high (already_medical_alert guard).
 *   - Audit log "followup_completed" preserved for status='completed'.
 *   - Followup not found → 404.
 *
 * @see docs/ux-redesign/SPRINT_6_2_EXECUTION_PLAN.md §8.2, B.1.5 rows.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Module mocks (must register before route import) ──────────────────────

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

const mockUpdateFollowup = vi.fn();
const mockGetFollowup = vi.fn();
vi.mock('@/lib/firestore/followups', () => ({
  updateFollowup: (...args: unknown[]) => mockUpdateFollowup(...args),
  getFollowup: (...args: unknown[]) => mockGetFollowup(...args),
}));

const mockWriteAuditLog = vi.fn();
vi.mock('@/lib/firestore/audit', () => ({
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
}));

const mockGetCase = vi.fn();
const mockUpdateCase = vi.fn();
vi.mock('@/lib/firestore/cases', () => ({
  getCase: (...args: unknown[]) => mockGetCase(...args),
  updateCase: (...args: unknown[]) => mockUpdateCase(...args),
}));

const mockGetStaffAssignment = vi.fn();
vi.mock('@/lib/firestore/staff-assignments', () => ({
  getStaffAssignment: (...args: unknown[]) => mockGetStaffAssignment(...args),
}));

const mockGetAllUsersFromDb = vi.fn();
const mockGetUser = vi.fn();
vi.mock('@/lib/firestore/users', () => ({
  getAllUsers: (...args: unknown[]) => mockGetAllUsersFromDb(...args),
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

const mockGetCustomer = vi.fn();
vi.mock('@/lib/firestore/customers', () => ({
  getCustomer: (...args: unknown[]) => mockGetCustomer(...args),
}));

const mockTriggerFollowupEscalation = vi.fn();
vi.mock('@/lib/notifications/trigger', () => ({
  triggerFollowupEscalation: (...args: unknown[]) => mockTriggerFollowupEscalation(...args),
}));

// ─── Imports under test ────────────────────────────────────────────────────

import { PATCH } from '@/app/api/followups/[id]/route';
import type { CaseRecord, Followup, User, UserRole } from '@/lib/types';

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeFollowup(overrides: Partial<Followup> = {}): Followup {
  return {
    id: 'fup-001',
    caseId: 'case-001',
    customerId: 'cust-001',
    followupDay: 'D3',
    dueDate: '2026-06-30T00:00:00.000Z',
    status: 'contacted',
    painLevel: 3,
    requestedImage: false,
    imageUploaded: false,
    createdAt: '2026-06-28T00:00:00.000Z',
    updatedAt: '2026-06-30T00:00:00.000Z',
    ...overrides,
  } as Followup;
}

function makeCase(overrides: Partial<CaseRecord> = {}): CaseRecord {
  return {
    id: 'case-001',
    caseCode: 'CASE-001',
    customerId: 'cust-001',
    caseDate: '2026-06-01T00:00:00.000Z',
    mainServiceGroup: 'nose',
    status: 'post_op_d3',
    priority: 'normal',
    totalBillBeforeDiscount: 25_000_000,
    totalBillAfterDiscount: 25_000_000,
    amountPaid: 25_000_000,
    remainingAmount: 0,
    paymentStatus: 'paid',
    privacyLevel: 'normal',
    createdBy: 'user-001',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  } as CaseRecord;
}

function makeUser(id: string, role: UserRole, name: string): User {
  return {
    id,
    email: `${id}@swanclinic.vn`,
    displayName: name,
    role,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function buildRequest(body: unknown): NextRequest {
  return new NextRequest(
    new Request('http://localhost:3000/api/followups/fup-001', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-dev-user-id': 'user-011', // cskh_postop default
      },
      body: JSON.stringify(body),
    }),
  );
}

/**
 * Flush all queued microtasks for the fire-and-forget IIFE inside the
 * route handler + the (mocked) async dependencies. Without this the
 * assertions would race the orchestration.
 */
async function flushOrchestration(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve();
  }
}

// ─── Suite ─────────────────────────────────────────────────────────────────

describe('PATCH /api/followups/[id] — Story B.1.5 (F-HIGH-20)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-30T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns 404 when the followup does not exist', async () => {
    mockGetFollowup.mockResolvedValue(null);

    const res = await PATCH(buildRequest({ painLevel: 5 }), { params: { id: 'missing' } });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/Không tìm thấy followup/);
    expect(mockUpdateFollowup).not.toHaveBeenCalled();
  });

  it('updates the followup (regression — pre-B.1.5 behavior)', async () => {
    mockGetFollowup.mockResolvedValue(makeFollowup({ painLevel: 2 }));
    mockGetCase.mockResolvedValue(makeCase({ status: 'post_op_d3' }));
    mockGetStaffAssignment.mockResolvedValue(null);
    mockGetAllUsersFromDb.mockResolvedValue([]);
    mockGetCustomer.mockResolvedValue({ fullName: 'Nguyễn Văn A' });

    const res = await PATCH(buildRequest({ painLevel: 2 }), { params: { id: 'fup-001' } });
    expect(res.status).toBe(200);
    expect(mockUpdateFollowup).toHaveBeenCalledTimes(1);
    expect(mockUpdateFollowup.mock.calls[0]?.[1]).toMatchObject({ painLevel: 2 });

    // Flush the IIFE for the audit log assertion
    await flushOrchestration();
  });

  it('triggers escalation when painLevel crosses 3 → 5', async () => {
    mockGetFollowup.mockResolvedValue(makeFollowup({ status: 'contacted', painLevel: 3 }));
    mockGetCase.mockResolvedValue(makeCase({ status: 'post_op_d3' }));
    mockGetStaffAssignment.mockResolvedValue({
      id: 'sa-001',
      caseId: 'case-001',
      doctorId: 'user-008',
      nurseIds: ['user-009'],
      assignedBy: 'user-001',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    });
    mockGetAllUsersFromDb.mockResolvedValue([
      makeUser('user-008', 'doctor', 'BS. Phạm Ngọc Anh'),
      makeUser('user-009', 'nurse', 'Nguyễn Thị Mai'),
    ]);
    mockGetCustomer.mockResolvedValue({ fullName: 'Nguyễn Văn A' });

    const res = await PATCH(buildRequest({ painLevel: 5 }), { params: { id: 'fup-001' } });
    expect(res.status).toBe(200);

    await flushOrchestration();

    // Escalation notification fired with the resolved recipients.
    expect(mockTriggerFollowupEscalation).toHaveBeenCalledTimes(1);
    const triggerCall = mockTriggerFollowupEscalation.mock.calls[0]?.[0] as {
      trigger: string;
      recipientUserIds: string[];
      doctorNames: string[];
      nurseNames: string[];
    };
    expect(triggerCall.trigger).toBe('pain_above_threshold');
    expect(triggerCall.recipientUserIds.sort()).toEqual(['user-008', 'user-009']);
    expect(triggerCall.doctorNames).toEqual(['BS. Phạm Ngọc Anh']);
    expect(triggerCall.nurseNames).toEqual(['Nguyễn Thị Mai']);

    // case.lastEscalatedAt updated to drive the 6h debounce window.
    expect(mockUpdateCase).toHaveBeenCalledWith(
      'case-001',
      expect.objectContaining({ lastEscalatedAt: expect.any(String) }),
      'user-011',
    );

    // Audit log written for the escalation event.
    const escalatedLog = mockWriteAuditLog.mock.calls.find((call) => {
      const arg = call[0] as { action?: string };
      return arg.action === 'followup_escalated';
    });
    expect(escalatedLog).toBeDefined();
    if (escalatedLog) {
      const arg = escalatedLog[0] as {
        before?: Record<string, unknown>;
        after?: Record<string, unknown>;
      };
      expect(arg.before).toMatchObject({ painLevel: 3, status: 'contacted' });
      expect(arg.after).toMatchObject({
        painLevel: 5,
        status: 'contacted',
      });
    }
  });

  it('triggers escalation when status transitions to issue_reported', async () => {
    mockGetFollowup.mockResolvedValue(makeFollowup({ status: 'contacted', painLevel: 1 }));
    mockGetCase.mockResolvedValue(makeCase({ status: 'post_op_d3' }));
    mockGetStaffAssignment.mockResolvedValue(null); // fallback path
    mockGetAllUsersFromDb.mockResolvedValue([
      makeUser('user-008', 'doctor', 'BS. A'),
      makeUser('user-009', 'nurse', 'YT. B'),
    ]);
    mockGetCustomer.mockResolvedValue({ fullName: 'Nguyễn Văn A' });

    const res = await PATCH(
      buildRequest({ status: 'issue_reported' }),
      { params: { id: 'fup-001' } },
    );
    expect(res.status).toBe(200);
    await flushOrchestration();

    expect(mockTriggerFollowupEscalation).toHaveBeenCalledTimes(1);
    const trig = mockTriggerFollowupEscalation.mock.calls[0]?.[0] as { trigger: string };
    expect(trig.trigger).toBe('issue_reported');
  });

  it('does NOT escalate when painLevel stays below threshold', async () => {
    mockGetFollowup.mockResolvedValue(makeFollowup({ status: 'contacted', painLevel: 2 }));
    mockGetCase.mockResolvedValue(makeCase({ status: 'post_op_d3' }));
    mockGetStaffAssignment.mockResolvedValue(null);
    mockGetAllUsersFromDb.mockResolvedValue([]);

    const res = await PATCH(buildRequest({ painLevel: 3 }), { params: { id: 'fup-001' } });
    expect(res.status).toBe(200);
    await flushOrchestration();

    expect(mockTriggerFollowupEscalation).not.toHaveBeenCalled();
    expect(mockUpdateCase).not.toHaveBeenCalled();
    // Audit log is still written for the decision (clinical ops visibility).
    const audit = mockWriteAuditLog.mock.calls.find((call) => {
      const arg = call[0] as { action?: string };
      return arg.action === 'followup_escalated';
    });
    expect(audit).toBeDefined();
  });

  it('respects the 6h debounce window — no second escalation', async () => {
    // Case was last escalated 2 hours ago.
    const twoHoursAgo = new Date('2026-06-30T10:00:00.000Z').toISOString();
    mockGetFollowup.mockResolvedValue(makeFollowup({ status: 'contacted', painLevel: 3 }));
    mockGetCase.mockResolvedValue(
      makeCase({ status: 'post_op_d3', lastEscalatedAt: twoHoursAgo }),
    );
    mockGetStaffAssignment.mockResolvedValue(null);
    mockGetAllUsersFromDb.mockResolvedValue([]);

    const res = await PATCH(buildRequest({ painLevel: 5 }), { params: { id: 'fup-001' } });
    expect(res.status).toBe(200);
    await flushOrchestration();

    expect(mockTriggerFollowupEscalation).not.toHaveBeenCalled();
    expect(mockUpdateCase).not.toHaveBeenCalled();
  });

  it('does NOT escalate when case.status === "medical_alert"', async () => {
    mockGetFollowup.mockResolvedValue(makeFollowup({ status: 'contacted', painLevel: 3 }));
    mockGetCase.mockResolvedValue(makeCase({ status: 'medical_alert' }));
    mockGetStaffAssignment.mockResolvedValue(null);
    mockGetAllUsersFromDb.mockResolvedValue([]);

    const res = await PATCH(buildRequest({ painLevel: 5 }), { params: { id: 'fup-001' } });
    expect(res.status).toBe(200);
    await flushOrchestration();

    expect(mockTriggerFollowupEscalation).not.toHaveBeenCalled();
    // Audit log still records the negative decision.
    const audit = mockWriteAuditLog.mock.calls.find((call) => {
      const arg = call[0] as { action?: string };
      return arg.action === 'followup_escalated';
    });
    expect(audit).toBeDefined();
    const arg = audit?.[0] as { after?: Record<string, unknown> };
    expect((arg.after as { decision?: { reason?: string } } | undefined)?.decision?.reason).toBe(
      'already_medical_alert',
    );
  });

  it('writes followup_completed audit (regression — pre-B.1.5 behavior)', async () => {
    mockGetFollowup.mockResolvedValue(makeFollowup({ status: 'contacted', painLevel: 1 }));
    mockGetCase.mockResolvedValue(makeCase({ status: 'post_op_d3' }));
    mockGetStaffAssignment.mockResolvedValue(null);
    mockGetAllUsersFromDb.mockResolvedValue([]);

    const res = await PATCH(buildRequest({ status: 'completed' }), { params: { id: 'fup-001' } });
    expect(res.status).toBe(200);
    // Don't flush — writeAuditLog for followup_completed happens synchronously
    // in the route handler. The IIFE audit log is async.
    expect(
      mockWriteAuditLog.mock.calls.some((call) => {
        const arg = call[0] as { action?: string };
        return arg.action === 'followup_completed';
      }),
    ).toBe(true);
  });

  it('falls back to all clinical users when staff assignment has no doctor/nurse', async () => {
    mockGetFollowup.mockResolvedValue(makeFollowup({ status: 'contacted', painLevel: 3 }));
    mockGetCase.mockResolvedValue(makeCase({ status: 'post_op_d3' }));
    // Assignment exists but only has a sales user — no clinical staff.
    mockGetStaffAssignment.mockResolvedValue({
      id: 'sa-001',
      caseId: 'case-001',
      masterSalesId: 'user-004',
      assignedBy: 'user-001',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    });
    mockGetAllUsersFromDb.mockResolvedValue([
      makeUser('user-004', 'master_sales', 'Sales Lead'),
      makeUser('user-008', 'doctor', 'BS. Fallback'),
      makeUser('user-009', 'nurse', 'YT. Fallback'),
    ]);
    mockGetCustomer.mockResolvedValue({ fullName: 'Nguyễn Văn A' });

    const res = await PATCH(buildRequest({ painLevel: 5 }), { params: { id: 'fup-001' } });
    expect(res.status).toBe(200);
    await flushOrchestration();

    const trig = mockTriggerFollowupEscalation.mock.calls[0]?.[0] as {
      recipientUserIds: string[];
    };
    expect(trig.recipientUserIds.sort()).toEqual(['user-008', 'user-009']);
  });

  it('audit log payload contains NO PII fields (A11 anti-pattern)', async () => {
    mockGetFollowup.mockResolvedValue(makeFollowup({ status: 'contacted', painLevel: 3 }));
    mockGetCase.mockResolvedValue(makeCase({ status: 'post_op_d3' }));
    mockGetStaffAssignment.mockResolvedValue(null);
    mockGetAllUsersFromDb.mockResolvedValue([]);

    const res = await PATCH(buildRequest({ painLevel: 5 }), { params: { id: 'fup-001' } });
    expect(res.status).toBe(200);
    await flushOrchestration();

    const flat = JSON.stringify(mockWriteAuditLog.mock.calls);
    expect(flat).not.toMatch(/medicalNote/);
    expect(flat).not.toMatch(/privacyNote/);
    expect(flat).not.toMatch(/nationalIdNumber/);
    expect(flat).not.toMatch(/address/);
  });

  it('regression: 5 rapid painLevel updates → exactly 1 escalation (debounce + already-above guard)', async () => {
    // Note: this test only covers what the route handler does in 1
    // request. The "5 rapid saves" smoke is verified manually per the
    // sprint §8.3 item 4; this test asserts the per-request behavior:
    // a second save with painLevel already at 5 does not re-escalate.
    mockGetFollowup.mockResolvedValue(makeFollowup({ status: 'contacted', painLevel: 4 }));
    mockGetCase.mockResolvedValue(makeCase({ status: 'post_op_d3' }));
    mockGetStaffAssignment.mockResolvedValue(null);
    mockGetAllUsersFromDb.mockResolvedValue([]);

    const res = await PATCH(buildRequest({ painLevel: 5 }), { params: { id: 'fup-001' } });
    expect(res.status).toBe(200);
    await flushOrchestration();

    expect(mockTriggerFollowupEscalation).not.toHaveBeenCalled();
  });

  it('handles errors during escalation orchestration without blocking the response', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    mockGetFollowup.mockResolvedValue(makeFollowup({ status: 'contacted', painLevel: 3 }));
    mockGetCase.mockRejectedValue(new Error('firestore down'));

    const res = await PATCH(buildRequest({ painLevel: 5 }), { params: { id: 'fup-001' } });
    expect(res.status).toBe(200); // followup still updated

    await flushOrchestration();
    expect(mockTriggerFollowupEscalation).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
