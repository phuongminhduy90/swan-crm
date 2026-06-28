import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getStaffAssignment,
  createStaffAssignment,
  updateStaffAssignment,
} from '@/lib/firestore/staff-assignments';
import { updateStaffAssignmentSchema } from '@/lib/validators/staff-assignment';
import { writeAuditLog } from '@/lib/firestore/audit';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authResult = await requirePermission(request, 'cases:read');
    if (isErrorResponse(authResult)) return authResult;

    const assignment = await getStaffAssignment(params.id);
    return NextResponse.json({ assignment });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get staff assignment error:', error);
    return NextResponse.json(
      { error: 'Không thể tải phân công: ' + message },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authResult = await requirePermission(request, 'cases:write');
    if (isErrorResponse(authResult)) return authResult;
    const user = authResult.user;

    const body = await request.json();
    const data = updateStaffAssignmentSchema.parse(body);

    const existing = await getStaffAssignment(params.id);

    if (existing) {
      await updateStaffAssignment(existing.id, data, user.uid);
    } else {
      await createStaffAssignment(params.id, data, user.uid);
    }

    await writeAuditLog({
      actorId: user.uid,
      actorName: user.displayName,
      actorRole: user.role,
      action: 'staff_assignment_changed',
      entityType: 'case',
      entityId: params.id,
      before: existing ? { ...existing, id: undefined, caseId: undefined } : undefined,
      after: data,
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
    console.error('Update staff assignment error:', error);
    return NextResponse.json(
      { error: 'Không thể cập nhật phân công: ' + message },
      { status: 500 },
    );
  }
}