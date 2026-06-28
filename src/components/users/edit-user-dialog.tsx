'use client';

import { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ALL_ROLES, ROLE_LABELS } from '@/config/roles';
import type { User, UserRole } from '@/lib/types';

const editUserSchema = z.object({
  displayName: z.string().min(2, 'Tên phải có ít nhất 2 ký tự'),
  role: z.string().min(1, 'Vui lòng chọn vai trò'),
  phone: z.string().optional(),
});

type EditUserForm = z.infer<typeof editUserSchema>;

interface EditUserDialogProps {
  user: User;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function EditUserDialog({ user, open, onClose, onUpdated }: EditUserDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      displayName: user.displayName,
      role: user.role,
      phone: user.phone ?? '',
    },
  });

  // Reset form when user changes
  useEffect(() => {
    if (open) {
      reset({
        displayName: user.displayName,
        role: user.role,
        phone: user.phone ?? '',
      });
      setError(null);
      setSuccess(false);
    }
  }, [open, user, reset]);

  const onSubmit = useCallback(
    async (data: EditUserForm) => {
      setError(null);
      setSuccess(false);
      try {
        const res = await fetch(`/api/users/${user.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: data.displayName,
            role: data.role as UserRole,
            phone: data.phone || undefined,
          }),
        });

        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error || 'Cập nhật thất bại');
        }

        setSuccess(true);
        setTimeout(() => {
          onUpdated?.();
          onClose();
          setSuccess(false);
        }, 800);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Lỗi không xác định');
      }
    },
    [user.id, onUpdated, onClose],
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-champagne-400/20">
              <Pencil className="h-5 w-5 text-champagne-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Chỉnh sửa người dùng</h3>
              <p className="text-sm text-gray-500">{user.email}</p>
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
            Cập nhật thành công!
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Họ và tên"
            placeholder="Nguyễn Văn A"
            error={errors.displayName?.message}
            {...register('displayName')}
          />

          <Select label="Vai trò" error={errors.role?.message} {...register('role')}>
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
            <Button type="submit" isLoading={isSubmitting} leftIcon={<Pencil className="h-4 w-4" />}>
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}