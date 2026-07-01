# STORY_TD_4 — Migration Notes: Mock Seed Expansion

> **Audience:** Engineers touching the mock store, Reports → Revenue chart, or visual baselines.
> **When to read:** Before adding/removing mock seed data; before re-capturing visual baselines; before debugging "why does the refund chart suddenly look different on dev".

---

## TL;DR

Sprint 7.1 / TD-4 expanded the in-memory mock store (`src/lib/mock/store.ts`)
with **2 additional refund payments** and **1 additional cancelled case**.
The change is dev-mode only — production data, Firestore rules, and the
real `scripts/seed-mvp.ts` Firestore uploader are untouched.

If you maintain:

| ...this | Then... |
|:--------|:--------|
| Visual baselines (`tests/visual-regression.spec.ts`) | Re-capture in Sprint 7.1 C-3 (not blocking TD-4) |
| Charts that read refund payments | Nothing — `RevenueReport` already handled refund accounting since B.3.4 |
| Tests asserting exact seed counts | Update tests (none found in the codebase) |
| Production seed-mvp Firestore upload | Nothing — separate code path with `mvp-mock-` prefix |

---

## 1. What Changed in the Mock Store

### Before TD-4

```text
refund payments:  1 (pay-020, case-011, 10M, month(3))
cancelled cases:  1 (case-012, customer cus-012)
total payments:   23
total cases:      20
```

### After TD-4

```text
refund payments:  3 (pay-020 + pay-024 + pay-025)
cancelled cases:  2 (case-012 + case-021)
total payments:   25  (+2)
total cases:      21  (+1)
```

### Concrete seed diff

```diff
# src/lib/mock/store.ts

# In seedPayments():
+ { id: 'pay-024', caseId: 'case-012', customerId: 'cus-012', amount: 5_000_000,
+   paymentMethod: 'cash', paymentType: 'refund', paymentDate: month(4),
+   status: 'confirmed', confirmedBy: 'user-007', confirmedAt: month(4),
+   note: 'Hoàn lại tiền cọc do khách hủy ca',
+   createdBy: 'user-007', createdAt: month(4), updatedAt: month(4) },
+ { id: 'pay-025', caseId: 'case-019', customerId: 'cus-019', amount: 3_000_000,
+   paymentMethod: 'bank_transfer', paymentType: 'refund', paymentDate: month(1),
+   status: 'confirmed', confirmedBy: 'user-007', confirmedAt: month(1),
+   note: 'Hoàn tiền một phần xử lý khiếu nại',
+   createdBy: 'user-007', createdAt: month(1), updatedAt: month(1) },

# In seedCases():
+ {
+   id: 'case-021', caseCode: 'SW-260630-001', customerId: 'cus-013',
+   caseDate: day(60), mainServiceGroup: 'body',
+   status: 'cancelled', priority: 'normal',
+   totalBillBeforeDiscount: 18_000_000, discountType: 'none',
+   totalBillAfterDiscount: 18_000_000, amountPaid: 3_000_000,
+   remainingAmount: 15_000_000, paymentStatus: 'deposit',
+   salesNote: 'Khách hủy vì lý do tài chính — đã thông báo trước PT 2 ngày.',
+   privacyLevel: 'vip',
+   createdBy: 'user-005', createdAt: day(60), updatedAt: day(30),
+ },
```

### Why `day()` not `month()` for case-021

The `seedCases()` function declares `day()` and `future()` helpers but not
`month()`. Using `month(2)` inside `seedCases()` would throw at module
load time. We deliberately use `day(60)` + `day(30)` to keep the new
record inside the helper scope of `seedCases()` without needing to
duplicate the `month()` helper. Date semantics: `day(60)` resolves to
"60 days before now" — equivalent to roughly 2 months back, well within
the 6-month chart window Reports uses.

---

## 2. Impact on Existing Surfaces

### 2.1 Reports → Revenue tab

| Surface | Before | After |
|:--------|:-------|:------|
| `RevenueTrendChart` refund `<Line>` points | 1 (month 3 ago) | 3 (months 4, 3, 1 ago) |
| "Đã xác nhận − Hoàn tiền" annotation refund total | 10,000,000 | **18,000,000** |
| `PaymentMethodChart` segment for `cash` | ~20% | slightly higher |
| `PaymentMethodChart` segment for `bank_transfer` | ~50% | slightly lower |
| Refund share of confirmed revenue (all-time) | ~1.0% | **~1.6%** |

### 2.2 Reports → Pipeline tab

The `cancelled` case-status bucket shows 2 entries (was 1). No other
pipeline stage is affected.

### 2.3 Cases list page

The `Hủy ca` status filter chip now returns 2 rows instead of 1.

### 2.4 Audit logs

No new audit log entries seeded. TD-4 is mock data only.

### 2.5 Notifications

No new notification seeds. TD-4 does not add a `notifications` collection
entry — the cancellation of `case-021` is a data fact, not an action the
system observed.

---

## 3. Test Pin Changes

### 3.1 Tests added

| File | Tests | Purpose |
|:-----|------:|:--------|
| `src/lib/mock/__tests__/store-seed.test.ts` | 14 | Pin TD-4 seed expansion + regression guard for all pre-existing seed IDs |

### 3.2 Tests unchanged

None of the pre-existing tests needed updating. Confirmed by full
re-run:

```
Test Files  41 passed (41)
     Tests  801 passed (801)   ← was 787 (delta = +14, all in store-seed.test.ts)
```

### 3.3 Why no test count assertions existed

A grep for `payments.length`, `payments.count`, `cases.length` against the
existing test corpus returned no hits — every test that touches the seed
data either mocks `getAllPayments` / `getAllCases` (e.g.
`stat-cards.test.tsx`) or builds its own fixtures (e.g.
`revenue-trend-chart.test.tsx`). TD-4 was therefore a zero-regression
change for the existing 787 tests.

---

## 4. What TD-4 Deliberately Did Not Do

| Did not do | Why | Punted to |
|:-----------|:----|:----------|
| Add a `seed-mvp` Firestore row for the new mock items | `seed-mvp.ts` is the production-realistic Firestore uploader with its own deterministic generator (`seedBatchId = 'mvp_full_mock_seed_001'`); mixing mock-store additions into it would create two divergent sources of truth | Sprint 7.5 (C-5) — re-decide seed-mvp scope |
| Bump any feature flag | TD-4 is data-only; no behavior toggle | Sprint 7.4 (C-4) if consent-gate flag ever expands |
| Re-capture Playwright visual baselines | C-3 coordination track, gated by sprint 7.1 week-1 calendar | Sprint 7.1 C-3 |
| Add a refund chart "anomaly" badge (e.g. when refund > 5% revenue) | Out of TD-4 scope; would require a product decision on threshold + UX | Sprint 7.5 (C-5) |
| Modify production payment / case CRUD endpoints | Mock-only change | Never — production data is independent |

---

## 5. Rollback Plan

If TD-4 needs to be rolled back (extremely unlikely — risk profile is 🟢):

```bash
git revert <td-4-commit-sha>
npm run build      # confirm 34 routes + 87.4 kB baseline restored
npx vitest run     # confirm 787 → 787 (drops the 14 new tests)
```

Reverting the store change alone is also safe: every other file in the
codebase reads from `getAllPayments` / `getAllCases` and does not pin
exact counts.

---

## 6. FAQ

### Q: Why does the refund line look "different" on my dev machine?

Because the mock store now seeds 3 confirmed refund payments (was 1).
This is the intended post-TD-4 behavior.

### Q: Will this affect the Playwright visual baselines?

Visually, yes — the refund line now has 3 points and the "Đã xác nhận −
Hoàn tiền" annotation shows 18M instead of 10M. Sprint 7.1 C-3
coordination will re-capture the affected baselines (not blocking
TD-4).

### Q: Does this affect the production database?

No. The mock store is dev-mode only (`NEXT_PUBLIC_DEV_MODE=true && !hasFirebaseConfig`).
Production Firestore is populated by `scripts/seed-mvp.ts`, which has its
own generator and was not modified.

### Q: Should I add my new test case to the `seed-mvp.ts` uploader instead?

If you want it to appear in real Firebase during `npm run seed:mvp`, then
yes — edit `scripts/seed-mvp.ts`. But that script uses
`seedBatchId = 'mvp_full_mock_seed_001'` + `ID_PREFIX = 'mvp-mock-'`, so
docs will get IDs like `mvp-mock-payment-024`, not `pay-024`. The two
seed layers are independent by design.

### Q: Why did `seedCases()` not have a `month()` helper?

Because none of the pre-existing case seeds used it. TD-4 deliberately
chose `day(60)` + `day(30)` over introducing a new helper to keep the
change minimal.

---

## 7. References

- [`STORY_TD_4_IMPLEMENTATION_REPORT.md`](STORY_TD_4_IMPLEMENTATION_REPORT.md) — full change history, file inventory, risk register
- [`SPRINT_7_1_EXECUTION_PLAN.md`](SPRINT_7_1_EXECUTION_PLAN.md) — sub-sprint context
- `src/components/reports/revenue-report.tsx` — refund accounting (lines 31-72)
- `src/components/reports/chart-theme.ts` — `REFUND_SERIES` config

---

*End of STORY_TD_4 Migration Notes.*