export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAllAuditLogs } from '@/lib/firestore/audit';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(request, 'audit:read');
    if (isErrorResponse(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const action = searchParams.get('action');
    const actorSearch = searchParams.get('actorSearch');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)));

    let logs = await getAllAuditLogs();

    if (entityType) {
      logs = logs.filter((l) => l.entityType === entityType);
    }
    if (action) {
      logs = logs.filter((l) => l.action === action);
    }
    if (actorSearch) {
      const search = actorSearch.toLowerCase();
      logs = logs.filter(
        (l) =>
          l.actorName.toLowerCase().includes(search) ||
          l.actorRole.toLowerCase().includes(search),
      );
    }

    const total = logs.length;
    const start = (page - 1) * pageSize;
    const paginated = logs.slice(start, start + pageSize);

    return NextResponse.json({
      success: true,
      logs: paginated,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get audit logs error:', error);
    return NextResponse.json(
      { error: 'Không thể tải nhật ký hoạt động: ' + message },
      { status: 500 },
    );
  }
}
