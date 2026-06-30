# Story B.3.1 — Migration Notes

> **Story:** B.3.1 — Remove accountant from `PAYMENT_CONFIRM_ROLES` + SoD check
> **Sprint:** 6.1 | **Phase:** 6 | **Date:** 2026-06-30
> **Audit finding:** F-CRIT-06 (UX_AUDIT_REPORT)
> **Owner:** FE-1 | **Reviewer:** rbac-expert + tech-lead
> **Plan reference:** [`SPRINT_6_1_EXECUTION_PLAN.md`](SPRINT_6_1_EXECUTION_PLAN.md) §1, §2.3 Q2, §4.2, §5 R3, §7, Appendix A Q2

---

## 1. Summary of changes

Two layered guards added to `PATCH /api/payments/[id]/confirm`:

| # | Guard | Always-on? | Source | Effect |
|---|---|---|---|---|
| 1 | Role allow-list | ✅ Yes | `PAYMENT_CONFIRM_ROLES` (now `['admin']`) | `accountant` → 403 |
| 2 | Separation of Duties (SoD) | 🔘 Behind `NEXT_PUBLIC_FEATURE_PAYMENT_SOD` | `payment.createdBy === currentUser.uid` | Self-confirm → 403 + audit log |

The SoD guard writes a structured `payment_confirmed` audit log entry with
`after.denied = true` and `after.reason = 'sod_violation'` so SOC review
can filter denied attempts by action type.

---

## 2. Files changed

| Path | Change |
|---|---|
| `src/constants/permissions.ts` | `PAYMENT_CONFIRM_ROLES` changed from `['admin','accountant']` to `['admin']`. Doc-comment added explaining the contract and the B.3.1 SoD linkage. |
| `src/app/api/payments/[id]/confirm/route.ts` | Added role allow-list guard (always on) + SoD guard (behind flag). SoD-violation path now writes a denial audit log before returning 403. Existing audit log on success preserved. |
| `src/components/payments/payment-list.tsx` | Replaced hardcoded `role === 'accountant' \|\| 'admin'` with `PAYMENT_CONFIRM_ROLES.includes(role)`. Added SoD-aware rendering: when `FEATURE_PAYMENT_SOD` is on, action button is suppressed for rows the current user created (replaced with a "SoD" badge + tooltip). |
| `.env.local` | Added `NEXT_PUBLIC_FEATURE_PAYMENT_SOD=false` (default OFF in production per locked decision Q3). Also added `NEXT_PUBLIC_FEATURE_SERVER_RBAC=false` (was already in plan, missing in local env). |
| `src/app/api/payments/[id]/confirm/__tests__/route.test.ts` | **NEW** — 15 tests covering auth gate, role allow-list, SoD-on/off paths, audit log shapes, and edge cases. |

No data migrations required: this is a static-config + route-guards change only.
No Firestore documents are mutated. No field additions to `Payment`.

---

## 3. Behavior matrix (post-migration)

`PAYMENT_CONFIRM_ROLES = ['admin']` (always-on). `FEATURE_PAYMENT_SOD` controls step 2 only.

| Caller | Caller's `createdBy` of payment | Flag OFF (default prod) | Flag ON |
|---|---|---|---|
| `admin` | same as admin (self) | **200** ✅ (legacy) | **403** + audit log ❌ |
| `admin` | different user | **200** ✅ | **200** ✅ |
| `cso` | any | **403** ❌ (role check) | **403** ❌ (role check) |
| `accountant` | any | **403** ❌ (role check) | **403** ❌ (role check) |
| `master_sales` / `sales_online` / `sales_offline` / `ceo` / `doctor` / `nurse` / `coordinator` / `cskh_postop` / `media` | any | **403** ❌ (`payments:approve` permission gate) | **403** ❌ |

Note: `cso` retains the `payments:approve` *permission* (from `ROLE_PERMISSIONS`) so the auth gate at `requirePermission` passes — but the B.3.1 role allow-list at the route layer blocks cso specifically because cso is not in `PAYMENT_CONFIRM_ROLES`. This is intentional layered defense: the permission layer stays generic; the domain-specific allow-list is the B.3.1 contract.

---

## 4. Feature flag

| Name | Default | Rollback |
|---|---|---|
| `NEXT_PUBLIC_FEATURE_PAYMENT_SOD` | `false` (dev & prod) | Set to `false` → admin can self-confirm again (role allow-list stays enforced). |

The role allow-list change (Step 1: accountant removed) is **not** gated by the flag — it is the always-on contract. The flag only gates the SoD self-confirm check (Step 2).

Promotion to `true` requires CEO + accountant lead + product-owner sign-off per BACKLOG §9.2.

---

## 5. Pre-merge actions (operational)

1. **Notify accountant lead** — SOP change: "Accountant creates + reconciles; admin confirms." Specifically, the accountant can no longer click "Xử lý" on the payment list. Action button hidden for `accountant` role because `PAYMENT_CONFIRM_ROLES.includes('accountant') === false`.
2. **Notify CEO** — Only admin can confirm. For multi-admin orgs, two admins needed (one creates, one confirms) when the SoD flag is on.
3. **Update workflow docs** — `docs/ux-redesign/UI_REFACTOR_PLAN.md` already references the decision; no further doc edits needed in this story.
4. **No Firestore / Firebase rules changes** — Firestore-level security rules are Phase 5 (remaining), out of B.3.1 scope.

---

## 6. Rollback

| Scenario | Action | Time |
|---|---|---|
| Accountant cannot confirm → operational complaint | Revert PR; `PAYMENT_CONFIRM_ROLES` returns to `['admin','accountant']`. No data loss. | < 5 min |
| SoD flag too strict in staging | Set `NEXT_PUBLIC_FEATURE_PAYMENT_SOD=false` and redeploy. Admin can self-confirm again. | < 5 min |
| Both | Revert PR + delete `NEXT_PUBLIC_FEATURE_PAYMENT_SOD` line from `.env.local`. | < 10 min |

---

## 7. Compatibility notes

- **API contract change**: `PATCH /api/payments/[id]/confirm` now returns 403 for the `accountant` role (was 200). This is a breaking change for clients calling as `accountant`. The frontend `payment-list.tsx` already hides the action button when the role is not in `PAYMENT_CONFIRM_ROLES`, so internal UI is consistent.
- **Audit schema**: `AuditLog.after` gains an optional `denied?: boolean` + `reason?: string` shape on the SoD-violation path. Existing audit consumers should treat these as additive optional fields. `AuditAction` union is unchanged (`'payment_confirmed'` covers both success and denial — the `after.denied` discriminator distinguishes).
- **Mock store**: No seed-data changes. Existing pending payments remain pending until an admin confirms them.

---

## 8. Anti-pattern compliance (DESIGN_DIRECTION §18)

| Anti-pattern | Compliant? | How |
|---|---|---|
| A6 — Hidden-only permissions | ✅ | UI hiding via `PAYMENT_CONFIRM_ROLES.includes(role)` is paired with **server-side** enforcement in the route. UI-only hiding is insufficient; B.3.1 fixes the hidden-only gap. |
| A13 — Permissive transitions | ✅ | Role allow-list is strict (`['admin']`). |
| A2 — Raw user IDs in copy | N/A | B.3.1 only references `user.uid` internally; no JSX uses raw IDs. |
| A1 — Silent fallback defaults | ✅ | No `'general'`-style fallbacks introduced. |

---

## 9. Out of scope (deferred)

- **Concurrent-write race** in `confirmPayment` (Firestore transaction): Phase 7 per BACKLOG. B.3.1 only adds the SoD guard; transactional consistency is intentionally deferred.
- **Firestore security rules**: Phase 5 (remaining). B.3.1 protects the API route; Firestore rules would protect direct client writes — separate epic.
- **Refactor of `cso` permission vs `PAYMENT_CONFIRM_ROLES` split**: cso has `payments:approve` but is not in `PAYMENT_CONFIRM_ROLES`. Intentional — keeps `payments:approve` as a generic finance-data access permission and uses `PAYMENT_CONFIRM_ROLES` as the domain-specific confirm-action allow-list. Could be revisited in a future RBAC cleanup pass.

---

*End of Story B.3.1 Migration Notes.*