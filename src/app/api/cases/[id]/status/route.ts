import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCase, updateCaseStatus } from '@/lib/firestore/cases';
import { updateCaseStatusSchema } from '@/lib/validators/case';
import {
  CASE_STATUS_TRANSITIONS,
} from '@/constants/case-status';
import { CaseStatus } from '@/lib/types';
import { writeAuditLog } from '@/lib/firestore/audit';
import {
  triggerMedicalAlert,
  triggerComplaint,
  triggerPostOpFollowupDue,
} from '@/lib/notifications/trigger';
import { getCustomer } from '@/lib/firestore/customers';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';
import { triggerAutoTasks } from '@/lib/tasks/auto-tasks';
import { createPostOpFollowups } from '@/lib/firestore/followups';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authResult = await requirePermission(request, 'cases:write');
    if (isErrorResponse(authResult)) return authResult;
    const user = authResult.user;

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
    } else if (newStatus === 'complaint') {
      triggerComplaint(existing);
    } else if (newStatus.startsWith('post_op_')) {
      const customer = await getCustomer(existing.customerId);
      const followupDay = newStatus.replace('post_op_', 'D').toUpperCase();
      triggerPostOpFollowupDue(
        existing.caseCode,
        existing.customerId,
        existing.id,
        customer?.fullName ?? 'Khách hàng',
        followupDay,
        'CSKH',
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