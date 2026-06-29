/**
 * API Auth Helper — server-side authentication & authorization for API routes.
 * Supports both dev mode (mock users) and production (Firebase Admin JWT verification).
 */
import { NextRequest, NextResponse } from 'next/server';
import { isDevMode } from '@/config/firebase';
import { getUser } from '@/lib/firestore/users';
import { isMockEnabled, initSeedData } from '@/lib/mock/store';
import type { UserRole } from '@/lib/types';
import type { Permission } from '@/config/roles';
import { hasPermission } from '@/config/roles';

export interface ApiUser {
  uid: string;
  role: UserRole;
  email: string;
  displayName: string;
  isActive: boolean;
}

/**
 * Verify the caller's session in dev mode by reading X-Dev-User-Id header.
 * In production this would verify a Firebase ID token from Authorization header.
 */
/**
 * Hardcoded dev user map: seed user-IDs → role.
 * Used when isDevMode=true but Firebase config is present (isMockEnabled()=false).
 */
const DEV_USER_ROLE_MAP: Record<string, UserRole> = {
  'user-001': 'admin',
  'user-002': 'ceo',
  'user-003': 'cso',
  'user-004': 'master_sales',
  'user-005': 'sales_online',
  'user-006': 'sales_offline',
  'user-007': 'accountant',
  'user-008': 'doctor',
  'user-009': 'nurse',
  'user-010': 'coordinator',
  'user-011': 'cskh_postop',
  'user-012': 'media',
};

async function resolveUser(request: NextRequest): Promise<ApiUser | null> {
  if (isDevMode) {
    // Next.js normalizes all incoming headers to lowercase
    // Dev mode: accept x-dev-user-id header (defaults to user-001 = admin)
    const userId =
      request.headers.get('x-dev-user-id') ??
      request.headers.get('X-Dev-User-Id') ??
      'user-001';

    // Try mock store first (when isMockEnabled=true)
    if (isMockEnabled()) {
      initSeedData();
      const user = await getUser(userId);
      if (user) {
        return { uid: user.id, role: user.role, email: user.email, displayName: user.displayName, isActive: user.isActive ?? true };
      }
    }

    // Fallback: use hardcoded dev user map
    const role = DEV_USER_ROLE_MAP[userId];
    if (!role) {
      console.warn(`[auth] Dev mode: unknown userId '${userId}', returning null`);
      return null;
    }
    return {
      uid: userId,
      role,
      email: `${role}@swanclinic.vn`,
      displayName: `Dev ${role}`,
      isActive: true,
    };
  }


  // Production: verify Firebase ID token
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);

    const { getAdminAuth } = await import('@/lib/firebase/admin');
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);

    const userProfile = await getUser(decoded.uid);
    if (!userProfile) return null;

    return {
      uid: decoded.uid,
      role: userProfile.role,
      email: userProfile.email,
      displayName: userProfile.displayName,
      isActive: userProfile.isActive ?? true,
    };
  } catch {
    return null;
  }
}

/**
 * Require authentication. Returns the user or a 401 response.
 */
export async function requireAuth(
  request: NextRequest,
): Promise<{ user: ApiUser } | NextResponse> {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Bạn cần đăng nhập để thực hiện thao tác này.' },
      { status: 401 },
    );
  }
  if (!user.isActive) {
    return NextResponse.json(
      { error: 'Tài khoản của bạn đã bị vô hiệu hóa.' },
      { status: 403 },
    );
  }
  return { user };
}

/**
 * Require authentication AND a specific permission.
 * Returns the user or an error response (401 / 403).
 */
export async function requirePermission(
  request: NextRequest,
  permission: Permission,
): Promise<{ user: ApiUser } | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const { user } = authResult;
  if (!hasPermission(user.role, permission)) {
    return NextResponse.json(
      { error: `Bạn không có quyền thực hiện thao tác này. Yêu cầu: ${permission}` },
      { status: 403 },
    );
  }
  return { user };
}

/**
 * Check if the result from requireAuth/requirePermission is an error response.
 */
export function isErrorResponse(
  result: { user: ApiUser } | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse;
}
