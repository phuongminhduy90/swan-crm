# Story A.4 — Migration Notes: Shared `<Textarea>` Adoption

**Date:** 2026-06-29
**Branch:** `phase-6/sprint-6.1`
**Sprint:** 6.1 — Quick Win Blitz + UI Foundation
**Audit Finding:** F-MED-02

---

## 1. What changed

`src/components/ui/textarea.tsx` was extended (not replaced) with three new capabilities:

| Capability | Prop | Behavior |
|---|---|---|
| `aria-required` | `required?: boolean` | Sets `aria-required="true"` so screen readers announce the field as required. Also passes `required` to the native `<textarea>` for browser-level validation. |
| `aria-invalid` | `error?: string` | Sets `aria-invalid="true"` when an error is present. |
| `aria-describedby` | `error?` / `hint?` | Programmatically links the textarea to the error or hint `<p>` element via `id`-based `aria-describedby`. Screen readers announce the helper text when the field is focused. |

Additionally:
- **Visual `*`** is appended to the label when `required` is true (decorative `<span aria-hidden="true">`).
- **`Math.random()` id replaced with `React.useId()`** for SSR-stable, deterministic IDs.

The `forwardRef<HTMLTextAreaElement>` interface is preserved — `react-hook-form`'s `register()` continues to work.

---

## 2. Files migrated (13 inline `<textarea>` across 8 files)

| File | Field | Before | After | Notes |
|---|---|---|---|---|
| `src/components/tasks/task-form.tsx` | `description` | Raw `<textarea>` + label | `<Textarea label="Mô tả" ...>` | RHF `register('description')`. No error prop (field has no validation). |
| `src/components/services/service-form.tsx` | `description` | Raw `<textarea>` + label + manual `<p>` error | `<Textarea ... error={errors.description?.message}>` | Manual error `<p>` folded into component's `error` prop. |
| `src/components/locations/location-form.tsx` | `note` | Raw `<textarea>` + label + manual `<p>` error | `<Textarea ... error={errors.note?.message}>` | Same as service-form. |
| `src/components/payments/payment-form.tsx` | `note` | Raw `<textarea>` + label + manual `<p>` error | `<Textarea ... error={errors.note?.message}>` | Same. |
| `src/components/followups/followup-form.tsx` | `customerCondition` | Raw `<textarea>` + label | `<Textarea label="Tình trạng khách hàng">` | No error; no validation. |
| `src/components/followups/followup-form.tsx` | `note` | Raw `<textarea>` + label | `<Textarea label="Ghi chú">` | Same. |
| `src/components/followups/followup-form.tsx` | `nextAction` | Raw `<textarea>` + label | `<Textarea label="Hành động tiếp theo">` | Same. |
| `src/components/cases/case-form.tsx` | `salesNote` | Raw `<textarea>` + label | `<Textarea label="Ghi chú kinh doanh">` | No error; notes only. |
| `src/components/cases/case-form.tsx` | `medicalNote` | Raw `<textarea>` + label | `<Textarea label="Ghi chú y tế">` | Same. |
| `src/components/cases/case-form.tsx` | `internalNote` | Raw `<textarea>` + label | `<Textarea label="Ghi chú nội bộ">` | Same. |
| `src/components/payments/payment-confirm-dialog.tsx` | `confirmNote` | Raw `<textarea>` + label | `<Textarea label="Ghi chú (tùy chọn)">` | Controlled (value + onChange). Optional — no `required`. |
| `src/components/payments/payment-confirm-dialog.tsx` | `rejectNote` | Raw `<textarea>` + manual `<span className="text-red-500">*</span>` | `<Textarea label="Lý do từ chối" required error={rejectError}>` | **Required field.** Manual asterisk replaced by component's `required` prop. Manual error `<p>` folded into `error` prop. |
| `src/app/(protected)/calendar/page.tsx` | `createForm.note` | Raw `<textarea>` with **no label** | `<Textarea label="Ghi chú">` | **New label added** ("Ghi chú"). Controlled (value + onChange). |

---

## 3. Style harmonization

Before migration, the inline `<textarea>` elements used two slightly different Tailwind class sets depending on context:

| Variant | Border | Focus ring | Before |
|---|---|---|---|
| A (case-form, followup-form, task-form, calendar) | `border-gray-300` | `focus:ring-2 focus:ring-swan-500/20` | inline classes |
| B (payment-form, payment-confirm-dialog, service-form, location-form) | `border-gray-300` | `focus:ring-2 focus:ring-swan-500/20` | inline classes |

After migration, **all 13 instances** now use the shared `<Textarea>` class set:

```css
border-gray-200  →  focus:border-swan-400  →  focus:ring-4  →  focus:ring-swan-500/15
```

The differences:
- **Border** goes from `border-gray-300` → `border-gray-200` (softer, matching Input component).
- **Focus ring** goes from `ring-2 ring-swan-500/20` → `ring-4 ring-swan-500/15` (slightly more prominent, softer opacity, matching Input component).

This is a **deliberate improvement** — the shared component was already designed with this styling. Existing already-migrated consumers (`customer-form`, `consent-panel`, `attachment-upload-dialog`) already use the shared styling. Migration brings the remaining consumers in line.

**Visual impact:** Very subtle — border is slightly lighter at rest; focus ring is marginally more visible when the field is focused. Both changes are toward the project's premium design system.

---

## 4. Pre-existing consumers (not touched)

Three files already imported and used `<Textarea>` before this story:

- `src/components/customers/customer-form.tsx` — 2 instances (medicalNote, privacyNote)
- `src/components/consents/consent-panel.tsx` — 1 instance (notes)
- `src/components/attachments/attachment-upload-dialog.tsx` — 1 instance (notes)

These files already pass `error={...}` but do **not** yet pass `required` or rely on `aria-describedby`. They will benefit from the new wiring automatically when `required` is added in a future form update.

---

## 5. Rollback

This is a purely additive change (new aria attributes + visual asterisk). No feature flag is needed.

To revert:
1. Restore `src/components/ui/textarea.tsx` from the pre-A.4 commit.
2. Restore each migrated file from the pre-A.4 commit.
3. Delete `src/components/ui/__tests__/textarea.test.tsx`.

No data migration to reverse. Time: < 10 minutes.

---

*End of migration notes.*
