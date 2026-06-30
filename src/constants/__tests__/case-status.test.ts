import { describe, it, expect } from 'vitest';
import { CASE_STATUS_TRANSITIONS, TERMINAL_STATUSES } from '@/constants/case-status';
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
      // B.2.2 (F-HIGH-19) replaces this matrix — see the dedicated B.2.2
      // describe block below. We keep this legacy assertion loose (does-not-
      // include `'procedure_completed'`) rather than asserting the exact
      // matrix so that this B.1.2 regression test stays in scope after
      // B.2.2 lands.
      const medicalAlertTransitions = (CASE_STATUS_TRANSITIONS['medical_alert'] ??
        []) as CaseStatus[];
      expect(medicalAlertTransitions).not.toContain('procedure_completed');
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
 * Story B.2.2 — `medical_alert_resolved` terminal status + transitions.
 * ID: F-HIGH-19 | Sprint: 6.1 | Owner: FE-1
 *
 * Background: previously `medical_alert` could transition to
 * `procedure_completed` (a back-door skip past medical clearance). After
 * B.2.2, the only forward resolution paths from `medical_alert` are:
 *   - `medical_alert_resolved` (new — successful resolution, terminal)
 *   - `complaint` (escalation to complaint workflow)
 *   - `completed` (administrative closure)
 *
 * `procedure_completed` is intentionally NO LONGER reachable from
 * `medical_alert`. Cases must be re-routed through `medical_alert_resolved`
 * (or `complaint` → `completed`) instead.
 */
describe("CASE_STATUS_TRANSITIONS — Story B.2.2 (F-HIGH-19)", () => {
  describe("medical_alert allowed transitions", () => {
    const allowed = (CASE_STATUS_TRANSITIONS['medical_alert'] ?? []) as CaseStatus[];

    it("includes 'medical_alert_resolved' (new resolution path)", () => {
      expect(allowed).toContain('medical_alert_resolved');
    });

    it("does NOT include 'procedure_completed' (back-door skip removed)", () => {
      expect(allowed).not.toContain('procedure_completed');
    });

    it("still includes 'complaint' (escalation)", () => {
      expect(allowed).toContain('complaint');
    });

    it("still includes 'completed' (administrative closure)", () => {
      expect(allowed).toContain('completed');
    });

    it("has exactly the three documented forward transitions", () => {
      expect(allowed).toEqual([
        'medical_alert_resolved',
        'complaint',
        'completed',
      ]);
    });
  });

  describe("medical_alert_resolved is a terminal status", () => {
    const outgoing = CASE_STATUS_TRANSITIONS['medical_alert_resolved'];

    it("is defined in CASE_STATUS_TRANSITIONS", () => {
      expect(outgoing).toBeDefined();
    });

    it("has zero outgoing transitions", () => {
      expect(outgoing).toEqual([]);
    });

    it("does NOT allow medical_alert_resolved → procedure_completed", () => {
      expect(outgoing).not.toContain('procedure_completed');
    });

    it("does NOT allow medical_alert_resolved → completed", () => {
      // Terminal means truly terminal — no further forward motion.
      expect(outgoing).not.toContain('completed');
    });

    it("does NOT allow medical_alert_resolved → medical_alert (no resurrection)", () => {
      expect(outgoing).not.toContain('medical_alert');
    });
  });

  describe("TERMINAL_STATUSES coverage", () => {
    it("includes 'medical_alert_resolved'", () => {
      expect(TERMINAL_STATUSES).toContain('medical_alert_resolved');
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
 * Story RR-2 (Sprint 6.2 carry-over): `nurse` and `cskh_postop` were removed
 * from `CASE_STATUS_CHANGE_ROLES` because they lack `cases:write` permission
 * (the route already 403s them at the `requirePermission('cases:write')`
 * gate). The 5 remaining roles all hold `cases:write`.
 *
 * @see docs/ux-redesign/STORY_B1_3_IMPLEMENTATION_REPORT.md
 * @see docs/ux-redesign/RR_2_IMPLEMENTATION_REPORT.md
 */
describe("CASE_STATUS_CHANGE_ROLES — Story B.1.3 (F-CRIT-05) + RR-2", () => {
  describe("allow-list contents (Decision A — locked from Appendix A Q1 + RR-2 reconcile)", () => {
    it("includes management roles", () => {
      expect(CASE_STATUS_CHANGE_ROLES).toContain('admin');
      expect(CASE_STATUS_CHANGE_ROLES).toContain('cso');
      expect(CASE_STATUS_CHANGE_ROLES).toContain('master_sales');
    });

    it("includes clinical / coordination roles that hold `cases:write`", () => {
      // RR-2: removed `nurse` and `cskh_postop` because they do NOT hold
      // `cases:write` in `ROLE_PERMISSIONS`. They were dead-code entries —
      // the route's `requirePermission('cases:write')` gate already 403s
      // them before the role-list check runs.
      expect(CASE_STATUS_CHANGE_ROLES).toContain('coordinator');
      expect(CASE_STATUS_CHANGE_ROLES).toContain('doctor');
    });

    it("does NOT include roles without `cases:write` permission (RR-2 reconcile)", () => {
      // nurse + cskh_postop lack cases:write — removed in RR-2.
      expect(CASE_STATUS_CHANGE_ROLES).not.toContain('nurse');
      expect(CASE_STATUS_CHANGE_ROLES).not.toContain('cskh_postop');
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

    it("contains exactly the 5 RR-2 reconciled roles", () => {
      expect(CASE_STATUS_CHANGE_ROLES).toHaveLength(5);
      expect([...CASE_STATUS_CHANGE_ROLES].sort()).toEqual(
        ['admin', 'coordinator', 'cso', 'doctor', 'master_sales'].sort(),
      );
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

    it("'medical_alert' can transition to medical_alert_resolved, complaint, or completed (B.2.2)", () => {
      // This matrix is owned by B.2.2 (F-HIGH-19). B.1.3 does not modify it
      // but reads it; pin the contract so the B.1.3 RBAC guard doesn't
      // accidentally mask a future regression here.
      expect(CASE_STATUS_TRANSITIONS.medical_alert).toEqual([
        'medical_alert_resolved',
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
