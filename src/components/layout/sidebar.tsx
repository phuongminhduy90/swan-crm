'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  CreditCard,
  Calendar,
  CheckSquare,
  Bell,
  ImageIcon,
  BarChart3,
  Settings,
  BellRing,
  FileText,
  ChevronLeft,
  type LucideIcon,
  UserCog,
  Shield,
  MapPin,
  Stethoscope,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { hasPermission } from '@/lib/auth/rb';
import type { Permission } from '@/config/roles';
import { SwanLogo } from '@/components/ui/swan-logo';
import { Avatar } from '@/components/ui/avatar';
import { ROLE_LABELS } from '@/config/roles';

interface MenuItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
}

const MENU_ITEMS: MenuItem[] = [
  { label: 'Bảng điều khiển', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard:read' },
  { label: 'Khách hàng', href: '/customers', icon: Users, permission: 'customers:read' },
  { label: 'Hồ sơ CASE', href: '/cases', icon: FolderOpen, permission: 'cases:read' },
  { label: 'Thanh toán', href: '/payments', icon: CreditCard, permission: 'payments:read' },
  { label: 'Lịch hẹn', href: '/calendar', icon: Calendar, permission: 'calendar:read' },
  { label: 'Công việc', href: '/tasks', icon: CheckSquare, permission: 'tasks:read' },
  { label: 'Theo dõi sau', href: '/followups', icon: Bell, permission: 'followups:read' },
  { label: 'Thư viện Media', href: '/media-library', icon: ImageIcon, permission: 'media:read' },
  { label: 'Báo cáo', href: '/reports', icon: BarChart3, permission: 'reports:read' },
];

const SETTINGS_SUB_ITEMS: MenuItem[] = [
  { label: 'Người dùng', href: '/settings/users', icon: UserCog, permission: 'users:read' },
  { label: 'Phân quyền', href: '/settings/roles', icon: Shield, permission: 'roles:read' },
  { label: 'Điểm điều trị', href: '/settings/treatment-locations', icon: MapPin, permission: 'settings:read' },
  { label: 'Dịch vụ', href: '/settings/services', icon: Stethoscope, permission: 'settings:read' },
];

const BOTTOM_ITEMS: MenuItem[] = [
  { label: 'Thông báo', href: '/notifications', icon: BellRing, permission: 'notifications:read' },
  { label: 'Nhật ký', href: '/audit-logs', icon: FileText, permission: 'audit:read' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useCurrentUser();

  if (!user) return null;

  const role = user.role;
  const canSeeSettings = hasPermission(role, 'settings:read') || hasPermission(role, 'users:read');

  const visibleMenu = MENU_ITEMS.filter((m) => hasPermission(role, m.permission));
  const visibleSettings = SETTINGS_SUB_ITEMS.filter((m) => hasPermission(role, m.permission));
  const visibleBottom = BOTTOM_ITEMS.filter((m) => hasPermission(role, m.permission));

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-gray-200/60 bg-white/80 backdrop-blur-xl transition-all duration-300',
        collapsed ? 'w-20' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-gray-100 px-4">
        {!collapsed && (
          <SwanLogo showText />
        )}
        {collapsed && (
          <div className="flex w-full justify-center">
            <SwanLogo />
          </div>
        )}
      </div>

      {/* Toggle */}
      <div className="flex justify-end px-2 pt-2">
        <button
          onClick={onToggle}
          className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label={collapsed ? 'Mở rộng' : 'Thu gọn'}
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Main menu */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {visibleMenu.map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            collapsed={collapsed}
            active={pathname === item.href || pathname.startsWith(item.href + '/')}
          />
        ))}

        {canSeeSettings && visibleSettings.length > 0 && (
          <div className="pt-4">
            {!collapsed && (
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Cài đặt
              </p>
            )}
            <div className="space-y-1">
              {visibleSettings.map((item) => (
                <SidebarLink
                  key={item.href}
                  item={item}
                  collapsed={collapsed}
                  active={pathname === item.href || pathname.startsWith(item.href + '/')}
                />
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Bottom menu */}
      <div className="border-t border-gray-100 px-3 py-2">
        {visibleBottom.map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            collapsed={collapsed}
            active={pathname === item.href || pathname.startsWith(item.href + '/')}
          />
        ))}
      </div>

      {/* User card */}
      <div className="border-t border-gray-100 p-3">
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg p-2',
            collapsed ? 'justify-center' : '',
          )}
        >
          <Avatar name={user.displayName} size="md" />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{user.displayName}</p>
              <p className="truncate text-xs text-swan-600">{ROLE_LABELS[user.role]}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({
  item,
  active,
  collapsed,
}: {
  item: MenuItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
        active
          ? 'bg-swan-50/80 text-swan-700 shadow-sm'
          : 'text-gray-600 hover:bg-gray-50/80 hover:text-swan-600',
        collapsed && 'justify-center px-2',
      )}
      title={collapsed ? item.label : undefined}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-swan-400 to-swan-600" />
      )}
      <Icon
        className={cn(
          'h-5 w-5 shrink-0 transition-colors duration-200',
          active ? 'text-swan-500' : 'text-gray-400 group-hover:text-swan-500',
        )}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}