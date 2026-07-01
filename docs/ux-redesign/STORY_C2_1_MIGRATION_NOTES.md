# Story C.2.1 — `<CurrencyInput>` Migration Notes

> **Story:** C.2.1 — VND thousand-separator input primitive (F-HIGH-08)
> **Sprint:** 7.2 — Payment Integrity & Currency Hardening
> **Author:** FE-1 (Sprint 7.2)
> **Date:** 2026-07-01
> **Status:** ✅ Complete (this sprint — PI-5 / A10 catalog extension ships alongside)

This note explains how existing call sites migrate from raw `<input type="number">` (or hand-rolled number-input markup) to the new `<CurrencyInput>` primitive. It is intended for any future contributor who opens one of the touched forms and wonders why the markup changed.

---

## 1. What changed at a glance

| Area | Before | After |
|:-----|:-------|:------|
| **New primitive** | none — call sites used raw `<input type="number">` or ad-hoc markup | `src/components/ui/currency-input.tsx` |
| **Thousand separators** | none — accountant types `1500000` verbatim | display: `1.500.000` (vi-VN dotted); raw digits on focus |
| **Negative prevention** | browser-native (browsers ignore `-` on `min={0}`, but the field still accepts `e+10` and other non-digit input) | hard-blocked at `onKeyDown`; paste is sanitized; `-` never reaches value |
| **Decimal prevention** | none — VN accountants sometimes type `500.5` by reflex | blocked (`type="text"`, `inputMode="numeric"`); the `,` and `.` keys are no-ops |
| **Paste** | accepts comma/period in unpredictable ways — `1,500,000` silently became `1.5` in `<input type="number">` | sanitized — all non-digits stripped regardless of separator convention (`1,500,000` and `1.500.000` both paste to `1500000`) |
| **Form value** | `string` by default; requires `{ valueAsNumber: true }` RHF register option | `number` directly; no `{ valueAsNumber: true }` flag |
| **Read-only display** | `{formatCurrency(n)}` next to a hidden state | the same `{formatCurrency(n)}` — read-only displays don't need `<CurrencyInput>` (it's for input, not display) |

---

## 2. Migration pattern

### 2.1 React Hook Form — the controlled-value pattern

`<CurrencyInput>` exposes a numeric `value` / `onChange: (n: number) => void` API, **not** the React change-event API. This means `register('amount', { valueAsNumber: true })` will not work — it passes an event-style onChange.

Instead, wire the field through RHF's `<Controller>`:

```tsx
// BEFORE
<Input
  type="number"
  min={0}
  {...register('amount', { valueAsNumber: true })}
/>
```

```tsx
// AFTER
<Controller
  control={control}
  name="amount"
  render={({ field, fieldState }) => (
    <CurrencyInput
      label="Số tiền (VNĐ)"
      value={typeof field.value === 'number' ? field.value : 0}
      onChange={(num) => field.onChange(num)}
      onBlur={field.onBlur}
      error={fieldState.error?.message}
    />
  )}
/>
```

Why `<Controller>` instead of `register`? `<CurrencyInput>` calls `onChange(value)` rather than `onChange(event)` — so RHF's `{ valueAsNumber: true }` adapter (which expects an event) silently drops the value. `<Controller>` is the canonical RHF bridge for any custom input whose onChange signature diverges from a native event.

**The `typeof field.value === 'number'` guard handles the brief render window where RHF stores the field as `undefined` (during initial value resolution) — without the guard TypeScript will complain about `number | undefined` flowing into a primitive.**

### 2.2 Adding a label / accessibility

`<CurrencyInput>` supports the same accessibility contract as `<Textarea>` and `<Input>`:

| Prop | Behavior |
|:-----|:---------|
| `label` | Renders `<label htmlFor>` and wires `aria-required` / required asterisk on. |
| `aria-label` | Used as fallback when no `label` is provided. |
| `required` | Adds the red asterisk AND `aria-required="true"`. |
| `error` | Sets `aria-invalid="true"`, draws red border, renders `<p role="alert">` linked via `aria-describedby`. |
| `hint` | Renders helper paragraph linked via `aria-describedby` when no error. |
| `disabled` | Greyed-out styling and native disabled behavior. |

```tsx
<CurrencyInput
  label="Đặt cọc ngay"
  value={amountPaid}
  onChange={setAmountPaid}
  hint="Có thể đặt cọc nhiều lần"
  className="h-9 w-44 text-right"
/>
```

### 2.3 Read-only display — do NOT use `<CurrencyInput>`

Existing read-only displays (e.g. payment rows, case-detail summaries, reports stat cards) continue to use the regular text-formatting pattern:

```tsx
import { formatCurrency } from '@/lib/utils/format';

// Use formatCurrency for read-only display — DO NOT swap to CurrencyInput
<span className="text-sm font-semibold text-swan-700">
  {formatCurrency(payment.amount)}
</span>
```

`<CurrencyInput>` is an interactive primitive. Wrapping it in a non-editable container would introduce focus styles, an asterisk slot, and error wiring that the data doesn't need.

---

## 3. Call-site reference (Sprint 7.2)

| File | Field | Story | Notes |
|:-----|:------|:------|:------|
| `src/components/payments/payment-form.tsx` | `amount` | C.2.1 | Replaced `<Input type="number" ... valueAsNumber />` with `<Controller>+<CurrencyInput>`. Reused existing schema validation (`>= 1 VNĐ, <= 10 tỷ`). |
| `src/components/cases/case-form.tsx` | `discountValue` | C.2.1 | Same swap. The label dynamically renders as `Giá trị (%)` or `Giá trị (VNĐ)` per `discountType`. Percent-mode still respects 0-100 by downstream `totalBillAfterDiscount` math. |
| `src/components/cases/case-form.tsx` | `amountPaid` | C.2.1 | Smaller-slot variant (`w-44 text-right`); same `<Controller>` bridge. |

Future migrations (out of scope here, deferred to consuming stories):
- `src/components/services/service-form.tsx` — `defaultPrice` field (when Sprint 7.5 lands service pricing)
- `src/components/treatments/*` — any VND-typed fields added later

---

## 4. UX rules (apply whenever you adopt `<CurrencyInput>`)

1. **Always provide a label.** Screen readers need a programmatic association; visual labels also help the accountant notice an empty field.
2. **Always wire `error`.** When `error` is non-empty, the input shows red border + `aria-invalid="true"` + `<p role="alert">` text.
3. **Always set `value={0}` or `value={n}` (a number).** `undefined` is treated as "empty"; the guard `typeof field.value === 'number' ? field.value : 0` inside `<Controller>` is your safety net.
4. **Do not mix with `register()`.** Use `<Controller>` exclusively. Mixing the two causes the value to never commit (RHF's `{ valueAsNumber: true }` adapter drops the non-event onChange call).
5. **Do not use `type="number"` on the input.** `<CurrencyInput>` always renders `type="text"` + `inputMode="numeric"` to enable mobile numeric keyboards while still rejecting bad input at JS level.
6. **Paste is sanitized, not rejected.** A paste of `1,500,000` becomes `1500000` silently — the user never sees an error toast for ambiguous separators.

---

## 5. Anti-pattern context

This story closes **anti-pattern A10** (raw numeric inputs for currency) — see `scripts/check-anti-patterns.sh` A10 regex from PI-5 (also closed in Sprint 7.2). The grep gate looks for `<input ... type="number" ... (currency|amount|price|VNĐ|tiền)` in `src/components/` to block regressions.

If you later revert a `<CurrencyInput>` back to `<input type="number">`, you will hit the A10 gate at pre-commit. The recovery action is documented in `CONTRIBUTING.md`.

---

## 6. What did NOT change

- `src/lib/validators/payment.ts` schema — `amount` is still `z.number().min(1).max(10_000_000_000)`. `<CurrencyInput>` emits raw integers; the validation continues to apply on submit.
- `src/lib/firestore/payments.ts` — downstream code still receives `Payment.amount` as `number`. No backend / API changes.
- `src/components/ui/input.tsx`, `textarea.tsx`, `select.tsx` — siblings primitives untouched. `<CurrencyInput>` joins the family; it does not replace any existing primitive.
- `src/lib/utils/format.ts` — `formatCurrency(n)` still produces `"1.500.000 VNĐ"` and is used everywhere read-only. `<CurrencyInput>` uses `formatVNDInput(n)` internally for the unsuffixed `"1.500.000"` display.

---

## 7. Rollback

Rollback is a 3-step string swap:

1. `git revert <c2.1-commit-sha>` (or `git revert <sha>` for the smallest commit that introduces `<CurrencyInput>`).
2. Restore the old `<Input type="number" min={0} ... />` markup in `payment-form.tsx` and the 2 spots in `case-form.tsx`.
3. Restart the dev server.

`<CurrencyInput>` is **not** behind a feature flag. It is shipping as the default payment-amount primitive. Rollback revert is non-destructive to data — the rendered DOM event signatures differ but the value semantics (integer >= 0) are preserved.

---

## 8. Files touched (Sprint 7.2 commit boundary)

| File | Change | LOC |
|:-----|:-------|----:|
| `src/components/ui/currency-input.tsx` | NEW — primitive + helpers `formatVNDInput` / `parseVNDInput` | +283 |
| `src/components/ui/__tests__/currency-input.test.tsx` | NEW — 56 tests across 12 describe blocks | +528 |
| `src/components/payments/payment-form.tsx` | Swap `<Input type="number" amount>` → `<Controller>+<CurrencyInput>` | +13 / −7 |
| `src/components/cases/case-form.tsx` | Swap `discountValue` and `amountPaid` raw inputs → `<Controller>+<CurrencyInput>` | +20 / −12 |

No changes to validators, mock data, API routes, or other UI primitives.

---

*End of Story C.2.1 Migration Notes.*
