import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Only protect API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip auth check for /api/auth/* routes
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // Dev mode: không override header — giữ nguyên header từ client
  // auth.ts sẽ dùng x-dev-user-id từ client, hoặc fallback user-001 (admin)
  if (process.env.NEXT_PUBLIC_DEV_MODE === 'true') {
    return NextResponse.next();
  }

  // Production: check Authorization header
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Unauthorized — Missing or invalid authorization header' },
      { status: 401 }
    );
  }

  // Token verification will happen in route handlers using Firebase Admin SDK
  // Middleware just ensures the header is present
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
