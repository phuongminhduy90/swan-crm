'use client';

import { CaseRecord } from '@/lib/types';
import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface BillSummaryProps {
  caseRecord: CaseRecord;
  compact?: boolean;
}

export function BillSummary({ caseRecord, compact = false }: BillSummaryProps) {
  const {
    totalBillBeforeDiscount,
    discountType,
    discountValue,
    discountReason,
    totalBillAfterDiscount,
    amountPaid,
    remainingAmount,
    paymentStatus,
  } = caseRecord;

  const hasDiscount =
    discountType && discountType !== 'none' && discountValue && discountValue > 0;

  const discountLabel =
    discountType === 'percent'
      ? `Giảm ${discountValue}%`
      : discountType === 'fixed'
        ? `Giảm ${formatCurrency(discountValue)}`
        : discountType === 'gift'
          ? 'Tặng thêm'
          : '';

  const paymentStatusColors: Record<string, string> = {
    unpaid: 'bg-red-100 text-red-700',
    deposit: 'bg-amber-100 text-amber-700',
    partial: 'bg-blue-100 text-blue-700',
    paid: 'bg-emerald-100 text-emerald-700',
    refunded: 'bg-purple-100 text-purple-700',
  };

  const paymentStatusLabels: Record<string, string> = {
    unpaid: 'Chưa thu',
    deposit: 'Đã cọc',
    partial: 'Thanh toán một phần',
    paid: 'Đã thanh toán đủ',
    refunded: 'Đã hoàn tiền',
  };

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-semibold text-gray-900">
          {formatCurrency(totalBillAfterDiscount)}
        </span>
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', paymentStatusColors[paymentStatus])}>
          {paymentStatusLabels[paymentStatus]}
        </span>
        {remainingAmount > 0 && (
          <span className="text-xs text-red-600">
            Còn: {formatCurrency(remainingAmount)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-2.5">
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Tổng dịch vụ</span>
        <span className="font-medium text-gray-900">{formatCurrency(totalBillBeforeDiscount)}</span>
      </div>

      {hasDiscount && (
        <div className="flex justify-between text-sm">
          <span className="text-emerald-600">{discountLabel}</span>
          <span className="font-medium text-emerald-600">
            {discountType === 'percent'
              ? `-${formatCurrency(totalBillBeforeDiscount - totalBillAfterDiscount)}`
              : `-${formatCurrency(discountValue!)}`}
          </span>
        </div>
      )}

      {discountReason && (
        <p className="text-xs text-gray-400">Lý do: {discountReason}</p>
      )}

      <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
        <span className="font-semibold text-gray-700">Tổng bill</span>
        <span className="font-bold text-gray-900">{formatCurrency(totalBillAfterDiscount)}</span>
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Đã thu</span>
        <span className="font-medium text-emerald-600">{formatCurrency(amountPaid)}</span>
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Còn lại</span>
        <span className={cn('font-semibold', remainingAmount > 0 ? 'text-red-600' : 'text-gray-400')}>
          {formatCurrency(remainingAmount)}
        </span>
      </div>

      <div className="pt-1">
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', paymentStatusColors[paymentStatus])}>
          {paymentStatusLabels[paymentStatus]}
        </span>
      </div>
    </div>
  );
}
