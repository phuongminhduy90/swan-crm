# Story B.1.1 — Implementation Report

> **Story:** B.1.1 — CCCD fields in customer form (Giấy tờ tùy thân)
> **Audit ref:** `UX_AUDIT_REPORT.md` F-CRIT-02
> **Backlog ref:** `IMPLEMENTATION_BACKLOG.md` View 2 (Sprint 6.1)
> **Branch:** `phase-6/sprint-6.1` (sub-branch `feat/customer-cccd`)
> **Date:** 2026-06-29
> **Owner:** FE-2

---

## 1. Scope

Implement the customer-form UI for Vietnamese national-ID (CMND/CCCD) capture, gated by `SENSITIVE_FIELD_ACCESS_ROLES`. Validate that fields round-trip correctly through create/edit flows, that roles without access do not overwrite existing data, and that the existing customer workflow remains unchanged.

### In scope
- New "Giấy tờ tùy thân" section in `customer-form.tsx` with 3 fields.
- RBAC gate using existing `SENSITIVE_FIELD_ACCESS_ROLES` constant.
- Tightened Zod validator (12-digit / 9-digit pattern already in place; added `max(200)` on `nationalIdIssuePlace`).
- Unit tests for validator + component (RBAC visibility + round-trip persistence).
- Story docs (migration notes + this report).

### Out of scope (per plan)
- Changes to `src/lib/types/customer.ts` (fields already exist).
- Changes to firestore-side customer writes.
- Detail-page display of CCCD (uses existing `<SensitiveField>`; CCCD display will be a 6.2+ enhancement).
- CCCD upload / chip-reader / consent capture.
- Stories A.1–A.5, B.1.2–B.3.3 (handled by other agents/stories).

---

## 2. Files changed

| File | Change | Lines |
|---|---|---|
| `src/lib/validators/customer.ts` | Modified — added `max(200)` cap on `nationalIdIssuePlace`; added comment block explaining CCCD rules. | +10 |
| `src/components/customers/customer-form.tsx` | Modified — added `useCurrentUser` + RBAC gate, new "Giấy tờ tùy thân" `<FormSection>` with 3 inputs + disclaimer. Imports `CreditCard` from lucide-react. | +40 |
| `src/lib/validators/__tests__/customer.test.ts` | **Created** — 20 unit tests covering pattern acceptance/rejection, length cap, round-trip. | +158 |
| `src/components/customers/__tests__/customer-form.test.tsx` | **Created** — 14 component tests covering RBAC visibility (8 roles) + round-trip persistence + section interactions. | +191 |
| `STORY_B1_1_MIGRATION_NOTES.md` | **Created** — schema, RBAC, audit, rollback notes. | n/a |
| `STORY_B1_1_IMPLEMENTATION_REPORT.md` | **Created** — this file. | n/a |

**Total files touched: 6 (2 modified, 4 created).**

No `src/lib/firestore/customers.ts` change — existing CRUD already passes the form payload through unchanged.

---

## 3. Implementation details

### 3.1 RBAC gate

```tsx
const { user } = useCurrentUser();
const canViewSensitive = !!user && SENSITIVE_FIELD_ACCESS_ROLES.includes(user.role);
```

The section is rendered conditionally:

```tsx
{canViewSensitive && (
  <FormSection title="Giấy tờ tùy thân">
    {/* 3 inputs */}
  </FormSection>
)}
```

When `canViewSensitive` is `false`, the section is **not** in the DOM, so screen readers and `queryByLabelText` both correctly skip the fields.

### 3.2 Default values preserve existing data

The `defaultValues` block in `useForm` always loads `initialData?.nationalIdNumber ?? ''`. When the section is hidden, react-hook-form never receives a user mutation on that field, so the submit payload contains the original value (or `''` for new records).

This is verified by the `preserves existing CCCD in submission even when section is hidden (no overwrite)` test.

### 3.3 Icon swap

The plan referenced an `IdCard` icon. `lucide-react@0.311.0` does not export `IdCard`; `CreditCard` was used instead. Same visual intent (a card-shaped icon denoting official document).

### 3.4 Validator hardening

The CCCD regex `/^(\d{9}|\d{12})?$/` was already correct from Phase 2 (accepts 9-digit CMND legacy or 12-digit CCCD current). Story B.1.1 added:

- `max(200)` cap on `nationalIdIssuePlace` to prevent abuse via 1MB paste.
- Inline comment explaining the rules and story context.

---

## 4. Tests executed

| Test file | Coverage | Result |
|---|---|---|
| `src/lib/validators/__tests__/customer.test.ts` | Pattern: empty/undefined/9-digit/12-digit; rejection: 8/10/13-digit; letters; dashes/spaces. Date & place accept empty + length cap. Round-trip all 3 fields. Update schema partial validation. **20 tests** | ✅ all pass |
| `src/components/customers/__tests__/customer-form.test.tsx` | RBAC: section visible for admin/sales_online/doctor; hidden for media/accountant/cskh_postop/nurse/null user. Persistence: initialData round-trip; admin can edit; media cannot overwrite existing values. UI: hint + disclaimer + cancel. **14 tests** | ✅ all pass |

### Full suite re-run

```
Test Files  7 passed (7)
     Tests  124 passed (124)
```

No existing tests broken.

---

## 5. Lint, typecheck, build

| Gate | Command | Result |
|---|---|---|
| Lint | `npm run lint` | ✅ `No ESLint warnings or errors` |
| Typecheck | `npm run typecheck` (alias `tsc --noEmit`) | ✅ no errors |
| Build | `npm run build` | ✅ `Compiled successfully`, 34 routes, no warnings |

---

## 6. Risks introduced

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| **R1** | Other callers of `createCustomerSchema` may be surprised by the new `max(200)` rule on `nationalIdIssuePlace` (would reject 200+ char inputs). | Low | Low | No callers currently set this field to >200 chars; audit log payloads are JSON-stringified and not affected. |
| **R2** | The `useCurrentUser` hook reads from `AuthProvider` which in dev mode returns a mock user. Tests mock the hook directly, but production behaviors may differ if `user.role` is undefined for an authenticated user. | Low | Low | `canViewSensitive` guards on `!!user` first, so unauthenticated users see the section hidden. |
| **R3** | Future schema addition of `nationalIdNumber` as required would break the "hidden section" no-overwrite guarantee (default `''` would no longer be valid). | Very low | Medium | Out of scope for B.1.1; if required status is added, the form's `defaultValues` for restricted roles must be lifted out of the section into a hidden controlled input. |
| **R4** | The `CreditCard` icon (lucide-react) may render slightly differently from the originally intended `IdCard`. | Very low | Cosmetic | Visual diff accepted; ui-designer can swap to a custom SVG in a later polish pass if needed. |

None of the risks above are regressions to existing customer flow. No unrelated customer logic was touched.

---

## 7. Rollback steps

### Quick rollback (single PR revert)

```bash
git revert <b.1.1-merge-sha>
git push origin phase-6/sprint-6.1
```

This reverts both code changes (form section + validator cap) and both test files in a single commit. No data migration reverses needed.

### Surgical rollback (keep tests, revert form section)

If you want to keep the validator hardening but hide the form section temporarily:

1. Edit `src/components/customers/customer-form.tsx`.
2. Wrap the `{canViewSensitive && (<FormSection title="Giấy tờ tùy thân">…</FormSection>)}` block in `{false && …}` (or remove the `&&` clause).
3. Optionally remove the `useCurrentUser` + `SENSITIVE_FIELD_ACCESS_ROLES` imports.
4. `npm run build`.

No Firestore data is lost; the 3 fields stay defined on the type but the form never accepts input for them.

### Validator-only rollback

Edit `src/lib/validators/customer.ts` and remove the `.max(200, 'Nơi cấp tối đa 200 ký tự')` line. The original Phase 2 regex stays in place — only the new cap reverts.

---

## 8. Definition-of-Done checklist

| Criterion | Status |
|---|---|
| "Giấy tờ tùy thân" section renders with 3 fields | ✅ |
| Fields persist round-trip (admin edit + reload) | ✅ (test: `admin can update CCCD field and submit reflects the change`) |
| Section hidden for roles not in `SENSITIVE_FIELD_ACCESS_ROLES` | ✅ (tests for `media`, `accountant`, `cskh_postop`, `nurse`, `null` user) |
| `nationalIdNumber` not in audit log diff when section is hidden | ✅ (verified by persistence test — submit payload carries unchanged value, diff = empty) |
| Validator: 9-digit CMND accepted | ✅ |
| Validator: 12-digit CCCD accepted | ✅ |
| Validator: invalid lengths/digits rejected | ✅ |
| Existing customer form behavior preserved | ✅ (verified by full test suite — 124 tests pass) |
| `npx tsc --noEmit` → 0 errors | ✅ |
| `npm run lint` → 0 warnings | ✅ |
| `npm run build` → 0 errors | ✅ |
| `npm run test` → all green | ✅ (124/124) |
| Migration notes file | ✅ (`STORY_B1_1_MIGRATION_NOTES.md`) |
| Implementation report file | ✅ (this file) |

---

## 9. Known gaps for downstream stories

| Gap | Owned by |
|---|---|
| Display CCCD values on `/customers/[id]` detail page (currently the detail page does not render CCCD at all). | B.2.x — Sprint 6.2+ enhancement |
| Consent gate before CCCD is persisted. | 7.4 (consent gates) |
| PII redaction in audit log diff. | 6.2 (F-MED-17) |
| Auto-fill from CCCD chip reader. | Out of scope — not requested |
| Required vs optional toggle for `nationalIdNumber`. | Product decision — currently optional |

---

*End of B.1.1 Implementation Report.*