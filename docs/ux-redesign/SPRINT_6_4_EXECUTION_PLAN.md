# Sprint 6.4 — Revenue Integrity — Execution Plan

> **Sprint:** 6.4 — Revenue Integrity
> **Sprint window:** 2026-07-01 (5 dev-days, 2 FEs)
> **Status:** 🔜 **READY TO START** — pending CEO + Accountant Lead prioritization
> **Branch:** `main` (stacked commits) · targeted branch `phase-6/sprint-6.4` for the sprint body
> **Theme:** Transactional payment confirm, bill recompute, revenue chart accuracy — close the remaining F-CRIT and F-HIGH revenue-integrity findings from `IMPLEMENTATION_BACKLOG.md` before Phase C polish.
> **Inputs:** [`IMPLEMENTATION_BACKLOG.md`](IMPLEMENTATION_BACKLOG.md) §Epic 3 (B.3.x + B.4.x) + §Recommended Order · [`UI_REFACTOR_PLAN.md`](UI_REFACTOR_PLAN.md) §Phase B.4 + §Critical Files · [`SPRINT_6_3_COMPLETION_REPORT.md`](SPRINT_6_3_COMPLETION_REPORT.md) §10 (carry-over queues) · [`CLAUDE.md`](../../CLAUDE.md) §Phase 5 (Revenue definitions, payment domains)
> **Skills applied:** `tech-lead` (DoD + risk) · `product-owner` (MVP scope + acceptance) · `qa-architect` (10-layer pyramid + anti-pattern gate) · `release-manager` (flag inventory + rollback + sign-off chain)

---

## Table of Contents

1. [Scope Boundary (no scope creep)](#1-scope-boundary-no-scope-creep)
2. [Stories Included](#2-stories-included)
3. [Revenue / Accounting Risks](#3-revenue--accounting-risks)
4. [Dependencies](#4-dependencies)
5. [Order of Implementation](#5-order-of-implementation)
6. [Files Affected](#6-files-affected)
7. [Test Strategy](#7-test-strategy)
8. [Rollback Strategy](#8-rollback-strategy)
9. [Definition of Done](#9-definition-of-done)
10. [Recommended Commit Sequence](#10-recommended-commit-sequence)
11. [Manual QA Checklist](#11-manual-qa-checklist)
12. [Sign-off Chain](#12-sign-off-chain)
13. [Anti-pattern Scans (must pass before merge)](#13-anti-pattern-scans-must-pass-before-merge)
14. [Explicit Non-Goals](#14-explicit-non-goals)
15. [Appendix A — Story cards (executable detail)](#appendix-a--story-cards-executable-detail)
16. [Appendix B — Coordination carry-over from Sprint 6.3](#appendix-b--coordination-carry-over-from-sprint-63)

---

## 1. Scope Boundary (no scope creep)

Sprint 6.4 is a **revenue-integrity hardening sprint**. The committed backlog is small (5 stories) but every story touches money in flight or on the ledger. Every other UX item is deferred.

### In-scope (committed)

| # | Story | Source | Why this sprint |
|---:|:------|:-------|:----------------|
| S1 | **B.3.2** Revenue tooltip ("Chỉ tính thanh toán đã xác nhận") on dashboard StatCard | BACKLOG §B.3.2 / F-HIGH-29 | Lowest-risk revenue-clarity fix; copied from the original Phase B.4 commitment. |
| S2 | **B.3.4** Refund line (red) + "Đã xác nhận − Hoàn tiền" annotation on revenue chart | BACKLOG §B.3.3 carry / F-HIGH-33 | Closes A4 (conflated forecast/cash) on the reports page. |
| S3 | **C-0 / RR-4** Suspense boundary fallback on dashboard B.1.4 `lab_overdue_count` | 6.2 carry R8 / 6.3 carry R6 | Production-harden the lab-overdue card so a stray `undefined` never blanks the dashboard. |
| S4 | **R-A1** `window.alert` in B.2.1 L2 pre-flight → `<Toast error>` | 6.3 carry P2 | Closes last remaining A9 violation. |
| S5 | **C-3** Mobile visual regression baseline (5 routes × 5 viewports) | 6.3 §11.1 carry-over / release-manager gate | Unblocks B.2.1 / B.3.1 / B.4.1 **staging flag promotion** (not a code story — see §13). |

### Out of scope (explicitly NOT in Sprint 6.4)

These items appear in the BACKLOG Phase B.4 but are **moved to Sprint 7.x** because they are transactional / schema-touching work that benefits from a dedicated sprint with medical-workflow-expert + accountant-lead pairing:

- ❌ **B.3.1** Payment SoD server check (already shipped in Sprint 6.1 — only its **production sign-off** is in 6.4 as part of C-2 carry-over; no new code)
- ❌ Transactional payment confirm / bill recompute (F-CRIT-08 / F-HIGH-28 from `UI_REFACTOR_PLAN.md` §Phase B.4) → **moved to Sprint 7.2** per BACKLOG C.2.x sequencing
- ❌ D1 completion ring-stat (F-HIGH-30) → Sprint 7.5
- ❌ Staff assignment role label (F-MED-21) → Sprint 7.3
- ❌ `<CurrencyInput>` + transaction-list integration → Sprint 7.2
- ❌ Phase C polish (Tabs ARIA consumers, modal labels, calendar caseId) → Sprints 7.1–7.5
- ❌ Firebase rules + Vercel deploy → still Phase 5 remaining (see §14)

### Why this scope (product-owner stance)

From the BACKLOG View 2 §Sprint 6.4: "Sprint 6.4 is lightweight by design. The main revenue integrity work (transactional confirm, bill recompute) was deprioritized from Phase B and moved to Phase C (Sprint 7.2–7.3) for stability. Sprint 6.4 ships only the low-risk tooltip." We **honor that sizing** but **expand** with the 4 carry-over items from Sprint 6.3 because:

1. **B.3.2 + B.3.4** are the only revenue-clarity wins that fit the lightweight posture without schema change.
2. **C-3 baseline** is a release-manager *gate* — without it, no previously shipped flag can promote to staging. Shipping 6.4 without C-3 strands every prior sprint's work behind a manual ad-hoc.
3. **RR-4 Suspense boundary** is a 1-hour stability hardening that protects the B.1.4 dashboard card.
4. **R-A1 `window.alert` → toast** is the cheapest A9 anti-pattern close possible.

---

## 2. Stories Included

Five stories — one UX money-clarity (combined B.3.2 + B.3.4 into the same chart surface), one stability hardening, one anti-pattern close, one observability baseline. See **Appendix A** for per-story implementation detail.

### 2.1 S1 / F-HIGH-29 — Revenue tooltip on dashboard StatCard
- **Owner:** FE-3
- **Est:** 2h (was 1h in BACKLOG; budget accounts for Lucide `Info` icon + a11y wiring)
- **Risk:** 🟢
- **Flag:** —
- **Acceptance:** StatCard on `/dashboard` titled "Doanh thu tháng này" shows `<Tooltip text="Chỉ tính thanh toán đã xác nhận, không bao gồm đang chờ hoặc hoàn tiền">` with `Info` icon trigger. Hover + keyboard focus reveal the text. Screen reader announces via `aria-describedby`.

### 2.2 S2 / F-HIGH-33 — Refund line + "Đã xác nhận − Hoàn tiền" annotation on revenue Line chart
- **Owner:** FE-3
- **Est:** 3h
- **Risk:** 🟢
- **Flag:** —
- **Acceptance:** `/reports` Revenue tab → `revenue-trend-chart.tsx` renders two `<Line>` series: existing `confirmed` (swan aqua) + new `refund` (red `#EF4444`). Annotation below chart: "Đã xác nhận − Hoàn tiền". Tooltip on refund series: "Tổng hoàn tiền đã xác nhận trong kỳ". Annotation order matches BACKLOG: revenue already shows pipeline funnel "Bill / Doanh thu tiềm năng" rename (already shipped in 6.1).

### 2.3 S3 / RR-4 — Suspense boundary fallback for `lab_overdue_count`
- **Owner:** FE-1
- **Est:** 1h
- **Risk:** 🟢
- **Flag:** —
- **Acceptance:** `/dashboard` wraps the `lab_overdue_count` StatCard computation in `useMemo` with a try/catch fallback to `0` (no throw to error boundary). Removes R8/R6 carry-over risk — B.1.4 card never blanks the dashboard on a data-shape drift.

### 2.4 S4 / R-A1 — Close last A9 violation: `window.alert` → `<Toast error>`
- **Owner:** FE-1
- **Est:** 1h
- **Risk:** 🟢
- **Flag:** —
- **Acceptance:** `cases/[id]/page.tsx` L2 pre-flight (Sprint 6.2 B.2.4 second-confirm) replaces the single remaining `window.alert` with a `<Toast type="error">` driven by a `ToastProvider`-compatible trigger. `// eslint-disable-next-line no-alert` comment removed. Anti-pattern gate A9 in §13 returns 0 matches outside `__tests__/`.

### 2.5 S5 / C-3 — Mobile visual regression baseline (release-manager gate)
- **Owner:** qa-architect + ui-designer (not FE)
- **Est:** 6h (one-time, then <30s/run)
- **Risk:** 🟢
- **Flag:** —
- **Acceptance:** Playwright snapshot harness records baseline PNGs for 5 routes (`/dashboard`, `/cases/[id]`, `/customers/[id]`, `/payments`, `/cases`) × 5 viewports (iPhone SE 360, iPhone 12 390, Pixel 7 412, iPad Mini 768, Desktop Chrome 1280) = **25 baseline images** stored in `docs/ux-redesign/visual-baselines/`. Harness is idempotent — running again diffs against baseline. Any unintended diff blocks release.

### 2.6 Story subtotal

| Owner | Hours |
|:------|------:|
| FE-1 | 2h (R-A1 + RR-4) |
| FE-3 | 5h (B.3.2 + B.3.4) |
| qa-architect + ui-designer | 6h (C-3 baseline) |
| **Total** | **13h** |

**Buffer:** ~67h of remaining ~80h capacity = ~52h free for (a) bug fixes found during C-3 diffs, (b) SOP/Loom video production from Phase E §docs, (c) pulling forward C.1.2 (icon-only tabs) or C.5.1 (bell inline) if buffer holds.

---

## 3. Revenue / Accounting Risks

Sprint 6.4 is small **but every story touches revenue**. Below is the accountant-domain view of what can go wrong.

### 3.1 Risk register (revenue impact)

| # | Risk | Source | Impact | Likelihood | Severity | Mitigation |
|:--|:-----|:-------|:-------|:-----------|:---------|:-----------|
| **R-REV-1** | Tooltip text misstates how `confirmed` is computed (e.g., forgets refunds or pending reversal) → CEO misreads dashboard | S1 B.3.2 | Missed revenue signal | M | 🟡 | (a) Copy signed off by Accountant Lead before merge (2nd gate in §12). (b) Test asserts exact Vietnamese wording + tooltip is `aria-describedby`-linked to "Doanh thu tháng này" heading. |
| **R-REV-2** | Refund line on chart double-counts — refund also subtracted from `confirmed` series | S2 B.3.4 | Reported revenue < true revenue → CEO sees false decline | M | 🟡 | (a) Refund data source is `status === 'refunded'` payments only, not part of `confirmed`. (b) Test: mock 10 confirmed × 10M + 3 refunded × 2M → chart shows 100M confirmed line, 6M refund line, chart area-total ≠ double-count. (c) Accountant Lead review of mock data. |
| **R-REV-3** | Refund line color (red) reused for another status (e.g., pending) → visual clash with `payment_pending` chip | S2 B.3.4 | Color-only signal confusion | L | 🟢 | (a) Reuse existing `PAYMENT_METHOD_HEX` / chart status colors — refund is its own series. (b) Design rule: revenue colors are exclusive (DESIGN_DIRECTION §15.3). |
| **R-REV-4** | Annotation "Đã xác nhận − Hoàn tiền" lost at small viewports → reverts to ambiguous aggregate | S2 B.3.4 | Mobile CEO misreads | L | 🟢 | (a) Responsive copy: hide annotation on `<sm`, show `<Tooltip>` instead with same text. (b) Test at 360 px. |
| **R-REV-5** | `lab_overdue_count` Suspense fallback masks a real data error indefinitely | S3 RR-4 | Silent data quality issue | L | 🟢 | (a) Fallback logs `console.warn` (in dev) + `writeAuditLog('dashboard_render_fallback', ...)`. (b) Test throws → fallback value 0 + audit log captured. |
| **R-REV-6** | `window.alert` → `<Toast error>` swap changes user interaction flow (alert is blocking, toast is not) → user could miss pre-flight warning | S4 R-A1 | Pre-flight checklist warning dismissed unnoticed | M | 🟡 | (a) Replacement toast uses `type="error"` (red, persistent for 6s not 3s) + `autoFocus` on a "Về checklist" link button. (b) Manual QA confirms cursor returns to checklist panel within 1s. (c) `qa-architect` sign-off. |
| **R-REV-7** | C-3 baseline captured against a regression-flagged surface → baseline becomes the lie that future runs protect | S5 C-3 baseline | False confidence | M | 🟢 | (a) Baseline captured **only after** §13 anti-pattern gates green + `tsc/lint/build` clean + 618 tests pass. (b) Baseline commit is a single signed commit tagged `visual-baseline-v6.4`. (c) Baseline diff review by ui-designer before adopting into CI. |

**Net revenue risk posture:** 🟡 **Low-Medium** — no money in flight is moved (no transaction logic, no payment confirm), only the display fidelity of revenue numbers. No `F-CRIT-08` (race) or `F-HIGH-28` (bill recompute) code in this sprint — those remain in Sprint 7.x per BACKLOG.

### 3.2 What Sprint 6.4 explicitly does NOT touch (revenue impact)

To prevent accidental drift, the following are fenced:

- ❌ `payments.ts` CRUD — read-only access for the chart computation
- ❌ `confirmPayment()` — code path unchanged
- ❌ `cases.ts` `totalBillAfterDiscount` / `*Latest` fields — untouched
- ❌ `customers.ts` cascade — untouched
- ❌ Audit log writers — no new events (only S3 RR-4 may write `dashboard_render_fallback`)
- ❌ Firestore rules (`firestore.rules`) — untouched
- ❌ Env vars / secrets — only `.env.local` may gain one flag-free story-level entry

Any drift requires a separate **scope-creep PR** with product-owner sign-off.

### 3.3 Sign-off gates (accountant perspective)

| Gate | Owner | What they sign |
|:-----|:------|:---------------|
| Tooltip copy exactness | Accountant Lead | "Chỉ tính thanh toán đã xác nhận, không bao gồm đang chờ hoặc hoàn tiền" matches accounting policy |
| Refund series data source | Accountant Lead | Refund = `status === 'refunded'` only; never mixed with `confirmed` |
| Refund exclusion verification | Accountant Lead | Confirmed-series does NOT subtract refunds internally (refund is its own series, not a delta) |
| Pre-flight toast persistence | medical-workflow-expert | Pre-flight checklist warning is now non-blocking but error-toast persists 6s + has CTA |

---

## 4. Dependencies

Sprint 6.4 has **no blocking external dependencies** — all work is contained inside `src/components/dashboard/`, `src/components/reports/`, `src/app/(protected)/cases/[id]/`, and the Playwright harness.

### 4.1 Story-level dependencies

```
                         ┌─────────────────────┐
                         │  S1 (FE-3, 2h)      │
                         │  Tooltip on dash    │
                         └─────────┬───────────┘
                                   │ uses Lucide Info icon
                                   │ (already in package.json)
                                   ▼
                         ┌─────────────────────┐
                         │  S2 (FE-3, 3h)      │
                         │  Refund line chart  │
                         └─────────┬───────────┘
                                   │ reads payment totals
                                   ▼
                         ┌─────────────────────┐
                         │  S3 (FE-1, 1h)      │
                         │  RR-4 Suspense      │
                         └─────────────────────┘
                                   │ independent

                         ┌─────────────────────┐
                         │  S4 (FE-1, 1h)      │
                         │  window.alert →     │
                         │  Toast error        │
                         └─────────────────────┘
                                   │ independent

                         ┌─────────────────────┐
                         │  S5 (qa, 6h)        │
                         │  C-3 visual baseline│
                         └─────────────────────┘
                                   │ requires §13 gates green first
```

**Key takeaways:**

- **S1 + S2 share FE-3** → sequence (S1 first, then S2) so the visual story on the dashboard matches the report.
- **S3 + S4 share FE-1** → independent of FE-3, can run in parallel.
- **S5 is gated by code freezes** in §10.2 (commit #4).

### 4.2 External dependencies

| Dependency | Type | Owner | Sprint 6.4 need |
|:-----------|:-----|:------|:-----------------|
| BACKLOG.md / UI_REFACTOR_PLAN.md | docs | — | Read-only reference |
| Sprint 6.3 commit history (`f41f9ca` onwards) | git | — | `git log` for rollback reference |
| `next-env.d.ts` (Lucide `Info`) | code | — | Already present (Sprint 6.2 imports `Info` for tooltips) |
| `Tooltip` UI primitive | code | — | Already present at `src/components/ui/tooltip.tsx` (or co-located in `StatCard`) — verify in Day 1 |
| `ToastProvider` | code | — | Already wired (Sprint 6.3 B.4.4 uses it) |
| `recharts@3.9.0` | dep | — | Already in `package.json` |
| `payments` mock store data | data | — | Status `refunded` already exists in seed (Sprint 5 confirmed) — verify count |
| Playwright + `@playwright/test` | dev-dep | — | Already in devDeps — verify version, install if missing |
| `tsx` + node-fetch for C-3 harness script | runtime | — | In devDeps |
| `@axe-core/playwright` for accessibility regression | dev-dep | — | **Verify presence; if missing, spike-only — install in Sprint 6.4 Day 5 buffer** |

### 4.3 Carry-over dependencies from prior sprints

| Carry-over | Story resolved in 6.4 | Notes |
|:-----------|:----------------------|:------|
| R8 RR-4 Suspense fallback | S3 | Closes the carry. |
| R10 A9 `window.alert` carry | S4 | Closes the carry. |
| R5 C-3 visual regression baseline | S5 | Unblocks 6.1 / 6.2 / 6.3 flag promotion to staging. |
| R7 RR-3 B.3.1 production sign-off (C-2) | — | **Not closed in Sprint 6.4 code**; needs CEO + accountant-lead + product-owner triple sign-off (separate from code work). |
| R1 B.2.1 medical director dry-run (C-1) | — | **Not closed in Sprint 6.4 code**; needs medical-workflow-expert + medical director calendar (separate from code work). |

---

## 5. Order of Implementation

### 5.1 Day-by-day plan (5 dev-days, 2 FEs)

| Day | FE-1 (RR-4, R-A1, buffer) | FE-3 (B.3.2, B.3.4, buffer) | qa-architect + ui-designer (C-3) |
|:----|:-------------------------|:----------------------------|:----------------------------------|
| **Day 1 (Tue)** | RR-4 commit (S3) | B.3.2 commit (S1) | — |
| **Day 2 (Wed)** | R-A1 commit (S4) | B.3.4 commit (S2) | Install Playwright harness script (1h) |
| **Day 3 (Thu)** | 618-test baseline check, hygiene | 618-test baseline check, hygiene | Capture 25 baseline PNGs (3h) → commit `visual-baseline-v6.4` |
| **Day 4 (Fri)** | Accountant Lead review of tooltip + refund chart wording | — | Baseline diff review with ui-designer (1h) |
| **Day 5 (Sat/Mon)** | Buffer: SOP doc, conventional-commits cleanup, Codex push | Buffer: bug fixes from Day 4 review | Re-capture baselines if any code changes |
| **Carry-over** | C-1 dry-run coordination, C-2 B.3.1 sign-off coordination | — | — |

### 5.2 Implementation sequence (commit-level)

Per §10.2 below — 5 code commits + 1 baseline commit, in order:

1. **chore(deps)** verify Playwright availability (no install unless needed)
2. **feat(dashboard)** tooltip on revenue StatCard — S1 / B.3.2 (FE-3)
3. **feat(reports)** refund line + annotation — S2 / B.3.4 (FE-3)
4. **fix(dashboard)** RR-4 Suspense fallback — S3 (FE-1)
5. **refactor(case-detail)** R-A1 alert → toast — S4 (FE-1)
6. **chore(visual-baseline)** capture 5×5 PNGs, commit to `visual-baseline-v6.4` tag — S5 (qa)
7. **docs** Sprint 6.4 completion report + 4 STORY_6_4_* docs

### 5.3 Why this order (risk-by-clock)

- **Tooltip first (S1):** smallest blast-radius; if FE-3 mistakes Vietnamese copy, fix is one file.
- **Refund line second (S2):** bigger blast (chart + annotation). Done after S1 so dashboard + reports messaging are stylistically consistent.
- **RR-4 + R-A1 third/fourth:** independent of revenue code; can run in parallel day-2.
- **Baseline last (S5):** only valid after all code lands — otherwise the baseline protects the wrong shape.

---

## 6. Files Affected

### 6.1 Source files (modified / created)

| Path | Story | Change | LOC Δ (est) |
|:-----|:------|:-------|------------:|
| `src/components/dashboard/stat-cards.tsx` | S1 | mod — add Tooltip on "Doanh thu tháng này" card | +35 |
| `src/components/reports/revenue-trend-chart.tsx` | S2 | mod — add refund `<Line>` + annotation | +60 |
| `src/components/reports/chart-theme.ts` | S2 | mod — add `refund: { color: '#EF4444', label: 'Hoàn tiền' }` series config | +12 |
| `src/components/reports/revenue-report.tsx` | S2 | mod — pass `refunds` total + refund series data into chart | +18 |
| `src/lib/reports/aggregations.ts` (or equivalent) | S2 | mod — add `aggregateRefunds(payments, range)` pure function | +25 |
| `src/app/(protected)/dashboard/page.tsx` | S3 | mod — `useMemo` try/catch fallback for `lab_overdue_count` | +15 |
| `src/app/(protected)/cases/[id]/page.tsx` | S4 | mod — replace `window.alert(...)` with `pushToast({ type: 'error', ... })` | +8 / -3 |
| `tests/visual-regression.spec.ts` | S5 | **NEW** — Playwright spec for 5 routes × 5 viewports | +180 |
| `tests/visual-regression-helpers.ts` | S5 | **NEW** — viewport matrix + baseline path helpers | +60 |
| `docs/ux-redesign/visual-baselines/` | S5 | **NEW directory** — 25 PNG files committed as binary | n/a |

**Total LOC Δ estimate:** ~+400 across 7 source files + 2 new test files. No new entity types. No new dependencies (Playwright assumed present). No `.env.local` changes.

### 6.2 Files explicitly NOT touched (per scope discipline)

The following are fenced to prevent drift:

- ❌ `src/lib/firestore/payments.ts` — read-only access; no mutation
- ❌ `src/lib/firestore/cases.ts` — untouched
- ❌ `src/lib/firestore/audit.ts` — no new event types; S3 may write one specific event name
- ❌ `src/components/ui/*` — no new primitives; reuse existing Tooltip / Toast / Card
- ❌ `src/constants/*` — no new colors, no new permission keys
- ❌ `src/lib/types/*` — no new entity fields
- ❌ `tailwind.config.ts` / `src/app/globals.css` — no new tokens, no new animations
- ❌ `firestore.rules` / `firestore.indexes.json` / `storage.rules` — out of Sprint 6.4 scope
- ❌ `vercel.json` — out of scope
- ❌ `package.json` — unless Playwright is missing (then add as devDep — separate PR)

### 6.3 Documentation files

| Path | Type | Story |
|:-----|:-----|:------|
| `docs/ux-redesign/STORY_6_4_1_IMPLEMENTATION_REPORT.md` | NEW | S1 |
| `docs/ux-redesign/STORY_6_4_1_MIGRATION_NOTES.md` | NEW | S1 |
| `docs/ux-redesign/STORY_6_4_2_IMPLEMENTATION_REPORT.md` | NEW | S2 |
| `docs/ux-redesign/STORY_6_4_2_MIGRATION_NOTES.md` | NEW | S2 |
| `docs/ux-redesign/STORY_6_4_3_IMPLEMENTATION_REPORT.md` | NEW | S3 |
| `docs/ux-redesign/STORY_6_4_3_MIGRATION_NOTES.md` | NEW | S3 |
| `docs/ux-redesign/STORY_6_4_4_IMPLEMENTATION_REPORT.md` | NEW | S4 |
| `docs/ux-redesign/STORY_6_4_4_MIGRATION_NOTES.md` | NEW | S4 |
| `docs/ux-redesign/STORY_6_4_5_IMPLEMENTATION_REPORT.md` | NEW | S5 |
| `docs/ux-redesign/SPRINT_6_4_COMPLETION_REPORT.md` | NEW | hygiene |

**Total docs:** 10 new files. Matches Sprint 6.3 doc discipline (paired implementation report + migration notes per story).

---

## 7. Test Strategy (qa-architect 10-layer pyramid)

### 7.1 Per-story test plan

| Story | Layer 1 (unit) | Layer 2 (Zod) | Layer 4 (perm) | Layer 5 (security/audit) | Layer 6 (integration) | Layer 9 (mobile) | Layer 10 (regression) |
|:------|:---------------|:--------------|:---------------|:-------------------------|:----------------------|:-----------------|:---------------------|
| **S1 B.3.2** | Tooltip renders on hover + focus; `aria-describedby` linkage; Vietnamese copy exact | — | — | — | Dashboard API returns `revenueThisMonth` matching mock (confirmed only) | Tooltip tappable at 360 px; doesn't overflow viewport | No dashboard regression on 12 mock users |
| **S2 B.3.4** | `aggregateRefunds()` pure-fn test; refund series config exists in `chart-theme.ts`; annotation visible | — | — | — | Reports API returns `refunds` total keyed to `status === 'refunded'`; mock seed has ≥3 refund cases | Annotation hides on `<sm`, tooltip same text on hover; refund line label visible at iPhone SE width | No chart regression vs Sprint 5 baseline |
| **S3 RR-4** | `useMemo` fallback returns 0 when stat fetcher throws; audit log entry on fallback | — | — | Audit log `dashboard_render_fallback` written once, not on every render | Dashboard page renders with broken mock store (force throw) | Render at 3 viewports — no white-screen of death | No regression on dashboard |
| **S4 R-A1** | `pushToast({ type: 'error', ...})` called instead of `window.alert`; pre-flight path covered | — | — | No audit log expected (toast is UX, not state-change) | Cases page second-confirm flow triggers toast, not alert; CTA "Về checklist" returns to checklist | Toast positioned bottom-right, readable at 360 px | Customer delete-approval + service-remove flows still use `<ConfirmDialog>` (untouched) |
| **S5 C-3** | — | — | — | — | — | — | 25 Playwright snapshot diffs — all 0 diff on this run (baseline commit) |

### 7.2 Test density floor

Per qa-architect standard: **≥ 5–10 tests per KLOC** added. Sprint 6.4 adds ~0.4 KLOC source → **≥ 2 unit/integration tests** minimum. Actual target: **~30–50 new tests** across the 4 code stories.

### 7.3 New test files

| Path | Tests (est) | Story |
|:-----|------------:|:------|
| `src/components/dashboard/__tests__/stat-cards-revenue-tooltip.test.tsx` | ~8 | S1 |
| `src/components/reports/__tests__/revenue-trend-chart-refund-line.test.tsx` | ~12 | S2 |
| `src/lib/reports/__tests__/aggregate-refunds.test.ts` | ~6 | S2 |
| `src/app/(protected)/dashboard/__tests__/suspense-fallback.test.tsx` | ~5 | S3 |
| `src/app/(protected)/cases/[id]/__tests__/preflight-toast.test.tsx` | ~8 | S4 |
| `tests/visual-regression.spec.ts` | 25 (5×5) | S5 |

**Total new tests:** ~64 (Sprint 6.3 added 175; Sprint 6.4 target ≥ 30 net new from above plan).
**Projected post-Sprint 6.4 total:** 618 + 64 = **~682 tests**.

### 7.4 Boundary / negative cases (accountant lens)

| Scenario | Expected | Tested in |
|:---------|:---------|:----------|
| Refund = 0 (no refunds in period) | Refund line still renders but flat at 0; tooltips show "0 ₫" | S2 unit |
| Refund > confirmed (rare — bad data) | Both lines render independently; no negative; total annotation shows arithmetic but not as netted | S2 unit + manual |
| `status: 'refunded'` AND `status: 'refund_pending'` both exist | Only `refunded` counts; `refund_pending` excluded from refund series, excluded from confirmed series (it stays in pending) | S2 unit + manual |
| Mock store missing `refunded` payments field entirely | Series falls back to empty array (length 0); chart still renders | S2 integration |
| Customer deletion cascades to payments | S3 untouched; cascade audit enters `audit.ts`, not affected by RR-4 | n/a (fence) |
| Concurrent payment confirms (F-CRIT-08 stress test) | NOT in Sprint 6.4 — Sprint 7.x | n/a (scope) |
| Status `medical_alert_resolved` dashboard rendering | NOT in Sprint 6.4 — Sprint 6.1 shipped UI; verify no regression in §11.6 | Layer 10 |

### 7.5 Anti-pattern scan (must pass before merge)

Per BACKLOG §Anti-Pattern Enforcement Checklist + Sprint 6.3 §6.1:

| Pattern | Check |
|:--------|:------|
| A2 (`user-\d{3}` in copy) | `grep -rE "user-\d{3}" src/components` → 0 |
| A4 (ambiguous aggregate) | tooltip + annotation must appear together; lint check: `<StatCard title contains "Doanh thu" />` requires `<Tooltip>` sibling |
| A8 (dead links) | `grep -rE 'href=["\047]#["\047]' src/components/layout/` → 0 |
| A9 (native `confirm/alert`) | `grep -rE "window\.(confirm\|alert)" src/ \| grep -v __tests__/` → **0** (was 1 in 6.3 — this sprint closes it) |
| A11 (PII in audit log) | redaction still applies (unchanged) |
| A12-A25 | not regressed by S3 RR-4 (no new transitions) or S4 R-A1 (no RBAC change) |

### 7.6 Accountant's "money-truth" integration test

Specifically requested by `qa-architect` Layer 5 + 8 for any revenue-touching change:

```text
Given: 23 payments in mock store (Sprint 5 seed)
       - 14 confirmed @ varying amounts
       - 5 pending
       - 3 refunded
       - 1 reversal_pending (edge case)
When: revenue StatCard + revenue trend chart both query mock store
Then:
  - Dashboard "Doanh thu tháng này" = sum of confirmed only
  - Reports revenue Line "Đã xác nhận" series = sum of confirmed
  - Reports revenue Line "Hoàn tiền" series = sum of 3 refunded (refund_pending EXCLUDED)
  - Tooltip text matches Accountant Lead sign-off verbatim
```

This is implemented as **Layer 6 integration test** in `src/app/(protected)/dashboard/__tests__/revenue-truth.test.tsx` and `src/app/(protected)/reports/__tests__/revenue-truth.test.tsx` (one each, ~5 assertions each).

---

## 8. Rollback Strategy

Sprint 6.4 has **three rollback layers** mirroring Sprint 6.3 §9.

### 8.1 Per-story git revert (recommended)

| Story | Revert command | Time | Data impact |
|:------|:---------------|:-----|:------------|
| **S1 B.3.2 tooltip** | `git revert <s1-sha>` | < 5 min | None — additive copy |
| **S2 B.3.4 refund line** | `git revert <s2-sha>` | < 10 min | None — chart reverts to single confirmed line |
| **S3 RR-4 Suspense** | `git revert <s3-sha>` | < 5 min | None — `useMemo` only |
| **S4 R-A1 alert → toast** | `git revert <s4-sha>` | < 5 min | None — UX swap only |
| **S5 C-3 baseline** | `git revert <s5-sha>` | < 5 min | None — visual baselines removed (CI loses regression coverage) |

### 8.2 Whole-sprint rollback (catastrophic)

```bash
git revert --no-commit <last-6.4-sha>~1..HEAD
# Total time: < 15 min
# Data impact: None (no migrations, no schema changes)
```

### 8.3 Feature flag rollback

**No new feature flags in Sprint 6.4.** Per BACKLOG flag catalog, all 6.4 stories ship un-flagged (additive copy / structural hardening only). If any story needs a flag in dev, ship behind one named `NEXT_PUBLIC_FEATURE_SPRINT_6_4` with default `true` in dev / `false` in prod — but only after CFO + product-owner sign-off.

### 8.4 Visual baseline rollback

If C-3 baselines prove wrong (false positives blocking legitimate changes):

```bash
# Re-capture: delete visual-baselines/ + re-run harness
rm -rf docs/ux-redesign/visual-baselines
npx playwright test tests/visual-regression.spec.ts --update-snapshots
git add docs/ux-redesign/visual-baselines
git commit -m "chore(visual-baseline): refresh v6.4.1 after Sprint 6.4 review"
```

### 8.5 What CAN'T be rolled back (and why we're careful)

- **Refund series data shape change** — once a refund line appears in the chart, downstream dashboards/screens may stat it. S2 unit test ensures shape is identical (`{ period: string, value: number }[]`) so no consumer-rewrite is forced.
- **Tooltip string** — Vietnamese copy is referenced in (a) code constant, (b) Accountant Lead sign-off doc. Reverting the code without re-signing the doc = drift. Coordination needed.

### 8.6 Rollback drill (release-manager)

30-minute drill to execute before any flag promotion to staging:

1. Tag `release/v6.4.0-rc1` on `main` after Sprint 6.4 merge.
2. In sandbox: `git revert <s2-sha>` (highest-risk story).
3. Run §11 verification suite — must all green.
4. Smoke 3 routes: `/dashboard`, `/cases/[id]`, `/reports` — confirm refund line gone, no crash.
5. Document outcome in Sprint 6.4 completion report §9.

---

## 9. Definition of Done (per tech-lead)

Per `tech-lead` skill DoD + Swift-CRM conventions + Sprint 6.3 §9 hardening:

### 9.1 Per-story DoD (must all be true before merge)

- [ ] UI complete (all 5 stories render per spec)
- [ ] Validation implemented (Zod only if schema touched — not in 6.4)
- [ ] Loading / error / empty states preserved (chart skeleton + revenue "—" fallback still work)
- [ ] RBAC enforced (no new permissions; existing matrix verified)
- [ ] Audit log written if sensitive (only S3 RR-4 may write `dashboard_render_fallback`)
- [ ] Firestore real data (mock store shape unchanged; new read paths use existing `getAllPayments()`)
- [ ] Firebase errors handled (chart reverts to "—" on error; tooltip still renders)
- [ ] Mobile responsive (S1 + S2 verified at 360 px, 768 px)
- [ ] **No TypeScript / lint / build errors** (`npx tsc --noEmit` 0 errors, `npm run lint` 0 warnings, `npm run build` 34 routes 0 errors)
- [ ] Tests pass (≥ 30 net new, 682 projected total — verify with `npx vitest run`)
- [ ] Anti-pattern scan green (§13)
- [ ] Implementation report + migration notes paired (per story)
- [ ] Conventional-commits `chore:` / `feat:` / `fix:` / `refactor:` prefix
- [ ] No new dependencies (unless Playwright missing — separate PR)

### 9.2 Sprint-level DoD (must all be true before sign-off)

- [ ] All 5 stories committed with paired docs (Appendix A check)
- [ ] C-3 visual baseline committed at `visual-baseline-v6.4` tag
- [ ] §11 manual QA checklist executed on 12 mock users + iPhone 12
- [ ] Accountant Lead signed off tooltip + refund copy
- [ ] qa-architect signed off 10-layer pyramid coverage
- [ ] release-manager signed off flag inventory + rollback plan
- [ ] tech-lead signed off build/lint/tests/anti-pattern gates
- [ ] `SPRINT_6_4_COMPLETION_REPORT.md` published with same template as 6.3
- [ ] Carry-over R-8 (RR-4) closed in commit log
- [ ] Carry-over R-10 (A9 `window.alert`) closed in commit log
- [ ] **No Sprint 6.3 regression** — all 618 Sprint 6.3 tests still pass + spot-check 6.1 / 6.2 tests
- [ ] No scope creep — every change maps to a §2 story or an explicit §1 out-of-scope item

### 9.3 Anti-DoD (explicit prohibitions — Sprint 6.4 must NOT)

- ❌ Add new `dependencies` to `package.json` (unless Playwright is verifiably missing)
- ❌ Mutate any entity field in `src/lib/types/*`
- ❌ Add new permission keys in `src/constants/permissions.ts`
- ❌ Change any case status (B.2.2 already shipped)
- ❌ Touch Firestore rules, storage rules, Vercel config, env vars
- ❌ Implement F-CRIT-08 transactional confirm (Sprint 7.x)
- ❌ Implement F-HIGH-28 bill recompute (Sprint 7.x)

---

## 10. Recommended Commit Sequence

Mirror Sprint 6.3 §10.2 stacking pattern. 7 commits + 1 baseline tag.

### 10.1 Commit sequence (in order)

```
Commit 1  chore(deps): verify Playwright availability (no install unless needed)
Commit 2  feat(dashboard): revenue StatCard tooltip — S1 / B.3.2 (FE-3, 2h)
Commit 3  test(dashboard): revenue tooltip + Vietnamese copy exactness (FE-3, 1h)
Commit 4  feat(reports): refund line + annotation on revenue chart — S2 / B.3.4 (FE-3, 3h)
Commit 5  test(reports): aggregateRefunds + refund series config + mobile-hide (FE-3, 1.5h)
Commit 6  fix(dashboard): RR-4 Suspense boundary fallback for lab_overdue_count — S3 (FE-1, 1h)
Commit 7  refactor(case-detail): R-A1 window.alert → Toast error — S4 (FE-1, 1h)
Commit 8  test(case-detail): preflight toast path + return-focus (FE-1, 0.5h)
Commit 9  test(visual): Playwright harness + 25-baseline capture (qa-architect, 4h)
Commit 10 docs(story): 4×STORY_6_4_*_IMPLEMENTATION_REPORT + 4×MIGRATION_NOTES (FE-1, FE-3, 1h)
Commit 11 docs(sprint): Sprint 6.4 completion report (FE-1 + tech-lead, 1h)
```

### 10.2 Branch strategy

| Branch | Purpose |
|:-------|:--------|
| `main` | Frozen during 6.4 (no direct pushes) |
| `phase-6/sprint-6.4` | Sprint body — stacked PRs |
| `visual-baseline-v6.4` | Git tag on commit 9 (immutable) |

Merge order into `main`: commits 1–11 in order; tag `release/v6.4.0-rc1` after all green.

### 10.3 Conventional commits format

Per RR-8 from Sprint 6.2 §11.3:

```
<type>(<scope>): <subject>

<body — bullet points for what + why>

Refs: STORY-6.4-<n>
```

Allowed types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`. No `wip`, no `temp`. Body must include `Refs:` line linking back to story.

---

## 11. Manual QA Checklist

To be executed **on staging** before any flag promotion. Items already verified in dev (12 mock users) are marked ✅.

### 11.1 Build & quality gates (Day 1 of Sprint 6.4)

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npx tsc -p tsconfig.test.json --noEmit` → 0 errors
- [ ] `npm run lint` → 0 warnings
- [ ] `npm run build` → 34 routes, 0 errors, ~87.4 kB shared JS
- [ ] `npx vitest run` → ≥ 618 + ~64 new = ≥ 682 tests passing
- [ ] No new `eslint-disable` or `@ts-ignore` in source

### 11.2 Anti-pattern grep gate

```bash
# A2 — raw user IDs in copy
grep -rE "user-\d{3}" src/components

# A4 — ambiguous aggregate (revenue StatCard)
grep -rE "Doanh thu tháng này" src/components/dashboard/

# A9 — native confirm/alert (was 1 in 6.3, must be 0 in 6.4)
grep -rE "window\.(confirm|alert)" src/ | grep -v __tests__/

# A8 — dead links
grep -rE 'href=["\047]#["\047]' src/components/
```

All 4 must return expected counts (0 / 0 / **0** / 0).

### 11.3 Story-by-story smoke

#### S1 — Revenue tooltip

- [ ] Open `/dashboard` on desktop → hover "Doanh thu tháng này" card → tooltip shows "Chỉ tính thanh toán đã xác nhận, không bao gồm đang chờ hoặc hoàn tiền"
- [ ] Tab to the card (keyboard focus) → tooltip appears (no hover required)
- [ ] Screen reader (NVDA or VoiceOver) reads tooltip via `aria-describedby`
- [ ] Vietnamese copy is **byte-exact** match to Accountant Lead sign-off

#### S2 — Refund line chart

- [ ] Open `/reports` → Revenue tab → Line chart now has 2 series
- [ ] Confirmed series = blue/aqua (unchanged), Refund series = red `#EF4444`
- [ ] Annotation "Đã xác nhận − Hoàn tiền" visible below chart on desktop
- [ ] Hover refund line → tooltip "Tổng hoàn tiền đã xác nhận trong kỳ" + value
- [ ] Verify mock seed: 3 refunded payments → refund series shows 3 data points
- [ ] Resize to < 640 px → annotation collapses; tooltip still shows refund total on tap
- [ ] Currency format consistent with `formatVNDCompact` (no double-separator, no trailing zero bug)

#### S3 — RR-4 Suspense fallback

- [ ] Open `/dashboard` → `lab_overdue_count` card renders normally
- [ ] Force-throw the stat fetcher (e.g., set mock store to return bad shape) → dashboard still renders with card showing 0
- [ ] Audit log has a `dashboard_render_fallback` entry (verify in `/audit-logs`)
- [ ] No white-screen-of-death on any of 12 mock users

#### S4 — R-A1 pre-flight toast

- [ ] Open `/cases/[id]` for case in `procedure_completed`-transition path with missing checklist item
- [ ] Trigger "Hoàn thành thủ thuật" with bad data → toast appears bottom-right (red, persistent ~6s)
- [ ] Toast text = original alert text (Vermilion "Vui lòng hoàn thành toàn bộ checklist ...")
- [ ] Toast has "Về checklist" CTA button → click returns focus to checklist panel
- [ ] No `window.alert` dialog (DevTools event listener on `window.alert` shows zero calls)
- [ ] No `eslint-disable no-alert` comment in source (grep A9 returns 0)

#### S5 — C-3 visual baseline

- [ ] Run `npx playwright test tests/visual-regression.spec.ts` → exits 0 (baseline matches self)
- [ ] Inspect `docs/ux-redesign/visual-baselines/` → 25 PNG files (5 routes × 5 viewports)
- [ ] Pick 3 random files (e.g., dashboard-iPhone-SE.png, cases-detail-iPad-Mini.png, payments-Desktop.png) → open in image viewer → not all-white, not all-black, content visible
- [ ] Re-run after a deliberate `text-red-500` swap on dashboard StatCard title → harness detects diff (proves it's wired)

### 11.4 Per-role smoke (12 mock users)

For each of: `admin`, `ceo`, `cso`, `master_sales`, `sales_online`, `sales_offline`, `accountant`, `doctor`, `nurse`, `coordinator`, `cskh_postop`, `media`:

- [ ] `/dashboard` renders without permission errors
- [ ] Tooltip + refund series visible to: `admin`, `ceo`, `cso`, `accountant`, `master_sales`
- [ ] Tooltip + refund series NOT visible to: `media` (dashboard may be hidden), `cskh_postop` (read-only on dashboard — verify view-only)
- [ ] No console errors or hydration warnings

### 11.5 Mobile device smoke (per release-manager gate)

For each of: iPhone SE 360×667, iPhone 12 390×844, Pixel 7 412×915, iPad Mini 768×1024, Desktop Chrome 1280×800:

- [ ] `/dashboard` — no horizontal scroll; tooltip tappable; refund series readable in reports
- [ ] `/reports` — annotation hides at <640 px; refund line + tooltip still accessible
- [ ] `/cases/[id]` — S4 toast positioned bottom-right, doesn't obscure delete button
- [ ] `/payments` — no regression (S2 chart source data is read-only)
- [ ] `/cases` — no regression (status filter untouched)

### 11.6 Cross-sprint regression (Sprint 6.1–6.3 must not regress)

- [ ] Tabs ARIA + arrow-key navigation (6.1 A.1)
- [ ] Modal focus trap + `aria-labelledby` (6.1 A.2)
- [ ] CloseIconButton (6.1 A.3)
- [ ] Shared Sidebar Menu Config (6.1 A.5) — 12 roles still render identical sidebar
- [ ] CCCD fields (6.1 B.1.1)
- [ ] `hospital_confirmed` → `scheduled` blocked (6.1 B.1.2)
- [ ] Server-side status enforcement (6.1 B.1.3)
- [ ] Dashboard `lab_overdue_count` (6.1 B.1.4) — visible + clickable
- [ ] `medical_alert_resolved` terminal status (6.1 B.2.2)
- [ ] Payment SoD (6.1 B.3.1) — accountant cannot confirm
- [ ] Pipeline rename (6.1 B.3.3) — "Bill / Doanh thu tiềm năng" still present
- [ ] Audit PII redaction (6.2 B.2.3) — `[ĐÃ ẨN]` placeholder still rendered
- [ ] `procedure_completed` second-confirm (6.2 B.2.4) — date still required
- [ ] Auto-escalate followup (6.2 B.1.5) — `painLevel >= 4` triggers medical alert
- [ ] Clinical checklist gate (6.2 B.2.1) — red banner + disabled buttons when incomplete
- [ ] AppShell `min-h-screen` flag (6.3 B.4.1) — default OFF in prod
- [ ] Next-owner banner (6.3 B.4.2) — color paired with icon
- [ ] Payment display names (6.3 B.4.3) — A2 anti-pattern closed
- [ ] Topbar profile toast (6.3 B.4.4) — A8 anti-pattern closed
- [ ] Native confirm → ConfirmDialog (6.3 B.4.5) — A9 anti-pattern closed for cases + customers
- [ ] Status filter responsive (6.3 B.4.6) — chips desktop / Select mobile

### 11.7 Revenue-trace integration smoke

The qa-architect Layer 5 "money-truth" test:

- [ ] Mock store has 23 payments (14 confirmed, 5 pending, 3 refunded, 1 reversal_pending)
- [ ] Dashboard revenue StatCard = sum of 14 confirmed amounts (NOT including 3 refunded, NOT including 5 pending)
- [ ] Reports Revenue tab "Đã xác nhận" series = 14 confirmed amounts
- [ ] Reports Revenue tab "Hoàn tiền" series = sum of 3 refunded amounts (NOT including reversal_pending)
- [ ] Tooltip Vietnamese copy = byte-exact match to Accountant Lead sign-off

---

## 12. Sign-off Chain

Mirror Sprint 6.3 §10.3 + release-manager release-gate template.

| # | Gate | Sign-off by | What they sign | Status (pre-Sprint) |
|:--|:-----|:------------|:---------------|:--------------------|
| 1 | Build / lint / typecheck / tests | tech-lead | All §11.1 green | Day 5 |
| 2 | Anti-pattern grep gate | qa-architect | §11.2 returns expected counts | Day 5 |
| 3 | Test pyramid density | qa-architect | §7.3 ≥ 30 net new + ≥ 682 total | Day 5 |
| 4 | Anti-pattern A9 closure | qa-architect | `window.alert` carry over = 0 | Day 3 |
| 5 | Tooltip copy exactness | Accountant Lead | Vietnamese copy signed verbatim | Day 4 |
| 6 | Refund series data source | Accountant Lead | Refund = `status === 'refunded'` only; confirmed does NOT subtract internally | Day 4 |
| 7 | Refund exclusion verification | Accountant Lead | `refund_pending` excluded from both series | Day 4 |
| 8 | Pre-flight toast persistence | qa-architect | 6s persistent toast with CTA verified | Day 3 |
| 9 | Mobile sweep (5 devices) | ux-designer + qa-architect | All routes × 3 viewports green | Day 5 |
| 10 | Visual regression baseline | ui-designer + qa-architect | 25 PNGs captured + harness wired | Day 5 |
| 11 | C-3 unblocks staging promotion | release-manager | B.2.1 / B.3.1 / B.4.1 flags can flip | Day 5 |
| 12 | Flag inventory + rollback | release-manager | §8 plan approved; no new flags | Day 5 |
| 13 | UX rationale (Vietnamese) | ux-designer | Tooltip + annotation copy in tone | Day 4 |
| 14 | Final go/no-go | CEO + product-owner | Whole sprint greenlit | Day 5 |

**Carry-over (NOT in Sprint 6.4 code, but tracked):**

- ⏳ **C-1** B.2.1 medical director dry-run → needs calendar coordination (Sprint 7.x or earlier if calendar opens)
- ⏳ **C-2** B.3.1 production sign-off → CEO + accountant-lead + product-owner triple meeting
- ⏳ **C-3** is **promoted to in-scope** in Sprint 6.4 (closes the carry)

---

## 13. Anti-pattern Scans (must pass before merge)

Per BACKLOG §Anti-Pattern Enforcement + Sprint 6.3 §6.1 — extend with 6.4-specific gates:

| # | Anti-pattern | Check | Expected (Sprint 6.4) |
|:--|:-------------|:------|:----------------------|
| A2 | Raw IDs in UI | `grep -rE "user-\d{3}" src/components` | 0 |
| **A4-6.4** | Ambiguous revenue aggregate | `grep -rE "Doanh thu" src/components/dashboard/stat-cards.tsx` must include `<Tooltip>` or `<Info>` within ±5 lines | yes |
| **A4-6.4** | Refund series without annotation | chart must import and render `<Annotation>` or equivalent text "Đã xác nhận − Hoàn tiền" | yes |
| A8 | Dead links | `grep -rE 'href=["\047]#["\047]' src/components/layout/topbar.tsx` | 0 |
| **A9** | Native `confirm()`/`alert()` | `grep -rE "window\.(confirm\|alert)" src/ \| grep -v __tests__/` | **0** (was 1 in 6.3 — this sprint closes it) |
| **A9-6.4** | `eslint-disable no-alert` in source | `grep -rE "eslint-disable.*no-alert" src/` | 0 |
| A10 | Raw numeric currency inputs | not touched in 6.4 | 0 |
| A11 | PII in audit diffs | redaction still applies (S3 may write only `dashboard_render_fallback`) | unchanged |
| A12-A13 | Skipped clinical gates / permissive transitions | not touched | unchanged |
| A14 | Consent as progressive | not touched | unchanged |
| A15-A25 | Various | not touched | unchanged |

**Automated pre-merge hook (recommended for Sprint 7.x):** Add `scripts/check-anti-patterns.sh` to `.husky/pre-commit` so every commit greps before push. Out of scope for Sprint 6.4.

---

## 14. Explicit Non-Goals

Locked against scope creep. Anything below requires a separate change-request PR.

### 14.1 Out of scope for Sprint 6.4

| # | Item | Reason | Target sprint |
|:--|:-----|:-------|:---------------|
| 1 | Transactional payment confirm (F-CRIT-08) | high risk + needs Firestore transaction mocks | Sprint 7.2 |
| 2 | Bill recompute indicator (F-HIGH-28) | requires schema extension `*Latest` fields | Sprint 7.x |
| 3 | `<CurrencyInput>` integration | needs adoption across case + payment forms | Sprint 7.2 |
| 4 | D1 completion ring-stat (F-HIGH-30) | minor dashboard polish | Sprint 7.5 |
| 5 | Staff assignment role label (F-MED-21) | minor UI label change | Sprint 7.3 |
| 6 | Case-detail tabs URL-sync (`?tab=`) (C.2.2) | needed for C.5.2 notification deep-link | Sprint 7.2 |
| 7 | `<Modal>` sheet variant on mobile (C.1.x) | covered in C.1 wave | Sprint 7.1 |
| 8 | A11y foundation (axe-core consumers, modal labels) | whole-sprint effort | Sprint 7.1 |
| 9 | Consent gates / privacy (C.4.x) | dedicated privacy sprint | Sprint 7.4 |
| 10 | Firebase security rules + indexes deployment | Phase 5 remaining | Phase 5 closure (separate project) |
| 11 | Vercel deployment | Phase 5 remaining | Phase 5 closure |
| 12 | Hospital tab (F-MED-15) | role-gated route addition | Sprint 7.5 |
| 13 | Calendar caseId required (F-MED-11 / F-MED-02) | required for solid appointment flow | Sprint 7.5 |
| 14 | Nurse/CSKH cancel block (F-MED-14) | RBAC tightening | Sprint 7.5 |
| 15 | Notification click routing (C.5.1 / C.5.2) | depends on URL-synced tabs | Sprint 7.5 |

### 14.2 Phase-5 remaining (separate project — not a UX sprint)

From `CLAUDE.md` §Phase 5 (remaining):

| Item | Why out of scope | Owner |
|:-----|:----------------|:------|
| `firebase.json` + `firestore.indexes.json` + `storage.rules` deployment | DevOps work, not UX | devops-deployment-expert |
| Vercel `vercel.json` + security headers + deployment docs | DevOps work, not UX | devops-deployment-expert |

These belong to a separate `release/v5.5` workstream; UX team has no role.

---

## Appendix A — Story cards (executable detail)

### A.1 Story S1 / F-HIGH-29 — Revenue StatCard tooltip

**File:** `src/components/dashboard/stat-cards.tsx`

**Acceptance criteria:**
- [ ] "Doanh thu tháng này" StatCard wrapped with `<Tooltip>` (or `<span>` with `aria-describedby` referencing tooltip text)
- [ ] Tooltip text (Vietnamese, byte-exact):
  ```
  Chỉ tính thanh toán đã xác nhận, không bao gồm đang chờ hoặc hoàn tiền
  ```
- [ ] Trigger icon: Lucide `Info` 16×16 strokeWidth={1.5} positioned to right of card title
- [ ] Tooltip shows on `mouseenter` and on `focus` (keyboard)
- [ ] Tooltip hides on `mouseleave` + `Escape` key + click outside
- [ ] Tooltip positioned top-right of card on hover, never bleeds viewport at 360 px
- [ ] WCAG AA contrast: tooltip text ≥ 4.5:1 against card background
- [ ] `aria-describedby={tooltip-id}` on card value text; `<p id={tooltip-id} role="tooltip">` with explicit text

**Files:**
| Path | Type |
|:-----|:-----|
| `src/components/dashboard/stat-cards.tsx` | mod |
| `src/components/dashboard/__tests__/stat-cards-revenue-tooltip.test.tsx` | **NEW** |

**Test plan (Layer 1, 6, 10):**
- Tooltip not in DOM when not hovered
- Tooltip shows on hover + focus
- Vietnamese copy exact match
- `aria-describedby` linkage
- `Escape` closes
- No regression on other 7 StatCards

---

### A.2 Story S2 / F-HIGH-33 — Refund line + annotation on revenue chart

**Files:**
| Path | Type |
|:-----|:-----|
| `src/components/reports/revenue-trend-chart.tsx` | mod |
| `src/components/reports/chart-theme.ts` | mod |
| `src/components/reports/revenue-report.tsx` | mod |
| `src/lib/reports/aggregations.ts` (or equivalent) | mod |
| `src/components/reports/__tests__/revenue-trend-chart-refund-line.test.tsx` | **NEW** |
| `src/lib/reports/__tests__/aggregate-refunds.test.ts` | **NEW** |

**`aggregateRefunds(payments, range)` signature:**
```ts
type RefundAggregate = { period: string; value: number }[]
function aggregateRefunds(
  payments: Payment[],
  range: { start: Date; end: Date }
): RefundAggregate
```

**Pure function invariants:**
- Filters `payment.status === 'refunded'` only (NOT `refund_pending`)
- Bucket by month same as `confirmed`
- Returns empty array (not null) when no refunds
- Currency unit: VND integer

**Chart rules:**
- Confirmed series: existing color (swan aqua `#00ADBE`)
- Refund series: red `#EF4444`
- Annotation text below chart: `Đã xác nhận − Hoàn tiền` (Vietnamese, exact)
- Annotation hidden on `<sm` (replaced with tooltip on tap)
- Recharts `<Line>` second `<Line>` added with `stroke={refundColor}`, `dataKey="value"`, `name="Hoàn tiền"`

**Acceptance:**
- [ ] Refund series exists in chart legend
- [ ] Tooltip on refund series: `Tổng hoàn tiền đã xác nhận trong kỳ`
- [ ] Annotation visible desktop, tap-tooltip mobile
- [ ] Mock seed has 3 refunded → 3 data points
- [ ] `refund_pending` (1 in seed) NOT counted
- [ ] `confirmed` series unchanged (does NOT subtract refunds internally)
- [ ] Empty refund case: refund line still renders but flat at 0; tooltips show "0 ₫"

---

### A.3 Story S3 / RR-4 — Suspense boundary fallback for `lab_overdue_count`

**File:** `src/app/(protected)/dashboard/page.tsx`

**Pattern:**
```ts
const labOverdueCount = useMemo(() => {
  try {
    return computeLabOverdueCount(cases);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[dashboard] lab_overdue_count fallback', err);
    }
    writeAuditLog({
      action: 'dashboard_render_fallback',
      entity: 'dashboard',
      entityId: 'home',
      metadata: { stat: 'lab_overdue_count', errorMessage: String(err) },
    });
    return 0;
  }
}, [cases]);
```

**Acceptance:**
- [ ] Card always renders (no exception throws to error boundary)
- [ ] Fallback value = 0
- [ ] Audit log entry written (verify in `/audit-logs`)
- [ ] Dev `console.warn` included
- [ ] Test: force-throw → 0 + 1 audit entry
- [ ] Test: normal cases → correct count + 0 audit entries

**File:** `src/app/(protected)/dashboard/__tests__/suspense-fallback.test.tsx` (**NEW**)

---

### A.4 Story S4 / R-A1 — `window.alert` → Toast error

**File:** `src/app/(protected)/cases/[id]/page.tsx`

**Before:**
```ts
// B.2.4 L2 pre-flight
if (!allPassed) {
  // eslint-disable-next-line no-alert
  alert('Vui lòng hoàn thành toàn bộ checklist trước khi chuyển trạng thái');
  return;
}
```

**After:**
```ts
const { pushToast } = useToast();
if (!allPassed) {
  pushToast({
    type: 'error',
    title: 'Không thể chuyển trạng thái',
    description: 'Vui lòng hoàn thành toàn bộ checklist trước khi chuyển trạng thái.',
    duration: 6000,
    action: { label: 'Về checklist', onClick: () => checklistRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
  });
  return;
}
```

**Acceptance:**
- [ ] `window.alert` not called (DevTools listener = 0)
- [ ] Toast renders bottom-right with red `type="error"` styling
- [ ] Toast persists 6 seconds (longer than default 3)
- [ ] "Về checklist" CTA scrolls to checklist panel
- [ ] No `// eslint-disable-next-line no-alert` in source
- [ ] Regression: case detail second-confirm (B.2.4) still uses `<ConfirmDialog>` (unchanged)

**Files:**
- `src/app/(protected)/cases/[id]/page.tsx` (mod)
- `src/app/(protected)/cases/[id]/__tests__/preflight-toast.test.tsx` (**NEW**)

---

### A.5 Story S5 / C-3 — Mobile visual regression baseline

**File:** `tests/visual-regression.spec.ts` (NEW)

**Routing matrix (5 × 5 = 25 PNGs):**

| Route | iPhone SE 360 | iPhone 12 390 | Pixel 7 412 | iPad Mini 768 | Desktop 1280 |
|:------|:-------------:|:-------------:|:-----------:|:-------------:|:------------:|
| `/dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/cases/[id]` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/customers/[id]` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/payments` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/cases` | ✅ | ✅ | ✅ | ✅ | ✅ |

**Storage:** `docs/ux-redesign/visual-baselines/<route>-<viewport>.png`

**Acceptance:**
- [ ] Harness exists, idempotent
- [ ] First run captures baselines; subsequent runs diff vs baseline
- [ ] Tag `visual-baseline-v6.4` references the baseline commit
- [ ] ui-designer spot-checks 3 baselines for content (not blank)

---

## Appendix B — Coordination carry-over from Sprint 6.3

| # | Carry-over | Sprint 6.4 plan | Story |
|:--|:-----------|:----------------|:------|
| C-1 | B.2.1 medical director dry-run | Coordinate calendar slot Day 4–5 (non-blocking for code) | out of code scope |
| C-2 | B.3.1 production sign-off (CEO + accountant-lead + product-owner) | Triple sign-off meeting Day 5 | out of code scope |
| R6 / R8 | RR-4 Suspense boundary fallback | **In scope as S3** | S3 |
| R10 / A9 | `window.alert` → toast | **In scope as S4** | S4 |
| R5 / R-3 | C-3 visual regression baseline | **In scope as S5** | S5 |
| R7 / RR-3 | B.3.1 sign-off (deliverable: SOP doc) | Schedule meeting Day 5 | out of code scope |
| R1 | B.2.1 medical sign-off | Calendar coordination | out of code scope |
| R12 / R13 | B.2.1 race + stale flag combo | Deferred to Sprint 7.x | out of scope |

---

## Final Sprint 6.4 Posture

**Sprint 6.4 is a revenue-integrity hardening + risk-clearing sprint.** It ships 5 small, high-confidence stories that:

1. Make revenue numbers readable (tooltips + refund line)
2. Make a dashboard stable (Suspense fallback)
3. Close the last A9 anti-pattern (alert → toast)
4. Unblock staging promotion for all 6.1–6.3 work (visual baseline)

**It deliberately does NOT ship F-CRIT-08 transactional confirm or F-HIGH-28 bill recompute.** Those wait for Sprint 7.x where they get dedicated Firestore transaction mocks + accountant-led pairing + rollback drill.

**Buffer (~52h after accounting for code + carry-over coordination) should be used for:**
- Documentation hygiene (SOPs from Phase E of `UI_REFACTOR_PLAN.md`)
- Pulling forward C.1.2 / C.5.1 if scope allows
- Conventional-commits cleanup per RR-8

**Sign-off requires CEO + Accountant Lead + qa-architect + release-manager.** No sprint ships without Accountant Lead approval on revenue wording.

---

*End of Sprint 6.4 Execution Plan.*
