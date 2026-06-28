import { NextRequest, NextResponse } from 'next/server';
import {
  updateCaseService,
  removeCaseService,
  getCaseServices,
  getCase,
  updateCase,
} from '@/lib/firestore/cases';
import { addCaseServiceSchema } from '@/lib/validators/case';
import { z } from 'zod';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; serviceId: string } },
) {
  try {
    const authResult = await requirePermission(request, 'cases:write');
    if (isErrorResponse(authResult)) return authResult;

    const body = await request.json();
    const data = addCaseServiceSchema.partial().parse(body);

    await updateCaseService(params.serviceId, data);

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
    console.error('Update case service error:', error);
    return NextResponse.json(
      { error: 'Không thể cập nhật dịch vụ: ' + message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; serviceId: string } },
) {
  try {
    const authResult = await requirePermission(request, 'cases:write');
    if (isErrorResponse(authResult)) return authResult;
    const user = authResult.user;

    await removeCaseService(params.serviceId);

    // Recalculate bill totals
    const caseRecord = await getCase(params.id);
    if (caseRecord) {
      const allServices = await getCaseServices(params.id);
      const active = allServices.filter((s) => s.active !== false);
      const subtotal = active.reduce((sum, s) => sum + s.finalPrice * s.quantity, 0);
      const discount = caseRecord.discountType === 'percent' && caseRecord.discountValue
        ? subtotal * (caseRecord.discountValue / 100)
        : caseRecord.discountType === 'fixed' && caseRecord.discountValue
          ? caseRecord.discountValue
          : 0;
      const totalAfter = Math.max(0, subtotal - discount);
      const remaining = Math.max(0, totalAfter - caseRecord.amountPaid);

      await updateCase(params.id, {
        totalBillBeforeDiscount: subtotal,
        totalBillAfterDiscount: totalAfter,
        remainingAmount: remaining,
      }, user.uid);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Remove case service error:', error);
    return NextResponse.json(
      { error: 'Không thể xóa dịch vụ: ' + message },
      { status: 500 },
    );
  }
}