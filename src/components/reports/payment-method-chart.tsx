'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { PAYMENT_METHOD_HEX, PAYMENT_METHOD_LABELS } from '@/constants/payment-methods';
import { PaymentMethod } from '@/lib/types';
import { TOOLTIP_STYLE } from './chart-theme';
import { formatVNDCompact } from '@/lib/utils/format';

export interface PaymentMethodDatum {
  method: PaymentMethod;
  total: number;
  count: number;
}

interface PaymentMethodChartProps {
  data: PaymentMethodDatum[];
}

export function PaymentMethodChart({ data }: PaymentMethodChartProps) {
  const filtered = data.filter((d) => d.count > 0);
  if (filtered.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Chưa có dữ liệu
      </div>
    );
  }

  const chartData = filtered.map((d) => ({
    name: PAYMENT_METHOD_LABELS[d.method],
    method: d.method,
    value: d.total,
    count: d.count,
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
            <Cell key={entry.method} fill={PAYMENT_METHOD_HEX[entry.method]} />
          ))}
        </Pie>
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value, _name, item) => {
            const datum = (item as { payload?: { count?: number } } | undefined)?.payload;
            const count = datum?.count ?? 0;
            return [`${formatVNDCompact(Number(value))} (${count} GD)`, 'Tổng'];
          }}
        />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}