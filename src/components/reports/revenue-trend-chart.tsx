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
import {
  SWAN_COLORS,
  AXIS_STYLE,
  GRID_STYLE,
  REFUND_SERIES,
} from './chart-theme';
import { formatCompact, formatVNDCompact } from '@/lib/utils/format';

export interface MonthlyRevenuePoint {
  monthKey: string;
  label: string;
  confirmed: number;
  pending: number;
  /**
   * B.3.4 (F-HIGH-33): refund amount for the month. Always populated by the
   * parent `RevenueReport` so the chart can render the refund `<Line>` even
   * when no refunds exist (the line stays flat at 0 in that case).
   */
  refund: number;
}

interface RevenueTrendChartProps {
  data: MonthlyRevenuePoint[];
}

// B.3.4 (F-HIGH-33): custom tooltip that prefixes the refund series with the
// Vietnamese description required by the B.3.4 spec ("Tổng hoàn tiền đã xác
// nhận trong kỳ"). Recharts v3 loose typing forces `unknown` for `payload`.
interface CustomTooltipPayloadItem {
  dataKey?: string | number;
  name?: string;
  value?: unknown;
  color?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  label?: string | number;
}

function RevenueTrendTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #E5E7EB',
        borderRadius: 12,
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
        padding: '8px 12px',
        fontSize: 13,
        color: '#374151',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((entry) => {
        const isRefund = entry.dataKey === 'refund';
        const valueStr = formatCompact(Number(entry.value ?? 0)) + ' VNĐ';
        return (
          <div key={String(entry.dataKey ?? entry.name ?? '')} style={{ color: '#374151' }}>
            <span style={{ color: entry.color, marginRight: 6 }}>●</span>
            {entry.name}
            {isRefund && (
              <span style={{ color: '#6B7280', marginLeft: 6, fontSize: 11 }}>
                ({REFUND_SERIES.description})
              </span>
            )}
            : <span style={{ fontWeight: 600 }}>{valueStr}</span>
          </div>
        );
      })}
    </div>
  );
}

export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  // B.3.4 (F-HIGH-33): both `<Line>` series are always rendered so the chart
  // shape is predictable. Months without refunds fall through to 0 — the
  // refund line stays flat at the X-axis. Total refund is still calculated
  // for the annotation footer below.
  const totalConfirmed = data.reduce((sum, d) => sum + (d.confirmed ?? 0), 0);
  const totalRefund = data.reduce((sum, d) => sum + (d.refund ?? 0), 0);
  const totalNet = totalConfirmed - totalRefund;

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Chưa có dữ liệu
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="label" {...AXIS_STYLE} />
            <YAxis
              {...AXIS_STYLE}
              tickFormatter={(v) => formatCompact(Number(v))}
            />
            <Tooltip content={<RevenueTrendTooltip />} cursor={{ stroke: '#9CA3AF', strokeDasharray: '3 3' }} />
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
            {/* B.3.4 (F-HIGH-33): refund line is always rendered. The parent
                populates `refund: 0` for months without refunds so the line
                sits flat at 0 rather than disappearing — this keeps the
                chart legend stable across periods. */}
            <Line
              type="monotone"
              dataKey="refund"
              name={REFUND_SERIES.label}
              stroke={REFUND_SERIES.color}
              strokeWidth={2}
              strokeDasharray="2 4"
              dot={{ r: 3, fill: REFUND_SERIES.color }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* B.3.4 (F-HIGH-33): annotation footer — clarifies that net confirmed
          revenue is `confirmed − refund` ("Đã xác nhận − Hoàn tiền"). Visible
          whenever there is at least one confirmed payment in the period.
          On small viewports (`<sm`) the annotation collapses; the same
          information is shown by hovering the refund line. */}
      {totalConfirmed > 0 && (
        <p
          className="mt-2 hidden px-1 text-xs text-gray-500 sm:block"
          data-testid="revenue-annotation"
        >
          Đã xác nhận − Hoàn tiền ={' '}
          <span className="font-semibold tabular-nums text-gray-700">
            {formatVNDCompact(totalNet)}
          </span>{' '}
          <span className="text-gray-400">
            ({formatVNDCompact(totalConfirmed)} − {formatVNDCompact(totalRefund)})
          </span>
        </p>
      )}

      {/* B.3.4 (F-HIGH-33): mobile-only summary — replaces the desktop
          annotation when there is no room to show the full equation. Same
          Vietnamese copy as the desktop annotation but condensed. */}
      {totalConfirmed > 0 && (
        <p
          className="mt-2 block px-1 text-xs text-gray-500 sm:hidden"
          data-testid="revenue-annotation-mobile"
        >
          Đã xác nhận − Hoàn tiền ={' '}
          <span className="font-semibold tabular-nums text-gray-700">
            {formatVNDCompact(totalNet)}
          </span>
        </p>
      )}
    </div>
  );
}