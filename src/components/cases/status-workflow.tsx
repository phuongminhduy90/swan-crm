'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import type { CaseStatus } from '@/lib/types';
import { CASE_STATUS_LABELS, CASE_STATUS_COLORS, CASE_STATUS_TRANSITIONS } from '@/constants/case-status';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { isFlagEnabled } from '@/lib/feature-flags';
import { isGatedTransition } from '@/lib/checklist';
import { cn } from '@/lib/utils/cn';

/**
 * Story B.2.4 — extra payload allowed on transition callbacks.
 *
 * `actualProcedureDate` is REQUIRED when transitioning to
 * `procedure_completed`. The dialog refuses to enable its confirm button
 * until this field is filled.
 */
export interface StatusTransitionExtra {
  actualProcedureDate?: string;
}

export interface ChecklistSummary {
  allPassed: boolean;
  /** Number of required items that currently pass. */
  passedCount: number;
  /** Total number of required items. */
  totalCount: number;
}

export interface ProcedureSideEffectSummary {
  /** Number of post-op follow-ups that will be auto-created. */
  followupsCount: number;
  /** Free-text description of other side-effects (e.g. tasks). */
  tasksDescription?: string;
}

interface Props {
  currentStatus: CaseStatus;
  onTransition: (newStatus: CaseStatus, extra?: StatusTransitionExtra) => Promise<void>;
  loading?: boolean;
  /**
   * Story B.2.4 — pre-populated `actualProcedureDate` (ISO `YYYY-MM-DD`).
   * When omitted, the dialog starts empty.
   */
  initialProcedureDate?: string;
  /**
   * Story B.2.4 — pre-procedure checklist summary shown in the
   * `procedure_completed` confirm dialog. When omitted, the dialog
   * renders "Không có dữ liệu checklist".
   */
  checklistSummary?: ChecklistSummary;
  /**
   * Story B.2.4 — summary of side-effects surfaced after the transition.
   */
  sideEffectSummary?: ProcedureSideEffectSummary;
  /**
   * Story B.2.1 — names of pre-procedure checklist keys that currently fail
   * (used to render the red banner copy). When omitted, the banner shows
   * the generic "thiếu một số mục" copy.
   */
  failedChecklistKeys?: string[];
  /**
   * Story B.2.1 — ref to the checklist section so the "Mở checklist" CTA
   * can scroll the user back to the panel instead of navigating to a dead
   * URL (anti-pattern A8).
   */
  checklistAnchorRef?: React.RefObject<HTMLElement>;
}

export function StatusWorkflow({
  currentStatus,
  onTransition,
  loading = false,
  initialProcedureDate,
  checklistSummary,
  sideEffectSummary,
  failedChecklistKeys,
  checklistAnchorRef,
}: Props) {
  const [confirmTarget, setConfirmTarget] = useState<CaseStatus | null>(null);
  const [transitioningTo, setTransitioningTo] = useState<string | null>(null);

  // Story B.2.4 — controlled date input for the `procedure_completed`
  // second-confirm dialog. Resets whenever the dialog closes.
  const [procedureDate, setProcedureDate] = useState<string>(initialProcedureDate ?? '');

  useEffect(() => {
    if (confirmTarget === null) {
      setProcedureDate(initialProcedureDate ?? '');
    }
  }, [confirmTarget, initialProcedureDate]);

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
    const target = confirmTarget;
    setTransitioningTo(target);
    try {
      // Story B.2.4 — pipe the captured `actualProcedureDate` through the
      // transition callback so the page can persist it on the case BEFORE
      // (or atomically with) the status write. For non-procedure_completed
      // transitions, no extra payload is forwarded.
      const extra: StatusTransitionExtra =
        target === 'procedure_completed'
          ? { actualProcedureDate: procedureDate || undefined }
          : {};
      await onTransition(target, extra);
      setConfirmTarget(null);
    } catch (err) {
      console.error('[StatusWorkflow] Transition error:', err);
    } finally {
      setTransitioningTo(null);
    }
  }

  // Separate "safe" forward transitions from terminal/caution ones
  const cautionStatuses: CaseStatus[] = ['cancelled', 'postponed', 'medical_alert', 'complaint'];
  const safeTransitions = allowedTransitions.filter((s) => !cautionStatuses.includes(s));
  const cautionTransitions = allowedTransitions.filter((s) => cautionStatuses.includes(s));

  // Story B.2.4 — when the user is about to flip the case into
  // `procedure_completed`, we render the rich second-confirm dialog instead
  // of the generic one.
  const isProcedureCompletion = confirmTarget === 'procedure_completed';

  // Story B.2.1 — clinical checklist gate.
  //
  // When `FEATURE_CHECKLIST_GATE` is ON and `allPassed === false`, the
  // buttons leading to the 3 gated transitions become disabled and a red
  // banner appears above the action area.
  //
  // The same set (`GATED_TRANSITIONS` exported from `@/lib/checklist`) is
  // consulted server-side in `PATCH /api/cases/[id]/status` so UI and
  // server stay in sync.
  const gateFlagOn = isFlagEnabled('CHECKLIST_GATE');
  const allChecklistPassed = checklistSummary?.allPassed ?? true;
  const showGateBanner = gateFlagOn && !allChecklistPassed;
  // Whether a specific transition button should be disabled by the gate.
  function isButtonGated(target: CaseStatus): boolean {
    return showGateBanner && isGatedTransition(target);
  }
  const gateDisabledReason =
    'Hoàn thành checklist trước khi chuyển trạng thái';
  // The "Mở checklist" CTA uses an explicit prop ref if the page provides
  // one, otherwise falls back to a DOM lookup on the static id
  // `clinical-checklist-anchor` rendered by the case detail page.
  function scrollToChecklist() {
    if (checklistAnchorRef?.current) {
      checklistAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (typeof document === 'undefined') return;
    const el = document.getElementById('clinical-checklist-anchor');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="space-y-4">
      {/* Story B.2.1 — red gate banner. Shown when the gate flag is on AND
          the checklist has not all passed. Persistent (not dismissible)
          until the checklist passes or the user navigates away. */}
      {showGateBanner && (
        <div
          role="alert"
          aria-live="polite"
          data-testid="checklist-gate-banner"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-medium text-red-800">
                Ca chưa sẵn sàng — vui lòng hoàn thành toàn bộ checklist
                trước khi chuyển trạng thái.
              </p>
              {failedChecklistKeys && failedChecklistKeys.length > 0 && (
                <p className="text-xs text-red-600">
                  Thiếu: {failedChecklistKeys.join(', ')}.
                </p>
              )}
              <button
                type="button"
                onClick={scrollToChecklist}
                className="mt-1 text-xs font-medium text-red-700 underline underline-offset-2 hover:text-red-900"
              >
                Mở checklist
              </button>
            </div>
          </div>
        </div>
      )}
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
            {safeTransitions.map((s) => {
              const gated = isButtonGated(s);
              return (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  isLoading={loading || transitioningTo === s}
                  disabled={loading || !!transitioningTo || gated}
                  aria-describedby={gated ? 'checklist-gate-banner' : undefined}
                  title={gated ? gateDisabledReason : undefined}
                  onClick={() => setConfirmTarget(s)}
                  leftIcon={<ArrowRight className="h-3.5 w-3.5" />}
                  className={cn(gated && 'opacity-50 cursor-not-allowed')}
                >
                  {CASE_STATUS_LABELS[s] ?? s}
                </Button>
              );
            })}
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
            {cautionTransitions.map((s) => {
              const gated = isButtonGated(s);
              return (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  isLoading={loading || transitioningTo === s}
                  disabled={loading || !!transitioningTo || gated}
                  aria-describedby={gated ? 'checklist-gate-banner' : undefined}
                  title={gated ? gateDisabledReason : undefined}
                  onClick={() => setConfirmTarget(s)}
                  className={cn(
                    'border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800',
                    gated && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  {CASE_STATUS_LABELS[s] ?? s}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/*
        Story B.2.4 — `procedure_completed` second-confirm dialog.
        Uses the `warning` variant, requires `actualProcedureDate`, and
        surfaces side-effect + checklist summaries so the user sees what
        the transition does before committing.
      */}
      {isProcedureCompletion ? (
        <ConfirmDialog
          open={!!confirmTarget}
          variant="warning"
          title="Hoàn thành thủ thuật"
          confirmLabel={loading || transitioningTo ? 'Đang lưu...' : 'Xác nhận hoàn thành'}
          cancelLabel="Hủy"
          loading={loading || !!transitioningTo}
          confirmDisabled={!procedureDate}
          closeLabel="Đóng hộp thoại hoàn thành thủ thuật"
          description={
            <div className="space-y-3 text-left">
              <p className="text-sm text-gray-600">
                Bạn đã chắc chắn muốn chuyển ca sang trạng thái{' '}
                <strong className={cn('inline-block rounded px-1.5 py-0.5 text-xs', CASE_STATUS_COLORS.procedure_completed)}>
                  {CASE_STATUS_LABELS.procedure_completed}
                </strong>
                ? Hành động này sẽ kích hoạt tự động tạo followup hậu phẫu và không thể hoàn tác.
              </p>

              {/* Checklist summary — surfaces the gate state inside the
                  dialog so the user can self-correct before confirming. */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-amber-800">Checklist tiền thủ thuật</span>
                  {checklistSummary ? (
                    checklistSummary.allPassed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        ✓ Đạt {checklistSummary.passedCount}/{checklistSummary.totalCount}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        ✗ Thiếu {checklistSummary.totalCount - checklistSummary.passedCount}/{checklistSummary.totalCount}
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-amber-700">Không có dữ liệu</span>
                  )}
                </div>
                {checklistSummary && !checklistSummary.allPassed && (
                  <p className="mt-1 text-xs text-amber-700">
                    Vui lòng hoàn thành các hạng mục còn thiếu trước khi xác nhận.
                  </p>
                )}
              </div>

              {/* Side-effects summary — number of followups + tasks that
                  will be auto-created. */}
              {sideEffectSummary && (
                <div className="rounded-xl border border-swan-200 bg-swan-50/60 px-3 py-2 text-sm">
                  <p className="font-medium text-swan-800">Sẽ tự động tạo:</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-swan-700">
                    <li>
                      • {sideEffectSummary.followupsCount} followup hậu phẫu (D1, D3, D7, D14, D30, D90)
                    </li>
                    {sideEffectSummary.tasksDescription && (
                      <li>• {sideEffectSummary.tasksDescription}</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Required field — actualProcedureDate. The confirm button
                  stays disabled until the field is filled in. */}
              <div className="pt-1">
                <label
                  htmlFor="actual-procedure-date"
                  className="mb-1 block text-left text-sm font-medium text-gray-700"
                >
                  Ngày thực hiện thủ thuật <span className="text-red-500">*</span>
                </label>
                <Input
                  id="actual-procedure-date"
                  type="date"
                  value={procedureDate}
                  onChange={(e) => setProcedureDate(e.target.value)}
                  aria-required="true"
                  required
                  max={new Date().toISOString().slice(0, 10)}
                />
                <p className="mt-1 text-left text-xs text-gray-400">
                  Ngày này là nguồn dữ liệu gốc để lên lịch các mốc theo dõi hậu phẫu (D1 → D90).
                </p>
              </div>
            </div>
          }
          onConfirm={handleConfirm}
          onClose={() => setConfirmTarget(null)}
        />
      ) : (
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
          loading={!!transitioningTo}
          variant={
            confirmTarget && cautionStatuses.includes(confirmTarget) ? 'warning' : 'info'
          }
          onConfirm={handleConfirm}
          onClose={() => setConfirmTarget(null)}
          closeLabel="Đóng hộp thoại xác nhận chuyển trạng thái"
        />
      )}
    </div>
  );
}
