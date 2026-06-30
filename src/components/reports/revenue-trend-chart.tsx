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
import { formatCompact, formatVNDCompact } from '@/lib/utils/format';

export interface MonthlyRevenuePoint {
  monthKey: string;
  label: string;
  confirmed: number;
  pending: number;
  /**
   * B.3.3 (F-HIGH-33): refund amount for the month. Only present when at
   * least one month has a refund. The line is conditionally rendered so
   * months without refunds stay flat on the confirmed trend only.
   */
  refund?: number;
}

interface RevenueTrendChartProps {
  data: MonthlyRevenuePoint[];
}

// B.3.3 (F-HIGH-33): red colour for the refund line. Picked to match the
// cancelled-status red (#EF4444) so users immediately associate refund with
// money flowing out.
const REFUND_COLOR = '#EF4444';

export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  // B.3.3 (F-HIGH-33): only render the refund line if existing data actually
  // contains a refund. This protects us from drawing an empty line when no
  // month has any refund.
  const hasRefund = data.some((d) => (d.refund ?? 0) > 0);

  // Net revenue for the annotation: Đã xác nhận − Hoàn tiền (per month).
  // Used by both the chart (for the annotation footer) and the tooltip.
  const netByMonth = data.map((d) => ({
    ...d,
    net: (d.confirmed ?? 0) - (d.refund ?? 0),
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Chưa có dữ liệu
      </div>
    );
  }

  const totalConfirmed = data.reduce((sum, d) => sum + (d.confirmed ?? 0), 0);
  const totalRefund = data.reduce((sum, d) => sum + (d.refund ?? 0), 0);
  const totalNet = totalConfirmed - totalRefund;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={netByMonth} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
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
            {hasRefund && (
              <Line
                type="monotone"
                dataKey="refund"
                name="Hoàn tiền"
                stroke={REFUND_COLOR}
                strokeWidth={2}
                strokeDasharray="2 4"
                dot={{ r: 3, fill: REFUND_COLOR }}
                activeDot={{ r: 5 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* B.3.3 (F-HIGH-33): annotation — clarifies that net confirmed revenue is
          confirmed minus refund. Visible whenever there is at least one
          confirmed payment in the period. */}
      {totalConfirmed > 0 && (
        <p
          className="mt-2 px-1 text-xs text-gray-500"
          data-testid="revenue-annotation"
        >
          {hasRefund ? (
            <>
              Đã xác nhận − Hoàn tiền ={' '}
              <span className="font-semibold tabular-nums text-gray-700">
                {formatVNDCompact(totalNet)}
              </span>{' '}
              <span className="text-gray-400">
                ({formatVNDCompact(totalConfirmed)} − {formatVNDCompact(totalRefund)})
              </span>
            </>
          ) : (
            <>
              Đã xác nhận ={' '}
              <span className="font-semibold tabular-nums text-gray-700">
                {formatVNDCompact(totalConfirmed)}
              </span>{' '}
              <span className="text-gray-400">(chưa có hoàn tiền trong kỳ)</span>
            </>
          )}
        </p>
      )}
    </div>
  );
}