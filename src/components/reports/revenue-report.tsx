'use client';

import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { Payment, CaseRecord } from '@/lib/types';
import { StatSummary } from './stat-summary';
import { RevenueTrendChart, MonthlyRevenuePoint } from './revenue-trend-chart';
import { PaymentMethodChart, PaymentMethodDatum } from './payment-method-chart';
import { ChartCard } from './chart-card';
import { DateRangeOption } from './report-filters';
import { getMonthKey, getMonthLabel } from '@/lib/utils/format';

interface RevenueReportProps {
  payments: Payment[];
  cases: CaseRecord[];
  dateRange: DateRangeOption;
}

export function RevenueReport({ payments, cases, dateRange }: RevenueReportProps) {
  // Filter payments by date range
  const filteredPayments = useMemo(() => {
    if (dateRange === 0) return payments;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - dateRange);
    return payments.filter((p) => new Date(p.paymentDate) >= cutoff);
  }, [payments, dateRange]);

  // Stats
  const stats = useMemo(() => {
    const confirmed = filteredPayments
      .filter((p) => p.status === 'confirmed' && p.paymentType !== 'refund')
      .reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const pending = filteredPayments
      .filter((p) => p.status !== 'confirmed')
      .reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const refund = filteredPayments
      .filter((p) => p.paymentType === 'refund')
      .reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const total = confirmed; // Tổng doanh thu = chỉ tính thanh toán đã xác nhận (không bao gồm refund)
    // Chỉ đếm cases có ít nhất 1 payment confirmed (không phải refund)
    const confirmedCaseIds = new Set(
      filteredPayments
        .filter((p) => p.status === 'confirmed' && p.paymentType !== 'refund')
        .map((p) => p.caseId)
    );
    const avgPerCase = confirmedCaseIds.size > 0 ? confirmed / confirmedCaseIds.size : 0;
    return { total, confirmed, pending, refund, avgPerCase, confirmedCaseIds };
  }, [filteredPayments]);

  // Monthly trend
  // B.3.4 (F-HIGH-33): per-month refund tracking so the revenue chart can
  // draw a red refund line + "Đã xác nhận − Hoàn tiền" annotation. Refund
  // amount is only accumulated for confirmed refund payments (matches the
  // existing total-refund accounting). The `refund` field is always
  // populated (defaulting to 0) so the refund `<Line>` always renders even
  // when no refunds exist in the period — the line stays flat at 0.
  const monthlyData: MonthlyRevenuePoint[] = useMemo(() => {
    const map = new Map<string, { confirmed: number; pending: number; refund: number }>();
    for (const p of filteredPayments) {
      const key = getMonthKey(new Date(p.paymentDate));
      if (!map.has(key)) map.set(key, { confirmed: 0, pending: 0, refund: 0 });
      const entry = map.get(key)!;
      // Không cộng refund vào confirmed
      if (p.status === 'confirmed' && p.paymentType !== 'refund') {
        entry.confirmed += p.amount ?? 0;
      } else if (p.status !== 'confirmed') {
        entry.pending += p.amount ?? 0;
      }
      // B.3.4: track refund separately so the chart can render the red line
      if (p.paymentType === 'refund' && p.status === 'confirmed') {
        entry.refund += p.amount ?? 0;
      }
    }
    const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    return sorted.map(([key, val]) => ({
      monthKey: key,
      label: getMonthLabel(new Date(key + '-01')),
      confirmed: val.confirmed,
      pending: val.pending,
      refund: val.refund,
    }));
  }, [filteredPayments]);

  // Payment method breakdown
  const methodData: PaymentMethodDatum[] = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const p of filteredPayments) {
      if (!map.has(p.paymentMethod)) map.set(p.paymentMethod, { total: 0, count: 0 });
      const entry = map.get(p.paymentMethod)!;
      entry.total += p.amount ?? 0;
      entry.count += 1;
    }
    return Array.from(map.entries()).map(([method, val]) => ({
      method: method as PaymentMethodDatum['method'],
      total: val.total,
      count: val.count,
    }));
  }, [filteredPayments]);

  return (
    <div className="space-y-6">
      <StatSummary stats={stats} caseCount={stats.confirmedCaseIds.size} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard title="Doanh thu theo tháng" icon={<TrendingUp className="h-5 w-5 text-swan-600" />} className="lg:col-span-2" minHeight={320}>
          <RevenueTrendChart data={monthlyData} />
        </ChartCard>

        <ChartCard title="Phương thức thanh toán" icon={<TrendingUp className="h-5 w-5 text-champagne-500" />} minHeight={320}>
          <PaymentMethodChart data={methodData} />
        </ChartCard>
      </div>
    </div>
  );
}