# Story PI-4 — actualProcedureDate Source of Truth — Implementation Report

> **Story:** PI-4 (Sprint 7.2 — Payment Integrity)
> **Status:** ✅ Complete
> **Branch:** `main`
> **Files added:** 1 (`src/lib/firestore/__tests__/followups.test.ts`)
> **Files modified:** 4
> **Tests added:** 20 (15 unit + 5 route) — see §5
> **Net test delta:** 1023 → 1043 (+20)

---

## 1. Summary

PI-4 codifies the convention that **`actualProcedureDate` is the source of truth for D1–D90 follow-up scheduling**. Before this story, the convention was honoured only by the client-side status-workflow (which captures the date from `<input type="date">` before the status flip and persists it). The server-side status API silently ignored `actualProcedureDate` and used `expectedProcedureDate ?? new Date().toISOString()` instead — meaning a direct API call (without the client prolog) would land the case's D1–D90 trail on a different anchor.

This story:

1. Adds a pure `resolveProcedureDateForFollowups(caseRecord)` helper in `@/lib/firestore/followups` that encodes the priority order — **actual → expected → now**.
2. Routes the server-side status transition (`PATCH /api/cases/[id]/status`) through that helper so both client and server paths honour the same contract.
3. Promotes the convention into JSDoc on `CaseRecord.actualProcedureDate`, `expectedProcedureDate`, and `createPostOpFollowups()` so any future contributor searching the type will see it.
4. Locks the contract in with 20 new tests (15 unit + 5 route-level).

PI-4 is **out of scope for the actual timezone fix** — Sprint 7.3 C.3.2 owns `actualProcedureDate` end-to-end. PI-4 only documents the storage convention (ISO-8601 string, UTC midnight) and the priority order. Behaviour on the wire is unchanged for any case where `actualProcedureDate` is set (which is the same set the client path already used) — the change is observable only in (a) the server-side direct-API path and (b) legacy cases whose seed date format was already inconsistent.

F-CRIT-08 (transactional confirm), F-HIGH-28 (bill recompute), and PI-1/PI-2/PI-3 are **untouched**.

---

## 2. Files added

| Path | LOC | Purpose |
|------|----:|---------|
| `src/lib/firestore/__tests__/followups.test.ts` | ~270 | 15 unit tests covering priority order, followup offsets, dueDate math, Date / string acceptance, full E2E of helper + createPostOpFollowups. |

---

## 3. Files modified

| Path | Change |
|------|--------|
| `src/lib/firestore/followups.ts` | New pure helper `resolveProcedureDateForFollowups()` plus JSDoc that documents the priority order, the storage convention, and the contract that `createPostOpFollowups()` expects the *resolved* date. |
| `src/lib/types/case.ts` | JSDoc added to `CaseRecord.actualProcedureDate` and `expectedProcedureDate` spelling out: source-of-truth status, priority order, storage convention, and pointer to Sprint 7.3 for the canonical TZ form. |
| `src/app/api/cases/[id]/status/route.ts` | New import of `resolveProcedureDateForFollowups`; the `procedure_completed` followup-creation block now calls the helper instead of inlining `existing.expectedProcedureDate ?? new Date().toISOString()`. Sprint 6.x behaviour preserved for legacy cases (priority 2 + 3). |
| `src/app/api/cases/[id]/status/__tests__/route.test.ts` | New `Story PI-4` describe block with 5 integration tests: actual > expected, expected fallback, terminal fallback, non-procedure_completed negative, checklist-gate non-regression. The `vi.mock('@/lib/firestore/followups')` block now uses `importOriginal` so the real helper runs at real priority. |
| `src/app/(protected)/cases/[id]/page.tsx` | Inline comment updated to reference PI-4 and the server-side priority order (documentation-only — no behavioural change to the client path). |

---

## 4. Module design

### 4.1 The helper — `resolveProcedureDateForFollowups`

```ts
export function resolveProcedureDateForFollowups(
  caseRecord: { actualProcedureDate?: string; expectedProcedureDate?: string },
): string {
  if (caseRecord.actualProcedureDate) {
    return caseRecord.actualProcedureDate;
  }
  if (caseRecord.expectedProcedureDate) {
    return caseRecord.expectedProcedureDate;
  }
  return new Date().toISOString();
}
```

**Properties:**

- **Pure** — does not read or write state. Same input → same output.
- **Total** — every shape of `caseRecord` returns a valid ISO string (terminal fallback is `new Date().toISOString()`, never undefined).
- **Accepts structural subset** — the parameter is a structural type, so `CaseRecord` and any future record that has those two fields works without a cast.
- **Treats empty strings as missing** — matches how the form layer (`<Input type="date">`) renders empty selection, so an empty-string `actualProcedureDate` falls through to `expectedProcedureDate` rather than producing an invalid ISO.

### 4.2 The contract — `createPostOpFollowups`

The docblock on `createPostOpFollowups` now states that callers must resolve the procedure date via `resolveProcedureDateForFollowups(caseRecord)` so the priority order is followed. The function itself accepts both `Date` and ISO `string` and is unchanged; the convention lives at the call-site boundary, not in the function body.

### 4.3 Storage convention documented, not pinned

PI-4 documents that both `actualProcedureDate` and `expectedProcedureDate` are stored as ISO-8601 strings with UTC midnight (`YYYY-MM-DDTHH:mm:ss.sssZ`). The actual TZ fix (midnight-local vs midnight-UTC vs TZ-aware) is owned by **Sprint 7.3 C.3.2** per the Sprint 7.2 plan §0.1 — PI-4 only documents the existing convention so a future contributor knows what to expect.

> **Per the Sprint 7.2 plan §3 R7.2-8:** *"PI-4 documents the convention: `paymentDate` is stored as local date string (YYYY-MM-DD) without TZ conversion"*. The convention is now in code comments; the fix is deliberately deferred to Sprint 7.3.

---

## 5. Test results

### 5.1 New tests (PI-4)

| File | Tests | Coverage |
|------|------:|----------|
| `src/lib/firestore/__tests__/followups.test.ts` | 15 | Helper priority order (6 tests), `createPostOpFollowups()` shape + offsets (5 tests), E2E helper-then-create (2 tests), Date+string acceptance, dueDate math, unique ids, pending-state initialisation, propagation of case/customer/assignee, immutability of input. |
| `src/app/api/cases/[id]/status/__tests__/route.test.ts` | 5 | Integration: actual > expected (priority 1), expected fallback (priority 2), terminal fallback (priority 3), non-`procedure_completed` negative, checklist-gate non-regression. The mock uses `importOriginal` so the real helper runs at real priority. |

### 5.2 Total count

```
Test Files  52 passed (52)
Tests       1043 passed (1043)
```

Pre-Sprint 7.2 baseline: 867 → 999 → 1006 → 1023 → **1043** (+20 from PI-4 alone).

### 5.3 Existing tests unaffected

PI-4 changes:

- The `vi.mock('@/lib/firestore/followups')` block in the status route test now exports the helper too (via `importOriginal`). This is purely additive — no existing assertion is updated, and all 47 status-route tests still pass with the same green count.
- The `followups.ts` module adds a new export (`resolveProcedureDateForFollowups`) and JSDoc on existing exports. No re-order, no signature change to existing exports.

---

## 6. Build & quality gates

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 warnings |
| `npm run build` | 35 routes, 0 errors |
| Shared First Load JS | 87.4 kB (unchanged from Sprint 7.1 baseline — within 5% budget) |
| Anti-pattern gate (A2 / A9) | 0 violations (matches are pre-existing comments referencing the R-A1 close-out) |

---

## 7. Acceptance criteria (from the Sprint 7.2 plan §1 PI-4)

- [x] **`actualProcedureDate` is the source of truth** — codified by `resolveProcedureDateForFollowups()` and the JSDoc on `CaseRecord.actualProcedureDate`.
- [x] **Priority order** — `actual → expected → now` is enforced both client-side (existing behaviour) and server-side (new helper) and verified by 6 priority tests + 3 integration tests.
- [x] **Backward compatibility** — legacy cases without `actualProcedureDate` still schedule D1–D90 against `expectedProcedureDate` (verified).
- [x] **Storage convention documented** — JSDoc on both `actualProcedureDate` and `expectedProcedureDate` spell out the ISO-8601 + UTC midnight convention.
- [x] **Sprint 7.3 owns the TZ fix** — explicitly cross-referenced in JSDoc; no code change here, per the plan's scope discipline.
- [x] **F-CRIT-08 untouched** — transactional confirm module (`src/lib/payments/transaction.ts`) and confirm route audit shape preserved.
- [x] **F-HIGH-28 untouched** — `recalculateCasePayment` / `recomputeBillFromPayments` / `recomputeBillFromServices` from F-HIGH-28 preserved.
- [x] **PI-1, PI-2, PI-3 untouched** — no changes to billing indicator, refund flow, audit enrichment, or `BillRecomputeIndicator`.

---

## 8. Known limitations / future work

- **Server-side does not yet validate `actualProcedureDate` is set on `procedure_completed`** — pre-PI-4 behaviour persists: the terminal "now" fallback is reached only when both fields are empty, which is rare in production. Sprint 7.3 C.3.2 will pin the invariant (server enforces date capture before status flip).
- **No reconciliation script integration** — the property test for the priority order is in the unit test, not in `scripts/reconcile-payments.ts`. PI-6 owns that script and the source-of-truth payment-history invariant; PI-4 only locks in the *procedure date* contract.
- **No new audit log entry for "procedure date resolved from fallback"** — when the terminal-fallback path is used, no warning is logged. Acceptable for PI-4 (the case is rare and the fallback is intentional); Sprint 7.3 may add a `case_procedure_date_fallback_used` audit trail when the canonical form lands.

---

## 9. Files touched in detail

| Path | Lines | Description |
|------|------:|-------------|
| `src/lib/firestore/followups.ts` | +75 / -0 | New helper + JSDoc. |
| `src/lib/firestore/__tests__/followups.test.ts` | +270 (new) | 15 unit tests. |
| `src/lib/types/case.ts` | +24 / -3 | JSDoc on `actualProcedureDate` + `expectedProcedureDate`. |
| `src/app/api/cases/[id]/status/route.ts` | +12 / -2 | New import + new helper call inside the existing try/catch. |
| `src/app/api/cases/[id]/status/__tests__/route.test.ts` | +140 / -2 | New `Story PI-4` describe block + `importOriginal` mock upgrade. |
| `src/app/(protected)/cases/[id]/page.tsx` | +8 / -2 | Documentation-only inline comment refresh. |

**Net delta:** +527 / -9 across 6 files (excluding the 1 brand-new test file).

---

## 10. Rollback

PI-4 rollback reverts the helper to "always use `expectedProcedureDate ?? new Date()`" (the pre-PI-4 server-side path). It also removes the JSDoc and the 20 new tests. F-CRIT-08, F-HIGH-28, PI-1, PI-2, PI-3 are all untouched and unaffected.

```bash
git revert <pi-4-commit-sha>
```

No data migration required. No feature flag required (the helper is unconditionally called from the route; the legacy cases without `actualProcedureDate` still produce the same `dueDate` they produced pre-PI-4).

---

*End of PI-4 Implementation Report.*
