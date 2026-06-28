export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getNotificationsForUser, getAllNotifications } from '@/lib/firestore/notifications';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';


export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(request, 'notifications:read');
    if (isErrorResponse(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const notifications = userId
      ? await getNotificationsForUser(userId)
      : await getAllNotifications();

    const currentUserId = userId ?? '';
    const unreadCount = notifications.filter(
      (n) => !n.readBy?.includes(currentUserId),
    ).length;

    return NextResponse.json({ success: true, notifications, unreadCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get notifications error:', error);
    return NextResponse.json(
      { error: 'Không thể tải thông báo: ' + message },
      { status: 500 },
    );
  }
}
