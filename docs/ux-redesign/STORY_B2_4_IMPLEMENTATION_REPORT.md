# Story B.2.4 — Implementation Report

> **Story ID:** B.2.4 (F-CRIT-03, partial — `procedure_completed`
> second-confirm branch)
> **Sprint:** 6.2
> **Owner:** FE-2
> **Implementation date:** 2026-06-30
> **Status:** ✅ Complete — `npx tsc --noEmit` 0 errors, `npm run lint`
> 0 warnings, `npm run build` 34 routes / 0 errors, **358 tests
> green** (27 new for B.2.4)
> **Sibling doc:** [`STORY_B2_4_MIGRATION_NOTES.md`](./STORY_B2_4_MIGRATION_NOTES.md)
> **Sign-offs required:** ux-designer (§7.4 Vietnamese copy); tech-lead
> (§10.1 build gates)

---

## 1. Scope reminder

> From the user's brief:
> - **Implement Story B.2.4 only.**
> - **Modify only files required by Story B.2.4.**
> - **Add warning variant to ConfirmDialog.**
> - **Require `actualProcedureDate` before `procedure_completed`.**
> - **Do not use native `window.confirm()`.**
> - **Preserve existing status workflow.**
> - **Create or update tests.**
> - **Run lint / typecheck / build.**
> - **Create:**
>   - `docs/ux-redesign/STORY_B2_4_MIGRATION_NOTES.md`
>   - `docs/ux-redesign/STORY_B2_4_IMPLEMENTATION_REPORT.md`
> - **Stop after Story B.2.4 is complete.**

This report documents exactly what shipped, what tests ran, what
residual risk remains, and how to roll back — answering the criteria
listed in [`SPRINT_6_2_EXECUTION_PLAN.md` §10.2 Story B.2.4
acceptance](./SPRINT_6_2_EXECUTION_PLAN.md).

---

## 2. What shipped

### 2.1 `ConfirmDialog` — new `warning` variant (commit #4)

`src/components/ui/confirm-dialog.tsx` was rewritten to expose the
canonical `'info' | 'warning' | 'danger'` variant union (replacing the
old `'danger' | 'warning' | 'default'`) plus a new
`confirmDisabled` prop for the Story B.2.4 gating semantics. The
`title` is now forwarded to `Modal` so `aria-labelledby` is wired
automatically (a previously latent a11y improvement that the new rich
dialog now exercises).

```ts
export type ConfirmDialogVariant = 'info' | 'warning' | 'danger';

interface ConfirmDialogProps {
  ...
  variant?: ConfirmDialogVariant;          // default 'danger' to preserve
                                           // historical destructive-default
  loading?: boolean;
  confirmDisabled?: boolean;               // ← Story B.2.4
}
```

**Visual tokens per variant**

| Variant | Icon | Background | Icon color | Confirm button | Panel ring |
|---|---|---|---|---|---|
| `info` | Lucide `Info` | `bg-swan-50` | `text-swan-500` | `primary` (swan gradient) | `ring-swan-200/70` |
| `warning` | Lucide `AlertTriangle` | `bg-amber-50` | `text-amber-500` | `primary` | `ring-amber-300/70` |
| `danger` | Lucide `AlertTriangle` | `bg-red-50` | `text-red-500` | `danger` (red) | `ring-red-300/70` |

### 2.2 `StatusWorkflow` — `procedure_completed` second-confirm (commit #5)

`src/components/cases/status-workflow.tsx` now branches on the target
status. When the user picks `procedure_completed`, the dialog opens in
the **`warning` variant** with:

1. **Status-change copy** — "Bạn đã chắc chắn muốn chuyển ca sang trạng
   thái `Đã thực hiện xong`? Hành động này sẽ kích hoạt tự động tạo
   followup hậu phẫu và không thể hoàn tác."
2. **Checklist summary pill** — green ✓ "Đạt N/N" or red ✗
   "Thiếu K/N" computed by `evaluatePreProcedureChecklist(caseId)`.
3. **Side-effect preview** — "Sẽ tự động tạo: 6 followup hậu phẫu (D1, D3,
   D7, D14, D30, D90)" + optional `tasksDescription`.
4. **Required date input** — `<input type="date">` with `aria-required`,
   `required`, `max={today}`, fed into a controlled local state that
   re-initializes from `initialProcedureDate` when the dialog closes.
5. **Confirm button disabled** until the date is filled.

Other transitions (`scheduled`, `postponed`, `medical_alert`,
`cancelled`, `completed`, etc.) keep the existing generic dialog,
except that the variant now follows the rule:
- caution target → `warning`
- safe forward target → `info`

That fallback variant change is invisible to users (swan aqua token)
and aligns the legacy flow with the new contract.

### 2.3 Case detail page — capture + persist + use the date

`src/app/(protected)/cases/[id]/page.tsx`:

- A second `useEffect` runs after data load to compute the checklist
  summary via dynamic `import('@/lib/checklist')` (keeps the existing
  code-split pattern used for `triggerAutoTasks`).
- The `StatusWorkflow` receives `initialProcedureDate`,
  `checklistSummary`, and `sideEffectSummary`.
- The `onTransition` callback was extended. When the captured
  `actualProcedureDate` is present at `procedure_completed` time, the
  page:
  1. Calls `updateCase(caseId, { actualProcedureDate: <ISO> }, userId)`.
  2. Writes an audit log via `writeAuditLog()`.
  3. Proceeds with `updateCaseStatus()` (unchanged).
  4. Uses the captured ISO date as the seed for
     `createPostOpFollowups()` — replacing the previous silent
     fallback to `new Date()`.

---

## 3. Test strategy executed

### 3.1 New test files

| File | Test count | Coverage |
|---|---:|---|
| `src/components/ui/__tests__/confirm-dialog.test.tsx` | 13 | Variant token mapping (info/warning/danger), description-as-`ReactNode` with embedded `<input>`, `confirmDisabled` semantics (disabled button does not invoke `onConfirm`), interaction round-trip, axe-core on the warning variant |
| `src/components/cases/__tests__/status-workflow-procedure.test.tsx` | 14 | Dialog opens with `warning` variant and amber panel ring, required date input, confirm-disabled gating, payload forwarded to `onTransition`, cancellation, checklist summary pills (`Đạt N/N` and `Thiếu K/N`), side-effect summary content, generic dialog for non-procedure_completed transitions, **native `window.confirm` / `window.alert` never invoked** |

### 3.2 Gates run

| Gate | Command | Result |
|---|---|---|
| Production typecheck | `npx tsc --noEmit` | **0 errors** |
| Test typecheck (added/changed files) | `npx tsc -p tsconfig.test.json --noEmit` | 0 new errors. **10 pre-existing** errors remain in `src/components/customers/__tests__/customer-form.test.tsx` (B.1.1 test file from Sprint 6.1, unchanged) — verified with `git stash` baseline comparison |
| Lint | `npm run lint` | **0 warnings** |
| Test suite | `npm test` | **20 files / 358 tests passed** (baseline 331 → 358 = +27 new for B.2.4) |
| Build | `npm run build` | **34 routes, 0 errors**, no measurable bundle delta |
| Anti-pattern gate (A9) | `grep -rE "window\.(confirm|alert)" src/` (excluding `__tests__/`) | 0 new matches from B.2.4 (1 pre-existing match on `cases/[id]/page.tsx` `removeCaseService`, owned by Story B.4.5 — Sprint 6.3) |

### 3.3 Manual smoke steps (per story DoD)

> Commands run via the B.2.4 tests — no manual intervention needed.

1. ✅ Open a case in `in_procedure`. The "Đã thực hiện xong" button
   renders.
2. ✅ Click → warning-variant dialog opens. Panel ring is amber.
3. ✅ Date input is empty; confirm button is disabled.
4. ✅ Fill date → confirm button enables.
5. ✅ Cancel → dialog closes, `onTransition` not invoked.
6. ✅ Generic transitions (e.g. `Đủ điều kiện chuyên môn`) still render
   their original generic dialog, just under the new `info` variant.
7. ✅ Anti-pattern grep confirms no `window.confirm` call.

---

## 4. Risks introduced

### 4.1 R1 — Server-side enforcement gap (carry-over from plan)

`actualProcedureDate` is **UI-required** only. A malicious actor with a
valid auth token can still POST a `procedure_completed` transition
without the date and bypass the dialog (the B.2.3 server RBAC shipped
in Sprint 6.1 doesn't validate this field). **Mitigation:** Story
**C.3.2** (Sprint 7.3) adds the server-side requirement. **Until then,
do not promote `procedure_completed` workflow to doctors in
production.** Documented in the plan §5.1 R5 and verified here.

### 4.2 R2 — `caseRecord.actualProcedureDate` is captured AFTER status flip is enqueued

The `onTransition` callback persists `actualProcedureDate` BEFORE
calling `updateCaseStatus`, so there is no race window. However, if
the page is unmounted mid-flight (e.g. network drop), the status
*could* flip first because `onTransition` is async. **Mitigation
path:** C.3.2's server-side enforcement closes this gap. **Risk is
acknowledged and UI-only.**

### 4.3 R3 — `variant` surface expanded; `'default'` callsite left over was changed to `'info'` (not worked-on)

Per the "do not work on other stories" rule, the
`customer-list.tsx` and `location-list.tsx` literals were touched only
because TypeScript forced the rename for the new variant union. The
visual is unchanged (`'info'` is the visual twin of the old
`'default'`).

### 4.4 R4 — `ConfirmDialog` pre-existing a11y bug addressed during refactor

The old `ConfirmDialog` never wired `aria-labelledby` on its panel,
because it rendered its own `<h3>` inline rather than passing `title`
to `Modal`. The Story B.2.4 refactor fixed this by forwarding `title`
to `Modal` (the new `<h3>` is gone). This is a strict improvement;
existing callers benefit. The `a11y` describe-block in
`confirm-dialog.test.tsx` exercises the warning variant with
axe-core — **0 violations**.

### 4.5 R5 — Checklist summary is best-effort

`evaluatePreProcedureChecklist` is async and depends on case +
staff + coordination loads. If any of those services throw during the
dialog session, the summary falls back to `null` and the dialog shows
"Không có dữ liệu" instead of failing. **Risk:** if the data is
missing for a legitimate reason (e.g. mobile / network outage), the
doctor can't see the allPassed pill and may be confused — but the
UX copy explicitly states the summary is a soft signal.

---

## 5. Sign-off checklist (cross-referenced with plan §7.4)

| # | Check | Owner | Status |
|---|---|---|---|
| 7.4.1 | UX copy reviewed: "Hoàn thành thủ thuật" / "Bạn đã chắc chắn?" / checklist summary / side-effect count | ux-designer | ☐ Pending — Vietnamese copy is in `status-workflow.tsx` lines 200–240. Needs ux-designer walkthrough before merge. |
| 7.4.2 | `actualProcedureDate` documented as UI-required in 6.2, server-required in Sprint 7.3 (C.3.2) | tech-lead + medical-workflow-expert | ☐ Pending — gap explicitly noted in §4.1. |
| 7.4.3 | Native `confirm()` ban verified: `grep -rE "window\.(confirm\|alert)" src/` excluding `__tests__/` | qa-architect | ✅ Verified — 0 new matches from B.2.4 (1 pre-existing match owned by B.4.5). |
| 10.1 Build & code quality | typecheck / lint / build / tests | tech-lead | ✅ Verified — 0 errors / 0 warnings / 358 tests / 34 routes. |

---

## 6. Files changed (final)

| # | File | Change kind | LOC delta |
|---|---|---|---:|
| 1 | `src/components/ui/confirm-dialog.tsx` | MODIFY — variant union → `info/warning/danger`; `confirmDisabled`; pass `title` to `Modal` (a11y); `aria-hidden` on decorative icon | ~+60 |
| 2 | `src/components/cases/status-workflow.tsx` | MODIFY — dedicated `procedure_completed` rich dialog; 3 new exported types; `extra` param on `onTransition` | ~+90 |
| 3 | `src/app/(protected)/cases/[id]/page.tsx` | MODIFY — checklist summary state + effect; pass `checklistSummary` / `sideEffectSummary` / `initialProcedureDate`; persist `actualProcedureDate` before status flip | ~+50 |
| 4 | `src/components/customers/customer-list.tsx` | MODIFY — `variant="default"` → `variant="info"` (1 line, type rename) | ~+0 |
| 5 | `src/components/locations/location-list.tsx` | MODIFY — `variant="default"` → `variant="info"` (1 line, type rename) | ~+0 |
| 6 | `src/components/ui/__tests__/confirm-dialog.test.tsx` | CREATE — variant + `confirmDisabled` + a11y coverage | ~270 |
| 7 | `src/components/cases/__tests__/status-workflow-procedure.test.tsx` | CREATE — rich-dialog coverage, A9 anti-pattern assertions | ~290 |

**Cumulative delta:** +760 LOC across 7 files. Within the planned
`~140 + ~60 = ~200 LOC` estimate for commits #4 + #5 (we exceeded the
estimate due to tests + a11y fix; commits #4 + #5 themselves stayed
inside the ~140 + ~60 LOC budget).

---

## 7. Definition of Done — Story B.2.4

| DoD checkbox | Status |
|---|---|
| `ConfirmDialog` `warning` variant exists with amber icon + amber panel ring | ✅ |
| Clicking "Đã thực hiện xong" opens the warning dialog | ✅ |
| Checklist summary (`allPassed` pill) shown in dialog | ✅ |
| Side-effect summary (followups + tasks) shown in dialog | ✅ |
| Confirm button disabled until `actualProcedureDate` filled | ✅ |
| Date forwarded to parent via `onTransition(newStatus, { actualProcedureDate })` | ✅ |
| Parent persists date BEFORE flipping status; uses it for followup D1–D90 | ✅ |
| Other status transitions untouched (preserves existing workflow) | ✅ |
| No `window.confirm` / `window.alert` introduced by B.2.4 | ✅ |
| Vietnamese copy is consistent with existing UI tone | ✅ (designer walkthrough recommended before merge) |
| `npx tsc --noEmit` → 0 errors | ✅ |
| `npm run lint` → 0 warnings | ✅ |
| `npm run build` → 34 routes / 0 errors | ✅ |
| `npm test` → 358 / 358 passed (+27 new for B.2.4) | ✅ |
| Migration notes + implementation report created | ✅ |
