'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, Briefcase, User as UserIcon, CreditCard } from 'lucide-react';
import { getAllCases, getAllCustomers } from '@/lib/firestore';
import { CaseRecord, Customer } from '@/lib/types';
import { CASE_STATUS_LABELS, CASE_STATUS_COLORS } from '@/constants/case-status';
import { formatDateVN } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface ActivityItem {
  id: string;
  type: 'case' | 'customer';
  title: string;
  subtitle: string;
  date: string;
  href: string;
  icon: React.ElementType;
  badge?: { label: string; className: string };
}

export function RecentActivity() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [cases, customers] = await Promise.all([
          getAllCases(),
          getAllCustomers(),
        ]);
        if (cancelled) return;

        const customersMap = new Map(customers.map((c) => [c.id, c]));
        const activityItems: ActivityItem[] = [];

        // Latest cases
        const latestCases = [...cases]
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 8);

        for (const c of latestCases) {
          const customer = customersMap.get(c.customerId);
          activityItems.push({
            id: c.id,
            type: 'case',
            title: c.caseCode,
            subtitle: customer?.fullName ?? 'Không rõ',
            date: c.updatedAt,
            href: `/cases/${c.id}`,
            icon: Briefcase,
            badge: {
              label: CASE_STATUS_LABELS[c.status] ?? c.status,
              className: CASE_STATUS_COLORS[c.status] ?? '',
            },
          });
        }

        // Latest customers
        const latestCustomers = [...customers]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);

        for (const c of latestCustomers) {
          activityItems.push({
            id: c.id,
            type: 'customer',
            title: c.fullName,
            subtitle: c.phone,
            date: c.createdAt,
            href: `/customers/${c.id}`,
            icon: UserIcon,
          });
        }

        // Sort all by date desc, take top 10
        activityItems.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );

        setItems(activityItems.slice(0, 10));
      } catch (err) {
        console.error('[RecentActivity] Failed to load:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="rounded-2xl border border-gray-100/80 bg-white p-6 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5 text-swan-500" />
        <h3 className="text-lg font-semibold text-gray-900">Hoạt động gần đây</h3>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-swan-200 border-t-swan-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-swan-50 p-3">
            <Activity className="h-6 w-6 text-swan-400" />
          </div>
          <p className="mt-3 text-sm text-gray-500">Chưa có hoạt động nào</p>
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={`${item.type}-${item.id}`}
                href={item.href}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all hover:bg-swan-50/40"
              >
                <div className={cn(
                  'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
                  item.type === 'case' ? 'bg-champagne-400/10 text-champagne-600' : 'bg-swan-50 text-swan-600',
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{item.title}</span>
                    {item.badge && (
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border', item.badge.className)}>
                        {item.badge.label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{item.subtitle}</p>
                </div>
                <span className="flex-shrink-0 text-xs text-gray-400">
                  {formatDateVN(item.date)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
