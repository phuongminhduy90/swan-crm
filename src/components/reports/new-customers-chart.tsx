'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { SWAN_COLORS, AXIS_STYLE, TOOLTIP_STYLE, GRID_STYLE, tooltipFormatCount } from './chart-theme';

export interface NewCustomersPoint {
  monthKey: string;
  label: string;
  count: number;
}

interface NewCustomersChartProps {
  data: NewCustomersPoint[];
}

export function NewCustomersChart({ data }: NewCustomersChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Chưa có dữ liệu
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="label" {...AXIS_STYLE} />
        <YAxis {...AXIS_STYLE} allowDecimals={false} />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(v) => tooltipFormatCount(v, 'khách')}
        />
        <Bar
          dataKey="count"
          fill={SWAN_COLORS.aqua}
          radius={[6, 6, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}