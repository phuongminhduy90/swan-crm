'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const router = useRouter();
  const { userProfile, loading, isDevMode } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (userProfile || isDevMode) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [userProfile, loading, isDevMode, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-swan-500" />
        <p className="text-sm text-gray-500">Đang chuyển hướng...</p>
      </div>
    </div>
  );
}