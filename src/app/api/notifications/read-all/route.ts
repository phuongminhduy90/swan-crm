import { NextRequest, NextResponse } from 'next/server';
import { getNotificationsForUser, markNotificationRead } from '@/lib/firestore/notifications';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

export async function PATCH(request: NextRequest) {
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

    const notifications = await getNotificationsForUser(userId);
    const unread = notifications.filter((n) => !n.readBy?.includes(userId));

    await Promise.all(
      unread.map((n) => markNotificationRead(n.id, userId)),
    );

    return NextResponse.json({ success: true, count: unread.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Mark all read error:', error);
    return NextResponse.json(
      { error: 'Không thể đánh dấu đã đọc: ' + message },
      { status: 500 },
    );
  }
}
