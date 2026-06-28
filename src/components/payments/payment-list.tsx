'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { Payment } from '@/lib/types';
import { getAllPayments, getPaymentsByCase, confirmPayment, rejectPayment } from '@/lib/firestore';
import { useAuth } from '@/lib/auth/AuthProvider';
import { formatDateVN, formatCurrency } from '@/lib/utils/format';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PaymentConfirmDialog } from './payment-confirm-dialog';

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
  caseId?: string;
  statusFilter?: Payment['status'];
  refresh?: number;
}

export function PaymentList({ caseId, statusFilter, refresh }: Props) {
  const { userProfile } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState<Payment | null>(null);

  const canApprove =
    userProfile?.role === 'accountant' || userProfile?.role === 'admin';

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = caseId ? await getPaymentsByCase(caseId) : await getAllPayments();
      const filtered = statusFilter ? data.filter((p) => p.status === statusFilter) : data;
      setPayments(filtered);
    } catch {
      setError('Không thể tải danh sách thanh toán');
    } finally {
      setLoading(false);
    }
  }, [caseId, statusFilter]);

  useEffect(() => {
    load();
  }, [load, refresh]);

  const handleConfirm = async (note?: string) => {
    if (!confirmingPayment || !userProfile) return;
    await confirmPayment(
      confirmingPayment.id,
      { confirmedBy: userProfile.id, note },
      userProfile.id,
    );
    setConfirmingPayment(null);
    await load();
  };

  const handleReject = async (note: string) => {
    if (!confirmingPayment || !userProfile) return;
    await rejectPayment(confirmingPayment.id, note, userProfile.id);
    setConfirmingPayment(null);
    await load();
  };

  const statusBadge = (status: Payment['status']) => {
    if (status === 'confirmed')
      return <Badge variant="success"><CheckCircle className="mr-1 h-3 w-3 inline" />Đã xác nhận</Badge>;
    if (status === 'rejected')
      return <Badge variant="danger"><XCircle className="mr-1 h-3 w-3 inline" />Từ chối</Badge>;
    return <Badge variant="warning"><Clock className="mr-1 h-3 w-3 inline" />Chờ xác nhận</Badge>;
  };

  const columns = [
    {
      key: 'paymentDate',
      header: 'Ngày thanh toán',
      render: (row: Payment) => (
        <span className="text-sm text-gray-700">{formatDateVN(row.paymentDate)}</span>
      ),
    },
    {
      key: 'paymentType',
      header: 'Loại',
      render: (row: Payment) => (
        <span className="text-sm font-medium">
          {PAYMENT_TYPE_LABELS[row.paymentType] ?? row.paymentType}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Số tiền',
      render: (row: Payment) => (
        <span className="text-sm font-semibold text-swan-700">
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    {
      key: 'paymentMethod',
      header: 'Hình thức',
      render: (row: Payment) => (
        <span className="text-sm text-gray-600">
          {PAYMENT_METHOD_LABELS[row.paymentMethod] ?? row.paymentMethod}
        </span>
      ),
    },
    {
      key: 'createdBy',
      header: 'Người nhập',
      render: (row: Payment) => (
        <span className="text-xs text-gray-500">{row.createdBy}</span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (row: Payment) => statusBadge(row.status),
    },
    ...(canApprove
      ? [
          {
            key: 'actions',
            header: 'Thao tác',
            render: (row: Payment) =>
              row.status === 'pending' ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmingPayment(row);
                  }}
                >
                  Xử lý
                </Button>
              ) : (
                <span className="text-xs text-gray-400">—</span>
              ),
          },
        ]
      : []),
  ];

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <XCircle className="h-4 w-4 shrink-0" />
        {error}
        <Button size="sm" variant="ghost" onClick={load} className="ml-auto">
          <RefreshCw className="h-3 w-3" /> Thử lại
        </Button>
      </div>
    );
  }

  return (
    <>
      <DataTable<Record<string, unknown>>
        columns={columns as never}
        data={payments as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="Không có giao dịch thanh toán nào"
      />

      {confirmingPayment && (
        <PaymentConfirmDialog
          payment={confirmingPayment}
          onConfirm={handleConfirm}
          onReject={handleReject}
          onClose={() => setConfirmingPayment(null)}
        />
      )}
    </>
  );
}
