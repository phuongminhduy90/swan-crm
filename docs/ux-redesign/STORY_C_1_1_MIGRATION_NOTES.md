# Story C.1.1 — Migration Notes: Modal / ConfirmDialog close button label

> **Story:** C.1.1 (Sprint 7.1)
> **Plan ref:** [`docs/ux-redesign/SPRINT_7_1_EXECUTION_PLAN.md`](SPRINT_7_1_EXECUTION_PLAN.md) §C.1.1 / §1.1 / §4.1 / §6.1
> **Audit ref:** WCAG 2.4.6 (Headings and labels) — close affordance label
> **Owner:** ui-developer + tech-lead + ux-designer + qa-architect
> **Date:** 2026-07-01

---

## Summary

Story C.1.1 closes the last WCAG 2.4.6 gap on the shared `<Modal>` and
`<ConfirmDialog>` primitives. Until Sprint 7.1, both surfaces rendered the
top-right close icon with a generic `aria-label="Đóng"`. Screen-reader
users therefore heard the same "Đóng" button announcement regardless of
which dialog was open — defeating the WCAG 2.4.6 contract that
interactive controls must announce *what* will happen when activated.

This story:

1. Adds an optional `closeLabel?: string` prop to both primitives.
2. Defaults to the previous generic "Đóng" so every existing consumer
   stays backwards-compatible.
3. Forwards the prop through the existing `<CloseIconButton>` primitive
   (so the visual treatment stays identical — only the screen-reader
   announcement changes).
4. Updates every in-tree consumer (17 `<Modal>` call sites + 9
   `<ConfirmDialog>` call sites) to pass a context-specific label.

No behavior change for sighted / keyboard users — only screen-reader
announcements improve.

---

## Migration guide for future consumers

### `<Modal>`

```tsx
// Before — generic "Đóng"
<Modal open={open} onClose={...} title="Chỉnh sửa khách hàng"> ... </Modal>

// After — screen-reader announcement is now specific
<Modal
  open={open}
  onClose={...}
  title="Chỉnh sửa khách hàng"
  closeLabel="Đóng hộp thoại chỉnh sửa khách hàng"
>
  ...
</Modal>
```

### `<ConfirmDialog>`

```tsx
// Before — synthesized label is generic "Đóng"
<ConfirmDialog
  open={open}
  onClose={...}
  onConfirm={...}
  title="Xóa dịch vụ?"
  description="..."
/>

// After A — synthesize a label from the title (ConfirmDialog does this
// automatically: "Đóng xác nhận — Xóa dịch vụ" once the trailing "?" is
// stripped). No consumer change required.
<ConfirmDialog title="Xóa dịch vụ?" ... />

// After B — explicit per-context override (used when the synthesized
// label needs extra context, e.g. entities like "Đóng hộp thoại phê
// duyệt xóa khách hàng").
<ConfirmDialog
  title="Phê duyệt xóa khách hàng?"
  closeLabel="Đóng hộp thoại phê duyệt xóa khách hàng"
  ...
/>
```

### Copy rules

- Recommend the pattern `Đóng hộp thoại <verb> <noun>` for `<Modal>`.
- Recommend `Đóng hộp thoại <confirmation-verb>` for `<ConfirmDialog>`
  when consumers want the explicit form.
- When consumers skip the explicit prop, `<ConfirmDialog>` falls back to
  `Đóng xác nhận — <title-without-trailing-?>`. This is deterministic and
  always non-empty whenever `title` is non-empty.

---

## Copy inventory (post-migration)

All 17 `<Modal>` + 9 `<ConfirmDialog>` consumers were updated with
context-specific labels. The full list lives in the implementation
report ([`STORY_C_1_1_IMPLEMENTATION_REPORT.md`](STORY_C_1_1_IMPLEMENTATION_REPORT.md) §2).

---

## Rollback

C.1.1 is **additive** — the new `closeLabel` prop is optional and
defaults to the existing `"Đóng"` label. Removing the prop from any
consumer (or reverting the commit) restores the prior screen-reader
announcement without touching any other behavior.

| Rollback step | Action |
|:--------------|:-------|
| 1. Revert commit | `git revert <sha>` |
| 2. Re-run verification | `npm run lint`, `npx tsc --noEmit`, `npx vitest run` |
| 3. Visual smoke | Open any modal / confirm dialog — close button is unchanged |

RTO: < 1 minute. Blast radius: a11y-only (screen reader announcement).
