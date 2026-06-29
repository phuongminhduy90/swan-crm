# Story A.3 — Migration Notes: CloseIconButton leaf primitive

> **Story:** A.3 (Sprint 6.1)
> **Plan ref:** `docs/ux-redesign/SPRINT_6_1_EXECUTION_PLAN.md` §A.3 / §4.1 / §6.2 / §9 commit 3
> **Audit ref:** UX Audit `F-HIGH-15` — close affordance drift across overlays
> **Owner:** ui-developer + tech-lead
> **Date:** 2026-06-29

---

## Summary

Story A.3 introduces a shared leaf primitive `CloseIconButton` and migrates
the one in-tree consumer (`Modal`) to use it. The goal is to lock down
visual treatment + accessibility for the close affordance so every
dismissible surface (Modal today, future Drawer/Sheet/Tooltip-dismiss in
Sprint 6.2/6.3) renders the same way with zero drift.

This story does **not** ship consumer migrations beyond `Modal` —
`ConfirmDialog` continues to compose `Modal` (and therefore transitively
gets the new close affordance), and no other dismissible surface exists
in the repo today. Future stories can opt-in by importing the primitive.

---

## Files created

| Path | Purpose | LOC |
|---|---|---|
| `src/components/ui/close-icon-button.tsx` | Leaf primitive — Lucide `X`, `aria-label="Đóng"`, hover-rotate, focus ring, two sizes | ~75 |

## Files modified

| Path | Change | LOC delta |
|---|---|---|
| `src/components/ui/modal.tsx` | Removed inline `<button>...</button>` close affordance; replaced with `<CloseIconButton onClose={onClose} className="absolute right-4 top-4" ariaLabel="Đóng" />`. Dropped `X` import (no longer used directly). | -7 |
| `src/components/ui/index.ts` | Added `export * from './close-icon-button'` to the public UI barrel | +1 |

## Test files created

| Path | Cases |
|---|---|
| `src/components/ui/__tests__/close-icon-button.test.tsx` | 19 tests covering render + ARIA, click behavior, keyboard activation, sizing variants, forwarded props, axe-core a11y |

---

## Consumer migration table

| Consumer | Pre-A.3 | Post-A.3 | Visual diff | Behavior diff |
|---|---|---|---|---|
| `Modal` | Inline `<button onClick={onClose} aria-label="Đóng">` + `<X />` | `<CloseIconButton onClose={onClose} className="absolute right-4 top-4" ariaLabel="Đóng" />` | None — same Tailwind classes (`rounded-lg p-1.5`, `hover:bg-gray-100`, `hover:text-gray-600`, `hover:rotate-90`) | None — `onClose` is wired the same way; the native `MouseEvent` is still passed through. |
| `ConfirmDialog` | Composes `Modal`, no own close button | Inherited via `Modal` migration | None | None |
| Future `Drawer` / `Sheet` | n/a — not in repo | Will import `CloseIconButton` directly | n/a | n/a |

### Migration mechanics (Modal)

```diff
-import { X } from 'lucide-react';
+import { CloseIconButton } from './close-icon-button';

-{/* Close button */}
-<button
-  onClick={onClose}
-  className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600 hover:rotate-90"
-  aria-label="Đóng"
-  type="button"
->
-  <X className="h-4 w-4" />
-</button>
+{/* Close button — uses the shared CloseIconButton primitive (Story A.3)
+    so every dismissible surface has consistent a11y + visual treatment. */}
+<CloseIconButton
+  onClose={onClose}
+  className="absolute right-4 top-4"
+  ariaLabel="Đóng"
+/>
```

---

## Why a `forwardRef` primitive

The primitive exposes a `ref` because:

1. Future `Tooltip` / `Popover` integrations may want to position
   relative to the close button.
2. It's the established convention in this codebase — `Button` in
   `src/components/ui/button.tsx` already uses `forwardRef`, and the
   Modal tests already rely on focus-targeting by `screen.getByRole(...)`
   (no manual `ref` access required today, but the primitive must not
   block that pattern).

---

## Prop surface

```ts
interface CloseIconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'aria-label'> {
  ariaLabel?: string;          // default 'Đóng'
  onClose?: (event: MouseEvent<HTMLButtonElement>) => void;
  size?: 'sm' | 'md';          // default 'md' — 16px icon (matches pre-migration Modal)
  className?: string;
}
```

- `onClose` is the **preferred** callback — it gets the underlying
  `MouseEvent` and signals "this button was the close trigger". The native
  `onClick` is still wired and forwarded so consumers can use either
  pattern.
- `onClose` calling `event.preventDefault()` skips the native `onClick`
  fallback (matches the React pattern used by native form submission).
- `type="button"` is hardcoded — closing an overlay should never submit
  a parent `<form>` by accident.

---

## Accessibility commitments (locked in tests)

- `aria-label="Đóng"` is the default accessible name (Vietnamese).
- The `<X>` SVG is `aria-hidden="true"` (decorative).
- Visible focus ring via `focus-visible:ring-2 focus-visible:ring-swan-400`.
- Native button keyboard activation (`Space`, `Enter`) is verified.
- `disabled` attribute correctly suppresses both visual hover-rotate and
  click activation.
- Zero axe-core violations on the standalone button (verified in test).

---

## Anti-pattern scan

| Anti-pattern (DESIGN_DIRECTION §18) | Pre-A.3 | Post-A.3 |
|---|---|---|
| A6 hidden-only permissions | n/a | n/a |
| A8 dead links | n/a | n/a |
| A13 permissive transitions | n/a | n/a |
| **Inconsistent close affordance** (audit `F-HIGH-15`) | Modal = inline button; future surfaces would invent their own | Modal = primitive; future surfaces import the same primitive |

---

## Migration checklist for future consumers

When adding a new dismissible surface (Drawer, Sheet, Tooltip-dismiss,
Command palette, etc.):

1. Import: `import { CloseIconButton } from '@/components/ui';`
2. Place it inside the dialog/panel with `position: absolute` or
   `position: sticky` via the consumer's `className`.
3. Wire `onClose={handleClose}` — handler should match `Modal`'s contract
   (no args, sets `open=false`).
4. Do **NOT** introduce a custom close button — use the primitive to keep
   a11y labels + focus ring + hover-rotate consistent.
5. Add a unit test that asserts `screen.getByRole('button', { name: 'Đóng' })`
   is reachable from inside the surface for the axe-core a11y suite.

---

## Rollback procedure

This story is additive and safe to revert in < 5 minutes:

1. Revert `src/components/ui/modal.tsx` to the inline `<button>...<X/>` form.
2. Optionally delete `src/components/ui/close-icon-button.tsx` and its test
   (no other consumers exist).
3. Revert the `export * from './close-icon-button'` line in
   `src/components/ui/index.ts`.
4. Re-run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

No data migration, no flag toggle, no consumer code beyond `Modal`
relies on the primitive. The pre-A.3 visual treatment is bit-for-bit
identical (same Tailwind classes) so a revert cannot introduce
visual regression.

---

*End of Story A.3 Migration Notes.*