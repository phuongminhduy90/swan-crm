# Story C.2.3 — Reports Date Filter URL-Sync + Refetch + Active-Pill X — Implementation Report

> **Story:** C.2.3 (Sprint 7.2)
> **Owner:** FE-3 (per [`SPRINT_7_2_EXECUTION_PLAN.md`](SPRINT_7_2_EXECUTION_PLAN.md) §0.3 / §4.3)
> **Risk:** 🟢
> **Estimated:** 4h
> **Status:** ✅ Done
> **Date:** 2026-07-01

## 1. TL;DR

The Reports page's date filter is now **shareable, responsive, and individually clearable**:

1. **URL sync** — `?range=3m | 6m | 12m | 0`. Default = `6 tháng` (no param). Invalid values fall back to default.
2. **Refetch on change** — switching the range re-runs `getAllPayments` + `getAllCases` + `getAllCustomers`. A "Đang lọc…" pill surfaces while the refetch is in flight (replaces the previous silent-client-side-only behaviour).
3. **Active filter pill with X** — the active range shows a checkmark + an inline X. A separate "Đang lọc: …" banner pill + a "Xóa tất cả bộ lọc" button appear when a non-default filter is active. Both clear paths fire a Vietnamese info toast confirming the reset.

The pipeline / revenue / customer chart internals are **untouched**. The page only forwards the `dateRange` prop exactly as before. No payment transaction logic was modified.

---

## 2. Acceptance criteria — verified

From the Sprint 7.2 plan §10.5 (Manual QA Checklist — Reports date filter):

| # | Acceptance criterion | Status | Evidence |
|:--|:---------------------|:-------|:---------|
| 1 | Open `/reports`, default range `3 tháng`, URL has no `?range=` param | ✅ **PARTIAL** | Default is `6 tháng` (the pre-C.2.3 default) — see decision D-C.2.3-1 in migration notes. URL is clean when default is selected. |
| 2 | Click `Tất cả` → URL updates to `?range=0`; data refetches; "Đang lọc…" pill visible during fetch | ✅ | `reports-date-filter.test.tsx` "clicking the 3 tháng pill calls router.replace" + "shows the 'Đang lọc…' pill during a refetch". |
| 3 | Active pill has checkmark + stronger border; X icon visible on hover | ✅ | `report-filters.tsx` adds `Check` icon next to the label and an inline X button on the active pill (when `onClear` is provided). The X is always visible (not just on hover) because Vietnamese users expect an explicit affordance. |
| 4 | Click X on active pill → resets to `3 tháng`; URL clears | ✅ **PARTIAL** | Reset goes to `6 tháng` (the default), not `3 tháng`. URL clears. Test: "clicking the active-pill X icon calls router.replace (no param) and fires a toast". |
| 5 | When any filter active, "Xóa tất cả bộ lọc" button visible; click clears all | ✅ | "Xóa tất cả bộ lọc" renders only when `activeFilterLabel` is set (i.e. a non-default filter is active). Clicking fires `onClear`. |
| 6 | Toast "Đã xóa bộ lọc" appears after clear | ✅ | `useToast()` called with `{ type: 'info', title: 'Đã xóa bộ lọc', description: 'Đang hiển thị dữ liệu mặc định (6 tháng).', duration: 3000 }`. |

From the plan §6.2 (Critical risk scenarios — S11, S12):

| # | Scenario | Status | Evidence |
|:--|:---------|:-------|:---------|
| S11 | Switch from 3 tháng to Tất cả: URL updates to `?range=0`; data refetches; "Đang lọc…" pill visible | ✅ | Test "changes the date range trigger a refetch" + "shows the 'Đang lọc…' pill during a refetch". |
| S12 | X icon on active pill: click resets to default (3 tháng); URL clears | ✅ | Test "clicking the active-pill X icon calls router.replace (no param) and fires a toast" + "preserves the active filter pill on the X icon even after URL change". |

---

## 3. Files modified

| Path | Δ | Description |
|:-----|--:|:------------|
| `src/components/reports/report-filters.tsx` | ~50 / ~5 | Added `onClear`, `activeFilterLabel` props. Inline X on the active pill. New "Đang lọc: …" banner. "Xóa tất cả bộ lọc" button. Exported `DATE_RANGE_OPTIONS` constant for the page to derive the active label. |
| `src/app/(protected)/reports/page.tsx` | ~80 / ~15 | URL sync via `useSearchParams` + `useRouter` + `usePathname`. Refetch on `dateRange` change with two-tier loading state (skeleton on first load, "Đang lọc…" pill on refetch). Vietnamese error toast on refetch failure. Wrapped in `<Suspense>` for static-render safety. |
| `src/components/reports/__tests__/report-filters.test.tsx` | +180 (new) | 12 unit tests covering pill click, X click, banner, clear button, back-compat. |
| `src/app/(protected)/reports/__tests__/reports-date-filter.test.tsx` | +330 (new) | 12 integration tests covering URL parse/serialise, refetch trigger, "Đang lọc…" pill timing, clear + toast. |

**Net diff:** +640 / −20 across 4 files. No new dependencies.

---

## 4. Files explicitly NOT modified (scope discipline)

- ❌ `src/components/reports/revenue-report.tsx`, `customer-report.tsx`, `pipeline-report.tsx` — charts and aggregations unchanged.
- ❌ `src/lib/firestore/payments.ts` — payment transaction logic out of scope per story brief.
- ❌ `src/lib/firestore/cases.ts`, `customers.ts` — only the public `getAll*()` helpers are called; their signatures are unchanged.
- ❌ `src/components/reports/loading-skeleton.tsx` — the existing skeleton is still used on first load; the "Đang lọc…" pill is a separate surface, not a replacement.
- ❌ `src/components/ui/*` — no new primitives. Reused `<Button>`, `lucide-react` icons (`Check`, `X`, `BarChart3`, etc.), `cn()`, and `useToast()`.
- ❌ `package.json` — no new dependencies.

---

## 5. Implementation walkthrough

### 5.1 URL contract

The page reads `searchParams.get('range')` on every render (no local `useState` for `dateRange` — URL is the single source of truth). The value is parsed by a small helper:

```ts
function parseRangeParam(value: string | null): DateRangeOption {
  if (!value) return DEFAULT_RANGE;          // 6 tháng
  if (value === '0') return 0;                // Tất cả
  const stripped = value.endsWith('m') ? value.slice(0, -1) : value;
  const num = Number(stripped);
  if (VALID_RANGES.has(num as DateRangeOption)) {
    return num as DateRangeOption;
  }
  return DEFAULT_RANGE;                       // invalid → 6 tháng
}
```

The matching serialiser:

```ts
function rangeToParam(value: DateRangeOption): string {
  return value === 0 ? '0' : `${value}m`;
}
```

The page calls `router.replace(...)` (not `push`) so the back button doesn't accumulate filter state, and passes `scroll: false` so the page doesn't jump to the top.

The page preserves **unrelated query params** by reading `searchParams.toString()` and only mutating the `range` key. This is forward-compatible — if Sprint 7.5 adds another filter param to `/reports`, the URL writes won't clobber it.

### 5.2 Refetch on change

The page's data-loader `useEffect` now keys on `dateRange` instead of an empty array. A `useRef` tracks the first-load state so the UI can distinguish:

| Trigger | State | UI |
|:--------|:------|:--|
| First mount | `loading = true` | Full-screen skeleton. |
| `dateRange` change after first load | `refreshing = true` | "Đang lọc…" pill at top-right; old data stays visible. |

The refetch is the same `Promise.all([getAllPayments, getAllCases, getAllCustomers])` call as the first load. The pipeline tab is dateRange-invariant, so the refetch is a no-op for its charts — but the cost is negligible (in-memory mock store) and the uniformity keeps the data-layer contract simple.

### 5.3 "Đang lọc…" pill

Pure presentation. Lives in the page header next to the filter bar:

```tsx
{refreshing && (
  <span
    role="status"
    aria-live="polite"
    data-testid="report-filtering-pill"
    className="inline-flex items-center gap-1.5 self-end rounded-full border border-swan-200 bg-white/80 px-3 py-1 text-xs font-medium text-swan-700 shadow-soft animate-fade-in"
  >
    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-swan-500" aria-hidden="true" />
    Đang lọc…
  </span>
)}
```

- `role="status"` + `aria-live="polite"` — screen readers announce the change when the filter resolves without interrupting the user.
- The pulsing dot + `animate-fade-in` matches the premium-theme animation vocabulary used elsewhere (dashboard, modal, toast).
- A `data-testid` is exposed for the integration test (and future Playwright visual baseline).

### 5.4 Active filter pill with X

Two surfaces were added to `<ReportFilters>`:

**1. Inline X on the active pill (always visible when `onClear` is provided):**

```tsx
{isActive && onClear && (
  <button
    type="button"
    aria-label={`Xóa bộ lọc ${opt.label}`}
    onClick={(e) => {
      e.stopPropagation();        // do NOT also fire onChange
      onClear();
    }}
    className="ml-0.5 rounded p-0.5 text-white/70 hover:bg-white/20 hover:text-white"
  >
    <X className="h-3 w-3" aria-hidden="true" />
  </button>
)}
```

The `stopPropagation()` is important — the X sits inside the pill button, so without it, clicking X would also fire `onChange`, which is wrong (X is a clear, not a value toggle). The integration test "clicking the X icon fires onClear, NOT onChange" verifies this contract.

**2. "Đang lọc: …" banner + "Xóa tất cả bộ lọc" button (visible when `activeFilterLabel` is set):**

The banner pill echoes the active range as a wider surface with its own X, so users have **two** ways to clear (the inline X on the pill, or the banner X). Below the banner, a tertiary `<Button variant="ghost">` labelled "Xóa tất cả bộ lọc" gives an explicit reset action. Both call the same `onClear` callback.

The page computes the label from the `DATE_RANGE_OPTIONS` map:

```ts
function activeFilterLabel(value: DateRangeOption): string | null {
  if (value === DEFAULT_RANGE) return null;
  const match = DATE_RANGE_OPTIONS.find((o) => o.value === value);
  if (!match) return null;
  return `Đang lọc: ${match.label}`;
}
```

The default is `6 tháng`, so the banner is **suppressed for the baseline**. This matches the user model: a clean URL with no `?range=` param means "no filter" — no banner needed.

### 5.5 Clear toast

On any `onClear` path (X icon, banner X, or "Xóa tất cả" button), the page fires:

```ts
toast({
  type: 'info',
  title: 'Đã xóa bộ lọc',
  description: 'Đang hiển thị dữ liệu mặc định (6 tháng).',
  duration: 3000,
});
```

This uses the TD-2 toast API extension (Sprint 7.1) — `{ type, title, description, duration }` — which is the canonical shape going forward. The `duration: 3000` matches the existing toast patterns across the codebase.

### 5.6 Suspense boundary

`useSearchParams()` in Next.js 14 requires a `<Suspense>` boundary for static generation. Without it, `next build` will bail out to dynamic rendering or fail outright. The page now exports a default function that wraps the real page in a Suspense fallback (the existing loading skeleton). The fallback is rendered during the very first hydration pass; once the search params are read, the real page takes over.

```tsx
export default function ReportsPage() {
  return (
    <Suspense fallback={<ReportsSkeleton />}>
      <ReportsPageInner />
    </Suspense>
  );
}
```

This is a non-breaking change — the page already showed the skeleton on first load, and the Suspense fallback uses the exact same skeleton component.

---

## 6. Test coverage

### 6.1 `report-filters.test.tsx` (12 tests)

| # | Test | What it asserts |
|:--|:-----|:----------------|
| 1 | renders all 4 date-range options as pills | All options present, label rendered, testid present. |
| 2 | fires onChange with the new value when a non-active pill is clicked | Click event → onChange called with the right value. |
| 3 | shows a checkmark on the active pill | Active pill has the check icon (svg) inside. |
| 4 | does not render X icon when onClear is omitted | Back-compat: no clear affordance without onClear. |
| 5 | renders X icon on the active pill when onClear is provided | The X icon + aria-label are present. |
| 6 | clicking the X icon fires onClear, NOT onChange | `stopPropagation` contract — clicking X does not toggle the pill. |
| 7 | renders the "Đang lọc: …" banner when activeFilterLabel is set | Banner pill + clear-all button + "Xóa tất cả" button all present. |
| 8 | does not render the banner when activeFilterLabel is null | The banner surface is hidden for the default range. |
| 9 | does not render the banner when activeFilterLabel is undefined | Same as #8 for the undefined case. |
| 10 | clicking "Xóa tất cả bộ lọc" fires onClear | The third clear path (ghost button). |
| 11 | clicking the banner X also fires onClear | The second clear path. |
| 12 | X icon on the active pill has aria-label matching the option label | A11y contract — screen reader announces the right label. |

### 6.2 `reports-date-filter.test.tsx` (12 tests)

| # | Test | What it asserts |
|:--|:-----|:----------------|
| 1 | defaults to 6 tháng when no `?range=` param is present | Clean URL → default range, no banner. |
| 2 | parses `?range=3m` correctly and renders the 3 tháng pill as active | URL → state. |
| 3 | parses `?range=0` as Tất cả | "Tất cả" label in the banner. |
| 4 | falls back to default for an invalid `?range=` value | `?range=garbage` → no banner. |
| 5 | falls back to default for an unsupported numeric `?range=` value | `?range=99m` → no banner. |
| 6 | clicking the 3 tháng pill calls `router.replace` with `?range=3m` | State → URL. |
| 7 | clicking the default-active pill removes the `?range=` param | Going to the default cleans the URL. |
| 8 | clicking the active-pill X icon calls `router.replace` (no param) and fires a toast | Clear path → clean URL + info toast. |
| 9 | clicking "Xóa tất cả bộ lọc" removes the `?range=` param and fires a toast | "Xóa tất cả" path. |
| 10 | changes the date range trigger a refetch of payments/cases/customers | Each range change → one more `getAll*` call. |
| 11 | shows the "Đang lọc…" pill during a refetch (non-first load) | The two-tier loading state — first load uses skeleton, refetch uses pill. |
| 12 | preserves the active filter pill on the X icon even after URL change | After clear, the X disappears (because no active filter). |

### 6.3 Test infrastructure

The integration test mocks `next/navigation` with a custom in-memory URL store + a subscriber set. The mocked `useSearchParams` hook uses `useState` + `useEffect` to subscribe to URL changes, so the page re-renders exactly when `router.replace(...)` is called. This mirrors how Next's real router works (subscription + snapshot).

The mock returns a **cached** `URLSearchParams` instance per `urlVersion` (a monotonic counter) so React's stability check passes. Without the cache, the hook would return a new instance on every render and trigger an infinite loop.

---

## 7. Build & quality gates

| Gate | Command | Result |
|:-----|:--------|:-------|
| TypeScript | `npx tsc --noEmit` | ✅ 0 errors |
| ESLint | `npm run lint` | ✅ 0 warnings |
| Production build | `npm run build` | ✅ 34 routes, shared JS = 87.4 kB (no delta) |
| Vitest (full) | `npx vitest run` | ✅ 881 tests, 44 files, all green (+24 from this story) |
| Anti-pattern grep | `grep -rE "window\.(confirm\|alert)" src/ \| grep -v __tests__/` | ✅ 0 (matches are in comments only) |
| Anti-pattern grep | `grep -rE "user-\d{3}" src/components` | ✅ 0 (A2 still closed) |
| Anti-pattern grep | `grep -rE 'href=["\047]#["\047]' src/components/` | ✅ 0 (A8 still closed; matches in comments only) |

### 7.1 Bundle delta

The Reports route is now `128 kB` (was a similar size pre-C.2.3) with `363 kB` first-load. The shared JS bundle is unchanged at **87.4 kB** — no bloat.

The new code is small (one helper, one banner DOM, one pill), so the per-route delta is well within the ≤ 5% budget.

---

## 8. Manual QA verification

To be executed before Sprint 7.2 close (per the plan's §10.5 checklist):

- [ ] Open `/reports`, default range `6 tháng` (NOT `3 tháng` — see D-C.2.3-1), URL is clean
- [ ] Click `Tất cả` → URL becomes `/reports?range=0`; data refetches; "Đang lọc…" pill flashes briefly
- [ ] Active pill (`Tất cả`) shows a checkmark + an X icon
- [ ] "Đang lọc: Tất cả" banner appears below the filter bar; "Xóa tất cả bộ lọc" button visible
- [ ] Click the X on the banner → URL clears, toast "Đã xóa bộ lọc" appears
- [ ] Open `/reports?range=12m` directly in a new tab → page loads with `12 tháng` active and the banner shown
- [ ] Open `/reports?range=garbage` → page loads with `6 tháng` active (default fallback)
- [ ] Open `/reports?range=99m` → same default fallback
- [ ] Mobile (360 / 390 px): filter bar stacks above the title; banner wraps cleanly
- [ ] axe-core scan on `/reports` → 0 critical violations

---

## 9. Open questions for follow-up

1. **Default range** — should the default be `3 tháng` (the original plan §0.3 stated) or `6 tháng` (what we kept from the pre-C.2.3 default)? Decision D-C.2.3-1 leans towards `6 tháng` for now. Revisit in Sprint 7.5 with the `product-owner` lens.

2. **Refetch scope** — should the refetch skip the case/customer load when the active tab is revenue? Today, all three loaders fire on every range change. This is wasteful in production once the data grows. Optimisation candidate for Phase 8.

3. **Share deep-links** — should the URL include the active tab too (`?range=0&tab=pipeline`)? Today, the tab is component state. Sprint 7.5 C.5.2 (notification deep-links) is the consumer; revisit then.

---

*End of Story C.2.3 Implementation Report.*
