'use client';

import { CaseStatus } from '@/lib/types';
import { CASE_STATUS_LABELS, CASE_STATUS_COLORS } from '@/constants/case-status';
import { cn } from '@/lib/utils/cn';

interface StatusBadgeProps {
  status: CaseStatus;
  className?: string;
  size?: 'sm' | 'md';
}

export function CaseStatusBadge({ status, className, size = 'md' }: StatusBadgeProps) {
  const label = CASE_STATUS_LABELS[status] ?? status;
  const colors = CASE_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600 border-gray-200';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        colors,
        className,
      )}
    >
      {label}
    </span>
  );
}
