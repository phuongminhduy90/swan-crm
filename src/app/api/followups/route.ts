import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getFollowupsByCase, getAllFollowups, createPostOpFollowups } from '@/lib/firestore/followups';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

const createFollowupsSchema = z.object({
  caseId: z.string().min(1),
  customerId: z.string().min(1),
  procedureDate: z.string().min(1),
  assignedTo: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(request, 'followups:read');
    if (isErrorResponse(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');

    const followups = caseId
      ? await getFollowupsByCase(caseId)
      : await getAllFollowups();

    return NextResponse.json({ success: true, followups });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get followups error:', error);
    return NextResponse.json(
      { error: 'Không thể tải danh sách followup: ' + message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermission(request, 'followups:write');
    if (isErrorResponse(authResult)) return authResult;

    const body = await request.json();
    const data = createFollowupsSchema.parse(body);

    const followups = await createPostOpFollowups(
      data.caseId,
      data.customerId,
      new Date(data.procedureDate),
      data.assignedTo,
    );

    return NextResponse.json({ success: true, result: followups });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message ?? 'Dữ liệu không hợp lệ' },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create followups error:', error);
    return NextResponse.json(
      { error: 'Không thể tạo followup: ' + message },
      { status: 500 },
    );
  }
}
