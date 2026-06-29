import { formatCompact } from '@/lib/utils/format';

// Swan brand colors for Recharts
export const SWAN_COLORS = {
  aqua: '#00ADBE',
  aquaDark: '#009BAB',
  gold: '#C9A96E',
  goldDark: '#B0925A',
  cream: '#FFF9F0',
  navy: '#1E3A5F',
} as const;

// Palette for multi-segment charts (pied, stacked bars)
export const CHART_PALETTE = [
  '#00ADBE', // aqua
  '#C9A96E', // gold
  '#8B5CF6', // violet
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EC4899', // pink
  '#6366F1', // indigo
  '#EF4444', // red
  '#14B8A6', // teal
  '#3B82F6', // blue
] as const;

// Recharts axis style
export const AXIS_STYLE = {
  tick: { fontSize: 12, fill: '#9CA3AF' },
  tickLine: false,
  axisLine: { stroke: '#E5E7EB' },
} as const;

// Recharts tooltip style
export const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#ffffff',
    border: '1px solid #E5E7EB',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
    padding: '8px 12px',
    fontSize: '13px',
  },
  itemStyle: { color: '#374151' },
} as const;

// Grid line style
export const GRID_STYLE = {
  strokeDasharray: '3 3',
  stroke: '#F3F4F6',
  vertical: false,
} as const;

/**
 * Recharts v3 Tooltip `formatter` helper.
 * Recharts types are loose (ValueType | undefined), so we cast safely.
 */
export function tooltipFormatVND(value: unknown): [string, string] {
  return [formatCompact(Number(value)) + ' VNĐ', ''];
}

export function tooltipFormatCount(value: unknown, label: string = 'Số lượng'): [string, string] {
  return [`${Number(value)} ${label}`, ''];
}