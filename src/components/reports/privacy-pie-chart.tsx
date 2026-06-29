'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { PrivacyLevel } from '@/lib/types';
import { PRIVACY_LEVEL_HEX, PRIVACY_LEVEL_LABELS } from '@/constants/customer-meta';
import { TOOLTIP_STYLE } from './chart-theme';

export interface PrivacyDatum {
  level: PrivacyLevel;
  count: number;
}

interface PrivacyPieChartProps {
  data: PrivacyDatum[];
}

export function PrivacyPieChart({ data }: PrivacyPieChartProps) {
  const filtered = data.filter((d) => d.count > 0);
  if (filtered.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Chưa có dữ liệu
      </div>
    );
  }

  const chartData = filtered.map((d) => ({
    name: PRIVACY_LEVEL_LABELS[d.level],
    level: d.level,
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
            <Cell key={entry.level} fill={PRIVACY_LEVEL_HEX[entry.level]} />
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