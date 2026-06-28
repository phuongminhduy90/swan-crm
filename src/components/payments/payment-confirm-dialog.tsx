'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Payment } from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDateVN } from '@/lib/utils/format';

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  deposit: 'Đặt cọc',
  partial: 'Thanh toán thêm',
  full: 'Thanh toán đủ',
  refund: 'Hoàn tiền',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  card: 'Thẻ',
  installment: 'Trả góp',
  other: 'Khác',
};

interface Props {
  payment: Payment;
  onConfirm: (note?: string) => Promise<void>;
  onReject: (note: string) => Promise<void>;
  onClose: () => void;
}

export function PaymentConfirmDialog({ payment, onConfirm, onReject, onClose }: Props) {
  const [action, setAction] = useState<'idle' | 'confirm' | 'reject'>('idle');
  const [rejectNote, setRejectNote] = useState('');
  const [confirmNote, setConfirmNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [rejectError, setRejectError] = useState('');

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(confirmNote || undefined);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectNote.trim()) {
      setRejectError('Vui lòng nhập lý do từ chối');
      return;
    }
    setLoading(true);
    try {
      await onReject(rejectNote.trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Xử lý yêu cầu thanh toán"
      description="Xem xét và xác nhận hoặc từ chối giao dịch thanh toán"
      size="md"
    >
      <div className="p-6 space-y-6">
        {/* Payment Summary */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Mã CA</span>
            <span className="text-sm font-medium text-gray-800">{payment.caseId}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Số tiền</span>
            <span className="text-lg font-bold text-swan-700">{formatCurrency(payment.amount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Loại</span>
            <span className="text-sm font-medium">{PAYMENT_TYPE_LABELS[payment.paymentType] ?? payment.paymentType}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Hình thức</span>
            <span className="text-sm">{PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Ngày thanh toán</span>
            <span className="text-sm">{formatDateVN(payment.paymentDate)}</span>
          </div>
          {payment.note && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">{payment.note}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {action === 'idle' && (
          <div className="flex gap-3">
            <button
              onClick={() => setAction('reject')}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-red-200 bg-red-50 py-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
            >
              <XCircle className="h-4 w-4" />
              Từ chối
            </button>
            <button
              onClick={() => setAction('confirm')}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 py-3 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <CheckCircle className="h-4 w-4" />
              Xác nhận thu
            </button>
          </div>
        )}

        {/* Confirm Panel */}
        {action === 'confirm' && (
          <div className="space-y-4">
            <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-medium text-emerald-800">
                Xác nhận thu {formatCurrency(payment.amount)}?
              </p>
              <p className="text-xs text-emerald-600 mt-1">Thao tác này sẽ cập nhật số tiền đã thanh toán của CA.</p>
            </div>
            <div className="w-full">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Ghi chú (tùy chọn)</label>
              <textarea
                value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)}
                rows={2}
                placeholder="Thêm ghi chú về xác nhận này..."
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-swan-500 focus:outline-none focus:ring-2 focus:ring-swan-500/20"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setAction('idle')} disabled={loading} className="flex-1">
                Quay lại
              </Button>
              <Button
                onClick={handleConfirm}
                isLoading={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle className="h-4 w-4" />
                Xác nhận thu
              </Button>
            </div>
          </div>
        )}

        {/* Reject Panel */}
        {action === 'reject' && (
          <div className="space-y-4">
            <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">Từ chối giao dịch này?</p>
              <p className="text-xs text-red-600 mt-1">Vui lòng nhập lý do từ chối.</p>
            </div>
            <div className="w-full">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Lý do từ chối <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectNote}
                onChange={(e) => {
                  setRejectNote(e.target.value);
                  setRejectError('');
                }}
                rows={3}
                placeholder="Nhập lý do từ chối thanh toán..."
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
              {rejectError && <p className="mt-1 text-xs text-red-600">{rejectError}</p>}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setAction('idle')} disabled={loading} className="flex-1">
                Quay lại
              </Button>
              <Button
                variant="danger"
                onClick={handleReject}
                isLoading={loading}
                className="flex-1"
              >
                <XCircle className="h-4 w-4" />
                Xác nhận từ chối
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
