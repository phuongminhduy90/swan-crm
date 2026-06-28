'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Lock } from 'lucide-react';
import { signIn } from '@/lib/firebase/auth';
import { loginSchema, type LoginInput } from '@/lib/utils/validation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function LoginForm() {
  const router = useRouter();
  const { isDevMode } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput) {
    setError(null);
    try {
      await signIn(data.email, data.password);
      router.push('/dashboard');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Đăng nhập thất bại. Vui lòng thử lại.';
      if (message.includes('auth/invalid-credential') || message.includes('wrong-password')) {
        setError('Email hoặc mật khẩu không đúng');
      } else if (message.includes('auth/user-not-found')) {
        setError('Không tìm thấy tài khoản với email này');
      } else {
        setError('Đăng nhập thất bại. Vui lòng thử lại.');
      }
    }
  }

  return (
    <div className="card">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {isDevMode && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <strong>Dev Mode:</strong> Firebase chưa được cấu hình. Đăng nhập demo sẽ được xử lý
            tự động.
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Input
          label="Email"
          type="email"
          placeholder="email@swanclinic.vn"
          leftIcon={<Mail className="h-4 w-4" />}
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Mật khẩu"
          type="password"
          placeholder="••••••••"
          leftIcon={<Lock className="h-4 w-4" />}
          error={errors.password?.message}
          {...register('password')}
        />

        <Button
          type="submit"
          isLoading={isSubmitting}
          className="w-full"
          size="lg"
        >
          Đăng nhập
        </Button>
      </form>
    </div>
  );
}