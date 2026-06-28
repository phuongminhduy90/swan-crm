'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, MapPin, Calendar } from 'lucide-react';
import {
  getAllCases,
  getAllCustomers,
  getAllTreatmentLocations,
} from '@/lib/firestore';
import { CaseRecord, Customer, TreatmentLocation, CaseStatus, PaymentStatus } from '@/lib/types';
import { DataTable } from '@/components/ui/data-table';
import { SearchInput } from '@/components/ui/search-input';
import { Badge } from '@/components/ui/badge';
import { CaseStatusBadge } from '@/components/cases/status-badge';
import { SERVICE_CATEGORY_LABELS, SERVICE_CATEGORY_COLORS } from '@/constants/service-categories';
import { CASE_STATUS_LABELS } from '@/constants/case-status';
import { formatDateVN, formatPhone } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

const PAGE_SIZE = 15;

// Status filter chip groups
const STATUS_FILTER_OPTIONS: { label: string; value: CaseStatus | 'all' | 'post_op' }[] = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Nháp', value: 'draft' },
  { label: 'Chờ TT', value: 'waiting_payment_confirmation' },
  { label: 'Đã cọc', value: 'payment_confirmed' },
  { label: 'Chờ BV', value: 'waiting_hospital_confirmation' },
  { label: 'Đã lịch', value: 'scheduled' },
  { label: 'Đang PT', value: 'in_procedure' },
  { label: 'Hậu phẫu', value: 'post_op' },
  { label: 'Hoàn tất', value: 'completed' },
  { label: 'Hủy ca', value: 'cancelled' },
  { label: 'Khiếu nại', value: 'complaint' },
  { label: 'Cảnh báo', value: 'medical_alert' },
];

const POST_OP_STATUSES: CaseStatus[] = [
  'post_op_d1', 'post_op_d3', 'post_op_d7',
  'post_op_d14', 'post_op_d30', 'post_op_d90',
];

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Chưa thu',
  deposit: 'Đã cọc',
  partial: 'Một phần',
  paid: 'Đã đủ',
  refunded: 'Hoàn tiền',
};

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  unpaid: 'bg-red-100 text-red-700 border-red-200',
  deposit: 'bg-amber-100 text-amber-700 border-amber-200',
  partial: 'bg-blue-100 text-blue-700 border-blue-200',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  refunded: 'bg-purple-100 text-purple-700 border-purple-200',
};

const PRIORITY_CONFIG = {
  normal: { label: 'Thường', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  high: { label: 'Cao', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  urgent: { label: 'Khẩn cấp', className: 'bg-red-100 text-red-700 border-red-200' },
};

interface CaseListProps {
  onTotalChange?: (total: number) => void;
}

export function CaseList({ onTotalChange }: CaseListProps) {
  const router = useRouter();

  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [customersMap, setCustomersMap] = useState<Record<string, Customer>>({});
  const [locationsMap, setLocationsMap] = useState<Record<string, TreatmentLocation>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'all' | 'post_op'>('all');
  const [page, setPage] = useState(1);

  // Load all data
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [casesData, customersData, locationsData] = await Promise.all([
          getAllCases(),
          getAllCustomers(),
          getAllTreatmentLocations(),
        ]);

        setCases(casesData);

        const cMap: Record<string, Customer> = {};
        customersData.forEach((c) => { cMap[c.id] = c; });
        setCustomersMap(cMap);

        const lMap: Record<string, TreatmentLocation> = {};
        locationsData.forEach((l) => { lMap[l.id] = l; });
        setLocationsMap(lMap);
      } catch (err) {
        console.error('CaseList load error:', err);
        setError('Không thể tải danh sách hồ sơ');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Filter cases
  const filteredCases = useMemo(() => {
    let result = cases;

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'post_op') {
        result = result.filter((c) => POST_OP_STATUSES.includes(c.status));
      } else {
        result = result.filter((c) => c.status === statusFilter);
      }
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((c) => {
        const customer = customersMap[c.customerId];
        const codeMatch = c.caseCode?.toLowerCase().includes(q);
        const nameMatch = customer?.fullName?.toLowerCase().includes(q);
        const phoneMatch = customer?.phone?.includes(q);
        return codeMatch || nameMatch || phoneMatch;
      });
    }

    return result;
  }, [cases, statusFilter, searchQuery, customersMap]);

  // Update total count for parent
  useEffect(() => {
    onTotalChange?.(filteredCases.length);
  }, [filteredCases.length, onTotalChange]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredCases.length / PAGE_SIZE);
  const paginated = filteredCases.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns = [
    {
      key: 'caseCode',
      header: 'Mã CA',
      className: 'font-mono',
      render: (row: CaseRecord) => (
        <Link
          href={`/cases/${row.id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-swan-600 hover:text-swan-700 hover:underline"
        >
          {row.caseCode}
        </Link>
      ),
    },
    {
      key: 'customer',
      header: 'Khách hàng',
      render: (row: CaseRecord) => {
        const customer = customersMap[row.customerId];
        if (!customer) return <span className="text-gray-400 text-xs">—</span>;
        return (
          <div className="min-w-[140px]">
            <p className="text-sm font-medium text-gray-900 truncate max-w-[160px]">{customer.fullName}</p>
            <p className="text-xs text-gray-500">{formatPhone(customer.phone)}</p>
          </div>
        );
      },
    },
    {
      key: 'mainServiceGroup',
      header: 'Dịch vụ',
      render: (row: CaseRecord) => (
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
            SERVICE_CATEGORY_COLORS[row.mainServiceGroup] ?? 'bg-gray-100 text-gray-700',
          )}
        >
          {SERVICE_CATEGORY_LABELS[row.mainServiceGroup] ?? row.mainServiceGroup}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (row: CaseRecord) => <CaseStatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'paymentStatus',
      header: 'Thanh toán',
      render: (row: CaseRecord) => (
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
            PAYMENT_STATUS_COLORS[row.paymentStatus] ?? 'bg-gray-100 text-gray-600',
          )}
        >
          {PAYMENT_STATUS_LABELS[row.paymentStatus] ?? row.paymentStatus}
        </span>
      ),
    },
    {
      key: 'treatmentLocationId',
      header: 'Nơi thực hiện',
      render: (row: CaseRecord) => {
        const loc = row.treatmentLocationId ? locationsMap[row.treatmentLocationId] : null;
        return loc ? (
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <MapPin className="h-3 w-3 shrink-0 text-gray-400" />
            <span className="truncate max-w-[120px]">{loc.name}</span>
          </div>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        );
      },
    },
    {
      key: 'expectedProcedureDate',
      header: 'Ngày thực hiện',
      render: (row: CaseRecord) => (
        <div className="flex items-center gap-1 text-xs text-gray-600">
          {row.expectedProcedureDate ? (
            <>
              <Calendar className="h-3 w-3 shrink-0 text-gray-400" />
              <span>{formatDateVN(row.expectedProcedureDate)}</span>
            </>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Ưu tiên',
      render: (row: CaseRecord) => {
        const cfg = PRIORITY_CONFIG[row.priority] ?? PRIORITY_CONFIG.normal;
        return (
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
              cfg.className,
            )}
          >
            {cfg.label}
          </span>
        );
      },
    },
  ];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + Filters Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Tìm mã CA, tên hoặc SĐT khách hàng..."
          className="w-full sm:max-w-xs"
        />
        <p className="text-xs text-gray-500 shrink-0">
          {filteredCases.length} hồ sơ
        </p>
      </div>

      {/* Status Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value as typeof statusFilter)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-all',
              statusFilter === opt.value
                ? 'border-swan-500 bg-swan-500 text-white shadow-sm'
                : 'border-gray-200 bg-white text-gray-600 hover:border-swan-300 hover:bg-swan-50 hover:text-swan-700',
            )}
          >
            {opt.label}
            {opt.value !== 'all' && (
              <span className="ml-1 opacity-70">
                (
                {opt.value === 'post_op'
                  ? cases.filter((c) => POST_OP_STATUSES.includes(c.status)).length
                  : cases.filter((c) => c.status === opt.value).length}
                )
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={paginated}
        loading={loading}
        emptyMessage="Không tìm thấy hồ sơ nào"
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onRowClick={(row) => router.push(`/cases/${(row as unknown as CaseRecord).id}`)}
      />
    </div>
  );
}
