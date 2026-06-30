# Story B.3.1 — Implementation Report

> **Story:** B.3.1 — Remove accountant from `PAYMENT_CONFIRM_ROLES` + SoD check
> **Sprint:** 6.1 | **Phase:** 6 | **Date implemented:** 2026-06-30
> **Audit finding:** F-CRIT-06 (UX_AUDIT_REPORT) — "Accountant role can self-confirm payments (SoD gap)"
> **Branch:** `phase-6/sprint-6.1` (target) — to be merged after full sprint sign-off
> **Owner:** FE-1 | **Skills consulted:** tech-lead, rbac-expert
> **Plan:** [`SPRINT_6_1_EXECUTION_PLAN.md`](SPRINT_6_1_EXECUTION_PLAN.md) §1, Appendix A Q2
> **Migration notes:** [`STORY_B3_1_MIGRATION_NOTES.md`](STORY_B3_1_MIGRATION_NOTES.md)

---

## 1. Definition of Done — checklist

| Criterion (from SPRINT_6_1_EXECUTION_PLAN §8.2 B.3.1) | Status | Evidence |
|---|---|---|
| `PAYMENT_CONFIRM_ROLES === ['admin']` | ✅ | `src/constants/permissions.ts:64-72`; pinned in test "contains exactly the 1 role specified by Decision A" |
| API returns 403 for `accountant` | ✅ | Test: "returns 403 when accountant attempts to confirm (Decision A: accountant removed)" |
| API returns 403 when `createdBy === confirmedBy` (any role, including admin) | ✅ | Test: "returns 403 when admin attempts to confirm their own payment" — runs with `FEATURE_PAYMENT_SOD=true` |
| SoD violation logged in audit | ✅ | Test: "writes a structured SoD-violation audit log on denial" — asserts `action: 'payment_confirmed'`, `after.denied: true`, `after.reason: 'sod_violation'` |
| Flag `FEATURE_PAYMENT_SOD` controls behavior | ✅ | Tests cover both flag states (OFF preserves self-confirm; ON rejects with 403) |
| Build gates: tsc / lint / build all clean | ✅ | `npx tsc --noEmit` → 0 errors; `npm run lint` → 0 warnings; `npm run build` → 0 errors |
| Tests pass | ✅ | 15 new tests in `src/app/api/payments/[id]/confirm/__tests__/route.test.ts`; 247/247 across the whole suite |
| Documentation | ✅ | This file + `STORY_B3_1_MIGRATION_NOTES.md` |

---

## 2. Implementation walkthrough

### 2.1 Static-config change — `PAYMENT_CONFIRM_ROLES`

**File:** [`src/constants/permissions.ts`](../../src/constants/permissions.ts) (lines 63–72)

```ts
// Which roles can confirm payments
// Story B.3.1 (F-CRIT-06) — Accountant removed. Only `admin` can confirm
// payments, and even admin cannot confirm a payment they created (SoD).
// The SoD guard lives in /api/payments/[id]/confirm and is gated behind the
// `NEXT_PUBLIC_FEATURE_PAYMENT_SOD` flag (default OFF in production).
export const PAYMENT_CONFIRM_ROLES: UserRole[] = [
  'admin',
];
```

This is the **always-on** change. `accountant` is removed from the allow-list. Existing call sites that read `PAYMENT_CONFIRM_ROLES` (the frontend `payment-list.tsx`) automatically pick up the new list — see §2.3.

### 2.2 Route-layer guards — `PATCH /api/payments/[id]/confirm`

**File:** [`src/app/api/payments/[id]/confirm/route.ts`](../../src/app/api/payments/[id]/confirm/route.ts)

Three guards, evaluated in order:

1. **Auth & permission** — `requirePermission(request, 'payments:approve')`. Existing; passes for `admin`, `cso`, `accountant`.
2. **Role allow-list** (NEW, always on) — `PAYMENT_CONFIRM_ROLES.includes(user.role)`. Blocks `cso` and `accountant` here with 403 + role-aware message.
3. **SoD** (NEW, behind `FEATURE_PAYMENT_SOD`) — loads the existing payment via `getPayment(params.id)`; if `existing.createdBy === user.uid`, writes a structured denial audit log and returns 403.

Key design decisions:
- **Why load the payment twice?** Once for the SoD check (before mutation), once via `confirmPayment(...)` (which also loads it internally). Considered caching, but `confirmPayment` is shared with the reject route and changing its signature would cascade. The double read is acceptable for a PATCH endpoint with single-row access patterns.
- **Why a separate `getPayment` import?** `confirmPayment` already loads the payment, but it also does a `status !== 'pending'` check and throws on non-pending. The SoD check needs to run **before** the status check, otherwise a `confirmed` payment would throw a different error than "SoD violation". Pre-loading via `getPayment` keeps the layering explicit.
- **Why `action: 'payment_confirmed'` for the denial log?** Reusing the same action type as success means SOC filters keyed on `action: 'payment_confirmed'` capture both. The `after.denied: true` discriminator distinguishes them. Auditors see one consolidated trail rather than a separate action type.

### 2.3 Frontend UI sync — `payment-list.tsx`

**File:** [`src/components/payments/payment-list.tsx`](../../src/components/payments/payment-list.tsx)

```ts
// Story B.3.1: read the role allow-list from the static contract
// instead of hardcoding 'accountant' || 'admin'.
const canApprove =
  userProfile?.role !== undefined &&
  PAYMENT_CONFIRM_ROLES.includes(userProfile.role);

// Story B.3.1: when the SoD flag is on, suppress the action button for
// rows the current user created. The server returns 403 anyway, but
// hiding it improves UX (no rejected click).
const sodEnabled = isFlagEnabled('PAYMENT_SOD');
```

The action cell render branch now:
- Returns `"—"` if the row isn't pending (existing behavior).
- Returns a yellow `"SoD"` badge with a tooltip ("Bạn đã tạo thanh toán này — cần admin khác xác nhận") if the row is pending **and** `sodEnabled && row.createdBy === userProfile.id`.
- Returns the existing `"Xử lý"` button otherwise.

This means in dev (`FEATURE_PAYMENT_SOD=true`), the accountant sees no action button at all (role allow-list excludes them); an admin sees the action button for other people's payments but a "SoD" badge for their own.

### 2.4 Feature flag — `.env.local`

Added:
```
NEXT_PUBLIC_FEATURE_PAYMENT_SOD=false
```
Plus `NEXT_PUBLIC_FEATURE_SERVER_RBAC=false` was missing from local env — added at the same time per the plan's flag inventory (SPRINT_6_1_EXECUTION_PLAN §7.3).

---

## 3. Tests

**File:** [`src/app/api/payments/[id]/confirm/__tests__/route.test.ts`](../../src/app/api/payments/[id]/confirm/__tests__/route.test.ts) — 15 tests.

| Group | Test | What it proves |
|---|---|---|
| auth gate | `returns 401 when x-dev-user-id is unknown` | Auth layer rejects unknown callers |
| auth gate | `returns 403 when the role lacks payments:approve (e.g. media)` | Permission gate works |
| role allow-list | `returns 403 when accountant attempts to confirm` | Decision A: accountant removed |
| role allow-list | `returns 403 when cso attempts to confirm` | Only admin passes |
| role allow-list | `returns 200 when admin confirms a payment they did not create` | Happy path |
| role allow-list | `contains exactly the 1 role specified by Decision A` | Pin invariant (fails if a future PR adds a role) |
| SoD OFF | `allows admin to self-confirm (legacy behavior preserved)` | Flag OFF = no SoD check |
| SoD ON | `returns 403 when admin attempts to confirm their own payment` | Flag ON = self-confirm blocked |
| SoD ON | `writes a structured SoD-violation audit log on denial` | Audit shape: `denied: true, reason: 'sod_violation'` |
| SoD ON | `returns 200 when a different admin confirms an admin-created payment` | Non-self still works |
| SoD ON | `does NOT write SoD audit log when admin confirms another's payment` | Success audit log only on success |
| misc | `returns 404 when the payment does not exist` | 404 short-circuits |
| misc | `returns 400 for invalid request body (missing confirmedBy)` | Zod validation |
| misc | `returns 500 if the underlying confirmPayment throws` | Error path |
| misc | `checks SoD AFTER loading the payment (404 wins over SoD)` | 404 takes precedence over SoD audit |

All 15 pass. Mock pattern matches the existing `src/app/api/cases/[id]/status/__tests__/route.test.ts` (used as the reference for route tests in this codebase).

---

## 4. Build gates

```
$ npx tsc --noEmit           → 0 errors
$ npm run lint               → 0 warnings
$ npm run build              → 0 errors (all 34 routes build)
$ npx vitest run             → 247/247 passing across 13 files
```

---

## 5. Risks introduced & mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Accountant operational complaint: "I used to confirm my own payments" | Medium | Low | Pre-merge action: notify accountant lead; document SOP change (accountant creates + reconciles; admin confirms). Migration notes §5. |
| CEO creates a payment as admin and now cannot self-confirm when flag is on | High | Low | Flag defaults OFF. UI shows "SoD" badge in advance so the click never happens. Server returns Vietnamese 403 message with explicit instructions. Migration notes §3 behavior matrix. |
| Audit-log consumers break on `after.denied?: boolean` field | Low | Low | Optional field; existing consumers reading `after.confirmedBy` etc. continue to work. Audit log is additive. |
| `requirePermission('payments:approve')` lets `cso` past auth gate before B.3.1 role check rejects | Low | Low | Intentional layered defense: permission gate is generic, domain allow-list is specific. Documented in migration notes §3. |

---

## 6. Rollback steps

```bash
# 1. Revert PAYMENT_CONFIRM_ROLES to ['admin','accountant']
git revert <b3.1-commit-sha>
# OR manually edit src/constants/permissions.ts

# 2. (Optional) Disable SoD if you only want to roll back the flag step
echo "NEXT_PUBLIC_FEATURE_PAYMENT_SOD=false" >> .env.local

# 3. Re-run gates
npm run lint && npx tsc --noEmit && npx vitest run && npm run build

# 4. Deploy
```

No data migrations to reverse. No Firestore documents changed. Rollback is reversible in < 10 min.

---

## 7. Sign-off matrix

| Role | Reviewer | Status |
|---|---|---|
| Tech-lead | Code quality, build, tests | 🟡 Pending sprint-level review (B.3.1 alone is clean) |
| rbac-expert | Server RBAC + SoD tests passing | 🟡 Pending |
| product-owner | Scope matches BACKLOG View 2 Sprint 6.1 | 🟡 Pending |
| CEO + accountant lead | Operational SOP sign-off (B.3.1 changes "who confirms") | 🟡 Pending — required before flag promotion to ON |

B.3.1 itself is implementation-complete. Flag stays OFF in production until CEO + accountant + product-owner sign-off per BACKLOG §9.2. Sprint 6.1 close-out depends on all 14 stories; B.3.1 is not blocking earlier stories.

---

## 8. Files changed (recap)

```
M src/constants/permissions.ts                                         (3-line change + doc)
M src/app/api/payments/[id]/confirm/route.ts                           (refactored — guards added)
M src/components/payments/payment-list.tsx                             (refactored — role check + SoD UI)
M .env.local                                                           (+2 flag lines)
+ src/app/api/payments/[id]/confirm/__tests__/route.test.ts            (NEW — 15 tests)
+ docs/ux-redesign/STORY_B3_1_MIGRATION_NOTES.md                       (NEW)
+ docs/ux-redesign/STORY_B3_1_IMPLEMENTATION_REPORT.md                 (NEW)
```

No changes to: data model, types (AuditAction union is unchanged), Firestore rules, mock store seeds, or any other file.

---

## 9. Linked artifacts

- **Plan:** [`SPRINT_6_1_EXECUTION_PLAN.md`](SPRINT_6_1_EXECUTION_PLAN.md) §1 row B.3.1, Appendix A Q2, §7.3
- **Migration notes:** [`STORY_B3_1_MIGRATION_NOTES.md`](STORY_B3_1_MIGRATION_NOTES.md)
- **Audit source:** `UX_AUDIT_REPORT.md` — F-CRIT-06
- **Implementation report:** this file

---

*End of Story B.3.1 Implementation Report.*