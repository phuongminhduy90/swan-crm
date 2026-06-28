import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCase, updateCase } from '@/lib/firestore/cases';
import { updateCaseSchema } from '@/lib/validators/case';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const authResult = await requirePermission(request, 'cases:read');
  if (isErrorResponse(authResult)) return authResult;
  const user = authResult.user;

  try {
    const caseRecord = await getCase(params.id);
    if (!caseRecord) {
      return NextResponse.json(
        { error: 'Không tìm thấy hồ sơ' },
        { status: 404 },
      );
    }
    return NextResponse.json({ case: caseRecord });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get case error:', error);
    return NextResponse.json(
      { error: 'Không thể tải hồ sơ: ' + message },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const authResult = await requirePermission(request, 'cases:write');
  if (isErrorResponse(authResult)) return authResult;
  const user = authResult.user;

  try {
    const body = await request.json();
    const data = updateCaseSchema.parse(body);

    const existing = await getCase(params.id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Không tìm thấy hồ sơ' },
        { status: 404 },
      );
    }

    await updateCase(params.id, data, user.uid);

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
    console.error('Update case error:', error);
    return NextResponse.json(
      { error: 'Không thể cập nhật hồ sơ: ' + message },
      { status: 500 },
    );
  }
}
