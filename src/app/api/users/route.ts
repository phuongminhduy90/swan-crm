import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getAllUsers } from '@/lib/firestore/users';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

export async function GET(request: NextRequest) {
  // Require authentication + users:read permission
  const authResult = await requirePermission(request, 'users:read');
  if (isErrorResponse(authResult)) return authResult;

  try {
    const users = await getAllUsers();
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { error: 'Không thể tải danh sách người dùng.' },
      { status: 500 },
    );
  }
}