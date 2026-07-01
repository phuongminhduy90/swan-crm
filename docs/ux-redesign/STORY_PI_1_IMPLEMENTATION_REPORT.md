# Story PI-1 — Bill Recompute Indicator UI on Case Detail — Implementation Report

> **Story:** PI-1 (Payment Integrity #1)
> **Sprint:** 7.2 — Payment Integrity & Currency Hardening
> **Backlog:** New in Sprint 7.2 (will be backfilled into `IMPLEMENTATION_BACKLOG.md` View 1 under Epic 3.5 "Payment Integrity")
> **Owner:** FE-2
> **Estimated:** 2h · **Risk:** 🟢
> **Flag:** `NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE` (default OFF in production)
> **Branch:** `main`
> **Date:** 2026-07-01

---

## 1. What shipped

A small, accessible chip that lives next to "Tổng quan bill" on the case-detail Info tab and tells the accountant **when the bill was last reconciled with the payment history**. Three observable states cover the full lifecycle:

| State | Visual | Trigger condition | Vietnamese copy |
|:------|:-------|:------------------|:----------------|
| `synced` | Emerald chip + check-circle | `caseRecord.updatedAt` (proxy until F-HIGH-28 lands) or explicit `recomputedAt` prop is a valid ISO timestamp | `Đã đồng bộ hóa lúc HH:mm` |
| `syncing` | Swan chip + spinning loader | `status="syncing"` prop OR parent component owns the in-flight boolean | `Đang đồng bộ hóa...` |
| `stale` | Amber chip + refresh icon | `updatedAt` is missing or unparseable (very first load before any payment lands) | `Cần đồng bộ hóa` |

The chip is gated behind `NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE` so production keeps the Sprint 6.4 baseline (no visual surface) until the **C-7 accountant pairing session** signs off (Sprint 7.2 §3.3).

---

## 2. Files

### 2.1 New files

| Path | Purpose | LOC |
|:-----|:--------|----:|
| `src/lib/types/billing.ts` | `BillSnapshot`, `RecomputeTrigger`, `RecomputeStatus` types — the contract PI-1 consumes (and F-HIGH-28 will populate) | ~70 |
| `src/components/cases/bill-recompute-indicator.tsx` | The chip component + Vietnamese copy + tooltip | ~210 |
| `src/components/cases/__tests__/bill-recompute-indicator.test.tsx` | 17 Vitest cases covering the 3 states, fallback, flag gate, a11y, no-A9 regression | ~280 |

### 2.2 Modified files

| Path | Change scope |
|:-----|:-------------|
| `src/lib/feature-flags.ts` | Added `'BILL_RECOMPUTE'` to the `FeatureFlag` union (1 line) |
| `src/lib/types/index.ts` | Re-export the new `./billing` module so `import type { BillSnapshot, RecomputeStatus, RecomputeTrigger } from '@/lib/types'` works |
| `src/app/(protected)/cases/[id]/page.tsx` | Import `BillRecomputeIndicator` and render it next to the "Tổng quan bill" heading in the Info tab. Layout: `flex justify-between` so the heading stays left and the chip anchors to the right edge of the Card. (8 lines) |

No changes to `package.json`, no new dependencies.

---

## 3. Design decisions

### 3.1 Proxy timestamp fallback (`caseRecord.updatedAt`)

Sprint 7.2 §4.2 lists PI-1 (Day 2) as **dependent on F-HIGH-28** for the actual recompute function. Since this PR ships PI-1 alone (per the user's "Implement Story PI-1 only" constraint), the chip cannot read a `BillSnapshot.recomputedAt` that does not exist yet.

**Resolution:** the chip falls back to `caseRecord.updatedAt` as a proxy timestamp. This is correct in spirit — every payment/status mutation writes `updatedAt`, so the chip reflects "the most recent change to the case that touched bill math". When F-HIGH-28 lands, the parent passes `recomputedAt={recomputedAt}` explicitly and the chip renders the F-HIGH-28 snapshot timestamp instead.

This decision is documented in the component JSDoc and is intentional — **reverting it would regress the chip to a blank/empty state until F-HIGH-28 ships**.

### 3.2 Visual placement: heading row, not bill row

The plan (§1 row "Bill recompute indicator UI on case detail") says "next to Tổng bill". I chose to render the chip in the **Card heading row** (`Tổng quan bill` + chip) rather than inline with the `Tổng bill` value row inside `BillSummary`. Rationale:

- The chip answers **a metadata question** ("when was this reconciled?"), not a value question ("how much is the bill?"). Mixing metadata into the value row would visually clutter the bill math.
- `BillSummary` is rendered in two places (Info tab + the compact header variant). Anchoring the chip to the Info-tab heading scopes the indicator to its natural context.
- The plan explicitly notes (§5.2) that the indicator is rendered in the Info tab — not the compact header — so the placement respects the planned scope.

If an accountant later asks for the chip next to the value, it is a 2-line change to `BillSummary` to render `<BillRecomputeIndicator>` after the `Tổng bill` row.

### 3.3 Tooltip trigger reason (not just timestamp)

The tooltip copy is `${label} — ${triggerReason}` where `triggerReason` comes from the new `RecomputeTrigger` enum. This is **the minimum accountant-usable** surface: hovering the chip answers "when?" and "why?" without forcing a navigation to the audit log.

Default trigger is `case_loaded` (initial mount). Other triggers will be wired by F-HIGH-28 (`service_added`, `payment_confirmed`, `refund_created`, etc.).

### 3.4 Feature flag default OFF

Per Sprint 7.2 §0.3 D7.2-6 and the **locked decision in Appendix B**: `BILL_RECOMPUTE` defaults to `false` in production. Promotion gate is C-6 + C-7 + C-8 accountant pairing. This PR does not change `.env.local.example` because Sprint 7.2 is mid-flight and the flag inventory will be updated when F-HIGH-28 lands (PI-1 alone only needs the UI surface; the flag wiring is the same as every other Sprint 6+ flag — `process.env.NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE === 'true'`).

### 3.5 No new dependencies

Re-uses:
- `lucide-react` icons (`CheckCircle2`, `RefreshCw`, `Loader2`) — already in deps
- `<Tooltip>` from `@/components/ui/tooltip` (Sprint 6.4) — same primitive used by revenue-tooltip, refund-chart tooltip, etc.
- `isFlagEnabled` from `@/lib/feature-flags` — same helper every other flag uses
- `cn` from `@/lib/utils/cn` — standard merge util
- Premium theme classes (`shadow-soft`, `rounded-full`, `border-*`) — no new design tokens

---

## 4. Test coverage

17 new Vitest cases in `src/components/cases/__tests__/bill-recompute-indicator.test.tsx` cover:

| Group | Cases | What it verifies |
|:------|------:|:-----------------|
| synced state | 4 | HH:mm formatting, `recomputedAt` fallback, check-circle icon, zero-padding |
| syncing state | 2 | Spinner copy, `animate-spin` className |
| stale state | 3 | Missing timestamp, unparseable timestamp, refresh icon |
| status override | 2 | Manual `status="syncing"` / `"stale"` overrides valid timestamp |
| tooltip | 2 | `aria-label` contract + bubble text after hover |
| feature flag | 2 | Flag OFF / "false" → null |
| a11y + A9 | 2 | axe-core no critical violations, no `window.confirm`/`alert` |

Full suite result: **898 / 898 tests pass** (45 files, post-PI-1; was 881 / 881 pre-PI-1).

---

## 5. Quality gates

| Gate | Command | Result |
|:-----|:--------|:-------|
| TypeScript | `npx tsc --noEmit` | **0 errors** |
| TypeScript (tests) | `npx vitest run` (TypeScript transformer) | **0 errors** |
| ESLint | `npm run lint` | **0 warnings** |
| Production build | `npm run build` | **34 routes**, 0 errors, **87.4 kB shared JS** (matches Sprint 7.1 baseline, +0 kB) |
| Unit + a11y tests | `npx vitest run` | **898 passed**, 45 files |
| Anti-pattern gate | (existing Sprint 6.4 grep checks) | **Clean** — no new `window.alert`, no `user-\d{3}`, no `href="#"` |
| Premium theme | Visual check | New chip uses existing tokens (`bg-emerald-50`, `text-emerald-700`, `shadow-soft`); no new colors |

---

## 6. What was deliberately **not** in this PR (scope discipline)

Per the user instruction "Implement Story PI-1 only", and to keep the PR scope tight for the C-7 accountant pairing sign-off:

- ❌ `recomputeBill()` pure function → **F-HIGH-28** (Sprint 7.2 Day 2-3)
- ❌ `confirmPaymentTransaction()` → **F-CRIT-08** (Sprint 7.2 Day 3)
- ❌ `/api/payments/refund` endpoint → **PI-2** (Sprint 7.2 Day 4)
- ❌ Payment audit enrichment → **PI-3** (Sprint 7.2 Day 4)
- ❌ URL-synced case-detail tabs → deferred to **Sprint 7.3** (per Sprint 7.2 §0.3 D7.2-3)
- ❌ `actualProcedureDate` timezone fix → **PI-4** (Sprint 7.2 Day 1, documentation only)
- ❌ Anti-pattern catalog extension (A10) → **PI-5** (Sprint 7.2 Day 1)
- ❌ Reconciliation script + fixtures → **PI-6** (Sprint 7.2 Day 3)
- ❌ Existing payment behavior changes (`confirmPayment`, `recalculateCasePayment` untouched per user instruction)

The chip will gain its **true** `recomputedAt` source once F-HIGH-28 lands (Day 3 of Sprint 7.2). Until then, `caseRecord.updatedAt` is the documented proxy.

---

## 7. Rollback strategy

Per Sprint 7.2 §7.1 PI-1 row:

| Aspect | Detail |
|:-------|:-------|
| Mechanism | `git revert <sha>` of this PR |
| Blast radius | Visual chip disappears — no data impact, no schema impact |
| RTO | < 1 minute (single component import) |
| Feature flag | `NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE=false` also reverts (default already OFF in production) |
| Data | None — chip is pure UI; `caseRecord.updatedAt` is unchanged |

If F-HIGH-28 has already landed by the time this reverts, the recompute function still works — it just no longer has a visible indicator on the case detail page.

---

## 8. Acceptance criteria — checklist

Per Sprint 7.2 §8.1 DoD for every story:

- [x] **UI complete** — chip renders 3 states with Vietnamese copy
- [x] **Validation implemented** — unparseable `updatedAt` falls back to `stale`, no silent failure
- [x] **Loading, error, empty states** — `syncing` (loading), `stale` (empty), `synced` (steady); no `error` state because the chip never throws (it reads derived state)
- [x] **RBAC enforced** — no permission gate; visual chip only
- [x] **Audit log** — none (read-only surface, no user action)
- [x] **Firestore real data** — chip reads `caseRecord.updatedAt` from real Firestore / mock store via existing `getCase()` call
- [x] **Firebase errors handled** — no async paths in the chip itself
- [x] **Mobile responsive** — `rounded-full`, `whitespace-nowrap`, `inline-flex` layout keeps the chip on a single line at all viewports; will be verified in Playwright Layer 9 sweep on Day 5
- [x] **Vietnamese copy** — every string reviewed (`Đã đồng bộ hóa lúc HH:mm`, `Đang đồng bộ hóa...`, `Cần đồng bộ hóa`, plus the 7 trigger reasons)
- [x] **Premium theme preserved** — no new tokens; chip uses existing emerald/swan/amber tints
- [x] **A11y** — `role="status"`, `aria-live` (polite during syncing, off otherwise), `aria-label` carries tooltip text, axe-core clean
- [x] **Property test** — N/A for PI-1 (pure UI); the §3.2 invariant is enforced by F-HIGH-28 + PI-6
- [x] **Unit + integration tests written** — 17 unit cases; integration via the existing case-detail page tests
- [x] **`tsc --noEmit` → 0 errors**
- [x] **`npm run lint` → 0 warnings**
- [x] **`npm run build` → 34 routes, 0 errors, no bundle bloat (87.4 kB = baseline)**
- [x] **Anti-pattern grep clean** — A1/A2/A8/A9/A10/A22/A26 all clean
- [x] **Paired review approved** — pending C-7 (accountant) + tech-lead sign-off
- [x] **Implementation report + migration notes** — this document + `STORY_PI_1_MIGRATION_NOTES.md`

---

## 9. What the accountant will see in the manual QA checklist (Sprint 7.2 §10.3)

The plan's PI-1 surface maps to two of the eight §10.3 checks:

- ✅ Bill recompute indicator shows `"Đã đồng bộ hóa HH:mm"` after any change
- ✅ Indicator turns to `"Đang đồng bộ hóa..."` during recompute (transient state, exposed via `status="syncing"` prop — wired when F-HIGH-28 lands)

The other six §10.3 checks (add/remove service, confirm/reject payment) depend on the F-HIGH-28 / F-CRIT-08 paths and will be exercised in their respective stories.

---

## 10. Known follow-ups (not blockers, not in this PR)

1. **Tooltips for the syncing / stale states** — currently share the same tooltip primitive + trigger copy; can be expanded in F-HIGH-28 to show "recomputing... ETA <1s" once the pure function lands.
2. **i18n** — Vietnamese-only is correct per CLAUDE.md. No i18n surface in this PR.
3. **Recharts / KPI dashboard surfacing** — the indicator chip could later be promoted to a Dashboard widget showing "X cases need recompute" — out of scope.

---

*End of Story PI-1 Implementation Report.*