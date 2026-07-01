# Story B.3.2 / S1 — Migration Notes

> **Story:** B.3.2 (F-HIGH-29) — Revenue tooltip on dashboard StatCard
> **Sprint:** 6.4 — Revenue Integrity
> **Branch scope:** `main` (Phase-6 stack)
> **Migration risk:** 🟢 low — additive copy + new `<Tooltip>` primitive + new test files. No schema change, no payment domain mutation, no permission key change, no Firestore rule change.

---

## 1. What changed

### 1.1 Source files

| Path | Change | LOC Δ |
|:-----|:-------|------:|
| `src/components/ui/tooltip.tsx` | **NEW** — lightweight Tooltip primitive (hover/focus/Escape/click-outside, `role="tooltip"`, ARIA-describedby) | +157 |
| `src/components/dashboard/stat-cards.tsx` | **MOD** — adds `Info` import, `Tooltip` import, `REVENUE_TOOLTIP_COPY` constant, top-right Info button + visible `<Tooltip>` bubble on the revenue card only | +52 / -2 |
| `src/components/dashboard/__tests__/stat-cards-revenue-tooltip.test.tsx` | **NEW** — 19 integration tests for the visible tooltip on the revenue card | +355 |
| `src/components/ui/__tests__/tooltip.test.tsx` | **NEW** — 17 primitive tests for `<Tooltip>` (rendering, hover, focus, Escape, click-outside, placement, align, a11y) | +239 |

**Net source delta:** +209 LOC across 4 files. No new entity types. No new permission keys. No new dependencies.

### 1.2 Documentation files

| Path | Purpose |
|:-----|:--------|
| `docs/ux-redesign/STORY_B3_2_IMPLEMENTATION_REPORT.md` | Per-story implementation report (this commit's companion doc) |
| `docs/ux-redesign/STORY_B3_2_MIGRATION_NOTES.md` | This document |

---

## 2. Migration playbook (if you need to revert)

### 2.1 Per-file revert (recommended)

```bash
# Identify the B.3.2 commit
git log --oneline -- src/components/ui/tooltip.tsx src/components/dashboard/stat-cards.tsx
# Revert only B.3.2 (do not touch sibling stories from Sprint 6.4)
git revert <b3-2-sha>
```

### 2.2 Whole-sprint revert

If the sprint body lives on `phase-6/sprint-6.4`, revert the merge commit:

```bash
git checkout main
git revert --no-commit phase-6/sprint-6.4
# Resolve any conflicts (none expected for B.3.2 alone)
git commit -m "Revert: Sprint 6.4 (revenue integrity)"
```

### 2.3 Feature flag rollback

**Not applicable.** B.3.2 ships un-flagged (additive copy only). Per Sprint 6.4 §8.3, no new feature flags were introduced in this sprint.

---

## 3. Backwards compatibility

### 3.1 Public API (component exports)

| Export | Status |
|:-------|:-------|
| `StatCards` (default export) | unchanged signature |
| `countLabOverdueCases` | unchanged signature |
| `Tooltip` (new) | new export; consumers can adopt later without rush |

### 3.2 DOM shape change

The dashboard grid changed from:

```html
<div class="grid">
  <a class="stat-card">…</a>
  <a class="stat-card">…</a>
  <a class="stat-card revenue">…</a>   <!-- was 1 child -->
  <a class="stat-card">…</a>
  <a class="stat-card">…</a>
</div>
```

to:

```html
<div class="grid">
  <div class="relative">
    <a class="stat-card">…</a>
    <span class="sr-only">…</span>
  </div>
  <div class="relative">
    <a class="stat-card">…</a>
    <span class="sr-only">…</span>
  </div>
  <div class="relative">
    <a class="stat-card revenue">…</a>
    <button data-testid="revenue-tooltip-trigger" aria-label="…">Info</button>
    <p role="tooltip" id="…">…</p>
  </div>
  …
</div>
```

**Impact:**

- Each grid cell is now wrapped in a `<div class="relative">` instead of being a direct grid item. CSS Grid auto-placement still works (each `<div>` occupies one cell).
- The visible `<p role="tooltip">` is always in the DOM but hidden by default (`hidden` attribute) until the trigger receives focus or hover.
- The Info button is a sibling of the `<a>` (NOT a child) to avoid invalid nested interactive content (`<button>` inside `<a>`) and to escape the `<a>`'s `overflow-hidden` clipping boundary.

### 3.3 Existing tests

- `src/components/dashboard/__tests__/stat-cards.test.tsx` — **passes unchanged**. The Lab card test still validates the `sr-only` + `aria-describedby` pattern (B.1.4 surface untouched). The revenue card link still resolves via `screen.getByRole('link', { name: /Doanh thu tháng.*Đã xác nhận trong tháng/ })` because the accessible name is built from the visible label + hint, both unchanged.

---

## 4. Operational impact

### 4.1 Performance

- `/dashboard` route bundle: **5.2 kB** (was 5.2 kB). No measurable increase; the new `<Tooltip>` primitive is tiny and tree-shaken into the dashboard chunk only.
- One additional `useId()` call per `<StatCards>` render — already used once; B.3.2 reuses the same id pattern.
- No new DOM event listeners at module scope (the Tooltip attaches `keydown` + `mousedown` only while open, and tears them down on close).

### 4.2 Runtime behaviour

- **Default state** (page load, no interaction): tooltip `<p>` is in the DOM but `hidden`. Zero visual cost. Screen-reader users get the tooltip text via `aria-describedby` on the link (continuous with the existing pattern).
- **Hover / focus**: tooltip becomes visible after a 120 ms show delay. Triggers wire `aria-describedby` to the bubble id (so screen readers announcing the focused trigger also describe the bubble).
- **Dismiss**: `mouseleave`, `blur`, `Escape`, or click outside (each dismisses in O(1)).
- **No regressions** in: revenue computation (`status === 'confirmed'` filter unchanged), `countLabOverdueCases`, payment status filtering, customer/case fetches.

### 4.3 Accessibility

- **Contrast:** bubble uses `bg-gray-900 text-white` ≈ 16.1 : 1 (WCAG AAA).
- **Keyboard parity:** every affordance works without a pointing device (focus + Enter/Space activates the trigger; Escape dismisses; Tab moves focus normally).
- **`role="tooltip"`** on the bubble; **`<button type="button">`** on the trigger (so it's tabbable but does not submit a form).
- **`aria-describedby`** is wired on the trigger **while the tooltip is open** — this prevents screen readers from announcing the tooltip text when the user is just hovering the card body for navigation.

### 4.4 Mobile (360 px viewport)

- Bubble max-width is `240 px`. With `placement="bottom"` + `align="end"`, the bubble extends left from the Info button's right edge.
- The Info button is positioned `top-2 right-2` on the card. At 360 px viewport with `sm:grid-cols-2`, each card is ~156 px wide. The bubble extends from `card_right - 240 px` to `card_right`, fitting within the viewport with body padding.

---

## 5. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|:-----|:-----------|:-------|:-----------|
| Anti-pattern A4 (ambiguous aggregate) regresses on a future commit | L | M | The new test asserts `getRevenueLink()` has its `aria-describedby` matching the bubble id. A grep gate (`grep -rE "Doanh thu" src/components/dashboard/stat-cards.tsx` must include `<Tooltip>` or `<Info>` within ±5 lines) catches drift. |
| Tooltip bleeds viewport at 360 px | L | L | Bubble `max-w-[240px]` + `placement="bottom"` + `align="end"` constraint verified by manual smoke at 360 px viewport (see Implementation Report §6). |
| `Tooltip` cloneElement ref-forwarding breaks consumers that need a ref | L | L | Tests pass without ref forwarding; ref-forwarding is internal-only. Consumers needing a ref on the trigger can wrap their own button (the Tooltip supports a single ReactElement child). |
| Accountant Lead wants to re-word the tooltip | L | M | The copy is centralised in `REVENUE_TOOLTIP_COPY` constant at the top of `stat-cards.tsx`. Edit + re-test + re-sign-off is one change in one file. |
| `Info` icon conflicts with another tooltip on the dashboard | L | L | The Info button has `data-testid="revenue-tooltip-trigger"` for unambiguous test selection. Only the revenue card carries this affordance. |

---

## 6. Co-existence with other Sprint 6.4 stories

B.3.2 ships first (per execution plan §5.2). Subsequent stories (B.3.4 refund line, RR-4 Suspense fallback, R-A1 alert-to-toast, C-3 visual baseline) do not modify `stat-cards.tsx` and do not introduce competing tooltip primitives. There is no merge-conflict risk between B.3.2 and any other Sprint 6.4 story.

---

## 7. Reference

- Plan: [`SPRINT_6_4_EXECUTION_PLAN.md`](./SPRINT_6_4_EXECUTION_PLAN.md) §2.1, Appendix A.1
- Story: [`STORY_B3_2_IMPLEMENTATION_REPORT.md`](./STORY_B3_2_IMPLEMENTATION_REPORT.md)
- BACKLOG: B.3.2 / F-HIGH-29

*End of Story B.3.2 Migration Notes.*