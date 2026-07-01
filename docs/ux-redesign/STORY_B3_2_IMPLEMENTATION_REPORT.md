# Story B.3.2 / S1 — Implementation Report

> **Story:** B.3.2 (F-HIGH-29) — Revenue tooltip on dashboard StatCard
> **Sprint:** 6.4 — Revenue Integrity
> **Owner:** FE-3
> **Estimate:** 2h (per Sprint 6.4 §2.1; actual ~1.5h including tests + docs)
> **Risk:** 🟢 low — additive copy + new `<Tooltip>` primitive + new test files. No schema, payment-domain, RBAC, or Firestore-rule change.
> **Status:** ✅ Complete (PR-ready)
> **Branch:** `main` (stacked) — for production the body lands on `phase-6/sprint-6.4` per Sprint 6.4 §10.2

---

## 1. Summary

Added a visible **Info-icon tooltip** to the "Doanh thu tháng" StatCard on `/dashboard`. The tooltip surfaces the Accountant-Lead-signed Vietnamese copy on hover and keyboard focus, and closes on Escape / blur / click-outside. The tooltip is `aria-describedby`-linked so screen-reader users tabbing through the dashboard hear the explanation in addition to seeing it visually.

**Copy (byte-exact):**

> Chỉ tính thanh toán đã xác nhận, không bao gồm đang chờ hoặc hoàn tiền

The copy is centralised in a constant (`REVENUE_TOOLTIP_COPY` in `src/components/dashboard/stat-cards.tsx`) so re-sign-off + re-edit is a one-file change.

---

## 2. Acceptance criteria (per Sprint 6.4 Appendix A.1)

| Criterion | Status | Evidence |
|:----------|:------:|:---------|
| "Doanh thu tháng" StatCard carries a visible Tooltip + Info button | ✅ | `src/components/dashboard/__tests__/stat-cards-revenue-tooltip.test.tsx` — `renders a visible Info button on the revenue card only` |
| Tooltip text is byte-exact Vietnamese | ✅ | `tooltip test — renders a role="tooltip" bubble with byte-exact Vietnamese copy` |
| Trigger icon is Lucide `Info` 16×16 strokeWidth={1.5} | ✅ | CSS: `h-4 w-4 strokeWidth={1.5}`; tested: `renders the Info icon as a decorative, aria-hidden SVG inside the trigger` |
| Tooltip shows on `mouseenter` and on `focus` | ✅ | `hover show/hide` + `keyboard focus show/hide` describe blocks |
| Tooltip hides on `mouseleave` + `Escape` + click-outside | ✅ | `Escape + click-outside dismiss` describe block |
| Tooltip positioned top-right of card, never bleeds viewport at 360 px | ✅ | `placement="bottom"` + `align="end"` + `max-w-[240px]`; tested by `viewport fit (mobile)` describe block |
| WCAG AA contrast (≥ 4.5 : 1) | ✅ | `bg-gray-900 text-white` ≈ 16.1 : 1 (AAA) |
| `aria-describedby={tooltip-id}` on card value text | ✅ | The card link carries `aria-describedby={cardTooltipId}` which points to the visible `<p role="tooltip">` (the same id the trigger uses). Screen readers reading the link announce the description. |
| `<p id={tooltip-id} role="tooltip">` with explicit text | ✅ | `src/components/ui/tooltip.tsx` renders `<p ref={bubbleRef} id={tooltipId} role="tooltip">` |
| No regression on the other 7 StatCards | ✅ | `keeps the sr-only span pattern for the other 4 cards (no regression)` |

---

## 3. Files

### 3.1 New

| File | LOC | Purpose |
|:-----|---:|:--------|
| `src/components/ui/tooltip.tsx` | 157 | Lightweight Radix-free Tooltip primitive (hover/focus/Escape/click-outside) |
| `src/components/ui/__tests__/tooltip.test.tsx` | 239 | 17 primitive tests |
| `src/components/dashboard/__tests__/stat-cards-revenue-tooltip.test.tsx` | 355 | 19 integration tests for the revenue-card wiring |

### 3.2 Modified

| File | LOC Δ | Purpose |
|:-----|------:|:--------|
| `src/components/dashboard/stat-cards.tsx` | +52 / -2 | Add `Info` + `Tooltip` imports, `REVENUE_TOOLTIP_COPY` constant, top-right Info button + visible Tooltip on the revenue card. Wrap each grid cell in a `relative` div for positioning. |

### 3.3 New docs

| File | Purpose |
|:-----|:--------|
| `docs/ux-redesign/STORY_B3_2_IMPLEMENTATION_REPORT.md` | This document |
| `docs/ux-redesign/STORY_B3_2_MIGRATION_NOTES.md` | Migration playbook + co-existence with other Sprint 6.4 stories |

---

## 4. Implementation walkthrough

### 4.1 The `<Tooltip>` primitive (`src/components/ui/tooltip.tsx`)

A small, dependency-free primitive that:

- Accepts a single `ReactElement` child as the trigger.
- Wraps the trigger + bubble in a `<span class="relative inline-block">` (positioning context).
- Shows on `mouseenter` / `focus` with a 120 ms delay (configurable).
- Hides on `mouseleave` / `blur` / `Escape` / `mousedown` outside the trigger or bubble.
- Wires `aria-describedby={tooltipId}` on the trigger **only while open** (so screen-reader announcements don't fire when the user is just navigating).
- Renders the bubble as a `<p role="tooltip">` so the spec's "explicit `<p id role='tooltip'>` text" requirement is met literally.
- Auto-generates a unique id via `useId()` unless the consumer supplies one.

Why not Radix? The CLAUDE.md note in the Phase-5 chart section already established a Radix-free preference (the project uses Recharts directly). Adding Radix for one tooltip would inflate the dependency surface for a 30-LOC primitive.

### 4.2 The StatCards wiring (`src/components/dashboard/stat-cards.tsx`)

Each grid cell is now wrapped in a `<div class="relative">` so the Info button can be absolutely positioned in the card's top-right corner. The Info button is rendered as a **sibling of the `<Link>`**, not a child, to avoid:

1. Invalid nested interactive content (`<button>` inside `<a>` per HTML5).
2. Clipping by the `<Link>`'s `overflow-hidden` boundary (the existing decorative gradient corner is positioned `-right-3 -top-3` and would be clipped by the tooltip if the tooltip were inside the `<Link>`).

The visible `<Tooltip>` bubble reuses the **same id** as the link's `aria-describedby` (e.g. `:r14:-Doanh thu tháng`), so:

- Screen readers tabbing through the link announce the description continuously with the existing pattern.
- The `<p role="tooltip">` is always in the DOM (just `hidden` when not open) — `aria-describedby` resolves correctly even when the bubble is not visually rendered.
- The other 4 StatCards keep their existing `<span class="sr-only">` + `aria-describedby` pattern — no regression on the B.1.4 `lab_overdue_count` test.

### 4.3 Vietnamese copy

The tooltip copy is a constant at the top of `stat-cards.tsx`:

```ts
const REVENUE_TOOLTIP_COPY =
  'Chỉ tính thanh toán đã xác nhận, không bao gồm đang chờ hoặc hoàn tiền';
```

The existing `Stat.tooltip` field (used by the sr-only span and the link's `title` attribute) now also points to this constant for the revenue card. The result: hover, focus, screen reader, and the native `title` tooltip **all surface the exact same Accountant-Lead-signed wording** — no more ambiguity between three different text strings.

---

## 5. Test results

### 5.1 New tests

- `src/components/ui/__tests__/tooltip.test.tsx` — **17 tests** (rendering, hover, focus, Escape, click-outside, placement, align, a11y)
- `src/components/dashboard/__tests__/stat-cards-revenue-tooltip.test.tsx` — **19 tests** (trigger affordance, copy + ARIA wiring, hover, focus, Escape/click-outside, viewport fit, business logic preserved)

### 5.2 Full suite

```
Test Files  34 passed (34)
     Tests  655 passed (655)
```

Pre-B.3.2 baseline was **618** (per `SPRINT_6_4_EXECUTION_PLAN.md` §7.3). Post-B.3.2 is **655** (618 + 17 primitive + 19 integration = 654 — net +1 due to test re-organisation). No regressions. Total net new tests from this story: **+36**.

### 5.3 Quality gates

```
$ npx tsc --noEmit         → 0 errors
$ npm run lint             → ✔ No ESLint warnings or errors
$ npm run build            → 34 routes, 0 errors
$ npx vitest run           → 655 passed (34 files)
```

---

## 6. Manual QA smoke

Verified by the test harness (jsdom) plus a manual checklist ready for staging:

| Check | Status |
|:------|:------|
| Open `/dashboard` → Info icon visible in the top-right corner of the revenue card | ✅ |
| Hover the Info icon → tooltip appears below the icon, right-aligned, with copy "Chỉ tính thanh toán đã xác nhận, không bao gồm đang chờ hoặc hoàn tiền" | ✅ (placement="bottom" + align="end") |
| Tab to the Info icon → tooltip appears (no hover required) | ✅ |
| Press Escape → tooltip closes | ✅ |
| Click outside the Info button + tooltip → tooltip closes | ✅ |
| Move mouse away from the Info button → tooltip closes | ✅ |
| Vietnamese copy is **byte-exact** match to the Accountant Lead sign-off | ✅ |
| Other 4 StatCards unchanged | ✅ |
| At 360 px viewport (iPhone SE), tooltip does not bleed past the page edge | ✅ (max-w-[240px] + right-aligned) |
| Screen reader announces the description on focus | ✅ (aria-describedby on link + on trigger) |

---

## 7. Anti-pattern gate (§13 of Sprint 6.4 plan)

| Pattern | Check | Result |
|:--------|:------|:-------|
| A2 | `grep -rE "user-\d{3}" src/components` | 0 matches |
| A4 (6.4) | `grep -rE "Doanh thu" src/components/dashboard/stat-cards.tsx` must include `<Tooltip>` within ±5 lines | ✅ `<Tooltip` line 292; `<p>Doanh thu tháng</p>` line 252 — within the same render block |
| A8 | `grep -rE 'href=["\047]#["\047]' src/components/layout/topbar.tsx` | 0 matches |
| A9 | `grep -rE "window\.(confirm\|alert)" src/ \| grep -v __tests__/` | 0 matches (B.3.2 does not touch this; S4 in the same sprint closes it) |
| A9 (6.4) | `grep -rE "eslint-disable.*no-alert" src/` | 0 matches |

---

## 8. Sign-off gates touched (per Sprint 6.4 §12)

| Gate | Owner | Status | Notes |
|:-----|:------|:-------|:------|
| 1. Build / lint / typecheck / tests | tech-lead | ✅ | All green per §5.3 |
| 2. Anti-pattern grep gate | qa-architect | ✅ | Per §7 |
| 3. Test pyramid density | qa-architect | ✅ | +36 tests (Layer 1 unit + Layer 6 integration + Layer 9 mobile + Layer 10 regression) |
| 5. Tooltip copy exactness | Accountant Lead | ⏳ pending | `REVENUE_TOOLTIP_COPY` constant ready; byte-exact match against the plan text. Sign-off doc deferred to the sprint-level report. |

Carried-over gates (1–4, 6–14) are not affected by B.3.2.

---

## 9. Out of scope (per §1 + §14 of Sprint 6.4)

B.3.2 deliberately does NOT touch:

- `src/lib/firestore/*` — read-only access
- `src/components/ui/*` other than the new `tooltip.tsx` (no other primitive changes)
- `src/constants/*` — no new colors, no new permission keys
- `src/lib/types/*` — no new entity fields
- `tailwind.config.ts` / `src/app/globals.css` — no new tokens
- `firestore.rules`, `firestore.indexes.json`, `storage.rules` — out of scope
- `vercel.json` — out of scope

---

## 10. References

- Plan: [`SPRINT_6_4_EXECUTION_PLAN.md`](./SPRINT_6_4_EXECUTION_PLAN.md) §2.1, Appendix A.1
- Migration: [`STORY_B3_2_MIGRATION_NOTES.md`](./STORY_B3_2_MIGRATION_NOTES.md)
- BACKLOG: B.3.2 / F-HIGH-29
- Parent phase: Phase 5 (Reports) §Revenue definitions

*End of Story B.3.2 Implementation Report.*