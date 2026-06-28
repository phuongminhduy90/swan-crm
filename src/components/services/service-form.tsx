'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Service } from '@/lib/types';
import { createServiceSchema, type CreateServiceFormValues } from '@/lib/validators/service';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ALL_SERVICE_CATEGORIES, SERVICE_CATEGORY_LABELS } from '@/constants/service-categories';

interface Props {
  service?: Service;
  onSubmit: (data: CreateServiceFormValues) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
}

export function ServiceForm({ service, onSubmit, onCancel, loading = false, error = null }: Props) {
  const isEdit = !!service;

  const {
    register, handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateServiceFormValues>({
    resolver: zodResolver(createServiceSchema),
    defaultValues: {
      name: service?.name ?? '',
      category: service?.category ?? 'other',
      defaultPrice: service?.defaultPrice,
      description: service?.description ?? '',
    },
  });

  useEffect(() => {
    if (service) {
      reset({
        name: service.name,
        category: service.category,
        defaultPrice: service.defaultPrice,
        description: service.description ?? '',
      });
    }
  }, [service, reset]);

  const onFormSubmit = handleSubmit(async (data) => {
    await onSubmit(data);
  });

  return (
    <form onSubmit={onFormSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <Input label="Tên dịch vụ *" error={errors.name?.message} {...register('name')} placeholder="Nhập tên dịch vụ..." />

      <Select label="Nhóm *" error={errors.category?.message} {...register('category')}>
        {ALL_SERVICE_CATEGORIES.map((c) => (
          <option key={c} value={c}>{SERVICE_CATEGORY_LABELS[c]}</option>
        ))}
      </Select>

      <Input
        label="Giá mặc định (VNĐ)"
        type="number"
        min={0}
        step={1000}
        placeholder="0"
        error={errors.defaultPrice?.message}
        {...register('defaultPrice', { valueAsNumber: true })}
      />

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Mô tả</label>
        <textarea
          {...register('description')}
          rows={3}
          placeholder="Mô tả dịch vụ..."
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm placeholder-gray-400 focus:border-swan-500 focus:outline-none focus:ring-2 focus:ring-swan-500/20"
        />
        {errors.description?.message && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Hủy</Button>
        <Button type="submit" isLoading={loading}>
          {isEdit ? 'Cập nhật' : 'Tạo dịch vụ'}
        </Button>
      </div>
    </form>
  );
}