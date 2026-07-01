'use client';

import { useEffect, useState } from 'react';
import { DollarSign, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Payment } from '@/lib/types';
import { getAllPayments } from '@/lib/firestore';
import { formatCurrency } from '@/lib/utils/format';
import { PaymentList } from '@/components/payments';
import { cn } from '@/lib/utils/cn';

type TabStatus = 'all' | 'pending' | 'confirmed' | 'rejected' | 'refund';

const TABS: { key: TabStatus; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: 'Tất cả', icon: <DollarSign className="h-4 w-4" /> },
  { key: 'pending', label: 'Chờ xác nhận', icon: <Clock className="h-4 w-4" /> },
  { key: 'confirmed', label: 'Đã xác nhận', icon: <CheckCircle className="h-4 w-4" /> },
  { key: 'rejected', label: 'Từ chối', icon: <XCircle className="h-4 w-4" /> },
  { key: 'refund', label: 'Hoàn tiền', icon: <RefreshCw className="h-4 w-4" /> },
];

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<TabStatus>('all');
  const [refresh, setRefresh] = useState(0);
  const [summaryPayments, setSummaryPayments] = useState<Payment[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    getAllPayments()
      .then(setSummaryPayments)
      .finally(() => setSummaryLoading(false));
  }, [refresh]);

  const today = new Date().toISOString().slice(0, 10);

  const totalPending = summaryPayments
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0);

  const confirmedToday = summaryPayments
    .filter((p) => p.status === 'confirmed' && p.confirmedAt?.slice(0, 10) === today)
    .reduce((sum, p) => sum + p.amount, 0);

  const rejectedCount = summaryPayments.filter((p) => p.status === 'rejected').length;

  const statusFilter =
    activeTab === 'all'
      ? undefined
      : activeTab === 'refund'
        ? undefined // refund is a paymentType, filtered separately
        : (activeTab as Payment['status']);

  const listKey = `${activeTab}-${refresh}`;

  const SummaryCard = ({
    label,
    value,
    icon,
    color,
  }: {
    label: string;
    value: string;
    icon: React.ReactNode;
    color: string;
  }) => (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', color)}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="mt-0.5 text-lg font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quản lý thanh toán</h1>
        <p className="mt-1 text-sm text-gray-500">
          Theo dõi và xác nhận các giao dịch thanh toán
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Tổng chờ xác nhận"
          value={summaryLoading ? '...' : formatCurrency(totalPending)}
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          color="bg-amber-100"
        />
        <SummaryCard
          label="Đã xác nhận hôm nay"
          value={summaryLoading ? '...' : formatCurrency(confirmedToday)}
          icon={<CheckCircle className="h-5 w-5 text-emerald-600" />}
          color="bg-emerald-100"
        />
        <SummaryCard
          label="Số giao dịch từ chối"
          value={summaryLoading ? '...' : `${rejectedCount} giao dịch`}
          icon={<XCircle className="h-5 w-5 text-red-600" />}
          color="bg-red-100"
        />
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div
          role="tablist"
          aria-orientation="horizontal"
          aria-label="Bộ lọc trạng thái thanh toán"
          className="flex overflow-x-auto border-b border-gray-100"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                id={`payments-tab-${tab.key}`}
                aria-selected={isActive}
                aria-controls={`payments-tab-panel-${tab.key}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex shrink-0 items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-swan-400 focus-visible:ring-offset-2',
                  isActive
                    ? 'border-swan-500 text-swan-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700',
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          id={`payments-tab-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`payments-tab-${activeTab}`}
          tabIndex={0}
          className="p-4 outline-none"
        >
          {activeTab === 'refund' ? (
            <PaymentList key={listKey} paymentTypeFilter="refund" refresh={refresh} />
          ) : (
            <PaymentList
              key={listKey}
              statusFilter={statusFilter}
              refresh={refresh}
            />
          )}
        </div>
      </div>
    </div>
  );
}