'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CaseStatusBadge } from '@/components/cases/status-badge';
import { SERVICE_CATEGORY_LABELS, SERVICE_CATEGORY_COLORS } from '@/constants/service-categories';
import { CASE_STATUS_LABELS } from '@/constants/case-status';
import { formatDateVN, formatPhone } from '@/lib/utils/format';
import { useIsDesktop } from '@/lib/hooks/useMediaQuery';
import { cn } from '@/lib/utils/cn';

const PAGE_SIZE = 15;

/**
 * Status filter chip options. `lab_overdue` is a special URL-only filter
 * (F-CRIT-07) — driven by the dashboard's `Lab quá hạn` stat card. It is
 * NOT rendered as a chip; it activates via the `?status=lab_overdue` query
 * param and shows an inline notice with a "Bỏ lọc" button.
 */
type StatusFilterValue = CaseStatus | 'all' | 'post_op' | 'lab_overdue';

// Status filter chip groups
const STATUS_FILTER_OPTIONS: { label: string; value: StatusFilterValue }[] = [
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

/** URL `?status=` → internal filter value mapping (F-CRIT-07). */
function parseStatusParam(raw: string | null): StatusFilterValue {
  if (!raw) return 'all';
  if (raw === 'lab_overdue') return 'lab_overdue';
  if (raw === 'post_op') return 'post_op';
  // Allow any CaseStatus literal
  const known: StatusFilterValue[] = [
    'all', 'post_op', 'lab_overdue',
    'draft', 'waiting_customer_info', 'waiting_payment_confirmation',
    'payment_confirmed', 'waiting_location_assignment',
    'waiting_hospital_confirmation', 'hospital_confirmed',
    'waiting_doctor_review', 'waiting_lab_test', 'lab_test_done',
    'medically_approved', 'scheduled', 'reminder_sent', 'checked_in',
    'in_procedure', 'procedure_completed', 'waiting_images_upload',
    'post_op_d1', 'post_op_d3', 'post_op_d7',
    'post_op_d14', 'post_op_d30', 'post_op_d90',
    'completed', 'postponed', 'cancelled', 'complaint', 'medical_alert', 'medical_alert_resolved',
  ];
  return known.includes(raw as StatusFilterValue) ? (raw as StatusFilterValue) : 'all';
}

/** Inverse of `parseStatusParam` — what to write to the URL. */
function serializeStatusParam(value: StatusFilterValue): string | null {
  if (value === 'all') return null;
  return value;
}

/**
 * F-CRIT-07 — a case is `lab_overdue` when status is `waiting_lab_test`,
 * an `expectedLabDate` exists, and that date is strictly before today
 * (date-only comparison). Excludes terminal statuses by virtue of the
 * status check.
 *
 * Exported for unit testing.
 */
export function isLabOverdue(c: CaseRecord, now: Date = new Date()): boolean {
  if (c.status !== 'waiting_lab_test') return false;
  if (!c.expectedLabDate) return false;
  const labDate = new Date(c.expectedLabDate);
  if (Number.isNaN(labDate.getTime())) return false;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const labDateStart = new Date(
    labDate.getFullYear(),
    labDate.getMonth(),
    labDate.getDate(),
  ).getTime();
  return labDateStart < todayStart;
}

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
  const searchParams = useSearchParams();

  // B.4.6 — chips on `md+`, <Select> on `< md`. Default SSR / initial render
  // is mobile-friendly (`<Select>`) so the layout never overflows during
  // hydration at 360 px.
  const isDesktop = useIsDesktop();

  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [customersMap, setCustomersMap] = useState<Record<string, Customer>>({});
  const [locationsMap, setLocationsMap] = useState<Record<string, TreatmentLocation>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  // Initial value synced from `?status=` query param (F-CRIT-07)
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>(
    () => parseStatusParam(searchParams.get('status')),
  );
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

  // Re-sync status filter when URL `?status=` changes (back/forward navigation)
  useEffect(() => {
    const fromUrl = parseStatusParam(searchParams.get('status'));
    setStatusFilter(fromUrl);
  }, [searchParams]);

  /**
   * Update filter + push the change into the URL so the page is bookmarkable
   * and so the dashboard link is honored on refresh.
   */
  const updateStatusFilter = useCallback(
    (next: StatusFilterValue) => {
      setStatusFilter(next);
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      const serialized = serializeStatusParam(next);
      if (serialized === null) {
        params.delete('status');
      } else {
        params.set('status', serialized);
      }
      const qs = params.toString();
      router.replace(qs ? `/cases?${qs}` : '/cases', { scroll: false });
    },
    [router, searchParams],
  );

  // Filter cases
  const filteredCases = useMemo(() => {
    let result = cases;

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'post_op') {
        result = result.filter((c) => POST_OP_STATUSES.includes(c.status));
      } else if (statusFilter === 'lab_overdue') {
        const now = new Date();
        result = result.filter((c) => isLabOverdue(c, now));
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

  /** True when the user arrived here via the dashboard's `Lab quá hạn` card. */
  const isLabOverdueFilter = statusFilter === 'lab_overdue';

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

      {/* Lab-overdue inline notice (F-CRIT-07) — only when filter was set via the dashboard link. */}
      {isLabOverdueFilter && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 text-sm text-red-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
          <span className="flex-1">
            Đang lọc các ca chờ xét nghiệm đã quá hạn lịch hẹn.
          </span>
          <button
            type="button"
            onClick={() => updateStatusFilter('all')}
            className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700 transition-all hover:bg-red-100"
          >
            Bỏ lọc
          </button>
        </div>
      )}

      {/* Status Filter — B.4.6 responsive
          - `md+` (≥ 768 px): chips with per-status counts (existing behavior)
          - `< md` (< 768 px): <Select> dropdown to prevent 12-status horizontal
            overflow at 360 px (F-MED-06, anti-pattern M5)
          Both UIs filter the list identically and honor the `?status=` URL param. */}
      {isDesktop ? (
        <div
          className="flex flex-wrap gap-2"
          data-testid="status-filter-chips"
          aria-label="Lọc theo trạng thái"
          role="group"
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateStatusFilter(opt.value)}
              aria-pressed={statusFilter === opt.value}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-all min-h-[44px] sm:min-h-0',
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
      ) : (
        <div data-testid="status-filter-select">
          <Select
            value={statusFilter}
            onChange={(e) => updateStatusFilter(e.target.value as StatusFilterValue)}
            aria-label="Lọc theo trạng thái"
            className="min-h-[44px]"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => {
              const count =
                opt.value === 'all'
                  ? cases.length
                  : opt.value === 'post_op'
                    ? cases.filter((c) => POST_OP_STATUSES.includes(c.status)).length
                    : cases.filter((c) => c.status === opt.value).length;
              return (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({count})
                </option>
              );
            })}
          </Select>
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={paginated}
        loading={loading}
        emptyMessage={isLabOverdueFilter ? 'Không có ca chờ xét nghiệm nào quá hạn' : 'Không tìm thấy hồ sơ nào'}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onRowClick={(row) => router.push(`/cases/${(row as unknown as CaseRecord).id}`)}
      />
    </div>
  );
}
