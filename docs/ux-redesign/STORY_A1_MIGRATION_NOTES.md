# Story A.1 — Tabs ARIA + Arrow-key Navigation

**Status:** ✅ Complete
**Branch:** `phase-6/sprint-6.1`
**Owner:** FE-1
**Risk:** 🟡 Medium
**Backlog ref:** F-HIGH-11
**Date:** 2026-06-29

---

## Summary

Brings the `Tabs` primitive at `src/components/ui/tabs.tsx` into conformance with the WAI-ARIA Authoring Practices "Tabs" pattern:

- `role="tablist"` + `aria-orientation="horizontal"` on the container
- `role="tab"` + `aria-selected` + `aria-controls` + stable ids on each tab
- Roving `tabIndex` (only the active tab is tabbable)
- `ArrowLeft` / `ArrowRight` to cycle (with wrap-around), `Home` / `End` to jump
- Focus follows selection on keyboard nav
- Visible `focus-visible` ring (swan aqua) for sighted keyboard users
- `aria-controls` is opt-in via the new `panelIds` prop so axe-core doesn't flag non-existent panel ids

Panels are still rendered by the consumer (this matches the existing pattern in `customers/[id]`, `reports`, `notifications`); consumers can now also wire `aria-labelledby={tabId}` on their `role="tabpanel"` elements to round out the relationship.

---

## What changed

### Created

| Path | Purpose |
|---|---|
| `vitest.config.ts` | Vitest config — jsdom, `@/` alias, `setupFiles` |
| `tsconfig.test.json` | Separate TS config for tests — extends root, includes `src/test` + `__tests__`, vitest globals types |
| `src/test/setup.ts` | jest-dom matchers, axe-core global registration, `toHaveNoViolations` Vitest matcher (axe-core native, not jest-axe, for `this`-context compat) |
| `src/test/types.d.ts` | Module augmentation: `vitest.Assertion.toHaveNoViolations` |
| `src/test/jest-axe.d.ts` | Type stubs for `jest-axe` (kept for future use; not currently consumed at runtime) |
| `src/test/test-utils.tsx` | `renderWithProviders` wrapper + re-export of `@testing-library/react` and `@testing-library/user-event` |
| `src/components/ui/__tests__/tabs.test.tsx` | 21 tests across 6 `describe` blocks |
| `docs/ux-redesign/STORY_A1_MIGRATION_NOTES.md` | This file |
| `docs/ux-redesign/STORY_A1_IMPLEMENTATION_REPORT.md` | DoD/audit/anti-pattern report |

### Modified

| Path | Change |
|---|---|
| `package.json` | Added `vitest`, `@vitejs/plugin-react`, `@testing-library/{react,user-event,jest-dom}`, `jsdom`, `axe-core`, `jest-axe`, `@vitest/coverage-v8` to `devDependencies`. Added `test`, `test:watch`, `test:cov`, `test:ui` npm scripts. |
| `tsconfig.json` | Excluded `src/test/**` and `src/**/__tests__/**` from the production tsconfig so test files don't leak into the Next.js build pipeline. |
| `src/components/ui/tabs.tsx` | ARIA roles, roving `tabIndex`, keyboard handler, `panelIds` opt-in, focus-visible ring. See commit-equivalent diff below. |

### NOT changed

- All three existing consumers (`customers/[id]`, `reports`, `notifications`) keep their existing JSX. Their Tabs call sites still compile and run with **zero consumer changes** because the new `panelIds` prop defaults to "all tabs have a panel" (matching the current pattern where every consumer renders every panel as a sibling and uses `activeTab` to conditionally show content). Backward compat is preserved.
- `src/app/(protected)/payments/page.tsx` does not use the shared `Tabs` component (it has its own custom tab strip); not touched.

---

## API additions

```ts
interface TabsProps {
  items: TabItem[];
  activeId?: string;
  onChange?: (id: string) => void;
  className?: string;
  variant?: 'pill' | 'underline';
  idPrefix?: string;          // NEW: optional stable id prefix for tab/panel ids
  panelIds?: string[];        // NEW: opt-in list of tab ids that have a panel
}
```

### `idPrefix`

Defaults to `tabs-${useId().replace(/:/g, '')}` so React-generated ids never start with `:` (which axe-core rejects). Consumers can override for predictable ids (`idPrefix="customer"` → tabs `customer-tab-{id}`, panels `customer-panel-{id}`).

### `panelIds`

Default: every tab id is treated as having a panel (matches the existing pattern in this codebase). If a consumer passes `panelIds={['info']}` or `panelIds={[]}`, the component emits `aria-controls` only for those tabs. This is the WAI-ARIA-correct behavior — axe-core rejects `aria-controls` values that don't resolve to in-DOM elements.

### `panelIds` migration for consumers (optional, future)

None of the three current consumers need to change. If/when a Tabs call site renders no panels at all (or renders them only sometimes), pass `panelIds` explicitly to suppress the `aria-controls` attribute. For now, every consumer always renders all panels as conditional siblings, so the default is correct.

---

## Manual smoke (per BACKLOG §6.3, item 1)

1. `npm run dev` → open `/customers/[id]`
2. Tab into the tab strip → only "Thông tin" is tabbable (others have `tabindex="-1"`)
3. Press `→` → selection + focus moves to "Lịch sử ca"; verify panel switches
4. Press `End` → jumps to "Timeline"
5. Press `Home` → jumps back to "Thông tin"
6. Press `←` at first tab → wraps to "Timeline"; verify panel switches
7. Open DevTools → Accessibility panel → confirm `role="tablist"`, `aria-orientation="horizontal"`, `aria-selected` correct
8. Repeat for `/reports` and `/notifications`

---

## Rollback

| Step | Action |
|---|---|
| 1 | `git revert <A.1-commit-sha>` |
| 2 | Re-run `npm install` (drops `axe-core` from deps if not used elsewhere — currently only `setup.ts` consumes it, so the revert is safe) |
| 3 | Manual smoke: Tabs still render + click-to-switch works (the only regression is loss of ARIA + arrow-key nav, which the original code lacked anyway) |

Time to rollback: < 5 min.
Data impact: none.