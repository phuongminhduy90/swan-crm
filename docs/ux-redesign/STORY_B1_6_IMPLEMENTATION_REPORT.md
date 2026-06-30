# Story B.1.6 — Implementation Report

> **Story:** Add doctor / nurse / coordinator to complaint notifications
> **ID:** B.1.6 · **Audit ref:** F-HIGH-21 · **Sprint:** 6.1 · **Owner:** FE-3
> **Branch:** `phase-6/sprint-6.1` (per `SPRINT_6_1_EXECUTION_PLAN.md` §7.1)
> **Date:** 2026-06-30
> **Status:** ✅ Implemented — 11 new tests green, lint/typecheck/build all clean.

---

## 1. Files changed

### Modified (3)

```
src/lib/notifications/trigger.ts          # triggerComplaint() — async IIFE resolves staff
src/lib/notifications/templates.ts        # buildComplaintNotification() — new object overload + body shape
src/lib/mock/store.ts                     # sa-006 seed for case-006 (full medical team)
```

### Created (3)

```
docs/ux-redesign/STORY_B1_6_MIGRATION_NOTES.md
docs/ux-redesign/STORY_B1_6_IMPLEMENTATION_REPORT.md     # this file
src/lib/notifications/__tests__/trigger.test.ts          # 11 new tests
```

### Untouched (per scope rules)

- `src/app/api/cases/[id]/status/route.ts` — call site unchanged; still calls `triggerComplaint(existing);`
- `src/lib/notifications/in-app.ts` — unchanged
- `src/lib/firestore/notifications.ts` — unchanged (recipient shape is the same `recipientUserIds?: string[]`)
- `src/lib/notifications/trigger.ts:triggerMedicalAlert` and all other triggers — unchanged
- All UI components — unchanged

---

## 2. Tests executed

### Targeted (Story B.1.6)

`npx vitest run src/lib/notifications/__tests__/trigger.test.ts` →
**11 tests, all green** (6ms)

| # | Group | Test |
|---|---|---|
| 1 | baseline | still targets cso + admin + master_sales when no staff assignment exists |
| 2 | baseline | still fires the notification when staff resolution throws |
| 3 | medical | adds doctor + coordinator + nurse[0] as recipientUserIds |
| 4 | medical | dedupes recipientUserIds when doctor and coordinator share a uid |
| 5 | medical | handles a partial staff assignment (doctor only) without throwing |
| 6 | medical | returns an empty recipientUserIds list when no medical roles are assigned |
| 7 | PII | body contains only case code + assigned staff display names — no PII |
| 8 | PII | does not pass customer object to sendInAppNotification |
| 9 | meta | preserves the eventType = "complaint" and the caseId |
| 10 | body | renders doctor / nurse / coordinator names when present in the users map |
| 11 | body | omits staff lines when user lookup returns no matches (defensive) |

### Full suite (regression check)

`npm test` → **12 test files, 201 tests, all green** (4.06s total)

```
✓ src/lib/notifications/__tests__/trigger.test.ts        11 tests   6ms
✓ src/app/api/cases/[id]/status/__tests__/route.test.ts  23 tests  80ms
✓ src/components/ui/__tests__/modal.test.tsx             24 tests 841ms
✓ src/components/customers/__tests__/customer-form.test  14 tests 941ms
✓ src/components/cases/__tests__/case-list-lab-overdue    8 tests   3ms
+ 7 more pre-existing test files
```

### Code quality gates

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm run lint` | ✅ 0 warnings — "No ESLint warnings or errors" |
| `npm run build` | ✅ 34 routes, 0 errors |

---

## 3. Risks introduced

| # | Risk | Likelihood | Impact | Mitigation in this PR |
|---|---|---|---|---|
| **R1** | Notification latency increases because of the extra Firestore round-trips (`getStaffAssignment` + `getAllUsers`). | Medium | Low | Runs inside the existing fire-and-forget IIFE — does not block the API response. The status route already returns success before the notification resolves. |
| **R2** | `getAllUsers()` reads the whole user collection on every complaint. | Low | Low (dev) / Medium (prod scale) | 12 users in dev seed; in production the `users` collection is small (≤ few hundred). Acceptable for now. Re-evaluate at > 5k users. |
| **R3** | If the staff assignment exists but the user document was deleted, the body could include `undefined` or a stale display name. | Low | Low | Body builder uses optional chaining (`byId.get(id)?.displayName`); tests assert no `undefined` / `null` strings leak. |
| **R4** | A future contributor could add PII fields to the body without realizing — re-introducing the F-HIGH-21 regression. | Medium | Medium | (a) Explicit `// PII fields are NEVER included` comment on the new body builder. (b) Test #7 asserts absence of `nationalIdNumber`/`medicalNote`/`privacyNote`/`address`/raw user IDs. (c) Body uses a `staffNames: { doctor?, nurse?, coordinator? }` shape — there is no path to the customer object. |
| **R5** | If `sendInAppNotification` is mocked to throw (e.g. by a future test), the failure is silently swallowed like every other trigger. | Low | Low | Matches existing fire-and-forget posture across all triggers; documented in migration notes. |

### Risks explicitly **not** introduced

- ❌ No new permission / RBAC rules.
- ❌ No new data fields or schema changes.
- ❌ No change to `CaseStatus` enum or transition matrix.
- ❌ No change to `triggerMedicalAlert` or any non-complaint trigger.
- ❌ No change to the call site at `src/app/api/cases/[id]/status/route.ts:122`.
- ❌ No data migration required.

---

## 4. Rollback steps

### Quick revert (PR-level)

```bash
git revert <b1.6-merge-sha>
git push origin phase-6/sprint-6.1
```

This drops:
- `src/lib/notifications/trigger.ts` → restored to single-baseline-role form
- `src/lib/notifications/templates.ts` → restored to single-arg form
- `src/lib/notifications/__tests__/trigger.test.ts` → removed
- `sa-006` mock assignment → removed
- Both docs → removed

**Time to rollback: < 5 min.** No data migration needed — see §"Data impact" below.

### Surgical rollback (keep the seed, drop the code)

If you want to keep the test infrastructure but disable the medical-team
recipients:

```diff
// src/lib/notifications/trigger.ts
-    const recipientUserIds: string[] = [];
-    let staffNames = {};
-    try {
-      const assignment = await getStaffAssignment(caseRecord.id);
-      ...
-    } catch (err) { ... }
+    const recipientUserIds: string[] = [];
+    const staffNames = undefined;
```

Notification still fires for the baseline `cso` / `admin` / `master_sales`
recipients — the pre-B.1.6 behavior.

### Data impact

| Artifact | On rollback |
|---|---|
| `notifications` collection | Already-fired complaint notifications with the new recipient set remain — they are immutable. No new writes are made on rollback, so the surface stops growing. |
| `staffAssignments` collection | `sa-006` mock row is a **dev-mode** in-memory record. It is not persisted in production. Harmless. |
| `users` collection | Unchanged. |
| All other entities | Unchanged. |

### Feature flag

This story ships **without a feature flag**. Rationale: see
[STORY_B1_6_MIGRATION_NOTES.md §"Feature flag"](./STORY_B1_6_MIGRATION_NOTES.md#feature-flag).
The change is purely additive to an existing notification fan-out and
fixes a high-severity audit finding (F-HIGH-21) that should land in the
next release.

If a flag is required post-hoc (e.g. for an enterprise customer who needs
the old recipient set), the surgical diff above is the smallest change.

---

## 5. Acceptance checklist (per SPRINT_6_1_EXECUTION_PLAN.md §8.2 + DoD)

| Criterion | Status | Evidence |
|---|---|---|
| `triggerComplaint` notifies doctor + nurse + coordinator resolved via `getAllUsers()` | ✅ | Tests #3, #4 |
| Payload excludes `nationalIdNumber` / `medicalNote` / `privacyNote` | ✅ | Test #7 |
| Existing complaint behavior preserved (baseline recipients still fire) | ✅ | Tests #1, #2, #6 |
| Failure during staff resolution does NOT abort the notification | ✅ | Test #2 |
| Unit tests added (`src/lib/notifications/__tests__/trigger.test.ts`) | ✅ | 11 tests, all green |
| `npx tsc --noEmit` clean | ✅ | 0 errors |
| `npm run lint` clean | ✅ | 0 warnings |
| `npm run build` clean | ✅ | 34 routes, 0 errors |
| Migration notes + implementation report created | ✅ | This PR |

---

## 6. Manual smoke checklist (developer verification)

Per `SPRINT_6_1_EXECUTION_PLAN.md §6.3, item 10` (B.1.6 smoke):

1. ✅ `npm run dev` → open `/cases/[id]` for `case-006` (has full medical team).
2. ✅ Trigger a complaint status change.
3. ✅ Open `/notifications` as `user-008` (doctor) → complaint notification present.
4. ✅ Open `/notifications` as `user-009` (nurse) → complaint notification present.
5. ✅ Open `/notifications` as `user-010` (coordinator) → complaint notification present.
6. ✅ Inspect the notification body — does NOT contain CCCD, address, medical notes, or raw user IDs.
7. ✅ Repeat for `case-001` (no doctor/nurse/coordinator assigned) — baseline recipients still receive it; medical team is empty.
8. ✅ Repeat with Firestore offline (or `getStaffAssignment` mocked to throw) — baseline recipients still receive the notification.

(Automated coverage in the new test file replaces most of these manual steps.)

---

## 7. See also

- [STORY_B1_6_MIGRATION_NOTES.md](./STORY_B1_6_MIGRATION_NOTES.md) — companion doc
- [SPRINT_6_1_EXECUTION_PLAN.md §1 (B.1.6 row)](./SPRINT_6_1_EXECUTION_PLAN.md) — scope + acceptance
- [SPRINT_6_1_EXECUTION_PLAN.md §6.3 (B.1.6 smoke step)](./SPRINT_6_1_EXECUTION_PLAN.md) — manual verification
- `src/lib/notifications/trigger.ts` — implementation
- `src/lib/notifications/__tests__/trigger.test.ts` — 11 new tests
- `ux_audit_findings.json:189` — F-HIGH-21 source
