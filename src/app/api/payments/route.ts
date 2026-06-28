import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAllPayments, createPayment, getPaymentsByCase } from '@/lib/firestore/payments';
import { createPaymentSchema } from '@/lib/validators/payment';
import { triggerPaymentPendingNotification } from '@/lib/notifications/trigger';
import { getCase } from '@/lib/firestore/cases';
import { getCustomer } from '@/lib/firestore/customers';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(request, 'payments:read');
    if (isErrorResponse(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');

    const payments = caseId ? await getPaymentsByCase(caseId) : await getAllPayments();
    return NextResponse.json({ payments });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get payments error:', error);
    return NextResponse.json(
      { error: 'Không thể tải danh sách thanh toán: ' + message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermission(request, 'payments:write');
    if (isErrorResponse(authResult)) return authResult;
    const user = authResult.user;

    const body = await request.json();
    const data = createPaymentSchema.parse(body);

    const payment = await createPayment(data, user.uid);

    // Fire-and-forget: trigger payment pending notification
    try {
      const [caseRecord, customer] = await Promise.all([
        getCase(data.caseId),
        getCustomer(data.customerId),
      ]);
      if (caseRecord && customer) {
        triggerPaymentPendingNotification(payment, caseRecord, customer, user.displayName);
      }
    } catch {
      // ignore
    }

    return NextResponse.json({ success: true, payment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message ?? 'Dữ liệu không hợp lệ' },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create payment error:', error);
    return NextResponse.json(
      { error: 'Không thể tạo thanh toán: ' + message },
      { status: 500 },
    );
  }
}