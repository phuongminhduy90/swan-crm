'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ServiceCategory } from '@/lib/types';
import { SERVICE_CATEGORY_LABELS } from '@/constants/service-categories';
import { CHART_PALETTE, AXIS_STYLE, TOOLTIP_STYLE, GRID_STYLE, tooltipFormatCount } from './chart-theme';

export interface CategoryDatum {
  category: ServiceCategory;
  count: number;
  revenue: number;
}

interface CategoryBarChartProps {
  data: CategoryDatum[];
}

export function CategoryBarChart({ data }: CategoryBarChartProps) {
  const filtered = data.filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
  if (filtered.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Chưa có dữ liệu
      </div>
    );
  }

  const chartData = filtered.map((d) => ({
    name: SERVICE_CATEGORY_LABELS[d.category],
    category: d.category,
    count: d.count,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="name" {...AXIS_STYLE} />
        <YAxis {...AXIS_STYLE} allowDecimals={false} />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(v) => tooltipFormatCount(v, 'ca')}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
          {chartData.map((entry, i) => (
            <Cell key={entry.category} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}