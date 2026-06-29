import { useMemo } from 'react';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { hasPermission } from '@/lib/auth/rb';
import {
  MENU_ITEMS,
  SETTINGS_SUB_ITEMS,
  BOTTOM_ITEMS,
  type MenuItem,
} from '@/config/sidebar-menu';

/**
 * Feature flag gating for Story A.5 — `FEATURE_SHARED_MENU`.
 *
 * When the flag is OFF (default in production), the hook returns every entry
 * unchanged so existing nav behavior is preserved bit-for-bit. When ON (default
 * in dev), the menu is filtered against `ROLE_PERMISSIONS` via `hasPermission`.
 *
 * The flag is read via `process.env.NEXT_PUBLIC_FEATURE_SHARED_MENU` to avoid
 * pulling in the broader feature-flag helper (INF-2) before it lands. The
 * boolean coercion matches the locked decision from Sprint 6.1 Appendix A:
 * any value other than the literal string `"true"` is treated as OFF.
 */
function isSharedMenuEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_SHARED_MENU === 'true';
}

export interface VisibleMenuResult {
  /** Primary navigation entries (Bảng điều khiển → Báo cáo). */
  mainItems: MenuItem[];
  /** Settings sub-items (Người dùng → Dịch vụ). */
  settingsItems: MenuItem[];
  /** Bottom-of-drawer entries (Thông báo, Nhật ký). */
  bottomItems: MenuItem[];
  /** Whether the current role should see the "Cài đặt" section header. */
  canSeeSettings: boolean;
  /** `true` when the flag is ON and role filtering is active. */
  flagEnabled: boolean;
}

/**
 * Returns the role-filtered menu items for the current user.
 *
 * - When `FEATURE_SHARED_MENU` is OFF (production default), every entry is
 *   returned unchanged — identical to the legacy inline arrays.
 * - When ON, items are filtered with `hasPermission(role, item.permission)`
 *   so each role only sees what it can actually access.
 *
 * Components should consume this hook instead of re-declaring their own
 * `MENU_ITEMS` / `SETTINGS_SUB_ITEMS` / `BOTTOM_ITEMS` arrays.
 */
export function useVisibleMenu(): VisibleMenuResult {
  const { user } = useCurrentUser();
  const role = user?.role;

  return useMemo<VisibleMenuResult>(() => {
    const flagEnabled = isSharedMenuEnabled();

    if (!role || !flagEnabled) {
      // Flag OFF or no user — preserve legacy "show everything" behavior.
      return {
        mainItems: MENU_ITEMS,
        settingsItems: SETTINGS_SUB_ITEMS,
        bottomItems: BOTTOM_ITEMS,
        canSeeSettings: true,
        flagEnabled,
      };
    }

    const mainItems = MENU_ITEMS.filter((m) => hasPermission(role, m.permission));
    const settingsItems = SETTINGS_SUB_ITEMS.filter((m) =>
      hasPermission(role, m.permission),
    );
    const bottomItems = BOTTOM_ITEMS.filter((m) => hasPermission(role, m.permission));

    const canSeeSettings =
      hasPermission(role, 'settings:read') || hasPermission(role, 'users:read');

    return {
      mainItems,
      settingsItems,
      bottomItems,
      canSeeSettings,
      flagEnabled,
    };
  }, [role]);
}
