'use client';

import { useEffect, useState, useId } from 'react';
import Link from 'next/link';
import { Users, FolderOpen, TrendingUp, Calendar, AlertTriangle } from 'lucide-react';
import { getAllCustomers, getAllCases, getAllPayments, getAllAppointments } from '@/lib/firestore';
import { cn } from '@/lib/utils/cn';
import { formatCompact } from '@/lib/utils/format';
import type { CaseRecord } from '@/lib/types';

interface Stat {
  label: string;
  value: string | number;
  hint: string;
  /** Long-form description shown via `aria-describedby` for screen readers + native `title` on hover. */
  tooltip: string;
  icon: React.ElementType;
  bg: string;
  color: string;
  gradient: string;
  href: string;
  /** Red emphasis variant — used by F-CRIT-07 `lab_overdue_count` card. */
  variant?: 'default' | 'danger';
}

const LOADING_VALUE = '...';

/**
 * Initial render — values show `...` until the async load completes. The 5th
 * `Lab quá hạn` card (F-CRIT-07) is pre-declared with its danger variant so
 * layout does not shift when data resolves.
 */
const INITIAL_STATS: Stat[] = [
  {
    label: 'Khách hàng',
    value: LOADING_VALUE,
    hint: 'Tổng số khách hàng',
    tooltip: 'Tổng số khách hàng đang có trong hệ thống',
    icon: Users,
    bg: 'bg-swan-100',
    color: 'text-swan-700',
    gradient: 'from-swan-500 to-swan-600',
    href: '/customers',
  },
  {
    label: 'CASE đang xử lý',
    value: LOADING_VALUE,
    hint: 'CASE chưa hoàn tất',
    tooltip: 'Số ca đang trong quy trình (loại trừ hoàn tất và hủy)',
    icon: FolderOpen,
    bg: 'bg-champagne-400/20',
    color: 'text-champagne-600',
    gradient: 'from-champagne-400 to-champagne-500',
    href: '/cases',
  },
  {
    label: 'Doanh thu tháng',
    value: LOADING_VALUE,
    hint: 'Đã xác nhận trong tháng',
    tooltip: 'Tổng các thanh toán đã xác nhận trong tháng hiện tại',
    icon: TrendingUp,
    bg: 'bg-emerald-100',
    color: 'text-emerald-700',
    gradient: 'from-emerald-500 to-emerald-600',
    href: '/reports',
  },
  {
    label: 'Lịch hẹn hôm nay',
    value: LOADING_VALUE,
    hint: 'Cuộc hẹn ngày hôm nay',
    tooltip: 'Tổng số cuộc hẹn trong ngày hôm nay',
    icon: Calendar,
    bg: 'bg-purple-100',
    color: 'text-purple-700',
    gradient: 'from-purple-500 to-purple-600',
    href: '/calendar',
  },
  {
    label: 'Lab quá hạn',
    value: LOADING_VALUE,
    hint: 'Ca chờ xét nghiệm quá hạn',
    tooltip:
      'Các ca đang ở trạng thái "Chờ xét nghiệm" đã quá hạn lịch hẹn — bấm để xem danh sách',
    icon: AlertTriangle,
    bg: 'bg-red-100',
    color: 'text-red-700',
    gradient: 'from-red-500 to-red-600',
    href: '/cases?status=lab_overdue',
    variant: 'danger',
  },
];

/**
 * Compute the count of `lab_overdue` cases per F-CRIT-07.
 *
 * A case counts as overdue when:
 *  - status is `waiting_lab_test` (case still needs the lab result), AND
 *  - `expectedLabDate` exists and parses as a real date, AND
 *  - the expected lab date is strictly before `now` (date-only comparison —
 *    a lab scheduled for "today" is NOT overdue yet)
 *
 * Terminal statuses (`completed`, `cancelled`, `medical_alert_resolved`) are
 * excluded by virtue of the status check — `waiting_lab_test` is non-terminal
 * by definition. Post-op statuses are excluded for the same reason.
 *
 * Exported for unit tests.
 */
export function countLabOverdueCases(cases: CaseRecord[], now: Date = new Date()): number {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return cases.filter((c) => {
    if (c.status !== 'waiting_lab_test') return false;
    if (!c.expectedLabDate) return false;
    const labDate = new Date(c.expectedLabDate);
    if (Number.isNaN(labDate.getTime())) return false;
    const labDateStart = new Date(
      labDate.getFullYear(),
      labDate.getMonth(),
      labDate.getDate(),
    ).getTime();
    return labDateStart < todayStart;
  }).length;
}

export function StatCards() {
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stat[]>(INITIAL_STATS);

  // Stable, unique id for the screen-reader description block (one per render)
  const tooltipId = useId();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [customers, cases, payments, appointments] = await Promise.all([
          getAllCustomers(),
          getAllCases(),
          getAllPayments(),
          getAllAppointments(),
        ]);

        if (cancelled) return;

        // Cases not completed/cancelled
        const activeCases = cases.filter(
          (c) => c.status !== 'completed' && c.status !== 'cancelled',
        );

        // Revenue this month (confirmed payments)
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const confirmedThisMonth = payments
          .filter(
            (p) =>
              p.status === 'confirmed' &&
              new Date(p.paymentDate ?? p.createdAt) >= monthStart,
          )
          .reduce((sum, p) => sum + (p.amount ?? 0), 0);

        // Appointments today
        const todayStr = now.toISOString().split('T')[0];
        const todayAppts = appointments.filter((a) => {
          const apptDate = new Date(a.startTime).toISOString().split('T')[0];
          return apptDate === todayStr && a.status !== 'cancelled';
        });

        // Lab overdue (F-CRIT-07)
        const labOverdueCount = countLabOverdueCases(cases, now);

        setStats([
          { ...INITIAL_STATS[0], value: customers.length },
          { ...INITIAL_STATS[1], value: activeCases.length },
          { ...INITIAL_STATS[2], value: formatCompact(confirmedThisMonth) },
          { ...INITIAL_STATS[3], value: todayAppts.length },
          { ...INITIAL_STATS[4], value: labOverdueCount },
        ]);
      } catch (err) {
        console.error('[StatCards] Failed to load:', err);
        setError('Không thể tải dữ liệu');
        setStats((prev) => prev.map((s) => ({ ...s, value: 'Lỗi' })));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const isDanger = stat.variant === 'danger';
        return (
          <Link
            key={stat.label}
            href={stat.href}
            aria-label={`${stat.label} — ${stat.hint}`}
            aria-describedby={`${tooltipId}-${stat.label}`}
            title={stat.tooltip}
            className={cn(
              'group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-soft transition-all duration-300 hover:shadow-medium hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-swan-500 focus-visible:ring-offset-2',
              isDanger
                ? 'border-red-200/80 hover:border-red-300'
                : 'border-gray-100/80',
            )}
          >
            <div
              className="absolute -right-3 -top-3 h-20 w-20 rounded-full bg-gradient-to-br opacity-[0.07] group-hover:opacity-[0.12] transition-opacity"
              style={{ backgroundImage: `linear-gradient(135deg, var(--tw-gradient-stops))` }}
            />
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm',
                stat.bg,
              )}
            >
              <Icon className={cn('h-6 w-6', stat.color)} aria-hidden="true" />
            </div>
            <div className="mt-3 min-w-0 flex-1">
              <p
                className={cn(
                  'text-xs font-medium',
                  isDanger ? 'text-red-700' : 'text-gray-500',
                )}
              >
                {stat.label}
              </p>
              <p
                className={cn(
                  'mt-0.5 text-2xl font-bold tabular-nums',
                  isDanger ? 'text-red-700' : 'text-gray-900',
                )}
              >
                {stat.value}
              </p>
              <p
                className={cn(
                  'mt-0.5 text-xs',
                  isDanger ? 'text-red-500/80' : 'text-gray-400',
                )}
              >
                {stat.hint}
              </p>
            </div>
            {/* Hidden accessible description — provides the long-form tooltip for screen readers via aria-describedby. */}
            <span id={`${tooltipId}-${stat.label}`} className="sr-only">
              {stat.tooltip}
            </span>
          </Link>
        );
      })}

      {error && (
        <p className="sr-only" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}