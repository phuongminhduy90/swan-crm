'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BarChart3, TrendingUp, FolderOpen, Users } from 'lucide-react';
import { getAllPayments, getAllCases, getAllCustomers } from '@/lib/firestore';
import { Payment, CaseRecord, Customer } from '@/lib/types';
import { Tabs } from '@/components/ui/tabs';
import { RevenueReport } from '@/components/reports/revenue-report';
import { PipelineReport } from '@/components/reports/pipeline-report';
import { CustomerReport } from '@/components/reports/customer-report';
import {
  ReportFilters,
  DATE_RANGE_OPTIONS,
  type DateRangeOption,
} from '@/components/reports/report-filters';
import { ChartSkeleton, StatCardsSkeleton } from '@/components/reports/loading-skeleton';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';

/** Default range — also the "no param" baseline. */
const DEFAULT_RANGE: DateRangeOption = 6;

/** Valid range values accepted in the URL. */
const VALID_RANGES: ReadonlySet<DateRangeOption> = new Set([3, 6, 12, 0]);

/**
 * Parse a `?range=…` URL param into a `DateRangeOption`. Anything invalid
 * (missing, malformed, unsupported) falls back to `DEFAULT_RANGE`.
 *
 * Accepted forms:
 *   - `?range=3m`, `?range=6m`, `?range=12m` → month-count
 *   - `?range=0` → "Tất cả" (all time)
 *   - `?range=3` (bare number) → tolerated for back-compat
 */
function parseRangeParam(value: string | null): DateRangeOption {
  if (!value) return DEFAULT_RANGE;
  if (value === '0') return 0;
  const stripped = value.endsWith('m') ? value.slice(0, -1) : value;
  const num = Number(stripped);
  if (VALID_RANGES.has(num as DateRangeOption)) {
    return num as DateRangeOption;
  }
  return DEFAULT_RANGE;
}

/** Serialise a `DateRangeOption` for the URL. */
function rangeToParam(value: DateRangeOption): string {
  return value === 0 ? '0' : `${value}m`;
}

/** Friendly label for the active filter pill (e.g. "Đang lọc: 6 tháng"). */
function activeFilterLabel(value: DateRangeOption): string | null {
  if (value === DEFAULT_RANGE) return null;
  const match = DATE_RANGE_OPTIONS.find((o) => o.value === value);
  if (!match) return null;
  return `Đang lọc: ${match.label}`;
}

function ReportsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // URL is the source of truth. The local state mirrors the URL — no
  // separate `useState<DateRangeOption>` to drift.
  const rangeParam = searchParams.get('range');
  const dateRange = useMemo(() => parseRangeParam(rangeParam), [rangeParam]);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tabId, setTabId] = useState<string>('revenue');

  // Refetch gate — first load uses the full-screen skeleton; subsequent
  // refetches triggered by `dateRange` change use a lightweight "Đang lọc…"
  // pill (handled in the UI, not via skeleton).
  const isFirstLoadRef = useRef(true);

  // Refetch data when dateRange changes. Pipeline tab ignores dateRange, so
  // the refetch is a no-op visually there, but the data load is uniform for
  // simplicity. Refetch is async — UI shows "Đang lọc…" via `refreshing`.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (isFirstLoadRef.current) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }
        const [p, c, cu] = await Promise.all([
          getAllPayments(),
          getAllCases(),
          getAllCustomers(),
        ]);
        if (cancelled) return;
        setPayments(p as Payment[]);
        setCases(c as CaseRecord[]);
        setCustomers(cu as Customer[]);
      } catch (err) {
        if (cancelled) return;
        console.error('[ReportsPage] Failed to load:', err);
        toast({
          type: 'error',
          title: 'Không thể tải báo cáo',
          description: 'Vui lòng thử lại hoặc liên hệ kỹ thuật nếu lỗi tiếp diễn.',
        });
      } finally {
        if (cancelled) return;
        setLoading(false);
        setRefreshing(false);
        isFirstLoadRef.current = false;
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // dateRange is the only trigger we want — payments/cases/customers
    // setters are stable and shouldn't retrigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  /** Replace the URL with a new `?range=…` value. Default removes the param. */
  const updateRange = useCallback(
    (next: DateRangeOption) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === DEFAULT_RANGE) {
        params.delete('range');
      } else {
        params.set('range', rangeToParam(next));
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  /** Clear all filters — resets `dateRange` to the default and confirms via toast. */
  const clearAllFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('range');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    toast({
      type: 'info',
      title: 'Đã xóa bộ lọc',
      description: 'Đang hiển thị dữ liệu mặc định (6 tháng).',
      duration: 3000,
    });
  }, [pathname, router, searchParams, toast]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-swan-500 to-swan-600 text-white shadow-sm">
              <BarChart3 className="h-5 w-5" />
            </span>
            Báo cáo
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Doanh thu, pipeline ca và khách hàng — cập nhật realtime
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <ReportFilters
            value={dateRange}
            onChange={updateRange}
            onClear={clearAllFilters}
            activeFilterLabel={activeFilterLabel(dateRange)}
            data-testid="report-filters"
          />
          {/* C.2.3 — visible "Đang lọc…" pill during refetch. Purely
              presentational — uses the same `animate-fade-in` entrance as the
              page so the visual rhythm matches the rest of the surface. */}
          {refreshing && (
            <span
              role="status"
              aria-live="polite"
              data-testid="report-filtering-pill"
              className="inline-flex items-center gap-1.5 self-end rounded-full border border-swan-200 bg-white/80 px-3 py-1 text-xs font-medium text-swan-700 shadow-soft animate-fade-in"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-swan-500" aria-hidden="true" />
              Đang lọc…
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        items={[
          { id: 'revenue', label: 'Doanh thu', icon: <TrendingUp className="h-4 w-4" /> },
          { id: 'pipeline', label: 'Luồng CASE', icon: <FolderOpen className="h-4 w-4" /> },
          { id: 'customer', label: 'Khách hàng', icon: <Users className="h-4 w-4" /> },
        ]}
        activeId={tabId}
        onChange={setTabId}
        idPrefix="reports"
      />

      {/* Content */}
      <div
        id={`reports-panel-${tabId}`}
        role="tabpanel"
        aria-labelledby={`reports-tab-${tabId}`}
        tabIndex={0}
        className={cn('animate-fade-in outline-none')}
      >
        {loading ? (
          <div className="space-y-6">
            <StatCardsSkeleton />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <ChartSkeleton height={280} />
              <ChartSkeleton height={280} />
            </div>
          </div>
        ) : tabId === 'revenue' ? (
          <RevenueReport payments={payments} cases={cases} dateRange={dateRange} />
        ) : tabId === 'pipeline' ? (
          <PipelineReport cases={cases} />
        ) : (
          <CustomerReport customers={customers} dateRange={dateRange} />
        )}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  // `useSearchParams` requires a Suspense boundary for static generation in
  // Next.js 14. We render a lightweight skeleton while inner page boots.
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-swan-500 to-swan-600 text-white shadow-sm">
                  <BarChart3 className="h-5 w-5" />
                </span>
                Báo cáo
              </h1>
              <p className="mt-1 text-sm text-gray-500">Đang tải…</p>
            </div>
          </div>
          <div className="space-y-6">
            <StatCardsSkeleton />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <ChartSkeleton height={280} />
              <ChartSkeleton height={280} />
            </div>
          </div>
        </div>
      }
    >
      <ReportsPageInner />
    </Suspense>
  );
}
