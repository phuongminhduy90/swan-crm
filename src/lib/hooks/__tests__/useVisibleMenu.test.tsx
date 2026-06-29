import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { User, UserRole } from '@/lib/types';
import {
  MENU_ITEMS,
  SETTINGS_SUB_ITEMS,
  BOTTOM_ITEMS,
} from '@/config/sidebar-menu';
import { ROLE_PERMISSIONS } from '@/config/roles';

// Mock the current-user hook so we can drive role-based behaviour without an AuthProvider.
const mockUseCurrentUser = vi.fn();

vi.mock('@/lib/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

// Re-import AFTER the mock is registered so the hook picks up the spy.
import { useVisibleMenu } from '@/lib/hooks/useVisibleMenu';

function makeUser(role: UserRole): User {
  return {
    id: `dev-${role}`,
    email: `${role}@swanclinic.vn`,
    displayName: `Dev ${role}`,
    role,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('useVisibleMenu (Story A.5)', () => {
  describe('flag OFF (production default)', () => {
    beforeEach(() => {
      // Default behaviour from .env.local — flag is OFF.
      mockUseCurrentUser.mockReturnValue({ user: makeUser('admin') });
    });

    it('returns every main, settings and bottom item unchanged when the flag is OFF', () => {
      const { result } = renderHook(() => useVisibleMenu());
      expect(result.current.mainItems).toBe(MENU_ITEMS);
      expect(result.current.settingsItems).toBe(SETTINGS_SUB_ITEMS);
      expect(result.current.bottomItems).toBe(BOTTOM_ITEMS);
      expect(result.current.flagEnabled).toBe(false);
    });

    it('still returns every item when the flag is OFF even for low-permission roles', () => {
      mockUseCurrentUser.mockReturnValue({ user: makeUser('media') });
      const { result } = renderHook(() => useVisibleMenu());
      expect(result.current.mainItems).toBe(MENU_ITEMS);
      expect(result.current.settingsItems).toBe(SETTINGS_SUB_ITEMS);
      expect(result.current.bottomItems).toBe(BOTTOM_ITEMS);
      expect(result.current.flagEnabled).toBe(false);
    });
  });

  describe('flag ON (dev / staging)', () => {
    let originalFlag: string | undefined;

    beforeEach(() => {
      originalFlag = process.env.NEXT_PUBLIC_FEATURE_SHARED_MENU;
      process.env.NEXT_PUBLIC_FEATURE_SHARED_MENU = 'true';
    });

    function afterEachFlag() {
      if (originalFlag === undefined) {
        delete process.env.NEXT_PUBLIC_FEATURE_SHARED_MENU;
      } else {
        process.env.NEXT_PUBLIC_FEATURE_SHARED_MENU = originalFlag;
      }
    }

    it('admin sees every entry and canSeeSettings=true', () => {
      mockUseCurrentUser.mockReturnValue({ user: makeUser('admin') });
      const { result } = renderHook(() => useVisibleMenu());

      expect(result.current.mainItems.length).toBe(MENU_ITEMS.length);
      expect(result.current.settingsItems.length).toBe(SETTINGS_SUB_ITEMS.length);
      expect(result.current.bottomItems.length).toBe(BOTTOM_ITEMS.length);
      expect(result.current.canSeeSettings).toBe(true);
      expect(result.current.flagEnabled).toBe(true);

      afterEachFlag();
    });

    it('media sees only the subset their role can access', () => {
      mockUseCurrentUser.mockReturnValue({ user: makeUser('media') });
      const { result } = renderHook(() => useVisibleMenu());

      const media = ROLE_PERMISSIONS.media;

      // Every returned entry must satisfy the role's permissions.
      for (const item of result.current.mainItems) {
        expect(media).toContain(item.permission);
      }
      for (const item of result.current.settingsItems) {
        expect(media).toContain(item.permission);
      }
      for (const item of result.current.bottomItems) {
        expect(media).toContain(item.permission);
      }

      // Media should not see Customers / Cases / Payments / etc.
      const labels = result.current.mainItems.map((m) => m.label);
      expect(labels).not.toContain('Khách hàng');
      expect(labels).not.toContain('Hồ sơ CASE');
      expect(labels).not.toContain('Thanh toán');
      expect(labels).not.toContain('Công việc');

      // Media has no settings:read / users:read permission → section hidden.
      expect(result.current.settingsItems).toEqual([]);
      expect(result.current.canSeeSettings).toBe(false);

      afterEachFlag();
    });

    it('cskh_postop sees followups + dashboard but not payments or reports', () => {
      mockUseCurrentUser.mockReturnValue({ user: makeUser('cskh_postop') });
      const { result } = renderHook(() => useVisibleMenu());

      const labels = result.current.mainItems.map((m) => m.label);
      expect(labels).toContain('Theo dõi sau');
      expect(labels).toContain('Bảng điều khiển');
      expect(labels).toContain('Khách hàng');

      // cskh_postop lacks payments:read and reports:read.
      expect(labels).not.toContain('Thanh toán');
      expect(labels).not.toContain('Báo cáo');
      // cskh_postop also lacks media:read → Thư viện Media hidden.
      expect(labels).not.toContain('Thư viện Media');

      // No settings section since cskh_postop lacks settings:read / users:read.
      expect(result.current.canSeeSettings).toBe(false);
      expect(result.current.settingsItems).toEqual([]);

      afterEachFlag();
    });

    it('does not call hasPermission with `as never` — menu items expose Permission type', () => {
      mockUseCurrentUser.mockReturnValue({ user: makeUser('admin') });
      const { result } = renderHook(() => useVisibleMenu());

      // Spot-check: every returned main item uses a Permission, not a string.
      for (const item of result.current.mainItems) {
        // Permission values follow `<resource>:<action>`; raw strings won't match the pattern.
        expect(item.permission).toMatch(/^[a-z_]+:[a-z_]+$/);
      }

      afterEachFlag();
    });
  });

  describe('no authenticated user', () => {
    it('falls back to the unfiltered legacy payload', () => {
      mockUseCurrentUser.mockReturnValue({ user: null });
      const { result } = renderHook(() => useVisibleMenu());

      expect(result.current.mainItems).toBe(MENU_ITEMS);
      expect(result.current.settingsItems).toBe(SETTINGS_SUB_ITEMS);
      expect(result.current.bottomItems).toBe(BOTTOM_ITEMS);
    });
  });
});
