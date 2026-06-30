'use client';

import { useState } from 'react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { MobileNav } from './mobile-nav';
import { useFeatureFlag } from '@/lib/feature-flags';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Story B.4.1 — Replace `h-screen` with `min-h-screen` to fix the iOS Safari
  // URL-bar overlap on every protected route. Gated behind
  // `NEXT_PUBLIC_FEATURE_MINH_SCREEN` so prod can flip it off without a code
  // rollback if the visual regression baseline disagrees.
  const minHScreen = useFeatureFlag('MINH_SCREEN');

  return (
    <div
      data-testid="app-shell-wrapper"
      className={minHScreen ? 'flex min-h-screen' : 'flex h-screen overflow-hidden'}
      data-minh-screen={minHScreen ? 'true' : 'false'}
    >
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Mobile drawer */}
      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Main column — overflow-hidden kept on legacy `h-screen` path so the
          inner <main> can scroll. With `min-h-screen` the page grows with
          content so the outer wrapper no longer clips overflow. */}
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
  );
}