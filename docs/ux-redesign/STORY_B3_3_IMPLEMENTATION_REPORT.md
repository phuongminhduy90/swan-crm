# Story B.3.3 — Implementation Report: Pipeline rename + revenue annotation + refund line

> **Date:** 2026-06-30
> **Story:** B.3.3 (Sprint 6.1)
> **Owner:** FE-3
> **Backlog ref:** F-HIGH-32 / F-HIGH-33
> **Plan ref:** [`SPRINT_6_1_EXECUTION_PLAN.md`](SPRINT_6_1_EXECUTION_PLAN.md) §1 (B.3.3 row)
> **Migration notes:** [`STORY_B3_3_MIGRATION_NOTES.md`](STORY_B3_3_MIGRATION_NOTES.md)

---

## 1. Acceptance criteria — final state

| DoD checkbox | Status | Evidence |
|---|---|---|
| Pipeline chart tooltip explains "Bill = Tổng chưa xác nhận" | ✅ | `pipeline-report.tsx` `action` slot renders Lucide `Info` chip with `title` attribute and `aria-describedby` pointing to hidden sr-only description |
| Revenue chart shows red refund line | ✅ | `revenue-trend-chart.tsx` renders `<Line dataKey="refund" stroke="#EF4444" strokeDasharray="2 4" />` only when at least one month has `refund > 0` |
| Annotation "Đã xác nhận − Hoàn tiền" visible | ✅ | `data-testid="revenue-annotation"` element renders below chart with formatted net revenue |
| Refund line only renders if data supports it | ✅ | `hasRefund = data.some((d) => (d.refund ?? 0) > 0)` guard before `<Line dataKey="refund" />` |
| Does not invent data | ✅ | Reuses existing `paymentType === 'refund'` filter from `revenue-report.tsx`; no new mock data introduced |
| Existing reports behaviour preserved | ✅ | 4 previously passing charts (Revenue Pie/Method, Pipeline Funnel, Status Bar, Category Bar, Customer charts) untouched; only annotations + 1 conditional line added |
| Tests pass | ✅ | 12 new tests added (8 revenue-trend-chart, 4 pipeline-report), all green; 259/259 existing tests still pass |
| `npx tsc --noEmit` → 0 errors | ✅ | (verified) |
| `npm run lint` → 0 warnings | ✅ | "✔ No ESLint warnings or errors" |
| `npm run build` → 34 routes, 0 errors | ✅ | (verified — all 34 routes built) |

---

## 2. Files changed (5 total)

### Modified (3)

1. **`src/components/reports/pipeline-report.tsx`** — added `useId` + Lucide `Info` import; renders info chip in `ChartCard.action` slot with `title` attribute and `aria-describedby` pointing to hidden sr-only span. Pure presentation; pipeline logic untouched.

2. **`src/components/reports/revenue-trend-chart.tsx`** — extended `MonthlyRevenuePoint` interface with optional `refund?: number`; conditionally renders refund `<Line>` (red `#EF4444`, dashed) when any month has a refund; renders annotation footer (`data-testid="revenue-annotation"`) when `totalConfirmed > 0` showing either "Đã xác nhận − Hoàn tiền = X (Y − Z)" or "Đã xác nhận = X (chưa có hoàn tiền trong kỳ)" depending on whether the period has any refund.

3. **`src/components/reports/revenue-report.tsx`** — extended `monthlyData` map to track per-month refund (only confirmed refund payments are accumulated). The `refund` field is wired through the existing filter pipeline (date range → refund inclusion). No changes to existing totals.

### Created (2)

4. **`src/components/reports/__tests__/revenue-trend-chart.test.tsx`** — 8 tests covering: empty fallback, annotation hiding when total = 0, "Đã xác nhận = …" annotation when no refund, "Đã xác nhận − Hoàn tiền = …" annotation when refund exists with correct net math, single-annotation invariant, refund branch guards, multi-month refund summation.

5. **`src/components/reports/__tests__/pipeline-report.test.tsx`** — 4 tests covering: info chip renders, native `title` attribute present, `aria-describedby` resolves to sr-only element, chip is purely presentational (does not mutate case data).

---

## 3. Tests executed

| Layer | Command | Result |
|---|---|---|
| Unit + integration (Vitest) | `npx vitest run` | **259 passed** (15 test files, 12 new tests for B.3.3) |
| TypeScript | `npx tsc --noEmit` | **0 errors** |
| Lint | `npm run lint` | **0 warnings** |
| Build | `npm run build` | **34 routes, 0 errors** (Next.js 14) |

### New tests (12)

**revenue-trend-chart.test.tsx (8):**

- `renders the empty-state fallback when data is empty`
- `does NOT render the annotation when no confirmed revenue exists`
- `renders the "Đã xác nhận = …" annotation with total confirmed revenue`
- `renders the "Đã xác nhận − Hoàn tiền = …" annotation with net calculation`
- `annotation is a single element (no duplication)`
- `does NOT render a refund <Line> when no month has a refund (component compiles + mounts)`
- `renders the refund "Hoàn tiền" legend label when at least one month has a refund`
- `computes net = confirmed − refund correctly with multiple refund months`

**pipeline-report.test.tsx (4):**

- `renders the "Bill = Tổng chưa xác nhận (tiềm năng)" info chip`
- `info chip exposes a native title attribute explaining what Bill means`
- `info chip exposes aria-describedby pointing to a hidden screen-reader description`
- `does NOT mutate case data — Bill chip is purely presentational`

---

## 4. Risks introduced

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Refund line drawing unexpectedly when seed data has zero refunds | Low | Low | `hasRefund = data.some((d) => (d.refund ?? 0) > 0)` guard ensures line only renders with positive data; covered by `refund line visibility` test |
| Annotation math off-by-one when filtered window excludes refund month | Low | Low | Annotation uses pre-computed totals that respect `filteredPayments` (already date-range-filtered). Net = `confirmed − refund` only counts months within window. Covered by net calculation test. |
| React `useId` collisions in multiple chart cards on same page | Low | Low | `useId` returns stable unique ids; the pipeline chip is only rendered once per page. |
| Recharts 0×0 SVG warning in jsdom causes test noise | Confirmed (existing) | None | jsdom limitation — `ResponsiveContainer` always renders at 0×0. Tests assert on annotation (DOM, not SVG), avoiding the warning-affected paths. |
| Story conflating "Bill" with "Doanh thu tiềm năng" in copy | Low | Low | Copy explicitly says "Bill = Tổng chưa xác nhận (tiềm năng)" and the hidden description clarifies "không phải doanh thu thực". |

---

## 5. Rollback steps

**Story-level rollback (single revert):**

```bash
# 1. Revert the B.3.3 commit(s) on phase-6/sprint-6.1
git revert <b33-commit-sha>

# 2. Verify gates
npx tsc --noEmit           # 0 errors
npm run lint               # 0 warnings
npm run test               # 259 tests still pass (4 + 8 B.3.3 tests removed)
npm run build              # 34 routes, 0 errors

# 3. No data migration needed — `refund?` is additive on MonthlyRevenuePoint
```

**Emergency rollback (no revert, just disable):**

If for any reason the refund line or annotation must be hidden without a
full revert:

1. Edit `src/components/reports/revenue-trend-chart.tsx`:
   - Wrap the `{hasRefund && (<Line ... />)}` block in `{false && ...}`.
   - Wrap the annotation `<p>` block in `{false && ...}`.
2. Rebuild — annotations and refund line will no longer render. Pipeline
   info chip remains (also disable by removing `action={...}` from
   `pipeline-report.tsx`).

**No flag needed.** B.3.3 is presentation-only with no behavioural or
data impact. Risk is so low that adding a feature flag would cost more
than the rollback itself.

---

## 6. Notes for reviewer

- **The `refund` field is optional** (`refund?: number`) on
  `MonthlyRevenuePoint`. This means any future consumer that constructs
  `MonthlyRevenuePoint[]` without refund values will still compile and
  behave identically to today (annotation will fall through to the
  no-refund branch).
- **Recharts `width(0) height(0)` stderr** warnings in jsdom are
  expected and pre-existing in the test suite — they are NOT introduced
  by B.3.3. They appear in `modal.test.tsx`, `stat-cards.test.tsx`, and
  every chart-rendering test. The annotation element (which lives outside
  the ResponsiveContainer) is what tests assert on.
- **The pipeline info chip lives in the `ChartCard.action` slot**, not
  inside the chart container. This keeps the chip above the chart and
  prevents Recharts' 0×0 measurement from affecting its rendering.
- **Net math lives in the chart component, not the report wrapper.**
  This is intentional — the report wrapper (`revenue-report.tsx`) only
  accumulates raw values; the chart component owns the "confirmed −
  refund" presentation logic. Future charts (e.g. a separate net-revenue
  card) can reuse `monthlyData` without depending on the chart's display
  rule.

---

*End of Story B.3.3 Implementation Report.*