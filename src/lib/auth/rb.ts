import { UserRole } from '@/lib/types';
import { ROLE_PERMISSIONS, Permission } from '@/config/roles';

/** Check if a role has a specific permission. Returns false if role is unknown. */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

/** Returns true if a role has AT LEAST ONE of the given permissions. */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  if (permissions.length === 0) return false;
  return permissions.some((p) => hasPermission(role, p));
}

/**
 * Returns true if a role has ALL of the given permissions.
 * NOTE: Returns false for an empty permissions array (safe default).
 * This prevents [].every() = true from granting unintended access.
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  if (permissions.length === 0) return false; // FIX: empty array guard
  return permissions.every((p) => hasPermission(role, p));
}