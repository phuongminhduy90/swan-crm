'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import {
  createCustomerSchema,
  CreateCustomerFormValues,
} from '@/lib/validators/customer';
import { Customer } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CustomerFormProps {
  initialData?: Partial<Customer>;
  onSubmit: (data: CreateCustomerFormValues) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function FormSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="border-b border-gray-100 pb-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-swan-600">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

export function CustomerForm({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
}: CustomerFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateCustomerFormValues>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      fullName: initialData?.fullName ?? '',
      phone: initialData?.phone ?? '',
      secondaryPhone: initialData?.secondaryPhone ?? '',
      dateOfBirth: initialData?.dateOfBirth ?? '',
      gender: initialData?.gender,
      source: initialData?.source,
      sourceDetail: initialData?.sourceDetail ?? '',
      privacyLevel: initialData?.privacyLevel ?? 'normal',
      zalo: initialData?.zalo ?? '',
      facebook: initialData?.facebook ?? '',
      address: initialData?.address ?? '',
      emergencyContactName: initialData?.emergencyContactName ?? '',
      emergencyContactPhone: initialData?.emergencyContactPhone ?? '',
      nationalIdNumber: initialData?.nationalIdNumber ?? '',
      nationalIdIssueDate: initialData?.nationalIdIssueDate ?? '',
      nationalIdIssuePlace: initialData?.nationalIdIssuePlace ?? '',

      medicalNote: initialData?.medicalNote ?? '',
      privacyNote: initialData?.privacyNote ?? '',
    },
  });

  const isBusy = isSubmitting || loading;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

      {/* ── 1. Thông tin cơ bản ─────────────────────────────────────────── */}
      <FormSection title="Thông tin cơ bản">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Họ tên *"
            placeholder="Nguyễn Thị Lan"
            error={errors.fullName?.message}
            {...register('fullName')}
          />
          <Input
            label="Số điện thoại *"
            placeholder="0901 234 567"
            type="tel"
            error={errors.phone?.message}
            {...register('phone')}
          />
          <Input
            label="Số điện thoại phụ"
            placeholder="0901 234 568"
            type="tel"
            error={errors.secondaryPhone?.message}
            {...register('secondaryPhone')}
          />
          <Input
            label="Ngày sinh"
            type="date"
            error={errors.dateOfBirth?.message}
            {...register('dateOfBirth')}
          />
          <Controller
            name="gender"
            control={control}
            render={({ field }) => (
              <Select
                label="Giới tính"
                error={errors.gender?.message}
                value={field.value ?? ''}
                onChange={field.onChange}
              >
                <option value="">— Chọn giới tính —</option>
                <option value="female">Nữ</option>
                <option value="male">Nam</option>
                <option value="other">Khác</option>
                <option value="unknown">Không rõ</option>
              </Select>
            )}
          />
          <Controller
            name="privacyLevel"
            control={control}
            render={({ field }) => (
              <Select
                label="Mức riêng tư"
                error={errors.privacyLevel?.message}
                value={field.value ?? 'normal'}
                onChange={field.onChange}
              >
                <option value="normal">Bình thường</option>
                <option value="vip">VIP</option>
                <option value="highly_sensitive">Nhạy cảm cao</option>
              </Select>
            )}
          />
        </div>
      </FormSection>

      {/* ── 2. Liên hệ & Mạng xã hội ───────────────────────────────────── */}
      <FormSection title="Liên hệ & Mạng xã hội">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Zalo"
            placeholder="Số Zalo hoặc link"
            error={errors.zalo?.message}
            {...register('zalo')}
          />
          <Input
            label="Facebook"
            placeholder="Link profile hoặc tên"
            error={errors.facebook?.message}
            {...register('facebook')}
          />
          <div className="sm:col-span-2">
            <Input
              label="Địa chỉ"
              placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
              error={errors.address?.message}
              {...register('address')}
            />
          </div>
        </div>
      </FormSection>

      {/* ── 3. Người liên hệ khẩn cấp ──────────────────────────────────── */}
      <FormSection title="Người liên hệ khẩn cấp">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Họ tên người liên hệ"
            placeholder="Nguyễn Văn A"
            error={errors.emergencyContactName?.message}
            {...register('emergencyContactName')}
          />
          <Input
            label="Số điện thoại khẩn cấp"
            placeholder="0901 234 567"
            type="tel"
            error={errors.emergencyContactPhone?.message}
            {...register('emergencyContactPhone')}
          />
        </div>
      </FormSection>

      {/* ── 4. Nguồn khách ──────────────────────────────────────────────── */}
      <FormSection title="Nguồn khách">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Controller
            name="source"
            control={control}
            render={({ field }) => (
              <Select
                label="Nguồn tiếp cận"
                error={errors.source?.message}
                value={field.value ?? ''}
                onChange={field.onChange}
              >
                <option value="">— Chọn nguồn —</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="walk_in">Đến trực tiếp</option>
                <option value="referral">Giới thiệu</option>
                <option value="koc">KOC/KOL</option>
                <option value="old_data">Dữ liệu cũ</option>
                <option value="other">Khác</option>
              </Select>
            )}
          />
          <Input
            label="Chi tiết nguồn"
            placeholder="VD: Facebook Ads, bạn bè giới thiệu..."
            error={errors.sourceDetail?.message}
            {...register('sourceDetail')}
          />
        </div>
      </FormSection>

      {/* ── 5. Ghi chú ──────────────────────────────────────────────────── */}
      <FormSection title="Ghi chú">
        <div className="space-y-4">
          <Textarea
            label="Ghi chú y tế"
            placeholder="Tiền sử bệnh, dị ứng, lưu ý y tế..."
            rows={3}
            error={errors.medicalNote?.message}
            {...register('medicalNote')}
          />
          <Textarea
            label="Ghi chú riêng tư"
            placeholder="Thông tin nhạy cảm, chỉ hiển thị cho phép..."
            rows={3}
            error={errors.privacyNote?.message}
            {...register('privacyNote')}
          />
        </div>
      </FormSection>

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isBusy}>
          Hủy
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={isBusy}
          leftIcon={isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
        >
          {isBusy ? 'Đang lưu...' : initialData?.id ? 'Cập nhật' : 'Thêm khách hàng'}
        </Button>
      </div>
    </form>
  );
}
