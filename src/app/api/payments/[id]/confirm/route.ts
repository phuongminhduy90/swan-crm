import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { confirmPayment, getPayment } from '@/lib/firestore/payments';
import { confirmPaymentSchema } from '@/lib/validators/payment';
import { writeAuditLog } from '@/lib/firestore/audit';
import { triggerPaymentConfirmedNotification } from '@/lib/notifications/trigger';
import { getCase } from '@/lib/firestore/cases';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';
import { PAYMENT_CONFIRM_ROLES } from '@/constants/permissions';
import { isFlagEnabled } from '@/lib/feature-flags';

/**
 * PATCH /api/payments/[id]/confirm
 *
 * Story B.3.1 (F-CRIT-06) — Payment separation of duties.
 *
 * Two layered guards, in order:
 *
 * 1. **Role allow-list** (`PAYMENT_CONFIRM_ROLES`) — only `admin` may confirm.
 *    Accountant was removed by Decision A (Appendix A, Q2). The check runs
 *    always (independent of feature flag) because the static
 *    `PAYMENT_CONFIRM_ROLES` constant is the source of truth. The flag only
 *    gates the SoD check below — without the flag, `accountant` retains
 *    `payments:approve` from `ROLE_PERMISSIONS` and would still be admitted
 *    by the auth gate. **The flag's job is to enforce SoD only**.
 *
 * 2. **SoD guard** (behind `FEATURE_PAYMENT_SOD`) — the caller cannot
 *    confirm a payment they themselves created. Applies to **all** roles,
 *    including admin. On violation: 403 + structured audit log
 *    (`action: 'payment_confirmed'`, `before/after` carries `denied: true`,
 *    `reason: 'sod_violation'`) so SOC review has a paper trail.
 *
 * When `FEATURE_PAYMENT_SOD` is OFF (default in production):
 *   - Step 1 still runs (admin-only confirm) via the updated
 *     `PAYMENT_CONFIRM_ROLES` array — accountant can no longer confirm.
 *   - Step 2 is skipped — admin may still self-confirm until the flag
 *     is promoted to ON.
 *
 * Decision (Appendix A, Q2, locked):
 *   `PAYMENT_CONFIRM_ROLES = ['admin']`. SoD enforced. Flag defaults OFF in
 *   production; promotion to ON requires CEO + accountant + product-owner
 *   sign-off per BACKLOG §9.2.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // --- Auth & permission gate (existing) ---
    // requirePermission('payments:approve') — admin, cso, accountant have it.
    // Role allow-list (PAYMENT_CONFIRM_ROLES) is checked separately below
    // so the message can reference the specific role-based contract.
    const authResult = await requirePermission(request, 'payments:approve');
    if (isErrorResponse(authResult)) return authResult;
    const user = authResult.user;

    // --- Story B.3.1: Role allow-list (always on) ---
    if (!PAYMENT_CONFIRM_ROLES.includes(user.role)) {
      return NextResponse.json(
        {
          error: `Bạn không có quyền xác nhận thanh toán. Vai trò "${user.role}" không nằm trong danh sách "${PAYMENT_CONFIRM_ROLES.join('", "')}".`,
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    const data = confirmPaymentSchema.parse(body);

    // --- Story B.3.1: SoD guard (behind flag) ---
    // Load the payment record so we can compare `createdBy` against the
    // current caller (`user.uid`). Done before the side-effecting
    // `confirmPayment(...)` call so the guard short-circuits on violation.
    const existing = await getPayment(params.id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Không tìm thấy thanh toán' },
        { status: 404 },
      );
    }

    if (isFlagEnabled('PAYMENT_SOD') && existing.createdBy === user.uid) {
      // Audit log for the denied attempt — same action type as a successful
      // confirmation so SOC filters surface it, with `denied: true` and a
      // human-readable reason so reviewers can distinguish attempts from
      // successes at a glance.
      await writeAuditLog({
        actorId: user.uid,
        actorName: user.displayName,
        actorRole: user.role,
        action: 'payment_confirmed',
        entityType: 'payment',
        entityId: params.id,
        before: { status: existing.status, createdBy: existing.createdBy },
        after: {
          denied: true,
          reason: 'sod_violation',
          attemptedBy: user.uid,
        },
      });

      return NextResponse.json(
        {
          error:
            'Vi phạm phân tách nhiệm vụ (SoD): bạn không thể xác nhận thanh toán do chính bạn tạo. Vui lòng nhờ quản trị viên khác xác nhận.',
        },
        { status: 403 },
      );
    }

    await confirmPayment(params.id, data, user.uid);

    await writeAuditLog({
      actorId: user.uid,
      actorName: user.displayName,
      actorRole: user.role,
      action: 'payment_confirmed',
      entityType: 'payment',
      entityId: params.id,
      before: { status: existing.status, createdBy: existing.createdBy },
      after: { confirmedBy: data.confirmedBy, note: data.note ?? '' },
    });

    // Fire-and-forget: trigger payment confirmed notification
    try {
      if (existing.caseId) {
        const caseRecord = await getCase(existing.caseId);   // dùng caseId đúng
        if (caseRecord) {
          triggerPaymentConfirmedNotification(existing, caseRecord);
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