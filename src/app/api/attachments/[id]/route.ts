import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAttachment, updateAttachmentVisibility, deleteAttachment } from '@/lib/firestore/attachments';
import { updateAttachmentVisibilitySchema } from '@/lib/validators/attachment';
import { deleteFile } from '@/lib/firebase/storage';
import { writeAuditLog } from '@/lib/firestore/audit';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authResult = await requirePermission(request, 'attachments:write');
    if (isErrorResponse(authResult)) return authResult;
    const user = authResult.user;

    const body = await request.json();
    const data = updateAttachmentVisibilitySchema.parse(body);

    const existing = await getAttachment(params.id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Không tìm thấy file đính kèm' },
        { status: 404 },
      );
    }

    await updateAttachmentVisibility(params.id, data.visibility, user.uid);

    await writeAuditLog({
      actorId: user.uid,
      actorName: user.displayName,
      actorRole: user.role,
      action: 'attachment_visibility_changed',
      entityType: 'attachment',
      entityId: params.id,
      before: { visibility: existing.visibility },
      after: { visibility: data.visibility },
    });

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
    console.error('Update attachment error:', error);
    return NextResponse.json(
      { error: 'Không thể cập nhật file: ' + message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authResult = await requirePermission(request, 'attachments:write');
    if (isErrorResponse(authResult)) return authResult;
    const user = authResult.user;

    const existing = await getAttachment(params.id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Không tìm thấy file đính kèm' },
        { status: 404 },
      );
    }

    await deleteFile(existing.storagePath);
    await deleteAttachment(params.id);

    await writeAuditLog({
      actorId: user.uid,
      actorName: user.displayName,
      actorRole: user.role,
      action: 'attachment_deleted',
      entityType: 'attachment',
      entityId: params.id,
      before: { type: existing.type, fileName: existing.fileName },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Delete attachment error:', error);
    return NextResponse.json(
      { error: 'Không thể xóa file: ' + message },
      { status: 500 },
    );
  }
}
