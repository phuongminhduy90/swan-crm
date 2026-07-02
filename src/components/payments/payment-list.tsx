'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { CheckCircle, XCircle, Clock, RefreshCw, ShieldAlert, FileSearch } from 'lucide-react';
import { Payment, User } from '@/lib/types';
import {
  getAllPayments,
  getPaymentsByCase,
  confirmPayment,
  rejectPayment,
  getAllUsers,
} from '@/lib/firestore';
import { useAuth } from '@/lib/auth/AuthProvider';
import { formatDateVN, formatCurrency } from '@/lib/utils/format';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PaymentConfirmDialog } from './payment-confirm-dialog';
import { PaymentRefundDialog } from './payment-refund-dialog';
import { PAYMENT_CONFIRM_ROLES, REFUND_CREATE_ROLES } from '@/constants/permissions';
import { isFlagEnabled } from '@/lib/feature-flags';
import { sumRefundsAgainst } from '@/lib/payments/refund';

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
  paymentTypeFilter?: string;
  refresh?: number;
}

export function PaymentList({ caseId, statusFilter, paymentTypeFilter, refresh }: Props) {
  const { userProfile } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState<Payment | null>(null);
  const [refundingPayment, setRefundingPayment] = useState<Payment | null>(null);
  // Story 6.3.3 / B.4.3 (F-HIGH-17): resolve createdBy / receivedBy /
  // confirmedBy user IDs to display names (closes A2 anti-pattern: raw
  // `user-XXX` IDs in payment list copy).
  const [users, setUsers] = useState<User[]>([]);

  // Story B.3.1 (F-CRIT-06): read the role allow-list from the static
  // contract instead of hardcoding `'accountant' || 'admin'`. The previous
  // hardcoded list silently drifted from `PAYMENT_CONFIRM_ROLES` whenever
  // that constant changed. SoD is enforced server-side; this is purely
  // UI hiding per anti-pattern A6 (DESIGN_DIRECTION §18).
  const canApprove =
    userProfile?.role !== undefined &&
    PAYMENT_CONFIRM_ROLES.includes(userProfile.role);

  // Story B.3.1 (F-CRIT-06): when the SoD flag is on, suppress the action
  // button for rows the current user created. The server returns 403 in
  // that case anyway, but hiding it improves UX (no rejected click).
  const sodEnabled = isFlagEnabled('PAYMENT_SOD');

  // Story PI-2 (Sprint 7.2): refund feature flag. When OFF, the "Hoàn tiền"
  // button is hidden — refunds must go through the manual create-payment
  // path (matching the rollback plan in §7.1 of the Sprint 7.2 plan).
  const refundFlagOn = isFlagEnabled('PAYMENT_TX');

  // Story 6.3.3 / B.4.3: build a Map<userId, displayName> once, instead of
  // scanning the array on every row render. Falls back to the original ID
  // if a user is missing (e.g. legacy data, deleted account) so the table
  // never crashes on an unresolved reference.
  const usersMap = useMemo(
    () => new Map(users.map((u) => [u.id, u] as const)),
    [users],
  );
  const getUserName = useCallback(
    (id: string | undefined): string => {
      if (!id) return '—';
      return usersMap.get(id)?.displayName ?? '—';
    },
    [usersMap],
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [data, usersData] = await Promise.all([
        caseId ? getPaymentsByCase(caseId) : getAllPayments(),
        getAllUsers(),
      ]);
      let filtered = statusFilter ? data.filter((p) => p.status === statusFilter) : data;
      if (paymentTypeFilter) {
        filtered = filtered.filter((p) => p.paymentType === paymentTypeFilter);
      }
      setPayments(filtered);
      setUsers(usersData);
    } catch {
      setError('Không thể tải danh sách thanh toán');
    } finally {
      setLoading(false);
    }
  }, [caseId, statusFilter, paymentTypeFilter]);

  useEffect(() => {
    load();
  }, [load, refresh]);

  const handleConfirm = async (note?: string) => {
    if (!confirmingPayment || !userProfile) return;
    try {
      await confirmPayment(
        confirmingPayment.id,
        { confirmedBy: userProfile.id, note },
        userProfile.id,
      );
      setConfirmingPayment(null);
      await load();
    } catch (err) {
      console.error('[PaymentList] Confirm error:', err);
    }
  };

  const handleReject = async (note: string) => {
    if (!confirmingPayment || !userProfile) return;
    try {
      await rejectPayment(confirmingPayment.id, note, userProfile.id);
      setConfirmingPayment(null);
      await load();
    } catch (err) {
      console.error('[PaymentList] Reject error:', err);
    }
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
        <span className="text-xs font-medium text-gray-700">
          {getUserName(row.createdBy)}
        </span>
      ),
    },
    {
      key: 'receivedBy',
      header: 'Người nhận',
      render: (row: Payment) => (
        <span className="text-xs text-gray-600">
          {getUserName(row.receivedBy)}
        </span>
      ),
    },
    {
      key: 'confirmedBy',
      header: 'Người xác nhận',
      render: (row: Payment) => (
        <span className="text-xs text-gray-600">
          {row.status === 'confirmed'
            ? getUserName(row.confirmedBy)
            : <span className="text-gray-400">—</span>}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (row: Payment) => statusBadge(row.status),
    },
    /**
     * Story PI-3 (Sprint 7.2) — deep link to the per-payment audit
     * history. Every payment row shows the link (not gated by `canApprove`
     * because audit reading is a separate `audit:read` permission that
     * most roles — including sales + accountant + media — already
     * hold). The destination is `/audit-logs?entityId=<row.id>` so the
     * audit-logs page opens pre-filtered to this payment's history.
     */
    {
      key: 'audit',
      header: 'Lịch sử',
      render: (row: Payment) => (
        <a
          href={`/audit-logs?entityId=${encodeURIComponent(row.id)}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-swan-700 hover:text-swan-800 hover:underline"
          title="Xem lịch sử thay đổi thanh toán này"
        >
          <FileSearch className="h-3 w-3" />
          Xem
        </a>
      ),
    },
    ...(canApprove
      ? [
          {
            key: 'actions',
            header: 'Thao tác',
            render: (row: Payment) => {
              // Story PI-2: confirmed non-refund rows get a "Hoàn tiền" button
              // (when the PAYMENT_TX flag is on AND the caller has refund
              // permission). Pending rows get the existing "Xử lý" button.
              // Other rows (rejected / already-refund) show "—".
              const canShowRefund =
                refundFlagOn &&
                row.status === 'confirmed' &&
                row.paymentType !== 'refund' &&
                (REFUND_CREATE_ROLES.includes(
                  userProfile?.role as (typeof REFUND_CREATE_ROLES)[number],
                ) ||
                  row.createdBy === userProfile?.id);

              const refundRemaining = Math.max(
                0,
                row.amount - sumRefundsAgainst(row.id, payments),
              );

              if (canShowRefund && refundRemaining > 0) {
                return (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRefundingPayment(row);
                      }}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Hoàn tiền
                    </Button>
                  </div>
                );
              }

              if (row.status !== 'pending') {
                return <span className="text-xs text-gray-400">—</span>;
              }
              // Story B.3.1: hide the action button for payments the
              // current user created when SoD is enforced — the server
              // would 403 anyway.
              const isOwnPayment =
                sodEnabled && row.createdBy === userProfile?.id;
              if (isOwnPayment) {
                return (
                  <span
                    className="inline-flex items-center gap-1 text-xs text-amber-700"
                    title="Bạn đã tạo thanh toán này — cần admin khác xác nhận (SoD)."
                  >
                    <ShieldAlert className="h-3 w-3" />
                    SoD
                  </span>
                );
              }
              return (
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
              );
            },
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

      {refundingPayment && (
        <PaymentRefundDialog
          payment={refundingPayment}
          existingRefundTotal={sumRefundsAgainst(refundingPayment.id, payments)}
          onRefunded={load}
          onClose={() => setRefundingPayment(null)}
        />
      )}
    </>
  );
}
