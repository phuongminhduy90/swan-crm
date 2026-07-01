# Story PI-1 — Bill Recompute Indicator UI — Migration Notes

> **Story:** PI-1 (Payment Integrity #1)
> **Audience:** Engineers, accountants, release manager
> **Sprint:** 7.2
> **Date:** 2026-07-01

These notes cover **what changed**, **who needs to do what**, and **how to roll back** Story PI-1. They are the operational counterpart to [STORY_PI_1_IMPLEMENTATION_REPORT.md](STORY_PI_1_IMPLEMENTATION_REPORT.md).

---

## TL;DR

A new chip (`<BillRecomputeIndicator>`) renders next to the **"Tổng quan bill"** heading on the case-detail Info tab. The chip tells the accountant when the bill was last reconciled. It is hidden by default — set `NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE=true` to enable it for testing.

There are **no schema changes**, **no new dependencies**, **no payment behavior changes**, and **no new collections**. The chip is a pure UI surface that reads `caseRecord.updatedAt`.

---

## What changed in this PR

### 1. New files

| Path | Purpose |
|:-----|:--------|
| `src/lib/types/billing.ts` | `BillSnapshot`, `RecomputeTrigger`, `RecomputeStatus` types (re-exported via `src/lib/types/index.ts`) |
| `src/components/cases/bill-recompute-indicator.tsx` | The chip component (TSX, client component) |
| `src/components/cases/__tests__/bill-recompute-indicator.test.tsx` | 17 Vitest cases |

### 2. Modified files

| Path | Change |
|:-----|:-------|
| `src/lib/feature-flags.ts` | Added `'BILL_RECOMPUTE'` to the `FeatureFlag` union — 1 line |
| `src/lib/types/index.ts` | Added `export * from './billing'` — 1 line |
| `src/app/(protected)/cases/[id]/page.tsx` | Imported `BillRecomputeIndicator` (1 line) + rendered it in the "Tổng quan bill" Card heading (8 lines, refactored to `flex justify-between`) |

No changes to:
- `package.json` — no new deps
- `firestore.rules`, `firestore.indexes.json`, `firebase.json` — no schema
- `src/lib/firestore/payments.ts` — `confirmPayment` / `recalculateCasePayment` untouched per the user's "Preserve existing payment behavior" constraint
- `scripts/check-anti-patterns.sh` — no A10 entry yet (that's PI-5, separate story)
- `CONTRIBUTING.md` — no new pattern documented (PI-5's job)

---

## How to enable locally

```bash
# .env.local (dev mode) — add:
NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE=true

# Restart `next dev` so the env var is picked up at build time.
# Then open /cases/[any-id] and look at the "Tổng quan bill" Card.
```

The chip will appear:
- **Synced (emerald)** — `Đã đồng bộ hóa lúc HH:mm` (using `case.updatedAt`)
- **Stale (amber)** — `Cần đồng bộ hóa` (if `updatedAt` is missing/invalid)

To exercise the **syncing** state, add `status="syncing"` to the component call (or wait for F-HIGH-28 to wire it).

---

## How to roll back

The chip is fully reversible. Pick whichever is faster:

### Option A — feature flag (no code change)
```bash
# In .env.local or production env:
NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE=false
# Restart server. Chip returns null. Zero blast radius.
```

### Option B — `git revert` (full code removal)
```bash
git revert <pi-1-sha>          # single commit revert; safe
npm run lint && npx tsc --noEmit && npm run build
npx vitest run src/components/cases/__tests__/bill-recompute-indicator.test.tsx
# Expected: 898 / 898 pass (indicator tests now absent from run)
```

### Rollback blast radius

| Aspect | Impact |
|:-------|:-------|
| **Data** | None — chip is read-only |
| **Schema** | None — no collection / index changed |
| **Other stories** | None — `FeatureFlag` union accepts extra members without runtime impact |
| **RTO** | < 1 minute via feature flag; < 5 minutes via `git revert` |

---

## Migration steps for F-HIGH-28 (next PR in Sprint 7.2)

When F-HIGH-28 lands the pure `recomputeBill()` function, **the only change PI-1 needs is one prop**. No re-implementation:

```tsx
// Today (PI-1 alone): chip reads caseRecord.updatedAt
<BillRecomputeIndicator caseRecord={caseRecord} />

// After F-HIGH-28: parent passes the explicit snapshot
<BillRecomputeIndicator
  caseRecord={caseRecord}
  recomputedAt={lastRecompute.recomputedAt}
  trigger={lastRecompute.trigger}
  status={isRecomputing ? 'syncing' : undefined}
/>
```

This is the **deliberate API design** of PI-1 — the chip is a controlled-or-uncontrolled component. F-HIGH-28 only needs to pass props; the chip itself does not need to change.

---

## Acceptance checklist for the reviewer

When reviewing this PR, verify in order:

1. ✅ **Files exist:**
   - `src/lib/types/billing.ts`
   - `src/components/cases/bill-recompute-indicator.tsx`
   - `src/components/cases/__tests__/bill-recompute-indicator.test.tsx`

2. ✅ **Modified files have small, scoped diffs:**
   - `src/lib/feature-flags.ts` — only the new flag name
   - `src/lib/types/index.ts` — only `export * from './billing'`
   - `src/app/(protected)/cases/[id]/page.tsx` — only the import + Card heading flex layout

3. ✅ **Quality gates green:**
   ```bash
   npx tsc --noEmit                       # → 0 errors
   npm run lint                           # → 0 warnings
   npm run build                          # → 0 errors, 87.4 kB shared JS
   npx vitest run src/components/cases/__tests__/bill-recompute-indicator.test.tsx
   # → 17 / 17 pass
   ```

4. ✅ **No existing payment behavior changes:**
   ```bash
   git diff src/lib/firestore/payments.ts   # → empty
   ```

5. ✅ **Feature flag works both ways:**
   ```bash
   NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE=false npx vitest run src/components/cases/__tests__/bill-recompute-indicator.test.tsx
   # → "returns null when BILL_RECOMPUTE flag is OFF" passes
   ```

6. ✅ **Visual smoke (manual):**
   - Enable flag locally
   - Open any case → "Tổng quan bill" Card → chip appears in the heading row
   - Hover the chip → tooltip says `Đã đồng bộ hóa lúc HH:mm — Khi mở hồ sơ CASE`

---

## Communication

### For the accountant (C-7 pairing session)

> A small green chip appears next to "Tổng quan bill" that shows when the bill was last reconciled. Today it reads `case.updatedAt` because the recompute function ships next. When F-HIGH-28 lands, the timestamp will come from the new pure function and the trigger reason (Sau khi thêm dịch vụ, Sau khi xác nhận thanh toán, etc.) will appear in the hover tooltip.

### For the release manager

> No new collection, no schema, no security rule change. The chip is gated behind a feature flag default OFF in production. Promotion to production requires the C-7 / C-8 accountant sign-off (Sprint 7.2 §3.3).

### For the engineering team

> The chip exposes a 3-prop API: `caseRecord` (required), `recomputedAt` and `trigger` (optional — set by F-HIGH-28), `status` (optional — parent owns the in-flight boolean). It is a controlled-or-uncontrolled component so F-HIGH-28 wires it without touching the chip itself.

---

## Out of scope (explicit non-changes)

The following were considered and **deliberately not changed** because the user constraint was "Implement Story PI-1 only":

- ❌ `recomputeBill()` — F-HIGH-28
- ❌ `confirmPaymentTransaction()` — F-CRIT-08
- ❌ `/api/payments/refund` endpoint — PI-2
- ❌ Payment audit enrichment — PI-3
- ❌ URL-synced case-detail tabs — Sprint 7.3 (per plan §0.3 D7.2-3)
- ❌ A10 anti-pattern catalog — PI-5
- ❌ Reconciliation script — PI-6
- ❌ `actualProcedureDate` timezone — PI-4 (mostly documentation)
- ❌ `recalculateCasePayment()` in `src/lib/firestore/payments.ts` — explicitly preserved per the user's "Preserve existing payment behavior" rule

---

*End of Story PI-1 Migration Notes.*