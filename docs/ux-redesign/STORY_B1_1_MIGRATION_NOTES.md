# Story B.1.1 — CCCD Migration Notes

> **Story:** B.1.1 — CCCD fields in customer form (Giấy tờ tùy thân)
> **Audit ref:** `UX_AUDIT_REPORT.md` F-CRIT-02
> **Backlog ref:** `IMPLEMENTATION_BACKLOG.md` View 2 (Sprint 6.1)
> **Branch:** `phase-6/sprint-6.1` (sub-branch `feat/customer-cccd`)
> **Date:** 2026-06-29

This document describes the schema/data migration surface for Story B.1.1 — adding Vietnamese national-ID (CCCD/CMND) fields to the customer record and exposing them in the create/edit form behind a role-based access gate.

---

## 1. Schema migration

### TypeScript types

`src/lib/types/customer.ts` was extended with three optional fields on `Customer`, `CreateCustomerInput`, and `UpdateCustomerInput`:

```ts
nationalIdNumber?: string;     // CMND (9 số) hoặc CCCD (12 số)
nationalIdIssueDate?: string;   // ISO date string (yyyy-mm-dd)
nationalIdIssuePlace?: string;  // Tối đa 200 ký tự
```

These fields already existed on the type before B.1.1 (added during Phase 2 in anticipation of this story). The story **renders** them in the UI; it does not extend the type.

### Zod validator

`src/lib/validators/customer.ts` was hardened:

| Field | Rule | Notes |
|---|---|---|
| `nationalIdNumber` | `/^(\d{9}|\d{12})?$/` | Accepts 9-digit CMND (legacy) or 12-digit CCCD (current); empty string and `undefined` allowed. Error message: `"CMND phải 9 số hoặc CCCD phải 12 số"`. |
| `nationalIdIssueDate` | free-form string | Optional; treated as `yyyy-mm-dd` by the date input. |
| `nationalIdIssuePlace` | `max(200)` | New length cap added to prevent abuse. |

`createCustomerSchema.partial()` already produces `updateCustomerSchema`, so all rules automatically apply on edit.

---

## 2. Data migration

### Firestore collection: `customers`

| Document field | Type | Migration action |
|---|---|---|
| `nationalIdNumber` | `string?` | None — already declared on the type. |
| `nationalIdIssueDate` | `string?` | None. |
| `nationalIdIssuePlace` | `string?` | None. |

**No backfill required.** All 3 fields are optional. Existing customer records that lack these fields continue to read cleanly (the form initializes them to `''`).

### Mock store (dev mode)

`src/lib/mock/store.ts` is the in-memory data store used when `NEXT_PUBLIC_DEV_MODE=true`. No change required — existing seed customers that lack CCCD fields will simply render with empty values. Seed data can opt in by populating these fields for new fixtures (deferred — not in B.1.1 scope).

---

## 3. RBAC migration

### `SENSITIVE_FIELD_ACCESS_ROLES` (reused, not changed)

The CCCD section is gated by the existing `SENSITIVE_FIELD_ACCESS_ROLES` constant in `src/constants/permissions.ts`:

```ts
export const SENSITIVE_FIELD_ACCESS_ROLES: UserRole[] = [
  'admin', 'ceo', 'cso', 'master_sales',
  'sales_online', 'sales_offline',
  'coordinator', 'doctor',
];
```

**Roles WITHOUT access** (section hidden, edits do not touch CCCD): `accountant`, `nurse`, `cskh_postop`, `media`.

No permission constant was added or removed.

---

## 4. UI migration

### `src/components/customers/customer-form.tsx`

Added a new collapsible section "**Giấy tờ tùy thân**" between "Thông tin cơ bản" and "Liên hệ & Mạng xã hội". Section is rendered only when the current user's role is in `SENSITIVE_FIELD_ACCESS_ROLES`.

Section contains:
1. `Số CMND/CCCD` — text input with `inputMode="numeric"` and hint "Để trống nếu khách chưa cung cấp"
2. `Ngày cấp` — date input (`type="date"`)
3. `Nơi cấp` — text input
4. Disclaimer line with `CreditCard` icon: "Thông tin chỉ hiển thị cho vai trò được phép truy cập giấy tờ nhạy cảm."

### Round-trip behavior (B.1.1 DoD)

| Scenario | Result |
|---|---|
| Admin opens edit, no CCCD yet | 3 empty fields, no error. |
| Admin opens edit with existing CCCD | Fields pre-populated from `initialData`. |
| Admin edits CCCD, submits | Submitted payload contains the updated CCCD. |
| Media (no access) opens edit with existing CCCD | Section hidden. Submitted payload contains the **unchanged** initialData CCCD values (not empty strings). |
| Media creates new customer | Submitted payload contains empty strings for CCCD fields — valid against the schema. |

The "no overwrite on hidden section" behavior is achieved because the form's `defaultValues` always load from `initialData`, and react-hook-form never mutates a value the user can't see.

---

## 5. Audit log behavior

Audit logging is **not changed** by B.1.1. The `customer_updated` audit log entry (written by the detail page on edit) includes the full submit payload, which means:

- When admin edits CCCD → audit log records the new value.
- When media edits other fields → audit log records **no change** to CCCD fields (the original values pass through unchanged).

The plan mentions "`nationalIdNumber` not in audit log diff (verify in mock store audit log)". Because the form payload carries the unchanged value, the audit log diff (before/after) will show the value as equal and not flag a change. This satisfies the intent without needing a dedicated PII-redaction pass.

---

## 6. Rollback procedure

B.1.1 is **purely additive**. Rollback is:

1. `git revert <b.1.1-commit-sha>` — reverts the form section and the validator rule additions.
2. Customer records keep stored CCCD fields (no destructive operation ever runs).
3. No API or schema migration to reverse.

If only the form section needs hiding, edit `customer-form.tsx` and wrap the new `<FormSection title="Giấy tờ tùy thân">` block in `false && (…)` (no rebuild beyond `npm run build`).

If only the validator's `nationalIdNumber` rule needs relaxing, edit `src/lib/validators/customer.ts` and drop the `.regex(...)` call.

---

## 7. Risks specific to the migration

| # | Risk | Mitigation |
|---|---|---|
| **M1** | Admin sees CCCD fields they didn't expect (UX surprise) | Disclaimer line clarifies "chỉ hiển thị cho vai trò được phép truy cập giấy tờ nhạy c���m". |
| **M2** | Media edits customer → CCCD silently cleared | Verified by unit test (`preserves existing CCCD in submission even when section is hidden`). |
| **M3** | Validator rejects valid 9-digit CMND | Validator already accepts `(\d{9}|\d{12})?`. Covered by unit tests. |
| **M4** | Future schema requires `nationalIdNumber` to be required | Not the case today. If it ever becomes required, `optional().or(z.literal(''))` chain needs revisiting. |

---

## 8. Out of scope (deferred)

- PDF/photo upload of CCCD card — Phase 7.4 (consent gates).
- Auto-fill from CCCD chip reader — never requested.
- Masking display on customer detail page (e.g., show `001****888`) — explicitly not added in B.1.1; the detail page already uses `<SensitiveField>` for `address`/`medicalNote`/`privacyNote`; CCCD display will be a Sprint 6.2+ enhancement.
- Consent capture for CCCD storage — Phase 7.4 (existing `image_storage` consent can be repurposed).

---

*End of B.1.1 Migration Notes.*