import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rejectPayment, getPayment } from '@/lib/firestore/payments';
import { writeAuditLog } from '@/lib/firestore/audit';
import { writePaymentAudit } from '@/lib/audit/payment-audit';
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

    // Story PI-3 (Sprint 7.2) — read the pre-reject record so the audit
    // entry carries a structured diff (status + note + rejectedAt). This
    // mirrors the F-CRIT-08 confirm-route pattern and gives auditors a
    // consistent diff shape across payment-state transitions.
    const before = await getPayment(params.id);

    await rejectPayment(params.id, data.note, user.uid);

    if (before) {
      await writePaymentAudit({
        action: 'payment_rejected',
        entityId: params.id,
        actor: {
          uid: user.uid,
          displayName: user.displayName,
          role: user.role,
        },
        before,
        after: {
          ...before,
          status: 'rejected',
          note: data.note,
        },
        caseId: before.caseId,
        trigger: 'PI-3 reject',
      });
    } else {
      // Fallback: pre-reject record was missing — preserve the legacy
      // flat shape so the audit trail never silently disappears.
      await writeAuditLog({
        actorId: user.uid,
        actorName: user.displayName,
        actorRole: user.role,
        action: 'payment_rejected',
        entityType: 'payment',
        entityId: params.id,
        after: { note: data.note },
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
    console.error('Reject payment error:', error);
    return NextResponse.json(
      { error: 'Không thể từ chối thanh toán: ' + message },
      { status: 500 },
    );
  }
}