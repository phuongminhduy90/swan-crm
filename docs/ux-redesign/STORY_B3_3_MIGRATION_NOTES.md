# Story B.3.3 — Migration Notes: Pipeline rename + revenue annotation + refund line

> **Date:** 2026-06-30
> **Story:** B.3.3 (Sprint 6.1)
> **Owner:** FE-3
> **Backlog ref:** F-HIGH-32 / F-HIGH-33
> **Plan ref:** [`SPRINT_6_1_EXECUTION_PLAN.md`](SPRINT_6_1_EXECUTION_PLAN.md) §1 (B.3.3 row)

## Summary

Story B.3.3 ships **clarifications, not changes**, to the reports page:

1. **Pipeline chart label clarification (F-HIGH-32).** Adds an info chip
   next to the "Pipeline chuyển đổi ca" title that clarifies "Bill = Tổng
   chưa xác nhận (tiềm năng)" — i.e. potential revenue, not actual revenue.
   Implemented via a Lucide `Info` badge with both a native `title` attribute
   and an `aria-describedby` pointer to a hidden screen-reader description.

2. **Revenue trend annotation (F-HIGH-33).** Adds a footer line beneath the
   "Doanh thu theo tháng" chart that reads
   `Đã xác nhận − Hoàn tiền = X (Y − Z)` whenever the period has any
   confirmed revenue. When no refund exists yet in the period, the footer
   reads `Đã xác nhận = X (chưa có hoàn tiền trong kỳ)`.

3. **Refund line (F-HIGH-33).** Adds a dashed red line (`#EF4444`) for the
   refund series in the revenue trend chart, **only when at least one
   month has a refund amount > 0**. Reuses the existing
   `paymentType === 'refund'` accounting (no new metric invented).

## Data impact

**None.** B.3.3 is purely presentational — no schema, permission, or
behaviour change. The pipeline counts and refund math both reuse the
same logic that already existed in `revenue-report.tsx` and
`pipeline-report.tsx` for `totalBillAfterDiscount` /
`paymentType === 'refund'`.

The only seed-data dependency is that the existing payment mock store
already contains one confirmed refund record (`pay-020`,
`amount: 10_000_000`, `month(3)`). This is what makes the refund line
appear in the default "6 tháng" range in dev mode. With no refund in the
seed, the line would simply not render — the implementation explicitly
guards against this.

## Backward compatibility

| Surface | Before | After | Backward-compatible? |
|---|---|---|---|
| `MonthlyRevenuePoint` interface | `{ monthKey, label, confirmed, pending }` | `{ monthKey, label, confirmed, pending, refund? }` | ✅ `refund` is optional |
| `RevenueTrendChart` props | unchanged | unchanged | ✅ same props |
| `PipelineReport` props | unchanged | unchanged | ✅ same props |
| Refund line | n/a | renders only when `data[i].refund > 0` | ✅ opt-in |
| Pipeline title | unchanged | unchanged | ✅ same title |
| Annotation footer | n/a | renders only when `totalConfirmed > 0` | ✅ opt-in |

No consumer of `RevenueTrendChart` or `PipelineReport` is updated outside
of this story — the change is contained to the report tab itself.

## Files changed

| File | Change | Lines |
|---|---|---|
| `src/components/reports/pipeline-report.tsx` | Modified — add `useId`, Lucide `Info` import, info chip in `ChartCard.action`, hidden sr-only description | ~+25 |
| `src/components/reports/revenue-trend-chart.tsx` | Modified — add `refund?: number` to `MonthlyRevenuePoint`, conditional refund `<Line>` (#EF4444 dashed), annotation footer (`data-testid="revenue-annotation"`) | ~+60 |
| `src/components/reports/revenue-report.tsx` | Modified — extend `monthlyData` map to track per-month refund (only confirmed refund payments) | ~+8 |
| `src/components/reports/__tests__/revenue-trend-chart.test.tsx` | **Created** — 8 tests for annotation + refund line (F-HIGH-32/33) | +172 |
| `src/components/reports/__tests__/pipeline-report.test.tsx` | **Created** — 4 tests for Bill info chip (F-HIGH-32) | +98 |

## Anti-pattern guard

| Anti-pattern | B.3.3 status |
|---|---|
| A1 (silent fallback defaults) | ✅ No `'general'` or `'unknown'` defaults. Refund line falls back to "not rendered" — explicit. |
| A8 (dead links) | ✅ No links added. |
| A13 (permissive transitions) | ✅ N/A — no status transitions touched. |
| A22 (modal for 22-field form on mobile) | ✅ N/A — no modal introduced. |

## Manual smoke verification

After merge, the following should hold in dev mode:

1. Open `/reports` → Doanh thu tab → look at "Doanh thu theo tháng".
   - **Confirmed** line (aqua) and **Chờ xác nhận** line (gold dashed)
     render as before.
   - A red dashed **Hoàn tiền** line appears for the month where
     `pay-020` lives (approximately 3 months ago in the seed).
   - A footer line reads
     `Đã xác nhận − Hoàn tiền = 145.0M VNĐ (155.0M VNĐ − 10.0M VNĐ)`
     (with the seed's default date range of 6 months).
2. Switch to Luồng CASE tab → look at "Pipeline chuyển đổi ca".
   - A small info chip reads "Bill = Tổng chưa xác nhận (tiềm năng)" with
     a Lucide `Info` icon.
   - Hovering the chip shows a native tooltip explaining the term.
   - Inspecting the element exposes an `aria-describedby` pointing to a
     hidden sr-only span with the full clarification.
3. Set the date range filter to "3 tháng" — if the refund month falls
   outside the window, the refund line should disappear and the footer
   should switch to the no-refund variant
   (`Đã xác nhận = … (chưa có hoàn tiền trong kỳ)`).

## Risk

**🟢 Low.** B.3.3 is presentation-only. The only failure mode is a
regression in the existing confirmed/pending lines, which is covered by
the existing 259-test suite (no test was removed or skipped). The
refund line and annotation are guarded by `data.length > 0` and
`totalConfirmed > 0` checks so they degrade gracefully if data is
missing.

## Rollback

1. `git revert <commit-sha>` on `phase-6/sprint-6.1` (single revert).
2. Re-run `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run test`
   to confirm no downstream test depends on the new annotation.
3. No data migration needed — `refund` field on `MonthlyRevenuePoint` is
   additive (optional) and has no DB persistence.

*End of Story B.3.3 Migration Notes.*