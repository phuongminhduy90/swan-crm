import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createConsent, getConsentsByCustomer, getConsentsByCase } from '@/lib/firestore/consents';
import { createConsentSchema } from '@/lib/validators/consent';
import { writeAuditLog } from '@/lib/firestore/audit';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(request, 'consents:read');
    if (isErrorResponse(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const caseId = searchParams.get('caseId');

    let consents;
    if (caseId) {
      consents = await getConsentsByCase(caseId);
    } else if (customerId) {
      consents = await getConsentsByCustomer(customerId);
    } else {
      return NextResponse.json(
        { error: 'Cần chỉ định customerId hoặc caseId' },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, consents });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get consents error:', error);
    return NextResponse.json(
      { error: 'Không thể tải danh sách consent: ' + message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermission(request, 'consents:write');
    if (isErrorResponse(authResult)) return authResult;
    const user = authResult.user;

    const body = await request.json();
    const data = createConsentSchema.parse(body);

    const consent = await createConsent({
      customerId: data.customerId,
      caseId: data.caseId || undefined,
      consentType: data.consentType,
      consentStatus: data.consentStatus,
      note: data.note,
    });

    await writeAuditLog({
      actorId: user.uid,
      actorName: user.displayName,
      actorRole: user.role,
      action: 'consent_updated',
      entityType: 'consent',
      entityId: consent.id,
      after: { consentType: data.consentType, consentStatus: data.consentStatus },
    });

    return NextResponse.json({ success: true, result: consent });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message ?? 'Dữ liệu không hợp lệ' },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create consent error:', error);
    return NextResponse.json(
      { error: 'Không thể tạo consent: ' + message },
      { status: 500 },
    );
  }
}
