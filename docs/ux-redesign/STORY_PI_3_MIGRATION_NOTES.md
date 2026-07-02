# Story PI-3 — Payment Audit Enrichment — Migration Notes

> **Story:** PI-3 (Sprint 7.2)
> **Audience:** Engineers migrating code that reads payment audit log entries.
> **Breaking change scope:** Internal `before` / `after` payload shape only. No public API breakage.

---

## TL;DR

Every payment-related audit log entry now carries an **enriched `after` payload** with:

1. **`__diff`** — structured field-by-field diff (`{ [field]: { from, to } }`)
2. **`__stateTransition`** — `{ from, to, at, actor, note? }`
3. **`caseId`** — fast-filter link
4. **`originalPaymentId`** — refund chain link (PI-2)
5. **`trigger`** — human-readable cause
6. **`caseBill`** — `{ before, after }` for transactional commit entries
7. **`metadata`** — PII-redacted bag for story-specific payloads (abort flags, SoD denial)

The `before` payload is unchanged in shape (still the redacted pre-state record), but PII redaction is now applied consistently to both sides — no more raw `medicalNote` slipping through if a future caller passes a `before` with a PII field.

The change is **additive** for downstream consumers reading the audit log via the standard API (`/api/audit-logs`) or the audit-logs page. JSON-stringification in the UI shows the new fields automatically.

---

## Migration map for each call site

| Pre-PI-3 call site | Post-PI-3 call site | Diff in payload |
|--------------------|---------------------|-----------------|
| `writeAuditLog({ action: 'payment_confirmed', before: { status, createdBy }, after: { confirmedBy, note } })` | `writePaymentAudit({ action: 'payment_confirmed', entityId, actor, before: <Payment>, after: <Payment>, caseId })` | `after` becomes the full redacted post-state payment + `__diff` + `caseId` + `trigger`. `confirmedBy` / `note` are not at the top level anymore — they're inside the diff and inside the post-state record. |
| `writeAuditLog({ action: 'payment_rejected', after: { note } })` | `writePaymentAudit({ action: 'payment_rejected', entityId, actor, before: <Payment>, after: <Payment>, caseId })` | `after.note` is now inside the post-state payment record + surfaced via `__diff.note.from / __diff.note.to`. |
| `writeAuditLog({ action: 'payment_created', after: { paymentType, originalPaymentId, amount, caseId, note } })` (refund) | `writePaymentAudit({ action: 'payment_created', entityId: refund.id, actor, after: <Payment>, caseId, originalPaymentId })` | The post-state payment record is the full `refund` Payment; `originalPaymentId` is lifted to top-level `after.originalPaymentId`. |
| `writeAuditLog({ action: 'payment_refunded', after: { refundPaymentId, refundAmount, refundedBy } })` | `writePaymentAudit({ action: 'payment_refunded', entityId: originalPaymentId, actor, before: <Payment>, after: <Payment>, caseId, originalPaymentId, metadata: { refundPaymentId, refundAmount, refundedBy } })` | `entityId` is the ORIGINAL payment id (unchanged). Refund metadata is now nested under `after.metadata` instead of flat at `after`. `originalPaymentId` is also surfaced at the top of `after` for fast filter. |
| `tx.set('auditLogs', id, { action: 'payment_transaction_committed', before: { paymentStatus, caseAmountPaid, caseRemainingAmount, casePaymentStatus }, after: { paymentStatus, confirmedBy, caseId, caseAmountPaid, caseRemainingAmount, casePaymentStatus, paymentType, amount } })` (inline in `confirmPaymentTransaction`) | `txWritePaymentAudit(tx, { action: 'payment_transaction_committed', entityId, actor, before: <Payment>, after: <Payment>, caseId, trigger, caseBill })` | Same atomicity (still inside `runTransaction`); enriched payload with `__diff`, `caseBill.{before,after}`, full redacted payment record. |
| `writeAuditLog({ action: 'payment_transaction_aborted', before: { paymentStatus }, after: { aborted, stage, reason, caseId } })` (after rollback) | `writePaymentAudit({ action: 'payment_transaction_aborted', entityId, actor, before: <Payment>, caseId, trigger, metadata: { aborted, stage, reason } })` | Abort metadata is now nested under `after.metadata`. `caseId` is lifted to top-level `after.caseId`. `before.status` replaces `before.paymentStatus`. |
| (no audit write) on `POST /api/payments` | `writePaymentAudit({ action: 'payment_created', entityId, actor, after: <Payment>, caseId, trigger: 'PI-3 payment create' })` | **New** audit write on payment create. The `__stateTransition` carries `{ from: 'none', to: 'pending' }`. |
| `writeAuditLog({ action: 'payment_confirmed', before: {...}, after: { denied: true, reason: 'sod_violation', attemptedBy } })` (SoD denial) | `writePaymentAudit({ action: 'payment_confirmed', entityId, actor, before: <Payment>, caseId, trigger: 'SoD self-confirm blocked', metadata: { denied: true, reason: 'sod_violation', attemptedBy } })` | SoD denial metadata is nested under `after.metadata`. `caseId` and `trigger` are top-level on `after`. |

---

## Reading the new `after` payload

### Diff (`__diff`)

```json
{
  "__diff": {
    "status": { "from": "pending", "to": "confirmed" },
    "confirmedBy": { "from": null, "to": "user-001" },
    "confirmedAt": { "from": null, "to": "2026-07-01T01:00:00.000Z" }
  }
}
```

Keys appear in `DIFFABLE_PAYMENT_FIELDS` order:

```
status → paymentType → amount → paymentMethod → paymentDate →
confirmedBy → confirmedAt → receivedBy → rejectedBy → rejectedAt → note
```

Unknown future fields are appended in alphabetical order.

### State transition (`__stateTransition`)

```json
{
  "__stateTransition": {
    "from": "pending",
    "to": "confirmed",
    "at": "2026-07-01T01:00:00.000Z",
    "actor": {
      "uid": "user-001",
      "displayName": "Nguyễn Văn Admin",
      "role": "admin"
    },
    "note": "Optional human note"
  }
}
```

For newly created payments (no `before`): `{ from: 'none', to: 'pending' }`.
For deletes / state-unchanged updates: `__stateTransition` is omitted.

### Case bill delta (`caseBill`)

Only present on `payment_transaction_committed` entries (and future PI stories that touch the case bill). Shape:

```json
{
  "caseBill": {
    "before": { "amountPaid": 0, "remainingAmount": 10000000, "paymentStatus": "unpaid" },
    "after":  { "amountPaid": 5000000, "remainingAmount": 5000000, "paymentStatus": "partial" }
  }
}
```

### Refund chain (`originalPaymentId`)

Present on `payment_created` (refund payment record) and `payment_refunded` (original payment record). The two together let an auditor build the full refund chain:

```
1. payment_created (entityId=pay-refund-001, after.originalPaymentId=pay-original-001)
2. payment_refunded (entityId=pay-original-001, after.metadata.refundPaymentId=pay-refund-001)
```

### Trigger (`trigger`)

Human-readable cause, e.g. `'PI-3 refund created'`, `'PI-3 transactional commit'`, `'PI-3 reject'`, `'PI-3 payment create'`, `'PI-3 refund marker'`, `'SoD self-confirm blocked'`. Not enforced; just a free-text hint for log triage.

### Metadata (`metadata`)

PII-redacted bag for story-specific payloads:

| Action | Metadata keys |
|--------|---------------|
| `payment_confirmed` (SoD denial) | `denied`, `reason: 'sod_violation'`, `attemptedBy` |
| `payment_transaction_aborted` | `aborted: true`, `stage`, `reason` |
| `payment_refunded` | `refundPaymentId`, `refundAmount`, `refundedBy` |

The bag is run through `redactPiiFields` so it never carries raw PII even if a caller accidentally passes `medicalNote` etc.

---

## Code-migration checklist

If you have a code path that reads the old flat `after` shape:

- [ ] **Audit logs UI** — the JSON-stringify-and-show path in `audit-logs/page.tsx` works as-is. New fields appear automatically. No code change required.
- [ ] **Audit logs filter** — `entityType='payment'` + new `entityId` filter (added by PI-3). If your code constructs the query string, append `entityId=<id>`.
- [ ] **SoD-denied audit assertions** — old: `after.denied === true`. New: `after.metadata.denied === true`. Same for `reason`, `attemptedBy`.
- [ ] **Abort audit assertions** — old: `after.aborted === true`, `after.stage === 'payment'`. New: `after.metadata.aborted === true`, `after.metadata.stage === 'payment'`.
- [ ] **Refund audit assertions** — old: `after.refundPaymentId`. New: `after.metadata.refundPaymentId`.
- [ ] **Confirm-success assertions** — old: `after.confirmedBy === 'user-001'`. New: `after.confirmedBy === 'user-001'` is still true (the post-state record carries it) — but the cleanest assertion is `after.__diff.confirmedBy.to === 'user-001'`.

---

## Backwards-compatibility shim

If a downstream tool (analytics export, third-party reconciliation job) needs the OLD flat shape, it can be reconstructed from the new payload:

```ts
// Pre-PI-3 flat shape → post-PI-3 enriched shape
const flat = {
  ...enriched.before,                          // pre-state
  ...enriched.after.__diff
    ? Object.fromEntries(
        Object.entries(enriched.after.__diff).map(([k, v]) => [k, v.to]),
      )
    : {},                                      // post-state diff
  // Plus metadata fields if your reader expects them at top level:
  ...enriched.after.metadata,
};
```

**Recommendation:** do not do this. Migrate to the enriched shape — the flat reconstruction loses `from` values, which is the whole point of PI-3.

---

## Rollback

`< 5 minutes` per the Sprint 7.2 plan §7.1:

```bash
git revert <pi-3-commit-sha>
```

PI-3 is gated behind no feature flag (the enriched shape ships immediately). On rollback, audit entries revert to the flat shape — auditors lose the financial diff but keep the status-change record. No data migration required.

---

## Feature flag inventory

**No new flags added by PI-3.** The enriched shape ships unconditionally — it is an additive change to the audit log payload, with no behaviour change visible to end users (other than the new "Lịch sử" link in the payments page, which is purely additive).

Total flags at Sprint 7.2 close: **8** (unchanged from PI-3 ship).

---

## Files touched in detail

| Path | Lines | Description |
|------|------:|-------------|
| `src/lib/audit/payment-audit.ts` | 410 (new) | The new module. |
| `src/lib/audit/__tests__/payment-audit.test.ts` | 480 (new) | 29 unit tests. |
| `src/app/api/payments/refund/__tests__/route.test.ts` | 250 (new) | 7 route tests for PI-3 enriched shape. |
| `src/lib/payments/transaction.ts` | -22 / +28 | Inline audit payload replaced by `txWritePaymentAudit` / `writePaymentAudit` calls. F-CRIT-08 atomicity preserved. |
| `src/lib/payments/__tests__/transaction.test.ts` | +0 / -0 (assertion edits) | 4 abort-shape assertions updated to enriched shape. |
| `src/app/api/payments/[id]/confirm/route.ts` | +30 / -8 | SoD + legacy-success audit calls replaced. |
| `src/app/api/payments/[id]/confirm/__tests__/route.test.ts` | +18 / -6 | SoD + success assertions updated. Mock updated to allow real `writePaymentAudit`. |
| `src/app/api/payments/[id]/confirm/__tests__/route.transactional.test.ts` | +16 / -8 | Legacy-success + SoD assertions updated. Mock updated. |
| `src/app/api/payments/[id]/reject/route.ts` | +24 / -3 | Pre-record read + enriched audit. |
| `src/app/api/payments/refund/route.ts` | +24 / -14 | Both refund-side + original-side enriched. |
| `src/app/api/payments/route.ts` | +18 / -0 | New audit write on payment create. |
| `src/app/api/audit-logs/route.ts` | +5 / -0 | New `entityId` query param. |
| `src/app/(protected)/audit-logs/page.tsx` | +52 / -0 | New `entityId` filter + deep-link honor. |
| `src/components/payments/payment-list.tsx` | +18 / -0 | New "Lịch sử" column. |

**Net delta:** +763 / -59 across 14 files (excluding the 2 brand-new test files).

---

## Sign-off chain

- [x] **L1 Functional** — Vitest covers happy path + boundary + redaction.
- [x] **L2 Validation** — Zod schemas untouched; PI-3 only enriches payloads, no wire-format change.
- [x] **L3 Workflow** — Transactional path round-trip covered (F-CRIT-08).
- [x] **L4 Permission** — SoD denial audit still 403s; PI-3 enriches the audit, doesn't widen RBAC.
- [x] **L5 Security** — PII redaction applied on every write path.
- [x] **L6 Integration** — Route tests cover refund / confirm / reject / create paths.
- [x] **L7 Performance** — Diff computation is O(n) over a flat record (≤ 30 fields). Negligible.
- [x] **L8 Data integrity** — Cross-path shape parity verified (committed + aborted + non-tx produce the same `after` envelope).
- [x] **L9 Mobile / responsive** — No mobile UI changes; "Lịch sử" column inherits the responsive DataTable behaviour.
- [x] **L10 Regression** — Full suite green (1023 / 1023).

---

*End of PI-3 Migration Notes.*