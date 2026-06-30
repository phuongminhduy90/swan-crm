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

const mockGetCase = vi.fn();
const mockUpdateCaseStatus = vi.fn();
vi.mock('@/lib/firestore/cases', () => ({
  getCase: (...args: unknown[]) => mockGetCase(...args),
  updateCaseStatus: (...args: unknown[]) => mockUpdateCaseStatus(...args),
}));

const mockWriteAuditLog = vi.fn();
vi.mock('@/lib/firestore/audit', () => ({
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
}));

const mockGetCustomer = vi.fn();
vi.mock('@/lib/firestore/customers', () => ({
  getCustomer: (...args: unknown[]) => mockGetCustomer(...args),
}));

vi.mock('@/lib/notifications/trigger', () => ({
  triggerMedicalAlert: vi.fn(),
  triggerMedicalAlertResolved: vi.fn(),
  triggerComplaint: vi.fn(),
  triggerPostOpFollowupDue: vi.fn(),
  resolveCskhDisplayName: vi.fn(),
}));

vi.mock('@/lib/tasks/auto-tasks', () => ({
  triggerAutoTasks: vi.fn(),
}));

const mockCreatePostOpFollowups = vi.fn();
vi.mock('@/lib/firestore/followups', () => ({
  createPostOpFollowups: (...args: unknown[]) => mockCreatePostOpFollowups(...args),
}));

// Dynamic import AFTER mocks so the route module picks up the mocked deps.
import { PATCH } from '@/app/api/cases/[id]/status/route';
import { CASE_STATUS_CHANGE_ROLES } from '@/constants/permissions';
import type { CaseRecord, UserRole } from '@/lib/types';
import {
  triggerPostOpFollowupDue,
  resolveCskhDisplayName,
  triggerMedicalAlertResolved,
} from '@/lib/notifications/trigger';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildCase(overrides: Partial<CaseRecord> = {}): CaseRecord {
  return {
    id: 'case-001',
    caseCode: 'CASE-001',
    customerId: 'cust-001',
    caseDate: '2026-06-01T00:00:00.000Z',
    mainServiceGroup: 'nose',
    status: 'draft',
    priority: 'normal',
    totalBillBeforeDiscount: 10_000_000,
    totalBillAfterDiscount: 10_000_000,
    amountPaid: 0,
    remainingAmount: 10_000_000,
    paymentStatus: 'unpaid',
    privacyLevel: 'normal',
    createdBy: 'user-003',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  } as CaseRecord;
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

function buildRequest(role: UserRole, body: unknown): NextRequest {
  const userId = Object.entries(DEV_USER_MAP).find(([, r]) => r === role)![0];
  return new NextRequest(
    new Request('http://localhost:3000/api/cases/case-001/status', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-dev-user-id': userId,
      },
      body: JSON.stringify(body),
    }),
  );
}

function buildRequestWithId(role: UserRole, id: string, body: unknown): NextRequest {
  const userId = Object.entries(DEV_USER_MAP).find(([, r]) => r === role)![0];
  return new NextRequest(
    new Request(`http://localhost:3000/api/cases/${id}/status`, {
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
 * Story B.1.3 — Server-side role enforcement for case status.
 * ID: F-CRIT-05 | Sprint: 6.1 | Owner: FE-1
 *
 * @see docs/ux-redesign/STORY_B1_3_IMPLEMENTATION_REPORT.md
 */
describe('PATCH /api/cases/[id]/status — Story B.1.3 (F-CRIT-05)', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.clearAllMocks();
    // Default: case exists, all helper calls succeed.
    mockGetCase.mockResolvedValue(buildCase());
    mockUpdateCaseStatus.mockResolvedValue(undefined);
    mockWriteAuditLog.mockResolvedValue(undefined);
    mockGetCustomer.mockResolvedValue({ id: 'cust-001', fullName: 'Nguyễn Văn A' });
    mockCreatePostOpFollowups.mockResolvedValue(undefined);
    // B.1.7 default: CSKH resolves to a real display name. Individual tests
    // can override this to simulate the "no assignment" fallback path.
    (resolveCskhDisplayName as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      'Phạm Ngọc Điệp',
    );
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  // ── 1. Auth & permission gate ──────────────────────────────────────────────

  describe('auth gate', () => {
    it('returns 401 when x-dev-user-id is unknown to the dev map', async () => {
      const request = new NextRequest(
        new Request('http://localhost:3000/api/cases/case-001/status', {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            'x-dev-user-id': 'unknown-user-zzz',
          },
          body: JSON.stringify({ status: 'cancelled' }),
        }),
      );
      const res = await PATCH(request, { params: { id: 'case-001' } });
      expect(res.status).toBe(401);
    });

    it('returns 403 when the role lacks cases:write (e.g. media)', async () => {
      const res = await PATCH(buildRequest('media', { status: 'cancelled' }), {
        params: { id: 'case-001' },
      });
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string };
      expect(json.error).toMatch(/cases:write/);
    });
  });

  // ── 2. B.1.3 server RBAC guard (flag OFF → no role restriction) ───────────

  describe('when FEATURE_SERVER_RBAC is OFF (default)', () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_FEATURE_SERVER_RBAC;
    });

    it('allows sales_online to change status (legacy behavior preserved)', async () => {
      const res = await PATCH(
        buildRequest('sales_online', { status: 'waiting_payment_confirmation' }),
        { params: { id: 'case-001' } },
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(true);
    });

    it('still allows cso to change status', async () => {
      const res = await PATCH(
        buildRequest('cso', { status: 'waiting_payment_confirmation' }),
        { params: { id: 'case-001' } },
      );
      expect(res.status).toBe(200);
    });
  });

  // ── 3. B.1.3 server RBAC guard (flag ON → CASE_STATUS_CHANGE_ROLES enforced)

  describe('when FEATURE_SERVER_RBAC is ON', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_FEATURE_SERVER_RBAC = 'true';
    });

    it('returns 403 for sales_online attempting any status change', async () => {
      const res = await PATCH(
        buildRequest('sales_online', { status: 'waiting_payment_confirmation' }),
        { params: { id: 'case-001' } },
      );
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string };
      expect(json.error).toMatch(/sales_online/);
      // Side-effects must NOT have run — guard happens before any data mutation.
      expect(mockUpdateCaseStatus).not.toHaveBeenCalled();
      expect(mockWriteAuditLog).not.toHaveBeenCalled();
    });

    it('returns 403 for sales_offline attempting any status change', async () => {
      const res = await PATCH(
        buildRequest('sales_offline', { status: 'waiting_payment_confirmation' }),
        { params: { id: 'case-001' } },
      );
      expect(res.status).toBe(403);
    });

    it('returns 403 for media (no cases:write anyway, but the role check still short-circuits)', async () => {
      const res = await PATCH(
        buildRequest('media', { status: 'cancelled' }),
        { params: { id: 'case-001' } },
      );
      expect(res.status).toBe(403);
    });

    it('returns 200 for cso on a valid transition', async () => {
      const res = await PATCH(
        buildRequest('cso', { status: 'waiting_payment_confirmation' }),
        { params: { id: 'case-001' } },
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(true);
      expect(mockUpdateCaseStatus).toHaveBeenCalledWith(
        'case-001',
        'waiting_payment_confirmation',
        'user-003',
      );
      expect(mockWriteAuditLog).toHaveBeenCalledOnce();
    });

    it('returns 200 for master_sales on a valid transition', async () => {
      const res = await PATCH(
        buildRequest('master_sales', { status: 'waiting_payment_confirmation' }),
        { params: { id: 'case-001' } },
      );
      expect(res.status).toBe(200);
    });

    it('returns 200 for doctor on a valid medically_approved → scheduled transition', async () => {
      mockGetCase.mockResolvedValue(buildCase({ status: 'medically_approved' }));
      const res = await PATCH(
        buildRequest('doctor', { status: 'scheduled' }),
        { params: { id: 'case-001' } },
      );
      expect(res.status).toBe(200);
    });

    it('returns 403 for nurse (nurse has no cases:write permission, so the auth gate rejects)', async () => {
      // nurse is in CASE_STATUS_CHANGE_ROLES but does not have cases:write
      // permission, so the route's permission gate rejects before the B.1.3
      // role guard runs. The 403 is from the cases:write check, not the
      // role guard. This is correct layering.
      const res = await PATCH(
        buildRequest('nurse', { status: 'post_op_d3' }),
        { params: { id: 'case-001' } },
      );
      expect(res.status).toBe(403);
    });

    it('returns 403 for cskh_postop (cskh_postop has no cases:write permission, so the auth gate rejects)', async () => {
      // cskh_postop is in CASE_STATUS_CHANGE_ROLES but does not have
      // cases:write permission. Same layering as nurse.
      const res = await PATCH(
        buildRequest('cskh_postop', { status: 'completed' }),
        { params: { id: 'case-001' } },
      );
      expect(res.status).toBe(403);
    });

    it('returns 200 for coordinator on a valid transition', async () => {
      const res = await PATCH(
        buildRequest('coordinator', { status: 'waiting_payment_confirmation' }),
        { params: { id: 'case-001' } },
      );
      expect(res.status).toBe(200);
    });
  });

  // ── 4. Transition validation (always on) ───────────────────────────────────

  describe('transition validation', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_FEATURE_SERVER_RBAC = 'true';
    });

    it('returns 400 for hospital_confirmed → scheduled (B.1.2 clinical gate)', async () => {
      mockGetCase.mockResolvedValue(buildCase({ status: 'hospital_confirmed' }));
      const res = await PATCH(buildRequest('cso', { status: 'scheduled' }), {
        params: { id: 'case-001' },
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toMatch(/hospital_confirmed/);
      expect(json.error).toMatch(/scheduled/);
      expect(mockUpdateCaseStatus).not.toHaveBeenCalled();
      expect(mockWriteAuditLog).not.toHaveBeenCalled();
    });

    it('returns 400 for draft → scheduled (not a valid transition at all)', async () => {
      mockGetCase.mockResolvedValue(buildCase({ status: 'draft' }));
      const res = await PATCH(buildRequest('cso', { status: 'scheduled' }), {
        params: { id: 'case-001' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 200 for the SOLE direct entry into scheduled: medically_approved → scheduled', async () => {
      mockGetCase.mockResolvedValue(buildCase({ status: 'medically_approved' }));
      const res = await PATCH(buildRequest('cso', { status: 'scheduled' }), {
        params: { id: 'case-001' },
      });
      expect(res.status).toBe(200);
    });
  });

  // ── 5. Audit log on every successful change ────────────────────────────────

  describe('audit log', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_FEATURE_SERVER_RBAC = 'true';
    });

    it('writes a case_status_changed audit log on success', async () => {
      await PATCH(
        buildRequest('cso', { status: 'waiting_payment_confirmation', note: 'B.1.3 audit' }),
        { params: { id: 'case-001' } },
      );
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'case_status_changed',
          entityType: 'case',
          entityId: 'case-001',
          before: { status: 'draft' },
          after: { status: 'waiting_payment_confirmation', note: 'B.1.3 audit' },
        }),
      );
    });

    it('does NOT write an audit log when the role guard rejects (403)', async () => {
      await PATCH(
        buildRequest('sales_online', { status: 'waiting_payment_confirmation' }),
        { params: { id: 'case-001' } },
      );
      expect(mockWriteAuditLog).not.toHaveBeenCalled();
    });

    it('does NOT write an audit log when the transition is invalid (400)', async () => {
      mockGetCase.mockResolvedValue(buildCase({ status: 'hospital_confirmed' }));
      await PATCH(buildRequest('cso', { status: 'scheduled' }), {
        params: { id: 'case-001' },
      });
      expect(mockWriteAuditLog).not.toHaveBeenCalled();
    });
  });

  // ── 6. Allow-list invariant (pinned in code AND data) ─────────────────────

  describe('CASE_STATUS_CHANGE_ROLES allow-list invariants', () => {
    it('contains exactly the 7 roles specified by Decision A', () => {
      // If this list changes, the B.1.3 RBAC contract changes. Pin the
      // expected size so a future PR cannot silently add/remove a role
      // without updating the documented decision.
      expect(CASE_STATUS_CHANGE_ROLES).toHaveLength(7);
      expect([...CASE_STATUS_CHANGE_ROLES].sort()).toEqual(
        ['admin', 'cskh_postop', 'coordinator', 'cso', 'doctor', 'master_sales', 'nurse'].sort(),
      );
    });

    it('does NOT include any sales role (Decision A)', () => {
      expect(CASE_STATUS_CHANGE_ROLES).not.toContain('sales_online');
      expect(CASE_STATUS_CHANGE_ROLES).not.toContain('sales_offline');
    });
  });

  // ── 7. Misc ────────────────────────────────────────────────────────────────

  describe('misc', () => {
    it('returns 404 when the case does not exist', async () => {
      mockGetCase.mockResolvedValue(null);
      const res = await PATCH(
        buildRequestWithId('cso', 'missing', { status: 'waiting_payment_confirmation' }),
        { params: { id: 'missing' } },
      );
      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid request body (missing status)', async () => {
      const res = await PATCH(buildRequest('cso', { note: 'no status' }), {
        params: { id: 'case-001' },
      });
      expect(res.status).toBe(400);
    });
  });

  // ── 8. Story B.1.7 — CSKH display name resolution on post_op_* transitions

  /**
   * Story B.1.7 (F-MED-19) — Resolve CSKH name dynamically from staff
   * assignment when sending post-op follow-up due notifications. Replaces
   * the previous hardcoded literal `'CSKH'` passed to
   * `triggerPostOpFollowupDue`.
   *
   * @see docs/ux-redesign/STORY_B1_7_IMPLEMENTATION_REPORT.md
   */
  describe('post-op followup — CSKH name resolution (Story B.1.7 / F-MED-19)', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_FEATURE_SERVER_RBAC = 'true';
    });

    it('passes the resolved CSKH display name (not literal "CSKH") to triggerPostOpFollowupDue', async () => {
      (resolveCskhDisplayName as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        'Phạm Ngọc Điệp',
      );
      // Source status must allow transitioning to post_op_d3 — i.e. post_op_d1.
      mockGetCase.mockResolvedValue(buildCase({ status: 'post_op_d1' }));

      const res = await PATCH(
        buildRequest('cso', { status: 'post_op_d3' }),
        { params: { id: 'case-001' } },
      );
      expect(res.status).toBe(200);

      expect(resolveCskhDisplayName).toHaveBeenCalledWith('case-001');
      expect(triggerPostOpFollowupDue).toHaveBeenCalledTimes(1);
      const callArgs = (triggerPostOpFollowupDue as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0] as unknown[];
      // arg layout: (caseCode, customerId, caseId, customerName, followupDay, assigneeName, assigneeId)
      expect(callArgs[0]).toBe('CASE-001');
      expect(callArgs[2]).toBe('case-001');
      // followupDay is produced by `newStatus.replace('post_op_','D').toUpperCase()`
      // — for `post_op_d3` this yields `'DD3'` (a pre-existing quirk of the
      // status-derived label; out of B.1.7 scope). B.1.7 only asserts on the
      // CSKH name (index 5).
      expect(callArgs[4]).toBe('DD3');
      // assigneeName (index 5) must be the resolved display name, NOT 'CSKH'.
      expect(callArgs[5]).toBe('Phạm Ngọc Điệp');
      expect(callArgs[5]).not.toBe('CSKH');
      expect(callArgs[6]).toBe('user-003');
    });

    it('falls back to the literal "CSKH" string when resolveCskhDisplayName returns the fallback', async () => {
      // Mirrors the production behavior when no staff assignment exists —
      // resolveCskhDisplayName returns the literal 'CSKH' string, which the
      // route must propagate unchanged.
      (resolveCskhDisplayName as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        'CSKH',
      );
      mockGetCase.mockResolvedValue(buildCase({ status: 'post_op_d3' }));

      const res = await PATCH(
        buildRequest('cso', { status: 'post_op_d7' }),
        { params: { id: 'case-001' } },
      );
      expect(res.status).toBe(200);

      const callArgs = (triggerPostOpFollowupDue as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0] as unknown[];
      expect(callArgs[5]).toBe('CSKH');
    });

    it('does NOT throw the route when resolveCskhDisplayName rejects (defensive)', async () => {
      // resolveCskhDisplayName itself is supposed to swallow errors and
      // return the fallback, but if a future regression lets one escape,
      // the route must still respond 200 (the status change already
      // succeeded).
      (resolveCskhDisplayName as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('lookup blew up'),
      );
      mockGetCase.mockResolvedValue(buildCase({ status: 'procedure_completed' }));

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const res = await PATCH(
        buildRequest('cso', { status: 'post_op_d1' }),
        { params: { id: 'case-001' } },
      );

      // Status change itself succeeded.
      expect(res.status).toBe(200);
      expect(mockUpdateCaseStatus).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('does not call resolveCskhDisplayName for non-post-op transitions', async () => {
      // resolveCskhDisplayName must only be consulted for post_op_* statuses
      // — not for medical_alert, complaint, draft, etc.
      const res = await PATCH(
        buildRequest('cso', { status: 'waiting_payment_confirmation' }),
        { params: { id: 'case-001' } },
      );
      expect(res.status).toBe(200);
      expect(resolveCskhDisplayName).not.toHaveBeenCalled();
    });

    it('resolves CSKH for every post_op_* day variant (D1/D3/D7/D14/D30/D90)', async () => {
      // Each post_op_* status requires its predecessor as the source case status
      // (per CASE_STATUS_TRANSITIONS): d1←procedure_completed, d3←d1, d7←d3, …
      // followupDay is computed via `newStatus.replace('post_op_','D').toUpperCase()`
      // — a pre-existing label format quirk producing 'DD1', 'DD3', etc. B.1.7
      // only asserts on the CSKH display name (assigneeName, index 5).
      const days: Array<{ from: string; to: string; label: string }> = [
        { from: 'procedure_completed', to: 'post_op_d1', label: 'DD1' },
        { from: 'post_op_d1', to: 'post_op_d3', label: 'DD3' },
        { from: 'post_op_d3', to: 'post_op_d7', label: 'DD7' },
        { from: 'post_op_d7', to: 'post_op_d14', label: 'DD14' },
        { from: 'post_op_d14', to: 'post_op_d30', label: 'DD30' },
        { from: 'post_op_d30', to: 'post_op_d90', label: 'DD90' },
      ];

      for (const { from, to, label } of days) {
        mockGetCase.mockResolvedValue(buildCase({ status: from as CaseRecord['status'] }));
        (resolveCskhDisplayName as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
          'Phạm Ngọc Điệp',
        );
        const res = await PATCH(buildRequest('cso', { status: to }), {
          params: { id: 'case-001' },
        });
        expect(res.status).toBe(200);
        const callArgs = (triggerPostOpFollowupDue as unknown as ReturnType<typeof vi.fn>).mock
          .calls.slice(-1)[0] as unknown[];
        expect(callArgs[5]).toBe('Phạm Ngọc Điệp');
        expect(callArgs[4]).toBe(label);
      }
    });
  });
});

/**
 * Story B.2.2 (F-HIGH-19) — `medical_alert_resolved` terminal status + transitions.
 *
 * Acceptance criteria:
 *   - `medical_alert` CAN transition to `medical_alert_resolved`
 *   - `medical_alert` CANNOT transition to `procedure_completed` (removed)
 *   - `medical_alert_resolved` is terminal (no outgoing transitions)
 *   - `triggerMedicalAlertResolved` is fired on successful transition
 */
describe('medical_alert_resolved — Story B.2.2 (F-HIGH-19)', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.clearAllMocks();
    mockGetCase.mockResolvedValue(buildCase({ status: 'medical_alert' }));
    mockUpdateCaseStatus.mockResolvedValue(undefined);
    mockWriteAuditLog.mockResolvedValue(undefined);
    mockGetCustomer.mockResolvedValue({ id: 'cust-001', fullName: 'Khách hàng A' });
    mockCreatePostOpFollowups.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('allows medical_alert → medical_alert_resolved (200)', async () => {
    const res = await PATCH(
      buildRequest('cso', { status: 'medical_alert_resolved' }),
      { params: { id: 'case-001' } },
    );
    expect(res.status).toBe(200);
    expect(mockUpdateCaseStatus).toHaveBeenCalledWith(
      'case-001',
      'medical_alert_resolved',
      'user-003',
    );
    expect(mockWriteAuditLog).toHaveBeenCalled();
  });

  it('rejects medical_alert → procedure_completed (400)', async () => {
    const res = await PATCH(
      buildRequest('cso', { status: 'procedure_completed' }),
      { params: { id: 'case-001' } },
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/procedure_completed/);
    expect(mockUpdateCaseStatus).not.toHaveBeenCalled();
  });

  it('fires triggerMedicalAlertResolved on successful medical_alert → medical_alert_resolved', async () => {
    await PATCH(
      buildRequest('cso', { status: 'medical_alert_resolved' }),
      { params: { id: 'case-001' } },
    );
    expect(triggerMedicalAlertResolved).toHaveBeenCalledOnce();
  });

  it('does NOT fire triggerMedicalAlert when transitioning to medical_alert_resolved', async () => {
    const { triggerMedicalAlert: mockTriggerAlert } = await import('@/lib/notifications/trigger');
    await PATCH(
      buildRequest('cso', { status: 'medical_alert_resolved' }),
      { params: { id: 'case-001' } },
    );
    expect(mockTriggerAlert).not.toHaveBeenCalled();
  });

  it('medical_alert_resolved is terminal: no outgoing transitions from it', async () => {
    mockGetCase.mockResolvedValue(buildCase({ status: 'medical_alert_resolved' }));
    // Attempting to transition FROM medical_alert_resolved to anything should fail
    const res = await PATCH(
      buildRequest('cso', { status: 'completed' }),
      { params: { id: 'case-001' } },
    );
    expect(res.status).toBe(400);
    expect(mockUpdateCaseStatus).not.toHaveBeenCalled();
  });
});
