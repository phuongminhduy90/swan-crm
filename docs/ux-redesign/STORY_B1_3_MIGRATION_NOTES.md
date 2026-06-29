# STORY B.1.3 — Migration Notes

> **Story:** B.1.3 — Server-side role enforcement for case status
> **Audit finding:** F-CRIT-05
> **Sprint:** 6.1
> **Author:** tech-lead
> **Date:** 2026-06-29
> **Status:** ✅ Implemented

---

## 1. What changed

A new server-side role enforcement guard was added to `PATCH /api/cases/[id]/status`.

**Before:** The route only checked `cases:write` permission. Any role inheriting that permission (including `sales_online`, `sales_offline`, `coordinator`) could change any case status.

**After (when flag ON):** The route checks `cases:write` AND verifies the caller's role is in `CASE_STATUS_CHANGE_ROLES`. Roles outside that list receive a `403` response before any data mutation occurs.

The guard is gated behind `NEXT_PUBLIC_FEATURE_SERVER_RBAC` — defaults `false` in prod, `true` in dev.

---

## 2. Roles affected

### Roles that KEEP status-change ability (7 roles)

| Role | Status |
|------|--------|
| `admin` | ✅ Can change |
| `cso` | ✅ Can change |
| `master_sales` | ✅ Can change |
| `coordinator` | ✅ Can change |
| `doctor` | ✅ Can change |
| `nurse` | ✅ Can change |
| `cskh_postop` | ✅ Can change |

### Roles that LOSE status-change ability (5 roles)

| Role | Impact | Mitigation |
|------|--------|------------|
| `sales_online` | Cannot change case status. Previously could advance `draft → waiting_payment_confirmation`. | Ask `cso`/`master_sales` to advance status instead. |
| `sales_offline` | Same as above. | Same as above. |
| `ceo` | Never had `cases:write` (view-only), so no behavioral change. | None needed. |
| `accountant` | Never had `cases:write`, so no behavioral change. | None needed. |
| `media` | Never had `cases:write`, so no behavioral change. | None needed. |

**Decision:** Option A locked from Appendix A Q1 — sales roles lose status-change rights entirely.

---

## 3. Feature flag

| Variable | Default (dev) | Default (prod) | Rollback action |
|----------|---------------|----------------|-----------------|
| `NEXT_PUBLIC_FEATURE_SERVER_RBAC` | `true` | **`false`** | Set to `false` in `.env.local` + redeploy |

### How to toggle

**Dev** (`.env.local`):
```
NEXT_PUBLIC_FEATURE_SERVER_RBAC=true   # or false
```

**Production:** Add to Vercel environment variables (or `.env.local` on self-hosted):
```
NEXT_PUBLIC_FEATURE_SERVER_RBAC=false
```

---

## 4. Data migration

**None required.** This is a permission-only change. No data schemas were modified.

---

## 5. Rollback procedure

1. Set `NEXT_PUBLIC_FEATURE_SERVER_RBAC=false` in `.env.local`
2. Redeploy
3. Route falls back to pre-existing `cases:write` check only (all roles with that permission can change status again)

---

## 6. Pre-merge actions

- [ ] Notify product-owner + sales team: sales roles will get 403 on status changes
- [ ] Update workflow docs: "Sales asks `cso`/`master_sales` to advance case status"
- [ ] Verify staging: `FEATURE_SERVER_RBAC=true` → login as `sales_online` → try status change → confirm 403

---

## 7. Files touched

| File | Change |
|------|--------|
| `src/app/api/cases/[id]/status/route.ts` | Added `CASE_STATUS_CHANGE_ROLES` import, `isFlagEnabled('SERVER_RBAC')` guard, JSDoc |
| `src/lib/feature-flags.ts` | **Created** — `isFlagEnabled()` + `useFeatureFlag()` helper (INF-2) |
| `src/lib/feature-flags.test.ts` | **Created** — 7 unit tests for flag helper |
| `src/constants/__tests__/case-status.test.ts` | **Extended** — 15+ new B.1.3 cases covering role allow-list, transition matrix, role × transition matrix |
| `src/app/api/cases/[id]/status/__tests__/route.test.ts` | **Created** — 16 integration tests covering auth gate, flag ON/OFF, role 403, transition 400, audit log, allow-list invariants |
| `docs/ux-redesign/STORY_B1_3_MIGRATION_NOTES.md` | **Created** — this file |
| `docs/ux-redesign/STORY_B1_3_IMPLEMENTATION_REPORT.md` | **Created** |

---

*See also: `STORY_B1_3_IMPLEMENTATION_REPORT.md` for full test results and acceptance criteria.*
