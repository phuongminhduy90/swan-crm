import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCaseServices, addCaseService, getCase, updateCase } from '@/lib/firestore/cases';
import { addCaseServiceSchema } from '@/lib/validators/case';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authResult = await requirePermission(request, 'cases:read');
    if (isErrorResponse(authResult)) return authResult;

    const services = await getCaseServices(params.id);
    return NextResponse.json({ services });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get case services error:', error);
    return NextResponse.json(
      { error: 'Không thể tải danh sách dịch vụ: ' + message },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authResult = await requirePermission(request, 'cases:write');
    if (isErrorResponse(authResult)) return authResult;
    const user = authResult.user;

    const body = await request.json();
    const data = addCaseServiceSchema.parse(body);

    const caseRecord = await getCase(params.id);
    if (!caseRecord) {
      return NextResponse.json(
        { error: 'Không tìm thấy hồ sơ' },
        { status: 404 },
      );
    }

    const newService = await addCaseService({
      caseId: params.id,
      serviceName: data.serviceName,
      serviceCategory: data.serviceCategory,
      listedPrice: data.listedPrice,
      finalPrice: data.finalPrice,
      quantity: data.quantity,
      isMainService: data.isMainService,
      isGift: data.isGift,
      isUpsell: data.isUpsell,
      note: data.note,
    });

    // Recalculate bill totals
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

    return NextResponse.json({ success: true, service: newService });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message ?? 'Dữ liệu không hợp lệ' },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Add case service error:', error);
    return NextResponse.json(
      { error: 'Không thể thêm dịch vụ: ' + message },
      { status: 500 },
    );
  }
}