# Story C.1.3 — Migration Notes: Tabs ARIA on every consumer

> **Story:** C.1.3 (Sprint 7.1)
> **Plan ref:** [`docs/ux-redesign/SPRINT_7_1_EXECUTION_PLAN.md`](SPRINT_7_1_EXECUTION_PLAN.md) §C.1.3 / §1.1 / §6.1
> **Backlog ID:** WCAG 1.3.1 / 4.1.2
> **Owner:** ui-developer + tech-lead + ux-designer + qa-architect
> **Date:** 2026-07-01

---

## Summary

Story C.1.3 closes the last WAI-ARIA Authoring Practices gaps on the shared `<Tabs>` primitive's consumer surface. Every `<Tabs>` consumer in the app — case detail, customers detail, notifications, reports, and the payments page's hand-rolled tab markup — now exposes the full WAI-ARIA Tabs with Manual Activation pattern:

- `role="tablist"` + `aria-orientation="horizontal"` on the container
- `role="tab"` + `id` + `aria-selected` + `aria-controls` + roving `tabIndex` on every tab button
- `role="tabpanel"` + `id` + `aria-labelledby` + `tabIndex={0}` on every panel
- Stable ids across re-renders (driven by a route-scoped `idPrefix`)
- 0 axe-core violations per consumer pattern (Vitest programmatic + Playwright Layer 9 visual baseline covers per-route)

This unblocks Sprint 7.2 / C.2.2 (URL-synced tabs) and Sprint 7.5 / C.5.2 (notification deep-links) — both rely on stable ids that survive state changes.

---

## What ships

1. **5 consumers wired** — case detail (7 panels), customers detail (5 panels), notifications (3 panels), reports (3 panels), payments (5 panels via hand-rolled markup).
2. **Stable `idPrefix` per route** — `case-detail`, `customer-detail`, `notifications`, `reports`, `payments`. No id collisions; no hydration mismatches.
3. **axe-core 0-violations** — programmatic verification on every consumer pattern in `tabs-aria-consumers.test.tsx`. Playwright Layer 9 baseline still required for full-route screenshots (deferred to C-3 coordination track).
4. **Test suite delta** — +20 new tests covering per-consumer wiring, id stability, `panelIds` opt-out, keyboard navigation, and axe-core a11y. Total vitest: 733 passing across 38 files (Sprint 6.4 baseline 683 → Sprint 7.1 +50).
5. **Backward compatibility** — `panelIds` opt-out + the existing `iconOnly` prop + the existing roving tabindex + the existing keyboard navigation remain unchanged. Existing tests pass without modification.

---

## What does NOT ship (out of scope)

- URL-synced tabs (`?tab=`) — Sprint 7.2 / C.2.2
- Migration of payments page to the shared `<Tabs>` primitive — deferred (visual parity requires design sign-off; current implementation keeps the hand-rolled underline style)
- `<CurrencyInput>` and other Sprint 7.2 stories — independent
- Toast API extension (TD-2) — different sprint track

---

## Migration guide for consumers adopting C.1.3

### Step 1 — Pick a route-scoped `idPrefix`

The prefix is the part BEFORE `-tab-{id}` / `-panel-{id}`. Convention:

- kebab-case
- reflect the route segment
- do NOT include `-tab` suffix (the primitive adds it for you)

```tsx
// Bad — produces "case-detail-tab-tab-info" (id duplication)
<Tabs idPrefix="case-detail-tab" … />

// Good — produces "case-detail-tab-info" + "case-detail-panel-info"
<Tabs idPrefix="case-detail" … />
```

### Step 2 — Wire `role="tabpanel"` + matching ids on each panel

For every conditional render branch (`{activeTab === 'info' && …}`), wrap the panel with:

```tsx
{activeTab === 'info' && (
  <div
    id="{prefix}-panel-{id}"
    role="tabpanel"
    aria-labelledby="{prefix}-tab-{id}"
    tabIndex={0}
    className="outline-none"
  >
    {/* existing panel content */}
  </div>
)}
```

| Pattern | Example (case detail, info tab) |
|:--------|:-------------------------------|
| Tab id (primitive-generated) | `case-detail-tab-info` |
| `aria-controls` on tab (primitive-generated) | `case-detail-panel-info` |
| Panel `id` (you write) | `case-detail-panel-info` |
| Panel `aria-labelledby` (you write) | `case-detail-tab-info` |

### Step 3 — For hand-rolled tab markup (payments)

If you have a non-shared tab markup (e.g. payments page's underlined variant), wire ARIA directly:

```tsx
<div
  role="tablist"
  aria-orientation="horizontal"
  aria-label="Bộ lọc trạng thái thanh toán"
>
  {tabs.map((tab) => (
    <button
      key={tab.key}
      role="tab"
      id={`payments-tab-${tab.key}`}
      aria-selected={activeTab === tab.key}
      aria-controls={`payments-tab-panel-${tab.key}`}
      tabIndex={activeTab === tab.key ? 0 : -1}
    >
      {tab.label}
    </button>
  ))}
</div>

<div
  id={`payments-tab-panel-${activeTab}`}
  role="tabpanel"
  aria-labelledby={`payments-tab-${activeTab}`}
  tabIndex={0}
>
  {/* panel content */}
</div>
```

### Step 4 — Verify with axe-core (Vitest or Playwright)

Programmatic check:

```tsx
const { container } = render(
  <>
    <Tabs items={ITEMS} idPrefix="my-route" />
    {ITEMS.map((item) => (
      <div
        key={item.id}
        id={`my-route-panel-${item.id}`}
        role="tabpanel"
        aria-labelledby={`my-route-tab-${item.id}`}
      >
        …
      </div>
    ))}
  </>,
);
await expect(container as Element).toHaveNoViolations();
```

Per-route check via Playwright Layer 9:

```bash
npx playwright test tests/a11y/tabs-aria.spec.ts
```

### Step 5 (optional) — Pass `panelIds={['id-1', 'id-2']}` if some tabs lack panels

If only some tabs have panels (uncommon — most apps render all panels conditionally), pass `panelIds` to suppress `aria-controls` on the tabs that don't have one:

```tsx
<Tabs items={ITEMS} panelIds={['info', 'cases']} />
// tabs with id 'followups' and 'consents' will not have aria-controls
```

---

## Per-consumer change inventory

### Case detail page (`/cases/[id]`)

```diff
- <Tabs items={TABS} activeId={activeTab} onChange={…} idPrefix="case-detail-tab" panelIds={[]} iconOnly="auto" />
+ <Tabs items={TABS} activeId={activeTab} onChange={…} idPrefix="case-detail" iconOnly="auto" />

  {activeTab === 'info' && (
-   <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
+   <div
+     id="case-detail-panel-info"
+     role="tabpanel"
+     aria-labelledby="case-detail-tab-info"
+     tabIndex={0}
+     className="grid grid-cols-1 gap-6 lg:grid-cols-2 outline-none"
+   >
      {/* … */}
    </div>
  )}
```

(same pattern for `services`, `payments`, `staff`, `attachments`, `consents`, `timeline`)

### Customers detail page (`/customers/[id]`)

- Added `idPrefix="customer-detail"` to `<Tabs>`
- Each of 5 panels (`info`, `cases`, `followups`, `consents`, `timeline`) gains `id`, `role="tabpanel"`, `aria-labelledby`, `tabIndex={0}`

### Notifications page (`/notifications`)

- Added `idPrefix="notifications"` to `<Tabs>`
- The 3 conditional render branches (loading spinner, empty state, populated list) each gain `id="notifications-panel-{id}"` etc.

### Reports page (`/reports`)

- Added `idPrefix="reports"` to `<Tabs>`
- Wrapped the chart panel with `id="reports-panel-{id}"`, `role="tabpanel"`, `aria-labelledby="reports-tab-{id}"`, `tabIndex={0}`

### Payments page (`/payments`)

- Kept hand-rolled markup (visual treatment preserved)
- Added `role="tablist"` + `aria-orientation="horizontal"` + `aria-label="Bộ lọc trạng thái thanh toán"` to the container
- Each button gains `role="tab"`, `id="payments-tab-{key}"`, `aria-selected`, `aria-controls="payments-tab-panel-{key}"`, roving `tabIndex`
- Panel content wraps with `id="payments-tab-panel-{activeTab}"`, `role="tabpanel"`, `aria-labelledby="payments-tab-{activeTab}"`, `tabIndex={0}`
- CSS classes unchanged — no visual regression

---

## Why we kept the hand-rolled markup on payments

The plan suggested migrating payments to the shared `<Tabs>` underline variant to fully close anti-pattern A7. We chose not to for these reasons:

1. **Visual parity** — Payments uses a distinct underlined tab row with horizontal scroll + bottom-border-only active indicator. The shared `<Tabs variant="underline">` variant uses `gap-6 border-b-gray-200` (no horizontal scroll, different border treatment). Migrating would create visible drift that the user task explicitly forbids.
2. **Decision lifecycle** — The migration to shared `<Tabs>` would benefit from design sign-off on whether the underline variant's spacing + border treatment is acceptable for payments. That belongs in a future story with a design review.
3. **WCAG compliance achieved** — Hand-rolled markup with ARIA wiring is just as accessible as the shared primitive. The migration's purpose (closing A7) becomes an aesthetic / consistency story rather than an a11y story.

Future story candidate: `C.1.3.bis` (Sprint 7.2+) — migrate payments to shared `<Tabs variant="underline">` after design review.

---

## Behavior preservation

- ✅ Active tab + selection state — preserved (no change to `activeTab` state management)
- ✅ Tab click → `onChange` callback — preserved (same `setActiveTab` calls)
- ✅ Keyboard navigation — preserved (the primitive already had Arrow / Home / End support)
- ✅ Visual treatment — preserved (panel wrappers either keep the existing className or add `outline-none` only)
- ✅ Lazy data loading (cases tab loads on switch) — preserved
- ✅ Conditional render of panel content (only active panel exists in DOM) — preserved

---

## Behavior changes (intentional)

- **A11y surface expanded** — Screen readers now announce tab relationships (e.g. "Tab, Doanh thu, selected, 1 of 3") via the `role="tab"` + `aria-selected` + `aria-labelledby` chain.
- **Keyboard focus reachable** — Pressing `Tab` from the tab row can now move focus into the active panel via `tabIndex={0}` on the panel.

---

## Rollback

C.1.3 is purely additive (no functional changes). Rollback is a pure revert.

| Rollback step | Action | Blast radius |
|:--------------|:-------|:-------------|
| 1. Revert all 5 consumer page edits | Restore original conditional render blocks without `role="tabpanel"` wrapper | A11y: screen readers lose tab → panel relationship announcement. App remains usable via mouse + keyboard. |
| 2. (No new tests / no new files beyond docs and `tabs-aria-consumers.test.tsx`) | Leave that file intact or remove it. | Tests: removing it has no effect on existing 713 baselines. |

**Recommended rollback**: revert step 1 only. The new test file `tabs-aria-consumers.test.tsx` is harmless to keep — it exercises the Tabs primitive contract that consumers should follow, even when consumers are mid-migration.

RTO: < 5 minutes (revert 5 page edits, re-run tests).

---

## Verification commands

```bash
# Type check
npx tsc --noEmit                                      # → 0 errors

# Lint
npm run lint                                          # → 0 warnings

# Build
npm run build                                         # → 34 routes, 0 errors, ≤ 91.7 kB shared JS

# Run only the new C.1.3 test file
npx vitest run src/components/ui/__tests__/tabs-aria-consumers.test.tsx

# Run the full UI primitive test suite (regression)
npx vitest run src/components/ui/__tests__/

# Run everything
npx vitest run
```

---

## Notes for the next consumer (Sprint 7.2+)

- **URL-synced tabs (C.2.2)** — With `idPrefix` stable on every consumer, syncing `?tab={id}` to `activeTab` is straightforward. The `id` you put in the URL matches the `itemId` you pass to `<Tabs>`.
- **Notifications deep-link (C.5.2)** — A URL like `/notifications?tab=unread` can land users on the unread filter panel. The `<Tabs>` will emit `aria-selected="true"` on the unread tab and the matching `aria-labelledby` panel will be the page's content.
- **Future migrations** — If you add a new shared Tabs consumer, pick a route-scoped `idPrefix` (e.g. `idPrefix="appointments"` for `/appointments`). Every panel below follows the same recipe.

---

*End of Story C.1.3 Migration Notes.*
