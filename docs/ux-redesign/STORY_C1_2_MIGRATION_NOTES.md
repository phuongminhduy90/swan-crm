# Story C.1.2 — Migration Notes: Tabs icon-only on mobile

> **Story:** C.1.2 (Sprint 7.1)
> **Plan ref:** [`docs/ux-redesign/SPRINT_7_1_EXECUTION_PLAN.md`](SPRINT_7_1_EXECUTION_PLAN.md) §C.1.2 / §1.1 / §4.1 / §6.1
> **Backlog ID:** F-HIGH-08
> **Owner:** ui-developer + tech-lead + ux-designer
> **Date:** 2026-07-01

---

## Summary

Story C.1.2 adds an `iconOnly` prop to the shared `<Tabs>` primitive that, when set to `'auto'` (the default), collapses tab labels below the Tailwind `sm` breakpoint (≤ 640 px viewport) and displays only the Lucide icon. On desktop (`≥ sm`), both icon and label render as before.

The case detail page (`/cases/[id]`) is the first consumer. Its 7 tabs — Thông tin, Dịch vụ, Thanh toán, Phân công, Đính kèm, Consent, Timeline — were previously hand-rolled with no icons and would overflow the narrow viewport at 360 px. After C.1.2 the same row fits comfortably as 7 icon-only buttons (each ~36 px wide with 8 px gap), freeing horizontal space for the page header on mobile.

### What ships

1. New `iconOnly?: 'auto' | 'always' | 'never'` prop on `<Tabs>` (default `'auto'`).
2. SSR-safe viewport detection via Sprint 6.3's `useMediaQuery('(min-width: 640px)')` — no new hook.
3. Accessibility plumbing: `aria-label` + native `title` tooltip on icon-only buttons, `aria-hidden` on icon wrapper, `sr-only` on the text label (kept in DOM for screen readers).
4. Compact `p-2` padding in icon-only mode (vs `px-4 py-2`) so the icon stays vertically centered with no extra chrome.
5. Migration of the case detail page to the shared `<Tabs>` primitive (closes hand-rolled tab anti-pattern in that route).
6. MatchMedia stub in `src/test/setup.ts` so every existing `useMediaQuery`-consuming test keeps working.

### What does NOT ship (out of scope)

- URL-synced tabs (`?tab=`) — Sprint 7.2 / C.2.2
- Tabs ARIA on every consumer (`role="tabpanel"` + `aria-labelledby`) — Sprint 7.1 / C.1.3
- Migration of customers detail / notifications / reports tabs to `iconOnly="auto"` — optional, Sprint 7.2+

---

## Migration guide for future consumers

### `<Tabs>` — opt in to mobile icon-only behavior

```tsx
// Before — labels at every viewport (C.1.2 makes this the desktop-only state)
<Tabs
  items={[
    { id: 'info', label: 'Thông tin', icon: <Info /> },
    { id: 'services', label: 'Dịch vụ', icon: <Briefcase /> },
  ]}
  activeId={active}
  onChange={setActive}
/>

// After A — default `'auto'`, mirrors case-detail behavior (recommended)
<Tabs
  items={items}
  activeId={active}
  onChange={setActive}
  iconOnly="auto"
/>

// After B — force icon-only at every viewport (rare; useful for app shells)
<Tabs items={items} iconOnly="always" />

// After C — opt out entirely (legacy desktop-only consumers)
<Tabs items={items} iconOnly="never" />
```

### Why the default is `'auto'`

`'auto'` matches Sprint 7.1's commitment and the case detail page's needs:
- Mobile users see icons (saves ~120 px of horizontal space for 7 tabs)
- Desktop users keep full labels (no information loss for clinician + power-user workflows)
- No per-consumer config required

If a consumer needs different behavior, override explicitly with `'always'` or `'never'`.

### Icon requirements

Consumers must pass an `icon` on every `TabItem` they want to be icon-only visible. Without an icon, the icon-only render is empty (the button still has the label as `aria-label` but nothing visual). The case detail migration updated all 7 tabs to have icons.

For Lucide consistency, use the same icon family as the rest of the page's header. See the case detail inventory in [`STORY_C1_2_IMPLEMENTATION_REPORT.md`](STORY_C1_2_IMPLEMENTATION_REPORT.md) §2.

### Accessibility plumbing (built into the primitive)

When `iconOnly` is `'always'` OR (`'auto'` AND viewport < 640 px), every tab button:

1. Receives `aria-label={item.label}` — screen reader accessible name
2. Receives `title={item.label}` — native browser tooltip on hover (focus support varies)
3. Has the label text rendered inside `<span class="sr-only">` — kept in DOM for SR users who navigate by text content
4. Has its icon wrapper marked `aria-hidden="true"` — prevents double announcement

When labels are visible, none of the above are emitted — the visible text label provides the accessible name.

### SSR safety

`useMediaQuery` (Sprint 6.3) returns `false` during SSR and on the first client render, then re-evaluates synchronously inside `useEffect`. This means:

- Desktop users briefly see icon-only on the first paint, then the label pops in. The pop-in is bounded by `matchMedia`'s synchronous resolution and is not perceptible in practice.
- Mobile users see icon-only consistently (matches their expectation).
- No hydration mismatch warnings — both server and first-client render agree.

If a future consumer needs a different SSR default, pass `iconOnly="always"` (always icon-only) or `iconOnly="never"` (always labels).

---

## Case detail page — what changed

### Before

The case detail page rendered a hand-rolled tab row with no icons and no ARIA:

```tsx
<div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
  {TABS.map((tab) => (
    <button
      key={tab.id}
      onClick={() => setActiveTab(tab.id)}
      className={cn(
        'flex-1 rounded-lg py-2 text-sm font-medium transition-all',
        activeTab === tab.id ? 'bg-swan-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700',
      )}
    >
      {tab.label}
    </button>
  ))}
</div>
```

### After

```tsx
<Tabs
  items={TABS}                                  // now { id, label, icon } tuples
  activeId={activeTab}
  onChange={(id) => setActiveTab(id as Tab)}
  idPrefix="case-detail-tab"                    // stable prefix for future C.1.3 panel wiring
  panelIds={[]}                                  // suppress aria-controls until C.1.3 wires panels
  iconOnly="auto"                                // default; explicit for documentation
/>
```

### Behavior preservation

- Active state styling (swan gradient + white text) — preserved
- Click selection (`onChange`) — preserved
- Keyboard navigation (Tab focus, Enter to activate) — preserved (Tabs primitive already had full ARIA)
- Panel rendering (`activeTab === 'info' && …` etc.) — completely untouched

### Behavior changes (intentional)

- ARIA roles now present (`role="tablist"`, `role="tab"`, `aria-selected`) — improvement, no consumer visible
- Mobile renders icon-only below 640 px — improvement, addresses the original F-HIGH-08 overflow
- Icons added to every tab — improvement, matches visual hierarchy of the page header

---

## Rollback

C.1.2 is **mostly additive** with two narrow consumer-side changes.

| Rollback step | Action | Blast radius |
|:--------------|:-------|:-------------|
| 1. Revert case-detail `<Tabs>` import + usage | Restore the hand-rolled `<div><button>` row | Visual: case detail loses icon-only mobile variant + ARIA roles |
| 2. (Optional) Revert `tabs.tsx` iconOnly prop | Removes `'auto' / 'always' / 'never'` API surface | API: removes `TabsIconOnlyMode` export |
| 3. (Optional) Revert `src/test/setup.ts` matchMedia stub | Removes test infrastructure | Tests: every `useMediaQuery` consumer's test suite must re-stub `matchMedia` locally |

**Recommended rollback**: revert only step 1 — the case detail hand-rolled tabs. The primitive change is harmless to keep (no other consumer is using `iconOnly` yet).

RTO: < 5 minutes for step 1. Blast radius: case detail route only (visual + ARIA).

---

## Verification commands

```bash
# Run only the new C.1.2 test file
npx vitest run src/components/ui/__tests__/tabs-icon-only.test.tsx

# Run the full UI primitive test suite (regression)
npx vitest run src/components/ui/__tests__/

# Run everything
npx vitest run
```

---

## Notes for the next consumer (Sprint 7.2+)

- `iconOnly="auto"` is the **recommended default** for any new shared Tabs consumer that has 5+ tabs on a mobile-first page.
- The `idPrefix` prop should be set to a route-stable string (e.g. `"customer-detail-tab"`) so C.1.3-style panel ARIA wiring can attach without re-rendering the tab bar.
- `panelIds` is only relevant when the consumer renders matching `role="tabpanel"` elements; otherwise pass `[]` to keep axe-core clean.
- Avoid mixing `iconOnly="always"` with very wide labels — the `p-2` button may clip long Vietnamese diacritics.

---

*End of Story C.1.2 Migration Notes.*