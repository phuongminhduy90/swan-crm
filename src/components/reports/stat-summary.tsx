import { Wallet, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { formatVNDCompact } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface RevenueStats {
  total: number;
  confirmed: number;
  pending: number;
  refund: number;
  avgPerCase: number;
}

interface StatSummaryProps {
  stats: RevenueStats;
  caseCount: number;
}

interface StatRow {
  label: string;
  value: string;
  hint: string;
  icon: React.ElementType;
  bg: string;
  color: string;
}

export function StatSummary({ stats, caseCount }: StatSummaryProps) {
  const rows: StatRow[] = [
    {
      label: 'Tổng doanh thu',
      value: formatVNDCompact(stats.total),
      hint: `${caseCount} ca có thanh toán`,
      icon: Wallet,
      bg: 'bg-swan-100',
      color: 'text-swan-700',
    },
    {
      label: 'Đã xác nhận',
      value: formatVNDCompact(stats.confirmed),
      hint: stats.total > 0 ? `${((stats.confirmed / stats.total) * 100).toFixed(0)}% tổng` : '—',
      icon: CheckCircle2,
      bg: 'bg-emerald-100',
      color: 'text-emerald-700',
    },
    {
      label: 'Chờ xác nhận',
      value: formatVNDCompact(stats.pending),
      hint: 'Kế toán cần xử lý',
      icon: Clock,
      bg: 'bg-amber-100',
      color: 'text-amber-700',
    },
    {
      label: 'Trung bình/ca',
      value: formatVNDCompact(stats.avgPerCase),
      hint: stats.refund > 0 ? `Hoàn: ${formatVNDCompact(stats.refund)}` : 'Chưa có hoàn',
      icon: TrendingUp,
      bg: 'bg-champagne-400/20',
      color: 'text-champagne-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {rows.map((row) => {
        const Icon = row.icon;
        return (
          <div
            key={row.label}
            className="group relative overflow-hidden rounded-2xl border border-gray-100/80 bg-white p-5 shadow-soft transition-all duration-300 hover:shadow-medium hover:-translate-y-0.5"
          >
            <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm', row.bg)}>
              <Icon className={cn('h-6 w-6', row.color)} />
            </div>
            <div className="mt-3 min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-500">{row.label}</p>
              <p className="mt-0.5 text-2xl font-bold text-gray-900 tabular-nums">{row.value}</p>
              <p className="mt-0.5 text-xs text-gray-400">{row.hint}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}