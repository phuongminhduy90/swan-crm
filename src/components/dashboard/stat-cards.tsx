'use client';

import { useEffect, useState } from 'react';
import { Users, FolderOpen, TrendingUp, Calendar } from 'lucide-react';
import { getAllCustomers, getAllCases, getAllPayments, getAllAppointments } from '@/lib/firestore';
import { cn } from '@/lib/utils/cn';

interface Stat {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ElementType;
  bg: string;
  color: string;
  gradient: string;
}

export function StatCards() {
  const [stats, setStats] = useState<Stat[]>([
    { label: 'Khách hàng', value: '...', hint: 'Tổng số khách hàng', icon: Users, bg: 'bg-swan-100', color: 'text-swan-700', gradient: 'from-swan-500 to-swan-600' },
    { label: 'CASE đang xử lý', value: '...', hint: 'CASE chưa hoàn tất', icon: FolderOpen, bg: 'bg-champagne-400/20', color: 'text-champagne-600', gradient: 'from-champagne-400 to-champagne-500' },
    { label: 'Doanh thu tháng', value: '...', hint: 'Đã xác nhận trong tháng', icon: TrendingUp, bg: 'bg-emerald-100', color: 'text-emerald-700', gradient: 'from-emerald-500 to-emerald-600' },
    { label: 'Lịch hẹn hôm nay', value: '...', hint: 'Cuộc hẹn ngày hôm nay', icon: Calendar, bg: 'bg-purple-100', color: 'text-purple-700', gradient: 'from-purple-500 to-purple-600' },
  ]);

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

        setStats([
          { label: 'Khách hàng', value: customers.length, hint: 'Tổng số khách hàng', icon: Users, bg: 'bg-swan-100', color: 'text-swan-700', gradient: 'from-swan-500 to-swan-600' },
          { label: 'CASE đang xử lý', value: activeCases.length, hint: 'CASE chưa hoàn tất', icon: FolderOpen, bg: 'bg-champagne-400/20', color: 'text-champagne-600', gradient: 'from-champagne-400 to-champagne-500' },
          { label: 'Doanh thu tháng', value: formatCompact(confirmedThisMonth), hint: 'Đã xác nhận trong tháng', icon: TrendingUp, bg: 'bg-emerald-100', color: 'text-emerald-700', gradient: 'from-emerald-500 to-emerald-600' },
          { label: 'Lịch hẹn hôm nay', value: todayAppts.length, hint: 'Cuộc hẹn ngày hôm nay', icon: Calendar, bg: 'bg-purple-100', color: 'text-purple-700', gradient: 'from-purple-500 to-purple-600' },
        ]);
      } catch (err) {
        console.error('[StatCards] Failed to load:', err);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="group relative overflow-hidden rounded-2xl border border-gray-100/80 bg-white p-5 shadow-soft transition-all duration-300 hover:shadow-medium hover:-translate-y-0.5"
          >
            <div className="absolute -right-3 -top-3 h-20 w-20 rounded-full bg-gradient-to-br opacity-[0.07] group-hover:opacity-[0.12] transition-opacity" style={{ backgroundImage: `linear-gradient(135deg, var(--tw-gradient-stops))` }} />
            <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm', stat.bg)}>
              <Icon className={cn('h-6 w-6', stat.color)} />
            </div>
            <div className="mt-3 min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-500">{stat.label}</p>
              <p className="mt-0.5 text-2xl font-bold text-gray-900 tabular-nums">{stat.value}</p>
              <p className="mt-0.5 text-xs text-gray-400">{stat.hint}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat('vi-VN').format(n);
}
