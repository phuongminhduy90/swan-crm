'use client';

import { useMemo } from 'react';
import { Users, Shield, UserPlus } from 'lucide-react';
import { Customer, CustomerSource, PrivacyLevel } from '@/lib/types';
import { SourcePieChart, SourceDatum } from './source-pie-chart';
import { PrivacyPieChart, PrivacyDatum } from './privacy-pie-chart';
import { NewCustomersChart, NewCustomersPoint } from './new-customers-chart';
import { ChartCard } from './chart-card';
import { DateRangeOption } from './report-filters';
import { getMonthKey, getMonthLabel } from '@/lib/utils/format';

interface CustomerReportProps {
  customers: Customer[];
  dateRange: DateRangeOption;
}

export function CustomerReport({ customers, dateRange }: CustomerReportProps) {
  // Filter by date range
  const filteredCustomers = useMemo(() => {
    if (dateRange === 0) return customers;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - dateRange);
    return customers.filter((c) => new Date(c.createdAt) >= cutoff);
  }, [customers, dateRange]);

  // Source breakdown
  const sourceData: SourceDatum[] = useMemo(() => {
    const map = new Map<CustomerSource, number>();
    for (const c of filteredCustomers) {
      const src = c.source ?? 'other';
      map.set(src, (map.get(src) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([source, count]) => ({ source, count }));
  }, [filteredCustomers]);

  // Privacy level breakdown
  const privacyData: PrivacyDatum[] = useMemo(() => {
    const map = new Map<PrivacyLevel, number>();
    for (const c of filteredCustomers) {
      map.set(c.privacyLevel, (map.get(c.privacyLevel) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([level, count]) => ({ level, count }));
  }, [filteredCustomers]);

  // New customers per month (based on ALL customers for proper trend)
  const monthlyData: NewCustomersPoint[] = useMemo(() => {
    const map = new Map<string, number>();
    const sourceCustomers = dateRange === 0 ? customers : filteredCustomers;
    for (const c of sourceCustomers) {
      const key = getMonthKey(new Date(c.createdAt));
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    // Fill gaps for last N months
    if (dateRange > 0) {
      const now = new Date();
      for (let i = dateRange - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setMonth(d.getMonth() - i);
        const key = getMonthKey(d);
        if (!map.has(key)) map.set(key, 0);
      }
    }
    const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    return sorted.map(([key, count]) => ({
      monthKey: key,
      label: getMonthLabel(new Date(key + '-01')),
      count,
    }));
  }, [customers, filteredCustomers, dateRange]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard title="Nguồn khách hàng" icon={<Users className="h-5 w-5 text-swan-600" />} minHeight={320}>
          <SourcePieChart data={sourceData} />
        </ChartCard>

        <ChartCard title="Mức độ bảo mật" icon={<Shield className="h-5 w-5 text-champagne-500" />} minHeight={320}>
          <PrivacyPieChart data={privacyData} />
        </ChartCard>

        <ChartCard title="Khách mới theo tháng" icon={<UserPlus className="h-5 w-5 text-swan-600" />} minHeight={320}>
          <NewCustomersChart data={monthlyData} />
        </ChartCard>
      </div>
    </div>
  );
}