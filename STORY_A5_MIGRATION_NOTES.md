# Story A.5 — Migration Notes (Shared sidebar menu config + `useVisibleMenu`)

> **Story:** A.5 — Shared sidebar menu config + `useVisibleMenu`
> **Backlog ref:** F-HIGH-02
> **Date:** 2026-06-29
> **Branch:** phase-6/sprint-6.1
> **Risk:** 🔴 gated behind `NEXT_PUBLIC_FEATURE_SHARED_MENU` (default OFF in production)

## What changed and why

Swan CRM's Sidebar (`src/components/layout/sidebar.tsx`) and MobileNav
(`src/components/layout/mobile-nav.tsx`) both declared identical inline arrays —
`MENU_ITEMS`, `SETTINGS_SUB_ITEMS`, `BOTTOM_ITEMS` — and filtered them
independently with `hasPermission()`. The duplication guarantees drift: any new
menu entry has to be remembered in two places, and any tweak to a label or
permission has to be repeated. The MobileNav version was especially fragile —
it typed `permission: string` and worked around the resulting type error with
**three** `as never` casts that bypassed the `Permission` union entirely.

Story A.5 removes the duplication by lifting the configuration into
`src/config/sidebar-menu.ts`, exposing the filtering logic behind a new
`useVisibleMenu()` hook, and routing both surfaces through it. The hook reads
the `FEATURE_SHARED_MENU` flag (already declared in
[`SPRINT_6_1_EXECUTION_PLAN.md`](docs/ux-redesign/SPRINT_6_1_EXECUTION_PLAN.md)
Appendix A) and falls back to the un-filtered legacy payload when the flag is
OFF, which keeps production behaviour bit-for-bit identical today.

## File map

| Status   | Path                                              | Lines |
|----------|---------------------------------------------------|------:|
| CREATE   | `src/config/sidebar-menu.ts`                      | +48   |
| CREATE   | `src/lib/hooks/useVisibleMenu.ts`                 | +69   |
| CREATE   | `src/lib/hooks/__tests__/useVisibleMenu.test.tsx` | +167  |
| MODIFY   | `src/components/layout/sidebar.tsx`               | -65 / +33 LOC net |
| MODIFY   | `src/components/layout/mobile-nav.tsx`            | -60 / +30 LOC net |
| MODIFY   | `.env.local`                                      | +4    |

Net change: roughly 95 LOC added / 125 removed across the layout files
(themselves trimmer than before).

## Behaviour

| Role               | Old behaviour (flag OFF) | New behaviour (flag OFF) | New behaviour (flag ON, dev) |
|--------------------|--------------------------|---------------------------|------------------------------|
| `admin`            | All 15 items             | All 15 items              | All 15 items (admin has every permission) |
| `ceo`              | All 15 items             | All 15 items              | 5 main + 0 settings + 2 bottom |
| `cso`              | All 15 items             | All 15 items              | 8 main + 4 settings + 2 bottom |
| `media`            | All 15 items             | All 15 items              | 4 main + 0 settings + 2 bottom |
| `cskh_postop`      | All 15 items             | All 15 items              | 6 main + 0 settings + 2 bottom |
| `nurse`            | All 15 items             | All 15 items              | 6 main + 0 settings + 2 bottom |

The flag-OFF column is what ships today and exactly matches pre-A.5 behaviour.

## Public-API surface

```ts
// src/config/sidebar-menu.ts
export interface MenuItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;        // ← no more `permission: string`
}
export const MENU_ITEMS: MenuItem[];
export const SETTINGS_SUB_ITEMS: MenuItem[];
export const BOTTOM_ITEMS: MenuItem[];

// src/lib/hooks/useVisibleMenu.ts
export interface VisibleMenuResult {
  mainItems: MenuItem[];
  settingsItems: MenuItem[];
  bottomItems: MenuItem[];
  canSeeSettings: boolean;
  flagEnabled: boolean;
}
export function useVisibleMenu(): VisibleMenuResult;
```

## Compatibility notes

- **No data migration.** Story A.5 only touches navigation rendering.
- **No route permission changes.** The hook reads `ROLE_PERMISSIONS` from
  `@/config/roles` and passes the existing `Permission` value to
  `hasPermission()`. Route guards continue to live in their own constants.
- **Sidebar and MobileNav behave identically** — they now consume the same
  payload from one hook, so per-role active states, badge counts, and icon
  sizing stay aligned.

## Anti-pattern scan (DESIGN_DIRECTION §18)

| A-#    | Anti-pattern             | Status post-migration                                         |
|--------|--------------------------|---------------------------------------------------------------|
| A2     | Raw user IDs in copy     | n/a — A.5 introduces no copy                                   |
| A6     | Hidden-only permissions  | n/a — A.5 does not change auth                                 |
| **A8** | **Dead links**           | **All 15 hrefs preserved unchanged** ✅                         |
| A13    | Permissive transitions   | n/a — A.5 does not touch transitions                            |
| —      | `as never` in layout     | **Zero matches in `sidebar.tsx` + `mobile-nav.tsx`** ✅ (the single `as never` in `topbar.tsx` predates A.5 and is out of scope) |

## Rollback

1. Set `NEXT_PUBLIC_FEATURE_SHARED_MENU=false` in `.env.local` and redeploy —
   the hook returns the un-filtered payload, restoring pre-A.5 behaviour.
2. If you also want to revert the code:
   ```bash
   git checkout main -- src/components/layout/sidebar.tsx \
                          src/components/layout/mobile-nav.tsx
   rm src/config/sidebar-menu.ts \
      src/lib/hooks/useVisibleMenu.ts \
      src/lib/hooks/__tests__/useVisibleMenu.test.tsx
   ```
3. Story-level exit criteria still pass after rollback because the legacy
   arrays were previously declared and behaviour is unchanged when the flag is
   OFF.

## References

- Plan: [`SPRINT_6_1_EXECUTION_PLAN.md`](docs/ux-redesign/SPRINT_6_1_EXECUTION_PLAN.md) §1 row A.5, §3.1 (Day 3, behind flag), §4 (Files affected), §6.2 (test files), §7.2 (rollback), Appendix A (locked decisions).
- Companion docs: `STORY_A5_IMPLEMENTATION_REPORT.md`.
- Backlog: `IMPLEMENTATION_BACKLOG.md` View 2, row A.5.
