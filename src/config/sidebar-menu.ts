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
  BellRing,
  FileText,
  UserCog,
  Shield,
  MapPin,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from '@/config/roles';

/**
 * One menu entry rendered inside either the Sidebar or the MobileNav.
 *
 * `permission` is typed against the canonical `Permission` union (not `string`)
 * so menu entries can't drift from `ROLE_PERMISSIONS`. The legacy inline arrays
 * in `sidebar.tsx` / `mobile-nav.tsx` used `permission: string` which forced the
 * `as never` casts in MobileNav. Story A.5 removes that escape hatch.
 */
export interface MenuItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
}

/** Primary navigation rendered between the logo and the bottom menu. */
export const MENU_ITEMS: MenuItem[] = [
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

/** Sub-items grouped under the "Cài đặt" section, rendered after the primary list. */
export const SETTINGS_SUB_ITEMS: MenuItem[] = [
  { label: 'Người dùng', href: '/settings/users', icon: UserCog, permission: 'users:read' },
  { label: 'Phân quyền', href: '/settings/roles', icon: Shield, permission: 'roles:read' },
  { label: 'Điểm điều trị', href: '/settings/treatment-locations', icon: MapPin, permission: 'settings:read' },
  { label: 'Dịch vụ', href: '/settings/services', icon: Stethoscope, permission: 'settings:read' },
];

/** Items rendered after the divider at the bottom of the navigation surface. */
export const BOTTOM_ITEMS: MenuItem[] = [
  { label: 'Thông báo', href: '/notifications', icon: BellRing, permission: 'notifications:read' },
  { label: 'Nhật ký', href: '/audit-logs', icon: FileText, permission: 'audit:read' },
];
