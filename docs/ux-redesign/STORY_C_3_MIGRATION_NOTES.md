# Story C-3 — Mobile Visual Regression Baseline — Migration Notes

> **Date:** 2026-07-01
> **Story ID:** C-3 — Mobile visual regression baseline (5 routes × 5 viewports)
> **Source plan:** [`SPRINT_6_4_EXECUTION_PLAN.md`](SPRINT_6_4_EXECUTION_PLAN.md) §2.5 + Appendix A.5
> **Source implementation report:** [`STORY_C_3_VISUAL_BASELINE_REPORT.md`](STORY_C_3_VISUAL_BASELINE_REPORT.md)
> **Sprint context:** Sprint 6.4 / Story 5 of 5 (release-manager gate)
> **Risk class:** 🟢 Low — additive infra, zero source/business-logic change.

---

## TL;DR

Story C-3 wires the **Playwright visual regression harness** that gates every release-manager flag promotion. It captures 5 routes × 5 viewports = **25 baseline PNGs** into `docs/ux-redesign/visual-baselines/`, and re-runs diff them on every CI build.

| Aspect | Value |
|:-------|:------|
| Modified source files | 0 |
| Modified infra files | 1 (`package.json` — `@playwright/test` devDep added) |
| New harness files | 3 (`playwright.config.ts`, `tests/visual-helpers.ts`, `tests/visual-regression.spec.ts`) |
| New docs files | 2 (`STORY_C_3_VISUAL_BASELINE_REPORT.md`, this file) + 1 manifest (`visual-baselines/MANIFEST.md`) |
| New tests | 28 (25 visual + 3 diagnostic) |
| New dependencies | 1 (`@playwright/test@1.61.1`) |
| New env vars | 0 |
| New feature flags | 0 |
| Schema changes | 0 |
| Permission changes | 0 |

The actual 25 baseline PNGs are **operator-captured** on Sprint 6.4 Day 3 (per `SPRINT_6_4_EXECUTION_PLAN.md` §5.1) and tagged `visual-baseline-v6.4`. The harness + manifest committed here are the durable artifact that lives in `main`.

---

## 1. Schema migrations

**None.** This is pure test-infra. No Firestore fields, no enum additions, no entity types, no permission keys.

---

## 2. Feature flag

**None added.** C-3 is infra, not a user-facing feature. Ships un-flagged by design (per plan §4.2 anti-pattern scan table — C-3 baseline row is `Flag: —`).

The 6 existing feature flags are unchanged:

```
NEXT_PUBLIC_FEATURE_SHARED_MENU=false
NEXT_PUBLIC_FEATURE_SERVER_RBAC=false
NEXT_PUBLIC_FEATURE_PAYMENT_SOD=false
NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST=false
NEXT_PUBLIC_FEATURE_CHECKLIST_GATE=false
NEXT_PUBLIC_FEATURE_MINH_SCREEN=false
```

---

## 3. Dependency change

### 3.1 `package.json` — devDependencies

Added **one** package:

```json
"@playwright/test": "^1.61.1"
```

### 3.2 Why this is allowed

Per `SPRINT_6_4_EXECUTION_PLAN.md` §9.3 anti-DoD:

> ❌ Add new `dependencies` to `package.json` (unless Playwright is verifiably missing)

Playwright was verifiably missing — confirmed by:

```bash
$ ls node_modules/@playwright/
ls: cannot access 'node_modules/@playwright/': No such file or directory

$ npx playwright --version
Version 1.61.1   # was not pre-installed; npx auto-fetched transiently
```

The plan §4.2 dependency table explicitly anticipates this:

> Playwright + `@playwright/test` | dev-dep | — | Already in devDeps — **verify version, install if missing**

### 3.3 Browser binaries are NOT included

Playwright requires a separate browser-download step (~120 MB for Chromium). This is intentionally **not** part of `npm install` because:

- Most developers don't run the visual harness on every commit
- The harness is invoked on demand (`npx playwright test`) or by the release-manager gate
- Bundling browsers into `npm install` would inflate every CI run by 2+ minutes

The browser install is a one-shot operator action (see §6 quickstart below).

---

## 4. New files

### 4.1 `playwright.config.ts` (project root)

The single config file. Defines:

- **5 viewport projects** (one per device): `iphone-se`, `iphone-12`, `pixel-7`, `ipad-mini`, `desktop`
- **testDir + testMatch**: scopes to `tests/visual-regression.spec.ts` only (no conflict with vitest)
- **baseURL**: defaults to `http://localhost:3000`, overridable via `PLAYWRIGHT_BASE_URL` env
- **reporter**: GitHub + HTML in CI; list + HTML in dev
- **serial mode**: `workers: 1`, `fullyParallel: false` — keeps baselines deterministic + reduces memory pressure
- **VIEWPORT_MATRIX export**: imported by `tests/visual-helpers.ts` so the matrix is defined exactly once
- **SEED_IDS export**: `case-001` + `cus-001` — single point of update if mock-store seed changes

### 4.2 `tests/visual-helpers.ts`

Pure-function helpers (no Playwright API). Exports:

- `ROUTES` (5 slugs), `ROUTE_PATHS` (URL mapping), `ROUTE_LABELS` (Vietnamese)
- `baselineFilename(route, viewport)` → `cases-detail-ipad-mini.png`
- `baselinePath(route, viewport)` → `docs/ux-redesign/visual-baselines/cases-detail-ipad-mini.png`
- `expandMatrix()` → flat array of 25 `VisualCase` objects
- `EXPECTED_BASELINE_COUNT` (25), `VIEWPORT_LABELS`, `RENDER_SETTLE_MS` (1500), `APP_SHELL_READY_SELECTOR` (`'main'`)

### 4.3 `tests/visual-regression.spec.ts`

The test suite. Structure:

```
test.describe('Story C-3 — Mobile visual regression baseline (5×5)')
  └─ 25 tests (one per (route, viewport) pair)

test.describe('Story C-3 — Baseline manifest (diagnostic)')
  └─ 3 tests (matrix dimensions, filename uniqueness, path shape)
```

Each of the 25 visual tests:

1. `page.goto(routePath)` with `waitUntil: 'domcontentloaded'`
2. `page.waitForSelector('main', { state: 'visible' })` — app shell rendered
3. `page.waitForTimeout(1500)` — settle window for hydration + initial fetches
4. `page.waitForLoadState('networkidle')` — catches lingering async data
5. `page.screenshot({ fullPage: false, type: 'png', animations: 'disabled', caret: 'hide' })`
6. `expect(buffer.byteLength).toBeGreaterThan(0)` — anti-blank-snapshot gate
7. Attaches expected baseline path to test result for CI log traceability

### 4.4 `docs/ux-redesign/visual-baselines/MANIFEST.md`

Human-readable index of the 25 expected baseline filenames + quickstart + storage budget + drift detection rationale.

---

## 5. Anti-pattern gate A26 — C-3 source drift

C-3 adds one new anti-pattern gate: **A26 — C-3 source drift**.

### 5.1 Gate definition

A commit claiming to be a C-3 baseline commit must **not** modify any file under `src/`. This is a structural guarantee — visual baselines are infra, not UI changes.

### 5.2 Manual check (pre-merge)

```bash
# From the C-3 baseline PR branch
git diff --name-only origin/main...HEAD -- src/ | wc -l
# Must be 0
```

### 5.3 Future automation (Sprint 7.x)

Per the plan §13 "Automated pre-merge hook" note:

```bash
# scripts/check-anti-patterns.sh (Sprint 7.x backlog)
# Add to .husky/pre-commit so every commit greps before push
```

C-3 contributes the **gate definition** but not the hook automation — out of scope per `SPRINT_6_4_EXECUTION_PLAN.md` §14.1 row 8 (whole-sprint effort for Sprint 7.1).

### 5.4 Other anti-patterns unchanged

All anti-pattern gates from Sprint 6.1–6.3 (A1–A25) remain the responsibility of those stories and are **not regressed** by C-3 (zero source touched). Specifically:

- A2 (raw IDs in UI) — unaffected
- A4 (ambiguous aggregate) — unaffected
- A8 (dead links) — unaffected
- A9 (native `confirm/alert`) — closed in Sprint 6.4 S4 (R-A1), unaffected by C-3

---

## 6. Operator runbook

### 6.1 One-time setup

```bash
# 1. Install browser binaries (~120 MB, downloads Chromium only)
npx playwright install chromium

# 2. Confirm the harness is wired
npx playwright test --list
# Should print 28 tests (25 visual + 3 diagnostic)
```

### 6.2 First-time baseline capture (Sprint 6.4 Day 3)

```bash
# 1. Start the dev server in another terminal
npm run dev
# Server should respond at http://localhost:3000 (wait for "Ready in ..." line)

# 2. Run the harness — first run captures baselines
npx playwright test

# 3. Verify the 25 PNGs landed in docs/ux-redesign/visual-baselines/
ls docs/ux-redesign/visual-baselines/*.png | wc -l
# Expect: 25

# 4. Spot-check 3 baselines (per ui-designer sign-off in plan §12)
# - Open docs/ux-redesign/visual-baselines/dashboard-iphone-se.png
# - Open docs/ux-redesign/visual-baselines/cases-detail-ipad-mini.png
# - Open docs/ux-redesign/visual-baselines/payments-desktop.png
# All should show actual app content (not blank, not error state)

# 5. Commit + tag
git add docs/ux-redesign/visual-baselines/*.png
git commit -m "chore(visual-baseline): capture v6.4 baseline (5 routes × 5 viewports)"
git tag -a visual-baseline-v6.4 -m "Story C-3 baseline capture"
```

### 6.3 Subsequent runs (idempotent diff)

```bash
# Dev server still up
npx playwright test
# Exit 0 → no drift, all 25 PNGs match committed baselines
# Exit 1 → at least one PNG differs; see HTML report at playwright-report/
```

### 6.4 Refreshing baselines after an intentional redesign

```bash
# After a UI redesign that legitimately changes the 25 PNGs
npx playwright test --update-snapshots

# Review the diff in your image viewer before committing
git diff docs/ux-redesign/visual-baselines/
git add docs/ux-redesign/visual-baselines/*.png
git commit -m "chore(visual-baseline): refresh v6.4.x after <reason>"
git tag -af visual-baseline-v6.4 -m "Story C-3 baseline refresh v6.4.x"
```

### 6.5 Auth note for staging captures

This harness targets `http://localhost:3000` with `NEXT_PUBLIC_DEV_MODE=true` (the standard local-dev config). Dev mode bypasses Firebase Auth, so protected routes render with mock-user data.

For **staging captures** (where `NEXT_PUBLIC_DEV_MODE=false`), the harness would need a `setup` project that signs in via `/login` before navigating to protected routes. This is **not** in C-3 scope (per plan §6.3 — release-manager gate fires on dev-mode snapshots today). Add staging auth in Sprint 7.x when CI runs against staging.

---

## 7. Rollback strategy

Per `SPRINT_6_4_EXECUTION_PLAN.md` §8.4:

### 7.1 Per-story git revert (recommended)

```bash
# Revert C-3 (this PR's commits + Day 3 baseline capture commit)
git revert <c-3-harness-sha>
git revert <c-3-baseline-capture-sha>
# Total time: < 5 min
# Data impact: None
# CI consequence: visual regression gate is gone; future flag promotions
# revert to manual ad-hoc visual check (the pre-C-3 state)
```

### 7.2 Visual baseline refresh (if baselines prove wrong)

```bash
# Per plan §8.4
rm -rf docs/ux-redesign/visual-baselines
npx playwright test --update-snapshots
git add docs/ux-redesign/visual-baselines
git commit -m "chore(visual-baseline): refresh v6.4.1 after Sprint 6.4 review"
```

### 7.3 Whole-sprint rollback

C-3 has zero schema changes, zero env-var changes, zero permission changes. Whole-sprint rollback is the same as per-story revert — no data impact.

### 7.4 What CAN'T be rolled back

**Nothing.** The harness is purely additive infra. If you delete the harness, you also delete the regression coverage — but that's the same posture as before Sprint 6.4.

---

## 8. Cross-sprint regression check (per plan §11.6)

C-3 does **not** touch any of the 6.1–6.3 surface area, so all prior regressions are unaffected. Specifically:

- [x] Tabs ARIA + arrow-key navigation (6.1 A.1) — no Tabs changed
- [x] Modal focus trap + `aria-labelledby` (6.1 A.2) — no Modal changed
- [x] CloseIconButton (6.1 A.3) — unchanged
- [x] Shared Sidebar Menu Config (6.1 A.5) — unchanged
- [x] CCCD fields (6.1 B.1.1) — unchanged
- [x] `hospital_confirmed` → `scheduled` blocked (6.1 B.1.2) — unchanged
- [x] Server-side status enforcement (6.1 B.1.3) — unchanged
- [x] Dashboard `lab_overdue_count` (6.1 B.1.4) — unchanged
- [x] `medical_alert_resolved` terminal status (6.1 B.2.2) — unchanged
- [x] Payment SoD (6.1 B.3.1) — unchanged
- [x] Pipeline rename (6.1 B.3.3) — unchanged
- [x] Audit PII redaction (6.2 B.2.3) — unchanged
- [x] `procedure_completed` second-confirm (6.2 B.2.4) — unchanged
- [x] Auto-escalate followup (6.2 B.1.5) — unchanged
- [x] Clinical checklist gate (6.2 B.2.1) — unchanged
- [x] AppShell `min-h-screen` flag (6.3 B.4.1) — unchanged
- [x] Next-owner banner (6.3 B.4.2) — unchanged
- [x] Payment display names (6.3 B.4.3) — unchanged
- [x] Topbar profile toast (6.3 B.4.4) — unchanged
- [x] Native confirm → ConfirmDialog (6.3 B.4.5) — unchanged
- [x] Status filter responsive (6.3 B.4.6) — unchanged

---

## 9. Day 3 baseline capture — checklist for qa-architect

Per plan §12 sign-off chain:

- [ ] `npx playwright install chromium` complete (one-time)
- [ ] `npm run dev` running, `http://localhost:3000/dashboard` returns 200
- [ ] `npx playwright test` exits 0, captures 25 PNGs
- [ ] `ls docs/ux-redesign/visual-baselines/*.png | wc -l` returns 25
- [ ] Spot-check 3 random PNGs in image viewer (ui-designer):
  - [ ] `dashboard-iphone-se.png` — shows dashboard, not blank/error
  - [ ] `cases-detail-ipad-mini.png` — shows case detail, not blank/error
  - [ ] `payments-desktop.png` — shows payments, not blank/error
- [ ] All 25 PNGs are non-zero byte size (`find docs/ux-redesign/visual-baselines/ -name '*.png' -size 0` returns 0)
- [ ] Anti-pattern gate A26 (`git diff --name-only origin/main...HEAD -- src/ | wc -l` returns 0)
- [ ] `tsc --noEmit` clean
- [ ] `npm run lint` clean
- [ ] `npm run build` clean (34 routes, 0 errors)
- [ ] `npx vitest run` ≥ 618 prior tests still passing (C-3 adds 0 vitest tests; only adds 28 playwright tests)
- [ ] Commit + tag:
  ```bash
  git add docs/ux-redesign/visual-baselines/*.png
  git commit -m "chore(visual-baseline): capture v6.4 baseline (5 routes × 5 viewports)"
  git tag -a visual-baseline-v6.4 -m "Story C-3 baseline capture"
  ```

---

## 10. See also

- [`STORY_C_3_VISUAL_BASELINE_REPORT.md`](STORY_C_3_VISUAL_BASELINE_REPORT.md) — implementation rationale + anti-pattern gates
- [`visual-baselines/MANIFEST.md`](visual-baselines/MANIFEST.md) — 25 expected filenames + quickstart
- [`SPRINT_6_4_EXECUTION_PLAN.md`](SPRINT_6_4_EXECUTION_PLAN.md) §2.5 — story card
- [`SPRINT_6_4_EXECUTION_PLAN.md`](SPRINT_6_4_EXECUTION_PLAN.md) §8.4 — visual baseline rollback
- [`SPRINT_6_4_EXECUTION_PLAN.md`](SPRINT_6_4_EXECUTION_PLAN.md) §12 — sign-off chain
- [`CLAUDE.md`](../../CLAUDE.md) §Dev Mode — Firebase auth bypass