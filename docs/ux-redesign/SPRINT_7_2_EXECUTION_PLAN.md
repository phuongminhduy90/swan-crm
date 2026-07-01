# Sprint 7.2 — Payment Integrity & Currency Hardening — Execution Plan

> **Sprint:** 7.2 — Payment Integrity, Bill Recompute, Currency Hardening
> **Sprint window:** 5 dev-days, 2–3 FEs (~80h capacity)
> **Committed scope:** ~10 stories, ~36h code + ~6h accountant pairing + ~4h rollback drill = **~46h** against ~80h capacity (~34h buffer)
> **Theme:** Revenue accuracy — F-CRIT-08 (transactional payment confirm) + F-HIGH-28 (bill recompute) + F-HIGH-08 (`<CurrencyInput>`) + 4 new payment-integrity stories
> **Branch:** `main` (stacked commits, Conventional Commits per TD-1 from Sprint 7.1)
> **Backlog source:** [`IMPLEMENTATION_BACKLOG.md`](IMPLEMENTATION_BACKLOG.md) — Stories C.2.1, C.2.3, C.2.4, TD-3 (F-CRIT-08), F-HIGH-28, plus 5 new payment-integrity stories (PI-1..PI-5)
> **Skills applied:** `tech-lead` · `product-owner` · `qa-architect` · `accountant-domain-expert` *(inline)* · `release-manager`
> **Inputs synthesized from:**
> - [`SPRINT_7_EXECUTION_PLAN.md`](SPRINT_7_EXECUTION_PLAN.md) — Section 4.2 (Sprint 7.2 original commitment) + Section 1.2 (TD-3 carry-over) + Appendix C D4
> - [`SPRINT_7_1_COMPLETION_REPORT.md`](SPRINT_7_1_COMPLETION_REPORT.md) — Section 15 (Sprint 7.2 readiness) + Section 10 (remaining risks R-7, R-9) + Appendix B carry-over
> - `product-owner` lens — 10 core case questions Q3 (Total bill?), Q4 (Paid amount?), Q5 (Remaining amount?)
> - `qa-architect` lens — 10-layer test pyramid, concurrency, boundary cases
> - `accountant-domain-expert` lens — Vietnamese medical-clinic accounting practice (double-entry, reconciliation, refund handling, audit trail)
> - `tech-lead` lens — Definition of Done enforcement, build/lint/test gates
> - `release-manager` lens — Pre-release checklist, rollback drill, sign-off chain

---

## 0. Executive Summary

### 0.1 Why this sprint is re-scoped

The parent [`SPRINT_7_EXECUTION_PLAN.md`](SPRINT_7_EXECUTION_PLAN.md) originally allocated Sprint 7.2 to **C.2.1** (`<CurrencyInput>`), **C.2.2** (URL-synced case-detail tabs), **C.2.3** (Reports date filter refetch), and **C.2.4** (shared menu config verification) — a UI-library refactor with ~15h of code.

Since then, **two revenue-critical signals** converged:

1. **TD-3 / F-CRIT-08 (Transactional Payment Confirm)** has been the #1 carry-over item since Sprint 6.4 with severity 🔴. The parent plan acknowledged it as "the #1 money-in-flight risk" (S7-7) but deferred to Phase 8 to keep Sprint 7's scope manageable. The CFO + accountant-lead have since flagged that production payments still lack atomicity guarantees — a Firestore write failure between UI success and audit-log write can leave a payment in an inconsistent state.
2. **F-HIGH-28 (Bill Recompute)** was already on the same carry-over line as TD-3 in the parent's tech-debt table (§1.2) with the qualifier "Deferred to 7.2 (dedicated story)". The current `recalculateCasePayment()` in `src/lib/firestore/payments.ts` mutates `case.amountPaid` and `case.remainingAmount` without recomputing from the source-of-truth sum — bill drift is possible when services are added/removed after a payment exists.

**Decision:** Sprint 7.2 is **re-scoped to pull in both revenue-critical items** and to elevate the accountant pairing from "nice-to-have" to "blocking sign-off". CurrencyInput (C.2.1) and Reports filter (C.2.3) stay because they directly support the revenue flows (input ergonomics + reconciliation view). C.2.2 (URL-synced tabs) is **deferred to Sprint 7.3** — it has no revenue impact and its only downstream consumer (C.5.2 notification deep-links in Sprint 7.5) still has 3 sub-sprints of buffer.

### 0.2 Capacity allocation

| Bucket | Hours | Notes |
|:-------|------:|:------|
| Story code | ~36h | 10 stories |
| Accountant pairing (live walk-through + sign-off) | ~6h | C-6: blocked on accountant-lead calendar (see §4 Risks) |
| Rollback drill (1 dry run + 1 timed) | ~4h | New for this sprint — release-manager owns |
| Buffer (bug fixes, integration, code review) | ~34h | |
| **Total** | **~80h** | |

### 0.3 Critical decisions in this plan

| # | Decision | Rationale |
|:--|:---------|:----------|
| **D7.2-1** | Pull F-CRIT-08 (transactional confirm) into Sprint 7.2 | 🔴 revenue-critical; SoD alone insufficient against partial-write failure |
| **D7.2-2** | Pull F-HIGH-28 (bill recompute) into Sprint 7.2 | Same root cause — bill drift = revenue misreporting |
| **D7.2-3** | Defer C.2.2 (URL tabs) to Sprint 7.3 | No revenue impact; only consumer is C.5.2 in Sprint 7.5 |
| **D7.2-4** | Introduce 5 new "Payment Integrity" stories (PI-1..PI-5) | Bridge gaps surfaced during accountant audit: refund edge cases, reconciliation test seed, bill recompute indicator, payment audit enrichment |
| **D7.2-5** | New feature flag `NEXT_PUBLIC_FEATURE_PAYMENT_TX` (rename from existing draft in BACKLOG View 2 row 3) | Allows staged rollout of transactional confirm; revert path is non-transactional current behavior |
| **D7.2-6** | New feature flag `NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE` | Allows staged rollout of recompute indicator + recompute-on-mutation; revert path is cached bill total |
| **D7.2-7** | Accountant-led reconciliation script (`scripts/reconcile-payments.ts`, dev-mode only) | New — provides a daily-close helper that proves `sum(confirmed payments) − sum(refunds) === case.amountPaid − case.refundedAmount` for every case |
| **D7.2-8** | All commit subjects use Conventional Commits format per TD-1 | First sprint applying the validator; Sprint 7.1 commits were legacy `update` |

### 0.4 What this sprint answers in the 10 core case questions

| Q# | Question | Sprint 7.2 contribution |
|:--:|:---------|:------------------------|
| **Q3** | Total bill? | F-HIGH-28 — recompute from sum of services; no drift |
| **Q4** | Paid amount? | F-CRIT-08 — transactional confirm; atomic `confirmed` state |
| **Q5** | Remaining amount? | F-HIGH-28 — `remaining = bill − paid + refunded`; recomputed on every change |
| — | *Q1, Q2, Q6–Q10* | Out of scope (covered by other sprints) |

---

## 1. Stories Included

> 10 stories committed. CurrencyInput and Reports filter are retained from the original Sprint 7.2 commitment; C.2.2 (URL tabs) and C.2.4 (menu verify quick win) are partially retained (C.2.4 is folded into PI-5 as a sub-task). Five new Payment Integrity stories (PI-1..PI-5) are introduced this sprint.

| # | Story ID | Title | Backlog ref | Owner | Est | Risk | Flag |
|:--|:---------|:------|:------------|:------|----:|:----:|:-----|
| 1 | **C.2.1** | `<CurrencyInput>` primitive (VND thousand-separator) | F-HIGH-08 | FE-1 | 6h | 🟡 | — |
| 2 | **C.2.3** | Reports date filter URL-sync + refetch + active-pill X | F-HIGH-18 | FE-3 | 4h | 🟢 | — |
| 3 | **C.2.4** | Shared menu config verification (folded into PI-5) | F-HIGH-02 (carry) | FE-1 | 0.5h | 🟢 | — |
| 4 | **F-CRIT-08** | Transactional payment confirm (Firestore transaction mock) | TD-3 / F-CRIT-08 | FE-1 | 8h | 🔴 | `PAYMENT_TX` |
| 5 | **F-HIGH-28** | Bill recompute as single source of truth | F-HIGH-28 | FE-1 | 5h | 🟡 | `BILL_RECOMPUTE` |
| 6 | **PI-1** | Bill recompute indicator UI on case detail | new | FE-2 | 2h | 🟢 | `BILL_RECOMPUTE` |
| 7 | **PI-2** | Refund flow: negative payment + recompute integration | new | FE-2 | 3h | 🟡 | `PAYMENT_TX` |
| 8 | **PI-3** | Payment audit enrichment: structured diff + state-transition log | new | FE-2 | 3h | 🟡 | — |
| 9 | **PI-4** | `actualProcedureDate` is still the source of truth for D1–D90 (out-of-scope confirmation; verify Sprint 7.3 owns) | new | FE-3 | 1h | 🟢 | — |
| 10 | **PI-5** | Anti-pattern catalog extension (A10: raw `<input type="number">` for currency) + TD-7 (`'user-001'` fallback cleanup) | TD-6 ext + R-7 | tech-lead | 3h | 🟢 | — |
| 11 | **PI-6** | Accounting QA test seed + reconciliation script | new | FE-3 + accountant | 3h | 🟡 | — |

**Total committed:** ~38.5h code (10 numbered items) + ~6h accountant pairing + ~4h rollback drill = **~48.5h** (revised from §0.2 due to PI-4/PI-6 additions).

> **PI numbering convention:** PI-1..PI-6 are new Payment Integrity stories introduced this sprint. They are not in the global BACKLOG yet — they will be backfilled into `IMPLEMENTATION_BACKLOG.md` View 1 (under a new Epic 3.5 "Payment Integrity" or appended to Epic 3) during Sprint 7.2 execution.

---

## 2. Dependencies

### 2.1 Story-level dependency graph

```
                              ┌─────────────────┐
                              │  C.2.1          │
                              │  CurrencyInput  │ ─── used by every payment/bill form
                              │  (FE-1, 6h)     │
                              └────────┬────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
┌───────────────┐         ┌────────────────────┐         ┌──────────────────────┐
│ F-HIGH-28     │         │  F-CRIT-08         │         │  PI-2                │
│ Bill recompute│◄────────│  Transactional     │────────►│  Refund flow         │
│ (FE-1, 5h)    │  feeds  │  confirm           │  feeds  │  (FE-2, 3h)          │
│               │  recompute │ (FE-1, 8h)      │         │                      │
└───────┬───────┘         └─────────┬──────────┘         └──────────┬───────────┘
        │                           │                              │
        │                           ▼                              │
        │                 ┌────────────────────┐                    │
        │                 │  PI-3              │                    │
        │                 │  Payment audit     │                    │
        │                 │  enrichment        │                    │
        │                 │  (FE-2, 3h)        │                    │
        │                 └────────────────────┘                    │
        │                                                          │
        ▼                                                          ▼
┌───────────────┐                                       ┌──────────────────────┐
│  PI-1         │                                       │  PI-6                │
│  Bill recompute│                                      │  Accounting QA seed  │
│  indicator UI  │                                       │  + reconcile script  │
│  (FE-2, 2h)   │                                       │  (FE-3+acct, 3h)     │
└───────────────┘                                       └──────────────────────┘

   Independent parallel tracks:
   ┌────────────────────┐  ┌──────────────────┐  ┌──────────────────┐
   │  C.2.3             │  │  PI-4            │  │  PI-5            │
   │  Reports filter    │  │  actualProcedure │  │  Anti-pattern    │
   │  (FE-3, 4h)       │  │  Date sanity     │  │  + TD-7 cleanup  │
   │                    │  │  (FE-3, 1h)      │  │  (tech-lead, 3h) │
   └────────────────────┘  └──────────────────┘  └──────────────────┘
```

### 2.2 Sprint-level dependencies

| Prerequisite (from prior sprint) | Used by (Sprint 7.2) | Status |
|:---------------------------------|:---------------------|:-------|
| B.3.1 Payment SoD + server check (Sprint 6.1) | F-CRIT-08 — same-user create+confirm already 403'd; transaction wraps that path | ✅ Done |
| TD-2 Toast API extension `{ title, description, action, duration }` (Sprint 7.1) | PI-2, PI-3 — use new toast API for "Đã hoàn tiền" / "Đã đồng bộ hóa bill" | ✅ Done |
| TD-1 Conventional Commits validator (Sprint 7.1) | All 16 commits in this sprint use `feat:`/`fix:`/`refactor:`/`test:`/`chore:` | ✅ Done |
| TD-6 Anti-pattern pre-commit hook (Sprint 7.1) | PI-5 extends catalog with A10; all commits gated | ✅ Done |
| TD-4 Mock seed expansion (refunds + cancelled case) (Sprint 7.1) | PI-6 reconciliation tests rely on 3 refund payments + 2 cancelled cases | ✅ Done |
| `recalculateCasePayment()` in `src/lib/firestore/payments.ts` (pre-existing) | F-HIGH-28 refactors this to recompute from source-of-truth sum | ✅ Done (will be rewritten) |
| `getAllPayments()` + `getPaymentsByCase()` in `src/lib/firestore/payments.ts` | PI-6 reconciliation script reads these | ✅ Done |

### 2.3 Cross-sprint impact

| Sprint 7.2 output | Downstream consumer (later sprint) |
|:------------------|:------------------------------------|
| `<CurrencyInput>` primitive | Sprint 7.3 (C.3.2 actualProcedureDate form, C.3.3 lab date) |
| `FEATURE_PAYMENT_TX` flag | Sprint 7.5 PH-9 flag promotion planning |
| `FEATURE_BILL_RECOMPUTE` flag | Sprint 7.5 PH-9 flag promotion planning |
| F-HIGH-28 recompute function | Sprint 8+ — discount recalculation, multi-currency |
| PI-6 reconciliation script | Sprint 8 — monthly-close job |

---

## 3. Revenue / Accounting Risks

> The single most important section of this plan. Every accountant sign-off and rollback drill is scoped against these risks.

### 3.1 Risk register

| # | Risk | Severity | Source | Mitigation in this sprint |
|:--|:-----|:---------|:-------|:--------------------------|
| **R7.2-1** | 🔴 **Money in flight** — non-transactional `confirmPayment()` can leave a payment in `pending` state if the audit-log write fails after the status update succeeds. Result: customer paid, but ledger thinks they didn't. | 🔴 | TD-3, current `src/app/api/payments/[id]/confirm/route.ts` + `src/lib/firestore/payments.ts` | **F-CRIT-08** wraps status update + `confirmedBy/confirmedAt` + `case.amountPaid/remainingAmount` recompute + audit log in a single Firestore transaction. Mock-store path simulates `tx.run()` semantics: all-or-nothing in memory. |
| **R7.2-2** | 🔴 **Bill drift** — current `recalculateCasePayment()` adds/subtracts the latest payment to a stored `case.amountPaid`. If a payment is later rejected or refunded, the case total diverges from the sum of confirmed payments. | 🔴 | F-HIGH-28, current `recalculateCasePayment()` | **F-HIGH-28** replaces incremental updates with a pure `recomputeBill(caseId)` function that aggregates from `(payment.amount where status='confirmed') − (payment.amount where paymentType='refund')`. Pure function — idempotent, testable, race-safe. |
| **R7.2-3** | 🟡 **Refund miscounting** — refunds stored as `Payment` with `paymentType: 'refund'` and `status: 'confirmed'`. The current formula may not subtract refunds from `case.amountPaid` (depends on implementation). | 🟡 | `src/lib/firestore/payments.ts` `recalculateCasePayment()` | **PI-2** writes a property test: for any case, `case.amountPaid === sum(confirmed payments) − sum(confirmed refunds)`. Plus server-side check: refund `amount > original payment amount` → 400. |
| **R7.2-4** | 🟡 **Currency input errors** — raw `<input type="number">` allows comma/period input that gets stored as wrong number. VN accountants are not familiar with the `,` decimal convention; they type `1,500,000` and the input silently coerces to `1.5`. | 🟡 | All current payment/bill forms | **C.2.1** `<CurrencyInput>` strips thousand-separators on focus, reformats on blur, rejects non-digit input, pastes safely. A10 anti-pattern closed. |
| **R7.2-5** | 🟡 **Stale reports** — Reports page `dateRange` is in component state; switching range does not refetch from server (mock or real Firestore). Accountant may view stale aggregates. | 🟡 | `src/app/(protected)/reports/page.tsx` + `report-filters.tsx` (current implementation is purely presentational) | **C.2.3** moves `dateRange` into URL `?range=3m`, refetches on change with "Đang lọc…" pill, "Xóa tất cả bộ lọc" clears. |
| **R7.2-6** | 🟡 **Audit log gaps** — current `writeAuditLog()` for payments records `payment_confirmed` / `payment_rejected` but does not record the financial diff (old amount vs new, or before-vs-after bill state). Auditors cannot reconcile ledger to payments. | 🟡 | `src/app/api/payments/[id]/confirm/route.ts` audit call | **PI-3** enriches audit entries with `beforeData`, `afterData` for payments (mirroring B.2.3 PII redaction pattern for the non-PII counterpart). New `AuditAction` variants: `payment_transaction_committed`, `payment_transaction_aborted`, `bill_recomputed`. |
| **R7.2-7** | 🟡 **SoD + transaction interplay** — Firestore transaction that includes a permission check could pass the permission check then fail later, leaving the permission denied-but-allowed artifact. | 🟡 | F-CRIT-08 implementation | Transaction wraps only the data writes, not the permission check. Permission check happens first, then transaction starts. Aborted transaction leaves zero trace (mock + real). |
| **R7.2-8** | 🟡 **Timezone bug** — Vietnam is UTC+7; Firestore stores ISO timestamps in UTC. `paymentDate` entered by accountant as `2026-07-01` may shift to `2026-06-30` when stored, causing date-range filters to miscount. | 🟡 | All payment forms | **PI-4** documents the convention: `paymentDate` is stored as local date string (YYYY-MM-DD) without TZ conversion; reconciliation script asserts `paymentDate >= caseDate - 90 days`. Sprint 7.3 owns the actual fix (C.3.2 actualProcedureDate). |
| **R7.2-9** | 🟢 **Anti-pattern A10 regression** — Sprint 7.1 closed A2/A8/A9/ESC. A10 (raw numeric currency inputs) is still open. Without catalog extension, new `<input type="number">` could be merged. | 🟢 | `scripts/check-anti-patterns.sh` (Sprint 7.1 TD-6) | **PI-5** extends the catalog with A10: `grep -rE "<input[^>]*type=['\"]number['\"][^>]*currency\|<Input[^>]*type=['\"]number['\"]" src/components/`. Triggered at pre-commit. |
| **R7.2-10** | 🟢 **Topbar `'user-001'` fallback** — pre-existing match in `src/components/layout/topbar.tsx:71` flagged by Sprint 7.1 TD-6 smoke test. | 🟢 | Sprint 7.1 R-7 | **PI-5** replaces with `'placeholder'` constant; TD-6 hook `--all` returns 0. |

### 3.2 Revenue integrity property (the test we must hold)

> **Property:** For every case in any state, the following invariant must hold at all times:
>
> ```
> case.amountPaid   === Σ(payment.amount | payment.caseId = case.id AND payment.status = 'confirmed' AND payment.paymentType ≠ 'refund')
> case.refundedAmount === Σ(payment.amount | payment.caseId = case.id AND payment.status = 'confirmed' AND payment.paymentType = 'refund')
> case.remainingAmount === case.totalAmount − case.amountPaid + case.refundedAmount
> ```
>
> The reconciliation script (PI-6) verifies this property against the entire mock store on every CI run. Any violation is a 🔴 release blocker.

### 3.3 Sign-off gates (calendar-bound)

| Gate | Owner | Sub-sprint day | Items | Blocking |
|:-----|:------|:---------------|:------|:---------|
| **C-6** | Accountant-lead (live pairing) | Day 3 | F-CRIT-08 happy path + concurrent confirm simulation + refund > original | `PAYMENT_TX` production promotion |
| **C-7** | Accountant-lead (live pairing) | Day 3 | F-HIGH-28 recompute across 5 case states + reconciliation script | `BILL_RECOMPUTE` production promotion |
| **C-8** | Accountant-lead (sign-off) | Day 5 | Full revenue walkthrough of mock store after all stories merged | Sprint 7.2 sub-sprint DoD |
| **C-9** | Tech-lead + release-manager | Day 5 | Rollback drill timed (target: < 15 min for whole-sprint revert) | Release readiness |

> C-6 and C-7 are **synchronous pairing sessions** (not async review). The accountant-lead must be at the keyboard for at least 60 minutes per session. If unavailable, the sprint holds at Day 3 until rescheduled.

---

## 4. Order of Implementation

### 4.1 Day-by-day plan

| Day | Focus | Stories in flight | Owner allocation |
|:----|:------|:------------------|:-----------------|
| **Day 1** | Foundation: primitive + quick wins | C.2.1 (start), C.2.4 + TD-7 (PI-5 quick wins), C.2.3 (start, parallel) | FE-1: C.2.1 + PI-5/C.2.4 · FE-2: PI-1 prep · FE-3: C.2.3 + PI-4 |
| **Day 2** | CurrencyInput lands; bill recompute scaffold | C.2.1 (complete + integrate into `payment-form.tsx`), F-HIGH-28 (start), C.2.3 (complete), PI-5 complete | FE-1: C.2.1 → F-HIGH-28 · FE-2: PI-1 · FE-3: C.2.3 + PI-4 |
| **Day 3** | **Accountant pairing day** — F-HIGH-28 done, F-CRIT-08 demo | F-HIGH-28 (complete), F-CRIT-08 (start + demo to accountant-lead C-6 + C-7) | FE-1: F-CRIT-08 + C-6/C-7 pairing · FE-2: PI-2 · FE-3: PI-6 reconciliation script |
| **Day 4** | Transactional + audit + integration | F-CRIT-08 (complete), PI-2 (complete), PI-3 (complete) | FE-1: F-CRIT-08 wrap-up + tests · FE-2: PI-2 + PI-3 · FE-3: PI-6 complete + accountant walkthrough |
| **Day 5** | Polish + rollback drill + sign-off | All stories complete; rollback drill (C-9); C-8 sign-off; documentation | All FEs: tests + docs · release-manager: rollback drill · accountant-lead: C-8 |

### 4.2 Implementation order (story-level, within the above)

```
Day 1:
  1. PI-5 (TD-7 + catalog extension)        ← 1h, independent quick win
  2. PI-5 (C.2.4 menu verify)               ← 0.5h, continuation of PI-5
  3. C.2.1 (CurrencyInput)                  ← starts; blocks everything else
  4. C.2.3 (Reports filter) — parallel      ← independent, FE-3 owns
  5. PI-4 (actualProcedureDate sanity)      ← 1h, mostly documentation

Day 2:
  6. C.2.1 (CurrencyInput integration)      ← swaps payment-form.tsx, case-form.tsx
  7. F-HIGH-28 (pure recompute function)    ← pure function, unit-testable first
  8. PI-1 (recompute indicator UI) — parallel after F-HIGH-28 lands
  9. C.2.3 (complete)

Day 3 (accountant pairing):
  10. F-CRIT-08 (transactional confirm)    ← flagship; C-6 + C-7 pairing
  11. PI-6 (reconciliation script)         ← FE-3 + accountant, parallel

Day 4:
  12. F-CRIT-08 (complete + tests)
  13. PI-2 (refund flow integration)
  14. PI-3 (audit enrichment)

Day 5:
  15. PI-1 (complete if not already)
  16. Rollback drill (C-9)
  17. C-8 sign-off
  18. Documentation (per-story implementation report + migration notes + sub-sprint completion report)
```

### 4.3 Parallel tracks

```
Track A (FE-1, ~24h): C.2.1 → F-HIGH-28 → F-CRIT-08 → final integration
Track B (FE-2, ~8h):  PI-1 → PI-2 → PI-3
Track C (FE-3, ~8h):  C.2.3 → PI-4 → PI-6
Track D (tech-lead, ~3h): PI-5 (catalog + TD-7)
Track E (accountant-lead, ~6h): C-6 + C-7 + C-8 (pairing only — no code)
Track F (release-manager, ~4h): C-9 rollback drill
```

---

## 5. Files Affected

> Read-only confirmation before sprint execution: the file paths below reflect the codebase as of Sprint 7.1 close (per the `Agent` exploration). Any drift detected at the start of Day 1 must be reconciled in the per-story implementation report.

### 5.1 New files

| Path | Story | Purpose | Approx LOC |
|:-----|:------|:--------|-----------:|
| `src/components/ui/currency-input.tsx` | C.2.1 | VND-thousand-separator input primitive | ~180 |
| `src/components/ui/__tests__/currency-input.test.tsx` | C.2.1 | Formatting, focus/blur, paste, IME, accessibility | ~350 |
| `src/lib/billing/recompute.ts` | F-HIGH-28 | Pure `recomputeBill(caseId, store)` function — single source of truth | ~80 |
| `src/lib/billing/__tests__/recompute.test.ts` | F-HIGH-28 | Property test: `Σ(confirmed) − Σ(refunds) === case.amountPaid − case.refundedAmount` | ~200 |
| `src/lib/payments/transaction.ts` | F-CRIT-08 | `confirmPaymentTransaction(paymentId, user)` — wraps writes in Firestore `runTransaction` (real) or mock-store simulation (dev) | ~120 |
| `src/lib/payments/__tests__/transaction.test.ts` | F-CRIT-08 | Happy path, concurrent confirm (only one wins), abort → no writes | ~250 |
| `src/lib/payments/refund.ts` | PI-2 | `createRefund(originalPaymentId, amount, note, user)` — validation, recompute integration | ~100 |
| `src/lib/payments/__tests__/refund.test.ts` | PI-2 | Refund > original → reject, partial refund, recompute side effect | ~150 |
| `src/lib/audit/payment-audit.ts` | PI-3 | `writePaymentAudit()` — structured diff (before/after non-PII fields) | ~70 |
| `src/lib/audit/__tests__/payment-audit.test.ts` | PI-3 | Diff formatting, redaction consistency with B.2.3 | ~120 |
| `src/lib/types/billing.ts` | F-HIGH-28 + PI-1 | `BillSnapshot`, `RecomputeTrigger`, `RecomputeStatus` types | ~40 |
| `src/lib/types/audit.ts` (extend, not new) | PI-3 | Add `payment_transaction_committed`, `payment_transaction_aborted`, `bill_recomputed` to `AuditAction` union | +5 |
| `src/components/cases/bill-recompute-indicator.tsx` | PI-1 | Visual chip: "Đã đồng bộ hóa lúc HH:mm" / "Đang đồng bộ hóa..." | ~80 |
| `src/test/fixtures/payment-scenarios.ts` | PI-6 | Accounting edge-case fixtures: partial + full + refund chain, cancelled case with prior payments, multi-currency-stripped | ~180 |
| `src/test/__tests__/reconciliation-property.test.ts` | PI-6 | Property test against mock store — verifies §3.2 invariant | ~120 |
| `scripts/reconcile-payments.ts` | PI-6 | Daily-close helper (dev-only) — reads mock store, prints reconciliation report | ~100 |
| `docs/ux-redesign/SOP_REVENUE_RECONCILIATION.md` | PI-6 | Accountant SOP: when to run reconcile, how to interpret output, escalation paths | ~150 |

### 5.2 Modified files

| Path | Story | Change scope |
|:-----|:------|:-------------|
| `src/components/cases/case-form.tsx` | C.2.1 | Replace raw `<input type="number">` for `discountValue`, `amountPaid`, `listedPrice`, `finalPrice` (3 inputs total) with `<CurrencyInput>` |
| `src/components/payments/payment-form.tsx` | C.2.1 | Replace raw `<Input type="number">` for `amount` with `<CurrencyInput>` (1 input) |
| `src/components/payments/payment-list.tsx` | C.2.1 | Use `<CurrencyInput>` in row display format (read-only mode) |
| `src/components/payments/payment-confirm-dialog.tsx` | F-CRIT-08 | On confirm, show "Đang xử lý..." state, optimistic update with rollback on transaction abort |
| `src/lib/firestore/payments.ts` | F-CRIT-08 + F-HIGH-28 | Rewrite `confirmPayment` to delegate to `confirmPaymentTransaction`; rewrite `recalculateCasePayment` to delegate to `recomputeBill` (kept as backward-compat wrapper) |
| `src/lib/firestore/cases.ts` | F-HIGH-28 | Export `recomputeBill(caseId)` helper; trigger on service add/remove |
| `src/app/api/payments/[id]/confirm/route.ts` | F-CRIT-08 | Switch to transactional path (behind `FEATURE_PAYMENT_TX` flag); preserve SoD check |
| `src/app/api/payments/[id]/reject/route.ts` | F-HIGH-28 | After reject, trigger `recomputeBill(caseId)` |
| `src/app/api/payments/route.ts` | F-HIGH-28 | After create, trigger `recomputeBill(caseId)` for any case with existing payments (idempotent) |
| `src/app/api/payments/refund/route.ts` (new) | PI-2 | New endpoint: `POST /api/payments/refund` — creates refund payment, validates amount ≤ original |
| `src/app/(protected)/cases/[id]/page.tsx` | PI-1 | Render `<BillRecomputeIndicator>` next to "Tổng bill" in Info tab; show "Đã đồng bộ hóa HH:mm" or "Đang đồng bộ hóa" |
| `src/app/(protected)/payments/page.tsx` | PI-2 + PI-3 | Refund action button (admin + accountant + creator); audit log link per payment row |
| `src/app/(protected)/reports/page.tsx` | C.2.3 | Move `dateRange` to URL `?range=3m`; refetch on change; "Đang lọc…" pill during fetch |
| `src/components/reports/report-filters.tsx` | C.2.3 | Active pill gets checkmark + X icon; "Xóa tất cả bộ lọc" button; toast on clear |
| `src/components/layout/topbar.tsx` | PI-5 (TD-7) | Replace `'user-001'` fallback at line 71 with `'placeholder'` constant |
| `scripts/check-anti-patterns.sh` | PI-5 | Extend catalog with A10 regex (raw `<input type="number">` with currency context) |
| `CONTRIBUTING.md` | PI-5 | Document A10 pattern + recovery action |
| `src/lib/mock/store.ts` | PI-6 | Add `recomputeBill()` to mock-store helpers; ensure idempotent |
| `.env.local.example` | F-CRIT-08 + F-HIGH-28 | Add `NEXT_PUBLIC_FEATURE_PAYMENT_TX` and `NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE` (dev: true; prod: false) |
| `src/lib/__tests__/commit-msg.test.ts` | PI-5 | Add test case for `feat(payments)!: ...` (breaking change marker on F-CRIT-08 if API changes) |

### 5.3 Files explicitly NOT touched (scope discipline)

- ❌ `src/components/ui/tooltip.tsx`, `tabs.tsx`, `modal.tsx`, `confirm-dialog.tsx` — no changes to existing primitives
- ❌ `src/components/customers/*` — out of scope this sprint
- ❌ `src/components/consents/*` — Sprint 7.4 scope (consent PDF upload)
- ❌ `src/components/followups/*` — Sprint 7.5 scope (timeline colors, D1 ring-stat)
- ❌ `src/components/dashboard/stat-cards.tsx` — Sprint 7.5 scope (D1 ring-stat, followup visualization)
- ❌ `src/app/(protected)/calendar/page.tsx` — Sprint 7.5 scope (caseId search-and-select)
- ❌ `src/app/(protected)/cases/[id]/page.tsx` URL-sync — **deferred to Sprint 7.3** (this sprint only adds `<BillRecomputeIndicator>`)
- ❌ `firestore.rules` / `storage.rules` / `firebase.json` — Sprint 7.4 C-4 scope
- ❌ `vercel.json` — Sprint 7.5 C-5 scope
- ❌ `package.json` — no new dependencies (uses existing Firestore SDK + zod + RHF)

---

## 6. Test Strategy

> `qa-architect` lens — 10-layer pyramid applied to revenue paths. Every layer must hold before merge.

### 6.1 Layer-by-layer plan

| # | Layer | Tool | What we test in Sprint 7.2 | Target test count |
|:--|:------|:-----|:---------------------------|------------------:|
| **L1** | Functional | Vitest + RTL | C.2.1 CurrencyInput formats/blurs/IME; C.2.3 filter refetch; PI-1 indicator states | +18 |
| **L2** | Validation | Vitest + Zod | CurrencyInput rejects negatives, scientific notation, paste with letters; PI-2 refund amount validation | +8 |
| **L3** | Workflow | Vitest state machine | Full payment lifecycle: create → confirm → refund → recompute → audit; cancelled case handling | +10 |
| **L4** | Permission | Vitest + 12-role fixtures | SoD: accountant cannot confirm; admin cannot confirm own; refund: creator + admin only | +6 |
| **L5** | Security | Vitest + audit mocks | PII redaction still applies (B.2.3 regression); audit log entries redact nationalIdNumber, medicalNote, privacyNote | +4 |
| **L6** | Integration | Vitest + Next.js route mocks | `/api/payments/[id]/confirm` transactional path; `/api/payments/refund` end-to-end; `/api/payments` create triggers recompute | +10 |
| **L7** | Performance | Manual timing | CurrencyInput focus/blur < 50ms; recompute on 100-payment case < 200ms (mock) | manual |
| **L8** | Data integrity | Property test (fast-check) | §3.2 invariant: `Σ(confirmed) − Σ(refunds) === case.amountPaid − case.refundedAmount` for 1000 randomized case states | +6 |
| **L9** | Mobile/responsive | Playwright (existing harness) | CurrencyInput touch keyboard behavior at 360/390/768/1280; recompute indicator visible | +4 |
| **L10** | Regression | Full suite | Sprint 6.1–6.4 + 7.1 must still pass; no payment-related test delta outside expected | existing |

**Target new tests: +66** (683 Sprint 6.4 baseline + 118 Sprint 7.1 + ~66 = **~867 vitest cases across ~46 files**).

### 6.2 Critical risk scenarios (must have explicit tests)

| # | Scenario | Test file | Why critical |
|:--|:---------|:----------|:-------------|
| **S1** | Two admins click "Xác nhận" on the same payment at the same time | `transaction.test.ts` | Only one confirm wins; the other receives 409 Conflict or sees already-confirmed state |
| **S2** | Audit log write fails after status update succeeds (mock by throwing in audit hook) | `transaction.test.ts` | Transaction aborts; payment returns to `pending`; no audit entry written; client sees error toast and can retry |
| **S3** | Confirm a payment, then refund it for more than the original | `refund.test.ts` | 400 error: "Hoàn tiền vượt quá số tiền gốc" |
| **S4** | Confirm, refund, then check `case.amountPaid` and `case.refundedAmount` | `recompute.test.ts` | Both values reflect the transaction history, not the last write |
| **S5** | Add a service to a case that already has 3 confirmed payments | `recompute.test.ts` | `case.totalAmount` updates; `case.remainingAmount` recomputes from new total − paid + refunded |
| **S6** | Reject a payment that was the only confirmed payment on a case | `recompute.test.ts` | `case.amountPaid` drops to 0; `case.remainingAmount` recomputes |
| **S7** | Cancel a case with confirmed payments + refunds | `recompute.test.ts` + state machine | Cancellation flags `case.cancelledAt`; recompute still functions (used for refund processing) |
| **S8** | Paste `1,500,000` (comma) into CurrencyInput | `currency-input.test.tsx` | Input rejects or converts to `1.500.000` (period) — never silently coerces to `1.5` |
| **S9** | Paste `-500` into CurrencyInput | `currency-input.test.tsx` | Input rejects with inline error "Số tiền phải là số dương" |
| **S10** | Vietnamese IME composition in progress while typing | `currency-input.test.tsx` | Cursor position preserved; no premature blur; value unchanged during composition |
| **S11** | Reports date filter: switch from 3 tháng to Tất cả | `reports-date-filter.test.tsx` | URL updates to `?range=0`; data refetches; "Đang lọc…" pill visible during fetch |
| **S12** | Reports date filter: X icon on active pill | `reports-date-filter.test.tsx` | Click X resets to default (3 tháng); URL clears |
| **S13** | Reconciliation script run against corrupted mock store (manually inject `amountPaid: 99999` mismatch) | `reconciliation-property.test.ts` | Script reports violation; CI fails |
| **S14** | Audit log: confirm a payment that changes `amountPaid` | `payment-audit.test.ts` | Audit entry includes `beforeData.amountPaid` and `afterData.amountPaid` (non-PII fields, full diff) |
| **S15** | Audit log: refund → confirm audit entry has `paymentType: 'refund'` and links to original | `payment-audit.test.ts` | Auditors can trace refund chain |

### 6.3 Negative + boundary cases (qa-architect checklist)

| Boundary | CurrencyInput | Payment amount | Refund |
|:---------|:--------------|:---------------|:-------|
| Empty | "" (placeholder "0" displayed) | submit blocked | n/a |
| Zero | "0" | 400 (deposit must be > 0) | n/a |
| Negative | rejected inline | n/a (input rejects) | rejected server-side |
| `Number.MAX_SAFE_INTEGER` | display truncated to "..." | accepted, recompute handles | rejected (> original anyway) |
| `0.5` | rejected (no decimals in VND) | rejected | rejected |
| `1e10` | accepted, formats as "10.000.000.000" | accepted | rejected |
| Whitespace only | rejected | n/a | n/a |
| 1,500,000 (comma) | converts to 1.500.000 | n/a | n/a |
| 1.500.000 (period) | accepted as 1500000 | accepted | accepted |

### 6.4 Anti-pattern gate extensions (PI-5)

| # | Anti-pattern | Regex | Scope | Catalog change |
|:--|:-------------|:------|:------|:---------------|
| A10 | Raw `<input type="number">` for currency | `<[iI]nput[^>]*(type=['"]number['"])[^>]*(currency\|amount\|price\|VNĐ\|tiền)` | `src/components/` | **New in Sprint 7.2** — closes C.2.1 prerequisite |
| A24 | SoD violation (same role create + confirm payment) | already covered by B.3.1 tests | n/a | Already in L4 suite; no catalog change needed |

### 6.5 Verification commands (per-story)

```bash
# Per-story test execution (run during Day 5 verification)
npx vitest run src/components/ui/__tests__/currency-input.test.tsx
npx vitest run src/lib/billing/__tests__/recompute.test.ts
npx vitest run src/lib/payments/__tests__/transaction.test.ts
npx vitest run src/lib/payments/__tests__/refund.test.ts
npx vitest run src/lib/audit/__tests__/payment-audit.test.ts
npx vitest run src/test/__tests__/reconciliation-property.test.ts
npx vitest run src/components/reports/__tests__/report-filters.test.tsx

# Property test (Sprint 7.2 critical)
npx vitest run --reporter=verbose src/test/__tests__/reconciliation-property.test.ts

# Reconciliation script (dev-mode)
NEXT_PUBLIC_DEV_MODE=true npx tsx scripts/reconcile-payments.ts

# Anti-pattern gate
bash scripts/check-anti-patterns.sh --all
```

---

## 7. Rollback Strategy

> `release-manager` lens — every story must be revertable in < 5 minutes with documented blast radius.

### 7.1 Per-story rollback

| Story | Rollback mechanism | Blast radius | RTO | Data impact |
|:------|:-------------------|:-------------|:----|:------------|
| **C.2.1** CurrencyInput | `git revert <sha>`; or swap `<CurrencyInput>` back to `<Input type="number">` in 3 call sites | 3 input fields revert to raw numeric | < 5 min | None — pure UI swap |
| **F-CRIT-08** Transactional confirm | `git revert <sha>` AND set `NEXT_PUBLIC_FEATURE_PAYMENT_TX=false` in env | Reverts to non-transactional path; **any in-flight confirmations during the revert window may need manual verification** | < 5 min | **Potential 🟡** — pending payments in the mock store at revert time may have inconsistent audit; reconciliation script must be run post-revert |
| **F-HIGH-28** Bill recompute | `git revert <sha>` AND set `NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE=false` | Reverts to incremental `recalculateCasePayment`; `case.amountPaid` reverts to last incremental value (may be drifted) | < 5 min | **Potential 🟡** — reconciliation script must be run post-revert to detect drift |
| **C.2.3** Reports filter | `git revert <sha>` | Filter reverts to in-component state; no refetch on change | < 1 min | None |
| **PI-1** Recompute indicator | `git revert <sha>` | Visual chip disappears | < 1 min | None |
| **PI-2** Refund flow | `git revert <sha>` AND disable `/api/payments/refund` endpoint (mark as deprecated, do not delete) | Refunds revert to manual "create payment with paymentType=refund" workflow | < 10 min | None — refunds still possible via legacy path |
| **PI-3** Audit enrichment | `git revert <sha>` | Audit entries revert to non-diff format; auditors lose financial diff but keep status change records | < 1 min | None |
| **PI-4** actualProcedureDate sanity | `git revert <sha>` (mostly documentation; no code change) | n/a | < 1 min | None |
| **PI-5** Anti-pattern catalog | `git revert <sha>` removes A10 from catalog | A10 unchecked; new raw currency inputs may slip in | < 1 min | None |
| **PI-6** Reconciliation seed + script | `git revert <sha>` removes dev-only fixtures | Mock store reverts to prior seed; reconciliation script unavailable | < 1 min | None — dev-only |

### 7.2 Whole-sprint rollback (catastrophic recovery)

```bash
# Find Sprint 7.2 commits
git log --oneline -n 20 | grep -E "(feat|fix|refactor|test|chore)\("

# Revert all Sprint 7.2 commits in reverse order
git revert --no-commit <last-7.2-sha>..HEAD~<n-commits-before-7.2>

# Verify
npx tsc --noEmit && npm run lint && npm run build && npx vitest run

# Run reconciliation script (mock-mode) to detect drift
NEXT_PUBLIC_DEV_MODE=true npx tsx scripts/reconcile-payments.ts

# Total time: < 20 minutes (includes reconciliation check)
# Data impact: Potential drift in case.amountPaid/remainingAmount if F-HIGH-28 reverted after some production confirmations
# Effect: Sprint 7.1 surface fully preserved
```

### 7.3 Rollback drill (C-9, Day 5)

The release-manager runs a **timed rollback drill** on Day 5 before sign-off:

1. **Scenario A — single-story revert** (target: < 5 min): Revert F-CRIT-08 commit only. Verify build/lint/tests pass. Re-apply.
2. **Scenario B — whole-sprint revert** (target: < 20 min): Revert all Sprint 7.2 commits. Verify build/lint/tests pass. Run reconciliation script — must report zero drift (proves F-HIGH-28 had no committed state).
3. **Scenario C — flag flip in prod** (target: < 1 min): With both `PAYMENT_TX=false` and `BILL_RECOMPUTE=false`, behavior must revert to non-transactional + incremental recompute. Smoke test confirms.

If any scenario exceeds its target, the story's "rollback ready" check fails and the story is held until blast radius is reduced.

### 7.4 Recovery actions if production drift is detected post-revert

If `scripts/reconcile-payments.ts` (or equivalent production reconciliation) reports drift after a revert:

1. **Read drift report** — identifies which cases have `case.amountPaid ≠ Σ(confirmed payments)`.
2. **Manual ledger reconciliation** — accountant-lead manually corrects `case.amountPaid` from the source-of-truth payment history.
3. **Audit log entry** — `writeAuditLog({ action: 'manual_ledger_correction', actor: accountant-lead.uid, notes: drift report reference })`.
4. **Post-mortem** — root cause analysis; if F-HIGH-28 was the culprit, do not re-enable flag without redesign.

---

## 8. Definition of Done

### 8.1 Per-story Definition of Done

For each of the 10 stories in Sprint 7.2:

- [ ] **UI complete** — every acceptance criterion from BACKLOG View 1 (or PI spec) met
- [ ] **Validation implemented** — Vietnamese error messages; no silent failures (e.g., `1,500,000` → `1.5` is **never** silent)
- [ ] **Loading, error, empty states** — at least one of each designed for `confirmPayment`, refund, recompute flows
- [ ] **RBAC enforced** — no permission expansion or contraction; SoD (B.3.1) preserved through transactional path
- [ ] **Audit log** — sensitive actions logged via `writeAuditLog()` or `writePaymentAudit()` with structured diff (PI-3)
- [ ] **Firestore real data** — no mock-data-only branches; transactional path works against real Firestore SDK `runTransaction` (with mock-store simulation for dev mode)
- [ ] **Firebase errors handled** — `try/catch` on every async path; error toast on failure using TD-2 extended API
- [ ] **Mobile responsive** — CurrencyInput tested at 360 / 390 / 768 / 1280 px; recompute indicator visible at all viewports
- [ ] **Vietnamese copy** — every user-facing string reviewed by ux-designer
- [ ] **Premium theme preserved** — no new tokens, no color drift, no spacing drift
- [ ] **A11y** — axe-core 0 critical on touched route; CurrencyInput has `aria-required`, `aria-invalid`, `aria-describedby`
- [ ] **Property test passing** — for F-HIGH-28, F-CRIT-08, PI-2: §3.2 invariant holds for 1000 randomized cases
- [ ] **Unit + integration tests written** — happy path + negative case coverage (per §6.2)
- [ ] **`tsc --noEmit` → 0 errors**
- [ ] **`npm run lint` → 0 warnings**
- [ ] **`npm run build` → 34 routes (or more), 0 errors, no bundle bloat (≤ 5% delta)**
- [ ] **Anti-pattern grep clean** — A1/A2/A8/A9/**A10**/A22/A26 greps pass (A10 newly enforced)
- [ ] **Paired review approved** — for 🟡 and 🔴 stories (F-CRIT-08 + F-HIGH-28 + PI-2)
- [ ] **Implementation report + migration notes written** — per-story, in `docs/ux-redesign/`

### 8.2 Sub-sprint Definition of Done (Sprint 7.2 close)

- [ ] All 10 committed stories pass per-story DoD
- [ ] Build & quality gates green (§8.3)
- [ ] Anti-pattern gate clean (including new A10)
- [ ] Cross-sprint regression verified (Sprint 6.1–7.1 still pass)
- [ ] Feature flag inventory updated (2 new flags added)
- [ ] Reconciliation script (`scripts/reconcile-payments.ts`) runs clean against mock store
- [ ] §3.2 property test passes for 1000 randomized cases
- [ ] Rollback drill (C-9) executed and timed within targets
- [ ] Documentation complete: 10 implementation reports + 10 migration notes + 1 sub-sprint completion report
- [ ] Sign-off chain populated:
  - C-6 accountant pairing (F-CRIT-08) ✅
  - C-7 accountant pairing (F-HIGH-28) ✅
  - C-8 accountant full revenue walkthrough ✅
  - C-9 rollback drill timed ✅
  - tech-lead code review ✅
  - qa-architect test pyramid density (≥ 5 tests/KLOC) ✅
  - release-manager flag inventory + rollback SOP ✅

### 8.3 Build & quality gates

| Gate | Command | Target |
|:-----|:--------|:-------|
| TypeScript | `npx tsc --noEmit` | 0 errors |
| TypeScript (tests) | `npx tsc -p tsconfig.test.json --noEmit` | 0 errors |
| ESLint | `npm run lint` | 0 warnings |
| Production build | `npm run build` | 34+ routes, 0 errors, ≤ 92 kB shared JS (+5% max from Sprint 7.1's 87.4 kB) |
| Unit + a11y tests | `npx vitest run` | All green, ≥ 867 tests across ≥ 46 files |
| Property test | `npx vitest run src/test/__tests__/reconciliation-property.test.ts` | 1000/1000 randomized cases pass |
| Reconciliation script | `NEXT_PUBLIC_DEV_MODE=true npx tsx scripts/reconcile-payments.ts` | Zero drift reported |
| Bundle delta | First Load JS shared | ≤ 5% increase from Sprint 7.1 baseline |

### 8.4 Anti-pattern gate (cumulative post-Sprint 7.2)

| # | Anti-pattern | Check | Sprint 7.2 closure |
|:--|:-------------|:------|:-------------------|
| A1 | Silent fallback defaults (`caseId='general'`) | Grep for `'general'` | Sprint 7.5 (C.5.6) — not this sprint |
| A2 | Raw IDs in UI | Grep for `user-\d{3}` | Closed in 6.3 |
| A7 | Hand-rolled tabs/modals | Grep for inline `useState` tab patterns | Closed in 7.1 (C.1.2 + C.1.3) |
| A8 | Dead links | No `href="#"` with "Đang phát triển" | Closed in 6.3 |
| A9 | Native `confirm()`/`alert()` | Grep `window.confirm`, `window.alert` | Closed in 6.4 |
| **A10** | Raw numeric currency inputs | Grep for raw `<input type="number">` with currency context | **Closed in Sprint 7.2 (C.2.1 + PI-5)** |
| A14 | Consent as progressive | Binary: granted or absent | Sprint 7.4 (C.4.1 + C.4.2) |
| A22 | Modal for 22-field form on mobile | Use full-screen sheet | Closed in 6.4 |
| A23 | Deletion without per-record audit | Cascade audit enforced | Sprint 7.4 (C.4.4) |
| A26 | C-3 source drift | `git diff` from baseline | Playwright harness in 6.4 |
| ESC | `eslint-disable.*no-alert` | Grep | Closed in 7.1 |

### 8.5 Revenue accuracy sign-off (C-8)

The accountant-lead (or designate) must complete this checklist before Sprint 7.2 closes:

- [ ] **C-6** Walked through F-CRIT-08 happy path: created payment as sales, confirmed as admin, observed atomic commit (status + audit + case.amountPaid all in sync)
- [ ] **C-6** Simulated concurrent confirm: two admins clicked confirm simultaneously — only one succeeded; the other saw "Đã được xác nhận bởi [name]"
- [ ] **C-6** Simulated audit failure: audit log write was forced to fail — transaction aborted; payment returned to pending; no partial state
- [ ] **C-7** Walked through F-HIGH-28: added a service to a case with 3 confirmed payments — observed `case.amountPaid` unchanged, `case.totalAmount` increased, `case.remainingAmount` recomputed
- [ ] **C-7** Refunded a partial payment — observed `case.refundedAmount` increased, `case.remainingAmount` recomputed from new formula
- [ ] **C-7** Rejected a confirmed payment — observed `case.amountPaid` decreased, `case.remainingAmount` recomputed
- [ ] **C-8** Ran `scripts/reconcile-payments.ts` against full mock store — observed zero drift across all 21 cases
- [ ] **C-8** Reviewed 5 random payment audit entries from PI-3 — confirmed before/after diff is readable and contains the right fields
- [ ] **C-8** Confirmed that the refund > original validation (PI-2) blocks a manually-constructed refund attempt

If any item fails, the relevant story is held and the sign-off is deferred.

---

## 9. Recommended Commit Sequence

> First sprint applying Conventional Commits per TD-1 (Sprint 7.1). 16 commits, all using the format `feat|fix|refactor|test|chore|docs(scope): subject`. Commits are ordered to land in a buildable state after each step.

| # | Commit subject | Story | Approx LOC | Buildable? |
|:--|:---------------|:------|-----------:|:-----------|
| 1 | `chore(ui): scaffold CurrencyInput directory + test stub` | C.2.1 prep | +10 | ✅ Yes |
| 2 | `feat(ui): add CurrencyInput primitive with VND formatting` | C.2.1 | +180 | ✅ Yes (not yet integrated) |
| 3 | `test(ui): CurrencyInput formatting/focus/blur/paste/IME coverage` | C.2.1 | +350 | ✅ Yes |
| 4 | `refactor(cases): adopt CurrencyInput in case discount and amount fields` | C.2.1 | +20 / −20 | ✅ Yes |
| 5 | `refactor(payments): adopt CurrencyInput in payment amount field` | C.2.1 | +15 / −10 | ✅ Yes |
| 6 | `feat(billing): add pure recomputeBill function` | F-HIGH-28 part 1 | +80 | ✅ Yes (parallel to old `recalculateCasePayment`) |
| 7 | `test(billing): property test for recompute invariant` | F-HIGH-28 part 1 | +200 | ✅ Yes |
| 8 | `refactor(payments): delegate confirmPayment to recomputeBill (feature-flagged)` | F-HIGH-28 part 2 + F-CRIT-08 prep | +60 / −30 | ✅ Yes (behind `FEATURE_BILL_RECOMPUTE`) |
| 9 | `feat(payments): transactional confirmPayment with Firestore runTransaction mock` | F-CRIT-08 | +120 | ✅ Yes (behind `FEATURE_PAYMENT_TX`) |
| 10 | `test(payments): concurrent confirm + audit failure + abort coverage` | F-CRIT-08 | +250 | ✅ Yes |
| 11 | `feat(payments): refund flow with negative-amount validation` | PI-2 | +100 | ✅ Yes (behind `FEATURE_PAYMENT_TX`) |
| 12 | `feat(audit): payment_transaction_committed/aborted + bill_recomputed actions + structured diff` | PI-3 | +70 / +5 (AuditAction union) | ✅ Yes |
| 13 | `feat(cases): bill recompute indicator UI on case detail` | PI-1 | +80 | ✅ Yes (behind `FEATURE_BILL_RECOMPUTE`) |
| 14 | `feat(reports): date range URL-sync + refetch + active-pill X icon` | C.2.3 | +40 / −20 | ✅ Yes |
| 15 | `chore(layout): replace user-001 fallback with placeholder constant` | PI-5 (TD-7) | +2 / −2 | ✅ Yes |
| 16 | `chore(hooks): extend anti-pattern catalog with A10 (raw currency inputs)` | PI-5 (catalog) | +5 / −0 | ✅ Yes |
| 17 | `test(fixtures): accounting edge-case seed + reconciliation property test` | PI-6 | +300 | ✅ Yes |
| 18 | `chore(scripts): add reconcile-payments daily-close helper` | PI-6 | +100 | ✅ Yes |
| 19 | `docs(sop): add SOP_REVENUE_RECONCILIATION.md` | PI-6 | +150 | ✅ Yes |
| 20 | `docs(ux-redesign): sprint 7.2 implementation reports + migration notes + completion report` | docs | +~3000 | ✅ Yes |

**Total:** ~20 commits. Sprint 7.1 commit subjects were legacy `update`; this is the first sprint using Conventional Commits format end-to-end. The TD-1 hook (`scripts/check-commit-msg.sh`) will block any commit subject that does not match the format — pre-commit or via CI.

---

## 10. Manual QA Checklist

> To be executed manually by QA + accountant-lead before Sprint 7.2 close. Every item must pass.

### 10.1 CurrencyInput (C.2.1) — 18 checks

- [ ] Open `/payments/new`, type `1500000`, blur → input shows `1.500.000`
- [ ] Type `1500000`, focus → input shows `1500000` (separators stripped)
- [ ] Paste `1,500,000` (comma) → input rejects or converts to `1.500.000` (never silently coerces to `1.5`)
- [ ] Paste `1.500.000` (period) → input accepts as `1.500.000` (= 1500000)
- [ ] Type `abc` → input rejects with inline error
- [ ] Type `-500` → input rejects with inline error "Số tiền phải là số dương"
- [ ] Type `0.5` → input rejects with inline error "Số tiền phải là số nguyên"
- [ ] Type `1e10` → input accepts, blur shows `10.000.000.000`
- [ ] Vietnamese IME composition active while typing → cursor preserved, no premature blur
- [ ] Empty submit → form validation error "Vui lòng nhập số tiền"
- [ ] CurrencyInput at 360 px viewport → touch target ≥ 44×44 px
- [ ] CurrencyInput with `aria-required="true"` → screen reader announces required
- [ ] CurrencyInput with `aria-invalid="true"` after invalid input → screen reader announces error
- [ ] Open `/cases/new` step 2, verify discount field uses CurrencyInput
- [ ] Edit an existing case, verify amountPaid field shows formatted value on load
- [ ] Tab key cycles through CurrencyInput correctly (does not break form flow)
- [ ] Right-click → paste in CurrencyInput works same as Ctrl+V
- [ ] axe-core scan of `/payments/new` → 0 critical violations

### 10.2 Transactional payment confirm (F-CRIT-08) — 10 checks

- [ ] Sales creates payment of `5.000.000 VNĐ` for case #1 → payment shows status `Chờ xác nhận`
- [ ] Sales tries to confirm own payment → 403 "Bạn không thể xác nhận phiếu thanh toán do chính mình tạo"
- [ ] Admin opens confirm dialog → reads side-effect summary (paid amount delta, remaining amount delta)
- [ ] Admin clicks "Xác nhận" → success toast "Đã xác nhận thanh toán"; payment status flips to `Đã xác nhận`
- [ ] `case.amountPaid` increases by `5.000.000`; `case.remainingAmount` decreases by `5.000.000`
- [ ] Audit log entry written with `action: 'payment_transaction_committed'`, `entity: 'payment'`, `beforeData.amountPaid`, `afterData.amountPaid`
- [ ] Open DevTools, simulate audit failure → click confirm → error toast "Không thể xác nhận thanh toán, vui lòng thử lại"; payment returns to `Chờ xác nhận`; no audit entry written
- [ ] Two browser tabs, both as admin, click confirm simultaneously → only one succeeds; the other sees "Đã được xác nhận bởi [name]"
- [ ] Verify `scripts/reconcile-payments.ts` reports zero drift after the above
- [ ] Flag `NEXT_PUBLIC_FEATURE_PAYMENT_TX=false` → behavior reverts to non-transactional (smoke)

### 10.3 Bill recompute (F-HIGH-28) — 8 checks

- [ ] Open case #5 (has 3 confirmed payments totaling `15.000.000`); info tab shows `Đã thanh toán: 15.000.000`
- [ ] Add a service `Bộ kit chăm sóc da` worth `2.000.000` → info tab updates within 1 second; `Tổng bill` increases; `Còn lại` recomputes
- [ ] Remove that service → `Tổng bill` returns to original; `Còn lại` recomputes
- [ ] Confirm a payment on a case with no prior payments → `Đã thanh toán` shows the new amount; `Còn lại` shows the remainder
- [ ] Reject a confirmed payment → `Đã thanh toán` decreases; `Còn lại` recomputes
- [ ] Bill recompute indicator shows "Đã đồng bộ hóa HH:mm" after any change
- [ ] Indicator turns to "Đang đồng bộ hóa..." during recompute (transient state)
- [ ] Property test against 1000 randomized cases passes (CI gate)

### 10.4 Refund flow (PI-2) — 6 checks

- [ ] Open a confirmed payment → "Hoàn tiền" button visible (admin + accountant + creator)
- [ ] Click "Hoàn tiền" → dialog opens with original amount + refund input (CurrencyInput)
- [ ] Enter refund `1.000.000` (less than original `5.000.000`) → success; new payment created with `paymentType: 'refund'`
- [ ] `case.refundedAmount` increases by `1.000.000`; `case.remainingAmount` recomputes correctly
- [ ] Try refund `6.000.000` (more than original) → inline error "Hoàn tiền vượt quá số tiền gốc"; submit blocked
- [ ] Audit log: refund entry has `paymentType: 'refund'`, `originalPaymentId` link, full diff

### 10.5 Reports date filter (C.2.3) — 6 checks

- [ ] Open `/reports`, default range `3 tháng`, URL has no `?range=` param
- [ ] Click `Tất cả` → URL updates to `?range=0`; data refetches; "Đang lọc…" pill visible during fetch
- [ ] Active pill has checkmark + stronger border; X icon visible on hover
- [ ] Click X on active pill → resets to `3 tháng`; URL clears
- [ ] When any filter active, "Xóa tất cả bộ lọc" button visible; click clears all
- [ ] Toast "Đã xóa bộ lọc" appears after clear

### 10.6 Anti-pattern + a11y — 4 checks

- [ ] `grep -rE "<[iI]nput[^>]*type=['\"]number['\"]" src/components/cases/` → 0 matches (case-form converted)
- [ ] `grep -rE "<[iI]nput[^>]*type=['\"]number['\"]" src/components/payments/` → 0 matches (payment-form converted)
- [ ] `bash scripts/check-anti-patterns.sh --all` → exit 0
- [ ] axe-core scan on `/payments`, `/payments/new`, `/reports`, `/cases/[id]` → 0 critical violations

### 10.7 Reconciliation (PI-6) — 4 checks

- [ ] Run `NEXT_PUBLIC_DEV_MODE=true npx tsx scripts/reconcile-payments.ts` → output: "21/21 cases reconciled, 0 drift"
- [ ] Manually inject `amountPaid: 99999` mismatch on case #5 in mock store → re-run script → output identifies case #5 as drift
- [ ] Read `docs/ux-redesign/SOP_REVENUE_RECONCILIATION.md` → SOP is clear on when to run + how to interpret output
- [ ] Property test `npx vitest run src/test/__tests__/reconciliation-property.test.ts` → 1000/1000 pass

### 10.8 TD-7 cleanup (PI-5) — 2 checks

- [ ] Inspect `src/components/layout/topbar.tsx` line 71 → fallback is `'placeholder'`, not `'user-001'`
- [ ] Topbar in dev mode never displays `'user-001'` anywhere in DOM (DevTools → Search → `user-001` → 0 matches in user-visible elements)

### 10.9 Cross-sprint regression — all prior stories still pass

- [ ] Sprint 7.1 Modal/Tabs a11y (C.1.1, C.1.2, C.1.3) — no regression
- [ ] Sprint 6.4 revenue tooltip + refund line — no regression
- [ ] Sprint 6.1 payment SoD + server RBAC — preserved through transactional path
- [ ] Sprint 6.2 clinical checklist gate + PII redaction — no regression in payment audit log
- [ ] Sprint 6.3 AppShell `min-h-screen` + next-owner banner — no regression on case detail

---

## Appendix A — Skills Synthesis

### A.1 `tech-lead` (task decomposition + DoD enforcement)

- Each story has T1/T2/... sub-tasks in the BACKLOG View 1; Sprint 7.2 commits preserve those task boundaries where possible (one commit per major sub-task).
- Definition of Done is per-story (§8.1) AND sub-sprint (§8.2) — both must pass.
- Critical files identified in §5 — any drift between this plan and the codebase must be reported in the per-story implementation report, not silently changed.
- No new dependencies introduced; existing `firebase`, `react-hook-form`, `zod`, `recharts`, `lucide-react`, `vitest` cover all Sprint 7.2 needs.
- Build & quality gates (§8.3) are non-negotiable; if any fails, sprint holds.

### A.2 `product-owner` (MVP scope + business value)

- **Q3, Q4, Q5 answered:** Total bill / Paid amount / Remaining amount — these are the three revenue questions directly served by F-HIGH-28 + F-CRIT-08. Without this sprint, the system answers them with stale or partial data.
- **MVP focus:** No new role-specific dashboards, no CSV export, no multi-currency. PI-1 (recompute indicator) is the minimum viable surface for "the bill changed" — accountants don't need a full revision history yet.
- **Acceptance criteria for the sprint as a whole:** An accountant can, in under 60 seconds, verify that every case's `Đã thanh toán` and `Còn lại` matches the sum of confirmed payments minus refunds. This is the C-8 sign-off criterion.
- **Scope discipline:** C.2.2 (URL tabs) is **deferred to Sprint 7.3** — it does not serve a core case question and its only consumer (notification deep-links) is 3 sub-sprints away.
- **Anti-scope-creep guard:** PI-1..PI-6 are new stories. If any PI story expands beyond the §1 spec (e.g., "let's also add a discount recompute"), it moves to Phase 8 backlog.

### A.3 `qa-architect` (10-layer test pyramid)

- All 10 layers exercised in §6.1. Layer 8 (data integrity property test) is **the** new layer for this sprint — `§3.2 invariant` must hold for 1000 randomized cases. This is the highest-leverage test we can write for revenue paths.
- Concurrency (Layer 6 + scenario S1, S2) is non-negotiable for F-CRIT-08 — without it, partial-write failures ship undetected.
- Boundary cases (Layer 2 + scenario S8, S9, S10) cover the CurrencyInput foot-guns: comma vs period, negative, decimal, IME composition.
- Negative + RBAC abuse (Layer 4 + scenarios for SoD) — the same-user create+confirm scenario must be tested **after** the transactional path lands, because the transaction could accidentally widen permissions.
- Mobile/responsive (Layer 9) on CurrencyInput only — recompute indicator is a static chip.
- Regression (Layer 10) — full Sprint 6.1–7.1 suite must still pass.

### A.4 `accountant-domain-expert` (inline — skill not in registry)

> The `accountant-domain-expert` skill is not available in this environment, so the accountant perspective is synthesized inline from Vietnamese medical-clinic accounting practice + general double-entry accounting principles. This section serves as the basis for the accountant pairing sessions C-6 / C-7 / C-8.

**Domain assumptions:**

1. **Vietnamese medical clinics use single-entry bookkeeping** with bank-statement reconciliation as the source of truth — not double-entry. So we cannot enforce `Σ debits === Σ credits`; instead, the invariant is `Σ confirmed payments === case.amountPaid`.
2. **Refunds are negative cash flow, not negative payments** — accounting-wise, a refund is a separate transaction that decreases `case.refundedAmount` and increases `case.remainingAmount`. Our `Payment.paymentType === 'refund'` modeling is correct: the refund is a distinct payment record, not a negation of the original.
3. **VND has no sub-units** — no decimal places. Any input accepting `.5` is wrong by domain convention.
4. **Daily close is the primary accountant task** — at end of day, accountant opens the reports page and verifies that the day's `Σ(confirmed payments)` matches the bank statement. The reconciliation script is the daily-close automation.
5. **Refund > original is illegal** — by Vietnamese accounting practice, a refund cannot exceed the original payment (would require an offsetting sale). The 400 validation in PI-2 enforces this.
6. **Audit trail must be reconstructable** — given a payment record, the auditor must be able to see who created it, who confirmed it, when, with what before/after state for the case. PI-3's structured diff satisfies this.
7. **Timezone discipline** — Vietnam is UTC+7, no DST. `paymentDate` is entered by the accountant in local time; Firestore stores UTC. The reconciliation must compare local dates, not UTC dates. Sprint 7.3's `actualProcedureDate` fix is the canonical pattern; Sprint 7.2 should at least document the convention (PI-4).

**Accountant SOP (PI-6 deliverable: `docs/ux-redesign/SOP_REVENUE_RECONCILIATION.md`):**

> 1. End of day, navigate to `/reports` and verify `Đã xác nhận` total matches bank statement.
> 2. Run `npx tsx scripts/reconcile-payments.ts` (dev-mode) — or production equivalent — to verify no drift across all cases.
> 3. If drift is reported: read the drift report (case ID, expected vs actual `amountPaid`); manually correct `case.amountPaid` from the payment history; write audit entry `manual_ledger_correction`.
> 4. Weekly: review 5 random payment audit entries for completeness (PI-3 diff format).

### A.5 `release-manager` (release gates + sign-off chain)

- **Build & quality gates (§8.3)** must all be green before C-8 sign-off.
- **Rollback drill (C-9)** must be executed and timed on Day 5 — release-manager owns.
- **Sign-off chain (§3.3) is calendar-bound.** C-6 and C-7 require synchronous accountant pairing. If accountant-lead is unavailable on Day 3, the sprint holds.
- **Feature flag inventory** grows by 2: `PAYMENT_TX` and `BILL_RECOMPUTE`. Both default OFF in prod. Promotion plan documented in Sprint 7.5 PH-9.
- **Documentation gate:** 10 implementation reports + 10 migration notes + 1 sub-sprint completion report, all under `docs/ux-redesign/`.

---

## Appendix B — Feature Flag Inventory (cumulative after Sprint 7.2)

| # | Flag | Added in | Prod default | Promotion gate | Sprint 7.2 changes |
|:--|:-----|:---------|:-------------|:---------------|:-------------------|
| 1 | `NEXT_PUBLIC_FEATURE_SHARED_MENU` | Sprint 6.1 | `false` | Triple sign-off | — |
| 2 | `NEXT_PUBLIC_FEATURE_SERVER_RBAC` | Sprint 6.1 | `false` | Triple sign-off | — |
| 3 | `NEXT_PUBLIC_FEATURE_PAYMENT_SOD` | Sprint 6.1 | `false` | CEO + accountant-lead + PO | — |
| 4 | `NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST` | Sprint 6.2 | `false` | Medical director + CEO + PO | — |
| 5 | `NEXT_PUBLIC_FEATURE_CHECKLIST_GATE` | Sprint 6.2 | `false` | Medical director + CEO + PO | — |
| 6 | `NEXT_PUBLIC_FEATURE_MINH_SCREEN` | Sprint 6.3 | `false` | C-3 visual baseline | — |
| 7 | `NEXT_PUBLIC_FEATURE_PAYMENT_TX` | **Sprint 7.2** | **`false`** | **C-6 + C-7 + C-8 accountant pairing** | **New** |
| 8 | `NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE` | **Sprint 7.2** | **`false`** | **C-6 + C-7 + C-8 accountant pairing** | **New** |
| 9 | `NEXT_PUBLIC_FEATURE_URL_TABS` | Sprint 7.2 → **deferred to 7.3** | `false` | QA sign-off | Deferred |
| 10 | `NEXT_PUBLIC_FEATURE_CONSENT_GATE` | Sprint 7.4 | `false` | Data privacy + CEO | Not this sprint |

**Total flags at Sprint 7.2 close: 8** (all default OFF in prod).

> **Note on flag naming:** The existing BACKLOG View 2 row 3 lists `NEXT_PUBLIC_FEATURE_PAYMENT_TX` as "B.4" scope, but Sprint 6.4 never actually added this flag — only Sprint 6.1 added `PAYMENT_SOD`. Sprint 7.2 introduces `PAYMENT_TX` as a new flag (atomic transaction wrapper), distinct from `PAYMENT_SOD` (server-side SoD check). Both flags coexist: `PAYMENT_SOD` blocks same-user create+confirm; `PAYMENT_TX` ensures atomicity. Sprint 7.2 includes a doc clarification in `CONTRIBUTING.md` §feature-flags.

---

## Appendix C — Verification Commands (copy-paste)

```bash
# Build & quality (run after every commit)
npx tsc --noEmit                            # → 0 errors
npx tsc -p tsconfig.test.json --noEmit      # → 0 errors
npm run lint                                # → 0 warnings
npm run build                               # → 34+ routes, 0 errors, ≤ 92 kB shared JS

# Vitest (full suite)
npx vitest run                              # → ≥ 867 tests across ≥ 46 files

# Per-story targeted runs
npx vitest run src/components/ui/__tests__/currency-input.test.tsx
npx vitest run src/lib/billing/__tests__/recompute.test.ts
npx vitest run src/lib/payments/__tests__/transaction.test.ts
npx vitest run src/lib/payments/__tests__/refund.test.ts
npx vitest run src/lib/audit/__tests__/payment-audit.test.ts
npx vitest run src/test/__tests__/reconciliation-property.test.ts

# Reconciliation script (dev-mode)
NEXT_PUBLIC_DEV_MODE=true npx tsx scripts/reconcile-payments.ts

# Anti-pattern gate (cumulative, including new A10)
grep -rE "window\.(confirm|alert)" src/ | grep -v __tests__/   # → 0 (A9)
grep -rE "user-\d{3}" src/components                            # → 0 (A2)
grep -rE 'href=["\047]#["\047]' src/components/                # → 0 (A8)
grep -rE "eslint-disable.*no-alert" src/                       # → 0 (ESC)
bash scripts/check-anti-patterns.sh --all                       # → 0 (A2/A8/A9/ESC + A10)

# Conventional Commits enforcement (Sprint 7.2 first sprint using this)
echo "feat(payments): add transactional confirm" | bash scripts/check-commit-msg.sh  # → exit 0
echo "update payments" | bash scripts/check-commit-msg.sh                              # → exit 1

# Feature flag inventory
grep -E "NEXT_PUBLIC_FEATURE_" .env.local
# Sprint 7.2 adds: PAYMENT_TX, BILL_RECOMPUTE
# Sprint 7.2 deferred from 7.2 to 7.3: URL_TABS

# Documentation gate
ls docs/ux-redesign/STORY_C_2_1_*.md docs/ux-redesign/STORY_F_CRIT_08_*.md docs/ux-redesign/STORY_F_HIGH_28_*.md docs/ux-redesign/STORY_PI_*_*.md 2>/dev/null | wc -l  # → 20 (10 impl + 10 migration)
ls docs/ux-redesign/SOP_REVENUE_RECONCILIATION.md                                     # → exists
ls docs/ux-redesign/SPRINT_7_2_*.md                                                  # → 2 (plan + completion report)
```

---

## Appendix D — What Was Deferred from the Original Sprint 7.2 Commitment

| Original (Sprint 7 plan §4.2) | Sprint 7.2 disposition | Reason |
|:------------------------------|:-----------------------|:-------|
| C.2.1 `<CurrencyInput>` | **Kept** | Supports revenue flows |
| C.2.2 Case detail shared Tabs + URL-sync | **Deferred to Sprint 7.3** | No revenue impact; only consumer is C.5.2 (notification deep-links) in Sprint 7.5 |
| C.2.3 Reports date filter refetch | **Kept** | Supports accountant's reconciliation view |
| C.2.4 Shared menu config verification | **Kept (folded into PI-5)** | Quick win; TD-7 cleanup needs the same review pass |

| Carry-over (Sprint 6.4 / 7.1) | Sprint 7.2 disposition |
|:------------------------------|:-----------------------|
| TD-3 / F-CRIT-08 Transactional payment confirm | **Pulled in** (was Phase 8, now Sprint 7.2 — re-scoped per §0.1) |
| F-HIGH-28 Bill recompute | **Pulled in** (was Phase 8, now Sprint 7.2 — re-scoped per §0.1) |
| TD-7 Replace `'user-001'` fallback | **Pulled in as part of PI-5** (was deferred from Sprint 7.1 R-7) |

| New this sprint | Reason |
|:----------------|:-------|
| PI-1..PI-6 Payment Integrity stories | Bridge gaps surfaced during accountant audit; C-6/C-7/C-8 sessions will determine if any are deferred to Sprint 8 |

---

## Appendix E — Key Architectural Decisions

| # | Decision | Rationale | Revisit in |
|:--|:---------|:----------|:------------|
| **D7.2-1** | Pull F-CRIT-08 + F-HIGH-28 into Sprint 7.2 (was Phase 8) | Revenue accuracy is non-negotiable before production; current SoD insufficient against partial-write failure | Never (decision is binding) |
| **D7.2-2** | Defer C.2.2 URL-synced tabs to Sprint 7.3 | No revenue impact; downstream consumer C.5.2 has 3 sub-sprints of buffer | Sprint 7.3 |
| **D7.2-3** | Introduce 2 new feature flags (`PAYMENT_TX`, `BILL_RECOMPUTE`) | Both are behavior changes that need staged rollout; both default OFF in prod | Promotion in Sprint 7.5 PH-9 |
| **D7.2-4** | Pure function `recomputeBill()` separate from `recalculateCasePayment()` | Pure functions are testable in isolation; property test can verify invariant without mocking Firestore | Future extension (multi-currency, discount recompute) |
| **D7.2-5** | Mock store simulates Firestore `runTransaction` semantics | Allows dev-mode testing of transaction abort behavior; production path uses real Firestore `runTransaction` | Never (decision is binding) |
| **D7.2-6** | Refund = separate Payment record with `paymentType: 'refund'` | Matches Vietnamese accounting practice (refunds are distinct transactions, not negations) | Phase 8+ (multi-currency) |
| **D7.2-7** | Reconciliation script runs in dev-mode only (mock store) | Production reconciliation is a separate concern (bank-statement import); out of scope for Sprint 7.2 | Phase 8 (production reconciliation job) |
| **D7.2-8** | All 16 commits use Conventional Commits format | First sprint applying TD-1 validator; Sprint 7.1 commits were legacy `update` | All future sprints |
| **D7.2-9** | No new dependencies | Existing `firebase`, `react-hook-form`, `zod`, `recharts`, `lucide-react`, `vitest` cover all needs | — |
| **D7.2-10** | Accountant pairing is **blocking**, not async review | Money-in-flight risk requires synchronous accountant validation; C-6 + C-7 are 60-min minimum | All future revenue-impacting stories |

---

*End of Sprint 7.2 Execution Plan.*