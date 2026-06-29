'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { SWAN_COLORS, AXIS_STYLE, TOOLTIP_STYLE, GRID_STYLE, tooltipFormatVND } from './chart-theme';
import { formatCompact } from '@/lib/utils/format';

export interface MonthlyRevenuePoint {
  monthKey: string;
  label: string;
  confirmed: number;
  pending: number;
}

interface RevenueTrendChartProps {
  data: MonthlyRevenuePoint[];
}

export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Chưa có dữ liệu
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="label" {...AXIS_STYLE} />
        <YAxis
          {...AXIS_STYLE}
          tickFormatter={(v) => formatCompact(Number(v))}
        />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={tooltipFormatVND}
        />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
        <Line
          type="monotone"
          dataKey="confirmed"
          name="Đã xác nhận"
          stroke={SWAN_COLORS.aqua}
          strokeWidth={2.5}
          dot={{ r: 4, fill: SWAN_COLORS.aqua }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="pending"
          name="Chờ xác nhận"
          stroke={SWAN_COLORS.gold}
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={{ r: 3, fill: SWAN_COLORS.gold }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}