import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { updateFollowup } from '@/lib/firestore/followups';
import { writeAuditLog } from '@/lib/firestore/audit';
import { SeverityLevel } from '@/lib/types';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

const updateFollowupSchema = z.object({
  status: z.enum(['pending', 'contacted', 'no_response', 'issue_reported', 'completed']).optional(),
  customerCondition: z.string().optional(),
  painLevel: z.number().min(0).max(5).optional(),
  swellingLevel: z.number().min(0).max(5).optional(),
  bruisingLevel: z.number().min(0).max(5).optional(),
  requestedImage: z.boolean().optional(),
  imageUploaded: z.boolean().optional(),
  note: z.string().optional(),
  nextAction: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authResult = await requirePermission(request, 'followups:write');
    if (isErrorResponse(authResult)) return authResult;
    const user = authResult.user;

    const body = await request.json();
    const data = updateFollowupSchema.parse(body);

    await updateFollowup(params.id, {
      status: data.status,
      customerCondition: data.customerCondition,
      painLevel: data.painLevel as SeverityLevel | undefined,
      swellingLevel: data.swellingLevel as SeverityLevel | undefined,
      bruisingLevel: data.bruisingLevel as SeverityLevel | undefined,
      requestedImage: data.requestedImage,
      imageUploaded: data.imageUploaded,
      note: data.note,
      nextAction: data.nextAction,
    });

    if (data.status === 'completed') {
      await writeAuditLog({
        actorId: user.uid,
        actorName: user.displayName,
        actorRole: user.role,
        action: 'followup_completed',
        entityType: 'followup',
        entityId: params.id,
        before: { status: 'pending' },
        after: { status: 'completed' },
      });
    }

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
    console.error('Update followup error:', error);
    return NextResponse.json(
      { error: 'Không thể cập nhật followup: ' + message },
      { status: 500 },
    );
  }
}
