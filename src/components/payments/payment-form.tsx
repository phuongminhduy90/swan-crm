'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createPaymentSchema, CreatePaymentFormValues } from '@/lib/validators/payment';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface Props {
  caseId: string;
  customerId: string;
  onSubmit: (data: CreatePaymentFormValues) => Promise<void>;
  onClose: () => void;
}

export function PaymentForm({ caseId, customerId, onSubmit, onClose }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreatePaymentFormValues>({
    resolver: zodResolver(createPaymentSchema),
    defaultValues: {
      caseId,
      customerId,
      paymentMethod: 'cash',
      paymentType: 'deposit',
      paymentDate: new Date().toISOString().slice(0, 10),
    },
  });

  const doSubmit = handleSubmit(async (data) => {
    await onSubmit(data);
  });

  return (
    <form onSubmit={doSubmit} className="space-y-4 p-6">
      {/* Hidden fields */}
      <input type="hidden" {...register('caseId')} />
      <input type="hidden" {...register('customerId')} />

      {/* Amount */}
      <Input
        label="Số tiền (VNĐ) *"
        type="number"
        min={1}
        step={1000}
        placeholder="Ví dụ: 5000000"
        error={errors.amount?.message}
        {...register('amount', { valueAsNumber: true })}
      />

      <div className="grid grid-cols-2 gap-4">
        {/* Payment Type */}
        <Select
          label="Loại thanh toán *"
          error={errors.paymentType?.message}
          {...register('paymentType')}
        >
          <option value="deposit">Đặt cọc</option>
          <option value="partial">Thanh toán thêm</option>
          <option value="full">Thanh toán đủ</option>
          <option value="refund">Hoàn tiền</option>
        </Select>

        {/* Payment Method */}
        <Select
          label="Hình thức *"
          error={errors.paymentMethod?.message}
          {...register('paymentMethod')}
        >
          <option value="cash">Tiền mặt</option>
          <option value="bank_transfer">Chuyển khoản</option>
          <option value="card">Thẻ</option>
          <option value="installment">Trả góp</option>
          <option value="other">Khác</option>
        </Select>
      </div>

      {/* Payment Date */}
      <Input
        label="Ngày thanh toán *"
        type="date"
        error={errors.paymentDate?.message}
        {...register('paymentDate')}
      />

      {/* Note */}
      <div className="w-full">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Ghi chú</label>
        <textarea
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-swan-500 focus:outline-none focus:ring-2 focus:ring-swan-500/20"
          rows={3}
          placeholder="Ghi chú thêm về giao dịch..."
          {...register('note')}
        />
        {errors.note?.message && (
          <p className="mt-1 text-xs text-red-600">{errors.note.message}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Hủy
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          Gửi yêu cầu thanh toán
        </Button>
      </div>
    </form>
  );
}
