import { NextRequest, NextResponse } from 'next/server';
import { getPayment } from '@/lib/firestore/payments';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authResult = await requirePermission(request, 'payments:read');
    if (isErrorResponse(authResult)) return authResult;

    const payment = await getPayment(params.id);
    if (!payment) {
      return NextResponse.json(
        { error: 'Không tìm thấy thanh toán' },
        { status: 404 },
      );
    }
    return NextResponse.json({ payment });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get payment error:', error);
    return NextResponse.json(
      { error: 'Không thể tải thanh toán: ' + message },
      { status: 500 },
    );
  }
}