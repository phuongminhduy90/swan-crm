import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAttachment, getAttachmentsByCase, getAllAttachments } from '@/lib/firestore/attachments';
import { createAttachmentSchema } from '@/lib/validators/attachment';
import { writeAuditLog } from '@/lib/firestore/audit';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(request, 'attachments:read');
    if (isErrorResponse(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');

    const attachments = caseId
      ? await getAttachmentsByCase(caseId)
      : await getAllAttachments();

    return NextResponse.json({ success: true, attachments });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get attachments error:', error);
    return NextResponse.json(
      { error: 'Không thể tải danh sách file: ' + message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermission(request, 'attachments:write');
    if (isErrorResponse(authResult)) return authResult;
    const user = authResult.user;

    const body = await request.json();
    const data = createAttachmentSchema.parse(body);

    const attachment = await createAttachment(data, user.uid);

    await writeAuditLog({
      actorId: user.uid,
      actorName: user.displayName,
      actorRole: user.role,
      action: 'attachment_uploaded',
      entityType: 'attachment',
      entityId: attachment.id,
      after: { type: data.type, fileName: data.fileName },
    });

    return NextResponse.json({ success: true, result: attachment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message ?? 'Dữ liệu không hợp lệ' },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Upload attachment error:', error);
    return NextResponse.json(
      { error: 'Không thể tải lên file: ' + message },
      { status: 500 },
    );
  }
}
