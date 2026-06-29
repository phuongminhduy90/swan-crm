'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TreatmentLocation } from '@/lib/types';
import {
  createTreatmentLocationSchema,
  type CreateTreatmentLocationFormValues,
  ALL_LOCATION_TYPES,
  LOCATION_TYPE_LABELS,
} from '@/lib/validators/treatment-location';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface Props {
  location?: TreatmentLocation;
  onSubmit: (data: CreateTreatmentLocationFormValues) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
}

export function LocationForm({ location, onSubmit, onCancel, loading = false, error = null }: Props) {
  const isEdit = !!location;

  const {
    register, handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateTreatmentLocationFormValues>({
    resolver: zodResolver(createTreatmentLocationSchema),
    defaultValues: {
      name: location?.name ?? '',
      type: location?.type ?? 'swan',
      address: location?.address ?? '',
      contactPerson: location?.contactPerson ?? '',
      contactPhone: location?.contactPhone ?? '',
      note: location?.note ?? '',
    },
  });

  useEffect(() => {
    if (location) {
      reset({
        name: location.name,
        type: location.type,
        address: location.address ?? '',
        contactPerson: location.contactPerson ?? '',
        contactPhone: location.contactPhone ?? '',
        note: location.note ?? '',
      });
    }
  }, [location, reset]);

  const onFormSubmit = handleSubmit(async (data) => {
    await onSubmit(data);
  });

  return (
    <form onSubmit={onFormSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <Input label="Tên địa điểm *" error={errors.name?.message} {...register('name')} placeholder="Nhập tên địa điểm..." />

      <Select label="Loại *" error={errors.type?.message} {...register('type')}>
        {ALL_LOCATION_TYPES.map((t) => (
          <option key={t} value={t}>{LOCATION_TYPE_LABELS[t]}</option>
        ))}
      </Select>

      <Input label="Địa chỉ" error={errors.address?.message} {...register('address')} placeholder="Địa chỉ..." />

      <div className="grid grid-cols-2 gap-4">
        <Input label="Người liên hệ" error={errors.contactPerson?.message} {...register('contactPerson')} placeholder="Tên người liên hệ..." />
        <Input label="Số điện thoại" error={errors.contactPhone?.message} {...register('contactPhone')} placeholder="0901 234 567" />
      </div>

      <Textarea
        label="Ghi chú"
        placeholder="Ghi chú về địa điểm..."
        error={errors.note?.message}
        {...register('note')}
      />

      <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Hủy</Button>
        <Button type="submit" isLoading={loading}>
          {isEdit ? 'Cập nhật' : 'Tạo địa điểm'}
        </Button>
      </div>
    </form>
  );
}
