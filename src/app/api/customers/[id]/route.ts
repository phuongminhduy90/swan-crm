import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCustomer, updateCustomer } from '@/lib/firestore/customers';
import { updateCustomerSchema } from '@/lib/validators/customer';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const authResult = await requirePermission(request, 'customers:read');
  if (isErrorResponse(authResult)) return authResult;
  const user = authResult.user;

  try {
    const customer = await getCustomer(params.id);
    if (!customer) {
      return NextResponse.json(
        { error: 'Không tìm thấy khách hàng' },
        { status: 404 },
      );
    }
    return NextResponse.json({ customer });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get customer error:', error);
    return NextResponse.json(
      { error: 'Không thể tải khách hàng: ' + message },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const authResult = await requirePermission(request, 'customers:write');
  if (isErrorResponse(authResult)) return authResult;
  const user = authResult.user;

  try {
    const body = await request.json();
    const data = updateCustomerSchema.parse(body);

    const existing = await getCustomer(params.id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Không tìm thấy khách hàng' },
        { status: 404 },
      );
    }

    await updateCustomer(params.id, data, user.uid);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message ?? 'Dữ liệu không hợp lệ' },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update customer error:', error);
    return NextResponse.json(
      { error: 'Không thể cập nhật khách hàng: ' + message },
      { status: 500 },
    );
  }
}
