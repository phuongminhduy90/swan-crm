/**
 * Story 6.3.4 / B.4.4 (F-HIGH-01) — Topbar profile placeholder toast tests.
 *
 * Verifies that clicking the "Thông tin cá nhân" (Hồ sơ) menu item in the
 * Topbar user dropdown:
 *   1. Fires the `useToast().toast(...)` callback with the Vietnamese copy
 *      "Tính năng đang phát triển" and the `info` type.
 *   2. Closes the user menu after the click (so the toast is the only
 *      surface the user sees after clicking).
 *   3. Does NOT navigate (no `href`, no `router.push`).
 *   4. Has no `href` attribute on the underlying element (A8 anti-pattern
 *      gate — no dead `href="#"` link).
 *   5. Renders an accessible `aria-label` so screen readers announce
 *      "(đang phát triển)" status.
 *
 * Notes:
 *   - We mock `useAuth()` and `useToast()` directly because the Topbar uses
 *     both contexts. We do NOT use the real `ToastProvider` so the test
 *     stays focused on the wiring.
 *   - `useRouter` is mocked from `next/navigation` so a router.push (if it
 *     were ever added) would surface as a test failure.
 *   - `signOut` and `onAuthChange` are stubbed to keep the test free of
 *     Firebase imports.
 *
 * @see docs/ux-redesign/SPRINT_6_3_EXECUTION_PLAN.md §1 (B.4.4 row)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { User, UserRole } from '@/lib/types';

// ---------- next/navigation mock ----------

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
}));

// ---------- Global fetch stub ----------
// Topbar polls /api/notifications every 60s in production. We stub global
// fetch so the test environment doesn't surface URL-parse errors from the
// polling effect (it doesn't affect the unit-under-test, which is the
// profile-menu toast wiring).

const fetchMock = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ success: true, notifications: [], unreadCount: 0 }),
});
vi.stubGlobal('fetch', fetchMock);

// ---------- Firebase auth mock ----------

vi.mock('@/lib/firebase/auth', () => ({
  signOut: vi.fn().mockResolvedValue(undefined),
  onAuthChange: vi.fn(() => () => {}),
}));

// ---------- Firestore user mock ----------

vi.mock('@/lib/firestore/users', () => ({
  getUser: vi.fn().mockResolvedValue(null),
  getAllUsers: vi.fn().mockResolvedValue([]),
}));

// ---------- Toast mock ----------

const toastMock = vi.fn();
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

// ---------- Auth mock ----------

const setDevRoleMock = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}));

// ---------- Import AFTER mocks so they take effect ----------

import { Topbar } from '@/components/layout/topbar';

// ---------- Fixtures ----------

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: overrides.id ?? 'user-001',
    email: overrides.email ?? 'admin@swanclinic.vn',
    displayName: overrides.displayName ?? 'Nguyễn Văn An',
    role: (overrides.role ?? 'admin') as UserRole,
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
    phone: overrides.phone,
  };
}

// ---------- Setup ----------

beforeEach(() => {
  pushMock.mockReset();
  toastMock.mockReset();
  setDevRoleMock.mockReset();
  fetchMock.mockClear();
  mockUseAuth.mockReturnValue({
    userProfile: makeUser(),
    isDevMode: false,
    setDevRole: setDevRoleMock,
    devRole: 'admin',
  });
});

afterEach(() => {
  // `cleanup()` from RTL unmounts the rendered tree, which lets the
  // Topbar's setInterval cleanup fire. Without this, the 60-second
  // polling effect could trigger an un-awaited state update after the
  // test ends, producing a benign but noisy `act()` warning.
  cleanup();
});

// ---------- Helpers ----------

/** Open the user dropdown so the "Thông tin cá nhân" item is rendered. */
function openUserMenu() {
  // The first button in the user-menu wrapper is the avatar/name trigger.
  const trigger = screen.getByRole('button', { name: /nguyễn văn an/i });
  fireEvent.click(trigger);
}

/** Render the Topbar wrapped in `act()` so React doesn't warn about
 *  un-awaited state updates from the polling effect. */
function renderTopbar(props: { onMenuToggle?: () => void } = {}) {
  let result!: ReturnType<typeof render>;
  act(() => {
    result = render(<Topbar onMenuToggle={props.onMenuToggle ?? (() => {})} />);
  });
  return result;
}

// ---------- Tests ----------

describe('Topbar — profile placeholder toast (Story 6.3.4 / B.4.4)', () => {
  describe('happy path', () => {
    it('renders the "Thông tin cá nhân" menu item after opening the user dropdown', () => {
      renderTopbar();
      openUserMenu();
      expect(
        screen.getByTestId('topbar-profile-menu-item'),
      ).toBeInTheDocument();
      expect(screen.getByText('Thông tin cá nhân')).toBeInTheDocument();
    });

    it('clicking the menu item fires useToast().toast with "Tính năng đang phát triển" and type="info"', () => {
      renderTopbar();
      openUserMenu();
      const menuItem = screen.getByTestId('topbar-profile-menu-item');
      fireEvent.click(menuItem);

      expect(toastMock).toHaveBeenCalledTimes(1);
      expect(toastMock).toHaveBeenCalledWith('Tính năng đang phát triển', 'info');
    });

    it('closes the user dropdown after the click (toast is the only remaining surface)', () => {
      renderTopbar();
      openUserMenu();
      expect(screen.getByTestId('topbar-profile-menu-item')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('topbar-profile-menu-item'));

      // After clicking, the dropdown menu's panel is removed from the DOM.
      expect(screen.queryByTestId('topbar-profile-menu-item')).not.toBeInTheDocument();
    });

    it('does NOT navigate (no router.push called)', () => {
      renderTopbar();
      openUserMenu();
      fireEvent.click(screen.getByTestId('topbar-profile-menu-item'));
      expect(pushMock).not.toHaveBeenCalled();
    });
  });

  describe('A8 anti-pattern — no dead links', () => {
    it('the profile menu item has no href attribute (no <a> element)', () => {
      renderTopbar();
      openUserMenu();
      const menuItem = screen.getByTestId('topbar-profile-menu-item');
      // It must be a <button>, not an <a>.
      expect(menuItem.tagName.toLowerCase()).toBe('button');
      // No href on the element itself.
      expect(menuItem.getAttribute('href')).toBeNull();
      // And no href anywhere in the user-menu dropdown (defensive).
      const dropdown = menuItem.closest('[role="menu"], .absolute') ?? menuItem.parentElement?.parentElement;
      expect(dropdown?.innerHTML).not.toMatch(/href\s*=\s*["']#["']/);
    });

    it('grep-friendly assertion: no href="#" anywhere in the user dropdown', () => {
      renderTopbar();
      openUserMenu();
      // Re-open menu if click collapsed it; safe because toast path also collapses it.
      const dropdown = screen.getByTestId('topbar-profile-menu-item').parentElement;
      expect(dropdown?.outerHTML).not.toMatch(/href=["']#["']/);
    });
  });

  describe('accessibility', () => {
    it('renders aria-label="Hồ sơ (đang phát triển)" on the menu item', () => {
      renderTopbar();
      openUserMenu();
      const menuItem = screen.getByTestId('topbar-profile-menu-item');
      expect(menuItem).toHaveAttribute('aria-label', 'Hồ sơ (đang phát triển)');
    });

    it('renders type="button" so the element is not implicit-submit', () => {
      renderTopbar();
      openUserMenu();
      const menuItem = screen.getByTestId('topbar-profile-menu-item');
      expect(menuItem).toHaveAttribute('type', 'button');
    });
  });

  describe('regression — behavior is preserved across reopens', () => {
    it('toast still fires on the second click after the dropdown closes + reopens', async () => {
      renderTopbar();

      // First click
      openUserMenu();
      fireEvent.click(screen.getByTestId('topbar-profile-menu-item'));
      expect(toastMock).toHaveBeenCalledTimes(1);

      // Re-open
      openUserMenu();
      fireEvent.click(screen.getByTestId('topbar-profile-menu-item'));

      await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(2));
      expect(toastMock).toHaveBeenNthCalledWith(2, 'Tính năng đang phát triển', 'info');
    });
  });

  describe('TD-7 / PI-5 — FALLBACK_USER_ID no longer matches A2 anti-pattern', () => {
    it('falls back to "placeholder" when userProfile is null (no A2 regex match)', async () => {
      fetchMock.mockClear();
      mockUseAuth.mockReturnValue({
        userProfile: null,
        isDevMode: false,
        setDevRole: setDevRoleMock,
        devRole: 'admin',
      });
      renderTopbar();

      // Wait for the polling effect to fire (renderTopbar wraps the initial
      // mount in act(), then the setInterval may also have fired).
      await waitFor(() => expect(fetchMock).toHaveBeenCalled());

      // Inspect the FIRST call from this render — preceding tests may have
      // populated fetchMock, so we filter by URL pattern instead of index.
      const placeholderCall = fetchMock.mock.calls.find((c) => {
        const url = c[0] as string | undefined;
        return typeof url === 'string' && url.startsWith('/api/notifications');
      });
      expect(placeholderCall).toBeDefined();
      const url = placeholderCall?.[0] as string;
      expect(url).toContain('userId=placeholder');
      expect(url).not.toContain('userId=user-001');
    });

    it('does NOT render the literal string "user-001" anywhere in the Topbar DOM', () => {
      fetchMock.mockClear();
      mockUseAuth.mockReturnValue({
        userProfile: null,
        isDevMode: false,
        setDevRole: setDevRoleMock,
        devRole: 'admin',
      });
      const { container } = renderTopbar();
      expect(container.innerHTML).not.toContain('user-001');
    });
  });

  describe('RR-5 cleanup — no `as never` cast remains', () => {
    it('does not throw when typing into the dev-role select', () => {
      mockUseAuth.mockReturnValue({
        userProfile: makeUser(),
        isDevMode: true,
        setDevRole: setDevRoleMock,
        devRole: 'admin',
      });
      renderTopbar();

      // The DEV role select is rendered when isDevMode is true.
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      // Change the value to a valid role. The cast is now `as UserRole`,
      // which is type-safe; if the cast were removed entirely this still
      // works because `setDevRole` accepts `UserRole`.
      fireEvent.change(select, { target: { value: 'doctor' } });
      expect(setDevRoleMock).toHaveBeenCalledWith('doctor');
    });
  });
});