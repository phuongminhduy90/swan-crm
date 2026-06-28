import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAllCustomers, searchCustomers, createCustomer } from '@/lib/firestore/customers';
import { createCustomerSchema } from '@/lib/validators/customer';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

export async function GET(request: NextRequest) {
  const authResult = await requirePermission(request, 'customers:read');
  if (isErrorResponse(authResult)) return authResult;

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('search');

    const customers = query ? await searchCustomers(query) : await getAllCustomers();
    return NextResponse.json({ customers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get customers error:', error);
    return NextResponse.json(
      { error: 'Không thể tải danh sách khách hàng: ' + message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requirePermission(request, 'customers:write');
  if (isErrorResponse(authResult)) return authResult;
  const user = authResult.user;

  try {
    const body = await request.json();
    const data = createCustomerSchema.parse(body);

    const customer = await createCustomer(data, user.uid);

    return NextResponse.json({ success: true, customer });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message ?? 'Dữ liệu không hợp lệ' },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create customer error:', error);
    return NextResponse.json(
      { error: 'Không thể tạo khách hàng: ' + message },
      { status: 500 },
    );
  }
}
