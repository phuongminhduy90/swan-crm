# Story B.3.4 — Migration Notes: Refund line + "Đã xác nhận − Hoàn tiền" annotation

> **Story:** B.3.4 (Sprint 6.4, S2 — F-HIGH-33)
> **Date:** 2026-07-01
> **Owner:** FE-3
> **Scope:** `src/components/reports/revenue-trend-chart.tsx`, `src/components/reports/chart-theme.ts`, `src/components/reports/revenue-report.tsx`, `src/components/reports/__tests__/revenue-trend-chart.test.tsx`
> **Plan ref:** [`SPRINT_6_4_EXECUTION_PLAN.md`](SPRINT_6_4_EXECUTION_PLAN.md) §2.2 + Appendix A.2
> **Implementation report:** [`STORY_B3_4_IMPLEMENTATION_REPORT.md`](STORY_B3_4_IMPLEMENTATION_REPORT.md)
> **Prior story:** B.3.3 (Sprint 6.1) — partial implementation; B.3.4 refines the contract.

---

## 1. What is changing

Story B.3.4 hardens the **revenue-trend line chart** on `/reports` (Revenue tab) so the refund series is **always rendered**, the annotation wording is **unified**, the refund tooltip carries the **canonical Vietnamese description**, and the annotation is **responsive on small viewports**.

This is a **presentation-only** change. No payment-status state, no Firestore write, no audit log writer, no permission key, no entity schema field.

### 1.1 B.3.3 → B.3.4 delta

| Concern | B.3.3 (Sprint 6.1) | B.3.4 (Sprint 6.4) |
|:--------|:-------------------|:--------------------|
| Refund `<Line>` rendered? | **Conditional** — only when `data.some(d => (d.refund ?? 0) > 0)` | **Always** — even when no refunds exist; flat at 0 |
| Annotation text when no refund | `"Đã xác nhận = X (chưa có hoàn tiền trong kỳ)"` | `"Đã xác nhận − Hoàn tiền = X (Y − 0)"` — **unified** |
| Tooltip on refund series | Generic Recharts tooltip (`tooltipFormatVND`) | **Custom tooltip** appending `"Tổng hoàn tiền đã xác nhận trong kỳ"` |
| Mobile responsive annotation | Not handled — full text always shown | **Hidden on `<sm`**; condensed mobile variant shown instead |
| Refund series config source | Inline `REFUND_COLOR` constant in chart | **`REFUND_SERIES`** exported from `chart-theme.ts` (reusable) |
| `MonthlyRevenuePoint.refund` | Optional (`refund?: number`) | **Required** (`refund: number`) — type-safety guarantees parents populate it |
| Comment trail | `// B.3.3 (F-HIGH-33)` | `// B.3.4 (F-HIGH-33)` — renumbered to match Sprint 6.4 plan |

### 1.2 Acceptance criteria (Sprint 6.4 §2.2)

| # | Criterion | Status |
|:-:|:----------|:-------|
| 1 | `revenue-trend-chart.tsx` renders two `<Line>` series: confirmed + refund | ✅ — unconditional |
| 2 | Refund line color is red `#EF4444` | ✅ |
| 3 | Annotation reads `"Đã xác nhận − Hoàn tiền"` | ✅ — always when `totalConfirmed > 0` |
| 4 | Tooltip on refund series shows `"Tổng hoàn tiền đã xác nhận trong kỳ"` | ✅ |
| 5 | Existing revenue calculations preserved (no double-counting) | ✅ — confirmed series unchanged |
| 6 | No other stories modified | ✅ — only revenue chart, report wrapper, theme, test |

---

## 2. Files changed (4 total)

### 2.1 Modified (3)

1. **`src/components/reports/revenue-trend-chart.tsx`**
   - Imports `REFUND_SERIES` from `./chart-theme` (replaces inline `REFUND_COLOR`).
   - Drops the `TOOLTIP_STYLE` import + the `tooltipFormatVND` formatter call (replaced by a custom tooltip component).
   - Adds a `RevenueTrendTooltip` component that prefixes the refund series entry with `REFUND_SERIES.description`.
   - Removes the `hasRefund` guard so the refund `<Line>` is always rendered.
   - Changes `MonthlyRevenuePoint.refund` from optional (`refund?: number`) to required (`refund: number`).
   - Splits the annotation into two `<p>` elements with Tailwind `hidden sm:block` (desktop) and `block sm:hidden` (mobile).
   - Re-tags B.3.3 comments as B.3.4.

2. **`src/components/reports/chart-theme.ts`**
   - Adds the `REFUND_SERIES` export — `{ color: '#EF4444', label: 'Hoàn tiền', description: 'Tổng hoàn tiền đã xác nhận trong kỳ' }` — alongside the existing `SWAN_COLORS` and `CHART_PALETTE` constants.

3. **`src/components/reports/revenue-report.tsx`**
   - Re-tags B.3.3 comments as B.3.4 in the `monthlyData` builder.
   - **No calculation changes.** The `refund` field is still accumulated only for `paymentType === 'refund' && status === 'confirmed'` (the same predicate as Sprint 5 seed expansion).

### 2.2 Created (0) / Updated (1)

4. **`src/components/reports/__tests__/revenue-trend-chart.test.tsx`** (updated in place)
   - Re-tagged B.3.3 → B.3.4 in the file header and all `describe()` titles.
   - Updated every fixture to include `refund: number` (no longer optional).
   - Removed the assertion that the annotation **does NOT** mention "Hoàn tiền" when no refunds exist (B.3.4 unifies the wording).
   - Added 4 new tests covering:
     - Annotation still renders with `refund: 0` (B.3.4 always-renders contract).
     - Mobile annotation `block sm:hidden` + condensed copy.
     - Desktop annotation `hidden sm:block` viewport gate.
     - `REFUND_SERIES` config exports (regression guard for cross-file contract).
   - Added a regression test for **R-REV-2** (refund not subtracted internally from confirmed) — covered by "does NOT subtract refund internally from confirmed series".

---

## 3. Migration impact for callers

### 3.1 `MonthlyRevenuePoint` interface contract change

```diff
 export interface MonthlyRevenuePoint {
   monthKey: string;
   label: string;
   confirmed: number;
   pending: number;
-  /**
-   * B.3.3 (F-HIGH-33): refund amount for the month. Only present when at
-   * least one month has a refund. ...
-   */
-  refund?: number;
+  /**
+   * B.3.4 (F-HIGH-33): refund amount for the month. Always populated by the
+   * parent `RevenueReport` so the chart can render the refund `<Line>` even
+   * when no refunds exist (the line stays flat at 0 in that case).
+   */
+  refund: number;
 }
```

**Caller impact:**
- `src/components/reports/revenue-report.tsx` — already populates `refund: val.refund` for every month. **No change needed.**
- Tests using `MonthlyRevenuePoint[]` literals must add `refund: 0` to every fixture.

### 3.2 New export — `REFUND_SERIES`

Consumers (e.g. other chart components, status badges) can now read the refund series metadata from a single source of truth:

```ts
import { REFUND_SERIES } from '@/components/reports/chart-theme';
// REFUND_SERIES.color        === '#EF4444'
// REFUND_SERIES.label        === 'Hoàn tiền'
// REFUND_SERIES.description  === 'Tổng hoàn tiền đã xác nhận trong kỳ'
```

### 3.3 Removed import — `tooltipFormatVND`

`revenue-trend-chart.tsx` no longer imports `tooltipFormatVND` from `chart-theme.ts`. The function is still exported and used by other charts (revenue pie chart, etc.) — only this chart switched to a custom tooltip.

---

## 4. Revenue calculations — unchanged

The **risk register R-REV-2** explicitly calls out double-counting of refunds. B.3.4 verifies this is **not** the case:

| Predicate | Source | Behavior |
|:----------|:-------|:---------|
| Confirmed series | `revenue-report.tsx` line 64 | `status === 'confirmed' && paymentType !== 'refund'` |
| Refund series | `revenue-report.tsx` line 70 | `paymentType === 'refund' && status === 'confirmed'` |
| Annotation net | `revenue-trend-chart.tsx` line 97 | `totalNet = totalConfirmed − totalRefund` (display only) |

**Refund is a sibling series, not a delta.** The `confirmed` line is the same number it was in Sprint 5 — adding the refund `<Line>` does not change the visible confirmed series.

The mock seed has 23 payments; 1 is `paymentType === 'refund'` (pay-020, 10M, March). The B.3.4 chart will render:
- Confirmed line as before.
- A red refund `<Line>` with a single non-zero data point in March.

**Test layer 6 (integration) regression:** R-REV-2 mitigation verified in `revenue-trend-chart.test.tsx` → "does NOT subtract refund internally from confirmed series".

---

## 5. Risk register (revenue impact)

| # | Risk | Probability | Impact | Mitigation in B.3.4 |
|:-:|:-----|:-----------|:-------|:--------------------|
| **R-REV-2** | Refund line double-counts — refund also subtracted from `confirmed` series | M | 🟡 | (a) Refund is a sibling series, not a delta. (b) Test: `refund: 10M, confirmed: 100M` → annotation shows `100M − 10M = 90M`; confirmed value displayed stays 100M. ✅ |
| **R-REV-3** | Refund line color clashes with `payment_pending` chip | L | 🟢 | Recharts line color = `#EF4444` (red) — distinct from `SWAN_COLORS.gold` pending line (`#C9A96E`) and `SWAN_COLORS.aqua` confirmed line (`#00ADBE`). Three different colors; no overlap. ✅ |
| **R-REV-4** | Annotation lost at small viewports | L | 🟢 | (a) Desktop annotation uses `hidden sm:block` (≥ 640 px). (b) Mobile annotation uses `block sm:hidden` (< 640 px) with condensed copy. (c) Tooltip on refund line provides full copy on tap. ✅ |
| **R-REV-7** | Custom tooltip's `payload[].color` undefined in jsdom | M | 🟢 | Tooltip guards `entry.color` with a defensive `<span style={{ color: entry.color }}>` — Recharts always provides color in production. jsdom limitation noted in test file header. ✅ |

---

## 6. Rollback plan

### 6.1 Per-file revert (recommended)

```bash
# Revert only B.3.4 commits (chart + theme + report wrapper + test)
git revert <b34-chart-sha> <b34-theme-sha> <b34-report-sha> <b34-test-sha>
```

**Time:** < 5 minutes
**Data impact:** None — no schema, no migrations, no audit log writers touched.

### 6.2 Manual rollback (no git revert)

If only the always-render behavior is unwanted:

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
+ {hasRefund && (
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

Where `hasRefund = data.some(d => (d.refund ?? 0) > 0)`. (This restores the B.3.3 conditional behavior without re-tagging comments.)

### 6.3 Visual-only rollback (annotation only)

Hide the annotation footers while keeping the refund line:

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

**Time:** < 2 minutes
**Risk:** Net revenue math hidden from CEO on report → do this only as a temporary last resort.

---

## 7. Sign-off chain

| Gate | Owner | Status |
|:-----|:------|:-------|
| Tooltip copy exactness (`REFUND_SERIES.description`) | Accountant Lead | ⏳ Pending (Day 4 of Sprint 6.4) |
| Refund series data source (`status === 'confirmed' && paymentType === 'refund'`) | Accountant Lead | ⏳ Pending (Day 4) |
| Refund exclusion (no internal subtraction from confirmed) | Accountant Lead | ⏳ Pending (Day 4) |
| Build / lint / typecheck / tests green | tech-lead | ✅ Verified — see implementation report §3 |
| UX rationale (Vietnamese annotation copy) | ux-designer | ⏳ Pending (Day 4) |

---

## 8. Anti-pattern gate

Per Sprint 6.4 §13 anti-pattern scan:

| Pattern | Expected | Actual |
|:--------|:---------|:-------|
| A2 — raw user IDs in copy | 0 | 0 |
| A4-6.4 — ambiguous revenue aggregate | tooltip + annotation together | ✅ |
| A4-6.4 — refund series without annotation | annotation present | ✅ |
| A8 — dead links | 0 | 0 |
| A9 — native confirm/alert | 0 | 0 (unchanged) |

---

## 9. Notes for the next agent

- **`MonthlyRevenuePoint.refund` is now required.** Any future chart that constructs this shape from raw data must populate `refund` (default 0 if unknown) or the TypeScript compiler will fail.
- **The custom tooltip component (`RevenueTrendTooltip`) is local to `revenue-trend-chart.tsx`.** It is intentionally not exported — other charts continue to use `tooltipFormatVND` / `tooltipFormatCount` from `chart-theme.ts`. If a future chart needs the same Vietnamese description on hover, extract `RevenueTrendTooltip` to `chart-theme.ts` and add a `descriptionByDataKey` parameter.
- **The mobile annotation duplicates the desktop text.** This is intentional — Tailwind `sm:` is the breakpoint at 640 px (per the Tailwind default). If the design direction changes (e.g. to `md:`), both annotations need to move together.
- **`REFUND_SERIES` is currently only used by `revenue-trend-chart.tsx`.** If a second consumer appears (e.g. status badge, pipeline card), consider adding a JSDoc block above the export clarifying its scope.
- **Recharts tooltip `formatter` is no longer needed on this chart.** Recharts v3 loosens `formatter` typing (returns `[string, string]`); we bypass it entirely with a custom `content` component. Other charts still use the `formatter` callback.

---

*End of Story B.3.4 Migration Notes.*