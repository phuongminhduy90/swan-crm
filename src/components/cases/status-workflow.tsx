'use client';

import { useState } from 'react';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import type { CaseStatus } from '@/lib/types';
import { CASE_STATUS_LABELS, CASE_STATUS_COLORS, CASE_STATUS_TRANSITIONS } from '@/constants/case-status';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils/cn';

interface Props {
  currentStatus: CaseStatus;
  onTransition: (newStatus: CaseStatus) => Promise<void>;
  loading?: boolean;
}

export function StatusWorkflow({ currentStatus, onTransition, loading = false }: Props) {
  const [confirmTarget, setConfirmTarget] = useState<CaseStatus | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const allowedTransitions = CASE_STATUS_TRANSITIONS[currentStatus] ?? [];

  if (allowedTransitions.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
        Trạng thái hiện tại không có phép chuyển tiếp nào.
      </div>
    );
  }

  async function handleConfirm() {
    if (!confirmTarget) return;
    setTransitioning(true);
    try {
      await onTransition(confirmTarget);
      setConfirmTarget(null);
    } catch (err) {
      console.error('[StatusWorkflow] Transition error:', err);
    } finally {
      setTransitioning(false);
    }
  }

  // Separate "safe" forward transitions from terminal/caution ones
  const cautionStatuses: CaseStatus[] = ['cancelled', 'postponed', 'medical_alert', 'complaint'];
  const safeTransitions = allowedTransitions.filter((s) => !cautionStatuses.includes(s));
  const cautionTransitions = allowedTransitions.filter((s) => cautionStatuses.includes(s));

  return (
    <div className="space-y-4">
      {/* Current status */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-600">Trạng thái hiện tại:</span>
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium',
            CASE_STATUS_COLORS[currentStatus],
          )}
        >
          {CASE_STATUS_LABELS[currentStatus] ?? currentStatus}
        </span>
      </div>

      {/* Forward transitions */}
      {safeTransitions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
            Chuyển tiếp
          </p>
          <div className="flex flex-wrap gap-2">
            {safeTransitions.map((s) => (
              <Button
                key={s}
                variant="outline"
                size="sm"
                isLoading={loading || transitioning}
                onClick={() => setConfirmTarget(s)}
                leftIcon={<ArrowRight className="h-3.5 w-3.5" />}
              >
                {CASE_STATUS_LABELS[s] ?? s}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Caution transitions */}
      {cautionTransitions.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-amber-500">
            <AlertTriangle className="h-3.5 w-3.5" />
            Hành động đặc biệt
          </p>
          <div className="flex flex-wrap gap-2">
            {cautionTransitions.map((s) => (
              <Button
                key={s}
                variant="outline"
                size="sm"
                isLoading={loading || transitioning}
                onClick={() => setConfirmTarget(s)}
                className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
              >
                {CASE_STATUS_LABELS[s] ?? s}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        open={!!confirmTarget}
        title="Xác nhận chuyển trạng thái?"
        description={
          <span>
            Chuyển từ{' '}
            <strong>{CASE_STATUS_LABELS[currentStatus]}</strong> sang{' '}
            <strong className={cn('rounded px-1 py-0.5 text-xs', CASE_STATUS_COLORS[confirmTarget ?? currentStatus])}>
              {confirmTarget ? CASE_STATUS_LABELS[confirmTarget] : ''}
            </strong>
            ?
          </span>
        }
        confirmLabel="Xác nhận"
        loading={transitioning}
        onConfirm={handleConfirm}
        onClose={() => setConfirmTarget(null)}
      />
    </div>
  );
}
