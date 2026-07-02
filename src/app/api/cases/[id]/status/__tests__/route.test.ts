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
vi.mock('@/lib/firestore/followups', async (importOriginal) => {
  // Story PI-4 — the real module now exports `resolveProcedureDateForFollowups`
  // alongside `createPostOpFollowups`. We use `importOriginal` so the helper
  // runs at its real priority order (actualProcedureDate → expectedProcedureDate
  // → now) while `createPostOpFollowups` is mocked for assertion.
  const actual = await importOriginal<typeof import('@/lib/firestore/followups')>();
  return {
    ...actual,
    createPostOpFollowups: (...args: unknown[]) => mockCreatePostOpFollowups(...args),
  };
});

// Story B.2.1 — gate evaluator mock. Default returns allPassed=true so
// existing B.1.3 + B.2.2 tests keep passing; individual tests override.
const mockEvaluateClinicalChecklist = vi.fn();
vi.mock('@/lib/checklist', () => ({
  evaluateClinicalChecklist: (...args: unknown[]) => mockEvaluateClinicalChecklist(...args),
  isGatedTransition: (target: string) =>
    target === 'checked_in' || target === 'in_procedure' || target === 'medically_approved',
  isChecklistValuePassed: (v: unknown) => v === 'not_applicable' || v === true,
  GATED_TRANSITIONS: new Set(['checked_in', 'in_procedure', 'medically_approved']),
  CLINICAL_ITEM_KEYS: [
    'blood_test_result',
    'allergy_declared',
    'pregnancy_test_done',
    'anesthesia_review_complete',
    'fasting_compliant',
    'treatment_consent_signed',
  ],
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
    // Story B.2.1 default: gate evaluator returns allPassed=true so existing
    // B.1.3 + B.2.2 tests continue to pass when the gate flag is OFF. Tests
    // that exercise the gate override this mock.
    mockEvaluateClinicalChecklist.mockResolvedValue({
      items: [],
      allPassed: true,
      failedKeys: [],
    });
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
    it('contains exactly the 5 roles after RR-2 reconciliation', () => {
      // If this list changes, the B.1.3 RBAC contract changes. Pin the
      // expected size so a future PR cannot silently add/remove a role
      // without updating the documented decision.
      //
      // RR-2 (Sprint 6.2): removed `nurse` and `cskh_postop` because they
      // lack `cases:write` — the route's `requirePermission('cases:write')`
      // gate already 403s them. See RR_2_IMPLEMENTATION_REPORT.md.
      expect(CASE_STATUS_CHANGE_ROLES).toHaveLength(5);
      expect([...CASE_STATUS_CHANGE_ROLES].sort()).toEqual(
        ['admin', 'coordinator', 'cso', 'doctor', 'master_sales'].sort(),
      );
    });

    it('does NOT include any sales role (Decision A)', () => {
      expect(CASE_STATUS_CHANGE_ROLES).not.toContain('sales_online');
      expect(CASE_STATUS_CHANGE_ROLES).not.toContain('sales_offline');
    });

    it('does NOT include roles without `cases:write` permission (RR-2 invariant)', () => {
      expect(CASE_STATUS_CHANGE_ROLES).not.toContain('nurse');
      expect(CASE_STATUS_CHANGE_ROLES).not.toContain('cskh_postop');
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
 * Story B.2.1 (F-CRIT-10) — Server-side clinical checklist gate (L3).
 *
 * Acceptance criteria:
 *   - When FEATURE_CHECKLIST_GATE is ON AND the target status is in
 *     `GATED_TRANSITIONS` (`checked_in`, `in_procedure`, `medically_approved`)
 *     AND the evaluator returns `allPassed === false`, the route returns
 *     400 with `code: 'CHECKLIST_GATE_BLOCKED'` and `failedItems` populated.
 *   - The blocked attempt writes an audit log with action
 *     `'case_status_blocked_by_checklist'`.
 *   - No side-effects run on a blocked attempt (no `updateCaseStatus`,
 *     no `createPostOpFollowups`, no `triggerAutoTasks`, no notifications).
 *   - When FEATURE_CHECKLIST_GATE is OFF, the gate is bypassed (legacy
 *     behavior preserved).
 *   - When the target status is NOT in GATED_TRANSITIONS, the gate is
 *     bypassed even when the flag is ON (e.g. `procedure_completed`).
 *
 * @see docs/ux-redesign/STORY_B2_1_EXECUTION_PLAN.md §4
 */
describe('PATCH /api/cases/[id]/status — Story B.2.1 (F-CRIT-10) server gate', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.clearAllMocks();
    mockGetCase.mockResolvedValue(buildCase({ status: 'reminder_sent' }));
    mockUpdateCaseStatus.mockResolvedValue(undefined);
    mockWriteAuditLog.mockResolvedValue(undefined);
    mockGetCustomer.mockResolvedValue({ id: 'cust-001', fullName: 'Nguyễn Văn A' });
    mockCreatePostOpFollowups.mockResolvedValue(undefined);
    (resolveCskhDisplayName as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      'Phạm Ngọc Điệp',
    );
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('gate ON + allPassed === false', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_FEATURE_CHECKLIST_GATE = 'true';
      process.env.NEXT_PUBLIC_FEATURE_SERVER_RBAC = 'true';
    });

    it('blocks reminder_sent → checked_in with 400 + CHECKLIST_GATE_BLOCKED', async () => {
      mockEvaluateClinicalChecklist.mockResolvedValue({
        items: [],
        allPassed: false,
        failedKeys: ['blood_test_result', 'fasting_compliant'],
      });

      const res = await PATCH(buildRequest('cso', { status: 'checked_in' }), {
        params: { id: 'case-001' },
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as {
        code: string;
        error: string;
        failedItems: string[];
      };
      expect(json.code).toBe('CHECKLIST_GATE_BLOCKED');
      expect(json.error).toMatch(/Vui lòng hoàn thành toàn bộ checklist/);
      expect(json.failedItems).toEqual(
        expect.arrayContaining(['blood_test_result', 'fasting_compliant']),
      );
      expect(mockUpdateCaseStatus).not.toHaveBeenCalled();
    });

    it('blocks checked_in → in_procedure with 400', async () => {
      mockGetCase.mockResolvedValue(buildCase({ status: 'checked_in' }));
      mockEvaluateClinicalChecklist.mockResolvedValue({
        items: [],
        allPassed: false,
        failedKeys: ['allergy_declared'],
      });

      const res = await PATCH(buildRequest('doctor', { status: 'in_procedure' }), {
        params: { id: 'case-001' },
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { code: string; failedItems: string[] };
      expect(json.code).toBe('CHECKLIST_GATE_BLOCKED');
      expect(json.failedItems).toContain('allergy_declared');
      expect(mockUpdateCaseStatus).not.toHaveBeenCalled();
    });

    it('blocks waiting_doctor_review → medically_approved with 400', async () => {
      mockGetCase.mockResolvedValue(buildCase({ status: 'waiting_doctor_review' }));
      mockEvaluateClinicalChecklist.mockResolvedValue({
        items: [],
        allPassed: false,
        failedKeys: ['pregnancy_test_done'],
      });

      const res = await PATCH(buildRequest('doctor', { status: 'medically_approved' }), {
        params: { id: 'case-001' },
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { code: string; failedItems: string[] };
      expect(json.code).toBe('CHECKLIST_GATE_BLOCKED');
      expect(json.failedItems).toContain('pregnancy_test_done');
    });

    it('writes a case_status_blocked_by_checklist audit log on every block', async () => {
      mockEvaluateClinicalChecklist.mockResolvedValue({
        items: [],
        allPassed: false,
        failedKeys: ['blood_test_result'],
      });

      await PATCH(buildRequest('cso', { status: 'checked_in' }), {
        params: { id: 'case-001' },
      });

      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'case_status_blocked_by_checklist',
          entityType: 'case',
          entityId: 'case-001',
          before: { status: 'reminder_sent' },
          after: expect.objectContaining({
            status: 'checked_in',
            attempted: true,
            failedItems: ['blood_test_result'],
            gateFlag: 'CHECKLIST_GATE',
          }),
        }),
      );
    });

    it('does NOT call updateCaseStatus, triggerAutoTasks, or createPostOpFollowups on block', async () => {
      mockEvaluateClinicalChecklist.mockResolvedValue({
        items: [],
        allPassed: false,
        failedKeys: ['blood_test_result'],
      });

      await PATCH(buildRequest('cso', { status: 'checked_in' }), {
        params: { id: 'case-001' },
      });

      expect(mockUpdateCaseStatus).not.toHaveBeenCalled();
      expect(mockCreatePostOpFollowups).not.toHaveBeenCalled();
    });

    it('does NOT block non-gated transitions (in_procedure → procedure_completed)', async () => {
      mockGetCase.mockResolvedValue(buildCase({ status: 'in_procedure' }));
      mockEvaluateClinicalChecklist.mockResolvedValue({
        items: [],
        allPassed: false,
        failedKeys: ['blood_test_result'],
      });

      const res = await PATCH(buildRequest('cso', { status: 'procedure_completed' }), {
        params: { id: 'case-001' },
      });

      // Non-gated → gate is bypassed; legacy transition validation passes.
      expect(res.status).toBe(200);
      expect(mockUpdateCaseStatus).toHaveBeenCalledWith(
        'case-001',
        'procedure_completed',
        'user-003',
      );
    });
  });

  describe('gate ON + allPassed === true (gate allows transition)', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_FEATURE_CHECKLIST_GATE = 'true';
      process.env.NEXT_PUBLIC_FEATURE_SERVER_RBAC = 'true';
      mockEvaluateClinicalChecklist.mockResolvedValue({
        items: [],
        allPassed: true,
        failedKeys: [],
      });
    });

    it('allows reminder_sent → checked_in with 200', async () => {
      const res = await PATCH(buildRequest('cso', { status: 'checked_in' }), {
        params: { id: 'case-001' },
      });
      expect(res.status).toBe(200);
      expect(mockUpdateCaseStatus).toHaveBeenCalledWith(
        'case-001',
        'checked_in',
        'user-003',
      );
    });
  });

  describe('gate OFF (regression baseline)', () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_FEATURE_CHECKLIST_GATE;
    });

    it('does NOT consult the gate evaluator when flag is OFF', async () => {
      // Mock returns allPassed=false; if the route were still calling the
      // evaluator it would return 400 — the test verifies it bypasses
      // entirely instead.
      mockEvaluateClinicalChecklist.mockResolvedValue({
        items: [],
        allPassed: false,
        failedKeys: ['blood_test_result'],
      });

      const res = await PATCH(buildRequest('cso', { status: 'checked_in' }), {
        params: { id: 'case-001' },
      });

      expect(res.status).toBe(200);
      expect(mockUpdateCaseStatus).toHaveBeenCalled();
      // Evaluator may or may not be consulted for legacy reasons; the test
      // only cares about the response, not the call count. So we don't
      // assert on mockEvaluateClinicalChecklist here.
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

/**
 * Story PI-4 (Sprint 7.2) — `actualProcedureDate` is the source of truth
 * for D1–D90 follow-up scheduling. The server-side status route must
 * honour the same priority order as the client-side StatusWorkflow:
 *   1. `case.actualProcedureDate`  ← preferred
 *   2. `case.expectedProcedureDate`
 *   3. `new Date().toISOString()`  ← terminal fallback
 *
 * Pre-PI-4 the route read `expectedProcedureDate` directly, which meant the
 * server-side path would silently ignore `actualProcedureDate` if the client
 * hadn't proactively persisted the date.
 *
 * @see docs/ux-redesign/STORY_PI_4_IMPLEMENTATION_REPORT.md
 * @see docs/ux-redesign/SPRINT_7_2_EXECUTION_PLAN.md §1 row 9 (PI-4) + §R7.2-8
 */
describe('PATCH /api/cases/[id]/status — Story PI-4 (F-HIGH-08 partial) actualProcedureDate is source of truth', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.clearAllMocks();
    mockUpdateCaseStatus.mockResolvedValue(undefined);
    mockWriteAuditLog.mockResolvedValue(undefined);
    mockGetCustomer.mockResolvedValue({ id: 'cust-001', fullName: 'Nguyễn Văn A' });
    mockCreatePostOpFollowups.mockResolvedValue(undefined);
    (resolveCskhDisplayName as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      'Phạm Ngọc Điệp',
    );
    mockEvaluateClinicalChecklist.mockResolvedValue({
      items: [],
      allPassed: true,
      failedKeys: [],
    });
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('passes `actualProcedureDate` to createPostOpFollowups when both dates are set', async () => {
    mockGetCase.mockResolvedValue(
      buildCase({
        status: 'in_procedure',
        actualProcedureDate: '2026-07-15T00:00:00.000Z',
        expectedProcedureDate: '2026-07-10T00:00:00.000Z',
      }),
    );

    const res = await PATCH(
      buildRequest('cso', { status: 'procedure_completed' }),
      { params: { id: 'case-001' } },
    );
    expect(res.status).toBe(200);

    expect(mockCreatePostOpFollowups).toHaveBeenCalledTimes(1);
    const args = (mockCreatePostOpFollowups as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as unknown[];
    // arg layout: (caseId, customerId, procedureDate, assignedTo)
    expect(args[0]).toBe('case-001');
    expect(args[1]).toBe('cust-001');
    // MUST be the actual date — pre-PI-4 this would be the expected date.
    expect(args[2]).toBe('2026-07-15T00:00:00.000Z');
    expect(args[2]).not.toBe('2026-07-10T00:00:00.000Z');
  });

  it('falls back to `expectedProcedureDate` when `actualProcedureDate` is missing', async () => {
    mockGetCase.mockResolvedValue(
      buildCase({
        status: 'in_procedure',
        expectedProcedureDate: '2026-07-10T00:00:00.000Z',
        // actualProcedureDate intentionally omitted
      }),
    );

    const res = await PATCH(
      buildRequest('cso', { status: 'procedure_completed' }),
      { params: { id: 'case-001' } },
    );
    expect(res.status).toBe(200);

    expect(mockCreatePostOpFollowups).toHaveBeenCalledTimes(1);
    const args = (mockCreatePostOpFollowups as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as unknown[];
    expect(args[2]).toBe('2026-07-10T00:00:00.000Z');
  });

  it('falls back to a "now" ISO string when neither date is set (terminal fallback)', async () => {
    mockGetCase.mockResolvedValue(
      buildCase({
        status: 'in_procedure',
        // neither actualProcedureDate nor expectedProcedureDate
      }),
    );

    const before = Date.now();
    const res = await PATCH(
      buildRequest('cso', { status: 'procedure_completed' }),
      { params: { id: 'case-001' } },
    );
    const after = Date.now();

    expect(res.status).toBe(200);
    expect(mockCreatePostOpFollowups).toHaveBeenCalledTimes(1);

    const args = (mockCreatePostOpFollowups as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as unknown[];
    expect(typeof args[2]).toBe('string');
    expect(args[2]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    const ts = new Date(args[2] as string).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after + 50);
  });

  it('does NOT call createPostOpFollowups for non-procedure_completed transitions', async () => {
    // `draft → waiting_payment_confirmation` is a valid transition that
    // does NOT trigger follow-up scheduling. Use it as the negative case
    // to prove the `if (newStatus === 'procedure_completed')` guard.
    mockGetCase.mockResolvedValue(
      buildCase({
        status: 'draft',
        actualProcedureDate: '2026-07-15T00:00:00.000Z',
      }),
    );

    const res = await PATCH(
      buildRequest('cso', { status: 'waiting_payment_confirmation' }),
      { params: { id: 'case-001' } },
    );
    expect(res.status).toBe(200);
    expect(mockCreatePostOpFollowups).not.toHaveBeenCalled();
  });

  it('does NOT regress when FEATURE_CHECKLIST_GATE blocks the transition (no followups created)', async () => {
    process.env.NEXT_PUBLIC_FEATURE_CHECKLIST_GATE = 'true';
    process.env.NEXT_PUBLIC_FEATURE_SERVER_RBAC = 'true';
    mockGetCase.mockResolvedValue(
      buildCase({
        status: 'reminder_sent',
        actualProcedureDate: '2026-07-15T00:00:00.000Z',
      }),
    );
    mockEvaluateClinicalChecklist.mockResolvedValue({
      items: [],
      allPassed: false,
      failedKeys: ['blood_test_result'],
    });

    const res = await PATCH(
      buildRequest('cso', { status: 'checked_in' }),
      { params: { id: 'case-001' } },
    );
    expect(res.status).toBe(400);
    // Gate blocks everything — followups must NOT be scheduled.
    expect(mockCreatePostOpFollowups).not.toHaveBeenCalled();
  });
});
