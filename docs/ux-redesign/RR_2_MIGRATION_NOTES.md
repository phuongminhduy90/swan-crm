# RR-2 — Migration Notes

> **Story:** RR-2 — Reconcile `CASE_STATUS_CHANGE_ROLES` (drop `nurse`, `cskh_postop`)
> **Audit context:** Sprint 6.1 RR-2 carry-over (resolved in Sprint 6.2)
> **Date:** 2026-06-30
> **Author:** tech-lead
> **Status:** ✅ Implemented, all quality gates green
> **Risk:** 🟢 (subtractive change; no new permissions, no schema, no flag)

---

## 1. TL;DR

Removed `nurse` and `cskh_postop` from `CASE_STATUS_CHANGE_ROLES`. Both roles lack the `cases:write` permission in `ROLE_PERMISSIONS`, so the server route's `requirePermission('cases:write')` gate already 403'd them. Their presence in the allow-list was dead code that misled downstream readers.

**Before (7 roles):**

```
['admin', 'cso', 'master_sales', 'coordinator', 'doctor', 'nurse', 'cskh_postop']
```

**After (5 roles):**

```
['admin', 'cso', 'master_sales', 'coordinator', 'doctor']
```

---

## 2. Why this was dead code

The route `PATCH /api/cases/[id]/status` runs two gates in sequence:

1. **`requirePermission(request, 'cases:write')`** — rejects any role that does not hold `cases:write` with 403. This is the **first** check.
2. **`CASE_STATUS_CHANGE_ROLES.includes(user.role)`** — the B.1.3 server RBAC guard, behind the `FEATURE_SERVER_RBAC` flag. This is the **second** check.

In `ROLE_PERMISSIONS`:

| Role | `cases:write`? | In old `CASE_STATUS_CHANGE_ROLES`? | Actual behavior (gate #1 ran first) |
|---|---|---|---|
| `admin` | ✅ | ✅ | 200 |
| `cso` | ✅ | ✅ | 200 |
| `master_sales` | ✅ | ✅ | 200 |
| `coordinator` | ✅ | ✅ | 200 |
| `doctor` | ✅ | ✅ | 200 |
| **`nurse`** | ❌ | ✅ (dead) | 403 (gate #1 — permission) |
| **`cskh_postop`** | ❌ | ✅ (dead) | 403 (gate #1 — permission) |
| `ceo` | ❌ | ❌ | 403 |
| `sales_online` | ✅ | ❌ (Decision A) | 200 (flag OFF) / 403 (flag ON, gate #2) |
| `sales_offline` | ✅ | ❌ (Decision A) | 200 (flag OFF) / 403 (flag ON, gate #2) |
| `accountant` | ❌ | ❌ | 403 |
| `media` | ❌ | ❌ | 403 |

The two roles marked **(dead)** could never reach gate #2. Listing them in `CASE_STATUS_CHANGE_ROLES` gave readers a misleading signal: a casual reader would conclude those roles *could* change status (subject to the role-list check), when in fact they were rejected one layer earlier.

---

## 3. Why this is a Sprint 6.2 carry-over

Sprint 6.2 introduces the **checklist gate** (B.2.1) — the first story in this codebase that blocks a status transition based on a derived clinical state. The gate's `allPassed` math reasons over the role set; if the role set contains dead entries, the gate's downstream readers will be confused about which roles the gate applies to. RR-2 reconciles the set **before** B.2.1 lands, so the gate math operates on the correct allow-list from day one.

> Per `SPRINT_6_2_EXECUTION_PLAN.md` §3.1: *"RR-2 first — 1-line fix that prevents the 6.1 dead-role bug from contaminating B.2.1's gate math."*

---

## 4. Files changed

| File | Type | LOC Δ | Purpose |
|---|---|---:|---|
| `src/constants/permissions.ts` | MODIFY | +8 / -2 | Removed `nurse`, `cskh_postop`; added comment explaining the invariant |
| `src/constants/__tests__/permissions.test.ts` | **CREATE** | +130 | New invariant test file (36 tests) pinning the role ↔ permission contract |
| `src/constants/__tests__/case-status.test.ts` | MODIFY | +12 / -4 | Updated B.1.3 assertions: 7 → 5 roles, length pinned, split "with/without `cases:write`" cases |
| `src/app/api/cases/[id]/status/__tests__/route.test.ts` | MODIFY | +8 / -4 | Updated route invariant assertions: 7 → 5 roles, added "no nurse/cskh_postop" assertion |
| `docs/ux-redesign/RR_2_IMPLEMENTATION_REPORT.md` | **CREATE** | +~280 | Full report (this file's sibling) |
| `docs/ux-redesign/RR_2_MIGRATION_NOTES.md` | **CREATE** | +~150 | This file |

**Total**: 4 source/test files + 2 docs files. No schema change. No env var change. No feature flag. No new dependency.

---

## 5. Migration impact

### 5.1 Server-side behavior

No change. The route's behavior at every role × flag combination is **identical before and after RR-2**:

| Role | Flag OFF (default) | Flag ON |
|---|---|---|
| `admin`, `cso`, `master_sales`, `coordinator`, `doctor` | 200 ✅ | 200 ✅ |
| `nurse`, `cskh_postop` | 403 (permission) | 403 (permission) |
| `sales_online`, `sales_offline` | 200 ✅ | 403 (role-list) |
| `ceo`, `accountant`, `media` | 403 (permission) | 403 (permission) |

The two 403'd rows still return 403 — they just return it for the *same reason* (gate #1, not gate #2). RR-2 removes a misleading data invariant without changing observable behavior.

### 5.2 Client-side behavior

`canStatusChange` in `src/app/(protected)/cases/[id]/page.tsx` is computed as `CASE_STATUS_CHANGE_ROLES.includes(user.role)`. Before RR-2, `nurse` and `cskh_postop` users would see the status-change UI in the case-detail page. After RR-2, they don't.

**Practical impact**: zero in practice, because the server would 403 the change anyway. But the UI now matches the server — a `nurse` user no longer sees a "change status" affordance that the server would reject.

If a future feature needs to give `nurse` or `cskh_postop` status-change rights (unlikely — these are clinical-support roles, not status owners), the fix is to add `cases:write` to their `ROLE_PERMISSIONS` entry, then add them back to `CASE_STATUS_CHANGE_ROLES`. The new invariant test will flag any future drift.

### 5.3 Audit log

No audit-log entries change. The route writes the same audit fields before and after RR-2.

---

## 6. Rollback

Revert the commit. `git revert <sha>` restores:

- `CASE_STATUS_CHANGE_ROLES` to its 7-role form
- The test files to their 6.1 (length 7) assertions

**Time to rollback:** < 5 minutes.

**Data impact:** None. RR-2 is a *code/data invariant* change, not a permission grant. Re-adding `nurse` and `cskh_postop` re-introduces the dead-code bug but does not alter any user's effective permissions.

**Test impact:** The 36 new tests in `permissions.test.ts` were **net-new**, so reverting the source change will fail those tests — that is the desired behavior (the invariant test is the safety net).

---

## 7. Why not a feature flag?

A flag would be wrong here. RR-2 is not a behavior change — it is a data-correctness fix for a static config array. The flag would only add operational complexity (which env state to set, when to flip) for zero user-facing benefit. The invariant test is the right control surface.

---

## 8. Open follow-ups (deferred)

- **RR-3** (carry-over) — Coordinate B.3.1 sign-off (CEO + accountant-lead + product-owner). Out of RR-2 scope.
- **RR-4** (carry-over) — B.1.4 Suspense boundary fix. Out of RR-2 scope.
- **RR-8** (carry-over) — Conventional Commits adoption. Out of RR-2 scope.
- **B.2.1** (Sprint 6.2) — Checklist gate consumes `CASE_STATUS_CHANGE_ROLES` indirectly via the role check; no code change needed in RR-2 to unblock it.

---

*End of RR-2 Migration Notes.*