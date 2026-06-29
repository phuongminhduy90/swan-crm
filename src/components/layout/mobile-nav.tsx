'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useVisibleMenu } from '@/lib/hooks/useVisibleMenu';
import { SwanLogo } from '@/components/ui/swan-logo';
import type { MenuItem } from '@/config/sidebar-menu';

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const { mainItems, settingsItems, bottomItems, canSeeSettings } = useVisibleMenu();

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!user) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-xl transition-transform duration-300 lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-100 px-4">
          <SwanLogo showText />
          <button
            onClick={onClose}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Đóng menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {mainItems.map((item) => (
            <MobileLink
              key={item.href}
              item={item}
              active={pathname === item.href || pathname.startsWith(item.href + '/')}
              onClick={onClose}
            />
          ))}
          {canSeeSettings && settingsItems.length > 0 && (
            <div className="pt-4">
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Cài đặt
              </p>
              <div className="space-y-1">
                {settingsItems.map((item) => (
                  <MobileLink
                    key={item.href}
                    item={item}
                    active={pathname === item.href || pathname.startsWith(item.href + '/')}
                    onClick={onClose}
                  />
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="border-t border-gray-100 px-3 py-2">
          {bottomItems.map((item) => (
            <MobileLink
              key={item.href}
              item={item}
              active={pathname === item.href || pathname.startsWith(item.href + '/')}
              onClick={onClose}
            />
          ))}
        </div>
      </aside>
    </>
  );
}

function MobileLink({
  item,
  active,
  onClick,
}: {
  item: MenuItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'bg-swan-50 text-swan-700'
          : 'text-gray-700 hover:bg-gray-50',
      )}
    >
      <span className="flex items-center gap-3">
        <Icon className={cn('h-5 w-5', active ? 'text-swan-500' : 'text-gray-400')} />
        {item.label}
      </span>
      {active && <ChevronRight className="h-4 w-4 text-swan-500" />}
    </Link>
  );
}
