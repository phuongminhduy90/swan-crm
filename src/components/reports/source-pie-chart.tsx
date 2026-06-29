'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { CustomerSource } from '@/lib/types';
import { CUSTOMER_SOURCE_HEX, CUSTOMER_SOURCE_LABELS } from '@/constants/customer-meta';
import { TOOLTIP_STYLE } from './chart-theme';

export interface SourceDatum {
  source: CustomerSource;
  count: number;
}

interface SourcePieChartProps {
  data: SourceDatum[];
}

export function SourcePieChart({ data }: SourcePieChartProps) {
  const filtered = data.filter((d) => d.count > 0);
  if (filtered.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Chưa có dữ liệu
      </div>
    );
  }

  const chartData = filtered.map((d) => ({
    name: CUSTOMER_SOURCE_LABELS[d.source],
    source: d.source,
    value: d.count,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius="75%"
          innerRadius="45%"
          paddingAngle={2}
          stroke="#fff"
          strokeWidth={2}
        >
          {chartData.map((entry) => (
            <Cell key={entry.source} fill={CUSTOMER_SOURCE_HEX[entry.source]} />
          ))}
        </Pie>
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(v) => [`${Number(v)} khách`, '']}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}