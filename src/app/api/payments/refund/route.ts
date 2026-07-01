import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRefundSchema } from '@/lib/validators/payment';
import { writeAuditLog } from '@/lib/firestore/audit';
import { getPayment } from '@/lib/firestore/payments';
import { requireAuth, isErrorResponse } from '@/lib/api/auth';
import { REFUND_CREATE_ROLES } from '@/constants/permissions';
import { isFlagEnabled } from '@/lib/feature-flags';
import { createRefund, RefundError } from '@/lib/payments/refund';

/**
 * POST /api/payments/refund
 *
 * Story PI-2 (Sprint 7.2) — Refund flow.
 *
 * Behaviour:
 * 1. **Feature flag gate** (`FEATURE_PAYMENT_TX`) — when OFF, the endpoint
 *    returns 404 with a Vietnamese "tính năng chưa được bật" message. This
 *    matches the rollback plan in §7.1 of the Sprint 7.2 plan: refunds revert
 *    to the manual "create payment with paymentType=refund" workflow when the
 *    flag is off, so the dedicated endpoint disappears entirely rather than
 *    silently degrading.
 *
 * 2. **Auth** — `requireAuth` (any authenticated user) plus a role check
 *    against `REFUND_CREATE_ROLES` (`admin`, `ceo`, `accountant`) OR the
 *    caller is the original payment's `createdBy`. Sales staff who created
 *    the original deposit can refund their own entry, but cannot refund
 *    payments they did not create — this matches the "admin + accountant +
 *    creator" contract from the Sprint 7.2 plan §5.2.
 *
 * 3. **Validation** — Zod schema (`createRefundSchema`) handles wire-format
 *    checks; `createRefund()` enforces the domain rules (amount > 0,
 *    ≤ original amount, cumulative cap, original must be confirmed and not
 *    itself a refund).
 *
 * 4. **Audit** — two `writeAuditLog()` calls so the audit trail is complete:
 *    - One on the **refund** payment (`action: 'payment_created'`,
 *      `entityId: refundId`) with `originalPaymentId` in the `after` payload.
 *    - One on the **original** payment (`action: 'payment_refunded'`,
 *      `entityId: originalPaymentId`) so auditors can trace refund chains
 *      directly from the original payment's audit history without scanning
 *      the whole ledger.
 *
 * 5. **Error mapping** — `RefundError.code` is mapped to a 4xx status with
 *    a Vietnamese message. Unknown errors → 500.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Feature flag gate
    if (!isFlagEnabled('PAYMENT_TX')) {
      return NextResponse.json(
        { error: 'Tính năng hoàn tiền chưa được bật (FEATURE_PAYMENT_TX)' },
        { status: 404 },
      );
    }

    // 2. Auth
    const authResult = await requireAuth(request);
    if (isErrorResponse(authResult)) return authResult;
    const user = authResult.user;

    // 3. Body validation
    const body = await request.json();
    const data = createRefundSchema.parse(body);

    // 4. Role + creator permission
    const original = await getPayment(data.originalPaymentId);
    if (!original) {
      return NextResponse.json(
        { error: 'Không tìm thấy thanh toán gốc' },
        { status: 404 },
      );
    }

    const isAllowedRole = REFUND_CREATE_ROLES.includes(user.role);
    const isOriginalCreator = original.createdBy === user.uid;
    if (!isAllowedRole && !isOriginalCreator) {
      return NextResponse.json(
        {
          error:
            'Bạn không có quyền hoàn tiền thanh toán này. Chỉ quản trị viên, giám đốc, kế toán hoặc người tạo thanh toán gốc mới có thể hoàn tiền.',
        },
        { status: 403 },
      );
    }

    // 5. Domain-validated createRefund
    const { refund, caseRecord } = await createRefund(
      data.originalPaymentId,
      {
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        paymentDate: data.paymentDate,
        note: data.note || undefined,
      },
      {
        uid: user.uid,
        displayName: user.displayName,
        role: user.role,
      },
    );

    // 6. Audit log — refund payment itself
    await writeAuditLog({
      actorId: user.uid,
      actorName: user.displayName,
      actorRole: user.role,
      action: 'payment_created',
      entityType: 'payment',
      entityId: refund.id,
      after: {
        paymentType: 'refund',
        originalPaymentId: data.originalPaymentId,
        amount: refund.amount,
        caseId: refund.caseId,
        note: refund.note,
      },
    });

    // 7. Audit log — original payment marker (so auditors can trace chains
    //    from the original payment's audit history directly)
    await writeAuditLog({
      actorId: user.uid,
      actorName: user.displayName,
      actorRole: user.role,
      action: 'payment_refunded',
      entityType: 'payment',
      entityId: data.originalPaymentId,
      after: {
        refundPaymentId: refund.id,
        refundAmount: refund.amount,
        refundedBy: user.uid,
      },
    });

    return NextResponse.json({
      success: true,
      refund,
      case: caseRecord,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message ?? 'Dữ liệu không hợp lệ' },
        { status: 400 },
      );
    }

    if (error instanceof RefundError) {
      const status = error.code === 'original_not_found' ? 404 : 400;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status },
      );
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Refund payment error:', error);
    return NextResponse.json(
      { error: 'Không thể hoàn tiền: ' + message },
      { status: 500 },
    );
  }
}