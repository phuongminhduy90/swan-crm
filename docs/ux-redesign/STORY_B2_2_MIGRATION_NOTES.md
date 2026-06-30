# Story B.2.2 — Migration Notes

> **Story ID:** B.2.2 (F-HIGH-19)
> **Sprint:** 6.1
> **Owner:** FE-1
> **Branch:** `phase-6/sprint-6.1/feat/case-status-fixes` (paired commit with B.1.2)
> **Date:** 2026-06-30
> **Related plan:** [`SPRINT_6_1_EXECUTION_PLAN.md`](./SPRINT_6_1_EXECUTION_PLAN.md) §1, §4.2, §8.2

---

## 1. What changed

### 1.1 Before (28 case statuses)

`medical_alert` had three valid forward transitions:

```ts
medical_alert: ['procedure_completed', 'complaint', 'completed']
```

The `medical_alert → procedure_completed` edge allowed a case to **skip medical clearance back into the procedure workflow** — a back-door (anti-pattern A13) that re-opens a resolved alert without any documented resolution step.

### 1.2 After (29 case statuses)

`medical_alert` now has **three** valid forward transitions, but **`procedure_completed` is removed** and replaced with a brand-new terminal status:

```ts
medical_alert: ['medical_alert_resolved', 'complaint', 'completed']
medical_alert_resolved: []   // truly terminal — no outgoing edges
```

`medical_alert_resolved` joins `completed`, `cancelled`, and (after this change) the `TERMINAL_STATUSES` allow-list. It carries:

| Field | Value |
|---|---|
| Vietnamese label | `Đã xử lý cảnh báo` |
| Color | `bg-emerald-100 text-emerald-800 border-emerald-300` |
| Hex (Recharts) | `#10B981` |
| Notification icon | Lucide `CheckCircle2` |
| Pipeline funnel stage | `null` (excluded, like other terminal statuses) |

---

## 2. Files modified (scope = Story B.2.2 only)

### 2.1 Domain types

- **`src/lib/types/case.ts`** — extend `CaseStatus` union with `'medical_alert_resolved'`.

### 2.2 Domain constants

- **`src/constants/case-status.ts`** — three additions + one removal:
  1. Add `medical_alert_resolved: 'Đã xử lý cảnh báo'` to `CASE_STATUS_LABELS`.
  2. Add `medical_alert_resolved: 'bg-emerald-100 text-emerald-800 border-emerald-300'` to `CASE_STATUS_COLORS`.
  3. Add `medical_alert_resolved: '#10B981'` to `CASE_STATUS_HEX`.
  4. Replace `medical_alert: ['procedure_completed', 'complaint', 'completed']` with `medical_alert: ['medical_alert_resolved', 'complaint', 'completed']`.
  5. Add `medical_alert_resolved: []` (terminal) to `CASE_STATUS_TRANSITIONS`.
  6. Append `'medical_alert_resolved'` to `TERMINAL_STATUSES`.
  7. Update the trailing comment on `getPipelineStage` to mention the new terminal status (no behavior change — `medical_alert_resolved` returns `null` like the other terminals).

### 2.3 Notifications (only what B.2.2 requires)

- **`src/lib/types/notification.ts`** — extend `NotificationEventType` union with `'medical_alert_resolved'`.
- **`src/lib/notifications/trigger.ts`** — add fire-and-forget `triggerMedicalAlertResolved(caseRecord)` that sends an in-app notification to `doctor` + `cso` + `admin` (same recipient set as `triggerMedicalAlert`, so the same medical team sees both ends of the lifecycle).
- **`src/app/(protected)/notifications/page.tsx`** — add `medical_alert_resolved: CheckCircle2` to the icon map.
- **`src/components/layout/topbar.tsx`** — same icon-map addition; also add `CheckCircle2` to the lucide-react import.
- **`src/app/api/cases/[id]/status/route.ts`** — wire `triggerMedicalAlertResolved` into the status-change flow when `newStatus === 'medical_alert_resolved'`. Fire-and-forget pattern matches `triggerMedicalAlert` / `triggerComplaint`.

### 2.4 Case list URL filter

- **`src/components/cases/case-list.tsx`** — append `'medical_alert_resolved'` to the `known` allow-list inside `parseStatusParam()` so that `?status=medical_alert_resolved` URL filters (e.g. from a future deep link) work as expected.

### 2.5 Tests

- **`src/constants/__tests__/case-status.test.ts`** — two changes:
  1. Existing regression test for B.1.2 (line 73) is loosened to assert the B.2.2 contract (`medical_alert` does NOT contain `'procedure_completed'`), since the exact matrix is now owned by B.2.2.
  2. Existing B.1.3 matrix assertion (line 159) updated to assert the new B.2.2 matrix (`['medical_alert_resolved', 'complaint', 'completed']`).
  3. New top-level `describe` block dedicated to B.2.2 (10 tests) covering: forward transitions, terminal semantics, `TERMINAL_STATUSES` membership.
- **`src/app/api/cases/[id]/status/__tests__/route.test.ts`** — two changes:
  1. Mock registration extended with `triggerMedicalAlertResolved: vi.fn()`.
  2. Import extended with `triggerMedicalAlertResolved`.
  3. New top-level `describe` block dedicated to B.2.2 (5 tests) covering: 200 on valid transition, 400 on removed back-door, notification fires, original alert does NOT re-fire, terminal-status blocks any forward motion.

---

## 3. Schema migration (no data backfill required)

`medical_alert_resolved` is a **pure addition** to the `CaseStatus` enum and to `CASE_STATUS_TRANSITIONS`. No documents need rewriting — every existing case continues to carry a valid status from the union. The `medical_alert → procedure_completed` edge is removed, but any case currently in `medical_alert` continues to have valid forward transitions (`medical_alert_resolved`, `complaint`, `completed`).

**Rollback safety:** the previous matrix used `'procedure_completed'` as a forward target from `medical_alert`. If a case is **mid-flight in `procedure_completed`** after a `medical_alert → procedure_completed` transition (this requires an existing data path that is now disallowed), it remains in `procedure_completed` and continues forward normally — the rollback simply re-adds the removed edge so future transitions can use it again. **No data is orphaned by this change.**

---

## 4. Behavioral compatibility

| Surface | Before | After | Compatible? |
|---|---|---|---|
| `medical_alert → medical_alert_resolved` | ❌ not allowed | ✅ allowed (new) | additive |
| `medical_alert → procedure_completed` | ✅ allowed | ❌ 400 from API | **breaking** |
| `medical_alert → complaint` | ✅ allowed | ✅ allowed | unchanged |
| `medical_alert → completed` | ✅ allowed | ✅ allowed | unchanged |
| `medical_alert_resolved → *` | (status did not exist) | 400 from API | additive |
| `CaseStatus` type union size | 28 | 29 | additive |
| `TERMINAL_STATUSES` array size | 2 | 3 | additive |
| `CASE_STATUS_LABELS` completeness | exhaustive | exhaustive | unchanged |
| `CASE_STATUS_COLORS` completeness | exhaustive | exhaustive | unchanged |
| `CASE_STATUS_HEX` completeness | exhaustive | exhaustive | unchanged |
| `getPipelineStage()` behavior for terminals | `null` | `null` (also for `medical_alert_resolved`) | unchanged |

The only **breaking change** is the removal of the `medical_alert → procedure_completed` edge — which is the entire purpose of the story (F-HIGH-19).

---

## 5. UI surface

- **Status badge** — uses the new `CASE_STATUS_COLORS['medical_alert_resolved']` (emerald tint). Renders automatically wherever a `CaseStatusBadge` is shown (case list, case detail, customer timeline).
- **Status workflow panel** — when the case is in `medical_alert`, the forward-transition buttons include **"Đã xử lý cảnh báo"** as a **safe** transition (not caution). The existing `cautionStatuses` array (`['cancelled', 'postponed', 'medical_alert', 'complaint']`) correctly excludes `medical_alert_resolved` — no change needed.
- **Case list** — `?status=medical_alert_resolved` deep links now resolve to the filtered list (added to `parseStatusParam`'s allow-list). The status-filter chip strip is unchanged; `medical_alert_resolved` is intentionally **not** added as a top-level chip — it surfaces via the badge and the URL filter only, since terminal statuses are typically discovery-driven, not chip-driven.
- **Dashboard** — `countLabOverdueCases()` already excluded `medical_alert_resolved` from "active cases" by virtue of the `status === 'waiting_lab_test'` predicate. The `TERMINAL_STATUSES` reference in the `stat-cards.tsx` JSDoc was updated proactively to mention `medical_alert_resolved` as a terminal status.
- **Notifications** — new `medical_alert_resolved` event type renders with the `CheckCircle2` icon in both the topbar dropdown and the `/notifications` page.

---

## 6. Permissions

`medical_alert_resolved` is reachable through the existing `CASE_STATUS_CHANGE_ROLES` server-side guard (B.1.3, behind `FEATURE_SERVER_RBAC`). No permission constant changes are needed — the same set of roles that can flip a case to `medical_alert` can flip it back to `medical_alert_resolved`.

This is intentional: the doctor's role is in `CASE_STATUS_CHANGE_ROLES`, and a doctor is the natural resolver of a medical alert. No separate "resolver role" is introduced.

---

## 7. Anti-pattern scan

Before merge, the following anti-patterns were verified absent (per [`DESIGN_DIRECTION.md` §18](../../DESIGN_DIRECTION.md)):

| Anti-pattern | B.2.2 surface | Status |
|---|---|---|
| A1 — silent fallback (`'general'`) | Notification body uses literal `'Cảnh báo chuyên môn'`, no `'general'` fallback | ✅ |
| A6 — hidden-only permissions | Resolution transitions go through the same `CASE_STATUS_CHANGE_ROLES` server gate as other transitions | ✅ |
| A13 — permissive transitions | `medical_alert → procedure_completed` back-door removed; new `medical_alert_resolved` has empty outgoing list | ✅ |
| A22 — modal for 22-field form | Status workflow panel unaffected; same component reused | ✅ |

---

## 8. Rollback

If the sprint must roll back B.2.2 specifically (without rolling back B.1.2 — they live on the same commit):

1. Revert the commit that introduced `medical_alert_resolved` in `src/constants/case-status.ts`, `src/lib/types/case.ts`, `src/lib/types/notification.ts`, `src/lib/notifications/trigger.ts`, and the two notification icon maps.
2. Re-add `medical_alert: ['procedure_completed', 'complaint', 'completed']`.
3. Remove `'medical_alert_resolved'` from `TERMINAL_STATUSES`.
4. Drop `medical_alert_resolved: []` from `CASE_STATUS_TRANSITIONS`.
5. Drop the new event-type entries from the two icon maps.
6. Re-run `npx tsc --noEmit && npm run lint && npm run build && npm run test` — must remain green.

**Data impact of rollback:** any case that has already been transitioned to `medical_alert_resolved` will fail to render (the status is no longer in the union). This is acceptable because no production rollout happens until Phase 6.4 per [`SPRINT_6_1_EXECUTION_PLAN.md` §7.3](./SPRINT_6_1_EXECUTION_PLAN.md) (the B.2.2 code lands with the sprint branch; promotion to ON requires CEO + product-owner sign-off).

---

## 9. References

- [`SPRINT_6_1_EXECUTION_PLAN.md`](./SPRINT_6_1_EXECUTION_PLAN.md) — Story B.2.2 row at line 43, 6.2 risk at line 367, DoD at line 428
- [`IMPLEMENTATION_BACKLOG.md`](./IMPLEMENTATION_BACKLOG.md) — F-HIGH-19
- [`DESIGN_DIRECTION.md`](./DESIGN_DIRECTION.md) §18 — anti-pattern list
- [`STORY_B2_2_IMPLEMENTATION_REPORT.md`](./STORY_B2_2_IMPLEMENTATION_REPORT.md) — sibling doc, files-changed summary + tests executed

---

*End of B.2.2 Migration Notes.*