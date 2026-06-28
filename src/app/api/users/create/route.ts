import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { isAdminConfigured, getAdminAuth } from '@/lib/firebase/admin';
import { createUser } from '@/lib/firestore/users';
import { isDevMode } from '@/config/firebase';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';
import type { UserRole } from '@/lib/types';

const createUserSchema = z.object({
  displayName: z.string().min(2, 'Tên phải có ít nhất 2 ký tự'),
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự'),
  role: z.enum([
    'admin', 'ceo', 'cso', 'master_sales', 'sales_online',
    'sales_offline', 'accountant', 'doctor', 'nurse',
    'coordinator', 'cskh_postop', 'media',
  ]),
  phone: z.string().optional(),
});

export async function POST(request: NextRequest) {
  // Require users:write permission — chỉ admin có quyền tạo user
  const authResult = await requirePermission(request, 'users:write');
  if (isErrorResponse(authResult)) return authResult;

  const { user: caller } = authResult;

  // Dev mode bypasses Admin SDK entirely
  if (!isAdminConfigured() && !isDevMode) {
    return NextResponse.json(
      { error: 'Firebase Admin chưa được cấu hình. Vui lòng thiết lập biến môi trường.' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Request body không hợp lệ (phải là JSON).' },
      { status: 400 },
    );
  }

  // Parse và validate — trả 400 thay vì 500 khi validation lỗi
  let data: z.infer<typeof createUserSchema>;
  try {
    data = createUserSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'Dữ liệu không hợp lệ.',
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }
    throw error;
  }

  // Non-admin không thể tạo role admin hoặc ceo
  if (caller.role !== 'admin' && (data.role === 'admin' || data.role === 'ceo')) {
    return NextResponse.json(
      { error: 'Bạn không có quyền tạo tài khoản với vai trò này.' },
      { status: 403 },
    );
  }

  try {
    if (isDevMode) {
      // Mock: check email trùng trước khi tạo
      const { getAllUsers } = await import('@/lib/firestore/users');
      const existing = await getAllUsers();
      const emailExists = existing.some((u) => u.email === data.email);
      if (emailExists) {
        return NextResponse.json(
          { error: 'Email đã được sử dụng bởi tài khoản khác.' },
          { status: 409 },
        );
      }

      const mockUid = `dev-${Date.now()}`;
      await createUser({
        id: mockUid,
        email: data.email,
        displayName: data.displayName,
        role: data.role as UserRole,
        phone: data.phone,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, uid: mockUid });
    }

    // Production: use Admin SDK
    const adminAuth = getAdminAuth();
    const userRecord = await adminAuth.createUser({
      email: data.email,
      password: data.password,
      displayName: data.displayName,
      phoneNumber: data.phone || undefined,
    });

    await adminAuth.setCustomUserClaims(userRecord.uid, { role: data.role });

    await createUser({
      id: userRecord.uid,
      email: data.email,
      displayName: data.displayName,
      role: data.role as UserRole,
      phone: data.phone,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('email already exists') || message.includes('email-already-exists')) {
      return NextResponse.json(
        { error: 'Email đã được sử dụng bởi tài khoản khác.' },
        { status: 409 },
      );
    }
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: 'Không thể tạo người dùng. Vui lòng thử lại.' },
      { status: 500 },
    );
  }
}