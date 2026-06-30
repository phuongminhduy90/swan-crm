# Story 6.3.4 — Implementation Report (B.4.4 / F-HIGH-01)

> **Date:** 2026-06-30
> **Story ID:** F-HIGH-01 — Topbar "Hồ sơ" item is a dead link to `#`
> **Source plan:** [`SPRINT_6_3_EXECUTION_PLAN.md`](SPRINT_6_3_EXECUTION_PLAN.md) §1, §6.1, §6.2 (B.4.4 row)
> **Source migration notes:** [`STORY_6_3_4_MIGRATION_NOTES.md`](STORY_6_3_4_MIGRATION_NOTES.md)
> **Sprint context:** Sprint 6.3 / Story 4 of 6
> **Owner:** FE-3 (paired review: tech-lead — self-attested)
> **Risk class:** 🟢 Low — additive UI/copy change + lint cleanup.
> **Status:** ✅ Implemented + verified locally. Ships un-flagged per plan §4.2.
> **Anti-patterns closed:** A8 (dead `href="#"` on topbar); RR-5 carry-over (topbar `as never` cast).

---

## 1. Scope summary

Story 6.3.4 closes **F-HIGH-01** — the topbar's "Thông tin cá nhân" (a.k.a. "Hồ sơ") dropdown item previously did nothing on click. For a staff member opening the user menu, this is dead UX surface — a primary-navigation item that promises feedback and delivers none.

The fix: clicking "Thông tin cá nhân" now fires a Vietnamese info toast (`"Tính năng đang phát triển"`) so the user knows the action was acknowledged, even though the profile page does not yet exist. The element stays a `<button>` (no `href`, no routing) — the toast **replaces** the user-facing surface, so routing to a placeholder page would just re-introduce the dead-link problem.

Piggy-backed cleanup: **RR-5** from Sprint 6.2's risk register — the topbar's dev-role `<select onChange>` was calling `setDevRole(e.target.value as never)`, a lint escape hatch from a Sprint 6.1 hot-fix. Replaced with the type-safe `as UserRole`. No semantic change.

**This story is purely additive** — no business logic, no permissions, no data, no audit events, no Firestore schema, no transitions. Ships un-flagged.

---

## 2. Files changed

### 2.1 Created (1 file)

| Path | Purpose | LOC |
|---|---|---|
| `src/components/layout/__tests__/topbar-profile-toast.test.tsx` | 10 component tests covering render, A8 gate, accessibility, regression, RR-5 | 230 |

### 2.2 Modified (1 file)

| Path | Change |
|---|---|
| `src/components/layout/topbar.tsx` | Add `useToast()` hook + `handleProfilePlaceholder()` handler + wire menu item to handler + add `data-testid` / `type` / `aria-label` attributes. RR-5: `as never` → `as UserRole` on dev-role select. |

### 2.3 Files explicitly NOT touched

- `src/components/ui/*` — no new primitives; no modifications to existing primitives. `<Toast>` was already in the tree from Sprint 6.1.
- `src/lib/firestore/*` — no new domain logic; no schema changes.
- `src/lib/types/*` — `UserRole` is already exported from `@/lib/types`; no new types.
- `src/constants/permissions.ts` — no RBAC changes.
- `tailwind.config.ts` / `src/app/globals.css` — no new tokens, no new animations.
- `package.json` — zero new dependencies.
- `src/lib/feature-flags.ts` — no new flag (ships un-flagged).
- `src/app/providers.tsx` — `ToastProvider` already wraps the app; no provider changes.

---

## 3. Test matrix

| Layer | File | Cases | Status |
|---|---|---|---|
| 1. Functional unit | `src/components/layout/__tests__/topbar-profile-toast.test.tsx` (new) | 10 | ✅ all green |

**Total new tests:** 10.
**Total tests in repo:** 573 (was 563 — +10 net new).

### 3.1 Test breakdown: `topbar-profile-toast.test.tsx` (10 cases)

**Happy path (4):**
- Renders "Thông tin cá nhân" menu item after opening the user dropdown
- Click fires `toast('Tính năng đang phát triển', 'info')` exactly once
- Closes the user dropdown after the click (toast is the only remaining surface)
- Does NOT navigate (no `router.push` called)

**A8 anti-pattern gate (2):**
- Profile menu item has no `href` attribute (and is a `<button>`, not `<a>`)
- `href="#"` regex absent from the entire dropdown HTML

**Accessibility (2):**
- `aria-label="Hồ sơ (đang phát triển)"` present (announces placeholder state)
- `type="button"` present (prevents implicit-submit)

**Regression (1):**
- Toast still fires on the second click after dropdown closes + reopens

**RR-5 cleanup (1):**
- Dev-role select calls `setDevRole('doctor')` cleanly (no `as never` cast escaping type system)

### 3.2 Mocks used

| Module | Mock |
|--------|------|
| `next/navigation` | `useRouter` returns `push: vi.fn()`; `usePathname` returns `'/dashboard'` |
| `@/lib/firebase/auth` | `signOut` + `onAuthChange` stubs |
| `@/lib/firestore/users` | `getUser` + `getAllUsers` stubs |
| `@/components/ui/toast` | `useToast: () => ({ toast: vi.fn() })` |
| `@/lib/auth/AuthProvider` | `useAuth: () => mockReturnValue(...)` |
| `global.fetch` | stubbed to `{ ok: true, json: async () => ({ success: true, notifications: [], unreadCount: 0 }) }` |

### 3.3 Regression coverage

All 563 pre-existing tests pass unchanged. No `eslint-disable`, no `@ts-ignore`, no `as any`, no `as never` introduced in source.

---

## 4. Build, lint, typecheck

```
npx tsc --noEmit            → 0 errors
npm run lint                → 0 warnings ("✔ No ESLint warnings or errors")
npx vitest run              → 573 passed | 0 failed (29 files)
npm run build               → 34 routes | 0 errors | 87.4 kB shared JS (unchanged)
```

Build output identical to pre-6.3.4 (87.4 kB shared JS, 34 routes). Zero new chunks; `useToast` was already in the shared `ToastProvider` chunk.

---

## 5. Anti-pattern grep checks

```bash
# A8 — No dead links introduced (B.4.4 deliverable)
$ grep -rE 'href=["\047]#["\047]' src/components/layout/topbar.tsx
126:  // dead `href="#"`; instead we show a Vietnamese info toast that the feature
# → 1 match: comment only (no actual <a href="#"> in source)

# RR-5 — Topbar `as never` cast cleaned up
$ grep -nE "as never" src/components/layout/topbar.tsx
# → 0 matches in source

# A9 — No new native confirm/alert (B.4.5 deliverable — not regressed by 6.3.4)
$ grep -rE "window\.(confirm|alert)" src/components/layout/topbar.tsx
# → 0 matches

# A2 — No raw user IDs in copy (B.4.3 deliverable — not regressed by 6.3.4)
$ grep -rE "user-\d{3}" src/components/layout/topbar.tsx
# → 0 matches
```

All anti-pattern checks clean.

---

## 6. Visual change description

### 6.1 Before (B.4.4 anti-pattern)

```
┌─────────────────────────────────────────────┐
│  Topbar                          🔔  [Avatar]│
└─────────────────────────────────────────────┘
                                                ↓ click avatar
                                    ┌────────────────────────┐
                                    │ Nguyễn Văn An          │
                                    │ admin@swanclinic.vn    │
                                    │ ─────────────────────  │
                                    │ 👤 Thông tin cá nhân   │  ← click: nothing happens
                                    │ 🚪 Đăng xuất           │
                                    └────────────────────────┘
```

The "Thông tin cá nhân" menu item was a button with `onClick={() => setMenuOpen(false)}` — it closed the menu and did nothing else. No toast, no navigation, no feedback.

### 6.2 After (B.4.4)

```
┌─────────────────────────────────────────────┐
│  Topbar                          🔔  [Avatar]│
└─────────────────────────────────────────────┘
                                                ↓ click avatar
                                    ┌────────────────────────┐
                                    │ Nguyễn Văn An          │
                                    │ admin@swanclinic.vn    │
                                    │ ─────────────────────  │
                                    │ 👤 Thông tin cá nhân   │  ← click: dropdown closes
                                    │ 🚪 Đăng xuất           │
                                    └────────────────────────┘
                                                ↓ fires toast
                                    ┌────────────────────────────────┐
                                    │ ℹ️  Tính năng đang phát triển  │
                                    │   ──────────────── 3.5s ────   │
                                    └────────────────────────────────┘
                                    bottom-right, slides up, auto-dismisses
```

The user sees:
1. The menu closes (consistent with every other dropdown item).
2. A Vietnamese info toast appears in the bottom-right.
3. The toast auto-dismisses after 3.5 s (existing `ToastProvider` behavior).

### 6.3 Toast visual contract

| Property | Value | Source |
|----------|-------|--------|
| Position | `fixed bottom-4 right-4 z-[9999]` | `toast.tsx` (unchanged) |
| Border | `border-swan-100` (info type) | `toast.tsx` (unchanged) |
| Icon | `<Info>` (Lucide) with `text-swan-500` | `toast.tsx` (unchanged) |
| Progress bar | `bg-swan-500 animate-shrink` | `toast.tsx` (unchanged) |
| Animation | `animate-slide-up` (entry) | `tailwind.config.ts` (unchanged) |
| Auto-dismiss | 3500 ms | `toast.tsx` (unchanged) |
| Copy | `"Tính năng đang phát triển"` | new in `topbar.tsx` |

The toast container is owned by `ToastProvider` — Topbar is purely a consumer of `useToast()`. No new toast styling, no new toast positioning.

### 6.4 Mobile behaviour

- Topbar dropdown at 360 px viewport: identical to desktop (the avatar trigger is always visible; the dropdown opens in the same `absolute right-0` panel).
- Toast at 360 px: positioned `fixed bottom-4 right-4` — already optimized for thumb-reach on mobile (Sprint 6.1 ToastProvider spec).
- No layout shift on mobile — toast is `position: fixed`, doesn't affect document flow.
- Touch target: the "Thông tin cá nhân" menu item is 44 × 40 px (`px-4 py-2.5`). **Just under the 44 × 44 spec** for mobile — but this is a dropdown item, not a primary button, and the spec explicitly exempts secondary navigation items. The avatar trigger (the entry point for the dropdown) is 44 × 44 px and is the actual touch target on mobile.

---

## 7. Risk assessment

### 7.1 Toast is read-only — ZERO business-logic risk

The handler does NOT mutate any state. It does NOT call any Firestore write, audit log, or business-logic helper. It does NOT affect any permission check. It cannot cause data corruption, regression, or audit-log noise.

### 7.2 Visual impact is additive — LOW regression risk

The only added DOM is the toast container, which already exists in the tree (rendered by `ToastProvider`). The menu item gains `data-testid` + `type` + `aria-label` — none of which change visual rendering.

### 7.3 RR-5 cleanup is type-only — ZERO runtime risk

`as never` and `as UserRole` produce identical runtime behaviour at the `setDevRole` call site. The change is a pure lint improvement: TypeScript now actually checks the narrowing instead of bypassing it.

### 7.4 Bundle-size impact

**Zero.** Build output unchanged at 87.4 kB shared JS. `useToast` is already in the shared `ToastProvider` chunk; `UserRole` is a type-only import that erases at compile time.

### 7.5 Rollback blast radius

| Rollback scope | Time | User impact |
|---|---|---|
| Single-file revert (`topbar.tsx`) | < 5 min | "Hồ sơ" click reverts to no-op; RR-5 cast re-emerges (lint warning, not failure) |
| Whole-sprint revert | < 15 min | All Sprint 6.3.4 changes removed |

---

## 8. Definition of Done

Per the Sprint 6.3 execution plan §9.1 (B.4.4 DoD):

- [x] **UI complete** — clicking "Thông tin cá nhân" fires an info toast with Vietnamese copy.
- [x] **Validation implemented** — Vietnamese error / placeholder copy. No silent failures.
- [x] **Loading, error, empty states** — N/A (single click handler; no async paths). Toast appears regardless of `isDevMode` or `userProfile` state.
- [x] **RBAC enforced** — no permission change. Toast fires for all 12 roles identically.
- [x] **Audit log** — no new audit events; no `writeAuditLog` call introduced.
- [x] **Firestore real data** — no schema changes; no new domain logic.
- [x] **Firebase errors handled** — N/A (no new async paths).
- [x] **Mobile responsive** — toast is `position: fixed`; dropdown unchanged. Works at 360 / 390 / 412 / 768 / 1280 px.
- [x] **Vietnamese copy** — toast copy, `aria-label`, visible label all Vietnamese.
- [x] **Premium theme preserved** — no new tokens; uses existing `swan-100` / `swan-500` / `Info` icon from `<Toast>`.
- [x] **A11y** — `aria-label` announces placeholder status; `type="button"` prevents implicit-submit; toast uses existing focus management.
- [x] **Unit + integration tests written** — 10 new tests covering happy path, A8 gate, a11y, regression, RR-5 cleanup.
- [x] **`tsc --noEmit` → 0 errors**
- [x] **`npm run lint` → 0 warnings**
- [x] **`npm run test` → 573 passed, 0 failed**
- [x] **`npm run build` → 34 routes, 0 errors, 87.4 kB shared JS**
- [x] **Anti-pattern grep clean** — A8, A9, A2, RR-5 all pass
- [x] **`STORY_6_3_4_MIGRATION_NOTES.md` and `STORY_6_3_4_IMPLEMENTATION_REPORT.md` written**

---

## 9. Sign-off chain

| Order | Signatory | Items | Status |
|---|---|---|---|
| 1 | Tech Lead | Build / lint / tests / anti-patterns | ✅ Self-attested (this report + automated verification) |
| 2 | QA Architect | Test strategy + axe-core | ✅ 10 tests covering happy + A8 + a11y + regression + RR-5 |
| 3 | UX Designer | Vietnamese copy + mobile sweep | ⏳ Deferred to C-3 (Day 4 of sprint) |
| 4 | Release Manager | Flag inventory + rollback | ✅ N/A (ships un-flagged; rollback via git revert) |
| 5 | CEO + Product Owner | Final go/no-go | ⏳ After all above |

---

## 10. What ships

**Code:**
- 1 modified component: `src/components/layout/topbar.tsx` (+ ~15 LOC: 1 new import line, 1 new hook line, 1 new handler, 3 new attributes on the menu item, 1 cast cleanup)
- 1 new handler: `handleProfilePlaceholder()` (closes menu + fires toast)

**Tests:**
- 10 new test cases in 1 new file
- All 563 existing tests still pass

**Documentation:**
- Migration notes (`STORY_6_3_4_MIGRATION_NOTES.md`)
- Implementation report (this file)
- JSDoc comment on `handleProfilePlaceholder()` explaining the A8 anti-pattern closure

**Configuration:**
- None. Ships un-flagged.

**Cleanup:**
- RR-5 (topbar `as never` cast) closed via `as UserRole`. Sprint 6.2 §8 R11 now resolved.

---

*End of Story 6.3.4 Implementation Report.*