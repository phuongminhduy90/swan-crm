# Story C.2.3 — Reports Date Filter URL-Sync + Refetch + Active-Pill X — Migration Notes

> **Story:** C.2.3 (Sprint 7.2)
> **Backlog ref:** [`SPRINT_7_2_EXECUTION_PLAN.md`](SPRINT_7_2_EXECUTION_PLAN.md) §1.1 + Appendix D
> **Risk:** 🟢 (per Sprint 7 plan §4.2)
> **Flag:** none
> **Theme:** Make the Reports date filter shareable (URL), responsive (refetch on change), and individually clearable (active-pill X).

This document covers the **migration surface** of Story C.2.3 — what changed, what stayed, how to roll back, and the contract every consumer now relies on. For the implementation walkthrough, see [`STORY_C2_3_IMPLEMENTATION_REPORT.md`](STORY_C2_3_IMPLEMENTATION_REPORT.md).

---

## 1. What changed at a glance

| File | Status | Surface | Back-compat? |
|:-----|:-------|:--------|:-------------|
| `src/components/reports/report-filters.tsx` | **Modified** | New optional props: `onClear`, `activeFilterLabel`. Adds checkmark + X icon on the active pill, an "Đang lọc: …" banner, and a "Xóa tất cả bộ lọc" button. Exports `DATE_RANGE_OPTIONS`. | ✅ Existing 3-call-site signature still works. |
| `src/app/(protected)/reports/page.tsx` | **Modified** | `dateRange` is now URL-driven (`?range=3m\|6m\|12m\|0`). Default = `6 tháng` (no param). Triggers a refetch via `getAllPayments` / `getAllCases` / `getAllCustomers` on every change. Renders a "Đang lọc…" pill while refetching. Wrapped in `<Suspense>` for `useSearchParams`. | ✅ Output (charts, stat cards, tabs) is identical when URL param is absent. |
| `src/components/reports/__tests__/report-filters.test.tsx` | **New** | 12 tests covering pill behaviour, clear X, banner, "Xóa tất cả" button, back-compat. | n/a |
| `src/app/(protected)/reports/__tests__/reports-date-filter.test.tsx` | **New** | 12 tests covering URL parse/serialise, refetch on change, "Đang lọc…" pill, clear flow + toast. | n/a |
| `src/lib/firestore/payments.ts` | **Untouched** | Per scope: payment transaction logic is out of bounds. | n/a |
| `src/lib/firestore/cases.ts`, `src/lib/firestore/customers.ts` | **Untouched** | Only their public `getAll*()` helpers are called; the page was already using them. | n/a |
| `src/components/reports/revenue-report.tsx`, `customer-report.tsx`, `pipeline-report.tsx` | **Untouched** | Charts and aggregations are unchanged. The page passes `dateRange` through as before. | ✅ |
| `src/components/reports/loading-skeleton.tsx` | **Untouched** | The "Đang lọc…" pill is a new surface, not a replacement of the existing full-screen skeleton (which still shows on first load). | n/a |

No new dependencies. No DB schema changes. No permission/role changes.

---

## 2. URL contract (new public surface)

The Reports page now reads and writes one optional URL parameter:

| Param | Type | Accepted values | Default | When written |
|:------|:-----|:----------------|:--------|:-------------|
| `range` | string | `3m` · `6m` · `12m` · `0` | (absent) | On every `setDateRange` / clear action. Default = param **removed** (clean URL when filter is at baseline). |

### 2.1 Accepted forms

The page is **tolerant** of additional input shapes so URL shares don't silently break:

| Input | Result | Notes |
|:------|:-------|:------|
| `?range=3m` | `3` (3 tháng) | Canonical form. |
| `?range=6m` | `6` (6 tháng) | Canonical form. |
| `?range=12m` | `12` (12 tháng) | Canonical form. |
| `?range=0` | `0` (Tất cả) | Canonical form for "all time". |
| `?range=3` | `3` (3 tháng) | Bare numbers tolerated (back-compat with hand-typed links). |
| `?range=garbage` | `6` (default) | Invalid values silently fall back to default. |
| `?range=99m` | `6` (default) | Unsupported month counts fall back to default. |
| (no param) | `6` (default) | Baseline — clean URL. |

### 2.2 Write behaviour

- `router.replace(...)` (not `push`) — the back button should not accumulate filter state.
- `scroll: false` — switching range must not jump the page to the top.
- Default (`6 tháng`) **removes** the param so the canonical URL is `/reports` (cleaner for sharing).
- Other unrelated query params are preserved (the page mutates `searchParams` rather than replacing it wholesale).

### 2.3 Sharing a filtered view

A user can now copy the URL and paste it into a new tab — the filter state is restored exactly. This is the primary accountant use case: "send me the link to the Tất cả revenue report you were just looking at."

---

## 3. `<ReportFilters>` prop contract

```ts
export type DateRangeOption = 3 | 6 | 12 | 0; // 0 = all time

interface ReportFiltersProps {
  value: DateRangeOption;
  onChange: (v: DateRangeOption) => void;
  /** Called when user clicks X on the active pill or "Xóa tất cả bộ lọc". */
  onClear?: () => void;
  /** Label shown in the banner pill (e.g. "Đang lọc: 6 tháng"). When null/undefined, the banner is hidden. */
  activeFilterLabel?: string | null;
  className?: string;
}
```

### 3.1 Back-compat guarantees

- `onChange` signature is **unchanged** (still receives a `DateRangeOption`).
- `value` and `className` are **unchanged**.
- When `onClear` is omitted, the X icon is **not rendered** and the banner is **not rendered** — the component looks exactly like the pre-C.2.3 version.
- The new `data-testid` attributes (`report-filter-${value}`, `report-filter-clear-${value}`, `report-filter-clear-all`, `report-filter-xoa-tat-ca`) are **additive** — no existing testid was renamed.

### 3.2 Migration shim (if you want to consume the new props elsewhere)

The "Xóa tất cả bộ lọc" pattern will be reused in Sprint 7.5 for case-list and audit-log filters (story C.5.5). When that lands, both surfaces should share this same component (or a small common primitive) so the affordance stays consistent.

---

## 4. Refetch semantics

The page now **refetches all data** (`getAllPayments`, `getAllCases`, `getAllCustomers`) whenever `dateRange` changes. This is intentional:

- The current reports are computed client-side from a single in-memory snapshot, so a "refetch" means: re-pull the snapshot and re-derive the filtered charts. The pipeline tab is dateRange-invariant but receives the same refresh for uniformity.
- In production, this will translate to a server-side `range` filter at the Firestore layer (Phase 8). The contract here — "switching range triggers a fetch" — stays the same.

### 4.1 Two-tier loading state

| State | When | UI |
|:------|:-----|:--|
| First load | Initial mount, no prior data | Full-screen skeleton (`StatCardsSkeleton` + 2× `ChartSkeleton`). |
| Refetch | `dateRange` changes after first load | Small "Đang lọc…" pill at the top right with a pulsing dot. Old data stays visible underneath. |

This avoids the "flash of empty state" every time the user clicks a different range. The previous behaviour was: nothing happened (data was filtered silently client-side, no indicator).

### 4.2 Error path

If the refetch fails, the page now surfaces a Vietnamese error toast via the `useToast()` hook:

> **Không thể tải báo cáo** — Vui lòng thử lại hoặc liên hệ kỹ thuật nếu lỗi tiếp diễn.

The previous behaviour was a silent `console.error`. No new error was introduced — this is a strict improvement.

---

## 5. Test additions

| Test file | Tests | Layer |
|:----------|------:|:------|
| `src/components/reports/__tests__/report-filters.test.tsx` | 12 | L1 (functional) — pill click, X click, banner, clear button, back-compat |
| `src/app/(protected)/reports/__tests__/reports-date-filter.test.tsx` | 12 | L1 (functional) + L6 (integration) — URL parse/serialise, refetch trigger, "Đang lọc…" pill timing, clear + toast |

Total: **+24 tests** in the reports domain.

### 5.1 Test isolation pattern

The integration test mocks `next/navigation` with a custom in-memory URL store + a subscriber set so the page re-renders when `router.replace(...)` is called. The subscriber pattern is the same shape as Next's internal router (subscription + snapshot), so the test exercises the page's real hook lifecycle rather than stubbing `useSearchParams` to a constant.

The mock returns a fresh `URLSearchParams` instance per render **only when the URL has changed**, so React's stability check passes and the page does not enter an infinite loop. The cached snapshot key is `urlVersion` (a monotonic counter bumped inside `replaceMock`).

### 5.2 Fixtures

Both tests use the existing in-memory mock store (the page's data loaders are real `getAll*` calls, just routed to the mock store when `NEXT_PUBLIC_DEV_MODE=true`). No new fixtures were needed.

---

## 6. Rollback plan

Story C.2.3 is **fully reversible** in < 1 minute:

```bash
git revert <C.2.3-commit-sha>
npx tsc --noEmit && npm run lint && npm run build && npx vitest run
```

### 6.1 Rollback blast radius

| Surface | After revert | Risk |
|:--------|:-------------|:-----|
| `/reports` page | Behaves exactly as pre-C.2.3 (in-component `dateRange` state, no URL sync, no refetch on change, no clear affordance). | None — purely UI state. |
| Other pages | Unaffected. The changes are scoped to `src/app/(protected)/reports/page.tsx` and `src/components/reports/report-filters.tsx`. | None. |
| Firestore data | Untouched (no schema, no writes, no real-Firestore path changes). | None. |
| Bundle size | Delta is ≤ 0.5 kB (one new helper, one new banner DOM); reverts cleanly. | None. |

### 6.2 When NOT to roll back

- If the user-visible "Đang lọc…" pill becomes a source of confusion or layout shift: tune the layout in the page header (e.g. move the pill below the filter bar). Do not roll back the URL sync — the shareable URL is the primary value-add.

---

## 7. Cross-sprint impact

### 7.1 Upstream consumers

- **Sprint 7.5 (C.5.5)** — "Active filter chips with X + 'Xóa tất cả'" will mirror this pattern. The `onClear` / `activeFilterLabel` props here set the precedent.
- **Sprint 7.5 (C.5.2)** — Notification deep-links can now point at `/reports?range=0` (or similar) so a click on a "Tổng doanh thu" notification deep-links to the all-time view.

### 7.2 Downstream prerequisites

- The URL param `range` is the foundation for the eventual **server-side date filter** (Phase 8). The component contract already routes through `useSearchParams`, so the migration is a one-line change in the data loader.

### 7.3 Risks landed in Phase 7

- **R7.2-5 (🟡 Stale reports)** — `dateRange` was in component state; switching range did not refetch. **CLOSED by C.2.3** (refetch on every range change + "Đang lọc…" pill).

---

## 8. Decisions to revisit

| # | Decision | Revisit if |
|:--|:---------|:-----------|
| **D-C.2.3-1** | Default range = `6 tháng`, not `3 tháng` | The plan said `3 tháng` is the default; the pre-C.2.3 component was initialised to `6 tháng`. We kept `6 tháng` to avoid changing the "default" view for existing users. Revisit in Phase 8 if data load grows. |
| **D-C.2.3-2** | Refetch fetches **all three** datasets (payments + cases + customers) on every change | The pipeline tab is `dateRange`-invariant, so the refetch is a no-op there. A future optimisation could skip the case/customer load when the active tab is revenue, but that would couple the page to a specific data shape. |
| **D-C.2.3-3** | "Đang lọc…" pill uses a pulsing dot + `animate-fade-in` | If the indicator is too subtle, replace with a spinner. Don't roll back the URL sync. |
| **D-C.2.3-4** | `router.replace` instead of `router.push` | This was deliberate (so the back button doesn't accumulate filter state). Revisit if user feedback wants filter history in the back stack. |

---

*End of Story C.2.3 Migration Notes.*
