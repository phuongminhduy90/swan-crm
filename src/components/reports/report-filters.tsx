import { cn } from '@/lib/utils/cn';

export type DateRangeOption = 3 | 6 | 12 | 0; // 0 = all time

interface ReportFiltersProps {
  value: DateRangeOption;
  onChange: (v: DateRangeOption) => void;
  className?: string;
}

const options: { value: DateRangeOption; label: string }[] = [
  { value: 3, label: '3 tháng' },
  { value: 6, label: '6 tháng' },
  { value: 12, label: '12 tháng' },
  { value: 0, label: 'Tất cả' },
];

export function ReportFilters({ value, onChange, className }: ReportFiltersProps) {
  return (
    <div className={cn('inline-flex gap-1 rounded-xl border border-gray-100/80 bg-white p-1 shadow-soft', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200',
            value === opt.value
              ? 'bg-gradient-to-r from-swan-500 to-swan-600 text-white shadow-sm'
              : 'text-gray-500 hover:bg-gray-50/80 hover:text-gray-700',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
