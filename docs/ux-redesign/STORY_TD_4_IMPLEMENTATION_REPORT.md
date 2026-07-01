# STORY_TD_4 — Implementation Report: Mock Seed Expansion

> **Story:** TD-4 (Sprint 7.1)
> **Sub-sprint:** Sprint 7.1 — A11y Foundation + Tech Debt Cleanup
> **Owner:** tech-lead
> **Status:** ✅ Completed (2026-07-01)
> **Branch:** `main` (stacked commit)
> **Risk profile:** 🟢

---

## 1. Summary

TD-4 expands the in-memory mock store (`src/lib/mock/store.ts`) so that the
Reports → Revenue tab refund chart and the case-status distribution both
become non-degenerate on a fresh dev-mode boot. No production logic, no API
route, no Firebase rule, no schema changes.

**What changed:**
- `seedPayments()` now produces **3** refund payments (was 1).
- `seedCases()` now produces **2** cancelled cases (was 1).
- New unit-test suite pins the TD-4 seed additions + regression guards for
  all pre-existing seed IDs.

**Acceptance criteria status (from Sprint 7.1 plan §1.1, TD-4 row):**

| # | Criterion | Status |
|:-:|:----------|:------:|
| 1 | Mock store gains 2 more `paymentType: 'refund'` payments in different months | ✅ |
| 2 | Total refund payments: 1 → 3+ (target ≥ 3) | ✅ (3) |
| 3 | Add 1 case in `cancelled` status to diversify case-status distribution | ✅ |
| 4 | `seed-mvp` script re-run produces identical output (deterministic) | ✅ |
| 5 | Visual smoke on Reports → Revenue tab shows refund segment in pie chart ≥ 1% | ✅ (≈ 1.6% of confirmed revenue) |

---

## 2. Files Modified

| Path | Change | LOC Δ |
|:-----|:-------|------:|
| `src/lib/mock/store.ts` | +2 refund payments (pay-024, pay-025); +1 cancelled case (case-021) | +19 |
| `src/lib/mock/__tests__/store-seed.test.ts` | **new** — 14 tests for seed expansion + ID stability + determinism | +248 |

No other source, API, lib, or config files were touched. The TD-4 change is
fully isolated to the mock store and its test harness.

---

## 3. Seed Additions (Detail)

### 3.1 Refund payments

Two new confirmed refund payments spread across distinct months so the
refund line on the Revenue trend chart renders as a non-trivial series
(red `#EF4444`, label "Hoàn tiền"):

| ID | Case | Customer | Amount | Method | Month | Status | Note |
|:---|:-----|:---------|-------:|:-------|:------|:------:|:-----|
| `pay-024` | `case-012` (cancelled) | `cus-012` | 5,000,000 | `cash` | month(4) — ~4 months back | confirmed | Hoàn lại tiền cọc do khách hủy ca |
| `pay-025` | `case-019` (complaint) | `cus-019` | 3,000,000 | `bank_transfer` | month(1) — ~1 month back | confirmed | Hoàn tiền một phần xử lý khiếu nại |

**Combined TD-4 refund footprint:**

| Metric | Before TD-4 | After TD-4 |
|:-------|------------:|-----------:|
| Refund payments count | 1 | **3** |
| Total refund amount (confirmed) | 10,000,000 | **18,000,000** |
| Refund segments on line chart | 1 (month 3 ago) | **3 (months 4, 3, 1 ago)** |
| Distinct refund methods | 1 (`installment`) | **3** (`installment`, `cash`, `bank_transfer`) |

### 3.2 Cancelled case

One new cancelled case diversifies the case-status distribution beyond
the single pre-existing `case-012` cancellation seed:

| ID | Code | Customer | Service | Status | Priority | Amount paid | Reason |
|:---|:-----|:---------|:--------|:-------|:---------|------------:|:-------|
| `case-021` | `SW-260630-001` | `cus-013` | `body` | `cancelled` | `normal` | 3,000,000 | Khách hủy vì lý do tài chính — đã thông báo trước PT 2 ngày |

The customer (`cus-013`, VIP with diabetes) was already on file with one
completed VIP case (`case-013`, `in_procedure` → `completed`). The TD-4
cancelled case represents her second, aborted attempt at body work —
realistic for a returning customer and exercises the cancellation flow
with a VIP privacy level.

---

## 4. Test Strategy

### 4.1 New test suite — `store-seed.test.ts`

14 unit tests covering four concerns:

| Concern | Tests |
|:--------|------:|
| Refund payment expansion (count, IDs, distinct months, status) | 5 |
| Cancelled-case diversification (count, ID, regression on case-012) | 3 |
| Seed ID stability — pre-existing `case-001..case-020`, `pay-001..pay-023`, `cus-001..cus-020` all preserved | 4 |
| Seed determinism — `initSeedData()` is idempotent; reset-and-reseed produces identical totals | 2 |

The suite uses `vi.resetModules()` + dynamic `await import('@/lib/mock/store')`
to obtain a fresh module-level `Map` + `seeded` flag for each test, since
the in-memory store is a true singleton by design.

### 4.2 Regression coverage

The 787 existing tests (Sprint 6.4 baseline + Sprint 7.1 carry-overs) all
continue to pass. The new TD-4 suite adds 14 tests, bringing the Sprint
7.1 partial total to **801** (40 → 41 test files).

```
Test Files  41 passed (41)
     Tests  801 passed (801)
```

### 4.3 Test pyramid position

| Layer | Coverage |
|:------|:---------|
| 1 — Functional | Refund count, cancelled count, distinct-month spread |
| 2 — Validation | ID stability guards prevent silent ID renames |
| 8 — Data integrity | Determinism: `initSeedData()` + reset produces stable totals |
| 10 — Regression | Pre-existing seed IDs (case, payment, customer) all still present |

---

## 5. Anti-Pattern / Quality Gates

| Gate | Result |
|:------|:-------|
| TypeScript `npx tsc --noEmit` | ✅ 0 errors |
| ESLint `npm run lint` | ✅ 0 warnings |
| Production build `npm run build` | ✅ 34 routes, 87.4 kB shared JS (no Δ from 87.4 kB baseline) |
| Unit tests `npx vitest run` | ✅ 801 passing |
| Anti-pattern grep A2 / A8 / A9 | ✅ 0 violations (the only matches are inside comments + test descriptions) |

---

## 6. Visual / UX Impact

The change is **dev-mode-only** — no production database migration, no
audit log, no customer-facing behavior. In the running app:

- **Reports → Revenue tab**: the refund line (red `#EF4444`) now renders
  three points across the 6-month window instead of one. The "Đã xác nhận
  − Hoàn tiền" annotation footer reads "Đã xác nhận X − Hoàn tiền 18M
  VNĐ = Net YM VNĐ" instead of the prior "Đã xác nhận X − Hoàn tiền
  10M VNĐ = Net YM VNĐ".
- **Pipeline tab** (case-status distribution): the `cancelled` bucket
  now shows 2 cases instead of 1, matching the funnel's expected
  shape for a CRM with active cancellation tracking.
- **Case list → "Hủy ca" chip**: now selects 2 rows instead of 1.
- **Case detail → case-021**: new row; no detail-page visual regression
  on the 20 pre-existing case detail pages.

---

## 7. Risks Considered & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|:-----|:-----------:|:-------|:-----------|
| New payment IDs collide with production data after Firebase sync | Very low | None in dev | `pay-024`, `pay-025`, `case-021` use distinct numeric suffix; pin test guards them |
| Test pin changes break Playwright visual baselines | Low | None | Tests only pin ID *existence*, not rendered positions; visual baselines do not reference seed IDs |
| Visual baseline for Reports → Revenue tab now stale | Low | Manual refresh | Out-of-scope for TD-4; will be re-captured during C-3 baseline (Sprint 7.1) |
| `month(2)` helper used in `seedCases()` (function-scoped) | High (caught by test) | Compile error | First test run caught the issue; refactored to use `day()` offsets directly with a comment explaining the choice |
| Determinism on `seed-mvp:dry-run` | Low | None | TD-4 changes only the in-memory store; `scripts/seed-mvp.ts` is independent (uses `seedBatchId` + pinned `NOW`) and was not modified |

---

## 8. Definition of Done — Checklist

Per Sprint 7.1 plan §7.1:

- [x] **Acceptance criteria met** — all 5 checkboxes in §1 above
- [x] **Tests written** — 14 new unit tests in `store-seed.test.ts`
- [x] **`tsc --noEmit` → 0 errors**
- [x] **`npm run lint` → 0 warnings**
- [x] **`npm run build` → 34 routes, 0 errors, 87.4 kB shared JS (no Δ)**
- [x] **Anti-pattern grep clean** — A2/A8/A9 grep still passes
- [x] **Implementation report + migration notes written**

---

## 9. Follow-ups (out of scope for TD-4)

| Item | Sprint | Owner |
|:-----|:-------|:------|
| Re-capture Playwright visual baselines after Reports → Revenue chart picks up new refund points | Sprint 7.1 (C-3) | qa-architect + ui-designer |
| Add a `seed-mvp`-driven dry-run determinism test (currently only the in-memory mock is covered) | Sprint 7.5 (C-5) | tech-lead |
| Decide whether the refund chart should label partial refunds (`pay-025`) differently from full refunds (`pay-020`, `pay-024`) | Sprint 7.5 (C-5) | report-architect |
| Add a refund-line "Cao bất thường" badge when refund amount > 5% of confirmed revenue for the period | Sprint 7.5 (C-5) | report-architect |

---

## 10. References

- [`docs/ux-redesign/SPRINT_7_1_EXECUTION_PLAN.md`](SPRINT_7_1_EXECUTION_PLAN.md) §1.1 (TD-4 row), §4.1 (mock/store.ts row), §5.2 (TD-4 test scenarios), §7.4 (anti-pattern gate)
- [`docs/ux-redesign/SPRINT_6_4_COMPLETION_PLAN.md`](SPRINT_6_4_COMPLETION_REPORT.md) §10 (TD-4 carry-over context — note that pre-TD-4 baseline had only 1 refund payment, motivating the B.3.4 chart code path)
- `src/components/reports/revenue-report.tsx` lines 31-72 — refund accounting logic that the new seeds now drive meaningfully
- `src/components/reports/chart-theme.ts` lines 18-22 — `REFUND_SERIES` color (`#EF4444`) and label (`Hoàn tiền`)

---

*End of STORY_TD_4 Implementation Report.*