'use client';

import { useAuth } from '@/lib/auth/AuthProvider';

export function useCurrentUser() {
  const { userProfile, loading, error, firebaseUser } = useAuth();
  return { user: userProfile, loading, error, firebaseUser };
}