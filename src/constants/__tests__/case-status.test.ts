import { describe, it, expect } from 'vitest';
import { CASE_STATUS_TRANSITIONS } from '@/constants/case-status';
import { CASE_STATUS_CHANGE_ROLES } from '@/constants/permissions';
import type { CaseStatus, UserRole } from '@/lib/types';

/**
 * Story B.1.2 — Remove `'scheduled'` from `hospital_confirmed` transitions.
 * ID: F-CRIT-04 | Sprint: 6.1 | Owner: FE-1
 *
 * Rationale: `hospital_confirmed → scheduled` allowed a case to skip clinical
 * clearance (doctor review + lab). After the fix, `scheduled` is reachable
 * only via `medically_approved`.
 *
 * See docs/ux-redesign/STORY_B1_2_MIGRATION_NOTES.md.
 */
describe("CASE_STATUS_TRANSITIONS — Story B.1.2 (F-CRIT-04)", () => {
  describe("hospital_confirmed allowed transitions", () => {
    const allowed = (CASE_STATUS_TRANSITIONS['hospital_confirmed'] ?? []) as CaseStatus[];

    it("does NOT include 'scheduled' (clinical gate enforced)", () => {
      expect(allowed).not.toContain('scheduled');
    });

    it("still includes 'waiting_doctor_review'", () => {
      expect(allowed).toContain('waiting_doctor_review');
    });

    it("still includes 'waiting_lab_test'", () => {
      expect(allowed).toContain('waiting_lab_test');
    });

    it("has exactly the two documented valid forward transitions", () => {
      expect(allowed).toEqual(['waiting_doctor_review', 'waiting_lab_test']);
    });
  });

  describe("clinical gate path remains reachable", () => {
    it("'scheduled' is still reachable via 'medically_approved' (the only entry point)", () => {
      const fromMedicallyApproved =
        (CASE_STATUS_TRANSITIONS['medically_approved'] ?? []) as CaseStatus[];
      expect(fromMedicallyApproved).toContain('scheduled');
    });

    it("'medically_approved' is the SOLE direct entry point into 'scheduled'", () => {
      // Every status that points into 'scheduled' must funnel through the
      // clinical clearance stage. This guards against future regressions that
      // re-introduce a back-door skip.
      const entryPoints = (
        Object.entries(CASE_STATUS_TRANSITIONS) as Array<[CaseStatus, CaseStatus[]]>
      )
        .filter(([, targets]) => targets.includes('scheduled'))
        .map(([from]) => from)
        .sort();

      // Note: `lab_test_done` and `waiting_lab_test` reach `scheduled` only
      // transitively (via `medically_approved`), so they are not direct
      // entry points. The single direct entry into `scheduled` is
      // `medically_approved` — any addition here would re-open the
      // F-CRIT-04 clinical gate.
      expect(entryPoints).toEqual(['medically_approved']);
    });
  });

  describe("regression — other transition rows untouched", () => {
    it("'draft' transitions are preserved", () => {
      expect(CASE_STATUS_TRANSITIONS.draft).toEqual([
        'waiting_customer_info',
        'waiting_payment_confirmation',
        'cancelled',
      ]);
    });

    it("'medical_alert' transitions are unchanged (B.2.2 owns those)", () => {
      expect(CASE_STATUS_TRANSITIONS.medical_alert).toEqual([
        'procedure_completed',
        'complaint',
        'completed',
      ]);
    });

    it("'scheduled' outgoing transitions remain in place", () => {
      expect(CASE_STATUS_TRANSITIONS.scheduled).toEqual([
        'reminder_sent',
        'postponed',
        'cancelled',
      ]);
    });
  });
});

/**
 * Story B.1.3 — Server-side role enforcement for case status.
 * ID: F-CRIT-05 | Sprint: 6.1 | Owner: FE-1
 *
 * The route uses `CASE_STATUS_CHANGE_ROLES` to gate PATCH /api/cases/[id]/status
 * when `FEATURE_SERVER_RBAC=true`. Sales roles lose status-change rights; this
 * test pins down the role allow-list so future role/permission changes can't
 * silently re-grant status-change to unauthorized roles.
 *
 * @see docs/ux-redesign/STORY_B1_3_IMPLEMENTATION_REPORT.md
 */
describe("CASE_STATUS_CHANGE_ROLES — Story B.1.3 (F-CRIT-05)", () => {
  describe("allow-list contents (Decision A — locked from Appendix A Q1)", () => {
    it("includes management roles", () => {
      expect(CASE_STATUS_CHANGE_ROLES).toContain('admin');
      expect(CASE_STATUS_CHANGE_ROLES).toContain('cso');
      expect(CASE_STATUS_CHANGE_ROLES).toContain('master_sales');
    });

    it("includes clinical / coordination roles", () => {
      expect(CASE_STATUS_CHANGE_ROLES).toContain('coordinator');
      expect(CASE_STATUS_CHANGE_ROLES).toContain('doctor');
      expect(CASE_STATUS_CHANGE_ROLES).toContain('nurse');
      expect(CASE_STATUS_CHANGE_ROLES).toContain('cskh_postop');
    });

    it("does NOT include sales roles (Decision A: sales loses status-change rights)", () => {
      expect(CASE_STATUS_CHANGE_ROLES).not.toContain('sales_online');
      expect(CASE_STATUS_CHANGE_ROLES).not.toContain('sales_offline');
    });

    it("does NOT include non-status roles", () => {
      expect(CASE_STATUS_CHANGE_ROLES).not.toContain('ceo');
      expect(CASE_STATUS_CHANGE_ROLES).not.toContain('accountant');
      expect(CASE_STATUS_CHANGE_ROLES).not.toContain('media');
    });
  });

  describe("transition matrix coverage (route uses this to validate PATCH body)", () => {
    /**
     * The route returns 400 when the requested status is not in
     * `CASE_STATUS_TRANSITIONS[existing.status]`. We pin the contract for a
     * sample of representative transitions here.
     */
    it("'draft' has three valid forward transitions", () => {
      expect(CASE_STATUS_TRANSITIONS.draft).toEqual([
        'waiting_customer_info',
        'waiting_payment_confirmation',
        'cancelled',
      ]);
    });

    it("'hospital_confirmed' CANNOT transition to 'scheduled' (clinical gate)", () => {
      const allowed = (CASE_STATUS_TRANSITIONS['hospital_confirmed'] ??
        []) as CaseStatus[];
      expect(allowed).not.toContain('scheduled');
    });

    it("'procedure_completed' can advance to post-op D1 or wait for image upload", () => {
      const allowed = (CASE_STATUS_TRANSITIONS['procedure_completed'] ??
        []) as CaseStatus[];
      expect(allowed).toContain('post_op_d1');
      expect(allowed).toContain('waiting_images_upload');
    });

    it("'medical_alert' can transition to procedure_completed, complaint, or completed", () => {
      // This matrix is owned by B.2.2 (F-HIGH-19). B.1.3 does not modify it
      // but reads it; pin the contract so the B.1.3 RBAC guard doesn't
      // accidentally mask a future regression here.
      expect(CASE_STATUS_TRANSITIONS.medical_alert).toEqual([
        'procedure_completed',
        'complaint',
        'completed',
      ]);
    });

    it("'complaint' has a single terminal exit to 'completed'", () => {
      expect(CASE_STATUS_TRANSITIONS.complaint).toEqual(['completed']);
    });
  });

  describe("role × transition matrix (B.1.3 + B.1.2 integration)", () => {
    // The route is invoked with (role, currentStatus, newStatus). It returns:
    //   403  if role ∉ CASE_STATUS_CHANGE_ROLES (when flag ON)
    //   400  if newStatus ∉ CASE_STATUS_TRANSITIONS[currentStatus]
    //   200  otherwise
    //
    // These unit tests assert the underlying data so a route integration test
    // (see __tests__/route.test.ts) can rely on the contracts.

    type Case = {
      name: string;
      role: UserRole;
      currentStatus: CaseStatus;
      targetStatus: CaseStatus;
      expectRoleAllowed: boolean;
      expectTransitionAllowed: boolean;
    };

    const matrix: Case[] = [
      {
        name: 'cso advancing draft → waiting_payment_confirmation is fully allowed',
        role: 'cso',
        currentStatus: 'draft',
        targetStatus: 'waiting_payment_confirmation',
        expectRoleAllowed: true,
        expectTransitionAllowed: true,
      },
      {
        name: 'sales_online advancing draft → waiting_payment_confirmation is 403 (role)',
        role: 'sales_online',
        currentStatus: 'draft',
        targetStatus: 'waiting_payment_confirmation',
        expectRoleAllowed: false,
        expectTransitionAllowed: true,
      },
      {
        name: 'cso attempting hospital_confirmed → scheduled is 400 (transition)',
        role: 'cso',
        currentStatus: 'hospital_confirmed',
        targetStatus: 'scheduled',
        expectRoleAllowed: true,
        expectTransitionAllowed: false,
      },
      {
        name: 'master_sales attempting hospital_confirmed → scheduled is 400 (transition)',
        role: 'master_sales',
        currentStatus: 'hospital_confirmed',
        targetStatus: 'scheduled',
        expectRoleAllowed: true,
        expectTransitionAllowed: false,
      },
      {
        name: 'media cannot change status at all (role block)',
        role: 'media',
        currentStatus: 'draft',
        targetStatus: 'cancelled',
        expectRoleAllowed: false,
        expectTransitionAllowed: true,
      },
      {
        name: 'doctor advancing medically_approved → scheduled is fully allowed',
        role: 'doctor',
        currentStatus: 'medically_approved',
        targetStatus: 'scheduled',
        expectRoleAllowed: true,
        expectTransitionAllowed: true,
      },
    ];

    it.each(matrix)('$name', ({ role, currentStatus, targetStatus, expectRoleAllowed, expectTransitionAllowed }) => {
      // Role check — what B.1.3 enforces server-side when the flag is ON.
      const roleAllowed = CASE_STATUS_CHANGE_ROLES.includes(role);
      expect(roleAllowed).toBe(expectRoleAllowed);

      // Transition check — what the route has always enforced.
      const transitionAllowed = (
        (CASE_STATUS_TRANSITIONS[currentStatus] ?? []) as CaseStatus[]
      ).includes(targetStatus);
      expect(transitionAllowed).toBe(expectTransitionAllowed);
    });
  });
});
