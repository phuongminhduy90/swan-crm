import { X, Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';

export type DateRangeOption = 3 | 6 | 12 | 0; // 0 = all time

interface ReportFiltersProps {
  value: DateRangeOption;
  onChange: (v: DateRangeOption) => void;
  /** Called when user clicks X on the active pill or "Xóa tất cả bộ lọc" */
  onClear?: () => void;
  /** Label shown when a filter is active (e.g. "Đang lọc: 6 tháng"). If null, no active-filter banner is rendered. */
  activeFilterLabel?: string | null;
  className?: string;
}

export const DATE_RANGE_OPTIONS: { value: DateRangeOption; label: string }[] = [
  { value: 3, label: '3 tháng' },
  { value: 6, label: '6 tháng' },
  { value: 12, label: '12 tháng' },
  { value: 0, label: 'Tất cả' },
];

export function ReportFilters({
  value,
  onChange,
  onClear,
  activeFilterLabel,
  className,
}: ReportFiltersProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Filter pill bar */}
      <div className="inline-flex gap-1 rounded-xl border border-gray-100/80 bg-white p-1 shadow-soft">
        {DATE_RANGE_OPTIONS.map((opt) => {
          const isActive = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              data-testid={`report-filter-${opt.value}`}
              className={cn(
                'group relative inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200',
                isActive
                  ? 'bg-gradient-to-r from-swan-500 to-swan-600 text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50/80 hover:text-gray-700',
              )}
            >
              {isActive && <Check className="h-3 w-3" aria-hidden="true" />}
              {opt.label}
              {isActive && onClear && (
                <button
                  type="button"
                  aria-label={`Xóa bộ lọc ${opt.label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                  }}
                  className={cn(
                    'ml-0.5 rounded p-0.5 transition-colors',
                    'text-white/70 hover:bg-white/20 hover:text-white',
                  )}
                  data-testid={`report-filter-clear-${opt.value}`}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </button>
          );
        })}
      </div>

      {/* Active filter banner — shown when a non-default filter is active */}
      {activeFilterLabel && onClear && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-swan-200 bg-swan-50/80 px-3 py-1 text-xs font-medium text-swan-700">
            <Check className="h-3 w-3 text-swan-600" aria-hidden="true" />
            {activeFilterLabel}
            <button
              type="button"
              aria-label="Xóa bộ lọc"
              onClick={onClear}
              className="ml-0.5 rounded p-0.5 text-swan-400 transition-colors hover:bg-swan-100 hover:text-swan-600"
              data-testid="report-filter-clear-all"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-xs text-gray-500 hover:text-gray-700"
            data-testid="report-filter-xoa-tat-ca"
          >
            Xóa tất cả bộ lọc
          </Button>
        </div>
      )}
    </div>
  );
}
