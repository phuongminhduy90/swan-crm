'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatCards } from '@/components/dashboard/stat-cards';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { getAllCases } from '@/lib/firestore';
import { CaseRecord } from '@/lib/types';
import { Briefcase, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getAllCases();
        if (!cancelled) setCases(data);
      } catch (err) {
        console.error('[Dashboard] Failed to load cases:', err);
      } finally {
        if (!cancelled) setCasesLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const newCases = cases.filter((c) => c.status === 'draft' || c.status === 'waiting_customer_info').length;
  const waitingPayment = cases.filter((c) => c.status === 'waiting_payment_confirmation').length;
  const waitingHospital = cases.filter((c) => c.status === 'waiting_hospital_confirmation' || c.status === 'waiting_location_assignment').length;
  const inFollowup = cases.filter((c) => c.status.startsWith('post_op_')).length;

  const cards = [
    { label: 'CASE mới', value: casesLoading ? '...' : newCases, textColor: 'text-swan-700', bg: 'bg-swan-50' },
    { label: 'Chờ thanh toán', value: casesLoading ? '...' : waitingPayment, textColor: 'text-amber-700', bg: 'bg-amber-50' },
    { label: 'Chờ bệnh viện', value: casesLoading ? '...' : waitingHospital, textColor: 'text-cyan-700', bg: 'bg-cyan-50' },
    { label: 'Đang theo dõi', value: casesLoading ? '...' : inFollowup, textColor: 'text-pink-700', bg: 'bg-pink-50' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Chào mừng trở lại</h2>
        <p className="mt-1 text-sm text-gray-500">
          Tổng quan hoạt động Swan Clinic hôm nay
        </p>
      </div>

      <StatCards />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <RecentActivity />

        <div className="rounded-2xl border border-gray-100/80 bg-white p-6 shadow-soft">
          <div className="mb-4 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-swan-500" />
            <h3 className="text-lg font-semibold text-gray-900">Báo cáo nhanh</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {cards.map((c) => (
              <Link
                key={c.label}
                href="/cases"
                className="group rounded-xl border border-gray-100/80 bg-gray-50/50 p-3.5 transition-all hover:bg-white hover:shadow-soft hover:border-swan-100"
              >
                <p className="text-xs font-medium text-gray-500">{c.label}</p>
                <p className={`mt-1.5 text-2xl font-bold tabular-nums ${c.textColor}`}>{c.value}</p>
              </Link>
            ))}
          </div>
          <Link
            href="/cases"
            className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-swan-50 px-3 py-2 text-sm font-medium text-swan-700 transition-all hover:bg-swan-100"
          >
            Xem tất cả CASE
            <TrendingUp className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
