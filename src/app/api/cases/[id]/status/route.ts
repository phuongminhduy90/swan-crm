import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCase, updateCaseStatus } from '@/lib/firestore/cases';
import { updateCaseStatusSchema } from '@/lib/validators/case';
import {
  CASE_STATUS_TRANSITIONS,
} from '@/constants/case-status';
import { CASE_STATUS_CHANGE_ROLES } from '@/constants/permissions';
import { CaseStatus } from '@/lib/types';
import { writeAuditLog } from '@/lib/firestore/audit';
import {
  triggerMedicalAlert,
  triggerMedicalAlertResolved,
  triggerComplaint,
  triggerPostOpFollowupDue,
  resolveCskhDisplayName,
} from '@/lib/notifications/trigger';
import { getCustomer } from '@/lib/firestore/customers';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';
import { triggerAutoTasks } from '@/lib/tasks/auto-tasks';
import { createPostOpFollowups } from '@/lib/firestore/followups';
import { isFlagEnabled } from '@/lib/feature-flags';

/**
 * PATCH /api/cases/[id]/status
 *
 * Story B.1.3 (F-CRIT-05) — Server-side role enforcement for case status.
 *
 * When `FEATURE_SERVER_RBAC` is enabled:
 *   1. The caller must have the `cases:write` permission (existing check).
 *   2. The caller's role must be in `CASE_STATUS_CHANGE_ROLES` (new guard).
 *   3. The requested transition must be in `CASE_STATUS_TRANSITIONS` (existing check).
 *
 * Decision (Appendix A, Q1, locked):
 *   Only roles in CASE_STATUS_CHANGE_ROLES may change ANY case status. Sales
 *   roles (`sales_online`, `sales_offline`) lose status-change rights entirely.
 *   Coordinators + clinical roles retain them.
 *
 * The flag defaults to OFF in production. When OFF, only the `cases:write`
 * permission gate applies (pre-existing behavior).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // --- Auth & permission gate (existing) ---
    const authResult = await requirePermission(request, 'cases:write');
    if (isErrorResponse(authResult)) return authResult;
    const user = authResult.user;

    // --- B.1.3: Server-side RBAC guard (behind flag) ---
    if (isFlagEnabled('SERVER_RBAC')) {
      if (!CASE_STATUS_CHANGE_ROLES.includes(user.role)) {
        return NextResponse.json(
          {
            error: `Bạn không có quyền thay đổi trạng thái hồ sơ. Vai trò "${user.role}" không nằm trong danh sách "${CASE_STATUS_CHANGE_ROLES.join('", "')}".`,
          },
          { status: 403 },
        );
      }
    }

    const body = await request.json();
    const data = updateCaseStatusSchema.parse(body);

    const existing = await getCase(params.id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Không tìm thấy hồ sơ' },
        { status: 404 },
      );
    }

    const newStatus = data.status as CaseStatus;
    const allowed = CASE_STATUS_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Không thể chuyển trạng thái từ "${existing.status}" sang "${newStatus}"`,
        },
        { status: 400 },
      );
    }

    await updateCaseStatus(params.id, newStatus, user.uid);

    await writeAuditLog({
      actorId: user.uid,
      actorName: user.displayName,
      actorRole: user.role,
      action: 'case_status_changed',
      entityType: 'case',
      entityId: params.id,
      before: { status: existing.status },
      after: { status: newStatus, note: data.note ?? '' },
    });

    // Fire-and-forget: auto-tasks theo status mới
    try {
      await triggerAutoTasks(existing, newStatus, user.uid);
    } catch (err) {
      console.error('[AutoTasks] Failed to trigger:', err);
    }

    // Khi hoàn thành thủ thuật → tạo lịch follow-up D1/D3/D7/D14/D30/D90
    if (newStatus === 'procedure_completed') {
      try {
        await createPostOpFollowups(
          params.id,
          existing.customerId,
          existing.expectedProcedureDate ?? new Date().toISOString(),
          undefined,
        );
      } catch (err) {
        console.error('[FollowUps] Failed to create post-op followups:', err);
      }
    }

    // Fire-and-forget: status-dependent notifications
    if (newStatus === 'medical_alert') {
      triggerMedicalAlert(existing);
    } else if (newStatus === 'medical_alert_resolved') {
      // Story B.2.2 (F-HIGH-19): notify the medical team that the alert has
      // been resolved. Same recipient set as `triggerMedicalAlert` so the
      // doctor + CSO + admin see both ends of the alert lifecycle.
      triggerMedicalAlertResolved(existing);
    } else if (newStatus === 'complaint') {
      triggerComplaint(existing);
    } else if (newStatus.startsWith('post_op_')) {
      const customer = await getCustomer(existing.customerId);
      const followupDay = newStatus.replace('post_op_', 'D').toUpperCase();
      // Story B.1.7 (F-MED-19): resolve CSKH name dynamically from staff
      // assignment. `resolveCskhDisplayName` is self-defensive (returns the
      // literal 'CSKH' on any lookup failure), but we still wrap the call so
      // that a future regression in the helper cannot abort the status
      // change response. Mirrors the existing fire-and-forget pattern for
      // `triggerAutoTasks` and `createPostOpFollowups` above.
      let cskhName = 'CSKH';
      try {
        cskhName = await resolveCskhDisplayName(existing.id);
      } catch (err) {
        console.error('[resolveCskhDisplayName] Unexpected rejection:', err);
      }
      triggerPostOpFollowupDue(
        existing.caseCode,
        existing.customerId,
        existing.id,
        customer?.fullName ?? 'Khách hàng',
        followupDay,
        cskhName,
        user.uid,
      );
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
    console.error('Update case status error:', error);
    return NextResponse.json(
      { error: 'Không thể cập nhật trạng thái hồ sơ: ' + message },
      { status: 500 },
    );
  }
}