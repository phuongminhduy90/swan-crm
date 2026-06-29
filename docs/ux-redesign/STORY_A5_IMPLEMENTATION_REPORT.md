# Story A.5 — Implementation Report

> **Story:** A.5 — Shared sidebar menu config + `useVisibleMenu`
> **Status:** ✅ Complete — production-equivalent (flag OFF) ready, dev/staging mode (flag ON) tested
> **Date:** 2026-06-29
> **Owner:** FE-1 (via Claude tech-lead / ui-developer / tester skill delegation)

## 1. Files changed

### Created (3)

| Path                                                   | Purpose                                              | LOC |
|--------------------------------------------------------|------------------------------------------------------|----:|
| `src/config/sidebar-menu.ts`                           | Single source of truth for nav items + `MenuItem` type | 48  |
| `src/lib/hooks/useVisibleMenu.ts`                      | Role-filtered menu hook + inline flag gate           | 69  |
| `src/lib/hooks/__tests__/useVisibleMenu.test.tsx`      | 7 unit tests (3 flag OFF, 4 flag ON, 1 no-user)      | 167 |

### Modified (3)

| Path                                          | Change                                                                                              |
|-----------------------------------------------|-----------------------------------------------------------------------------------------------------|
| `src/components/layout/sidebar.tsx`           | Replaced inline arrays + `hasPermission` filter with `useVisibleMenu()`; dropped 5 unused lucide imports; kept `SidebarLink` and all active-state styling unchanged. |
| `src/components/layout/mobile-nav.tsx`        | Same migration; **all three `as never` casts removed** because `permission: Permission` (typed) flows through the hook instead of `permission: string`. |
| `.env.local`                                  | Added `NEXT_PUBLIC_FEATURE_SHARED_MENU=false` plus a comment block. Defaults OFF per locked decision Q3. |

### Not touched (intentional)

- `src/components/layout/topbar.tsx` — out of Story A.5 scope; the `as never` cast on the dev-role select is unrelated.
- `src/components/layout/AppShell.tsx`, `MobileNav` props, route guards, `ROLE_PERMISSIONS`, `Permission` union — none modified.

## 2. Tests executed

| Layer                                | Command                                       | Result |
|--------------------------------------|-----------------------------------------------|--------|
| TypeScript                           | `npx tsc --noEmit`                            | ✅ 0 errors |
| ESLint                               | `npm run lint`                                | ✅ 0 warnings |
| Unit (new)                           | `npx vitest run src/lib/hooks/__tests__/useVisibleMenu.test.tsx` | ✅ 7 / 7 green |
| Unit (full sweep)                    | `npx vitest run`                              | ✅ 90 / 90 green across 5 files |
| Production build                     | `npm run build`                               | ✅ 34 routes, 0 errors |

### Test cases added

1. Flag OFF → main/settings/bottom arrays equal the canonical exports by reference (`toBe`, not deep equal).
2. Flag OFF + low-permission role (`media`) → still returns the full legacy payload.
3. Flag ON + `admin` → 9 main + 4 settings + 2 bottom, `canSeeSettings=true`, `flagEnabled=true`.
4. Flag ON + `media` → only items present in `ROLE_PERMISSIONS.media`; "Khách hàng", "Hồ sơ CASE", "Thanh toán", "Công việc" hidden; settings section hidden.
5. Flag ON + `cskh_postop` → "Theo dõi sau" + "Khách hàng" visible; "Thanh toán", "Báo cáo", "Thư viện Media" hidden; settings section hidden.
6. Flag ON + any role → every returned `mainItem.permission` matches the `<resource>:<action>` Permission pattern (proves `permission: Permission` typing, not `string`, after the `as never` removal).
7. No authenticated user → hook returns the un-filtered legacy payload.

## 3. Risks introduced

| Risk                                                                                              | Likelihood | Impact | Mitigation                                                                                                                |
|---------------------------------------------------------------------------------------------------|-----------:|-------:|---------------------------------------------------------------------------------------------------------------------------|
| **R-1** Visual drift between Sidebar and MobileNav for a given role.                              | Low        | Med    | Both surfaces now consume identical payload from one hook. Manual smoke per role is in the sprint plan §6.3 (A.5 = item 5). |
| **R-2** New menu entries added to the config without a matching permission registered.            | Low        | Low    | Config carries `MenuItem.permission: Permission` — TS rejects unknown keys at compile time.                               |
| **R-3** Flag accidentally flipped ON in production.                                                | Low        | Med    | Default `false` in `.env.local`; comment explains roll-back; promotion requires CEO + product-owner sign-off per plan §7.3. |
| **R-4** `process.env.NEXT_PUBLIC_*` access during SSR vs CSR mismatch.                            | Low        | Low    | The hook runs only on the client (`'use client'` at the top of sidebar.tsx/mobile-nav.tsx); same path used by INF-2 design. |
| **R-5** Hook outlives `useCurrentUser` mock contract changes.                                     | Low        | Low    | Mock uses the same `useCurrentUser` signature as the real provider; tests will fail if signature drifts.                   |
| **R-6** Performance regression from `useMemo` vs inline filter.                                   | Low        | Low    | `useMemo([role])` keyed on the only reactive input. Filter is O(n ≤ 15).                                                  |

No new high-risk regressions identified.

## 4. Rollback steps

### Quick rollback (recommended)

1. Open `.env.local`.
2. Set `NEXT_PUBLIC_FEATURE_SHARED_MENU=false`.
3. Redeploy.

When the flag is OFF, `useVisibleMenu()` returns the canonical arrays unchanged — visually and behaviourally identical to the pre-A.5 state.

### Code-level rollback (full revert)

```bash
git revert <A.5-commit-sha>
# or
git checkout <last-good-sha> -- src/components/layout/sidebar.tsx \
                               src/components/layout/mobile-nav.tsx \
                               .env.local
rm -f src/config/sidebar-menu.ts \
      src/lib/hooks/useVisibleMenu.ts \
      src/lib/hooks/__tests__/useVisibleMenu.test.tsx
```

### Data-level rollback

None required. Story A.5 makes no schema, no permission, and no API-route changes. The flag is read at render time only.

### Verification after rollback

| Check                                                | Command                                       | Pass criterion |
|------------------------------------------------------|-----------------------------------------------|----------------|
| Anti-pattern grep                                    | `grep -rE "as never" src/components/layout/`   | Still excludes sidebar + mobile-nav (topbar match unrelated). |
| Inline arrays grep                                   | `grep -rE "const MENU_ITEMS" src/components/layout/` | 0 matches (after revert). |
| Typecheck                                            | `npx tsc --noEmit`                            | 0 errors |
| Lint                                                 | `npm run lint`                                | 0 warnings |
| Build                                                | `npm run build`                               | 34 routes, 0 errors |

## 5. Acceptance criteria (per plan §8.2 row A.5)

| Criterion                                                                                          | Status |
|----------------------------------------------------------------------------------------------------|--------|
| `src/config/sidebar-menu.ts` + `src/lib/hooks/useVisibleMenu.ts` exist                             | ✅      |
| `sidebar.tsx` and `mobile-nav.tsx` contain zero inline arrays                                       | ✅ (`grep` returns 0) |
| Zero `as never` casts in either file                                                               | ✅ (0 hits in either file) |
| Role-filtered: admin = all; media = subset                                                         | ✅ (test cases 3 + 4) |
| `useVisibleMenu` is unit-tested                                                                    | ✅ (7 cases) |
| `FEATURE_SHARED_MENU` flag exists in `.env.local`, defaults to `false`                              | ✅      |
| Build / lint / typecheck / full test sweep all pass                                                 | ✅      |
| Behavior preserved when flag is OFF (production default)                                            | ✅ (test cases 1, 2) |

## 6. Hand-off notes

- The `FEATURE_SHARED_MENU` flag is read via `process.env.NEXT_PUBLIC_FEATURE_SHARED_MENU` rather than going through the broader `isFlagEnabled` helper, because the INF-2 feature-flag helper has not landed yet. When INF-2 ships, swap the inline `process.env` access for `isFlagEnabled('SHARED_MENU')` — only one line in `src/lib/hooks/useVisibleMenu.ts` needs to change.
- Plan §4.1 lists `src/test/test-utils.tsx` under INF-1; it exists in the repo. Story A.5 did not require any provider wrapping, so the existing hook-only test pattern (mock `useCurrentUser`, use `renderHook`) was sufficient.
- The `Role` `canSeeSettings` rule mirrors the original: `settings:read` OR `users:read`. If UX later wants stricter visibility (`users:read` only), tweak the boolean in the hook.
