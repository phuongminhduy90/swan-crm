# Story A.2 — Migration Notes

> **Story:** A.2 — Modal: focus trap + `aria-labelledby` + focus return
> **Sprint:** 6.1
> **Date:** 2026-06-29
> **UX audit finding:** `F-HIGH-12` (Modal lacks focus trap, focus return, and accessible name)
> **Plan:** [SPRINT_6_1_EXECUTION_PLAN.md](./SPRINT_6_1_EXECUTION_PLAN.md) §A.2 (line 33, line 165, line 478)

---

## What changed

This story upgrades a single primitive: `src/components/ui/modal.tsx`. It adds three accessibility behaviors that the existing modal was missing:

1. **Focus trap** — Tab and Shift+Tab now cycle focus among focusable elements inside the dialog panel. Focus cannot escape to the page chrome behind the modal.
2. **Focus-on-open** — When the modal opens, focus is moved to the first focusable element inside the dialog (the built-in close button). If no focusable children exist, focus lands on the dialog panel itself with `tabindex="-1"`.
3. **Focus-return-on-close** — When the modal closes (or unmounts), focus is restored to the element that was focused immediately before the modal opened.
4. **`aria-labelledby`** — The dialog panel now points to the `<h2>` rendered for the `title` prop. Screen readers announce the title as the dialog's accessible name.
5. **`aria-describedby`** — The dialog panel now points to the `<p>` rendered for the `description` prop (when provided). Screen readers announce it as the dialog's accessible description.

---

## Schema / API changes

### `ModalProps` — new optional fields (additive, backward-compatible)

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `titleId` | `string?` | auto-generated | Override the id used on the rendered `<h2>`. Useful when a consumer wants to expose the dialog title to other elements via `aria-labelledby`. |
| `descriptionId` | `string?` | auto-generated | Same as above for the `<p>` description. |

**All other props (`open`, `onClose`, `title`, `description`, `children`, `size`, `className`) are unchanged.**

### Behavior changes (no API impact)

| Before A.2 | After A.2 |
|---|---|
| Tab/Shift+Tab could focus elements behind the dialog (header, sidebar, etc.) | Tab/Shift+Tab cycle inside the dialog; cannot escape |
| Focus stayed on the trigger button when modal opened | Focus moves into the dialog (close button, or first body focusable) |
| Focus was left on `document.body` after close | Focus is restored to the trigger button |
| Dialog had no accessible name (`aria-labelledby` missing) | Dialog has accessible name = dialog title |
| Dialog had no accessible description (`aria-describedby` missing) | Dialog has accessible description = dialog description (when provided) |

---

## Backward compatibility

**Every existing call site works unchanged.** All 12 consumer files (verified via grep — see Implementation Report §3) continue to call `<Modal>` with the same props as before:

```tsx
// Existing call sites — all unchanged
<Modal open onClose={...} title="Tạo khách hàng">...</Modal>
<Modal open onClose={...} title="X" description="Y" size="md">...</Modal>
<Modal open onClose={...} size="sm">...</Modal>  // ConfirmDialog
```

**Silent wins** — every consumer automatically gains:

- A proper accessible name (when a title is provided)
- Focus management (move-in / move-back)
- A focus trap that keeps Tab/Shift+Tab contained

**No regressions** — no existing prop is removed, no existing prop changes type or default. The component's `forwardRef`-less signature is preserved.

---

## Files changed

| File | Change | LOC delta |
|---|---|---|
| `src/components/ui/modal.tsx` | Rewritten in-place: focus-trap logic, focus-on-open, focus-return, `aria-labelledby`/`aria-describedby` wiring, new optional `titleId`/`descriptionId` props | +130 / −25 (≈ +105 net) |
| `src/components/ui/__tests__/modal.test.tsx` | **NEW** — 24 test cases covering render, ARIA, focus-on-open, focus trap, ESC, focus return, backdrop click, body scroll lock, axe-core a11y | +370 (new) |

**No other source file is modified.** The plan's "Preserve backward compatibility" and "Modify only files required by Story A.2" rules are honored. In particular:

- `src/components/ui/confirm-dialog.tsx` — NOT modified. Its `<h3>` lives in the dialog body, so Modal's auto-id `<h2>` does not collide. Its accessible name remains implicit (unchanged from before A.2). A follow-up story can wire `titleId` if needed.
- 10 consumer files (calendar, tasks, cases, customers, settings pages, payment-confirm, attachment-upload, consent-panel) — NOT modified. They continue to pass only `title`/`description` and silently gain the new behavior.

---

## Migration for consumers (optional)

If a consumer wants to override the auto-generated id (e.g. to share it with another element via `aria-controls`):

```tsx
<Modal
  open
  onClose={...}
  title="Tạo khách hàng"
  titleId="customer-modal-title"  // NEW, optional
>
  ...
</Modal>
```

If a consumer wants to render their own `<h2>` outside the Modal (e.g. for layout reasons), they can omit the `title` prop and pass `titleId` pointing to their external heading:

```tsx
<>
  <h2 id="my-title" className="sr-only">My Dialog Title</h2>
  <Modal open onClose={...} titleId="my-title">
    ...
  </Modal>
</>
```

In this case, Modal wires `aria-labelledby="my-title"` to the dialog panel without rendering its own `<h2>` (because `title` is falsy).

---

## Consumer verification checklist

For each of the 12 existing Modal consumers, manual smoke:

1. Open the modal — verify the first focusable (typically the close button or first input) receives focus on open.
2. Press Tab repeatedly — verify focus cycles inside the modal and does NOT escape to the page header/sidebar.
3. Press Shift+Tab from the first focusable — verify focus wraps to the last focusable.
4. Press Esc — verify modal closes AND focus returns to the trigger button.
5. Open DevTools → inspect the dialog panel → confirm `aria-labelledby` points to the `<h2>` (or to consumer-provided id).

No consumer code change is required for any of these to work.

---

*End of Story A.2 Migration Notes.*