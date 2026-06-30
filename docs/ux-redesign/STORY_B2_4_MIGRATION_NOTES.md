# Story B.2.4 — Migration Notes

> **Story ID:** B.2.4 (F-CRIT-03, partial — the `procedure_completed`
> second-confirm branch)
> **Sprint:** 6.2
> **Owner:** FE-2
> **Branch:** `phase-6/sprint-6.2`
> **Date:** 2026-06-30
> **Related plan:** [`SPRINT_6_2_EXECUTION_PLAN.md`](./SPRINT_6_2_EXECUTION_PLAN.md) §1, §4.2, §7.4, §3.3 (commit #4 + #5), §10.2
> **Sibling doc:** [`STORY_B2_4_IMPLEMENTATION_REPORT.md`](./STORY_B2_4_IMPLEMENTATION_REPORT.md)

---

## 1. What changed

### 1.1 Before (single ConfirmDialog, no date required, no warning variant)

`ConfirmDialog` had a `'danger' | 'warning' | 'default'` variant union. The
generic second-confirm dialog was used for **every** status transition
indistinguishably, with no requirement to capture
`actualProcedureDate` when the user flipped the case into
`procedure_completed`. The user could skip the date silently — the page
fell back to `new Date()` for `createPostOpFollowups`, producing D1–D90
followups that were anchored on the moment the user clicked confirm,
not on the day the surgery actually happened (F-HIGH-23).

```tsx
// before: the same dialog opened for every transition, no date field
<ConfirmDialog
  open={!!confirmTarget}
  title="Xác nhận chuyển trạng thái?"
  description={<FromToStatusSnippet ... />}
/>

// when case moved into procedure_completed:
const procedureDate = caseRecord.actualProcedureDate
  ? new Date(caseRecord.actualProcedureDate)
  : new Date();        // ← silently used "right now"
await createPostOpFollowups(caseId, customerId, procedureDate, ...);
```

### 1.2 After (warning variant, dedicated rich dialog for procedure_completed)

Three structural changes:

1. `ConfirmDialog` variant union narrows to `'info' | 'warning' | 'danger'`
   (the legacy `'default'` value is renamed to `'info'`). The old
   `'default'` callers in `customer-list.tsx` (`Yêu cầu xóa` reject) and
   `location-list.tsx` (`Kích hoạt địa điểm`) are renamed as a
   type-compliance follow-up. **No behavioral change for those
   callers** — `info` preserves the prior swan/aqua visual.
2. `ConfirmDialog` gains a `confirmDisabled` prop. When `true`, the
   confirm button is non-interactive and `onConfirm` is not invoked.
3. `StatusWorkflow` opens a dedicated rich `ConfirmDialog` (variant
   `warning`) when the next status is `procedure_completed`. The dialog
   captures three things the previous flow skipped:
   - `actualProcedureDate` (required, drives `createPostOpFollowups`).
   - Checklist `allPassed` summary pill (green ✓ "Đạt N/N" or red ✗
     "Thiếu K/N" with guidance copy).
   - Side-effect preview (`6 followup hậu phẫu D1, D3, D7, D14, D30,
     D90` + free-text `tasksDescription`).

`StatusWorkflow` exposes three new optional props — purely additive
contract:

```ts
export interface StatusTransitionExtra {
  actualProcedureDate?: string;        // ISO 'YYYY-MM-DD'
}

export interface ChecklistSummary {
  allPassed: boolean;
  passedCount: number;
  totalCount: number;
}

export interface ProcedureSideEffectSummary {
  followupsCount: number;
  tasksDescription?: string;
}

// signature change (optional param — non-breaking):
onTransition: (newStatus: CaseStatus, extra?: StatusTransitionExtra) => Promise<void>;
```

The page wires all three: it asks `evaluatePreProcedureChecklist(caseId)`
for the summary, persists `actualProcedureDate` to the case BEFORE
calling `updateCaseStatus`, and uses the captured date to seed
`createPostOpFollowups`. Other transitions are untouched (the generic
dialog still renders, just with variant `info` instead of the silent
default).

---

## 2. Outbound effects (callers of changed APIs)

| Surface | Old behavior | New behavior | Risk |
|---|---|---|---|
| `ConfirmDialog` variant `'default'` | swan/info tone | renamed to `'info'`; same tone | low — TypeScript will flag every `'default'` caller at compile time |
| `CustomerList` reject-delete dialog | `variant="default"` | `variant="info"` | none — visual token identical |
| `LocationList` activate dialog | `variant="default"` | `variant="info"` | none — visual token identical |
| All other existing `ConfirmDialog` callers | `variant="danger"` / `"warning"` | unchanged | none |
| `StatusWorkflow` `onTransition` signature | `(newStatus) => Promise<void>` | `(newStatus, extra?) => Promise<void>` | none — extra arg is optional, callers that don't read it are unaffected |
| Cases detail → `createPostOpFollowups` date source | `caseRecord.actualProcedureDate ?? new Date()` | user-typed `actualProcedureDate` from dialog; persisted on the case first; falls back to old value only if user skipped | tracked |

### 2.1 Two callers renamed to `'info'` (type-compliance only, scope: literal-rename)

Per the "modify only files required by Story B.2.4" rule, the rename
of the literal `'default'` → `'info'` is the minimum forced-follow-up
required for the new variant union to type-check. **No logic change** —
`'info'` is the visual twin of the old `'default'` token
(`bg-swan-50`, `text-swan-500`).

`src/components/customers/customer-list.tsx` (line 404):
- Reject-delete confirm: `variant="default"` → `variant="info"`.

`src/components/locations/location-list.tsx` (line 194):
- Activate-location confirm: branch on active flag, pick `info` instead
  of `default`.

---

## 3. Schema and contract

- **No schema migration** — `actualProcedureDate` already exists on
  `CaseRecord` (added in Phase 6 postop-process cleanup; see
  CLAUDE.md "POST_OP_STATUSES typo fixed" note). The dialog writes the
  same field, just with stronger guarantees (now UI-required).
- **No new env vars / feature flags** — Story B.2.4 ships free of
  flags. The matching C.3.2 server-side enforcement is Sprint 7.3 work
  (acknowledged as a known gap, see
  [`STORY_B2_4_IMPLEMENTATION_REPORT.md`](./STORY_B2_4_IMPLEMENTATION_REPORT.md)
  §4 Risks).

---

## 4. Rollback

Three option classes, in order of "lightest touch":

### 4.1 Code-only rollback (revert the PR)

Single commit sequence. Files touched:

- `src/components/ui/confirm-dialog.tsx`
- `src/components/cases/status-workflow.tsx`
- `src/app/(protected)/cases/[id]/page.tsx`
- `src/components/customers/customer-list.tsx` (1 line)
- `src/components/locations/location-list.tsx` (1 line)
- `src/components/ui/__tests__/confirm-dialog.test.tsx` (delete)
- `src/components/cases/__tests__/status-workflow-procedure.test.tsx` (delete)

```bash
git revert <story-b2.4-merge-sha>
npm install             # no deps added
npm run lint && npx tsc --noEmit && npm run build && npm test
```

Time to rollback: < 10 minutes.

### 4.2 Data-tier cleanup

None. The dialog persists `actualProcedureDate` to the existing
`CaseRecord.actualProcedureDate` field. After rollback, any cases that
were confirmed during the B.2.4 window still carry the user-typed date
— which is **stricter data**, not stale data. No remediation needed.

### 4.3 Partial rollback — keep the variant rename, drop the rich dialog

If we ever want to keep the `'info' | 'warning' | 'danger'` token but
back out the rich `procedure_completed` dialog, the patch is:

1. Revert `cases/[id]/page.tsx` `onTransition` to NOT call `updateCase`
   for `actualProcedureDate` (this branch was added by B.2.4).
2. Drop the `isProcedureCompletion` conditional in `status-workflow.tsx`
   (the rich dialog JSX block).
3. Drop the new `checklistSummary` / `sideEffectSummary` /
   `initialProcedureDate` props.
4. Drop the two new test files.

Time to partial-rollback: ~20 minutes.

---

## 5. Anti-pattern gate verification

```bash
# A9 — native confirm()/alert() banned (B.2.4 invariant)
grep -rE "window\.(confirm|alert)" src/ | grep -v __tests__  # → 1 match

  src/app/(protected)/cases/[id]/page.tsx:  if (!confirm('Xóa dịch vụ này?')) return;
```

> The single match is a **pre-existing** native `confirm()` on the
> remove-service handler in the case detail page — owned by Story
> **B.4.5** (Native confirm → ConfirmDialog, Sprint 6.3). It is NOT
> introduced by Story B.2.4; it survives the B.2.4 diff because
> B.2.4 deliberately does not refactor unrelated handlers.

```bash
# A9 — for the procedure_completed flow specifically:
grep src/components/cases/status-workflow.tsx | grep -E "window\.(confirm|alert)"
# → 0 matches (B.2.4 surface uses the ConfirmDialog component, not native
#   calls).
```

---

## 6. Files added / modified

**Modified (5 files)**

1. `src/components/ui/confirm-dialog.tsx` — variant union narrowed to
   `info | warning | danger`; new `confirmDisabled` prop; amber icon +
   amber panel ring for warning; passes `title` through to `Modal` so
   `aria-labelledby` is wired (a11y fix that was already latent in the
   codebase but became necessary once the dialog carries rich
   children).
2. `src/components/cases/status-workflow.tsx` — new rich dialog branch
   for `procedure_completed`; exports `StatusTransitionExtra`,
   `ChecklistSummary`, `ProcedureSideEffectSummary` types.
3. `src/app/(protected)/cases/[id]/page.tsx` — computes checklist
   summary; persists `actualProcedureDate` before flipping status;
   threads the captured date into `createPostOpFollowups`.
4. `src/components/customers/customer-list.tsx` — `variant="default"`
   → `variant="info"` (1 line, type-compliance only).
5. `src/components/locations/location-list.tsx` — same rename (1
   line, type-compliance only).

**Created (2 files)**

6. `src/components/ui/__tests__/confirm-dialog.test.tsx` — 13 tests
   covering variant tonality, description-as-ReactNode, `confirmDisabled`
   semantics, and axe-core a11y on the warning variant.
7. `src/components/cases/__tests__/status-workflow-procedure.test.tsx`
   — 14 tests covering dialog surface, date-required gating,
   `onTransition` payload contract, checklist + side-effect summaries,
   and `window.confirm` / `window.alert` non-usage.
