import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAllCases, createCase } from '@/lib/firestore/cases';
import { createCaseSchema } from '@/lib/validators/case';
import { triggerNewCaseNotification } from '@/lib/notifications/trigger';
import { getAllUsers } from '@/lib/firestore/users';
import { getCustomer } from '@/lib/firestore/customers';
import { getAllTreatmentLocations } from '@/lib/firestore/treatment-locations';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

export async function GET(request: NextRequest) {
  const authResult = await requirePermission(request, 'cases:read');
  if (isErrorResponse(authResult)) return authResult;

  try {
    const cases = await getAllCases();
    return NextResponse.json({ cases });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get cases error:', error);
    return NextResponse.json(
      { error: 'Không thể tải danh sách hồ sơ: ' + message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requirePermission(request, 'cases:write');
  if (isErrorResponse(authResult)) return authResult;
  const user = authResult.user;

  try {
    const body = await request.json();
    const data = createCaseSchema.parse(body);

    const newCase = await createCase(data, user.uid);

    // Fire-and-forget notification
    try {
      const customer = await getCustomer(newCase.customerId);
      if (customer) {
        const [users, locations] = await Promise.all([getAllUsers(), getAllTreatmentLocations()]);
        const locationName = locations.find((l) => l.id === newCase.treatmentLocationId)?.name;
        const staffNames: Record<string, string> = {};
        const masterSales = users.find((u) => u.id === newCase.createdBy);
        if (masterSales) staffNames.masterSales = masterSales.displayName;
        triggerNewCaseNotification(newCase, customer, staffNames, locationName);
      }
    } catch (err) {
      console.error('[cases POST] notification trigger failed:', err);
    }

    return NextResponse.json({ success: true, case: newCase });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message ?? 'Dữ liệu không hợp lệ' },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create case error:', error);
    return NextResponse.json(
      { error: 'Không thể tạo hồ sơ: ' + message },
      { status: 500 },
    );
  }
}
