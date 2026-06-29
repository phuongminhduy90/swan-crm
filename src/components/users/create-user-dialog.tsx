'use client';

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils/cn';
import { ALL_ROLES, ROLE_LABELS } from '@/config/roles';
import type { UserRole } from '@/lib/types';

const createUserSchema = z.object({
  displayName: z.string().min(2, 'Tên phải có ít nhất 2 ký tự'),
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự'),
  role: z.string().min(1, 'Vui lòng chọn vai trò'),
  phone: z.string().optional(),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

interface CreateUserDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function CreateUserDialog({ open, onClose, onCreated }: CreateUserDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      role: '',
      phone: '',
    },
  });

  const onSubmit = useCallback(
    async (data: CreateUserForm) => {
      setError(null);
      setSuccess(false);
      try {
        const res = await fetch('/api/users/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            role: data.role as UserRole,
          }),
        });

        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error || 'Tạo người dùng thất bại');
        }

        setSuccess(true);
        reset();
        setTimeout(() => {
          onCreated?.();
          onClose();
          setSuccess(false);
        }, 1000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Lỗi không xác định');
      }
    },
    [reset, onCreated, onClose],
  );

  function handleClose() {
    reset();
    setError(null);
    setSuccess(false);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-swan-100">
              <UserPlus className="h-5 w-5 text-swan-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Tạo người dùng mới</h3>
              <p className="text-sm text-gray-500">Nhập thông tin người dùng</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            Tạo người dùng thành công!
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Họ và tên"
            placeholder="Nguyễn Văn A"
            error={errors.displayName?.message}
            {...register('displayName')}
          />

          <Input
            label="Email"
            type="email"
            placeholder="email@swanclinic.vn"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="Mật khẩu"
            type="password"
            placeholder="••••••••"
            hint="Tối thiểu 8 ký tự"
            error={errors.password?.message}
            {...register('password')}
          />

          <Select label="Vai trò" error={errors.role?.message} {...register('role')}>
            <option value="">Chọn vai trò</option>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>

          <Input
            label="Số điện thoại (tùy chọn)"
            placeholder="0901 234 567"
            error={errors.phone?.message}
            {...register('phone')}
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" type="button" onClick={handleClose}>
              Hủy
            </Button>
            <Button type="submit" isLoading={isSubmitting} leftIcon={<UserPlus className="h-4 w-4" />}>
              Tạo người dùng
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}