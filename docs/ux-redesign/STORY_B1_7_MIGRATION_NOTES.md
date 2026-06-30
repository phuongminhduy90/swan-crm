# Story B.1.7 — Migration Notes

> **Story:** Resolve CSKH name dynamically from staff assignment
> **ID:** B.1.7 · **Audit ref:** F-MED-19 · **Sprint:** 6.1 · **Owner:** FE-2
> **Status:** ✅ Complete
> **Date:** 2026-06-30

---

## What changed (in one sentence)

The literal string `'CSKH'` previously passed as `assigneeName` to
`triggerPostOpFollowupDue` in `/api/cases/[id]/status/route.ts` is now
resolved at call time from the case's staff assignment
(`cskhPostopId → displayName` via `getAllUsers()`), with the same literal
`'CSKH'` retained as a deterministic fallback when no assignment or no
matching user is found.

---

## Why this story existed

Before B.1.7, the post-op follow-up notification body always read:

```
Khách: Nguyễn Văn A
Mốc: DD1
Được giao: CSKH          ← literal, never resolved
Vui lòng liên hệ khách hàng để cập nhật tình trạng.
```

Receivers — coordinators and admins in the `cskh_postop` role or
`recipientRoles: ['cskh_postop']` — could not tell which CSKH to contact
without opening the case detail page. This was flagged as anti-pattern A2
in `DESIGN_DIRECTION.md` §18 ("raw user IDs / role labels in copy are
forbidden when a display name is available").

After B.1.7:

```
Khách: Nguyễn Văn A
Mốc: DD1
Được giao: Phạm Ngọc Điệp    ← real display name from staff assignment
Vui lòng liên hệ khách hàng để cập nhật tình trạng.
```

If no staff assignment exists for the case, the literal `'CSKH'` is
preserved — never `'unknown'`, `'general'`, or any other generic sentinel
(anti-pattern A1).

---

## Files touched

| Path | Change | Notes |
|---|---|---|
| `src/lib/notifications/trigger.ts` | **Modified** | Added `CSKH_FALLBACK_LABEL` constant + `resolveCskhDisplayName(caseId)` helper. No change to existing trigger signatures. |
| `src/app/api/cases/[id]/status/route.ts` | **Modified** | `triggerPostOpFollowupDue` call now passes `await resolveCskhDisplayName(existing.id)` instead of the literal `'CSKH'`. Wrapped in try/catch so a regression in the helper cannot abort the status change. |
| `src/lib/notifications/__tests__/trigger.test.ts` | **Modified** | Added 9 B.1.7 tests covering: fallback label invariant, happy path, all fallback paths, defensive error handling, display name trimming, anti-pattern A2 guard. |
| `src/app/api/cases/[id]/status/__tests__/route.test.ts` | **Modified** | Added 5 B.1.7 tests covering: route passes resolved name, fallback propagation, route resilience to helper rejection, helper not consulted for non-post-op transitions, all 6 day variants (D1/D3/D7/D14/D30/D90). |

No other files were touched. **No type, lint, or build regressions.**

---

## Public API

### New helper: `resolveCskhDisplayName(caseId)`

```ts
export async function resolveCskhDisplayName(caseId: string): Promise<string>;
```

**Resolution contract:**

1. Look up the staff assignment for the case via `getStaffAssignment(caseId)`.
2. If `cskhPostopId` is present, resolve the user's display name via a
   single `getAllUsers()` call (amortized lookup).
3. Fall back to the literal `'CSKH'` (exported as `CSKH_FALLBACK_LABEL`)
   when:
   - no staff assignment exists for the case,
   - the assignment has no `cskhPostopId`,
   - the user directory does not contain a matching user,
   - the user record has an empty / whitespace-only `displayName`, or
   - any lookup throws (defensive — never crashes the caller).

**Guarantees:**

- Never throws — all errors are swallowed and logged via `console.error`.
- Never returns `'undefined'` or `null`.
- Never returns a raw user ID (anti-pattern A2 guard).
- Trims whitespace from resolved names.

### New constant: `CSKH_FALLBACK_LABEL`

```ts
export const CSKH_FALLBACK_LABEL = 'CSKH';
```

Exported for tests and any future callers that need to reference the same
fallback literal — keeps the fallback consistent across the codebase.

---

## Behaviour preserved (no regressions)

| Concern | Before B.1.7 | After B.1.7 |
|---|---|---|
| Trigger signature | sync `triggerPostOpFollowupDue(...)` | unchanged |
| Status change response | 200 on success | unchanged (200 on success) |
| Fire-and-forget semantics | post-op notification dispatched in route handler | unchanged |
| Notification recipients | `recipientRoles: ['cskh_postop']` + `[assigneeId]` | unchanged |
| Notification body template | `Mốc: ${followupDay}\nĐược giao: ${assigneeName}` | unchanged — only the `assigneeName` argument changes from `'CSKH'` to a real name |
| Other triggers (complaint, medical alert, payment, etc.) | independent | unchanged — only the post-op `assigneeName` is affected |
| `buildComplaintNotification` / `buildMedicalAlertNotification` / etc. | n/a | unchanged |

---

## Migration steps

1. **No data migration.** All CSKH names were never stored anywhere — they
   were always derived at notification time. The change is purely
   resolution-side.
2. **No env-var or feature-flag requirement.** The change is unconditional
   and has no opt-out. If you must roll back, revert the two commits in
   `src/lib/notifications/trigger.ts` and `src/app/api/cases/[id]/status/route.ts`.
3. **Seed data unchanged.** The dev mock store already contains
   staff assignments for `case-004`, `case-005`, `case-006` with
   `cskhPostopId: 'user-011'` (`Phạm Ngọc Điệp`). No new seed entries
   are required for B.1.7.
4. **Re-run notification flows.** To verify locally, open any case whose
   status has been (or can be) transitioned through `procedure_completed
   → post_op_d1 → post_op_d3 → ...`, then check the Notifications page —
   the `assigneeName` line in the follow-up notification body should now
   show a real Vietnamese display name.

---

## Out-of-scope observations (deferred)

- The `followupDay` label produced by
  `newStatus.replace('post_op_','D').toUpperCase()` yields `'DD1'`,
  `'DD3'`, etc. — a pre-existing label-format quirk. B.1.7 explicitly
  does **not** touch this. It belongs in a follow-up story (e.g.
  "humanize post-op day labels") because renaming would change the
  visible notification copy and require coordinated UI / copy review.
- `triggerComplaint` and `triggerMedicalAlert` already resolve
  doctor/nurse/coordinator display names (Story B.1.6). They do not
  surface CSKH name in the body, so B.1.7 does not need to change them.
- A future story may want to add a similar helper for the `masterSalesId`
  in `buildNewCaseNotification` — that body currently shows
  `staffNames?.masterSales` from the route caller, not from the staff
  assignment. Out of B.1.7 scope.

---

*End of Story B.1.7 Migration Notes.*