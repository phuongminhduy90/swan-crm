# Story B.2.3 — Migration Notes

> **Story ID:** B.2.3 (F-MED-17)
> **Sprint:** 6.2
> **Owner:** FE-1
> **Branch:** `phase-6/sprint-6.2`
> **Date:** 2026-06-30
> **Related plan:** [`SPRINT_6_2_EXECUTION_PLAN.md`](./SPRINT_6_2_EXECUTION_PLAN.md) §1, §4.2, §8.2, §7.3, §3.3 (commit #2 + #3)
> **Sibling doc:** [`STORY_B2_3_IMPLEMENTATION_REPORT.md`](./STORY_B2_3_IMPLEMENTATION_REPORT.md)

---

## 1. What changed

### 1.1 Before (PII leaked through audit log diff)

`writeAuditLog()` persisted both `before` and `after` payloads verbatim.
Any diff rendered to `/audit-logs` could contain raw PII:

```ts
writeAuditLog({
  action: 'customer_updated',
  entityType: 'customer',
  entityId: 'cust-001',
  before: { medicalNote: 'Dị ứng penicillin', privacyNote: 'VIP', nationalIdNumber: '079123...' },
  after:  { medicalNote: 'Dị ứng paracetamol', privacyNote: 'VVIP', nationalIdNumber: '079987...' },
});
// → persisted as-is, then JSON-rendered to the audit log diff verbatim.
```

This violated anti-pattern **A11** (PII in audit log diffs) called out in [`SPRINT_6_2_EXECUTION_PLAN.md` §4.3](../../DESIGN_DIRECTION.md).

### 1.2 After (PII redacted on write, placeholder rendered on read)

`writeAuditLog()` now scrubs three fields from both `before` and `after`
BEFORE writing to Firestore. The redaction is pure, idempotent, and
applied to a clone (caller's input is untouched).

```ts
writeAuditLog({
  action: 'customer_updated',
  // ... same fields ...
  before: { medicalNote: 'Dị ứng penicillin', privacyNote: 'VIP', nationalIdNumber: '079123...' },
  after:  { medicalNote: 'Dị ứng paracetamol', privacyNote: 'VVIP', nationalIdNumber: '079987...' },
});
// → persisted as:
// before: { medicalNote: '[ĐÃ ẨN]', privacyNote: '[ĐÃ ẨN]', nationalIdNumber: '[ĐÃ ẨN]', ... }
// after:  { medicalNote: '[ĐÃ ẨN]', privacyNote: '[ĐÃ ẨN]', nationalIdNumber: '[ĐÃ ẨN]', ... }
```

The audit-logs page renders the `[ĐÃ ẨN]` placeholder with gray italic
style and a Vietnamese tooltip:

> *Thông tin nhạy cảm đã được ẩn vì lý do bảo mật*

The placeholder is **the same string** at write time (persistence layer)
and read time (render layer) — both come from the exported constant
`AUDIT_REDACTED_PLACEHOLDER` in `@/lib/firestore/audit`.

---

## 2. Files modified (scope = Story B.2.3 only)

### 2.1 Domain helpers — persistence layer

- **`src/lib/firestore/audit.ts`** — three additions and one small behavior change:
  1. **New** exported constant `AUDIT_REDACTED_FIELDS` — the frozen allow-list of PII field names: `['medicalNote', 'privacyNote', 'nationalIdNumber']`. Frozen at module-load to defend against accidental mutation.
  2. **New** exported constant `AUDIT_REDACTED_PLACEHOLDER` — the literal string `'[ĐÃ ẨN]'`. Used by both the persistence layer (`redactPiiFields`) and the rendering layer (`audit-logs/page.tsx`) so the contract has a single source of truth.
  3. **New** exported pure function `redactPiiFields(payload)` — clones the payload and overwrites every key in `AUDIT_REDACTED_FIELDS` with `AUDIT_REDACTED_PLACEHOLDER`. Non-PII fields pass through unchanged. Defensive: `null`, `undefined`, arrays, and primitives all normalize to `undefined` so no raw payload ever reaches the typed `before?`/`after?` slot.
  4. **Modified** `writeAuditLog()` — applies `redactPiiFields()` to `before` and `after` BEFORE the `AuditLog` object is constructed. The downstream `setDocument()` call persists only the redacted shape.

### 2.2 Render layer — diff visualization

- **`src/app/(protected)/audit-logs/page.tsx`** — two additions and one render swap:
  1. **New** import of `AUDIT_REDACTED_PLACEHOLDER` from `@/lib/firestore/audit` (single source of truth, see 2.1.2).
  2. **New** `renderRedactedJson(payload)` helper — wraps every JSON string that contains the placeholder literal in a styled `<span className="italic text-gray-500" title="Thông tin nhạy cảm đã được ẩn vì lý do bảo mật">`. Non-redacted payloads render as a plain string (no overhead). The function walks the JSON dump using a regex that matches either a complete placeholder value or a containing string, splits on matches, and emits styled spans for the matches while leaving the surrounding JSON intact.
  3. **Modified** the two `<pre>` blocks (Trước / Sau) to call `renderRedactedJson(log.before)` and `renderRedactedJson(log.after)` instead of `JSON.stringify(...)` directly.

### 2.3 Tests

- **`src/lib/firestore/__tests__/audit.test.ts`** — **NEW**. 25 tests covering:
  - Public contract: placeholder string, allow-list shape, mutation defense.
  - Pure helper (`redactPiiFields`): undefined/null/array normalization, no input mutation, every PII field redacted, non-PII preserved, idempotency, edge cases (`null` value, `0` value).
  - `writeAuditLog()` integration: per-field redaction for all three PII fields, batch redaction in one call, non-PII preservation, undefined `before`/`after` handling, no input mutation, defensive error swallowing.
  - End-to-end snapshot test: a representative `customer_updated` event with all three PII fields redacted in both sides.
- **`src/app/(protected)/audit-logs/__tests__/page.test.tsx`** — **NEW**. 8 tests covering:
  - Empty state still renders (no regression).
  - Redacted placeholders render with tooltip + gray italic style.
  - Non-PII fields render verbatim in the diff (fullName, phone).
  - Clean render when no PII fields are redacted (no placeholder, no tooltip).
  - Only one side is redacted — the other renders normally.
  - No leakage: every `[ĐÃ ẨN]` text rendered is wrapped in the styled chip with tooltip.
  - Expansion toggle still works after the rendering change (Trước + Sau labels render).

### 2.4 Files EXPLICITLY NOT touched

Per the brief's "Modify only files required by Story B.2.3" rule:

- `firestore.rules`, `storage.rules`, `firebase.json` — Phase 5 (remaining). Out of scope.
- `src/lib/types/audit.ts` — no schema change. The `AuditLog.before?: Record<string, unknown>` shape is preserved; only the *contents* of that record differ at runtime.
- `src/lib/types/customer.ts` — the source-document PII fields (`medicalNote`, `privacyNote`, `nationalIdNumber`) are intentionally preserved on customer records. B.2.3 ONLY scrubs the audit log shadow. The source remains untouched (RBAC + `SENSITIVE_FIELD_ACCESS_ROLES` still gates UI-level access).
- `src/constants/permissions.ts` — no permission change. The role-based gating on viewing source documents (where the real PII lives) is unchanged.
- `src/app/api/audit-logs/route.ts` — the read API is unchanged. It already returns whatever is persisted; after B.2.3, what is persisted is redacted, so the read API is implicitly safe.

---

## 3. Data contract (the operational model)

### 3.1 What is redacted

The **audit log shadow row**. Specifically:

| Field in the persisted `AuditLog` document | Treatment |
|---|---|
| `id`, `actorId`, `actorName`, `actorRole`, `action`, `entityType`, `entityId`, `createdAt` | **Unchanged** — preserved verbatim |
| `before[medicalNote]` | Replaced with `[ĐÃ ẨN]` (if present) |
| `before[privacyNote]` | Replaced with `[ĐÃ ẨN]` (if present) |
| `before[nationalIdNumber]` | Replaced with `[ĐÃ ẨN]` (if present) |
| `before[*]` (any other key) | **Unchanged** — preserved verbatim |
| `after[medicalNote]` | Replaced with `[ĐÃ ẨN]` (if present) |
| `after[privacyNote]` | Replaced with `[ĐÃ ẨN]` (if present) |
| `after[nationalIdNumber]` | Replaced with `[ĐÃ ẨN]` (if present) |
| `after[*]` (any other key) | **Unchanged** — preserved verbatim |

### 3.2 What is NOT redacted

- **Source documents** — `customer.medicalNote`, `case.privacyNote`, `customer.nationalIdNumber`, etc. ALL preserved on the source document.
- **Other audit log fields** — actor identity, action type, entity type/id, timestamps.
- **Pre-existing audit log rows** — written before the deploy. They carry the raw PII values from the moment they were written. See §4 for the data-migration rationale.

### 3.3 The "view full diff" contract (per BACKLOG §7.3.3)

Any future UI affordance that wants to expose the raw PII (e.g., a "view full change history" page) **must read from the source document**, not the audit log. The audit log intentionally loses the raw value — redaction is a **destructive behavior change on the write path**, not a UI-only mask.

This is the contract pinned by the data privacy expert during [`SPRINT_6_2_EXECUTION_PLAN.md` §7.3.3](./SPRINT_6_2_EXECUTION_PLAN.md):

> "Audit log persists redacted values. The raw PII remains in the *source* document (customer, case). Any 'view full diff' affordance must read from source, not audit."

No code in this story violates that contract.

---

## 4. Schema migration (no data backfill required)

### 4.1 Pre-existing audit logs

Audit log rows written **before** the deploy still contain raw PII values
in `before`/`after`. B.2.3 does NOT backfill those rows — backfill is
intentionally out of scope because:

1. **Audit data is append-only.** We cannot rewrite history safely — the
   `createdAt` timestamps would lie about when the change happened.
2. **PII risk is bounded by RBAC.** Per `DELETE_APPROVE_ROLES` /
   `SENSITIVE_FIELD_ACCESS_ROLES`, only authorized roles can view the
   audit log page. Pre-existing PII in old logs is no worse than the PII
   in source documents those same roles can already read.
3. **Operational cost.** Backfilling 30 seed logs is trivial, but
   production may have thousands of logs from months of operation.
   Backfilling those is a separate data-migration task with its own
   change-management window.

The data-privacy-expert sign-off recorded in
[`STORY_B2_3_IMPLEMENTATION_REPORT.md`](./STORY_B2_3_IMPLEMENTATION_REPORT.md)
acknowledges this trade-off.

### 4.2 Future audit logs

Every audit log written AFTER the deploy has its `before` and `after`
redacted automatically by `writeAuditLog()`. No application code change
is required by callers — they continue to pass the full payload; the
library scrubs it transparently.

---

## 5. Behavioral compatibility

| Surface | Before | After | Compatible? |
|---|---|---|---|
| Caller writes `writeAuditLog({ before: { medicalNote: '…' } })` | Persisted verbatim | Persisted as `[ĐÃ ẨN]` | **breaking** (intentional) |
| Caller's input object | Untouched (pass-by-reference) | Untouched (cloned by `redactPiiFields`) | additive |
| `AuditLog.before?: Record<string, unknown>` type | Same | Same | additive (type unchanged) |
| `getAllAuditLogs()` reader | Returns row | Returns row with redacted values | additive |
| `/audit-logs` page diff renderer | `JSON.stringify(log.before)` | `renderRedactedJson(log.before)` | additive (visual only) |
| Native `window.confirm` / `alert` calls | 0 | 0 | unchanged (verified by §7 grep) |

The only intentional **breaking change** is "raw PII values no longer
persist in audit logs," which is the entire purpose of the story
(F-MED-17) and the reason it lives in the clinical-corrections sprint.

---

## 6. UI surface

### 6.1 Visual diff on `/audit-logs`

A customer_updated audit row whose `before` is

```json
{
  "fullName": "Trần Thị A",
  "phone": "0901234567",
  "medicalNote": "Dị ứng penicillin",
  "privacyNote": "Khách VIP",
  "nationalIdNumber": "079123456789"
}
```

now renders as:

```json
{
  "fullName": "Trần Thị A",
  "phone": "0901234567",
  "medicalNote": "[ĐÃ ẨN]"   ← gray italic, hover for tooltip
  "privacyNote": "[ĐÃ ẨN]"   ← gray italic, hover for tooltip
  "nationalIdNumber": "[ĐÃ ẨN]"   ← gray italic, hover for tooltip
}
```

- **Style:** `italic text-gray-500` (Tailwind utilities). Fits the
  premium theme's neutrals.
- **Tooltip:** `title="Thông tin nhạy cảm đã được ẩn vì lý do bảo mật"` (Vietnamese; reviewed by ux-designer).
- **No keyboard-only cue** — tooltips rely on hover. Keyboard users see
  the `[ĐÃ ẨN]` text inline; the tooltip is informational, not
  operational. If accessibility review in 6.3 raises the concern, we can
  wrap the chip in `aria-describedby` pointing to a hidden `<span>` —
  out of scope here, surfaced as Phase 6.3 backlog.

### 6.2 No other UI changed

- Topbar, sidebar, case detail, customer detail, settings — none of
  these surfaces render audit log diffs, so they are unchanged.
- The `/audit-logs` page header and filters are untouched.

---

## 7. Permissions

No permission constants changed. The audit log page already requires
admin-style access; the redaction layer is mechanical and operates
identically for every actor.

The PII fields redacted here are also gated at the source by
`SENSITIVE_FIELD_ACCESS_ROLES` (admin, ceo, cso, master_sales, sales_online,
sales_offline, accountant, cskh_postop) — any role authorized to view
those source fields is also the role authorized to view the (now-redacted)
audit log. B.2.3 does not introduce a new privilege escalation; it
**lowers the information surface** for everyone.

---

## 8. Anti-pattern scan

Per [`SPRINT_6_2_EXECUTION_PLAN.md` §4.3](./SPRINT_6_2_EXECUTION_PLAN.md)
and DESIGN_DIRECTION §18:

| Anti-pattern | B.2.3 surface | Status |
|---|---|---|
| **A11** — PII in audit log diffs | **THE FIX.** `medicalNote` / `privacyNote` / `nationalIdNumber` are scrubbed on both `before` and `after` before persist. | ✅ |
| A9 — Native `confirm()` / `alert()` | B.2.3 introduces no new dialogs; no native calls added. Verified by `grep -rE "window\.(confirm\|alert)" src/ \| grep -v __tests__/` returning 0 matches. | ✅ |
| A2 — Raw user/entity IDs in copy | B.2.3 adds no user-facing copy beyond the static tooltip string. | ✅ |
| A22 — Modal for 22-field form | No modal added by B.2.3. | ✅ |
| Additional B.2.3 grep gate | `grep -rE "medicalNote\|privacyNote\|nationalIdNumber" src/lib/firestore/audit.ts` returns only the `AUDIT_REDACTED_FIELDS` array + a JSDoc comment. No leaky write paths. | ✅ |

---

## 9. Rollback

If Sprint 6.2 must roll back B.2.3 specifically (e.g., the data privacy
expert withdraws sign-off, or a downstream consumer needs the raw value):

1. Revert the two commits on `phase-6/sprint-6.2`:
   - `feat(audit): redact PII fields from beforeData/afterData before persist`
   - `feat(audit): render [ĐÃ ẨN] with gray italic + tooltip in audit-logs diff`
2. Drop `redactPiiFields()` calls from `writeAuditLog()`.
3. Revert the `renderRedactedJson(...)` change in the audit-logs page.
4. Re-run `npx tsc --noEmit && npm run lint && npm run build && npm run test -- --run` — all gates must remain green.

**Data impact of rollback:**

- **Audit logs written between merge and revert** contain the redacted
  `[ĐÃ ẨN]` placeholders. Rollback does NOT restore the raw values.
  Rollback un-redacts *future* writes only.
- **Historical (pre-merge) audit logs** are unchanged by B.2.3 (no
  backfill), and unchanged by rollback. They still carry the raw values
  written before the deploy.

This trade-off is acceptable for the Sprint 6.2 SLA: the rollback is
defined in [`SPRINT_6_2_EXECUTION_PLAN.md` §9.2](./SPRINT_6_2_EXECUTION_PLAN.md)
table row "B.2.3 PII redaction," time-to-rollback < 15 min.

---

## 10. References

- [`SPRINT_6_2_EXECUTION_PLAN.md`](./SPRINT_6_2_EXECUTION_PLAN.md) — Story B.2.3 row at line 41, §4.2 file inventory, §4.3 anti-pattern A11, §5 risk R4, §6 (no flag — pure behavior change), §7.3 sign-off checklist, §8.2 B.2.3 test file requirements, §9.2 rollback row
- [`IMPLEMENTATION_BACKLOG.md`](./IMPLEMENTATION_BACKLOG.md) — F-MED-17
- [`DESIGN_DIRECTION.md`](../../DESIGN_DIRECTION.md) §18 — A11 anti-pattern
- [`STORY_B2_3_IMPLEMENTATION_REPORT.md`](./STORY_B2_3_IMPLEMENTATION_REPORT.md) — sibling doc, files-changed summary + tests executed + sign-offs

---

*End of B.2.3 Migration Notes.*
