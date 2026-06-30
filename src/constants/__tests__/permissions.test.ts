import { describe, it, expect } from 'vitest';
import {
  CASE_STATUS_CHANGE_ROLES,
  PAYMENT_CONFIRM_ROLES,
  PAYMENT_CREATE_ROLES,
  DELETE_APPROVE_ROLES,
  CASE_CANCEL_ROLES,
  CASE_MEDICAL_DECISION_ROLES,
  CASE_POSTOP_STATUS_ROLES,
  SENSITIVE_FIELD_ACCESS_ROLES,
  MEDICAL_NOTE_ACCESS_ROLES,
  PAYMENT_DATA_ACCESS_ROLES,
  MEDIA_APPROVED_ACCESS_ROLES,
  CHANGE_VISIBILITY_ROLES,
} from '@/constants/permissions';
import { ROLE_PERMISSIONS, hasPermission, ALL_ROLES } from '@/config/roles';
import type { UserRole } from '@/lib/types';

/**
 * Story RR-2 — Reconcile `CASE_STATUS_CHANGE_ROLES` to drop roles that do not
 * hold the `cases:write` permission.
 *
 * Background (from Sprint 6.1 RR-2): `CASE_STATUS_CHANGE_ROLES` previously
 * listed 7 roles. Two of them — `nurse` and `cskh_postop` — did NOT hold
 * `cases:write` in `ROLE_PERMISSIONS`. The server route
 * `PATCH /api/cases/[id]/status` runs `requirePermission('cases:write')`
 * *before* the role-list check, so those two roles were 403'd at the
 * permission gate regardless. Their presence in the allow-list was dead
 * code that misled downstream readers about which roles could actually
 * change case status, and would contaminate B.2.1's `allPassed` gate math.
 *
 * After RR-2, the allow-list contains exactly the 5 roles that hold
 * `cases:write`. This test pins the invariant so a future PR cannot
 * silently re-introduce the dead-role bug.
 *
 * @see docs/ux-redesign/RR_2_IMPLEMENTATION_REPORT.md
 * @see docs/ux-redesign/RR_2_MIGRATION_NOTES.md
 */
describe('CASE_STATUS_CHANGE_ROLES — Story RR-2 invariant', () => {
  describe('allow-list composition (RR-2 reconciled)', () => {
    it('contains exactly 5 roles after RR-2 reconcile', () => {
      expect(CASE_STATUS_CHANGE_ROLES).toHaveLength(5);
    });

    it('contains exactly: admin, cso, master_sales, coordinator, doctor', () => {
      expect([...CASE_STATUS_CHANGE_ROLES].sort()).toEqual(
        ['admin', 'coordinator', 'cso', 'doctor', 'master_sales'].sort(),
      );
    });

    it('does NOT contain nurse or cskh_postop (removed by RR-2)', () => {
      expect(CASE_STATUS_CHANGE_ROLES).not.toContain('nurse');
      expect(CASE_STATUS_CHANGE_ROLES).not.toContain('cskh_postop');
    });

    it('does NOT contain sales roles (Decision A — sales loses status-change)', () => {
      expect(CASE_STATUS_CHANGE_ROLES).not.toContain('sales_online');
      expect(CASE_STATUS_CHANGE_ROLES).not.toContain('sales_offline');
    });

    it('does NOT contain non-status roles (ceo, accountant, media)', () => {
      expect(CASE_STATUS_CHANGE_ROLES).not.toContain('ceo');
      expect(CASE_STATUS_CHANGE_ROLES).not.toContain('accountant');
      expect(CASE_STATUS_CHANGE_ROLES).not.toContain('media');
    });
  });

  describe('invariant: every role in CASE_STATUS_CHANGE_ROLES holds `cases:write`', () => {
    // This is the core invariant RR-2 enforces. If a future PR adds a role
    // to CASE_STATUS_CHANGE_ROLES without granting it `cases:write`, the
    // server route will 403 that role at the permission gate and the role
    // entry will become dead code again. This test catches the regression.
    it.each(CASE_STATUS_CHANGE_ROLES)(
      '%s has the `cases:write` permission',
      (role) => {
        expect(hasPermission(role, 'cases:write')).toBe(true);
      },
    );

    it('every role with `cases:write` is a candidate for CASE_STATUS_CHANGE_ROLES (sanity)', () => {
      // Reverse direction: enumerate every role that holds `cases:write`
      // and verify it is either in the allow-list (clinical/coord role)
      // or excluded by Decision A (sales roles) — but NEVER excluded for
      // lacking `cases:write` (which would be RR-2's bug).
      const rolesWithWrite = ALL_ROLES.filter((r) =>
        hasPermission(r, 'cases:write'),
      );

      // Every role with `cases:write` should fall into exactly one of:
      //   - in CASE_STATUS_CHANGE_ROLES (clinical/coord/management), or
      //   - a sales role (Decision A explicit exclusion), or
      //   - master_sales (lead — retained for assignment reasons).
      const salesRoles: UserRole[] = ['sales_online', 'sales_offline'];
      for (const role of rolesWithWrite) {
        const inAllowList = CASE_STATUS_CHANGE_ROLES.includes(role);
        const isSalesExclusion = salesRoles.includes(role);
        expect(inAllowList || isSalesExclusion).toBe(true);
      }
    });
  });

  describe('invariant: CASE_STATUS_CHANGE_ROLES is a strict subset of roles-with-cases:write', () => {
    it('every entry in CASE_STATUS_CHANGE_ROLES is in ROLE_PERMISSIONS with cases:write', () => {
      for (const role of CASE_STATUS_CHANGE_ROLES) {
        expect(ROLE_PERMISSIONS[role]).toContain('cases:write');
      }
    });
  });
});

/**
 * Cross-cutting safety net: every role-list in `permissions.ts` should be a
 * subset of `ALL_ROLES`. This catches typos in the array literals that would
 * otherwise compile but fail at runtime when an unknown role is checked.
 */
describe('Role-list sanity (RR-2 hygiene check)', () => {
  const roleLists = [
    CASE_STATUS_CHANGE_ROLES,
    PAYMENT_CONFIRM_ROLES,
    PAYMENT_CREATE_ROLES,
    DELETE_APPROVE_ROLES,
    CASE_CANCEL_ROLES,
    CASE_MEDICAL_DECISION_ROLES,
    CASE_POSTOP_STATUS_ROLES,
    SENSITIVE_FIELD_ACCESS_ROLES,
    MEDICAL_NOTE_ACCESS_ROLES,
    PAYMENT_DATA_ACCESS_ROLES,
    MEDIA_APPROVED_ACCESS_ROLES,
    CHANGE_VISIBILITY_ROLES,
  ] as const;

  it.each(
    roleLists.map((list, idx) => ({
      list,
      name: `role-list #${idx}`,
    })),
  )('$name contains only known UserRole values', ({ list }) => {
    for (const role of list) {
      expect(ALL_ROLES).toContain(role);
    }
  });

  it.each(roleLists.map((list, idx) => ({ list, name: `role-list #${idx}` })))(
    '$name has no duplicate entries',
    ({ list }) => {
      expect(new Set(list).size).toBe(list.length);
    },
  );
});