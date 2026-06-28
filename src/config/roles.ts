import { UserRole } from '@/lib/types';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Quản trị viên',
  ceo: 'Giám đốc (CEO)',
  cso: 'Giám đốc CS',
  master_sales: 'Trưởng kinh doanh',
  sales_online: 'Kinh doanh Online',
  sales_offline: 'Kinh doanh Offline',
  accountant: 'Kế toán',
  doctor: 'Bác sĩ',
  nurse: 'Y tá',
  coordinator: 'Điều phối viên',
  cskh_postop: 'CSKH sau phẫu thuật',
  media: 'Media',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700 border-purple-200',
  ceo: 'bg-champagne-400/20 text-champagne-600 border-champagne-400/30',
  cso: 'bg-amber-100 text-amber-700 border-amber-200',
  master_sales: 'bg-swan-100 text-swan-700 border-swan-200',
  sales_online: 'bg-sky-100 text-sky-700 border-sky-200',
  sales_offline: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  accountant: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  doctor: 'bg-rose-100 text-rose-700 border-rose-200',
  nurse: 'bg-pink-100 text-pink-700 border-pink-200',
  coordinator: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  cskh_postop: 'bg-teal-100 text-teal-700 border-teal-200',
  media: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
};

export type Permission =
  | 'users:read'
  | 'users:write'
  | 'users:delete'
  | 'roles:read'
  | 'roles:write'
  | 'customers:read'
  | 'customers:write'
  | 'customers:delete'
  | 'cases:read'
  | 'cases:write'
  | 'cases:assign'
  | 'payments:read'
  | 'payments:write'
  | 'payments:approve'
  | 'calendar:read'
  | 'calendar:write'
  | 'tasks:read'
  | 'tasks:write'
  | 'tasks:assign'
  | 'followups:read'
  | 'followups:write'
  | 'media:read'
  | 'media:write'
  | 'reports:read'
  | 'reports:export'
  | 'settings:read'
  | 'settings:write'
  | 'notifications:read'
  | 'notifications:write'
  | 'audit:read'
  | 'audit:write'
  | 'attachments:read'
  | 'attachments:write'
  | 'consents:read'
  | 'consents:write'
  | 'dashboard:read';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'users:read', 'users:write', 'users:delete',
    'roles:read', 'roles:write',
    'customers:read', 'customers:write', 'customers:delete',
    'cases:read', 'cases:write', 'cases:assign',
    'payments:read', 'payments:write', 'payments:approve',
    'calendar:read', 'calendar:write',
    'tasks:read', 'tasks:write', 'tasks:assign',
    'followups:read', 'followups:write',
    'media:read', 'media:write',
    'reports:read', 'reports:export',
    'settings:read', 'settings:write',
    'notifications:read', 'notifications:write',
    'audit:read', 'audit:write',
    'attachments:read', 'attachments:write',
    'consents:read', 'consents:write',
    'dashboard:read',
  ],
  ceo: [
    'users:read',
    'customers:read',
    'cases:read',
    'payments:read',
    'reports:read', 'reports:export',
    'dashboard:read',
    'calendar:read',
    'tasks:read',
    'audit:read',
    'attachments:read',
    'consents:read',
    'notifications:read',
    'followups:read',
  ],
  cso: [
    'customers:read', 'customers:write', 'customers:delete',
    'cases:read', 'cases:write', 'cases:assign',
    'payments:read', 'payments:approve',
    'reports:read', 'reports:export',
    'dashboard:read',
    'settings:read',
    'calendar:read', 'calendar:write',
    'tasks:read', 'tasks:write', 'tasks:assign',
    'audit:read',
    'attachments:read', 'attachments:write',
    'consents:read', 'consents:write',
    'notifications:read', 'notifications:write',
    'followups:read', 'followups:write',
  ],
  master_sales: [
    'customers:read', 'customers:write',
    'cases:read', 'cases:write', 'cases:assign',
    'payments:read', 'payments:write',
    'calendar:read', 'calendar:write',
    'tasks:read', 'tasks:write', 'tasks:assign',
    'reports:read',
    'dashboard:read',
    'notifications:read',
    'attachments:read', 'attachments:write',
    'consents:read', 'consents:write',
    'followups:read',
  ],
  sales_online: [
    'customers:read', 'customers:write',
    'cases:read', 'cases:write',
    'payments:read', 'payments:write',
    'calendar:read', 'calendar:write',
    'tasks:read', 'tasks:write',
    'dashboard:read',
    'notifications:read',
    'attachments:read', 'attachments:write',
    'consents:read',
  ],
  sales_offline: [
    'customers:read', 'customers:write',
    'cases:read', 'cases:write',
    'payments:read', 'payments:write',
    'calendar:read', 'calendar:write',
    'tasks:read', 'tasks:write',
    'dashboard:read',
    'notifications:read',
    'attachments:read', 'attachments:write',
    'consents:read',
  ],
  accountant: [
    'customers:read',
    'cases:read',
    'payments:read', 'payments:write', 'payments:approve',
    'reports:read', 'reports:export',
    'dashboard:read',
    'tasks:read',
    'notifications:read',
    'attachments:read', 'attachments:write',
    'audit:read',
  ],
  doctor: [
    'customers:read',
    'cases:read', 'cases:write',
    'calendar:read', 'calendar:write',
    'tasks:read', 'tasks:write',
    'dashboard:read',
    'notifications:read', 'notifications:write',
    'followups:read', 'followups:write',
    'attachments:read', 'attachments:write',
    'consents:read', 'consents:write',
  ],
  nurse: [
    'customers:read',
    'cases:read',
    'calendar:read',
    'tasks:read', 'tasks:write',
    'dashboard:read',
    'notifications:read',
    'followups:read', 'followups:write',
    'attachments:read', 'attachments:write',
    'consents:read',
  ],
  coordinator: [
    'customers:read', 'customers:write',
    'cases:read', 'cases:write', 'cases:assign',
    'calendar:read', 'calendar:write',
    'tasks:read', 'tasks:write', 'tasks:assign',
    'dashboard:read',
    'notifications:read', 'notifications:write',
    'attachments:read', 'attachments:write',
    'consents:read', 'consents:write',
    'followups:read',
  ],
  cskh_postop: [
    'customers:read',
    'cases:read',
    'calendar:read',
    'tasks:read', 'tasks:write',
    'followups:read', 'followups:write',
    'dashboard:read',
    'notifications:read', 'notifications:write',
    'attachments:read', 'attachments:write',
    'consents:read',
  ],
  media: [
    'media:read', 'media:write',
    'dashboard:read',
    'notifications:read',
    'attachments:read',
    'consents:read',
  ],
};

export const ALL_ROLES: UserRole[] = Object.keys(ROLE_LABELS) as UserRole[];

/**
 * Check whether a given role has a specific permission.
 * Returns false if role or permission is not found.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}