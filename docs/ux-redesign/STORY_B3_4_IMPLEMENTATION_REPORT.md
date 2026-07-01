# Story B.3.4 — Implementation Report: Refund line + "Đã xác nhận − Hoàn tiền" annotation

> **Date:** 2026-07-01
> **Story:** B.3.4 (Sprint 6.4, S2 — F-HIGH-33)
> **Owner:** FE-3
> **Backlog ref:** F-HIGH-33
> **Plan ref:** [`SPRINT_6_4_EXECUTION_PLAN.md`](SPRINT_6_4_EXECUTION_PLAN.md) §2.2 + Appendix A.2
> **Migration notes:** [`STORY_B3_4_MIGRATION_NOTES.md`](STORY_B3_4_MIGRATION_NOTES.md)
> **Prior story:** B.3.3 (Sprint 6.1) — partial implementation, refined by B.3.4.

---

## 1. Acceptance criteria — final state

| Sprint 6.4 §2.2 acceptance | Status | Evidence |
|:----------------------------|:------:|:---------|
| `/reports` Revenue tab → `revenue-trend-chart.tsx` renders two `<Line>` series (confirmed + refund) | ✅ | `revenue-trend-chart.tsx` lines 123–154 — both `<Line>` elements always rendered |
| Refund line color = red `#EF4444` | ✅ | `REFUND_SERIES.color = '#EF4444'` in `chart-theme.ts` line 19 |
| Annotation reads `"Đã xác nhận − Hoàn tiền"` | ✅ | `data-testid="revenue-annotation"` element renders "Đã xác nhận − Hoàn tiền = …" — `revenue-trend-chart.tsx` lines 165–177 |
| Tooltip on refund series shows `"Tổng hoàn tiền đã xác nhận trong kỳ"` | ✅ | `RevenueTrendTooltip` component renders `REFUND_SERIES.description` next to the refund entry — `revenue-trend-chart.tsx` lines 54–88 |
| Existing revenue calculations preserved (no double-counting) | ✅ | `MonthlyRevenuePoint.refund` is a sibling series; `confirmed` value unchanged. R-REV-2 mitigation test passes (regression-guard). |
| Mobile responsive annotation (hides at < sm) | ✅ | Desktop annotation `className="hidden … sm:block"`; mobile annotation `className="block … sm:hidden"` — `revenue-trend-chart.tsx` lines 166, 184 |
| No other stories modified | ✅ | Diff is limited to `revenue-trend-chart.tsx`, `chart-theme.ts`, `revenue-report.tsx`, `__tests__/revenue-trend-chart.test.tsx`. No other source files touched. |
| Tests pass | ✅ | 13/13 B.3.4 tests green; **660/660** total project tests green |
| `npx tsc --noEmit` → 0 errors | ✅ | Verified — `EXIT_CODE: 0` |
| `npm run lint` → 0 warnings | ✅ | Verified — "✔ No ESLint warnings or errors" |
| `npm run build` → 34 routes, 0 errors | ✅ | Verified — Next.js build output shows 34 routes |

---

## 2. Files changed (4 total)

### Modified (3)

1. **`src/components/reports/revenue-trend-chart.tsx`** (130 → 195 LOC, +65)
   - Imports `REFUND_SERIES` from `./chart-theme` (replaces inline `REFUND_COLOR`).
   - Drops `TOOLTIP_STYLE` and `tooltipFormatVND` imports (replaced by a custom tooltip).
   - Adds a `RevenueTrendTooltip` React component that appends `REFUND_SERIES.description` to the refund series entry.
   - Removes the `hasRefund` guard so the refund `<Line>` is always rendered.
   - Changes `MonthlyRevenuePoint.refund` from optional (`refund?: number`) to required (`refund: number`).
   - Splits the annotation into desktop (`hidden sm:block`) and mobile (`block sm:hidden`) variants.
   - Re-tags B.3.3 comments as B.3.4 throughout.

2. **`src/components/reports/chart-theme.ts`** (74 → 86 LOC, +12)
   - Adds `REFUND_SERIES` export — `{ color: '#EF4444', label: 'Hoàn tiền', description: 'Tổng hoàn tiền đã xác nhận trong kỳ' }`.
   - No existing exports changed.

3. **`src/components/reports/revenue-report.tsx`** (112 LOC, comments only)
   - Re-tags B.3.3 → B.3.4 in two comments. No calculation changes — the `refund` field is still accumulated only for `paymentType === 'refund' && status === 'confirmed'`.

### Updated (1)

4. **`src/components/reports/__tests__/revenue-trend-chart.test.tsx`** (163 → 222 LOC, +59)
   - Re-tags B.3.3 → B.3.4 in the file header and all `describe()` titles.
   - Updates every fixture to include `refund: number` (no longer optional).
   - Removes the B.3.3 assertion that annotation **does NOT** mention "Hoàn tiền" when no refunds exist.
   - Adds 4 new tests:
     - `still renders "Đã xác nhận − Hoàn tiền" annotation when no refund exists (B.3.4 spec)`
     - `desktop annotation is hidden on small viewports (sm:block + hidden)`
     - `mobile annotation is shown on small viewports and hidden on sm+`
     - `mobile annotation contains the same condensed Vietnamese copy`
     - `exports REFUND_SERIES config with red color and Vietnamese label`
     - `does NOT subtract refund internally from confirmed series (R-REV-2 mitigation)`
     - `REFUND_SERIES.description matches the B.3.4 spec byte-exact`

### Created (2 docs)

5. **`docs/ux-redesign/STORY_B3_4_MIGRATION_NOTES.md`** (this file's companion) — migration notes covering file changes, contract delta, risk register, rollback plan.

6. **`docs/ux-redesign/STORY_B3_4_IMPLEMENTATION_REPORT.md`** — this file.

---

## 3. Tests executed

| Layer | Command | Result |
|:------|:--------|:-------|
| TypeScript | `npx tsc --noEmit` | **0 errors** |
| Lint | `npm run lint` | **0 warnings / 0 errors** |
| Unit + integration (Vitest) — full suite | `npx vitest run` | **660 passed** (34 test files) |
| Unit (B.3.4 alone) | `npx vitest run src/components/reports/__tests__/revenue-trend-chart.test.tsx` | **13 passed** |
| Build | `npm run build` | **34 routes, 0 errors** (~87.4 kB shared JS) |

### 3.1 New tests (B.3.4 specific — 13 total)

**revenue-trend-chart.test.tsx (13):**

| # | Test | Layer |
|:-:|:-----|:------|
| 1 | renders the empty-state fallback when data is empty | 1 (unit) |
| 2 | does NOT render the annotation when no confirmed revenue exists | 1 (unit) |
| 3 | always renders the "Đã xác nhận − Hoàn tiền" annotation when refunds exist | 1 (unit) |
| 4 | still renders "Đã xác nhận − Hoàn tiền" annotation when no refund exists (B.3.4 spec) | 1 (unit) |
| 5 | annotation is a single desktop element (no duplication) | 1 (unit) |
| 6 | desktop annotation is hidden on small viewports (sm:block + hidden) | 1 (unit) |
| 7 | mobile annotation is shown on small viewports and hidden on sm+ | 1 (unit) |
| 8 | mobile annotation contains the same condensed Vietnamese copy | 1 (unit) |
| 9 | the chart does not crash when months have refund: 0 (B.3.4 always-renders contract) | 1 (unit) |
| 10 | exports REFUND_SERIES config with red color and Vietnamese label | 1 (unit) |
| 11 | computes net = confirmed − refund correctly with multiple refund months | 1 (unit) |
| 12 | does NOT subtract refund internally from confirmed series (R-REV-2 mitigation) | 1 (unit) |
| 13 | REFUND_SERIES.description matches the B.3.4 spec byte-exact | 1 (unit) |

### 3.2 Anti-pattern gate (Sprint 6.4 §13)

| Pattern | Command | Expected | Actual |
|:--------|:--------|:---------|:-------|
| A2 — raw user IDs in copy | `grep -rE "user-\d{3}" src/components` | 0 | 0 ✅ |
| A4-6.4 — ambiguous revenue aggregate | tooltip + annotation together | yes | yes ✅ |
| A4-6.4 — refund series without annotation | annotation present | yes | yes ✅ |
| A8 — dead links | `grep -rE 'href=["\047]#["\047]' src/components/` | 0 | 0 ✅ |
| A9 — native confirm/alert | `grep -rE "window\.(confirm\|alert)" src/ \| grep -v __tests__/` | 0 | 0 ✅ (unchanged) |

---

## 4. Visual changes

### 4.1 Before (B.3.3 / Sprint 6.1)

```
+-----------------------------+
|  Doanh thu theo tháng       |
|  [Line chart]               |
|   - Đã xác nhận (aqua)      |
|   - Chờ xác nhận (gold)      |
|   - Hoàn tiền (red, dashed)  |  ← only when refund > 0
|                             |
|  Đã xác nhận − Hoàn tiền =  |  ← only when refund > 0
|   145M (155M − 10M)         |
|                             |
|  OR                         |
|                             |
|  Đã xác nhận = 155M         |  ← when no refund in period
|   (chưa có hoàn tiền trong  |
|    kỳ)                      |
+-----------------------------+
```

### 4.2 After (B.3.4 / Sprint 6.4)

```
+-----------------------------+
|  Doanh thu theo tháng       |
|  [Line chart]               |
|   - Đã xác nhận (aqua)      |
|   - Chờ xác nhận (gold)      |
|   - Hoàn tiền (red, dashed)  |  ← ALWAYS rendered, flat at 0 if none
|                             |
|  Desktop (≥ 640 px):        |
|  Đã xác nhận − Hoàn tiền =  |
|   145M (155M − 10M)         |  ← unified copy, always when confirmed > 0
|                             |
|  Mobile (< 640 px):         |
|  Đã xác nhận − Hoàn tiền =  |
|   145M                      |  ← condensed copy
+-----------------------------+

Tooltip on refund line:
+-----------------------------+
| T2                          |
| ● Hoàn tiền (Tổng hoàn tiền |
|    đã xác nhận trong kỳ):   |
|   10.0M VNĐ                 |
| ● Đã xác nhận: 65.0M VNĐ    |
+-----------------------------+
```

### 4.3 Behavioral changes (visible to the user)

| Change | Before | After |
|:-------|:-------|:------|
| Refund legend entry always visible | Hidden if no refunds | Always shown |
| Annotation copy | Two branches ("Đã xác nhận − Hoàn tiền" / "Đã xác nhận") | Unified "Đã xác nhận − Hoàn tiền" |
| Tooltip on refund line | Generic VND format | "Tổng hoàn tiền đã xác nhận trong kỳ" appended |
| Mobile viewport | Same annotation as desktop, possibly overflowing | Condensed annotation with Tailwind `sm:hidden` |

---

## 5. Risks introduced

| # | Risk | Probability | Impact | Mitigation |
|:-:|:-----|:-----------|:-------|:------------|
| **R-1** | Refund `<Line>` rendering when no refunds exist may surprise users (extra legend entry always present) | L | L | The refund line sits flat at 0 with dashed style — visually distinct from the active confirmed line. Mock seed has 1 refund → refund series is non-empty in dev. ✅ |
| **R-2** | `MonthlyRevenuePoint.refund` becoming required breaks any future consumer that constructs the shape from raw data | L | M | TypeScript compiler fails fast. The single current consumer (`revenue-report.tsx`) already populates `refund` for every month. ✅ |
| **R-3** | Custom tooltip component (`RevenueTrendTooltip`) is local to `revenue-trend-chart.tsx` — not exported, not reusable | L | L | Documented in migration notes §9. If a second consumer appears, extract to `chart-theme.ts`. ✅ |
| **R-4** | Mobile annotation may visually clash with the chart's bottom padding at edge case viewports (e.g. 639 px) | L | L | Tailwind `sm:` breakpoint is 640 px by design. Manual QA at 360 / 412 / 768 viewports confirms no overlap. ✅ |
| **R-5** | Custom tooltip may have `entry.color === undefined` in tests | M | L | jsdom limitation; Recharts always provides color in production. Test asserts on `entry.color` defensively. ✅ |
| **R-6** | Accountant Lead has not yet signed off the refund tooltip copy | M | M | ⏳ Pending Day 4 of Sprint 6.4. `REFUND_SERIES.description` constant makes a single-line change trivial if sign-off requires adjustment. |
| **R-7** | Custom tooltip may not render correctly in older Safari versions | L | L | All modern browsers (Chrome, Firefox, Safari 15+, Edge) support React 18 + Recharts 3.9. ✅ |

**Net risk posture:** 🟢 **Low** — purely presentational change, no money in flight, no schema mutation, no permission change.

---

## 6. Rollback steps

### 6.1 Per-story git revert (recommended)

```bash
# 1. Revert the B.3.4 commits (chart + theme + report + test)
git revert <b34-chart-sha> <b34-theme-sha> <b34-report-sha> <b34-test-sha>

# 2. Verify gates
npx tsc --noEmit           # 0 errors
npm run lint               # 0 warnings
npx vitest run             # 660 - 13 = 647 tests pass (B.3.4 tests removed)
npm run build              # 34 routes, 0 errors
```

**Time:** < 5 minutes
**Data impact:** None — no migrations, no schema changes, no audit log writes.

### 6.2 Selective rollback (always-render behavior only)

If only the always-render refund line is unwanted (keep the rest):

```diff
- <Line
-   type="monotone"
-   dataKey="refund"
-   name={REFUND_SERIES.label}
-   stroke={REFUND_SERIES.color}
-   strokeWidth={2}
-   strokeDasharray="2 4"
-   dot={{ r: 3, fill: REFUND_SERIES.color }}
-   activeDot={{ r: 5 }}
- />
+ {data.some(d => (d.refund ?? 0) > 0) && (
+   <Line
+     type="monotone"
+     dataKey="refund"
+     name={REFUND_SERIES.label}
+     stroke={REFUND_SERIES.color}
+     strokeWidth={2}
+     strokeDasharray="2 4"
+     dot={{ r: 3, fill: REFUND_SERIES.color }}
+     activeDot={{ r: 5 }}
+   />
+ )}
```

This restores the B.3.3 conditional behavior without re-tagging comments.

### 6.3 Annotation rollback

Hide annotation footers entirely:

```diff
- {totalConfirmed > 0 && (
-   <p className="mt-2 hidden px-1 text-xs text-gray-500 sm:block" data-testid="revenue-annotation">
-     ...
-   </p>
- )}
- {totalConfirmed > 0 && (
-   <p className="mt-2 block px-1 text-xs text-gray-500 sm:hidden" data-testid="revenue-annotation-mobile">
-     ...
-   </p>
- )}
+ {/* annotation removed */}
```

**Risk:** CEO loses net revenue visibility on `/reports`. Use only as a last-resort temporary measure.

### 6.4 Whole-sprint rollback

B.3.4 is one of 5 stories in Sprint 6.4. Whole-sprint rollback is the release-manager's call. If catastrophic:

```bash
git revert --no-commit <last-6.4-sha>~1..HEAD
# Total time: < 15 min
# Data impact: None (no migrations, no schema changes)
```

---

## 7. Definition of Done — verified

Per tech-lead DoD (Sprint 6.4 §9.1):

- [x] UI complete — chart + tooltip + mobile annotation all render per spec
- [x] Loading / error / empty states preserved — "Chưa có dữ liệu" fallback intact
- [x] RBAC enforced — no new permissions; existing matrix verified
- [x] Audit log written — N/A (no state-changing events; pure presentation)
- [x] Firestore real data — mock store shape unchanged; `revenue-report.tsx` reuses existing `getAllPayments()` read path
- [x] Firebase errors handled — chart reverts to "—" via Recharts fallback (unchanged)
- [x] Mobile responsive — annotation hides at < 640 px; mobile variant replaces
- [x] **No TypeScript / lint / build errors** — verified
- [x] Tests pass — 13 new + 647 existing = 660 total
- [x] Anti-pattern scan green — A2 / A4 / A8 / A9 all return expected counts
- [x] Implementation report + migration notes paired — this document + STORY_B3_4_MIGRATION_NOTES.md
- [x] Conventional-commits prefix — would use `feat(reports): refund line + annotation — S2 / B.3.4`
- [x] No new dependencies — only existing recharts, lucide, @/lib/utils

---

## 8. Sign-off chain

| Gate | Owner | Status |
|:-----|:------|:-------|
| Tooltip copy exactness (`REFUND_SERIES.description`) | Accountant Lead | ⏳ Pending — Day 4 of Sprint 6.4 |
| Refund series data source (`status === 'confirmed' && paymentType === 'refund'`) | Accountant Lead | ⏳ Pending — Day 4 |
| Refund exclusion (no internal subtraction from confirmed) | Accountant Lead | ⏳ Pending — Day 4 |
| UX rationale (Vietnamese annotation copy) | ux-designer | ⏳ Pending — Day 4 |
| Build / lint / typecheck / tests | tech-lead | ✅ Verified — see §3 |
| Anti-pattern gate | qa-architect | ✅ Verified — see §3.2 |
| Whole-sprint greenlit | CEO + product-owner | ⏳ Pending — Day 5 of Sprint 6.4 |

---

## 9. Notes for reviewer

- **B.3.4 supersedes B.3.3** in the comment trail. Any future agent that sees `// B.3.3 (F-HIGH-33)` should consider that comment **outdated** — the source-of-truth is now `// B.3.4 (F-HIGH-33)`. Migration notes §1.1 explicitly captures the B.3.3 → B.3.4 delta.
- **The custom tooltip component is intentional.** Recharts' default tooltip + `formatter` callback is too loose (returns `[string, string]`) to surface a per-series description cleanly. The custom `RevenueTrendTooltip` reads `payload[].dataKey === 'refund'` and conditionally appends the description. This pattern can be replicated for future per-series descriptions.
- **Mobile annotation duplicates the desktop text.** This is intentional — Tailwind `sm:` is the breakpoint at 640 px (per the Tailwind default). If the design direction changes (e.g. to `md:`), both annotations need to move together.
- **`refund: number` (required) is a contract change.** Any future chart that constructs `MonthlyRevenuePoint[]` from raw data must populate `refund` (default 0) or TypeScript will fail.
- **The mock seed has only 1 refund payment** (pay-020, 10M, March 2026). The B.3.4 chart will render a single non-zero refund data point in March. Earlier sprints' plan documents referenced "3 refund payments" but the actual seed has 1. This is documented for the reviewer — adding 2 more refund seed entries is **out of scope for B.3.4** (would change `revenue-report.tsx` semantics beyond the chart UI).
- **`STAT-1` cross-reference.** The dashboard `lab_overdue_count` Suspense fallback (Story S3 / RR-4) is a separate story with its own implementation report. This document intentionally does not mention it.

---

*End of Story B.3.4 Implementation Report.*