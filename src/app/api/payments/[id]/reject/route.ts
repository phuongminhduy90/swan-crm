import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rejectPayment } from '@/lib/firestore/payments';
import { writeAuditLog } from '@/lib/firestore/audit';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

const rejectSchema = z.object({
  note: z.string().min(1, 'Vui lòng nhập lý do từ chối'),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authResult = await requirePermission(request, 'payments:approve');
    if (isErrorResponse(authResult)) return authResult;
    const user = authResult.user;

    const body = await request.json();
    const data = rejectSchema.parse(body);

    await rejectPayment(params.id, data.note, user.uid);

    await writeAuditLog({
      actorId: user.uid,
      actorName: user.displayName,
      actorRole: user.role,
      action: 'payment_rejected',
      entityType: 'payment',
      entityId: params.id,
      after: { note: data.note },
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
    console.error('Reject payment error:', error);
    return NextResponse.json(
      { error: 'Không thể từ chối thanh toán: ' + message },
      { status: 500 },
    );
  }
}