'use client';

import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, FolderOpen, Users } from 'lucide-react';
import { getAllPayments, getAllCases, getAllCustomers } from '@/lib/firestore';
import { Payment, CaseRecord, Customer } from '@/lib/types';
import { Tabs } from '@/components/ui/tabs';
import { RevenueReport } from '@/components/reports/revenue-report';
import { PipelineReport } from '@/components/reports/pipeline-report';
import { CustomerReport } from '@/components/reports/customer-report';
import { ReportFilters, DateRangeOption } from '@/components/reports/report-filters';
import { ChartSkeleton, StatCardsSkeleton } from '@/components/reports/loading-skeleton';
import { cn } from '@/lib/utils/cn';

export default function ReportsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRangeOption>(6);
  const [tabId, setTabId] = useState<string>('revenue');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
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
        console.error('[ReportsPage] Failed to load:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

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
        <ReportFilters value={dateRange} onChange={setDateRange} />
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