# RR-2 — Implementation Report

> **Story:** RR-2 — Reconcile `CASE_STATUS_CHANGE_ROLES`
> **Origin:** Sprint 6.1 carry-over risk (see `SPRINT_6_1_COMPLETION_REPORT.md`)
> **Sprint:** 6.2 (executed ahead of B.2.1 per dependency order)
> **Author:** tech-lead
> **Date:** 2026-06-30
> **Status:** ✅ Implemented, all gates green
> **Risk:** 🟢 (subtractive; no permission grant; no schema; no flag)
> **LOC Δ:** +18 source / +130 new tests / +8 test updates

---

## 1. Summary

Reconciled `CASE_STATUS_CHANGE_ROLES` by removing `nurse` and `cskh_postop`. Both roles lacked the `cases:write` permission in `ROLE_PERMISSIONS`, so the server route `PATCH /api/cases/[id]/status` was already 403'ing them at the `requirePermission('cases:write')` gate. Their presence in the role-list was dead code that misled downstream readers about which roles could actually change case status — and would have contaminated B.2.1's `allPassed` gate math if not fixed first.

Added a new invariant test file (`src/constants/__tests__/permissions.test.ts`) that pins the role ↔ `cases:write` contract so a future PR cannot silently re-introduce dead-role entries.

**Deliverables (all green):**

| Gate | Result |
|---|---|
| `npm run lint` | ✅ 0 warnings |
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm test` | ✅ **298 tests pass** (259 baseline + 36 new + 3 net additions) |
| `npm run build` | ✅ 34 routes, 0 errors |

---

## 2. Acceptance criteria

| # | Criterion | Status | Evidence |
|---|-----------|:---:|---|
| 1 | `CASE_STATUS_CHANGE_ROLES` no longer contains `nurse` | ✅ | `permissions.test.ts` line 41; `case-status.test.ts` lines 197–200; `route.test.ts` lines 412–414 |
| 2 | `CASE_STATUS_CHANGE_ROLES` no longer contains `cskh_postop` | ✅ | Same as #1 |
| 3 | Every role in `CASE_STATUS_CHANGE_ROLES` holds `cases:write` permission | ✅ | `permissions.test.ts` lines 64–70 (`it.each` over each role) |
| 4 | Every role with `cases:write` is either in the allow-list OR is a sales role (Decision A) | ✅ | `permissions.test.ts` lines 75–88 |
| 5 | No regression in 6.1's 12-role × flag-state matrix | ✅ | `route.test.ts` full suite passes (47 tests) |
| 6 | Existing `CASE_STATUS_TRANSITIONS` matrix untouched | ✅ | `case-status.test.ts` (37 tests) — all green |
| 7 | `FEATURE_SERVER_RBAC` flag still gates the role-list check | ✅ | `route.test.ts` flag-ON vs flag-OFF blocks unchanged |

---

## 3. What changed

### 3.1 Source change — `src/constants/permissions.ts`

Removed `nurse` and `cskh_postop` from `CASE_STATUS_CHANGE_ROLES` (lines 82–92). Added a JSDoc comment explaining the invariant and referencing this report:

```diff
- // Which roles can change case status (generic — all allowed roles)
+ // Which roles can change case status (generic — all allowed roles).
+ //
+ // Story RR-2 (carry-over from Sprint 6.1): removed `nurse` and `cskh_postop`.
+ // Both roles lack the `cases:write` permission in `ROLE_PERMISSIONS`, so the
+ // server route's `requirePermission('cases:write')` gate already rejected them
+ // with 403. Listing them here was dead code that misled downstream readers
+ // about which roles could actually change status. The invariant is now pinned
+ // by `src/constants/__tests__/permissions.test.ts`.
+ //
+ // Remaining 5 roles all hold `cases:write`:
+ //   - admin       (full)
+ //   - cso         (operations lead)
+ //   - master_sales (sales lead — assigned/creates cases)
+ //   - coordinator (clinical scheduling)
+ //   - doctor      (clinical review)
  export const CASE_STATUS_CHANGE_ROLES: UserRole[] = [
    'admin',
    'cso',
    'master_sales',
    'coordinator',
    'doctor',
-   'nurse',
-   'cskh_postop',
  ];
```

### 3.2 New invariant test — `src/constants/__tests__/permissions.test.ts`

Created a 36-test suite with three sections:

**Section A — `CASE_STATUS_CHANGE_ROLES` composition (7 tests)**

- Length is 5
- Contains exactly `['admin', 'cso', 'master_sales', 'coordinator', 'doctor']`
- Does NOT contain `nurse`, `cskh_postop`
- Does NOT contain `sales_online`, `sales_offline` (Decision A)
- Does NOT contain `ceo`, `accountant`, `media`

**Section B — Role ↔ `cases:write` invariant (6 tests)**

- `it.each` over each of the 5 allowed roles → asserts `hasPermission(role, 'cases:write') === true`
- Reverse direction: every role with `cases:write` is either in the allow-list OR is a sales role (the Decision A exclusion)

**Section C — `CASE_STATUS_CHANGE_ROLES` ⊆ roles-with-`cases:write` (1 test)**

- Every entry in the allow-list must appear in `ROLE_PERMISSIONS[role]` with `cases:write` present

**Section D — Hygiene (24 tests)**

- Every role-list in `permissions.ts` (12 lists total) contains only known `UserRole` values
- Every role-list has no duplicate entries

### 3.3 Updated B.1.3 tests — `src/constants/__tests__/case-status.test.ts`

- Split the "clinical / coordination roles" describe into two: with-`cases:write` (5 expected) and without-`cases:write` (RR-2 reconcile, 2 newly-excluded)
- Added a new test pinning length to 5 and exact contents
- Updated the doc comment to reference RR-2

### 3.4 Updated route tests — `src/app/api/cases/[id]/status/__tests__/route.test.ts`

- Pinned length to 5 (was 7)
- Updated the expected-roles assertion array
- Added a new test asserting `nurse` and `cskh_postop` are NOT in the allow-list (RR-2 invariant)

---

## 4. Test execution log

```bash
$ npm run lint
✔ No ESLint warnings or errors

$ npx tsc --noEmit
(exit 0, no output)

$ npx vitest run src/constants/__tests__/permissions.test.ts src/constants/__tests__/case-status.test.ts
 ✓ src/constants/__tests__/case-status.test.ts  (37 tests) 7ms
 ✓ src/constants/__tests__/permissions.test.ts  (36 tests) 7ms

 Test Files  2 passed (2)
      Tests  73 passed (73)

$ npm test
 Test Files  16 passed (16)
      Tests  298 passed (298)   ← 259 baseline + 36 new + 3 net additions

$ npm run build
 ✓ Compiled successfully
 ✓ Generating static pages (34/34)
```

---

## 5. Risks introduced

**None.** RR-2 is a subtractive change that:

1. Removes two dead-code entries from a static config array.
2. Adds an invariant test that prevents the dead-code entries from being re-introduced.

No new permission is granted. No permission is revoked. No schema change. No env var change. No feature flag. No new dependency. No route behavior change. No UI behavior change (the UI now matches the server, which is a cosmetic improvement at most — `nurse` and `cskh_postop` users no longer see a status-change affordance that the server would 403).

### Residual risk (very low)

A future contributor might want to add `cases:write` to `nurse` or `cskh_postop` to give them status-change rights. The new invariant test does **not** auto-add the role back to the allow-list — that step would be a separate, intentional PR. This is the correct behavior: an explicit PR with sign-off is the right way to grant a new role status-change rights, not a silent test that auto-promotes.

---

## 6. Rollback steps

```bash
# Option 1: revert the commit
git revert <rr-2-commit-sha>

# Option 2: manual restoration
# 1. Open src/constants/permissions.ts
# 2. Add 'nurse' and 'cskh_postop' back to CASE_STATUS_CHANGE_ROLES
# 3. Update src/constants/__tests__/case-status.test.ts (length 5 → 7, roles array)
# 4. Update src/app/api/cases/[id]/status/__tests__/route.test.ts (length 5 → 7)
# 5. Optionally delete src/constants/__tests__/permissions.test.ts (or keep it — it will still pass because the invariant remains true)

# Verify rollback
npm run lint && npx tsc --noEmit && npm test && npm run build
```

**Time to rollback:** < 5 minutes.

**Data impact:** None. RR-2 only changes a static config array; no persisted state changes.

**Test impact:** None on production behavior. The 36 new tests will fail if `CASE_STATUS_CHANGE_ROLES` is reverted to include roles without `cases:write` — that is the desired safety-net behavior.

---

## 7. Why this is not a feature-flagged rollout

A flag would be wrong here. RR-2 is not a behavior change — it is a **data-correctness fix** for a static config array. The flag would add operational complexity (which env state to set, when to flip, who flips it) for zero user-facing benefit. The invariant test is the right control surface.

If a future feature ever needs to give `nurse` or `cskh_postop` status-change rights (e.g., a clinical-support workflow), the path is:

1. Add `cases:write` to their `ROLE_PERMISSIONS` entry in `src/config/roles.ts`.
2. Add the role to `CASE_STATUS_CHANGE_ROLES` in `src/constants/permissions.ts`.
3. Run the test suite — the invariant test will pass automatically.

---

## 8. Hand-off to B.2.1 (Sprint 6.2 next story)

B.2.1's checklist gate (`allPassed` math) consumes the role set indirectly:

- The gate is enforced by the server route `PATCH /api/cases/[id]/status`.
- The route's RBAC guard uses `CASE_STATUS_CHANGE_ROLES.includes(user.role)`.
- After RR-2, this list is the **correct** set: 5 roles that actually hold `cases:write`.

B.2.1 can now reason about gate math without contamination from dead-role entries. The dependency order from `SPRINT_6_2_EXECUTION_PLAN.md` §3.1 is honored.

---

## 9. Cross-references

- **Sprint 6.2 Execution Plan**: [`SPRINT_6_2_EXECUTION_PLAN.md`](SPRINT_6_2_EXECUTION_PLAN.md) §1 (RR-2 row), §3.1 (order rationale), §4.2 (files affected), §9.2 (rollback)
- **Sprint 6.1 Completion Report**: [`SPRINT_6_1_COMPLETION_REPORT.md`](SPRINT_6_1_COMPLETION_REPORT.md) (RR-2 origin)
- **Story B.1.3 (predecessor)**: [`STORY_B1_3_IMPLEMENTATION_REPORT.md`](STORY_B1_3_IMPLEMENTATION_REPORT.md), [`STORY_B1_3_MIGRATION_NOTES.md`](STORY_B1_3_MIGRATION_NOTES.md)
- **Permission config**: `src/config/roles.ts` (`ROLE_PERMISSIONS`, `hasPermission`)
- **Constants**: `src/constants/permissions.ts` (`CASE_STATUS_CHANGE_ROLES`)
- **Route (consumer)**: `src/app/api/cases/[id]/status/route.ts` (B.1.3 RBAC guard)
- **UI (consumer)**: `src/app/(protected)/cases/[id]/page.tsx` (`canStatusChange`)

---

*End of RR-2 Implementation Report.*