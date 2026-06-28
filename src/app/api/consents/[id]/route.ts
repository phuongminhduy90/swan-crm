import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { updateConsentStatus } from '@/lib/firestore/consents';
import { updateConsentStatusSchema } from '@/lib/validators/consent';
import { writeAuditLog } from '@/lib/firestore/audit';
import { getAllDocuments } from '@/lib/firebase/firestore';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authResult = await requirePermission(request, 'consents:write');
    if (isErrorResponse(authResult)) return authResult;
    const user = authResult.user;

    const body = await request.json();
    const data = updateConsentStatusSchema.parse(body);

    // Find existing consent for audit before/after
    const existing = await getAllDocuments<Record<string, unknown>>('consents', [
      { field: 'id', operator: '==', value: params.id },
    ]);
    const prev = existing[0];

    await updateConsentStatus(params.id, data.status, data.signedBy);

    await writeAuditLog({
      actorId: user.uid,
      actorName: user.displayName,
      actorRole: user.role,
      action: 'consent_updated',
      entityType: 'consent',
      entityId: params.id,
      before: prev ? { consentStatus: prev.consentStatus } : undefined,
      after: { consentStatus: data.status, signedBy: data.signedBy },
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
    console.error('Update consent error:', error);
    return NextResponse.json(
      { error: 'Không thể cập nhật consent: ' + message },
      { status: 500 },
    );
  }
}
