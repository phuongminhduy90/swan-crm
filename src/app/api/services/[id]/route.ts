import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getService, updateService, deactivateService } from '@/lib/firestore/services';
import { updateServiceSchema } from '@/lib/validators/service';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const service = await getService(params.id);
    if (!service) {
      return NextResponse.json(
        { error: 'Không tìm thấy dịch vụ' },
        { status: 404 },
      );
    }
    return NextResponse.json({ service });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get service error:', error);
    return NextResponse.json(
      { error: 'Không thể tải dịch vụ: ' + message },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authResult = await requirePermission(request, 'settings:write');
    if (isErrorResponse(authResult)) return authResult;

    const body = await request.json();
    const data = updateServiceSchema.parse(body);

    const existing = await getService(params.id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Không tìm thấy dịch vụ' },
        { status: 404 },
      );
    }

    await updateService(params.id, data);

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
    console.error('Update service error:', error);
    return NextResponse.json(
      { error: 'Không thể cập nhật dịch vụ: ' + message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authResult = await requirePermission(request, 'settings:write');
    if (isErrorResponse(authResult)) return authResult;

    const existing = await getService(params.id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Không tìm thấy dịch vụ' },
        { status: 404 },
      );
    }

    await deactivateService(params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Deactivate service error:', error);
    return NextResponse.json(
      { error: 'Không thể ngừng dịch vụ: ' + message },
      { status: 500 },
    );
  }
}