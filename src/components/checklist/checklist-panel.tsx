'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, AlertTriangle, ClipboardCheck } from 'lucide-react';
import {
  evaluatePreHospitalChecklist,
  evaluatePreProcedureChecklist,
  type ChecklistItem,
} from '@/lib/checklist';
import { cn } from '@/lib/utils/cn';

type ChecklistType = 'pre_hospital' | 'pre_procedure';

interface Props {
  caseId: string;
  type?: ChecklistType;
}

const CHECKLIST_TYPE_LABELS: Record<ChecklistType, string> = {
  pre_hospital: 'Checklist trước điều trị',
  pre_procedure: 'Checklist trước phẫu thuật',
};

export function ChecklistPanel({ caseId, type = 'pre_hospital' }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [allPassed, setAllPassed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const evaluator =
          type === 'pre_hospital'
            ? evaluatePreHospitalChecklist
            : evaluatePreProcedureChecklist;
        const result = await evaluator(caseId);
        if (!cancelled) {
          setItems(result.items);
          setAllPassed(result.allPassed);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[ChecklistPanel] Failed to load:', err);
          setError('Không thể tải checklist');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [caseId, type]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-swan-200 border-t-swan-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  const requiredCount = items.filter((i) => i.required).length;
  const requiredPassed = items.filter((i) => i.required && i.passed).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-swan-600" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-swan-600">
            {CHECKLIST_TYPE_LABELS[type]}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {allPassed ? (
            <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Đạt yêu cầu
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              Chưa đạt ({requiredPassed}/{requiredCount})
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            allPassed ? 'bg-green-500' : 'bg-amber-400',
          )}
          style={{ width: `${requiredCount > 0 ? (requiredPassed / requiredCount) * 100 : 100}%` }}
        />
      </div>

      {/* Items */}
      <div className="space-y-1">
        {items.map((item) => (
          <div
            key={item.key}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
              item.passed
                ? 'bg-green-50/60'
                : item.required
                  ? 'bg-red-50/60'
                  : 'bg-gray-50/60',
            )}
          >
            {item.passed ? (
              <CheckCircle2 className="h-4.5 w-4.5 flex-shrink-0 text-green-500" />
            ) : (
              <Circle className="h-4.5 w-4.5 flex-shrink-0 text-gray-300" />
            )}
            <div className="min-w-0 flex-1">
              <span
                className={cn(
                  'text-sm',
                  item.passed ? 'text-green-700' : 'text-gray-700',
                )}
              >
                {item.label}
              </span>
            </div>
            {item.required && !item.passed && (
              <span className="flex-shrink-0 text-xs font-medium text-red-500">Bắt buộc</span>
            )}
            {item.passed && (
              <span className="flex-shrink-0 text-xs font-medium text-green-500">✓</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
