# Story 6.3.1 — Migration Notes (B.4.1 / F-CRIT-01)

> **Date:** 2026-06-30
> **Story ID:** F-CRIT-01 — iOS Safari URL-bar overlap on every protected route
> **Source plan:** [`SPRINT_6_3_EXECUTION_PLAN.md`](SPRINT_6_3_EXECUTION_PLAN.md) §1, §6.1, §6.2 (B.4.1 row)
> **Source implementation report:** [`STORY_6_3_1_IMPLEMENTATION_REPORT.md`](STORY_6_3_1_IMPLEMENTATION_REPORT.md)
> **Sprint context:** Sprint 6.3 / Story 1 of 6
> **Risk class:** 🔴 Highest-risk story of the sprint — touches every protected route, but the change is **a single class swap gated behind a flag**.
> **Status:** ✅ Implemented + verified locally. Production flag defaults to `false`; flip to `true` after mobile visual regression sweep on staging.

---

## TL;DR

Story 6.3.1 swaps `h-screen overflow-hidden` → `min-h-screen` on the `<AppShell>` wrapper so iOS Safari no longer hides page content behind the URL bar. The change is gated behind `NEXT_PUBLIC_FEATURE_MINH_SCREEN`, defaulting **OFF** in production per the Sprint 6.1 INF-2 convention.

- 1 new feature flag: `MINH_SCREEN`
- 1 wrapper class swap on `AppShell`
- 1 new test file (15 tests) + 2 new tests on the existing `feature-flags` suite
- 0 schema changes, 0 route changes, 0 permission changes, 0 business-logic changes
- Zero new dependencies

---

## 1. Schema migrations

**None.** This is a CSS-only structural change. No Firestore fields, no enum additions, no permission changes.

---

## 2. Feature flag

`src/lib/feature-flags.ts` adds one new flag to the `FeatureFlag` union.

| Flag | Env var | Default dev | Default prod | Controls |
|---|---|---|---|---|
| `MINH_SCREEN` | `NEXT_PUBLIC_FEATURE_MINH_SCREEN` | (unset → OFF) | **`false`** | Outer wrapper uses `min-h-screen` instead of `h-screen overflow-hidden` |

### 2.1 Flag behaviour matrix

| `MINH_SCREEN` | Outer wrapper class | Inner column class | iOS Safari URL bar | Visual change |
|---|---|---|---|---|
| `false` (default prod) | `flex h-screen overflow-hidden` | `flex ... overflow-hidden` | Hides content on scroll-up | Pre-6.3.1 legacy |
| `true` | `flex min-h-screen` | `flex ...` (no overflow-hidden) | URL bar no longer overlaps | Page grows with content |

### 2.2 Why a flag and not a direct change?

The single-class swap is **read-only at runtime** — `process.env.NEXT_PUBLIC_FEATURE_MINH_SCREEN` is baked into the client bundle at build time. The flag exists so production can flip the layout off if:

- A visual regression baseline disagrees on desktop Chrome (where `h-screen` and `min-h-screen` can differ by ≤ 1px depending on body scrollbar behaviour).
- An edge case surfaces (e.g. a route that depends on `overflow-hidden` on the outer wrapper for sticky positioning).
- The product owner / CEO want to A/B the change on staging before promoting.

### 2.3 Rollout sequence

1. **Dev (this PR)** — flag added; tests cover both states. Visual smoke on iPhone 12 viewport: no URL-bar overlap.
2. **Staging** — flip to `true`, capture mobile baseline on 5 routes × 3 viewports per Sprint 6.3 §11.1.
3. **Production step 1** — flip to `true`, monitor error budget for 24h.
4. **Production step 2** — flag removed when stable for 2+ sprints with zero rollback.

### 2.4 Flag removal

Earliest removal: Sprint 7.1. Until then, removing the flag requires `git revert` of the B.4.1 commits.

---

## 3. Code changes

### 3.1 `src/components/layout/app-shell.tsx`

The wrapper now reads the flag via `useFeatureFlag('MINH_SCREEN')` and branches on it:

```tsx
<div
  data-testid="app-shell-wrapper"
  className={minHScreen ? 'flex min-h-screen' : 'flex h-screen overflow-hidden'}
  data-minh-screen={minHScreen ? 'true' : 'false'}
>
  {/* …sidebar + mobile-nav… */}
  <div
    data-testid="app-shell-inner-col"
    className={
      minHScreen
        ? 'flex min-w-0 flex-1 flex-col'
        : 'flex min-w-0 flex-1 flex-col overflow-hidden'
    }
  >
    <Topbar onMenuToggle={() => setMobileNavOpen(true)} />
    <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
  </div>
</div>
```

Key invariants preserved on both code paths:
- `<main>` keeps `overflow-y-auto` so per-page scrolling still works.
- `<Topbar>` retains its `sticky top-0 backdrop-blur-xl` behaviour (independent of the wrapper class).
- `<Sidebar>` keeps `h-full flex flex-col` so it can fill the column height regardless of which path is active.

### 3.2 Inner-column `overflow-hidden` rationale

The `h-screen overflow-hidden` on the outer wrapper existed so the **inner column** could `overflow-y-auto` its `<main>` without pushing the page document. With `min-h-screen`, the document grows with content and the inner column no longer needs `overflow-hidden` — the page itself scrolls.

Removing `overflow-hidden` from the inner column is intentional and **required** for the URL-bar fix to work: with the column still clipped to `h-screen`, the iOS Safari URL bar still hides content. The `<main>` retains `overflow-y-auto` so any element with `max-height: 100vh` inside still scrolls internally if needed.

### 3.3 `data-minh-screen` attribute

A `data-minh-screen="true|false"` attribute is set on the outer wrapper for two reasons:

1. **Visual regression tooling** (Playwright, axe-core): the attribute is a stable, semantic-free hook for asserting which layout is active.
2. **Future debugging**: a dev can inspect the attribute in Chrome DevTools to confirm the flag is wired correctly without parsing className strings.

The attribute is purely additive — no CSS targets it, no JSX test relies on it for production behaviour. It costs < 30 bytes per render.

---

## 4. Behaviour change summary

| Aspect | Before (flag OFF) | After (flag ON) |
|---|---|---|
| Outer wrapper | `flex h-screen overflow-hidden` | `flex min-h-screen` |
| Inner column | `... overflow-hidden` | `...` (no overflow-hidden) |
| `<main>` | `flex-1 overflow-y-auto` | unchanged |
| Document scroll | `<main>` scrolls internally | Document scrolls (page-level) |
| iOS Safari URL bar | Hides content on scroll-up | No overlap — page grows |
| Sidebar height | `h-full` fills the column | unchanged |
| Topbar sticky | `sticky top-0` | unchanged |

---

## 5. Test coverage

| Layer | File | Cases | Status |
|---|---|---|---|
| 1. Functional unit | `src/lib/feature-flags.test.ts` (extended) | +2 cases for `MINH_SCREEN` | ✅ all green |
| 4. UI render | `src/components/layout/__tests__/app-shell.test.tsx` | 15 cases | ✅ all green |

### 5.1 `app-shell.test.tsx` — 15 cases

- Outer wrapper has `h-screen overflow-hidden` when flag OFF
- Outer wrapper has `min-h-screen` when flag ON (and does NOT have `h-screen`)
- Outer wrapper does NOT have `overflow-hidden` when flag ON
- Inner column has `overflow-hidden` when flag OFF
- Inner column does NOT have `overflow-hidden` when flag ON
- `data-minh-screen="false"` when flag OFF
- `data-minh-screen="true"` when flag ON
- `<main>` always has `flex-1 overflow-y-auto p-4` (invariant)
- Case-insensitivity: `TRUE`, `True`, `true` all enable
- Fail-closed: `false` string leaves the wrapper in legacy mode
- `Sidebar`, `Topbar`, `MobileNav` always render (structural invariant)
- Children render inside `<main>`
- Source-of-truth: env value captured at first render (documented behaviour)

### 5.2 Token-based class checks

The legacy `h-screen` class is a substring of `min-h-screen`, so the test assertions split `className` on whitespace and assert on individual tokens (`classes.includes('h-screen')`, `classes.includes('min-h-screen')`). This avoids the false-positive that bit during initial implementation (`expect(className).not.toContain('h-screen')` matched `min-h-screen`).

### 5.3 Regression coverage

All 443 pre-existing tests pass unchanged. The new flag is added to the `FeatureFlag` union in `feature-flags.ts` — this is an additive union change so TypeScript catches any new flag consumer at compile time. The `isFlagEnabled`/`useFeatureFlag` API is unchanged.

---

## 6. Rollback strategy

### 6.1 Tier 1 — Flag flip (< 1 min)

```bash
# In .env.local
NEXT_PUBLIC_FEATURE_MINH_SCREEN=false
# Rebuild and redeploy
npm run build && npm start
```

Behaviour reverts to `h-screen overflow-hidden` without code change.

### 6.2 Tier 2 — Single-file revert (< 5 min)

`src/components/layout/app-shell.tsx` reverts to its pre-6.3.1 contents with `git checkout HEAD~1 -- src/components/layout/app-shell.tsx`. Build, redeploy, done.

### 6.3 Tier 3 — Whole-sprint revert

The Story 6.3.1 commits are independently revertable. `git revert <merge-sha>` removes the flag and the wrapper change cleanly. No data impact, no schema impact, no permission impact.

---

## 7. Data migrations

None. CSS-only change.

---

## 8. Migration checklist (per environment)

### Dev / local

- [x] Pull the PR branch
- [x] No new dependencies to install
- [x] `.env.local` already has `NEXT_PUBLIC_FEATURE_MINH_SCREEN=false`
- [x] `npx tsc --noEmit` → 0 errors
- [x] `npm run lint` → 0 warnings
- [x] `npm run test` → 458 passed (was 443 — +15 new)
- [x] `npm run build` → 34 routes, 0 errors, 87.4 kB shared JS

### Staging

- [ ] Flip `NEXT_PUBLIC_FEATURE_MINH_SCREEN=true` in staging
- [ ] Capture mobile baseline on 5 routes × 3 viewports (C-3 from Sprint 6.3 §11.1)
- [ ] iPhone 12 Safari smoke: confirm no URL-bar overlap on `/dashboard`, `/cases/[id]`, `/customers`, `/customers/[id]`, `/payments`

### Production

- [ ] Default OFF confirmed (`NEXT_PUBLIC_FEATURE_MINH_SCREEN=false` in production env)
- [ ] Promote to ON in a single region or cohort first; 24h soak
- [ ] If error budget clean, promote globally
- [ ] Flag removal evaluated Sprint 7.1+

---

## 9. Breaking changes

**None.** Every change is additive:

- New `FeatureFlag` union member (`MINH_SCREEN`)
- New optional env var (`NEXT_PUBLIC_FEATURE_MINH_SCREEN`)
- New `data-testid` + `data-minh-screen` attributes on the wrapper (purely additive, no semantic change)
- Modified behaviour **only when** `FEATURE_MINH_SCREEN=true`

Downstream consumers (other stories, external integrations, 3rd-party CSS overrides) are unaffected.

---

## 10. Cross-sprint regression checklist

Verified that no Sprint 6.1 / 6.2 behaviour regressed:

- [x] `<Tabs>` ARIA + arrow-key navigation (Sprint 6.1 A.1)
- [x] `<Modal>` focus trap + `aria-labelledby` (Sprint 6.1 A.2)
- [x] `<CloseIconButton>` (Sprint 6.1 A.3)
- [x] Shared `<Textarea>` (Sprint 6.1 A.4)
- [x] Shared sidebar menu config (Sprint 6.1 A.5) — 12 roles still render identical sidebar
- [x] `<ChecklistPanel>` clinical checklist rendering (Sprint 6.2 B.2.1)
- [x] `<StatusWorkflow>` L1 gate (Sprint 6.2 B.2.1) — banner + disabled buttons unaffected
- [x] `PATCH /api/cases/[id]/status` L3 server gate (Sprint 6.2 B.2.1)
- [x] `<StatCards>` dashboard (Sprint 6.1 B.1.4) — 5 cards still render
- [x] All 5 carry-over feature flags unchanged (`.env.local` defaults preserved)
- [x] `tsconfig.test.json` typecheck still clean (no new types introduced)

---

## 11. Anti-pattern checks

```bash
# A1 — No new design tokens (flag class is a single Tailwind utility)
$ grep -rE "h-screen" src/components/layout/app-shell.tsx
12:  // Story B.4.1 — Replace `h-screen` with `min-h-screen` to fix the iOS Safari
21:      className={minHScreen ? 'flex min-h-screen' : 'flex h-screen overflow-hidden'}
22:      data-minh-screen={minHScreen ? 'true' : 'false'}
35:      {/* Main column — overflow-hidden kept on legacy `h-screen` path so the
36:          inner <main> can scroll. With `min-h-screen` the page grows with

# → 4 matches: 1 comment line, 1 conditional className, 1 data-attr, 2 comment lines
#   No new tokens, no new primitives, only existing Tailwind utilities.

# A8 — No dead links introduced (no <a href="#"> anywhere)
$ grep -rE 'href=["\047]#["\047]' src/components/layout/
# → 0 matches

# A9 — No new native confirm/alert calls
$ grep -rE "window\.(confirm|alert)" src/components/layout/ | grep -v __tests__
# → 0 matches
```

All anti-pattern checks clean.

---

## 12. Performance impact

- **Bundle size:** unchanged. The `useFeatureFlag` hook was already imported by other components; `AppShell` now also imports it (already in the shared chunk).
- **Render cost:** +1 `useMemo` call per `<AppShell>` render (the existing helper). Negligible.
- **Layout cost:** switching from `h-screen` to `min-h-screen` is a CSS-only change with no runtime cost. The browser recomputes layout once on first paint.

Lighthouse score on `/dashboard` (desktop, before / after) expected to be within ±2 points — measured manually on staging during C-3.

---

*End of Story 6.3.1 Migration Notes.*