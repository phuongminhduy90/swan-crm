'use client';

import { useMemo } from 'react';
import { FolderOpen, Layers, ArrowDown } from 'lucide-react';
import { CaseRecord, ServiceCategory } from '@/lib/types';
import { getPipelineStage, PIPELINE_STAGES, PipelineStageKey } from '@/constants/case-status';
import { StatusBarChart, StatusDatum } from './status-bar-chart';
import { CategoryBarChart, CategoryDatum } from './category-bar-chart';
import { PipelineFunnel } from './pipeline-funnel';
import { ChartCard } from './chart-card';

interface PipelineReportProps {
  cases: CaseRecord[];
}

export function PipelineReport({ cases }: PipelineReportProps) {
  // Active cases only (exclude completed, cancelled)
  const activeCases = useMemo(
    () => cases.filter((c) => c.status !== 'completed' && c.status !== 'cancelled'),
    [cases],
  );

  // Status breakdown
  const statusData: StatusDatum[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of activeCases) {
      map.set(c.status, (map.get(c.status) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([status, count]) => ({
      status: status as StatusDatum['status'],
      count,
    }));
  }, [activeCases]);

  // Category breakdown
  const categoryData: CategoryDatum[] = useMemo(() => {
    const map = new Map<ServiceCategory, { count: number; revenue: number }>();
    for (const c of activeCases) {
      const entry = map.get(c.mainServiceGroup) ?? { count: 0, revenue: 0 };
      entry.count += 1;
      entry.revenue += c.totalBillAfterDiscount ?? 0;
      map.set(c.mainServiceGroup, entry);
    }
    return Array.from(map.entries()).map(([category, val]) => ({
      category,
      count: val.count,
      revenue: val.revenue,
    }));
  }, [activeCases]);

  // Pipeline funnel
  const funnelData: { stage: PipelineStageKey; count: number }[] = useMemo(() => {
    const counts = new Map<PipelineStageKey, number>();
    for (const stage of PIPELINE_STAGES) counts.set(stage.key, 0);
    for (const c of activeCases) {
      const stage = getPipelineStage(c.status);
      if (stage) counts.set(stage, (counts.get(stage) ?? 0) + 1);
    }
    return PIPELINE_STAGES.map((s) => ({ stage: s.key, count: counts.get(s.key) ?? 0 }));
  }, [activeCases]);

  return (
    <div className="space-y-6">
      <ChartCard title="Pipeline chuyển đổi ca" icon={<ArrowDown className="h-5 w-5 text-swan-600" />} minHeight={280}>
        <PipelineFunnel data={funnelData} />
      </ChartCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Phân bổ trạng thái" icon={<FolderOpen className="h-5 w-5 text-swan-600" />} minHeight={Math.max(statusData.length * 32 + 80, 300)}>
          <StatusBarChart data={statusData} />
        </ChartCard>

        <ChartCard title="Ca theo dịch vụ" icon={<Layers className="h-5 w-5 text-champagne-500" />} minHeight={300}>
          <CategoryBarChart data={categoryData} />
        </ChartCard>
      </div>
    </div>
  );
}