# Story A.4 — Implementation Report

**Date:** 2026-06-29
**Branch:** `phase-6/sprint-6.1`
**Story:** A.4 — Shared `<Textarea>` adoption + `aria-required`
**Audit Finding:** F-MED-02
**Owner:** FE-2
**Status:** ✅ Complete

---

## 1. Files changed

### Created (2 files)
- `src/components/ui/__tests__/textarea.test.tsx` — 19 vitest tests across 7 describe blocks (render, aria attributes, required indicator, error styling, forwards ref, controlled usage, axe-core a11y).
- `docs/ux-redesign/STORY_A4_MIGRATION_NOTES.md` — per-file migration mapping + style harmonization notes.

### Modified (10 files)
- `src/components/ui/textarea.tsx` — extended with `useId`, `aria-required`, `aria-invalid`, `aria-describedby`, error/hint ids, required asterisk. `Math.random()` id generation replaced with `React.useId()`.
- `src/components/tasks/task-form.tsx` — migrated `description` textarea (1).
- `src/components/services/service-form.tsx` — migrated `description` textarea (1).
- `src/components/locations/location-form.tsx` — migrated `note` textarea (1).
- `src/components/payments/payment-form.tsx` — migrated `note` textarea (1).
- `src/components/followups/followup-form.tsx` — migrated 3 textareas (`customerCondition`, `note`, `nextAction`).
- `src/components/cases/case-form.tsx` — migrated 3 textareas (`salesNote`, `medicalNote`, `internalNote`).
- `src/components/payments/payment-confirm-dialog.tsx` — migrated 2 controlled textareas (`confirmNote`, `rejectNote`). Reject note now uses `required` prop instead of manual asterisk span.
- `src/app/(protected)/calendar/page.tsx` — migrated `createForm.note` controlled textarea + added previously-missing "Ghi chú" label.

**Total: 13 inline `<textarea>` elements migrated to the shared component.** Grep verification (`grep -rn "<textarea" src/`) confirms zero remaining instances outside `src/components/ui/textarea.tsx`.

### Documentation
- `docs/ux-redesign/STORY_A4_IMPLEMENTATION_REPORT.md` — this file.

---

## 2. Tests executed

| Command | Result |
|---|---|
| `npm run test` | ✅ **64/64 pass** across 3 test files (`tabs.test.tsx`: 21, `modal.test.tsx`: 24, `textarea.test.tsx`: 19). The 19 new Textarea tests cover: render, label association, hint rendering, aria-required (true/false), aria-invalid (true/false), aria-describedby → error element, aria-describedby → hint element, hint-vs-error precedence, custom `id` propagation, auto-generated id format, required asterisk presence/absence, red border styling, `forwardRef` for RHF compatibility, controlled onChange, axe-core violations on basic render + on required+error render. |
| `npx tsc --noEmit` | ✅ **0 errors** |
| `npm run lint` | ✅ **0 warnings** |
| `npm run build` | ✅ **Compiled successfully** — 34 routes, no errors. |
| `grep -rn "<textarea" src/` | ✅ Only matches `src/components/ui/textarea.tsx:43` (the shared component) and one literal string inside `textarea.test.tsx:134`. Zero inline `<textarea>` remaining in `src/components` or `src/app`. |

### Anti-pattern checks (per SPRINT_6_1_EXECUTION_PLAN §8.3)
- A6 (hidden-only permissions) — N/A; A.4 is a form primitive, not RBAC.
- A13 (permissive transitions) — N/A; A.4 is not a state machine.
- A22 (modal for 22-field form) — N/A; A.4 does not introduce any new modal usage.

---

## 3. Risks introduced

| # | Risk | Severity | Mitigation applied |
|---|---|---|---|
| **R1** | Style harmonization changes the visual appearance of migrated fields (`border-gray-300` → `border-gray-200`, `focus:ring-2 ring-swan-500/20` → `focus:ring-4 ring-swan-500/15`). | 🟢 Low | Documented in `STORY_A4_MIGRATION_NOTES.md §3`. Direction is **toward** the shared design system, matching `<Input>`, already-migrated `<Textarea>` consumers, and the rest of the premium theme. No expected user impact. |
| **R2** | `useId()` instead of `Math.random()` — IDs now collide if two `<Textarea>` instances mount in the same React tree without separation. | 🟢 Low | `useId()` produces React-tree-unique IDs across an entire subtree — the only collision vector is when the SAME `useId()` instance renders two `<textarea>` elements, which never happens in the Textarea component (one base id per instance). jsdom tests confirm. |
| **R3** | `aria-required={undefined}` could potentially render `aria-required="false"` on the DOM. | 🟢 Low | React's standard attribute serialization omits attributes whose value is `undefined`. Verified by test: when `required` is not set, `aria-required` is absent (not `"false"`). |
| **R4** | Required reject note in `payment-confirm-dialog.tsx` — moving the asterisk into the component changes its position in the DOM (from inside the manually-constructed label to inside the component-rendered label). | 🟢 Low | Visually identical (still a red `*` immediately after the label text). The `aria-hidden="true"` on the asterisk means screen readers won't double-announce. Test verifies the required asterisk exists with the correct class. |
| **R5** | Calendar `createForm.note` previously had no `<label>` — adding one now associates the textarea with "Ghi chú". | 🟢 Low | A11y **improvement** (previously the textarea was unlabelled). ui-designer should confirm the label position is acceptable in the appointment-creation modal. |
| **R6** | `react-hook-form` consumers continue to work because `register()` returns `{name, onChange, onBlur, ref}` and the component spreads `{...props}` last. The `required` attribute is now also set from `props.required`, which RHF does not pass — so the consumer's `required` is honored if they pass it explicitly. | 🟢 Low | None of the migrated RHF forms currently pass `required` to the textarea — all are optional note fields. The wiring is forward-compatible for future required fields. |

**Net new risk:** Very low. This is an additive accessibility improvement with style harmonization. No data migration, no permission change, no API change.

---

## 4. Rollback steps

### Single-commit rollback (preferred)

```bash
git revert <a.4-commit-sha>
```

This restores every modified file and removes the new test file.

### Surgical rollback (if commit is squashed into a larger commit)

```bash
# 1. Restore the Textarea primitive
git checkout HEAD~1 -- src/components/ui/textarea.tsx

# 2. Restore each migrated form
git checkout HEAD~1 -- \
  src/components/tasks/task-form.tsx \
  src/components/services/service-form.tsx \
  src/components/locations/location-form.tsx \
  src/components/payments/payment-form.tsx \
  src/components/followups/followup-form.tsx \
  src/components/cases/case-form.tsx \
  src/components/payments/payment-confirm-dialog.tsx \
  "src/app/(protected)/calendar/page.tsx"

# 3. Remove the new test file
rm src/components/ui/__tests__/textarea.test.tsx

# 4. Verify clean state
npx tsc --noEmit && npm run lint && npm run test && npm run build
```

### Feature flag

**Not required.** A.4 is purely additive — no permission change, no API change, no data migration. The new `aria-*` attributes and visual asterisk are backward-compatible (i.e., removing them is functionally invisible to users with full vision and improves accessibility for those without).

### Time to rollback

< 10 minutes.

### Data impact

None.

---

## 5. Definition of Done — Final Status

Per `SPRINT_6_1_EXECUTION_PLAN.md` §8.2 row A.4:

- [x] `src/components/ui/textarea.tsx` renders `aria-required="true"` when `required` is set → covered by test "sets aria-required=\"true\" when required is true and omits it when false"
- [x] `aria-invalid="true"` when `error` is set → covered by test "sets aria-invalid=\"true\" when error is provided and omits it otherwise"
- [x] `aria-describedby` points to the error element → covered by test "wires aria-describedby to the error element when error is present"
- [x] `aria-describedby` points to the hint element (when no error) → covered by test "wires aria-describedby to the hint element when hint is present and no error"
- [x] Visual `*` rendered after label when `required` → covered by test "renders a red asterisk after the label when required is true"
- [x] Zero inline `<textarea>` outside `src/components/ui/textarea.tsx` (grep-verified)
- [x] `src/components/ui/__tests__/textarea.test.tsx` exists with all described cases + axe-core block
- [x] `npx tsc --noEmit` → 0 errors
- [x] `npm run lint` → 0 warnings
- [x] `npm run build` → 34 routes, 0 errors
- [x] `STORY_A4_MIGRATION_NOTES.md` and `STORY_A4_IMPLEMENTATION_REPORT.md` exist in `docs/ux-redesign/`

---

## 6. What ships to users

For every form on the system that uses a textarea (customer edit, case edit, followup update, task create, payment create, payment confirm/reject, appointment create, service edit, location edit):

- **Screen reader users** now hear "required" when focusing a required textarea (none currently, but the wiring is in place for future use), and hear error or hint text after the field label.
- **All users** see consistent border + focus styling across every textarea — matching `<Input>` and the shared design system.
- **Reject payment flow** (`payment-confirm-dialog`) — the required asterisk is now rendered by the component (was previously a hand-rolled `<span>`), making it consistent with every other required field in the app.

No breaking changes. No new flows. Pure accessibility + visual quality upgrade.

---

*End of implementation report.*