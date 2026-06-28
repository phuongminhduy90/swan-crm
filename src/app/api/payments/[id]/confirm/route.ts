import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { confirmPayment, getPayment } from '@/lib/firestore/payments';
import { confirmPaymentSchema } from '@/lib/validators/payment';
import { writeAuditLog } from '@/lib/firestore/audit';
import { triggerPaymentConfirmedNotification } from '@/lib/notifications/trigger';
import { getCase } from '@/lib/firestore/cases';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authResult = await requirePermission(request, 'payments:approve');
    if (isErrorResponse(authResult)) return authResult;
    const user = authResult.user;

    const body = await request.json();
    const data = confirmPaymentSchema.parse(body);

    await confirmPayment(params.id, data, user.uid);

    await writeAuditLog({
      actorId: user.uid,
      actorName: user.displayName,
      actorRole: user.role,
      action: 'payment_confirmed',
      entityType: 'payment',
      entityId: params.id,
      after: { confirmedBy: data.confirmedBy, note: data.note ?? '' },
    });

    // Fire-and-forget: trigger payment confirmed notification
    try {
      const payment = await getPayment(params.id);          // load payment thật
      if (payment?.caseId) {
        const caseRecord = await getCase(payment.caseId);   // dùng caseId đúng
        if (caseRecord) {
          triggerPaymentConfirmedNotification(payment, caseRecord);
        }
      }
    } catch {
      // ignore notification errors
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
    console.error('Confirm payment error:', error);
    return NextResponse.json(
      { error: 'Không thể xác nhận thanh toán: ' + message },
      { status: 500 },
    );
  }
}