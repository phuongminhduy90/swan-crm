# Sprint 6.3 — Execution Plan: AppShell + Critical UX

> **Sprint:** 6.3 — AppShell + Critical UX
> **Sprint window:** 5 dev-days, 2 FEs (~80h capacity)
> **Committed scope:** ~15h + ~10h sprint-hygiene/coordination = **~25h**; **~55h buffer** for regression sweep, paired review, contingency
> **Theme:** Mobile layout fix, next-owner visibility, UX consistency (native `confirm()` → `<ConfirmDialog>`, profile placeholder)
> **Branch:** `main` (work merged via stacked commits; no long-lived branch)
> **Inputs synthesized from skills:**
> - `product-owner` — MVP scope, acceptance criteria, RBAC + privacy priority
> - `ux-designer` — mobile-first, urgent-info-above-fold, reduced cognitive load
> - `tech-lead` — DoD enforcement, task breakdown, build/lint/test gates
> - `qa-architect` — 10-layer test pyramid, anti-pattern grep, release gate
> **Source plan:** [`UI_REFACTOR_PLAN.md`](UI_REFACTOR_PLAN.md) §1 (Phase B.3)
> **Backlog source:** [`IMPLEMENTATION_BACKLOG.md`](IMPLEMENTATION_BACKLOG.md) View 2 — Sprint 6.3
> **Prior sprint context:** [`SPRINT_6_2_COMPLETION_REPORT.md`](SPRINT_6_2_COMPLETION_REPORT.md) §11.3 (readiness assessment) + §8 (carry-over risks R1, R7)

---

## 1. Stories Included

Sprint 6.3 commits to **6 stories** from `IMPLEMENTATION_BACKLOG.md` View 2 (B.4.1–B.4.6), plus **3 coordination activities** that ship *into the sprint window* but produce no new code:

| # | Story | Title | Owner | Est | Risk | Flag | Backlog ID |
|---:|:------|:------|:------|----:|:----:|:-----|:-----------|
| 1 | **B.4.1** | AppShell `min-h-screen` fix (F-CRIT-01) | FE-1 | 2h | 🔴 | `NEXT_PUBLIC_FEATURE_MINH_SCREEN` | F-CRIT-01 |
| 2 | **B.4.2** | Next-owner banner on case Info tab | FE-2 | 5h | 🟡 | — | F-CRIT-09 |
| 3 | **B.4.3** | Payment list display names | FE-3 | 2h | 🟢 | — | F-HIGH-17 |
| 4 | **B.4.4** | Topbar profile placeholder toast | FE-3 | 1h | 🟢 | — | F-HIGH-01 |
| 5 | **B.4.5** | Replace native `confirm()` with `<ConfirmDialog>` | FE-2 | 3h | 🟡 | — | F-MED-01 |
| 6 | **B.4.6** | Status filter: chips desktop / `<Select>` mobile | FE-1 | 2h | 🟢 | — | F-MED-06 |
| — | **— Committed code total —** | — | — | **15h** | — | — | — |

| # | Coord | Title | Owner | Est | Type |
|---:|:------|:------|:------|----:|:-----|
| 7 | **C-1** | B.2.1 medical director dry-run (3 historical cases) | medical-workflow-expert + medical director + tech-lead | 6h | Sign-off gate (no new code) |
| 8 | **C-2** | B.3.1 sign-off coordination (RR-3) — CEO + accountant-lead + product-owner | release-manager + product-owner | 4h | SOP + sign-off gate (no new code) |
| 9 | **C-3** | Mobile visual regression baseline capture (iPhone SE/12, Pixel 7, iPad Mini, Desktop) × 5 routes | qa-architect + ui-designer | 4h | Verification only |

**Sprint total: ~29h committed; ~51h buffer** (paired review, code review, contingency, tech debt, 0.5h `CONTRIBUTING.md` update for RR-8 carry-over).

### In scope vs out of scope

**In scope (Sprint 6.3):**
- All 6 stories above.
- Carry-over coordination C-1, C-2, C-3.
- RR-8 (`CONTRIBUTING.md` Conventional Commits update) — **0.5h cleanup, lowest-risk tech debt item.**
- Anti-pattern grep + axe-core run after each merged story.

**Explicitly out of scope (deferred):**
- B.2.1 code changes (already shipped; sprint only consumes the sign-off output).
- RR-4 (B.1.4 Suspense boundary) — already deferred to **Sprint 6.4** per Sprint 6.2 completion report §11.4.
- RR-5 (topbar `as never` cast) — Sprint 6.4 cleanup.
- R12 (B.2.1 Firestore transaction hardening) — Sprint 7.x.
- R10 (`window.alert` → toast in B.2.1 L2 pre-flight) — Sprint 7.x.
- R6 (B.2.4 server-side `actualProcedureDate`) — Sprint 7.3 / C.3.2.
- R14 (B.1.5 `getAllUsers()` per-recipient lookup) — pre-prod scale work.
- Any new component primitives, new design tokens, or new routes (per UI_REFACTOR_PLAN §13.3).

---

## 2. UX Goals

Synthesized from `ux-designer` skill ("mobile-first usage, urgent info above fold, fewer mistakes") + UX_DECISION_DOCUMENT §11 (11 high-risk items closed in Sprint 6.3 lane):

| # | Goal | Why it matters | Stories |
|---:|:-----|:---------------|:--------|
| G-UX-1 | **No URL-bar overlap on iOS Safari.** Replace `h-screen` with `min-h-screen` so the iOS Safari URL bar no longer hides page content on every route. | F-CRIT-01 closes the single biggest mobile-critical layout bug (BACKLOG F-CRIT-01). Affects every protected route. | B.4.1 |
| G-UX-2 | **Case ownership always visible.** The next action owner (role + name) is the first thing a clinician sees on the case Info tab, not buried in a status dropdown. | F-CRIT-09 — answers question 9 ("Who owns each step?") at a glance. Reduces handoff friction. | B.4.2 |
| G-UX-3 | **No ambiguous payment attribution.** Accountants see *who entered* and *who confirmed* each payment, never raw `user-001` IDs. | F-HIGH-17 — A2 anti-pattern closure (raw IDs in copy). Audit-log surface. | B.4.3 |
| G-UX-4 | **No dead links in primary navigation.** The topbar "Hồ sơ" item gets a "Tính năng đang phát triển" toast instead of a dead `<a href>` to nowhere. | F-HIGH-01 — A8 anti-pattern closure (no `onClick={() => {}}`). Vietnamese UX copy. | B.4.4 |
| G-UX-5 | **No native browser dialogs for destructive actions.** Every confirm gate uses `<ConfirmDialog>` with focus trap, ESC, and audit-friendly structure. | F-MED-01 — A9 anti-pattern closure (ban `window.confirm`/`window.alert`). iOS Safari styling parity. | B.4.5 |
| G-UX-6 | **Status filter works at any width.** Status chips on desktop; `<Select>` on mobile so 8+ statuses never overflow on a 360 px viewport. | F-MED-06 — M5 anti-pattern closure (no horizontal scroll at 360 px). | B.4.6 |

### UX non-goals (deferred)

- **Deep color-coded status timeline** — deferred to C.5.3 (Sprint 7.5).
- **Notification bell inline on mobile** — deferred to C.5.1 (Sprint 7.5).
- **Icon-only tab reflow on case detail** — deferred to C.1.2 (Sprint 7.1).
- **Full-screen sheet modals on `< sm`** — uses the existing `<Modal>` primitive; sheet variant is Sprint 7.x polish.

---

## 3. Design Goals

Per `DESIGN_DIRECTION.md` §13.3 ("extended, not forked") + UI_REFACTOR_PLAN §4.2 ("no new tokens, no new primitives"):

| # | Goal | Constraint reference |
|---:|:-----|:--------------------|
| G-DS-1 | **Zero new color tokens.** Only existing `swan-aqua`, `champagne-gold`, `cream`, status tones (success/warning/danger/info/neutral), and `bg-gradient-swan/champagne/page` may be used. | DESIGN_DIRECTION §13.3, UI_REFACTOR_PLAN §4.1 |
| G-DS-2 | **Zero new component primitives.** Reuse `<Modal>`, `<ConfirmDialog>`, `<CloseIconButton>`, `<Badge>`, `<Button>`, `<Card>`, `<Select>` from `src/components/ui/`. `<NextOwnerBanner>` is **inline composite** in `cases/[id]/page.tsx`, not a new primitive. | UI_REFACTOR_PLAN §2 component-migration order #10 |
| G-DS-3 | **Status colors appear only on badges/banners/dots.** Next-owner banner colors (red/amber/aqua) follow §15.3 rule: every color cue is paired with an icon or text label. | DESIGN_DIRECTION §15.3 |
| G-DS-4 | **Brand colors do not communicate state.** Champagne Gold remains premium-tier-only; Swan Aqua is for primary CTA and focus ring. | DESIGN_DIRECTION §13.3 |
| G-DS-5 | **Vietnamese copy throughout.** All toast strings, banner copy, dialog descriptions, and "Tính năng đang phát triển" placeholder use Vietnamese. | CLAUDE.md "Vietnamese UI" |
| G-DS-6 | **Glass morphism preserved.** Sidebar + Topbar remain `bg-white/80 backdrop-blur-xl`; no opacity changes from B.4.1. | CLAUDE.md Premium Theme |
| G-DS-7 | **Touch targets ≥ 44 × 44 px on mobile.** Status filter `<Select>` and `<ConfirmDialog>` action buttons must respect M2 / DESIGN_DIRECTION §16. | UI_REFACTOR_PLAN §5.4 |
| G-DS-8 | **A11y default props already shipped — preserve them.** Use `aria-label`, `role`, `aria-labelledby`, `focus-visible` from A.2 / A.3 / B.2.4; do not regress. | Anti-pattern A6 (hidden-only permissions) and A11 (PII) |

---

## 4. Dependencies

### 4.1 Sprint-internal dependency graph

```
A.3 CloseIconButton (Sprint 6.1 ✅ shipped)
  └─► B.4.5 (native confirm → ConfirmDialog)

A.2 Modal focus trap (Sprint 6.1 ✅ shipped)
  └─► B.4.5

B.2.4 ConfirmDialog `info | warning | danger` variants (Sprint 6.2 ✅ shipped)
  └─► B.4.5

B.1.2 CASE_STATUS_TRANSITIONS cleanup (Sprint 6.1 ✅ shipped)
  └─► B.4.2 (next-owner banner needs accurate transition table)

B.1.7 dynamic CSKH resolution (Sprint 6.1 ✅ shipped)
  └─► B.4.2 (next-owner name resolution reuses getAllUsers pattern)

(getAllUsers helper, Role type, ROLE_LABELS — already present in src/)
```

**No cross-sprint blockers.** Every dependency landed in Sprint 6.1 or 6.2.

### 4.2 Feature-flag dependencies

| Flag | Required for | Sprint 6.3 default (dev) | Sprint 6.3 default (prod) |
|:-----|:-------------|:-------------------------|:--------------------------|
| `NEXT_PUBLIC_FEATURE_MINH_SCREEN` | B.4.1 rollout in production | `true` | **`false`** (per BACKLOG §9) |
| `NEXT_PUBLIC_FEATURE_SHARED_MENU` | carried over from 6.1 | `true` | **`false`** |
| `NEXT_PUBLIC_FEATURE_SERVER_RBAC` | carried over from 6.1 | `true` | **`false`** |
| `NEXT_PUBLIC_FEATURE_PAYMENT_SOD` | carried over from 6.1 (RR-3 sign-off in flight) | `true` | **`false`** |
| `NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST` | carried over from 6.2 | `true` | **`false`** |
| `NEXT_PUBLIC_FEATURE_CHECKLIST_GATE` | carried over from 6.2 | `true` | **`false`** |

**B.4.2 / B.4.3 / B.4.4 / B.4.5 / B.4.6 ship UN-FLAGGED by design** — they are additive copy/structure changes that cannot regress. (Pattern consistent with B.1.5 / B.2.3 / B.2.4 from Sprint 6.2.)

### 4.3 External dependencies

- **No new npm packages.** `package.json` delta = 0.
- **No new Firestore indexes.** No schema changes. No data migrations.
- **No new env vars** (one new flag: `NEXT_PUBLIC_FEATURE_MINH_SCREEN`).
- **No new design tokens** (G-DS-1).

---

## 5. Order of Implementation

Five dev-days, two FEs. Optimized for: **(a) unblock the 🔴 AppShell fix first** so all subsequent visual-regression baselines are taken against the new layout; **(b) pair the highest-risk story (B.4.5 ConfirmDialog replacement) with the lowest-risk adjacent story (B.4.3 display names) so FE-2 has review bandwidth; (c) sequence coordination activities C-1 / C-2 to week 1 while code lands in week 2.**

### Day-by-day plan

| Day | FE-1 (10h) | FE-2 (10h) | FE-3 (10h) | Cross-cutting |
|:----|:-----------|:------------|:-----------|:--------------|
| **Day 1 (Mon)** | **B.4.1** AppShell `min-h-screen` + flag wiring (2h) → visual regression sweep on 5 routes × 3 viewports (4h) | **B.4.2** T1 compute next-owner + transition lookup (2h) | **B.4.3** Payment display name resolver + column wiring (2h) → test (1h) | **C-1** schedule B.2.1 medical director availability |
| **Day 2 (Tue)** | **B.4.6** Status filter responsive — chips/Select (2h) → Playwright mobile sweep (2h) | **B.4.2** T2 render `<NextOwnerBanner>` composite (2h) → T3 tests (1h) | **B.4.4** Topbar profile toast (1h) → test (0.5h) | **C-2** B.3.1 sign-off meeting prep (SOP doc draft) |
| **Day 3 (Wed)** | **B.4.6** mobile sweep continuation + paired review for FE-2 (B.4.5) (4h) | **B.4.5** audit + replace `window.confirm()` calls (3h) → tests (1h) | Code review / paired review (4h) | **C-1** B.2.1 medical director dry-run (3-case walkthrough) |
| **Day 4 (Thu)** | Buffer for rebase, axe-core scan, regression fixes, RR-8 `CONTRIBUTING.md` update (4h) | Buffer for paired review on FE-3, axe-core, mobile Playwright fixes (4h) | Buffer + visual regression capture **C-3** for 5 routes × 5 devices (4h) | **C-2** B.3.1 sign-off meeting |
| **Day 5 (Fri)** | **Final regression sweep** — tsc/lint/build/vitest/axe-core/Playwright (2h). Sprint 6.3 report write-up (2h) | Paired review sign-offs (2h). Buffer (2h) | Visual regression diff (2h). Buffer (2h) | Final commit squash, tag, docs update |

### Critical-path justification

- **B.4.1 first.** The new `min-h-screen` layout is the foundation every subsequent visual-regression baseline depends on. Capturing baselines **after** B.4.1 means the 5 other stories ship against a stable reference frame.
- **B.4.2 second.** Next-owner banner is the densest story (5h, 3 subtasks, new composite). Schedule it before B.4.5 so FE-2 has full bandwidth on the highest-effort story of the sprint.
- **B.4.5 mid-sprint.** Native-confirm replacement is the second-highest risk (🟡, touches 2 routes, must preserve A9 fix). Doing it on Day 3 with paired review from FE-1 maximizes review bandwidth before the Friday sweep.
- **Coordination in week 1.** C-1 (B.2.1 medical director) and C-2 (B.3.1 sign-off) both have external dependencies (medical director + CEO calendars). Schedule early so sign-offs land before Sprint 6.4 starts.

### Pairing rules

- **B.4.5 requires paired review** (🟡, touches multiple files, A9 anti-pattern).
- **B.4.2 requires paired review** (🟡, new composite, color logic).
- **B.4.1 requires paired review with ui-designer** (🔴, visual regression on 5 routes × 3 viewports — see RR from Sprint 6.2 §8 R1).
- B.4.3 / B.4.4 / B.4.6 — single-reviewer is acceptable (🟢).

---

## 6. Files Affected

### 6.1 New files (estimated)

| Path | Story | Purpose |
|:-----|:------|:--------|
| `docs/ux-redesign/STORY_B4_1_IMPLEMENTATION_REPORT.md` | B.4.1 | Paired report (per Sprint 6.2 template) |
| `docs/ux-redesign/STORY_B4_1_MIGRATION_NOTES.md` | B.4.1 | Paired migration notes |
| `docs/ux-redesign/STORY_B4_2_IMPLEMENTATION_REPORT.md` | B.4.2 | Paired report |
| `docs/ux-redesign/STORY_B4_2_MIGRATION_NOTES.md` | B.4.2 | Paired migration notes |
| `docs/ux-redesign/STORY_B4_3_IMPLEMENTATION_REPORT.md` | B.4.3 | Paired report |
| `docs/ux-redesign/STORY_B4_3_MIGRATION_NOTES.md` | B.4.3 | Paired migration notes |
| `docs/ux-redesign/STORY_B4_4_IMPLEMENTATION_REPORT.md` | B.4.4 | Paired report |
| `docs/ux-redesign/STORY_B4_4_MIGRATION_NOTES.md` | B.4.4 | Paired migration notes |
| `docs/ux-redesign/STORY_B4_5_IMPLEMENTATION_REPORT.md` | B.4.5 | Paired report |
| `docs/ux-redesign/STORY_B4_5_MIGRATION_NOTES.md` | B.4.5 | Paired migration notes |
| `docs/ux-redesign/STORY_B4_6_IMPLEMENTATION_REPORT.md` | B.4.6 | Paired report |
| `docs/ux-redesign/STORY_B4_6_MIGRATION_NOTES.md` | B.4.6 | Paired migration notes |
| `docs/ux-redesign/SPRINT_6_3_COMPLETION_REPORT.md` | Sprint hygiene | Closes the sprint |
| `docs/ux-redesign/SOP_FINALIZE_B31_PAYMENT_SOD.md` | C-2 | Lock-in SOP for production flag promotion |
| `src/app/(protected)/cases/[id]/__tests__/next-owner-banner.test.tsx` | B.4.2 test | Component test for banner |
| `src/components/payments/__tests__/payment-list-display-names.test.tsx` | B.4.3 test | Column rendering test |
| `src/components/layout/__tests__/topbar-profile-toast.test.tsx` | B.4.4 test | Toast-on-click test |
| `src/app/(protected)/cases/[id]/__tests__/confirm-dialog-replacement.test.tsx` | B.4.5 test | A9 regression test |
| `src/app/(protected)/customers/[id]/__tests__/delete-approval-confirm.test.tsx` | B.4.5 test | A9 regression test |
| `src/components/cases/__tests__/case-list-status-filter-responsive.test.tsx` | B.4.6 test | Mobile Select rendering test |
| `src/app/(protected)/__tests__/app-shell-min-height.test.tsx` | B.4.1 test | Layout wrapper test |
| `e2e/visual/mobile-regression.spec.ts` (or extend existing Playwright sweep) | C-3 | 5-route × 5-device snapshot |

**New file estimate: ~22 files** (12 docs + 7 tests + 3 hygiene).

### 6.2 Modified files

| Path | Story | Change |
|:------|:------|:-------|
| `src/app/(protected)/layout.tsx` | B.4.1 | `h-screen` → `min-h-screen`; flag gate |
| `src/lib/feature-flags.ts` | B.4.1 | Add `MINH_SCREEN` to `FeatureFlag` union |
| `src/app/(protected)/cases/[id]/page.tsx` | B.4.2 + B.4.5 | Render `<NextOwnerBanner>` above status badge; replace native `confirm()` on remove-service with `<ConfirmDialog variant="danger">` |
| `src/components/cases/status-workflow.tsx` | B.4.2 | Accept + display next-owner context (or accept `nextOwner` prop from parent) |
| `src/constants/case-status.ts` | B.4.2 | Add `nextOwner` derivation helper `getNextOwner(currentStatus)` returning `{ role, reason } \| null` |
| `src/components/payments/payment-list.tsx` | B.4.3 | Replace raw user-ID rendering with `getAllUsers()` resolution; add "Người nhập" + "Người xác nhận" columns |
| `src/components/layout/topbar.tsx` | B.4.4 | Wire "Hồ sơ" dropdown item to `<Toast>` info message; remove RR-5 `as never` cast (cleanup) |
| `src/app/(protected)/customers/[id]/page.tsx` | B.4.5 | Replace native `confirm()` on delete-approval with `<ConfirmDialog variant="warning">` |
| `src/components/cases/case-list.tsx` | B.4.6 | Conditional render: chips on `md+`, `<Select>` on `< md`; wire `?status=` query param |
| `src/lib/hooks/useMediaQuery.ts` (or extend existing) | B.4.6 | New tiny hook (or reuse if present) for breakpoint detection |
| `.env.local` | B.4.1 | Add `NEXT_PUBLIC_FEATURE_MINH_SCREEN=false` |
| `CONTRIBUTING.md` | RR-8 | Document Conventional Commits prefix convention |

**Modified file estimate: ~12 files.**

### 6.3 Files explicitly NOT touched

- `src/components/ui/*` — no new primitives; no modifications to existing primitives.
- `src/lib/firestore/*` — no new domain logic; no schema changes; no transactional code paths.
- `src/lib/types/*` — no new fields on any entity.
- `src/constants/permissions.ts` — no RBAC changes (B.4.5 only swaps the UI surface, not the underlying permission).
- `tailwind.config.ts` / `src/app/globals.css` — no new tokens, no new animations.
- `package.json` — zero new dependencies.

---

## 7. Test Strategy

Per `qa-architect` 10-layer test pyramid (UI_REFACTOR_PLAN §5.1) + Sprint 6.2 test-density benchmark (259 → 443 = +184 tests, +10 files in 6.2; targeting +60–80 tests across +5–7 files for 6.3).

### 7.1 Test pyramid targets

| Layer | Tool | Sprint 6.3 scope | Owner |
|:------|:-----|:-----------------|:------|
| 1. Functional (unit) | Vitest + RTL | B.4.2 banner color logic (3 colors × 5 statuses); B.4.3 name resolver; B.4.4 toast trigger; B.4.5 each replaced `confirm()`; B.4.6 responsive breakpoint | FE-2 / FE-3 |
| 2. Validation | Vitest + Zod | N/A — no schema changes in 6.3 | — |
| 3. Workflow | Vitest state machine | B.4.2: next-owner derivation against full `CASE_STATUS_TRANSITIONS` × 28 statuses | medical-workflow-expert |
| 4. Permission | Vitest + mock fixtures | B.4.5: ConfirmDialog renders for `DELETE_APPROVE_ROLES` only; verify no regression for other roles | rbac-expert |
| 5. Security | Vitest + audit log mocks | N/A — no new audit events in 6.3 (B.4.5 swap is structural only) | — |
| 6. Integration | Vitest + Next route mocks | B.4.5: integration test on `/customers/[id]` delete-approval flow uses `<ConfirmDialog>`, no native browser dialog | tech-lead |
| 7. Performance | Manual + Lighthouse | B.4.1: dashboard render < 200 ms with new layout; case detail 8 tabs < 300 ms | nextjs-expert |
| 8. Data integrity | Vitest + Firestore transaction mocks | N/A — no new transactional code | — |
| 9. Mobile / responsive | Playwright + device matrix | **C-3 primary deliverable**: 360 / 390 / 412 / 768 / 1280 px on 5 routes × 3 viewports; snapshot baseline + diff = 0 | qa-architect |
| 10. Regression | Playwright snapshot diffs | Per-route per-viewport screenshots; per-role sidebar matrix; per-status case-list filter snapshot | qa-architect |

### 7.2 Per-story test scenarios

| Story | Required tests | Pass criteria |
|:------|:--------------|:--------------|
| **B.4.1** | (a) unit: `layout.tsx` renders with `min-h-screen` class when flag ON; renders with `h-screen` when OFF · (b) Playwright: iPhone 12 viewport, no URL-bar overlap on `/dashboard`, `/cases/[id]`, `/customers`, `/customers/[id]`, `/payments` · (c) anti-pattern: no `<div class="h-screen">` in `src/app/(protected)/layout.tsx` after merge | (a) both flag states render correctly · (b) zero overlap · (c) grep clean |
| **B.4.2** | (a) unit: `getNextOwner()` returns correct `{ role, reason, urgency }` for each of 28 case statuses · (b) unit: banner color logic — red when blocked/overdue, amber when action-needed, aqua when neutral · (c) unit: missing assignment → fallback text "Chưa phân công" · (d) Playwright: case Info tab banner renders above status badge | All 28 statuses produce deterministic output; missing-assignment case handled gracefully; banner visible on Info tab |
| **B.4.3** | (a) unit: payment list resolver maps `createdBy` and `confirmedBy` to `displayName` · (b) unit: unknown user ID renders `"—"` fallback · (c) unit: no raw `user-001` strings in component output | (a) resolver returns 12-role fixture names correctly · (b) unknown user → `"—"` · (c) A2 anti-pattern grep clean |
| **B.4.4** | (a) unit: clicking "Hồ sơ" fires `<Toast>` info with text "Tính năng đang phát triển" · (b) unit: toast auto-dismisses after 3 s · (c) unit: no `href` attribute on the menu item | Toast renders with correct type + Vietnamese copy; A8 anti-pattern grep clean |
| **B.4.5** | (a) unit: zero `window.confirm` / `window.alert` calls outside `__tests__/` and the documented B.2.1 L2 pre-flight · (b) integration: case detail remove-service opens `<ConfirmDialog variant="danger">` · (c) integration: customer delete-approval opens `<ConfirmDialog variant="warning">` · (d) axe-core: each new ConfirmDialog has focus trap + ESC + return-focus | A9 anti-pattern grep clean; both flows use `<ConfirmDialog>`; axe-core 0 critical on each dialog |
| **B.4.6** | (a) unit: at `width < md` (`< 768 px`), `<Select>` renders with all status options · (b) unit: at `width ≥ md`, chips render (existing behavior preserved) · (c) Playwright: 360 px viewport shows `<Select>`; 1024 px shows chips · (d) unit: `?status=` query param filters list correctly via either UI | No horizontal overflow at 360 px; both UIs filter identically; query param respected |

### 7.3 Anti-pattern grep gate (must run before merge)

```bash
# A9 — native confirm/alert (Sprint 6.3 deliverable)
grep -rE "window\.(confirm|alert)" src/ | grep -v __tests__/
# Expected: 0 matches in 6.3-touched files; the 1 documented B.2.1 L2 alert may remain until Sprint 7.x refactor.

# A2 — raw user IDs in copy (B.4.3 deliverable)
grep -rE "user-\d{3}" src/components
# Expected: 0 matches.

# A8 — dead links (B.4.4 deliverable)
grep -rE 'href=["\047]#["\047]' src/components/layout/topbar.tsx
# Expected: 0 matches on topbar; "Hồ sơ" must use onClick→toast, not href.

# M5 — horizontal scroll at 360 px (C-3 deliverable)
# Playwright snapshot: scrollWidth === clientWidth on 5 routes.
```

### 7.4 Accessibility testing (B.4.1, B.4.5, B.4.6 specifically)

- **axe-core scan** after B.4.1 merge: 0 critical on `/dashboard`, `/cases/[id]`, `/customers`, `/customers/[id]`, `/payments`.
- **axe-core scan** after B.4.5 merge: 0 critical on each new `<ConfirmDialog>` (focus trap + ESC + return-focus).
- **Keyboard sweep** for B.4.6: tab into `<Select>` opens list; arrow keys navigate options; ESC closes; selection fires.
- **Manual NVDA / VoiceOver pass** on B.4.4: "Tính năng đang phát triển" toast is announced.

---

## 8. Rollback Strategy

Sprint 6.3 is **fully revert-safe**. Three layers of rollback, mirroring Sprint 6.2 §10.

### 8.1 Per-story feature-flag rollback (lightest touch)

Only **B.4.1** ships behind a flag. The other 5 stories ship un-flagged (additive copy/structure only).

```bash
# B.4.1 rollback — flip flag, restart
sed -i 's/NEXT_PUBLIC_FEATURE_MINH_SCREEN=.*/NEXT_PUBLIC_FEATURE_MINH_SCREEN=false/' .env.local
npm run dev   # or redeploy
```

Behavior reverts to `h-screen` legacy without code change.

### 8.2 Per-story git revert (selective)

| Story | Revert command | Time | Data impact |
|:------|:---------------|:-----|:------------|
| **B.4.1** | `git revert <merge-sha>` | < 5 min | None — wrapper class only |
| **B.4.2** | `git revert <merge-sha>` | < 10 min | None — banner is read-only composite |
| **B.4.3** | `git revert <merge-sha>` | < 5 min | None — name resolution is display-only |
| **B.4.4** | `git revert <merge-sha>` | < 5 min | None — toast is ephemeral |
| **B.4.5** | `git revert <merge-sha>` | < 15 min | None — both flows revert to native `confirm()` (legacy behavior) |
| **B.4.6** | `git revert <merge-sha>` | < 5 min | None — chips re-render on all viewports (slightly cramped on mobile, but functional) |

### 8.3 Whole-sprint rollback (catastrophic recovery)

```bash
# Revert all Sprint 6.3 commits in reverse order
git revert <last-6.3-sha> <second-to-last-6.3-sha> ... <first-6.3-sha>

# Disable the new flag
sed -i 's/NEXT_PUBLIC_FEATURE_MINH_SCREEN=.*/NEXT_PUBLIC_FEATURE_MINH_SCREEN=false/' .env.local

# Verify
npm run lint && npx tsc --noEmit && npm run build && npx vitest run
```

**Time to rollback:** < 15 minutes.

**Data impact:** **None.** Sprint 6.3 has zero schema changes, zero data migrations, zero new entity fields. (Confirmed per §1 "explicitly out of scope" list.)

### 8.4 Rollback drill

Before Sprint 6.3 ships to production, conduct a 30-minute rollback drill in a sandbox:

1. Tag a release candidate `release/v6.3.0-rc1` on `main` after all 6.3 commits land.
2. In sandbox, revert B.4.1 commit only.
3. Verify: `npx tsc --noEmit` + `npx vitest run` + `npm run build` all green.
4. Manually smoke 3 routes: `/dashboard`, `/cases/[id]`, `/customers/[id]` — confirm `h-screen` legacy restored, no banner regression.
5. Set `FEATURE_MINH_SCREEN=false`; verify flag controls behavior.
6. Document outcome in Sprint 6.3 completion report §10.

### 8.5 Rollback blast-radius summary

| Rollback scope | Time | User impact |
|:---------------|:-----|:------------|
| B.4.1 flag flip | < 1 min | URL-bar overlap returns on iOS Safari |
| Single-story git revert | < 15 min | Story's UX behavior reverts to legacy |
| Whole-sprint revert | < 15 min | Sprint 6.2 surface preserved (no regression — 6.3 is purely additive) |

---

## 9. Definition of Done

Per `tech-lead` skill (CLAUDE.md Phase conventions) + `qa-architect` release gate. **A story is "Done" only when ALL checkboxes below are green; the sprint is "Done" when ALL stories are Done.**

### 9.1 Per-story Definition of Done

For each of the 6 stories:

- [ ] **UI complete** — every acceptance criterion from BACKLOG View 1 §B.4.x met.
- [ ] **Validation implemented** — Vietnamese error messages where applicable; no silent failures.
- [ ] **Loading, error, empty states** — at least one of each state explicitly designed (per ux-designer skill).
- [ ] **RBAC enforced** — no permission expansion or contraction; existing `useCurrentUser()` patterns preserved.
- [ ] **Audit log** — no new audit events required for 6.3 (B.4.5 is structural only); verify no accidental writeAuditLog call introduced.
- [ ] **Firestore real data** — no mock-data-only branches; verified against mock store + ready for real Firestore (no schema changes needed).
- [ ] **Firebase errors handled** — `try/catch` on every async path; error toast on failure; graceful degradation.
- [ ] **Mobile responsive** — tested at 360 / 390 / 768 / 1280 px; no horizontal scroll; touch targets ≥ 44 × 44 px.
- [ ] **Vietnamese copy** — every user-facing string reviewed by ux-designer.
- [ ] **Premium theme preserved** — no new tokens, no color drift, no spacing drift.
- [ ] **A11y** — axe-core 0 critical on the touched route; keyboard reachable; focus visible; ARIA correct.
- [ ] **Unit + integration tests written** — paired test files per story; coverage of happy path + at least one negative case.
- [ ] **`tsc --noEmit` → 0 errors.**
- [ ] **`tsc -p tsconfig.test.json --noEmit` → 0 errors.**
- [ ] **`npm run lint` → 0 warnings.**
- [ ] **`npm run build` → 34 routes, 0 errors, no bundle bloat (target ≤ 5% delta, expected 0%).**
- [ ] **Anti-pattern grep clean** — A2 / A8 / A9 greps return expected counts.
- [ ] **Paired review approved** — for 🟡 and 🔴 stories; single review acceptable for 🟢.
- [ ] **`STORY_B4_x_IMPLEMENTATION_REPORT.md` and `STORY_B4_x_MIGRATION_NOTES.md` written** (mirroring Sprint 6.2 §3.1).

### 9.2 Sprint-level Definition of Done

Sprint 6.3 is "Done" when **all** of the following are green:

#### Build & quality gates (mirroring Sprint 6.2 §5)

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npx tsc -p tsconfig.test.json --noEmit` → 0 errors (B.2.4 noted 10 pre-existing in `customer-form.test.tsx` from 6.1; verify no new ones)
- [ ] `npm run lint` → 0 warnings, 0 errors
- [ ] `npm run build` → 34 routes, 0 errors, 87.4 kB shared JS preserved (≤ 5% delta)
- [ ] `npx vitest run` → all green (target: ≥ 503 tests, +60–80 from Sprint 6.2 baseline of 443)
- [ ] No new `eslint-disable` or `@ts-ignore` comments introduced

#### Anti-pattern gate

- [ ] A2 (raw user IDs in copy): 0 matches — **FIXED by B.4.3**
- [ ] A8 (dead links): 0 matches on topbar — **FIXED by B.4.4**
- [ ] A9 (native `confirm`/`alert`): 0 matches on 6.3-touched files — **FIXED by B.4.5** (1 pre-existing B.2.1 alert may remain, documented)
- [ ] M5 (horizontal scroll at 360 px): 0 occurrences on 5 routes — **FIXED by B.4.1 + B.4.6 + verified by C-3**

#### Cross-sprint regression

- [ ] Sprint 6.1 + 6.2 exit criteria still passing (no regression)
- [ ] All 5 carry-over feature flags unchanged (`.env.local` defaults preserved)
- [ ] 1 new flag added: `NEXT_PUBLIC_FEATURE_MINH_SCREEN` (dev: true, prod: false)
- [ ] No data migrations (verified: zero schema changes in 6.3)

#### Coordination gate

- [ ] **C-1:** B.2.1 medical director dry-run completed with 3-case walkthrough; sign-off in §7.1 of B.2.1 implementation report updated to ✅
- [ ] **C-2:** B.3.1 sign-off coordination completed; CEO + accountant-lead + product-owner triple sign-off captured OR explicitly deferred to Sprint 6.4 with documented blocker
- [ ] **C-3:** Visual regression baseline captured on 5 routes × 5 devices; diff = 0 vs baseline; mobile sweep green

#### Documentation gate

- [ ] `docs/ux-redesign/SPRINT_6_3_COMPLETION_REPORT.md` written (mirroring Sprint 6.2 template)
- [ ] 12 story docs committed (6 implementation reports + 6 migration notes)
- [ ] 1 SOP committed (`SOP_FINALIZE_B31_PAYMENT_SOD.md`) if C-2 produced one
- [ ] `CONTRIBUTING.md` updated for RR-8 (Conventional Commits)

### 9.3 Sprint exit criteria (BACKLOG View 2 Sprint 6.3)

Verbatim from BACKLOG §View 2:

- [ ] Mobile Safari renders dashboard without URL-bar overlap (B.4.1) ✅
- [ ] No horizontal scroll at 360 px on any route (B.4.1 + B.4.6) ✅
- [ ] Case Info tab shows next-owner banner with role + name (B.4.2) ✅
- [ ] Payment list shows display names (not raw IDs) (B.4.3) ✅
- [ ] Profile "Hồ sơ" shows info toast (B.4.4) ✅
- [ ] Zero `window.confirm()` calls remain in 6.3-touched files (B.4.5) ✅
- [ ] Status filter: chips on desktop, `<Select>` on mobile (B.4.6) ✅
- [ ] Visual regression green on 5 routes × 3 viewports (C-3) ✅

---

## 10. Recommended Commit Sequence

Per `qa-architect` recommendation (paired review per commit) + RR-8 (Conventional Commits prefix, **finally adopted this sprint**).

### 10.1 Conventional Commits convention (RR-8)

```
<type>(<scope>): <subject>

<body — wrap at 72 chars>

<footer — refs, sign-offs>
```

Types used in Sprint 6.3:

- `feat` — new user-visible functionality (B.4.2 banner, B.4.3 columns, B.4.4 toast, B.4.5 dialog swap, B.4.6 Select)
- `fix` — bug fix (B.4.1 iOS Safari overlap)
- `chore` — tooling / config (RR-8 `CONTRIBUTING.md`, `.env.local` flag)
- `test` — test-only changes
- `docs` — documentation only

Scope examples: `appshell`, `case-detail`, `payment-list`, `topbar`, `confirm-dialog`, `case-list`, `contributing`.

### 10.2 Commit sequence (chronological, Day 1 → Day 5)

```
# Day 1 — AppShell foundation
chore(env): add NEXT_PUBLIC_FEATURE_MINH_SCREEN flag (default false in prod)
fix(appshell): replace h-screen with min-h-screen behind FEATURE_MINH_SCREEN
test(appshell): add layout min-h-screen test
docs: STORY_B4_1 implementation report + migration notes

# Day 1 — Payment list
feat(payment-list): resolve createdBy/confirmedBy to display names
test(payment-list): add display-name column resolver test
docs: STORY_B4_3 implementation report + migration notes

# Day 2 — Next-owner banner
feat(case-status): add getNextOwner derivation helper
feat(case-detail): render NextOwnerBanner on Info tab
test(case-detail): add next-owner banner tests
docs: STORY_B4_2 implementation report + migration notes

# Day 2 — Topbar profile toast
feat(topbar): wire "Hồ sơ" menu item to info toast
test(topbar): add profile toast trigger test
docs: STORY_B4_4 implementation report + migration notes

# Day 3 — Native confirm replacement
refactor(case-detail): replace window.confirm with ConfirmDialog (remove-service)
refactor(customer-detail): replace window.confirm with ConfirmDialog (delete-approval)
test: add confirm-dialog replacement tests
docs: STORY_B4_5 implementation report + migration notes

# Day 3 — Status filter responsive
feat(case-list): responsive status filter (chips desktop / Select mobile)
test(case-list): add responsive status filter tests
docs: STORY_B4_6 implementation report + migration notes

# Day 4 — Hygiene
chore(contributing): document Conventional Commits prefix convention (RR-8)
docs: SOP_FINALIZE_B31_PAYMENT_SOD.md (C-2 output)

# Day 5 — Sprint close
docs: SPRINT_6_3_COMPLETION_REPORT.md
```

**Total: ~22 commits.** One commit per logical change unit; one docs commit per story; one final report commit.

### 10.3 Commit dependency graph

```
chore(env flag) ──► fix(appshell) ──► test(appshell)
                                      └─► feat(case-status) ──► feat(case-detail)
                                                                   └─► test(case-detail)

feat(payment-list) ──► test(payment-list)
feat(topbar) ──► test(topbar)

refactor(case-detail) ──► refactor(customer-detail) ──► test(confirm-dialog)
feat(case-list responsive) ──► test(case-list)

chore(contributing)  (independent)
docs(SOP_F31)  (independent, C-2 output)
docs(SPRINT_6_3 report)  (last, depends on all)
```

### 10.4 Squashing policy

- **Do not squash** the 6.3 commits into a single "Sprint 6.3" merge — keep granular commits so rollback can target individual stories (§8.2).
- **Squash locally** only when merging a feature branch with intermediate WIP commits (not applicable here — work lands directly on `main` per Sprint 6.2 pattern).
- **Tag** the sprint close: `git tag release/v6.3.0-rc1` after final commit, before any production deployment.

---

## 11. Visual Regression Checklist

Per `qa-architect` (§6.1) + `ux-designer` (mobile-first). Captured in `C-3` activity on Day 4.

### 11.1 Routes × viewports × devices

**5 protected routes × 5 viewports × 12 role mocks = 300 baseline snapshots** (subset of the 21 × 3 × 12 = 756 total Phase D matrix).

| Route | 360 px (iPhone SE) | 390 px (iPhone 12) | 412 px (Pixel 7) | 768 px (iPad Mini) | 1280 px (Desktop) |
|:------|:------------------:|:------------------:|:----------------:|:------------------:|:------------------:|
| `/dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/cases/[id]` (Info tab) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/customers/[id]` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/payments` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/cases` (list) | ✅ | ✅ | ✅ | ✅ | ✅ |

**Total: 25 snapshots × 12 roles = 300 baseline images.**

### 11.2 Per-route visual regression checks

For each of the 5 routes:

- [ ] No horizontal scroll at any viewport (M5)
- [ ] No URL-bar overlap on iOS Safari viewport (B.4.1)
- [ ] Topbar sticks to top (sticky `backdrop-blur-xl`)
- [ ] Sidebar visible on `md+`, replaced by mobile-nav on `< md`
- [ ] Touch targets ≥ 44 × 44 px on `< sm`
- [ ] Case detail: status badges readable; next-owner banner (B.4.2) visible above status badge
- [ ] Customer detail: delete-approval banner (B.4.5) renders as `<ConfirmDialog>` modal (not native browser dialog)
- [ ] Case list: status filter renders as chips on `md+`, `<Select>` on `< md` (B.4.6)
- [ ] Payment list: "Người nhập" + "Người xác nhận" columns show display names (B.4.3)
- [ ] Topbar: "Hồ sơ" item shows info toast on click (B.4.4), no dead link
- [ ] Sidebar accent color on active item (premium theme)
- [ ] Status badges use the color palette from `CASE_STATUS_HEX` (no drift)

### 11.3 Per-role sidebar visibility regression

From BACKLOG §F-HIGH-02 (already shipped in Sprint 6.1) + Sprint 6.2 verification:

| # | Check | Pass criteria |
|---:|:------|:--------------|
| 1 | All 12 roles render identical sidebar items at desktop | Visual diff = 0 |
| 2 | All 12 roles render identical mobile-nav items at mobile | Visual diff = 0 |
| 3 | `nurse` / `cskh_postop` do NOT see status-change UI on case detail (RR-2 carry-over verified in 6.2) | Verified |
| 4 | `doctor` sees status-change UI including "Hoàn thành thủ thuật" with B.2.4 second-confirm | Verified |
| 5 | `sales_online` / `sales_offline` see filtered menu | Verified |

### 11.4 Per-finding visual verification

| Finding | Visual check | Pass criteria |
|:--------|:-------------|:--------------|
| F-CRIT-01 | iPhone 12 viewport on `/dashboard` | No URL-bar overlap; all content reachable without scroll bouncing |
| F-CRIT-09 | Case Info tab on `/cases/[id]` | Next-owner banner visible above status badge; role + name rendered |
| F-HIGH-17 | Payment list at 1280 px | Two new columns visible with display names (not `user-001`) |
| F-HIGH-01 | Topbar dropdown at 1280 px | "Hồ sơ" item present, no `href`, click triggers toast |
| F-MED-01 | Customer delete-approval at 1280 px | `<ConfirmDialog variant="warning">` renders (not native browser confirm) |
| F-MED-06 | Case list at 360 px | `<Select>` dropdown visible; no horizontal scroll |

### 11.5 Bundle-size delta check

```bash
npm run build
# Verify: First Load JS shared by all = 87.4 kB (no bloat)
# Verify: 34 routes, 0 errors
# Verify: Δ ≤ 5% (target 0% — no new primitives)
```

---

## 12. Manual QA Checklist

Per `qa-architect` (10 test layers — manual smoke covers layers 7, 9, 10) + `ux-designer` (real-device verification). To be executed on **Day 4** by qa-architect + ui-designer, before final regression sweep on Day 5.

### 12.1 Build & quality gates (Day 5 morning)

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npx tsc -p tsconfig.test.json --noEmit` → 0 errors
- [ ] `npm run lint` → 0 warnings
- [ ] `npm run build` → 34 routes, 0 errors, 87.4 kB shared JS
- [ ] `npx vitest run` → ≥ 503 tests passing (target: 443 + 60–80 new)
- [ ] No new `eslint-disable` or `@ts-ignore` comments

### 12.2 Anti-pattern grep gate (Day 5 morning)

```bash
# A2 — raw user IDs (B.4.3 deliverable)
grep -rE "user-\d{3}" src/components
# Expected: 0 matches

# A8 — dead links (B.4.4 deliverable)
grep -rE 'href=["\047]#["\047]' src/components/layout/topbar.tsx
# Expected: 0 matches

# A9 — native confirm/alert (B.4.5 deliverable)
grep -rE "window\.(confirm|alert)" src/ | grep -v __tests__/
# Expected: 1 documented pre-existing match (B.2.1 L2 pre-flight, intentional)
# Verify: NO matches in cases/[id]/page.tsx remove-service handler
# Verify: NO matches in customers/[id]/page.tsx delete-approval handler

# M5 — horizontal scroll at 360 px (B.4.1 + B.4.6 deliverable)
# Verify via Playwright snapshot in §12.5

# Feature flag inventory
grep -E "NEXT_PUBLIC_FEATURE_" .env.local
# Expected: 6 flags, MINH_SCREEN new and = false, others unchanged
```

### 12.3 Story-by-story smoke (dev mode, 12 mock users)

#### B.4.1 — AppShell `min-h-screen`

- [ ] Open `/dashboard` in Chrome desktop (1280 px) — content fills viewport; `min-h-screen` visible in DevTools class list
- [ ] Open `/dashboard` in iPhone 12 Safari — no URL-bar overlap; scroll-to-bottom reveals footer without bounce
- [ ] Toggle `NEXT_PUBLIC_FEATURE_MINH_SCREEN=false` → behavior reverts to `h-screen`; verify class change in DevTools
- [ ] Navigate to all 5 regression routes × 3 viewports — no overlap on any combination

#### B.4.2 — Next-owner banner

- [ ] Open case in `consulting` status — banner shows next owner (likely sales/master_sales) in aqua
- [ ] Open case in `awaiting_lab` status — banner shows next owner (likely cskh_postop or coordinator) in amber
- [ ] Open case in `blocked` status — banner shows next owner in red
- [ ] Open case with no `staffAssignment` set — banner shows "Chưa phân công" fallback (no crash)
- [ ] Banner positioned ABOVE status badge in vertical order on Info tab
- [ ] Banner color paired with icon (per DESIGN_DIRECTION §15.3) — not color-only signal

#### B.4.3 — Payment list display names

- [ ] Open `/payments` — "Người nhập" column shows display names (e.g., "Nguyễn Văn A"), not `user-001`
- [ ] Open `/payments` — "Người xác nhận" column shows display names or `"—"` if not confirmed
- [ ] Seed data: verify 23 payments across 6 months all show resolved names
- [ ] Unknown user ID (force via DevTools) renders `"—"` fallback, not crash

#### B.4.4 — Topbar profile toast

- [ ] Open topbar dropdown on desktop — "Hồ sơ" item present
- [ ] Click "Hồ sơ" → info toast appears with text "Tính năng đang phát triển"
- [ ] Toast auto-dismisses after 3 seconds (visual)
- [ ] DevTools: "Hồ sơ" item has no `href` attribute
- [ ] Mobile (390 px): same behavior; toast appears in mobile-safe area

#### B.4.5 — Native `confirm()` → `<ConfirmDialog>`

- [ ] Open `/cases/[id]` → click "Xóa dịch vụ" on a service — `<ConfirmDialog variant="danger">` opens (not native browser dialog)
- [ ] Cancel dialog → no DB write; service remains in list
- [ ] Confirm dialog → service removed; success toast appears
- [ ] Open `/customers/[id]` with `DELETE_APPROVE_ROLES` role → click "Yêu cầu xóa" / "Phê duyệt xóa" → `<ConfirmDialog variant="warning">` opens (not native)
- [ ] axe-core scan on each dialog: focus trap works; ESC closes; focus returns to trigger; `aria-labelledby` correct

#### B.4.6 — Status filter responsive

- [ ] Open `/cases` on desktop (1024 px) — status filter renders as chips (existing behavior)
- [ ] Resize to 360 px — status filter switches to `<Select>` dropdown
- [ ] Both UIs filter the list identically when a status is selected
- [ ] `?status=consulting` query param filters list on initial load
- [ ] No horizontal overflow at 360 px on `/cases`

### 12.4 Per-role smoke (12 mock users, dev mode)

For each of the 12 roles: `admin`, `ceo`, `cso`, `master_sales`, `sales_online`, `sales_offline`, `accountant`, `doctor`, `nurse`, `coordinator`, `cskh_postop`, `media`:

- [ ] Sidebar items match expected set (BACKLOG §F-HIGH-02 verified in 6.1)
- [ ] Mobile-nav items match expected set
- [ ] `/dashboard` renders without permission errors
- [ ] `/cases/[id]` renders next-owner banner with appropriate role context (B.4.2)
- [ ] `/payments` shows correct column visibility per role (B.4.3)
- [ ] No console errors or hydration warnings (RR-4 acknowledged but should not regress)

### 12.5 Mobile device smoke (real devices, C-3)

For each of: iPhone SE (360 × 667), iPhone 12 (390 × 844), Pixel 7 (412 × 915), iPad Mini (768 × 1024), Desktop Chrome (1280 × 800):

- [ ] `/dashboard` — no horizontal scroll; no URL-bar overlap (iOS Safari only); sticky topbar works
- [ ] `/cases/[id]` — Info tab banner visible; status badges readable; delete-approval dialog opens
- [ ] `/customers/[id]` — CCCD section visible to authorized roles; delete-approval dialog opens
- [ ] `/payments` — two new columns visible without horizontal scroll
- [ ] `/cases` — status filter renders correctly (chips on iPad/Desktop, Select on phones)

### 12.6 Cross-sprint regression (verify nothing from 6.1 / 6.2 broke)

- [ ] Tabs ARIA + arrow-key navigation (6.1 A.1) — still works
- [ ] Modal focus trap + `aria-labelledby` (6.1 A.2) — still works
- [ ] CloseIconButton (6.1 A.3) — still used in modals
- [ ] Shared Textarea (6.1 A.4) — no inline `<textarea>` introduced
- [ ] Shared Sidebar Menu Config (6.1 A.5) — 12 roles render identical sidebar
- [ ] CCCD fields (6.1 B.1.1) — render in customer form
- [ ] `hospital_confirmed` → `scheduled` blocked (6.1 B.1.2) — StatusWorkflow does not show button
- [ ] Server-side status enforcement (6.1 B.1.3) — non-authorized role gets 403
- [ ] Dashboard `lab_overdue_count` (6.1 B.1.4) — red StatCard still clickable
- [ ] Complaint notification recipients (6.1 B.1.6) — doctor/nurse/coordinator included
- [ ] Dynamic CSKH resolution (6.1 B.1.7) — display name shown
- [ ] `medical_alert_resolved` terminal status (6.1 B.2.2) — badge + icon
- [ ] Payment SoD (6.1 B.3.1) — accountant cannot confirm
- [ ] Pipeline rename + revenue annotation (6.1 B.3.3) — chart titles + red refund line
- [ ] Audit PII redaction (6.2 B.2.3) — `[ĐÃ ẨN]` placeholder with tooltip
- [ ] `procedure_completed` second-confirm (6.2 B.2.4) — dialog opens; date required
- [ ] Auto-escalate followup (6.2 B.1.5) — `painLevel >= 4` triggers medical alert
- [ ] Clinical checklist gate (6.2 B.2.1) — red banner + disabled buttons when incomplete

### 12.7 Documentation regression

- [ ] `CLAUDE.md` — Phase 6 status table updated (carry to Sprint 7 if needed; not required for 6.3)
- [ ] `docs/ux-redesign/SITEMAP.md` — no new routes added in 6.3 (verify)
- [ ] Each new component prop documented in JSDoc (no new primitives, but verify inline `<NextOwnerBanner>` composite has JSDoc)
- [ ] All 12 story docs committed
- [ ] `CONTRIBUTING.md` updated for RR-8

### 12.8 Sign-off chain (mirroring Sprint 6.2 §7)

| Gate | Sign-off by | Status (target) |
|:-----|:------------|:----------------|
| Tech Lead (build/lint/tests) | tech-lead | ✅ Self-attested in completion report §5 |
| QA Architect (test strategy + axe-core) | qa-architect | ✅ Self-attested in completion report §4 |
| UX Designer (Vietnamese copy + mobile sweep) | ux-designer | ☐ Pending manual review (C-3) |
| Release Manager (flag inventory + rollback) | release-manager | ☐ Deferred to staging promotion |
| Medical Workflow Expert (B.2.1 dry-run from C-1) | medical-workflow-expert | ☐ Pending dry-run execution |
| CEO + Product Owner (final go/no-go) | CEO + product-owner | ☐ After all above |

---

## Appendix A — Sprint 6.3 at a glance

| ID | Title | Files | Tests added | Flag | Risk | Sign-off blocker |
|:---|:------|:------|:-----------:|:-----|:-----|:-----------------|
| B.4.1 | AppShell `min-h-screen` | 1 mod + 2 new + 2 docs | 10–15 | `MINH_SCREEN` | 🔴 | ui-designer + qa-architect |
| B.4.2 | Next-owner banner | 3 mod + 1 new + 2 docs | 15–20 | — | 🟡 | ux-designer |
| B.4.3 | Payment display names | 1 mod + 1 new + 2 docs | 6–10 | — | 🟢 | — |
| B.4.4 | Topbar profile toast | 1 mod + 1 new + 2 docs | 4–6 | — | 🟢 | — |
| B.4.5 | Native confirm → ConfirmDialog | 3 mod + 2 new + 2 docs | 12–18 | — | 🟡 | qa-architect (a11y) |
| B.4.6 | Status filter responsive | 2 mod + 1 new + 2 docs | 6–8 | — | 🟢 | — |
| C-1 | B.2.1 medical dry-run | 0 code | 0 | — | — | medical director |
| C-2 | B.3.1 sign-off | 1 SOP | 0 | — | — | CEO + accountant-lead |
| C-3 | Visual regression baseline | 1 Playwright spec | 0 | — | — | qa-architect + ui-designer |
| RR-8 | Conventional Commits | 1 mod (`CONTRIBUTING.md`) | 0 | — | — | tech-lead |
| **Total** | — | **~12 mod, ~22 new** | **60–80 new** | **1 new** | — | — |

## Appendix B — Verification command set (copy-paste)

```bash
# Full verification (run after every merge)
npx tsc --noEmit                            # → 0 errors
npx tsc -p tsconfig.test.json --noEmit      # → 0 errors
npm run lint                                # → 0 warnings
npm run build                               # → 34 routes, 0 errors, 87.4 kB shared JS
npx vitest run                              # → ≥ 503 passed (≥ 25 files)

# Anti-pattern grep gate
grep -rE "window\.(confirm|alert)" src/ | grep -v __tests__/   # → 1 documented match (B.2.1 L2)
grep -rE "user-\d{3}" src/components                            # → 0 matches (A2, B.4.3)
grep -rE 'href=["\047]#["\047]' src/components/layout/topbar.tsx # → 0 matches (A8, B.4.4)
grep -rE "as never" src/components/layout/                      # → 0 matches (RR-5 carry-over)

# Feature flag inventory
grep -E "NEXT_PUBLIC_FEATURE_" .env.local
# Expected:
# NEXT_PUBLIC_FEATURE_SHARED_MENU=false
# NEXT_PUBLIC_FEATURE_SERVER_RBAC=false
# NEXT_PUBLIC_FEATURE_PAYMENT_SOD=false
# NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST=false
# NEXT_PUBLIC_FEATURE_CHECKLIST_GATE=false
# NEXT_PUBLIC_FEATURE_MINH_SCREEN=false        ← NEW in 6.3

# Conventional Commits verification
git log --oneline | grep -vE "^(feat|fix|chore|test|docs|refactor|perf|build|ci)"
# Expected: only Sprint 6.2 and earlier commits use unprefixed labels
# Sprint 6.3 commits all use Conventional Commits prefix

# Documentation
test -f docs/ux-redesign/STORY_B4_1_IMPLEMENTATION_REPORT.md
test -f docs/ux-redesign/STORY_B4_1_MIGRATION_NOTES.md
test -f docs/ux-redesign/STORY_B4_2_IMPLEMENTATION_REPORT.md
test -f docs/ux-redesign/STORY_B4_2_MIGRATION_NOTES.md
test -f docs/ux-redesign/STORY_B4_3_IMPLEMENTATION_REPORT.md
test -f docs/ux-redesign/STORY_B4_3_MIGRATION_NOTES.md
test -f docs/ux-redesign/STORY_B4_4_IMPLEMENTATION_REPORT.md
test -f docs/ux-redesign/STORY_B4_4_MIGRATION_NOTES.md
test -f docs/ux-redesign/STORY_B4_5_IMPLEMENTATION_REPORT.md
test -f docs/ux-redesign/STORY_B4_5_MIGRATION_NOTES.md
test -f docs/ux-redesign/STORY_B4_6_IMPLEMENTATION_REPORT.md
test -f docs/ux-redesign/STORY_B4_6_MIGRATION_NOTES.md
test -f docs/ux-redesign/SPRINT_6_3_COMPLETION_REPORT.md
```

## Appendix C — Risk register carry-over from Sprint 6.2

| # | Risk from 6.2 §8 | Sprint 6.3 handling |
|:--|:-----------------|:--------------------|
| R1 | 🔴 B.2.1 medical director sign-off not collected | **C-1** — dry-run scheduled Day 1–3 |
| R2 | 🔴 B.2.1 misconfiguration could block transitions | Stays 🔴 until C-1 sign-off; flag default OFF in prod remains |
| R3 | 🟡 Five flags default OFF in prod | Continues; 6.3 adds 1 more flag, also OFF in prod |
| R4 | 🟡 B.1.5 notification storm | Mitigated by debounce; not in 6.3 scope |
| R5 | 🟡 Pre-B.2.3 audit logs contain raw PII | Documented trade-off; not in 6.3 scope |
| R6 | 🟡 B.2.4 `actualProcedureDate` client-only | Not in 6.3 scope; Sprint 7.3 / C.3.2 |
| R7 | 🟡 RR-3 B.3.1 sign-off pending | **C-2** — coordination scheduled Day 1–4 |
| R8 | 🟡 RR-4 B.1.4 Suspense boundary | Deferred to Sprint 6.4 (per 6.2 §11.4) |
| R9 | 🟡 RR-8 Conventional Commits | **Carry to Sprint 6.3 as 0.5h cleanup** — `CONTRIBUTING.md` updated |
| R10 | 🟡 `window.alert` in B.2.1 L2 pre-flight | Out of 6.3 scope; Sprint 7.x |
| R11 | 🟡 A.5 topbar `as never` cast | Cleanup piggy-backed on B.4.4 (topbar file) |
| R12 | 🟡 B.2.1 race condition | Out of 6.3 scope; Sprint 7.x |
| R13 | 🟡 B.2.1 stale flag combo warns but doesn't crash | Documented; not in 6.3 scope |
| R14 | 🟡 B.1.5 `getAllUsers()` whole-collection read | Out of 6.3 scope; pre-prod scale work |
| R15 | 🟢 B.1.5 ships un-flagged by design | Continues |
| R16 | 🟢 axe-core jsdom canvas warning | Pre-existing test-only noise |

**Top blockers for Sprint 6.3 production flag promotion (in priority order):**

1. 🔴 R1 / R2 — B.2.1 medical director sign-off + staging dry-run (C-1)
2. 🟡 R7 — B.3.1 sign-off coordination (C-2)
3. 🟡 R11 — topbar `as never` cast (cleanup piggy-backed on B.4.4)

None of these block Sprint 6.3 code work from starting.

---

*End of Sprint 6.3 Execution Plan.*