import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminConfigured, getAdminAuth } from '@/lib/firebase/admin';
import { updateUser } from '@/lib/firestore/users';
import { isDevMode } from '@/config/firebase';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

const updateUserSchema = z.object({
  displayName: z.string().min(2).optional(),
  role: z
    .enum([
      'admin', 'ceo', 'cso', 'master_sales', 'sales_online',
      'sales_offline', 'accountant', 'doctor', 'nurse',
      'coordinator', 'cskh_postop', 'media',
    ])
    .optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { uid: string } },
) {
  const authResult = await requirePermission(request, 'users:write');
  if (isErrorResponse(authResult)) return authResult;
  const user = authResult.user;

  if (!isAdminConfigured() && !isDevMode) {
    return NextResponse.json(
      { error: 'Firebase Admin chưa được cấu hình' },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const data = updateUserSchema.parse(body);
    const { uid } = params;

    // Always update the document (mock store or real Firestore)
    await updateUser(uid, data);

    if (isDevMode) {
      // Skip Admin SDK operations in dev mode
      return NextResponse.json({ success: true });
    }

    if (data.role) {
      const adminAuth = getAdminAuth();
      await adminAuth.setCustomUserClaims(uid, { role: data.role });
    }

    if (data.isActive !== undefined) {
      const adminAuth = getAdminAuth();
      await adminAuth.updateUser(uid, { disabled: !data.isActive });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Không thể cập nhật người dùng: ' + message },
      { status: 500 },
    );
  }
}
