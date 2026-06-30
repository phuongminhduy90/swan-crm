# Story B.1.6 — Migration Notes

> **Story:** Add doctor / nurse / coordinator to complaint notifications
> **ID:** B.1.6 · **Audit ref:** F-HIGH-21 · **Sprint:** 6.1 · **Owner:** FE-3
> **Status:** ✅ Complete
> **Date:** 2026-06-30

---

## What changed (in one sentence)

`triggerComplaint()` now resolves the case's assigned `doctor` + `nurse` +
`coordinator` from the staff assignment and adds them to the notification
recipient set (alongside the original `cso` / `admin` / `master_sales` role
fan-out), while the notification body is rebuilt to include only the
assigned staff display names — never any PII.

---

## Files touched

| Path | Change | Notes |
|---|---|---|
| `src/lib/notifications/trigger.ts` | **Modified** | `triggerComplaint` now async-resolves staff from the assignment; baseline recipients preserved. |
| `src/lib/notifications/templates.ts` | **Modified** | `buildComplaintNotification` accepts a `{ caseCode, staffNames? }` object (string overload kept for back-compat). Body now shows assigned staff names when available. |
| `src/lib/mock/store.ts` | **Modified** | Added `sa-006` staff assignment for `case-006` with the full medical team (doctor + nurse + coordinator + cskh) so the new path is exercised by seed data. |
| `src/lib/notifications/__tests__/trigger.test.ts` | **Created** | 11 tests covering: baseline recipient preservation, medical-team resolution, dedup, partial assignments, PII absence, failure tolerance. |

No other files were touched. **No type, lint, or build regressions.**

---

## Public API

### `triggerComplaint(caseRecord)` — unchanged signature

```ts
export function triggerComplaint(caseRecord: CaseRecord): void;
```

The function is still **sync** and **fire-and-forget** — call sites
(`/api/cases/[id]/status/route.ts:122`) continue to do
`triggerComplaint(existing);` without awaiting. The new staff-resolution
work happens inside an internal `async` IIFE whose promise is intentionally
not exposed.

### `buildComplaintNotification(...)` — overloaded

```ts
// New (preferred):
buildComplaintNotification({ caseCode, staffNames? });

// Legacy overload (kept for back-compat — internal use only):
buildComplaintNotification(caseCode: string);
```

The string overload is no longer used by any call site; it is kept so the
public surface of `templates.ts` is unchanged. Future cleanup can drop it
in a follow-up PR.

---

## Recipient model (B.1.6 contract)

| Source | Recipients |
|---|---|
| **Baseline roles (preserved)** | `cso`, `admin`, `master_sales` |
| **Resolved users from staff assignment** | `assignment.doctorId`, `assignment.coordinatorId`, `assignment.nurseIds[*]` |
| **Dedupe** | Recipient user IDs are de-duped before send (defensive). |

If `getStaffAssignment` returns `null` **or** throws, the notification
still fires — only the baseline roles are notified. The medical-team
extension is purely additive.

---

## PII safety (F-HIGH-21 / spec §21.6)

The complaint notification payload **must not** contain:

- `nationalIdNumber` (CCCD)
- `nationalIdIssueDate`, `nationalIdIssuePlace`
- `address`
- `medicalNote`
- `privacyNote`

The new `buildComplaintNotification` body contains at most:

- Case code (`caseRecord.caseCode`)
- Vietnamese role labels + assigned staff `displayName`s
  (e.g. `Bác sĩ phụ trách: BS. Phạm Ngọc Anh`)

A unit test (`'body contains only case code + assigned staff display names — no PII'`)
asserts that the body string does **not** match `nationalIdNumber`,
`nationalId`, `CCCD`, `medicalNote`, `privacyNote`, `address`, or any raw
`user-XXX` id pattern.

---

## Migration steps for existing data

**None.** This story is purely an additive change to a notification
trigger. No data migration is required.

- Existing cases already in `complaint` status: not affected retroactively.
- Existing staff assignments: not modified. The new `sa-006` entry in the
  mock store is **dev-only** seed data so the test setup can exercise the
  new path; production seed/firestore data is untouched.
- The notification fan-out happens at the moment of transition; old
  complaints don't re-fire.

---

## Backwards-compatibility

| Call site | Status |
|---|---|
| `src/app/api/cases/[id]/status/route.ts:122` | Unchanged — still calls `triggerComplaint(existing);` sync. |
| `src/lib/notifications/templates.ts:buildComplaintNotification` | String overload kept — `src/lib/notifications/trigger.ts` is the only consumer and uses the new object form. |

`triggerMedicalAlert` and other triggers are **unaffected** — this story
touches only the `complaint` path.

---

## Failure mode (defensive design)

If the Firestore `getStaffAssignment` read fails (network blip, missing
collection, etc.) the inner `try/catch` swallows the error and the
notification still fires for the baseline roles. A `console.error` is
emitted for visibility. The same is true if `getAllUsers` throws.

This matches the existing fire-and-forget posture of every other trigger
in this file (see `triggerNewCaseNotification`, `triggerPaymentPendingNotification`,
etc.) — caller never sees the error.

---

## Feature flag

**None.** This story is small, additive, and improves escalation coverage
on a high-severity path (F-HIGH-21). Shipping without a flag is the
correct call here:

- No destructive change to existing behavior — baseline recipients still
  receive the notification.
- No new permission / RBAC rules.
- No new schema or data shape.
- F-HIGH-21 was a `high` severity finding ("complaint notification
  excludes doctor, nurse, postop roles") that should be fixed in the
  next release, not gated behind a flag.

---

## Verification (run before merge)

```bash
# Targeted
npx vitest run src/lib/notifications/__tests__/trigger.test.ts

# Full suite (201 tests, 12 files — all green)
npm test

# Code quality
npx tsc --noEmit     # 0 errors
npm run lint         # 0 warnings
npm run build        # 34 routes, 0 errors
```

All four commands green at the time of this write-up.

---

## See also

- [STORY_B1_6_IMPLEMENTATION_REPORT.md](./STORY_B1_6_IMPLEMENTATION_REPORT.md) — implementation details + risks
- [SPRINT_6_1_EXECUTION_PLAN.md §1 (B.1.6 row)](./SPRINT_6_1_EXECUTION_PLAN.md) — scope + acceptance
- `src/lib/notifications/trigger.ts` — implementation
- `src/lib/notifications/__tests__/trigger.test.ts` — tests
- F-HIGH-21 in `ux_audit_findings.json:189` — original audit finding
