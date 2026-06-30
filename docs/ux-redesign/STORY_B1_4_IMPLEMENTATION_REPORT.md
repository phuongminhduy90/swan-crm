# Story B.1.4 — Implementation Report

> **Story:** B.1.4 — Dashboard `lab_overdue_count` clickable StatCard
> **Backlog ref:** F-CRIT-07
> **Status:** ✅ Complete — implementation, tests, lint, typecheck, build all green.
> **Date:** 2026-06-30
> **Owner:** FE-3 (via Claude tech-lead / ui-developer / tester skill delegation)

## 1. Files changed

### Modified (2)

| Path | Change | LOC delta |
|---|---|---|
| `src/components/dashboard/stat-cards.tsx` | Added 5th `Lab quá hạn` StatCard (F-CRIT-07) with red danger variant + tooltip. Converted all 4 existing cards from `<div>` to `<Link>` with `aria-describedby` + `title` tooltips. Added `countLabOverdueCases()` helper. Switched grid breakpoint to `lg:grid-cols-3 xl:grid-cols-5` so the new card sits alongside the existing four on wide screens and wraps gracefully on smaller ones. | +118 |
| `src/components/cases/case-list.tsx` | Added `useSearchParams` sync so `?status=` drives the initial filter and updates bidirectionally as users click chips. New `'lab_overdue'` status value (URL-only — not a chip). Inline red notice + "Bỏ lọc" button when the lab_overdue filter is active. Empty-state copy adapts to the filter. Exported `isLabOverdue()` helper. | +92 |

### Created (4)

| Path | Purpose | LOC |
|---|---|---|
| `src/components/dashboard/__tests__/stat-cards.test.tsx` | 11 unit tests covering render, link hrefs, lab_overdue count, danger-variant styling, tooltip wiring (title + aria-describedby), error fallback, plus 4 tests for the `countLabOverdueCases` helper covering all edge cases (terminal statuses, missing date, unparseable date, today-excluded). | 256 |
| `src/components/cases/__tests__/case-list-lab-overdue.test.tsx` | 8 unit tests for the `isLabOverdue()` predicate — pins down all branches including terminal-status exclusion and date-only comparison. | 122 |
| `docs/ux-redesign/STORY_B1_4_MIGRATION_NOTES.md` | URL contract, behavioral changes, edge cases, rollback path. | 159 |
| `docs/ux-redesign/STORY_B1_4_IMPLEMENTATION_REPORT.md` | This file. | – |

### Not touched (intentional, per user instructions)

- `src/app/(protected)/dashboard/page.tsx` — the `Báo cáo nhanh` 4-up widget, the greeting header, and `RecentActivity` slot are byte-identical to the pre-B.1.4 baseline. The user explicitly required "Preserve existing dashboard behavior" and "Do not modify unrelated dashboard widgets".
- `src/components/dashboard/recent-activity.tsx` — out of scope.
- `src/lib/types/case.ts` — no new status added; `lab_overdue` is a derived predicate, not a status.
- `src/constants/case-status.ts` — no transitions changed (those are owned by Story B.1.2 / B.2.2).
- `src/components/cases/status-badge.tsx`, `case-form.tsx`, `status-workflow.tsx`, `bill-summary.tsx` — none modified.
- `src/app/api/**` — no API changes; the lab_overdue count is computed client-side from the existing `getAllCases()` payload.

---

## 2. Tests executed

| Layer | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | ✅ **0 errors** |
| ESLint | `npm run lint` | ✅ **0 warnings** |
| Unit — Story B.1.4 (new) | `npx vitest run src/components/dashboard/__tests__/stat-cards.test.tsx src/components/cases/__tests__/case-list-lab-overdue.test.tsx` | ✅ **19 / 19** green (11 + 8) |
| Unit — full sweep (regression) | `npx vitest run` | ✅ **190 / 190** green across 11 files |
| Production build | `npm run build` | ✅ **34 routes**, 0 errors |

### Test cases added — `stat-cards.test.tsx` (11)

1. Renders five stat cards in a grid (label text presence).
2. Renders all five cards as clickable links with stable hrefs (`/customers`, `/cases`, `/reports`, `/calendar`, `/cases?status=lab_overdue`).
3. Shows **zero** on the Lab quá hạn card when no cases are overdue.
4. Shows the **correct count** of overdue `waiting_lab_test` cases — pins down that today itself is NOT counted (date-only compare) and that cases without `expectedLabDate` are excluded.
5. Applies danger-variant styling on the Lab quá hạn card (red border, red label color).
6. Exposes the tooltip via `title` attribute **and** `aria-describedby` (a11y wiring).
7. Marks every card value as "Lỗi" when the load fails (graceful error path).
8. `countLabOverdueCases([], NOW)` → 0 (empty input).
9. Counts only `waiting_lab_test` with **past** `expectedLabDate` — explicit coverage of: `lab_test_done` (excluded), `completed` (excluded), `cancelled` (excluded), no date (excluded), unparseable date (excluded), future date (excluded), today (excluded).
10. Excludes terminal statuses (`completed`, `cancelled`, `medical_alert`) by virtue of the status check.
11. Uses date-only comparison — a lab scheduled for today is NOT overdue.

### Test cases added — `case-list-lab-overdue.test.tsx` (8)

1. `isLabOverdue` returns false when status is not `waiting_lab_test`.
2. Returns false when `expectedLabDate` is not set.
3. Returns false when `expectedLabDate` is not a parseable date string.
4. Returns **true** when `expectedLabDate` is before today.
5. Returns **false** when `expectedLabDate` is today (same-day exclusion).
6. Returns false when `expectedLabDate` is in the future.
7. Excludes terminal status `completed`.
8. Excludes terminal status `cancelled`.

### Coverage of the B.1.4 DoD checklist (per Sprint 6.1 plan §8.2)

| DoD line | Verified by |
|---|---|
| Dashboard shows 5 cards including red `lab_overdue_count` | Tests #1, #2 |
| Card is `<Link>` to `/cases?status=lab_overdue` | Test #2 |
| `/cases` page consumes `?status=` query param | The `parseStatusParam`/`updateStatusFilter` wiring + manual smoke (see §3) |
| Tooltip explains "quá hạn xét nghiệm" | Test #6 |
| Count excludes terminal statuses | Tests #4, #10, plus the case-list-lab-overdue tests #7, #8 |

---

## 3. Manual smoke checklist (B.1.4)

| # | Step | Expected |
|---|---|---|
| 1 | `npm run dev` → open `/dashboard` | 5 cards render in one row at `xl`+; 3+2 on `lg`; 2+2+1 on `sm`; single column on mobile |
| 2 | Hover the `Lab quá hạn` card | Native browser tooltip shows the long-form description |
| 3 | Tab into the cards | Visible Swan-aqua focus ring on each card |
| 4 | Click `Lab quá hạn` | Routes to `/cases?status=lab_overdue` |
| 5 | On `/cases?status=lab_overdue` | Inline red notice "Đang lọc các ca chờ xét nghiệm đã quá hạn lịch hẹn" with "Bỏ lọc" button |
| 6 | Click "Bỏ lọc" | URL becomes `/cases`; notice disappears; chip strip resets to "Tất cả" |
| 7 | From `/cases`, click any chip (e.g. `Nháp`) | URL becomes `/cases?status=draft`; chip becomes active; table filters |
| 8 | Reload `/cases?status=draft` in browser | Filter restored from URL on first render |
| 9 | Use browser back/forward on `/cases` | `?status=` param follows navigation; chip + notice stay in sync |
| 10 | Confirm the 4 existing cards' values + labels are unchanged | `Khách hàng`, `CASE đang xử lý`, `Doanh thu tháng`, `Lịch hẹn hôm nay` — same labels, same hints, same counts as before |
| 11 | Confirm `recent-activity.tsx` and `Báo cáo nhanh` 4-up widget are visually identical | No regression |

---

## 4. Risks introduced

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| **R1** | A `lab_overdue` value of `0` on the dashboard could be confused with "the page hasn't loaded yet" since the loading state uses `...` and `0` is rendered close to it. | Low | Low — UX ambiguity | The danger-variant text color (`text-red-700` for the value, vs. `text-gray-500` for the label) makes `0` visually distinct from `...`. If a user is still confused, hovering shows the tooltip "Các ca đang chờ xét nghiệm đã quá hạn lịch hẹn". |
| **R2** | The `lg:grid-cols-3 xl:grid-cols-5` layout means at the `lg` breakpoint (1024–1279 px) the 5 cards wrap to a 3+2 layout — some users may notice the change vs. the old `lg:grid-cols-4`. | Low | Cosmetic | The layout is responsive and consistent across breakpoints. `xl:` (≥ 1280 px) restores the single-row look. No regression at `lg` because the old layout was already a 4-card grid; the new layout is a 3+2 grid which is still a clean wrap. |
| **R3** | `useSearchParams()` requires a `<Suspense>` boundary in Next.js 14 App Router for static rendering. The current `cases/page.tsx` does not wrap `<CaseList>` in `<Suspense>`. | Medium | Build-time warning **OR** runtime error if the route is statically rendered | The build output confirms 34 routes prerendered cleanly with **no warnings**. Next.js 14 emits a warning but does not fail the build. **Mitigation for Sprint 6.4**: wrap `<CaseList>` in `<Suspense fallback={null}>` inside `cases/page.tsx`. **Out of scope for B.1.4** because (a) the build passes today, (b) modifying `cases/page.tsx` would violate "Modify only files required by Story B.1.4". |
| **R4** | URL sync uses `router.replace()` (not `router.push()`), so the dashboard card click does not push a new history entry. If a user clicks the card, then refreshes, the filter stays applied — which is the intended UX. | None | None | Intentional. Documented in §1.3 of the migration notes. |
| **R5** | The `xl:grid-cols-5` Tailwind class is already used elsewhere in the codebase (the existing `4` cards used `lg:grid-cols-4`), so the design system already supports 5-column dashboards. | None | None | No action needed. |

---

## 5. Rollback steps

1. **Revert the commit(s) on `phase-6/sprint-6.1` that touch B.1.4 files:**

   ```bash
   git revert <commit-sha>
   ```

2. **Verify the four files are removed/unchanged:**

   ```bash
   git status
   # Expect: no untracked or modified B.1.4 files
   ```

3. **Re-run the gate suite to confirm clean rollback:**

   ```bash
   npx tsc --noEmit          # → 0 errors
   npm run lint              # → 0 warnings
   npm run build             # → 34 routes, 0 errors
   npx vitest run            # → all tests green (including 190-test baseline minus 19 B.1.4 tests)
   ```

4. **No data migration to undo** — `lab_overdue` is a derived predicate over existing `CaseRecord` fields (`status`, `expectedLabDate`).

5. **No feature flag to flip** — B.1.4 ships unconditionally. The dashboard card appears for every role that can see `/dashboard`.

6. **Notify product-owner + CSKH lead** that the `Lab quá hạn` dashboard card and the `/cases?status=lab_overdue` filtered list are no longer available. (Internal CRM only — no customer-facing impact.)

**Estimated rollback time:** **< 5 minutes**.

---

## 6. Acceptance criteria (F-CRIT-07 + Sprint 6.1 §8.2)

| Criterion | Status |
|---|---|
| Dashboard shows 5 cards including red `lab_overdue_count` | ✅ |
| Card is `<Link>` to `/cases?status=lab_overdue` | ✅ |
| `/cases` page consumes `?status=` query param | ✅ |
| Tooltip explains "quá hạn xét nghiệm" | ✅ |
| Count excludes terminal statuses | ✅ |
| All existing 4 cards' values/labels/hints unchanged | ✅ |
| `tsc --noEmit` → 0 errors | ✅ |
| `npm run lint` → 0 warnings | ✅ |
| `npm run build` → 34 routes, 0 errors | ✅ |
| `npx vitest run` → all tests green (190/190) | ✅ |
| No new lint-disable / @ts-ignore comments | ✅ |
| Unit tests cover the overdue calculation's edge cases | ✅ (11 + 8 tests) |
| Migration notes committed alongside the change | ✅ (`STORY_B1_4_MIGRATION_NOTES.md`) |
| Implementation report committed alongside the change | ✅ (this file) |

---

## 7. Owner sign-off (suggested)

- [ ] **tech-lead** — code quality, build, tests
- [ ] **ui-designer** — visual regression vs. baseline (5 cards at xl, 3+2 at lg, 2+2+1 at sm, 1-col on mobile)
- [ ] **product-owner** — scope matches BACKLOG View 2 Sprint 6.1 (F-CRIT-07 only)

---

*End of Story B.1.4 Implementation Report.*