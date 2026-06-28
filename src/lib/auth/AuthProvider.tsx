'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useMemo,
} from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { onAuthChange } from '@/lib/firebase/auth';
import { getUser, createUser } from '@/lib/firestore/users';
import { User, UserRole } from '@/lib/types';
import { isDevMode } from '@/config/firebase';
import { MOCK_USERS } from './mock-users';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  error: string | null;
  isDevMode: boolean;
  setDevRole: (role: UserRole) => void;
  devRole: UserRole;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  userProfile: null,
  loading: true,
  error: null,
  isDevMode: false,
  setDevRole: () => {},
  devRole: 'admin',
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [devRole, setDevRole] = useState<UserRole>('admin');

  useEffect(() => {
    if (isDevMode) {
      // Dev mode: use mock user, skip Firebase
      setUserProfile(MOCK_USERS[devRole]);
      setFirebaseUser(null);
      setLoading(false);
      return;
    }

    try {
      const unsubscribe = onAuthChange(async (user) => {
        setFirebaseUser(user);
        if (user) {
          try {
            let profile = await getUser(user.uid);

            // ── Auto-create profile nếu chưa tồn tại ──────────────────
            if (!profile) {
              const defaultRole = guessRoleFromEmail(user.email ?? '');
              const now = new Date().toISOString();
              const newUser: User = {
                id: user.uid,
                email: user.email ?? '',
                displayName: user.displayName ?? user.email?.split('@')[0] ?? 'User',
                role: defaultRole,
                isActive: true,
                createdAt: now,
                updatedAt: now,
              };
              await createUser(newUser);
              profile = newUser;
              console.info(`[AuthProvider] Đã tạo profile mới cho ${user.email} với role "${defaultRole}"`);
            }
            // ──────────────────────────────────────────────────────────

            setUserProfile(profile);
            setError(null);
          } catch (err) {
            console.error('Failed to load user profile:', err);
            setError('Không thể tải thông tin người dùng');
          }
        } else {
          setUserProfile(null);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (err) {
      // FIX: Production Firebase error — do NOT fall back to mock user
      // Log and show error instead of silently authenticating as admin
      console.error('Firebase auth initialization failed:', err);
      setError('Không thể kết nối xác thực. Vui lòng tải lại trang.');
      setLoading(false);
    }
  }, [devRole]);

  // Update dev profile when role changes (dev mode only)
  useEffect(() => {
    if (isDevMode) {
      setUserProfile(MOCK_USERS[devRole]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devRole]);

  const value = useMemo(
    () => ({
      firebaseUser,
      userProfile,
      loading,
      error,
      isDevMode,
      setDevRole,
      devRole,
    }),
    [firebaseUser, userProfile, loading, error, devRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

// ── Hàm đoán role dựa theo email ──────────────────────────────────────────────
// Nếu email khớp pattern đã biết → gán role tương ứng
// Mặc định → admin (có thể thay đổi trong Settings sau khi login)
function guessRoleFromEmail(email: string): UserRole {
  const e = email.toLowerCase();
  if (e.includes('ceo'))         return 'ceo';
  if (e.includes('cso'))         return 'cso';
  if (e.includes('doctor') || e.includes('bs.') || e.includes('bsngoc')) return 'doctor';
  if (e.includes('nurse') || e.includes('dieu duong'))  return 'nurse';
  if (e.includes('accountant') || e.includes('ketoan')) return 'accountant';
  if (e.includes('coordinator') || e.includes('coordin')) return 'coordinator';
  if (e.includes('cskh') || e.includes('postop'))       return 'cskh_postop';
  if (e.includes('media'))       return 'media';
  if (e.includes('online'))      return 'sales_online';
  if (e.includes('offline'))     return 'sales_offline';
  if (e.includes('sales') || e.includes('master')) return 'master_sales';
  return 'admin'; // mặc định → admin, có thể chỉnh trong Settings
}