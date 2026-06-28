'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { AppShell } from '@/components/layout/app-shell';
import { Loader2 } from 'lucide-react';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const { userProfile, loading, isDevMode } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Chỉ redirect khi đã load xong và không có userProfile
    // Dev mode không redirect (luôn có mock user)
    if (!loading && !userProfile && !isDevMode) {
      router.replace('/login');
    }
  }, [loading, userProfile, isDevMode, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-swan-500" />
          <p className="text-sm text-gray-500">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    // Đang chờ redirect từ useEffect bên trên
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-swan-500" />
          <p className="text-sm text-gray-500">Đang chuyển hướng đến trang đăng nhập...</p>
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}