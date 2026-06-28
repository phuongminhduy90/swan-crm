import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/login-form';
import { SwanLogo } from '@/components/ui/swan-logo';

export const metadata: Metadata = {
  title: 'Đăng nhập — CRM SWAN',
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-swan-50 via-white to-cream px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <SwanLogo className="mx-auto h-16 w-auto" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">CRM SWAN</h1>
          <p className="mt-1 text-sm text-gray-500">Đăng nhập vào hệ thống quản lý</p>
        </div>
        <LoginForm />
        <p className="text-center text-xs text-gray-400">
          © 2025 Swan Clinic. Bảo mật thông tin khách hàng.
        </p>
      </div>
    </div>
  );
}