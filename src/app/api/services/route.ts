import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAllServices, createService } from '@/lib/firestore/services';
import { createServiceSchema } from '@/lib/validators/service';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(request, 'settings:read');
    if (isErrorResponse(authResult)) return authResult;

    const services = await getAllServices();
    return NextResponse.json({ services });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get services error:', error);
    return NextResponse.json(
      { error: 'Không thể tải danh sách dịch vụ: ' + message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermission(request, 'settings:write');
    if (isErrorResponse(authResult)) return authResult;

    const body = await request.json();
    const data = createServiceSchema.parse(body);

    const service = await createService(data);

    return NextResponse.json({ success: true, service });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message ?? 'Dữ liệu không hợp lệ' },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create service error:', error);
    return NextResponse.json(
      { error: 'Không thể tạo dịch vụ: ' + message },
      { status: 500 },
    );
  }
}