# Story 6.3.6 / B.4.6 — Migration Notes

**For:** Engineers picking up the codebase after Sprint 6.3
**Scope:** What changed, what's safe, what's fragile

---

## 1. What landed

A new client-side hook + a conditional render in the case list.

| What | Where | Lines (approx) |
|:-----|:------|--------------:|
| `useMediaQuery(query)` hook | `src/lib/hooks/useMediaQuery.ts` | 36 |
| `useIsDesktop()` helper (768 px) | same file | 10 |
| Responsive status filter | `src/components/cases/case-list.tsx` | +~25 (one ternary swap) |
| Responsive status filter tests | `src/components/cases/__tests__/case-list-status-filter-responsive.test.tsx` | 19 tests |

No migrations of any kind: zero schema changes, zero data changes, zero env changes, zero flag additions. The existing `?status=…` URL plumbing is unchanged — it was already bookmarkable before this story and remains so.

## 2. New hook contract

```ts
// src/lib/hooks/useMediaQuery.ts

useMediaQuery(query: string): boolean
useIsDesktop(): boolean   // = useMediaQuery('(min-width: 768px)')
```

### Semantics

- **SSR-safe:** returns `false` until the first client-side `useEffect` runs. This is intentional — it avoids hydration mismatch and means the mobile-friendly UI renders first at every viewport, then upgrades to chips if the viewport is wide enough.
- **Reactive:** subscribes to `matchMedia.change` events; cleans up the listener on unmount.
- **No polling:** uses native `matchMedia` (no `resize` listeners).

### Why a hook and not a CSS-only solution

A pure-CSS approach (e.g. `<div className="hidden md:flex">` for chips + `<div className="md:hidden">` for Select) would render **both** UIs into the DOM, doubling the keyboard tab order and confusing screen readers (each status would appear twice in the form-control list). The hook renders **exactly one** UI at a time, keeping the tab order and ARIA tree clean.

### When to use which export

- **Use `useIsDesktop()`** when you only care about the standard Tailwind `md` breakpoint (most cases). It's a thin convenience wrapper.
- **Use `useMediaQuery(query)`** for non-`md` breakpoints (e.g. `lg`, `sm`) or for compound queries like `(min-width: 768px) and (orientation: landscape)`.

## 3. Touch points

### 3.1 case-list.tsx — single ternary

Before:
```tsx
{/* Status Filter Chips */}
<div className="flex flex-wrap gap-2">
  {STATUS_FILTER_OPTIONS.map((opt) => (
    <button …>
      {opt.label}
      …
    </button>
  ))}
</div>
```

After:
```tsx
{/* Status Filter — B.4.6 responsive */}
{isDesktop ? (
  <div className="flex flex-wrap gap-2" data-testid="status-filter-chips" …>
    {STATUS_FILTER_OPTIONS.map((opt) => (
      <button … aria-pressed={statusFilter === opt.value}>
        {opt.label}
        …
      </button>
    ))}
  </div>
) : (
  <div data-testid="status-filter-select">
    <Select
      value={statusFilter}
      onChange={(e) => updateStatusFilter(e.target.value as StatusFilterValue)}
      aria-label="Lọc theo trạng thái"
      className="min-h-[44px]"
    >
      {STATUS_FILTER_OPTIONS.map((opt) => {
        const count = …;
        return (
          <option key={opt.value} value={opt.value}>
            {opt.label} ({count})
          </option>
        );
      })}
    </Select>
  </div>
)}
```

That's the entire diff for the visible behavior. Everything else in the file is untouched.

### 3.2 The single source of truth

```ts
const updateStatusFilter = useCallback(
  (next: StatusFilterValue) => {
    setStatusFilter(next);
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    const serialized = serializeStatusParam(next);
    if (serialized === null) params.delete('status');
    else params.set('status', serialized);
    const qs = params.toString();
    router.replace(qs ? `/cases?${qs}` : '/cases', { scroll: false });
  },
  [router, searchParams],
);
```

Both chips and the `<Select>` call `updateStatusFilter()`. The URL sync, the `parseStatusParam` re-sync effect, and the filter memo are all unchanged.

## 4. A11y notes

- **Chips** keep their `<button>` semantics and add `aria-pressed={statusFilter === opt.value}` so screen readers announce the active state. The container has `role="group"` and `aria-label="Lọc theo trạng thái"`.
- **Select** reuses the existing `<Select>` primitive (which uses a native `<select>` for full keyboard / mobile-wheel support) and adds `aria-label="Lọc theo trạng thái"`.
- **Touch target:** `min-h-[44px]` on both UIs — chips get `min-h-[44px] sm:min-h-0` (the `sm:min-h-0` removes it at desktop, preserving the existing tight chip look).

## 5. Test additions

`src/components/cases/__tests__/case-list-status-filter-responsive.test.tsx` — 19 tests across 7 layers:

1. **Hook unit (4):** `useMediaQuery` SSR-safe default; reflects `matchMedia=true` on mount; updates on `matchMedia.change`; `useIsDesktop` returns boolean.
2. **Hook source (1):** `useMediaQuery.ts` literally declares `useState(false)`.
3. **Wiring (2):** Imports + call site.
4. **Desktop branch (3):** Chip block is gated by `isDesktop`; preserves options map; chips have `aria-pressed` and touch-target height.
5. **Mobile branch (4):** `<Select>` JSX in else branch; `Select` import; onChange wired to `updateStatusFilter`; Select iterates `STATUS_FILTER_OPTIONS` (12 entries) with count and `opt.value` binding.
6. **Parity (2):** Both UIs call `updateStatusFilter`; URL plumbing unchanged.
7. **Anti-pattern gate (1):** The `<div className="flex flex-wrap gap-2">` chip row never renders on mobile.
8. **Status options parity (2):** 12 entries in `STATUS_FILTER_OPTIONS`.

Pattern follows the B.4.5 / B.4.3 / B.1.4 precedent: static source-level checks for wiring + a small unit test for the new hook.

## 6. Visual regression

Captured against the new responsive layout as part of **C-3** (Mobile visual regression baseline capture) on Day 4. Routes in scope:

- `/cases` × 5 viewports (360 / 390 / 412 / 768 / 1280) × 12 roles = 60 baseline snapshots for this story.

Per C-3 deliverable, the 360 px snapshot must show:
- The `<Select>` dropdown (not chips).
- No horizontal scroll (`scrollWidth === clientWidth`).
- Touch target height ≥ 44 px.

The 768 px snapshot must show:
- The chip row (existing behavior).
- Identical to the pre-6.3.6 baseline.

## 7. Rollback

```bash
# Single-story rollback (5 min):
git revert <b4-6-merge-sha>

# Behavior reverts to: chips render on every viewport. Layout cramps on
# mobile but the list still works.
```

There is **no data migration to reverse** and **no flag to flip** (B.4.6 ships un-flagged by design — additive change).

## 8. Anti-pattern grep gate (must stay green)

```bash
# A9 — native confirm/alert (B.4.5 deliverable)
grep -rE "window\.(confirm|alert)" src/ | grep -v __tests__/
# Expected: 1 documented match (B.2.1 L2 pre-flight, intentional, Sprint 7.x scope)

# A2 — raw user IDs (B.4.3 deliverable)
grep -rE "user-\d{3}" src/components
# Expected: 0 matches

# M5 — horizontal scroll at 360 px (B.4.1 + B.4.6 deliverable)
# Verified via C-3 Playwright snapshot.

# B.4.6-specific: no flex-wrap chip row on mobile
grep -E 'className="flex flex-wrap gap-2"' src/components/cases/case-list.tsx
# Expected: 1 match, but it must be inside an `isDesktop ?` ternary
```

## 9. Performance notes

- `useMediaQuery` is a single `useEffect` per component using `useMediaQuery`. It runs once on mount and updates state only when the viewport crosses the breakpoint. Zero per-frame cost.
- The mobile `<Select>` is rendered only on viewports < 768 px; on desktop the chip branch mounts instead. No conditional rendering of the unused branch.
- No new dependencies (`package.json` delta = 0).
- No bundle bloat (`87.4 kB` shared JS preserved, matches Sprint 6.3 baseline).

## 10. Open follow-ups

None for Sprint 6.3. Possible Sprint 7.x polish:

- **Range filter for expected procedure date** — separate story, separate backlog.
- **Saved filter presets** (e.g. "Ca của tôi trong tuần này") — Sprint 7.x scope.
- **Sticky filter bar** on long case lists — design discussion pending.

---

*End of Story 6.3.6 / B.4.6 Migration Notes.*