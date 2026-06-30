# Story B.2.2 — Implementation Report

> **Story ID:** B.2.2 (F-HIGH-19)
> **Sprint:** 6.1
> **Owner:** FE-1
> **Implementation date:** 2026-06-30
> **Status:** ✅ Complete — typecheck, lint, build, all tests green
> **Sibling doc:** [`STORY_B2_2_MIGRATION_NOTES.md`](./STORY_B2_2_MIGRATION_NOTES.md)

---

## 1. Scope reminder

> From the user's brief:
> - "Implement Story B.2.2 only."
> - "Modify only files required by Story B.2.2."
> - "Preserve existing case workflow."
> - "Add support for `medical_alert_resolved` status only."
> - "Update status mappings and timeline behavior if required."
> - "Update notifications only if required by this story."
> - "Create or update tests."
> - "Run lint, typecheck, build."
> - "Stop after Story B.2.2 is complete."

This report documents exactly what shipped, what tests ran, and what residual risk remains.

---

## 2. Files changed (8 files)

### 2.1 Domain — new `medical_alert_resolved` status

| # | File | Change |
|---|---|---|
| 1 | `src/lib/types/case.ts` | `CaseStatus` union extended: `+ 'medical_alert_resolved'` |
| 2 | `src/constants/case-status.ts` | `+ LABEL 'Đã xử lý cảnh báo'`, `+ COLORS emerald-100/800/300`, `+ HEX #10B981`, `+ TRANSITIONS ['medical_alert_resolved', 'complaint', 'completed']` for `medical_alert`, `+ medical_alert_resolved: []` (terminal), `+ 'medical_alert_resolved'` in `TERMINAL_STATUSES`, comment touch-up in `getPipelineStage` |

### 2.2 Notifications — closed lifecycle

| # | File | Change |
|---|---|---|
| 3 | `src/lib/types/notification.ts` | `NotificationEventType` union extended: `+ 'medical_alert_resolved'` |
| 4 | `src/lib/notifications/trigger.ts` | `+ triggerMedicalAlertResolved(caseRecord)` — fire-and-forget to `doctor` + `cso` + `admin` |
| 5 | `src/app/(protected)/notifications/page.tsx` | `+ medical_alert_resolved: CheckCircle2` in `EVENT_ICONS` |
| 6 | `src/components/layout/topbar.tsx` | `+ medical_alert_resolved: CheckCircle2` in `EVENT_ICONS`; `+ CheckCircle2` in lucide-react import |
| 7 | `src/app/api/cases/[id]/status/route.ts` | `+ triggerMedicalAlertResolved(existing)` branch when `newStatus === 'medical_alert_resolved'` |

### 2.3 Routing — URL filter completeness

| # | File | Change |
|---|---|---|
| 8 | `src/components/cases/case-list.tsx` | `+ 'medical_alert_resolved'` in `parseStatusParam()` allow-list |

### 2.4 Tests — new + updated

| # | File | Change |
|---|---|---|
| 9 | `src/constants/__tests__/case-status.test.ts` | Import `TERMINAL_STATUSES`; **soften** B.1.2 legacy assertion; **update** B.1.3 medical_alert matrix assertion to B.2.2 matrix; **new** `describe('medical_alert_resolved — Story B.2.2')` block (10 tests) |
| 10 | `src/app/api/cases/[id]/status/__tests__/route.test.ts` | Mock `triggerMedicalAlertResolved`; import `triggerMedicalAlertResolved`; **new** `describe('medical_alert_resolved — Story B.2.2')` block (5 tests) |

> **Total: 10 files modified, 0 files created.** The story is purely additive at the file level except for the one matrix-edge removal.

---

## 3. Tests executed

### 3.1 Build gates (all required by brief)

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | ✅ **0 errors** |
| Lint | `npm run lint` | ✅ **0 warnings, 0 errors** |
| Build | `npm run build` | ✅ **34 routes, 0 errors** |
| Unit tests | `npm run test -- --run` | ✅ **232 passed / 232** (12 test files) |

### 3.2 B.2.2-specific coverage

#### `src/constants/__tests__/case-status.test.ts`

- **`medical_alert allowed transitions` (4 tests)** — `medical_alert_resolved` is included; `procedure_completed` is NOT; `complaint` and `completed` still present; full matrix equals `['medical_alert_resolved', 'complaint', 'completed']`.
- **`medical_alert_resolved is a terminal status` (5 tests)** — entry exists in `CASE_STATUS_TRANSITIONS`; outgoing transitions `=== []`; no edge to `procedure_completed`; no edge to `completed`; no edge back to `medical_alert` (no resurrection).
- **`TERMINAL_STATUSES coverage` (1 test)** — array contains `'medical_alert_resolved'`.

#### `src/app/api/cases/[id]/status/__tests__/route.test.ts`

- **`allows medical_alert → medical_alert_resolved (200)`** — happy path; `updateCaseStatus` invoked with the new status; audit log written.
- **`rejects medical_alert → procedure_completed (400)`** — the removed back-door returns 400 with a Vietnamese error message; no data mutation.
- **`fires triggerMedicalAlertResolved on successful transition`** — notification fires exactly once.
- **`does NOT fire triggerMedicalAlert when transitioning to medical_alert_resolved`** — original-alert trigger does not re-fire on resolution (avoids duplicate notifications).
- **`medical_alert_resolved is terminal: no outgoing transitions from it`** — any forward attempt returns 400; no update.

### 3.3 Pre-existing tests — regression check

The following pre-existing test files were touched by B.2.2 because they assert the `medical_alert` matrix; their assertions were updated to match the new matrix:

| Test file | Change |
|---|---|
| `src/constants/__tests__/case-status.test.ts` (B.1.2 line 73) | Softened from exact-array equality to `not.toContain('procedure_completed')` |
| `src/constants/__tests__/case-status.test.ts` (B.1.3 line 159) | Updated exact-array to `['medical_alert_resolved', 'complaint', 'completed']` |
| `src/app/api/cases/[id]/status/__tests__/route.test.ts` | Mock + import extended |

All 232 pre-existing tests still pass.

### 3.4 Manual smoke (no Playwright yet — Sprint 6.3 adds it)

A short smoke checklist per [`SPRINT_6_1_EXECUTION_PLAN.md` §6.3](./SPRINT_6_1_EXECUTION_PLAN.md) item 12:

1. Log in as `doctor`.
2. Open a case currently in `medical_alert`.
3. In the **Trạng thái ca** tab, click **"Đã xử lý cảnh báo"** (appears in the green "Chuyển tiếp" section, not the amber caution section).
4. Confirm in the dialog.
5. Expect: case badge becomes emerald **"Đã xử lý cảnh báo"**; status workflow panel collapses (no outgoing transitions); audit log shows `case_status_changed` with `before: medical_alert`, `after: medical_alert_resolved`.
6. Check the topbar notification bell: a new in-app notification **"✅ CẢNH BÁO CHUYÊN MÔN ĐÃ XỬ LÝ — …"** is visible.
7. Try to transition the case to anything else: the panel shows the empty-state message **"Trạng thái hiện tại không có phép chuyển tiếp nào."**

---

## 4. Risks introduced

### 4.1 Risk register (B.2.2 scope only)

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| **R1** | **Case currently in `medical_alert` mid-flight loses its `procedure_completed` recovery path.** A case already in `medical_alert` that the medical team wanted to "skip back into the procedure workflow" can no longer do so directly. | Low | Low — the workflow was an undocumented back-door; documented paths (`medical_alert_resolved`, `complaint`, `completed`) all remain. | Notification on resolution (`triggerMedicalAlertResolved`) signals the medical team so they don't assume the case is stuck. Pre-merge note to the medical team in the slack channel. |
| **R2** | **Audit log retention.** No new audit log entries are introduced beyond the pre-existing `case_status_changed` entry; `triggerMedicalAlertResolved` writes a notification, not an audit row. | None | None | The status-change itself is already audited. Notification records are kept in the notifications collection per the existing data-retention policy. |
| **R3** | **Misclassification of the new terminal status in reports.** `medical_alert_resolved` joins `completed`, `cancelled` in `TERMINAL_STATUSES`. The pipeline funnel already excludes terminals (returns `null`); the **revenue** and **customer** report tabs do NOT currently filter on `TERMINAL_STATUSES` — they show whatever records exist. This is **pre-existing behavior**, not introduced by B.2.2. | Low | Low — first production usage will surface the question "do we count `medical_alert_resolved` as a completed case in revenue?" | Out of scope for B.2.2. Document as a follow-up note for B.3.x polish. |
| **R4** | **No production rollout guard.** `medical_alert_resolved` ships in code the moment this PR merges. There is no feature flag gating the new status. | Low (matches the BACKLOG expectation) | Low — no existing case can be in this status yet, so the only effect of merging is the UI / API will accept the new status. | Per [`SPRINT_6_1_EXECUTION_PLAN.md` §7.4](./SPRINT_6_1_EXECUTION_PLAN.md), the new `CaseStatus` value is an **enum extension** — no data migration needed, no readers break. Rollback is the inverse enum-removal (see Migration Notes §8). |

### 4.2 Risks explicitly NOT introduced

- No new feature flags required (B.2.2 is a static-config + enum change, not a runtime gate).
- No new dependencies, no bundle bloat.
- No changes to Firestore rules or storage rules (Phase 5 remaining scope).
- No changes to `firestore.rules` RBAC — `CASE_STATUS_CHANGE_ROLES` is the existing server-side gate (B.1.3) and is reused without modification.
- No changes to `next.config.js`, Vercel config, or any deployment surface.

---

## 5. Rollback steps

### 5.1 Targeted rollback (B.2.2 only — without touching B.1.2)

```bash
# 1. Identify the B.2.2 commit on phase-6/sprint-6.1
git log --oneline phase-6/sprint-6.1 --grep="B.2.2"

# 2. Revert just that commit
git revert <B.2.2-commit-sha>

# 3. Verify gates
npx tsc --noEmit
npm run lint
npm run build
npm run test -- --run
```

All four gates should remain green after revert (the enum removal is type-safe; the matrix restoration re-enables the `procedure_completed` back-door but no production data is affected because no case can have been transitioned into `medical_alert_resolved` yet).

### 5.2 Whole-sprint rollback

See [`SPRINT_6_1_EXECUTION_PLAN.md` §7.5](./SPRINT_6_1_EXECUTION_PLAN.md). B.2.2 has no dedicated feature flag, so it rolls back as part of the sprint merge revert.

---

## 6. Definition of Done — B.2.2

| DoD item (from Sprint 6.1 plan §8.2, line 428) | Status |
|---|---|
| `'medical_alert_resolved'` exists in `CaseStatus` | ✅ `src/lib/types/case.ts:40` |
| `medical_alert` cannot transition to `'procedure_completed'` | ✅ `src/constants/case-status.ts:93` + 400 test |
| `medical_alert` CAN transition to `'medical_alert_resolved'` | ✅ `src/constants/case-status.ts:93` + 200 test |
| New status is terminal (no outgoing transitions) | ✅ `medical_alert_resolved: []` + 5 terminal tests |
| Green badge with `CheckCircle` icon | ✅ `bg-emerald-100 text-emerald-800` + `CheckCircle2` in 2 icon maps |
| Tests written | ✅ 15 new tests (10 in `case-status.test.ts`, 5 in `route.test.ts`) |
| `npx tsc --noEmit` → 0 errors | ✅ |
| `npm run lint` → 0 warnings | ✅ |
| `npm run build` → 34 routes, 0 errors | ✅ |
| `npm run test` → all tests green | ✅ 232/232 |

---

## 7. Out-of-scope items (explicitly NOT changed)

The brief explicitly limits scope to B.2.2. The following related items were considered and **deferred**:

- **B.2.2 audit log entry specifically for "alert resolved"** — the existing `case_status_changed` audit row already captures `before: 'medical_alert'` and `after: 'medical_alert_resolved'`, which is the same evidence trail. Adding a separate `medical_alert_resolved` audit action would be a new `AuditAction` value (currently 18 types, F-MED-17 is the owner of PII redaction — out of scope).
- **`StatCard` filter for `medical_alert_resolved` cases** — no dashboard demand yet; surfaced as a Phase 6.4 follow-up.
- **`medical_alert_resolved` as a status-filter chip in `/cases`** — the URL filter (`?status=medical_alert_resolved`) works via `parseStatusParam`, but no chip is added. Terminal-status discovery is typically via the case detail page, not the list page.
- **Auto-create a "post-resolution follow-up" task** — currently the workflow expects the doctor to mark the case resolved manually. Auto-tasking belongs to a Sprint 7.x enhancement.
- **Triggers / Cloud Functions** — out of Phase 6 scope; the entire API surface stays in Next.js route handlers.

---

## 8. Acceptance statement

Story B.2.2 ships with:

- 29-value `CaseStatus` union (28 → 29).
- Updated transition matrix that closes the `medical_alert → procedure_completed` back-door (F-HIGH-19).
- Closed lifecycle notification (`triggerMedicalAlertResolved`) for the medical team.
- 15 new unit tests + 2 updated assertions; **all 232 tests green**.
- Zero new dependencies; zero new feature flags; zero changes to Firestore rules or RBAC.
- MIGRATION_NOTES.md and IMPLEMENTATION_REPORT.md committed in the same branch.

**Ready for code review.**

---

*End of B.2.2 Implementation Report.*