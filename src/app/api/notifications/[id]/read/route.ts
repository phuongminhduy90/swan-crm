import { NextRequest, NextResponse } from 'next/server';
import { markNotificationRead } from '@/lib/firestore/notifications';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authResult = await requirePermission(request, 'notifications:write');
    if (isErrorResponse(authResult)) return authResult;
    const user = authResult.user;

    const body = await request.json();
    const userId = body.userId as string ?? user.uid;
    if (!userId) {
      return NextResponse.json(
        { error: 'Thiếu userId' },
        { status: 400 },
      );
    }

    await markNotificationRead(params.id, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Mark notification read error:', error);
    return NextResponse.json(
      { error: 'Không thể đánh dấu đã đọc: ' + message },
      { status: 500 },
    );
  }
}
