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
import { CaseStatus } from '@/lib/types';
import { CASE_STATUS_LABELS, CASE_STATUS_HEX } from '@/constants/case-status';
import { AXIS_STYLE, TOOLTIP_STYLE, GRID_STYLE, tooltipFormatCount } from './chart-theme';

export interface StatusDatum {
  status: CaseStatus;
  count: number;
}

interface StatusBarChartProps {
  data: StatusDatum[];
}

export function StatusBarChart({ data }: StatusBarChartProps) {
  const filtered = data.filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
  if (filtered.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Chưa có dữ liệu
      </div>
    );
  }

  const chartData = filtered.map((d) => ({
    label: CASE_STATUS_LABELS[d.status],
    status: d.status,
    count: d.count,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
      >
        <CartesianGrid {...GRID_STYLE} horizontal={false} />
        <XAxis type="number" {...AXIS_STYLE} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          {...AXIS_STYLE}
          width={160}
          tick={{ ...AXIS_STYLE.tick, fontSize: 11 }}
        />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(v) => tooltipFormatCount(v, 'ca')}
        />
        <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={24}>
          {chartData.map((entry) => (
            <Cell key={entry.status} fill={CASE_STATUS_HEX[entry.status]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}