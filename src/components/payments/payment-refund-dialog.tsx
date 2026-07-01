'use client';

import { useState, useMemo } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { Payment } from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { formatCurrency, formatDateVN } from '@/lib/utils/format';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth/AuthProvider';
import { isFlagEnabled } from '@/lib/feature-flags';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  card: 'Thẻ',
  installment: 'Trả góp',
  other: 'Khác',
};

interface Props {
  payment: Payment;
  /**
   * Sum of existing confirmed refunds against this original payment, in VNĐ.
   * Computed by the parent (which has the full payment list already) so the
   * dialog stays stateless w.r.t. the data layer.
   */
  existingRefundTotal?: number;
  onClose: () => void;
  onRefunded: () => void;
}

/**
 * Story PI-2 (Sprint 7.2) — Refund creation dialog.
 *
 * Surfaces:
 * - Original payment summary (case id, amount, method, date, note)
 * - "Refundable remaining" computed from `original.amount - existingRefundTotal`
 * - Currency input (cap = refundable remaining; floor = 1)
 * - Refund payment method (defaults to original's method)
 * - Refund payment date (defaults to today)
 * - Optional note (appended to the audit-traceable `[refund-of:<id>]` marker)
 *
 * Submit → POST /api/payments/refund. Success toast uses the TD-2 extended
 * API (`pushToast({ title, description })`). Failure shows the server's
 * Vietnamese error message verbatim.
 *
 * The dialog is hidden entirely when `FEATURE_PAYMENT_TX` is OFF — the
 * parent `<PaymentList>` checks this before rendering the trigger button.
 * We still guard here in case someone passes the dialog an `open` directly.
 */
export function PaymentRefundDialog({
  payment,
  existingRefundTotal = 0,
  onClose,
  onRefunded,
}: Props) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<Payment['paymentMethod']>(
    payment.paymentMethod,
  );
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refundableRemaining = useMemo(
    () => Math.max(0, payment.amount - existingRefundTotal),
    [payment.amount, existingRefundTotal],
  );

  // Refund cannot proceed when the flag is off OR nothing remains refundable.
  const flagOn = isFlagEnabled('PAYMENT_TX');
  const disabledReason = !flagOn
    ? 'Tính năng hoàn tiền chưa được bật (FEATURE_PAYMENT_TX)'
    : refundableRemaining <= 0
      ? 'Thanh toán gốc đã được hoàn đủ'
      : null;

  const handleSubmit = async () => {
    if (disabledReason) {
      setError(disabledReason);
      return;
    }
    if (amount <= 0) {
      setError('Vui lòng nhập số tiền hoàn');
      return;
    }
    if (amount > refundableRemaining) {
      setError(
        `Số tiền hoàn vượt quá số tiền còn lại có thể hoàn (tối đa ${formatCurrency(refundableRemaining)})`,
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/payments/refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userProfile?.id ? { 'x-dev-user-id': userProfile.id } : {}),
        },
        body: JSON.stringify({
          originalPaymentId: payment.id,
          amount,
          paymentMethod,
          paymentDate,
          note: note.trim() || undefined,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error ?? 'Không thể hoàn tiền');
        return;
      }

      toast({
        title: 'Đã hoàn tiền',
        description: `${formatCurrency(amount)} đã được ghi nhận là hoàn tiền cho ${payment.id}.`,
        type: 'success',
      });
      onRefunded();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Không thể hoàn tiền';
      setError(message);
      toast({ title: 'Lỗi hoàn tiền', description: message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Hoàn tiền"
      description="Tạo giao dịch hoàn tiền cho một thanh toán đã xác nhận"
      size="md"
      closeLabel="Đóng hộp thoại hoàn tiền"
    >
      <div className="p-6 space-y-6">
        {/* Original Payment Summary */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Mã thanh toán gốc</span>
            <span className="text-sm font-medium text-gray-800">{payment.id}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Mã CA</span>
            <span className="text-sm font-medium text-gray-800">{payment.caseId}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Số tiền gốc</span>
            <span className="text-lg font-bold text-swan-700">
              {formatCurrency(payment.amount)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Đã hoàn trước đó</span>
            <span className="text-sm font-medium text-amber-700">
              {formatCurrency(existingRefundTotal)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Còn có thể hoàn</span>
            <span className="text-base font-semibold text-emerald-700">
              {formatCurrency(refundableRemaining)}
            </span>
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

        {disabledReason ? (
          <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {disabledReason}
          </div>
        ) : (
          <>
            {/* Refund Amount */}
            <CurrencyInput
              label="Số tiền hoàn (VNĐ) *"
              value={amount}
              onChange={(num) => setAmount(num)}
              placeholder="0"
              hint={`Tối đa có thể hoàn: ${formatCurrency(refundableRemaining)}`}
              error={error ?? undefined}
              required
            />

            <div className="grid grid-cols-2 gap-4">
              {/* Refund Payment Method */}
              <Select
                label="Hình thức hoàn *"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as Payment['paymentMethod'])}
              >
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>

              {/* Refund Payment Date */}
              <Input
                label="Ngày hoàn *"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>

            {/* Note */}
            <Textarea
              label="Ghi chú"
              placeholder="Lý do hoàn tiền..."
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </>
        )}

        {/* Actions */}
        <div className="flex gap-3 border-t border-gray-100 pt-4">
          <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={loading}
            disabled={disabledReason !== null}
            className="flex-1"
          >
            <RefreshCw className="h-4 w-4" />
            Xác nhận hoàn tiền
          </Button>
        </div>
      </div>
    </Modal>
  );
}