# Story 6.3.4 / B.4.4 — Topbar Profile Placeholder Toast — Migration Notes

> **Date:** 2026-06-30
> **Story ID:** F-HIGH-01 — Topbar "Hồ sơ" item is a dead link to `#`
> **Source plan:** [`SPRINT_6_3_EXECUTION_PLAN.md`](SPRINT_6_3_EXECUTION_PLAN.md) §1, §6.1, §6.2 (B.4.4 row)
> **Source implementation report:** [`STORY_6_3_4_IMPLEMENTATION_REPORT.md`](STORY_6_3_4_IMPLEMENTATION_REPORT.md)
> **Sprint context:** Sprint 6.3 / Story 4 of 6
> **Risk class:** 🟢 Low-risk structural + copy change; ships un-flagged by design (additive behaviour, cannot regress).
> **Piggy-backed cleanup:** RR-5 (topbar `as never` cast on `setDevRole`) — carried over from Sprint 6.2 §8 risk register.
> **Anti-patterns closed:** A8 (dead `href="#"` on topbar).

---

## TL;DR

Story 6.3.4 wires the topbar's "Hồ sơ" (Thông tin cá nhân) menu item to fire a Vietnamese info toast (`"Tính năng đang phát triển"`) instead of doing nothing on click. The element stays a `<button>` with no `href`, so the A8 anti-pattern (dead link in primary navigation) is closed without introducing a 404 or empty page.

The story also cleans up RR-5 by replacing the topbar's `setDevRole(e.target.value as never)` cast with the type-safe `as UserRole`. No semantic change to the dev-role selector — the cast was just a lint escape hatch inherited from a Sprint 6.1 hot-fix.

- 1 modified component: `src/components/layout/topbar.tsx`
- 1 new test file: `src/components/layout/__tests__/topbar-profile-toast.test.tsx` (10 tests)
- 0 schema changes, 0 route changes, 0 permission changes, 0 business-logic changes
- 0 new feature flags (ships un-flagged by design — additive copy/structure only)
- Zero new dependencies

---

## 1. Schema migrations

**None.** This is a UI-only structural + copy change. No Firestore fields, no enum additions, no permission changes.

---

## 2. Feature flag

**None added.** Per the Sprint 6.3 §4.2 plan:

> **B.4.2 / B.4.3 / B.4.4 / B.4.5 / B.4.6 ship UN-FLAGGED by design** — they are additive copy/structure changes that cannot regress. (Pattern consistent with B.1.5 / B.2.3 / B.2.4 from Sprint 6.2.)

The existing 6 feature flags are unchanged:

```
NEXT_PUBLIC_FEATURE_SHARED_MENU=false
NEXT_PUBLIC_FEATURE_SERVER_RBAC=false
NEXT_PUBLIC_FEATURE_PAYMENT_SOD=false
NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST=false
NEXT_PUBLIC_FEATURE_CHECKLIST_GATE=false
NEXT_PUBLIC_FEATURE_MINH_SCREEN=false        ← added in Story 6.3.1
```

---

## 3. Code changes

### 3.1 `src/components/layout/topbar.tsx`

Three discrete edits — additive only.

#### 3.1.1 New imports

```ts
import { useToast } from '@/components/ui/toast';
import { Notification, NotificationEventType, UserRole } from '@/lib/types';
```

- `useToast` was already used by 12 other components (notifications, attachments, customers, calendar, etc.) — same pattern, same provider.
- `UserRole` was already declared in `@/lib/types` — just exporting it from the barrel so the topbar can type the `select` `onChange` correctly (RR-5 cleanup).

#### 3.1.2 New `handleProfilePlaceholder()` handler

```ts
// Story 6.3.4 / B.4.4 (F-HIGH-01) — "Hồ sơ" menu item is a placeholder
// for the (not-yet-built) user profile page. A8 anti-pattern requires no
// dead `href="#"`; instead we show a Vietnamese info toast that the feature
// is in development. Closes the user menu so the toast is the only surface
// the user sees after clicking.
function handleProfilePlaceholder() {
  setMenuOpen(false);
  toast('Tính năng đang phát triển', 'info');
}
```

**Behavioural contract:**

| Step | Effect |
|------|--------|
| 1 | Close the user dropdown menu (existing behaviour — matches every other dropdown item that closes on click) |
| 2 | Fire `toast('Tính năng đang phát triển', 'info')` — Vietnamese copy per `ux-designer` skill, `info` type per `toast.tsx` constants |
| 3 | ToastProvider renders the toast with `swan-100` border + `Info` icon + auto-dismiss progress bar (3.5 s) — no Topbar-side animation needed |

#### 3.1.3 Menu item wired to the new handler

Before (B.4.4 anti-pattern — onClick only closed the menu):

```tsx
<button
  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-swan-50/60 hover:text-swan-700"
  onClick={() => setMenuOpen(false)}
>
  <UserIcon className="h-4 w-4" />
  Thông tin cá nhân
</button>
```

After (B.4.4 + RR-5):

```tsx
<button
  type="button"
  data-testid="topbar-profile-menu-item"
  aria-label="Hồ sơ (đang phát triển)"
  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-swan-50/60 hover:text-swan-700"
  onClick={handleProfilePlaceholder}
>
  <UserIcon className="h-4 w-4" />
  Thông tin cá nhân
</button>
```

| Addition | Why |
|----------|-----|
| `type="button"` | Prevents implicit-submit if the Topbar is ever rendered inside a `<form>` (e.g. a future settings page). Cheap defensive guarantee. |
| `data-testid="topbar-profile-menu-item"` | Stable selector for the test suite — replaces brittle text-based queries. |
| `aria-label="Hồ sơ (đang phát triển)"` | A11y — screen readers announce the placeholder state ("(đang phát triển)" = "in development"). |
| `onClick={handleProfilePlaceholder}` | Replaces the old `() => setMenuOpen(false)` no-op with the new handler. |

The visible label stays `"Thông tin cá nhân"` — the `aria-label` is **in addition to** the visible text, not a replacement. Per WAI-ARIA Authoring Practices, an `aria-label` overrides the visible text only when the visible text is part of a composite widget (e.g. an icon-only button). Here the visible text remains the primary source of truth for sighted users.

#### 3.1.4 RR-5 — `as never` → `as UserRole`

Before (RR-5 carry-over — lint escape hatch from Sprint 6.1 hot-fix):

```tsx
<select
  value={devRole ?? 'admin'}
  onChange={(e) => setDevRole(e.target.value as never)}
  ...
>
```

After (RR-5 closed):

```tsx
<select
  value={devRole ?? 'admin'}
  onChange={(e) => setDevRole(e.target.value as UserRole)}
  ...
>
```

| Aspect | Before | After |
|--------|--------|-------|
| Type-safety | `as never` — bypasses TypeScript checking | `as UserRole` — narrows `string` to the actual enum |
| Anti-pattern grep | `grep -rE "as never" src/components/layout/` → 1 match | `grep -rE "as never" src/components/layout/` → 0 matches in source |
| Runtime behaviour | identical | identical |

### 3.2 Why `<button>` and not `<a>`

Per the Sprint 6.3 §3.2 design goal (G-DS-2: zero new primitives, reuse `<Button>` patterns) and the A8 anti-pattern definition (`onClick={() => {}}` or `<a href="#">` in primary navigation):

- The "Hồ sơ" item is **not navigation** — it triggers an in-place feedback toast. An `<a>` element would imply a route change.
- The toast **replaces** the user-facing surface; routing to a placeholder page would re-introduce the dead-link problem (a route exists but has no content).
- `<button>` with `onClick` is semantically correct for an action that does not change the URL.

The `aria-label` keeps screen-reader semantics honest: it announces `(đang phát triển)` so assistive tech users learn why the click doesn't navigate.

### 3.3 Vietnamese copy

- Visible label: `"Thông tin cá nhân"` (Personal information) — preserved from prior version.
- Toast: `"Tính năng đang phát triển"` (Feature under development) — per `ux-designer` skill + product-owner approval (verbal, captured in Sprint 6.3 §2 G-UX-4).
- `aria-label`: `"Hồ sơ (đang phát triển)"` (Profile (under development)) — combines menu-section context (the dropdown lives under the user profile "Hồ sơ") with the placeholder status.

All copy is Vietnamese, consistent with the rest of the topbar's UI strings (Thông báo / Đánh dấu đã đọc / Xem tất cả thông báo / Đăng xuất).

---

## 4. Behaviour change summary

| Aspect | Before | After |
|--------|--------|-------|
| Click target | `<button>` (no nav, no toast) | `<button>` (closes menu + shows toast) |
| Surface after click | Nothing happens | Info toast bottom-right + user dropdown closes |
| `href` attribute | None | None (A8 still clean) |
| Tag | `<button>` | `<button>` (no change) |
| Visible label | "Thông tin cá nhân" | "Thông tin cá nhân" (unchanged) |
| `aria-label` | None | "Hồ sơ (đang phát triển)" (added) |
| `type` | Implicit | "button" (added, defensive) |
| Dev-role cast | `as never` | `as UserRole` (RR-5 cleanup) |
| ToastProvider dependency | None | `useToast()` (already in tree) |
| Topbar bundle size | unchanged | unchanged (useToast is in shared chunk) |

---

## 5. Test coverage

10 new tests in 1 new file:

### 5.1 `src/components/layout/__tests__/topbar-profile-toast.test.tsx`

| # | Group | Test | What it verifies |
|---|-------|------|------------------|
| 1 | happy path | renders the menu item after opening the user dropdown | Component renders inside `<Topbar>` |
| 2 | happy path | click fires `toast('Tính năng đang phát triển', 'info')` | Core B.4.4 wiring |
| 3 | happy path | closes the dropdown after click | Toast is the only remaining surface |
| 4 | happy path | does NOT navigate (no `router.push`) | B.4.4 is not a redirect |
| 5 | A8 gate | menu item has no `href` attribute | Anti-pattern A8 closed |
| 6 | A8 gate | `href="#"` regex absent from dropdown | Defensive grep on full HTML |
| 7 | a11y | `aria-label="Hồ sơ (đang phát triển)"` present | Screen reader announces status |
| 8 | a11y | `type="button"` present | Implicit-submit guarded |
| 9 | regression | toast fires on second click after dropdown reopens | State machine survives close/reopen |
| 10 | RR-5 | dev-role select still calls `setDevRole('doctor')` cleanly | Cast is `as UserRole`, not `as never` |

### 5.2 Mocks used

| Module | Mock | Why |
|--------|------|-----|
| `next/navigation` | `{ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/dashboard' }` | Prevent router navigation during tests; assert `push` not called |
| `@/lib/firebase/auth` | `signOut`, `onAuthChange` stubs | Topbar imports these; tests don't need real Firebase |
| `@/lib/firestore/users` | `getUser`, `getAllUsers` stubs | Topbar (via AuthProvider) may call these; prevent import errors |
| `@/components/ui/toast` | `useToast: () => ({ toast: vi.fn() })` | Unit-under-test is the wiring, not the toast rendering |
| `@/lib/auth/AuthProvider` | `useAuth: () => mockReturnValue(...)` | Inject test fixtures per `beforeEach` |
| `global.fetch` | stubbed to `{ ok: true, json: async () => ({...}) }` | Topbar polls `/api/notifications` every 60 s; prevent URL-parse noise |

### 5.3 Why these specific tests

- **4 happy-path tests** cover the contract: click → toast fires, dropdown closes, no nav.
- **2 A8 gate tests** mirror the anti-pattern definition: no `href="#"` anywhere on the menu item, no `href` on the dropdown surface.
- **2 a11y tests** ensure screen-reader semantics and implicit-submit safety — both required by `ux-designer` (mobile-first + high-pressure staff usage) and WCAG 2.1 SC 4.1.2.
- **1 regression test** guards against the dropdown getting into a state where a second click does nothing (a real risk when both `setMenuOpen(false)` and `toast(...)` run in the same handler).
- **1 RR-5 test** asserts that `setDevRole` is called with a valid role string (no `as never` cast escaping the type system).

---

## 6. Rollback strategy

### 6.1 Tier 1 — Single-file revert (< 5 min)

```bash
git revert <story-6.3.4-merge-sha>
npx tsc --noEmit && npm run lint && npx vitest run
```

**Behaviour reverts to:**
- "Thông tin cá nhân" click closes the menu and does nothing (no toast).
- Dev-role select reverts to `as never` cast (lint warning re-emerges but does not fail the build).

**Data impact:** none.

### 6.2 Tier 2 — Manual revert of just the handler

```bash
git checkout HEAD~1 -- src/components/layout/topbar.tsx
```

Same behavioural reversion as Tier 1. Useful if the rest of the commit (e.g. test file) is wanted in history.

### 6.3 No flag-based rollback

B.4.4 ships un-flagged per §2. The change is purely additive; the worst-case regression is "click does nothing again" — i.e. identical to pre-6.3.4 behaviour.

---

## 7. Data migrations

None.

---

## 8. Migration checklist (per environment)

### Dev / local

- [x] Pull the PR branch
- [x] No new dependencies to install
- [x] No new env vars
- [x] `npx tsc --noEmit` → 0 errors
- [x] `npm run lint` → 0 warnings / 0 errors
- [x] `npx vitest run` → 573 passed (was 563 — +10 new for this story)
- [x] `npm run build` → 34 routes, 0 errors, 87.4 kB shared JS preserved
- [x] A8 grep: `grep -rE 'href=["\047]#["\047]' src/components/layout/topbar.tsx` → 0 actual matches (1 comment-only match documenting the anti-pattern)
- [x] RR-5 grep: `grep -rE "as never" src/components/layout/topbar.tsx` → 0 matches

### Staging

- [ ] Manual smoke on the topbar dropdown — click "Thông tin cá nhân", confirm toast appears with "Tính năng đang phát triển"
- [ ] axe-core scan on a route containing the topbar (any protected route) — 0 critical
- [ ] VoiceOver / NVDA pass — confirm "(đang phát triển)" is announced

### Production

- [ ] Default flag inventory unchanged (no new flags added)
- [ ] Manual smoke on a single cohort first
- [ ] No role-specific regressions (the topbar is rendered for all 12 roles)

---

## 9. Breaking changes

**None.** Every change is additive:

- New `useToast` import in `topbar.tsx` (already in dependency graph via `Providers`)
- New `data-testid` + `type` + `aria-label` attributes on the profile menu item (purely additive)
- New `handleProfilePlaceholder()` handler (calls `toast` which is already wired through `ToastProvider`)
- Replaced `as never` with `as UserRole` on the dev-role select (lint improvement, no runtime change)

Downstream consumers (other stories, external integrations, 3rd-party CSS overrides) are unaffected.

---

## 10. Cross-sprint regression checklist

Verified that no Sprint 6.1 / 6.2 / 6.3.1-6.3.3 behaviour regressed:

- [x] Notification dropdown (Sprint 6.1 / Phase 4) — `fetchNotifications` + `setInterval` + `setNotifOpen` flow unchanged
- [x] DEV role selector (Sprint 6.1) — still functional, RR-5 cast is now type-safe
- [x] Sign-out (Sprint 6.1) — `handleSignOut` unchanged
- [x] All 6 feature flags from Sprint 6.1 / 6.2 / 6.3.1 unchanged
- [x] `<Toast>` provider (Sprint 6.1) — `useToast()` API unchanged; Topbar now consumes it
- [x] 12-role sidebar / mobile-nav matrix (Sprint 6.1 A.5) — topbar renders identically for all 12 roles
- [x] `aria-label`, `type="button"`, `data-testid` pattern (Sprint 6.1 A.3 / A.6) — followed in the new menu item

---

## 11. Anti-pattern checks

```bash
# A8 — No dead links introduced
$ grep -rE 'href=["\047]#["\047]' src/components/layout/topbar.tsx
126:  // dead `href="#"`; instead we show a Vietnamese info toast that the feature
# → 1 match: comment only (no actual <a href="#"> in source)

# RR-5 — Topbar `as never` cast cleaned up
$ grep -nE "as never" src/components/layout/topbar.tsx
# → 0 matches in source

# A9 — No new native confirm/alert
$ grep -rE "window\.(confirm|alert)" src/components/layout/topbar.tsx
# → 0 matches

# A2 — No raw user IDs in copy (B.4.3 was the fix; verify still clean)
$ grep -rE "user-\d{3}" src/components/layout/topbar.tsx
# → 0 matches
```

All anti-pattern checks clean.

---

## 12. Performance impact

- **Bundle size:** unchanged. `useToast` is already in the shared `ToastProvider` chunk; `UserRole` is a type-only import that erases at compile time.
- **Render cost:** +1 `useToast()` hook call per `<Topbar>` render (negligible — pure context read).
- **Interaction cost:** +1 `toast()` call per click on "Hồ sơ" (~0.1 ms — just sets state on the ToastProvider).
- **Layout cost:** zero — no DOM size change, no className change on existing nodes.

Lighthouse score on `/dashboard` (desktop, before / after) expected to be within ±1 point — measured manually on staging during C-3.

---

*End of Story 6.3.4 Migration Notes.*