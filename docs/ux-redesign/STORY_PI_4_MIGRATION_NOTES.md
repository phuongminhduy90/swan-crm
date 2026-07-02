# Story PI-4 — actualProcedureDate Source of Truth — Migration Notes

> **Story:** PI-4 (Sprint 7.2)
> **Audience:** Engineers touching `createPostOpFollowups`, the case-status API, or any code that schedules D1–D90 follow-ups.
> **Breaking change scope:** Internal priority order on the server-side status API path. No public API breakage. No schema change. No client-side visible change.

---

## TL;DR

`actualProcedureDate` is now the documented, enforced source of truth for D1–D90 follow-up scheduling — on both the client and the server. A new pure helper — `resolveProcedureDateForFollowups()` in `@/lib/firestore/followups` — encodes the priority order and is called by the status API. The convention is documented on `CaseRecord.actualProcedureDate` and `CaseRecord.expectedProcedureDate` JSDoc blocks so future contributors find it via autocomplete.

The change is **internal to the status API** — the client path was already honouring `actualProcedureDate`, and the wire format / return shape of the status API is unchanged. The only observable delta is for direct API callers that used `actualProcedureDate` (the response now uses it) or for legacy cases where `actualProcedureDate` was empty (still uses `expectedProcedureDate`).

Sprint 7.3 C.3.2 owns the canonical TZ fix for `actualProcedureDate`. This story only documents the storage convention.

---

## Migration map for each call site

| Pre-PI-4 call site | Post-PI-4 call site | Behaviour delta |
|--------------------|---------------------|-----------------|
| `await createPostOpFollowups(caseId, custId, existing.expectedProcedureDate ?? new Date().toISOString(), undefined)` (status API) | `await createPostOpFollowups(caseId, custId, resolveProcedureDateForFollowups(existing), undefined)` | Server-side now prefers `actualProcedureDate`. Direct-API callers see the same D1–D90 trail anchor the client path produces. Legacy cases (no actual) still anchor on expected — no change. |
| `caseRecord.actualProcedureDate` reader | (same) | JSDoc added explaining it's the source of truth. |
| `caseRecord.expectedProcedureDate` reader | (same) | JSDoc added explaining it's the forecast / fallback only. |
| `caseRecord.actualProcedureDate` writer | (same) | No code change; client-side `StatusWorkflow` already persists the captured date before the status flip. |
| Client-side `caseRecord.actualProcedureDate` flow (unchanged since B.2.4) | (same) | Docblock updated to reference PI-4 + the priority order. |

---

## How to use the new helper

```ts
import { resolveProcedureDateForFollowups, createPostOpFollowups } from '@/lib/firestore/followups';

// Case just transitioned to procedure_completed
const procedureDate = resolveProcedureDateForFollowups(caseRecord);
await createPostOpFollowups(
  caseRecord.id,
  caseRecord.customerId,
  procedureDate,
  undefined,
);
```

If you call `createPostOpFollowups()` directly, you can still pass any ISO string or `Date` — the function itself is unchanged. The contract just says *the resolved value should be the priority-resolved string, not a free choice.*

The helper also exists for the rare case where some other code path (e.g. a custom job, a script) needs the same priority order:

```ts
// E.g. a backfill script that re-anchors legacy cases
const procedureDate = resolveProcedureDateForFollowups({
  actualProcedureDate: '2026-07-15T00:00:00.000Z',
  expectedProcedureDate: '2026-07-10T00:00:00.000Z',
});
// → '2026-07-15T00:00:00.000Z'
```

---

## Storage convention (documented, fix deferred to 7.3)

> Per the Sprint 7.2 plan §3 R7.2-8.

| Field | Form | TZ discipline | Where the fix lands |
|-------|------|---------------|---------------------|
| `actualProcedureDate` | ISO-8601 string, UTC midnight | Pre-PI-4 callers often wrap with `${captured}T00:00:00.000Z` (so a `YYYY-MM-DD` input becomes UTC midnight). Falsy empty strings are common from `<input type="date">` defaults. | Sprint 7.3 C.3.2 — canonical form will be TZ-aware + validated on the server. |
| `expectedProcedureDate` | Same as above | Same | Same |
| `paymentDate` | Mixed: `YYYY-MM-DD` from `<input type="date">` (form) **or** full UTC ISO (seed data). Comparison code uses `new Date(paymentDate)` which copes with both. | Same — Sprint 7.3 owns the canonical form. | Sprint 7.3 |

If you are writing code that *compares* dates (range filters, sorting, due-date math), prefer `new Date(value)` (UTC parsing) or `date-fns/parseISO` over hand-rolled slicing. The mixed-format tolerance is load-bearing.

---

## Reading the priority order

```ts
resolveProcedureDateForFollowups(caseRecord) → string
```

| Input | Output |
|-------|--------|
| `{ actualProcedureDate: '2026-07-15T...', expectedProcedureDate: '2026-07-10T...' }` | `'2026-07-15T...'` |
| `{ actualProcedureDate: '', expectedProcedureDate: '2026-07-10T...' }` | `'2026-07-10T...'` (empty treated as missing) |
| `{ expectedProcedureDate: '2026-07-10T...' }` | `'2026-07-10T...'` |
| `{}` | `new Date().toISOString()` (terminal fallback) |
| `{ actualProcedureDate: '2026-07-15T...' }` | `'2026-07-15T...'` |

Both `actualProcedureDate` and `expectedProcedureDate` are typed `string | undefined` on `CaseRecord`. The empty-string pass-through is what makes the contract robust to `<input type="date">` initial values.

---

## Code-migration checklist

If you have a code path that resolves the procedure date outside of `createPostOpFollowups()`:

- [ ] **Backfill scripts** — replace `caseRecord.actualProcedureDate ?? caseRecord.expectedProcedureDate ?? new Date().toISOString()` with `resolveProcedureDateForFollowups(caseRecord)`.
- [ ] **Custom jobs** — same pattern; the helper is exported.
- [ ] **Future refactors** — if you add a new code path that schedules follow-ups, call the helper. The priority order is the contract; the helper is the canonical implementation.
- [ ] **TZ-aware code (Sprint 7.3)** — when the canonical form lands, the helper will be updated to validate / normalise. Callers should not assume the helper returns UTC midnight forever — treat the output as opaque, just pass it to `createPostOpFollowups` / `addDays`.

---

## Backwards-compatibility shim

None required. The helper is additive; the legacy call sites that did not use it continue to produce the same output for their inputs.

If you *must* revert to the pre-PI-4 server-side priority:

```ts
// Pre-PI-4 server-side path
const procedureDate =
  caseRecord.expectedProcedureDate ?? new Date().toISOString();
```

A simple git-revert of the PI-4 commit restores this in `src/app/api/cases/[id]/status/route.ts`.

---

## Rollback

`< 1 minute` per the Sprint 7.2 plan §7.1:

```bash
git revert <pi-4-commit-sha>
```

PI-4 introduces no feature flag (the helper runs unconditionally — the priority order is the contract). On rollback, the server-side status API reverts to `expectedProcedureDate ?? now`. Existing client-side `StatusWorkflow` flow is untouched in either direction.

---

## Feature flag inventory

**No new flags added by PI-4.** The convention is locked in at the type / call-site layer, not behind a flag — the priority order is part of the contract, not a behaviour switch.

Total flags at Sprint 7.2 close: **8** (unchanged).

---

## Files touched in detail

| Path | Lines | Description |
|------|------:|-------------|
| `src/lib/firestore/followups.ts` | +75 / -0 | New helper + JSDoc on the followup module. |
| `src/lib/firestore/__tests__/followups.test.ts` | +270 (new) | 15 unit tests. |
| `src/lib/types/case.ts` | +24 / -3 | JSDoc on `actualProcedureDate` + `expectedProcedureDate`. |
| `src/app/api/cases/[id]/status/route.ts` | +12 / -2 | New import + helper call inside the existing try/catch. |
| `src/app/api/cases/[id]/status/__tests__/route.test.ts` | +140 / -2 | New `Story PI-4` describe block + `importOriginal` mock upgrade. |
| `src/app/(protected)/cases/[id]/page.tsx` | +8 / -2 | Documentation-only inline comment refresh. |

**Net delta:** +527 / -9 across 6 files (excluding the 1 brand-new test file).

---

## Sign-off chain

- [x] **L1 Functional** — Vitest covers helper priority, followup shape, dueDate math, Date / string acceptance.
- [x] **L2 Validation** — Zod unchanged; PI-4 adds no schema. The helper treats empty strings as missing, matching the form-layer behaviour.
- [x] **L3 Workflow** — E2E helper-then-createPostOpFollowups locks the contract.
- [x] **L4 Permission** — No permission surface touched. Status route RBAC (Sprint 6.1) and CHECKLIST_GATE (Sprint 6.2) preserved.
- [x] **L5 Security** — No PII / audit-log surface touched.
- [x] **L6 Integration** — Status route tests pass with 5 new PI-4 integration cases; existing 42 status-route tests unchanged.
- [x] **L7 Performance** — Helper is O(1); `createPostOpFollowups()` is unchanged.
- [x] **L8 Data integrity** — Priority order produces the same D1–D90 trail the client path produces, verified by direct unit assertions.
- [x] **L9 Mobile / responsive** — No mobile UI changes.
- [x] **L10 Regression** — Full suite green (1043 / 1043).

---

*End of PI-4 Migration Notes.*
