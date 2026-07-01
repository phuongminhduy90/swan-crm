'use client';

import { ReactNode } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { Modal } from './modal';
import { Button } from './button';

/**
 * Story B.2.4 — variant surface for `ConfirmDialog`.
 *
 * `warning` is the clinical "second-confirm" variant (amber icon).
 * `danger`  is destructive / irreversible (red icon, red confirm button).
 * `info`    is the default neutral confirmation (swan aqua icon).
 *
 * The same set of visual tokens is used by every consumer; do not branch
 * on `variant` outside this file.
 */
export type ConfirmDialogVariant = 'info' | 'warning' | 'danger';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * Visual + semantic tone of the dialog.
   *
   * Defaults to `'danger'` to preserve the historical behavior of every
   * existing caller (which all surfaced destructive actions).
   */
  variant?: ConfirmDialogVariant;
  loading?: boolean;
  /**
   * Story B.2.4 — disable the confirm button until preconditions are met
   * (e.g. `actualProcedureDate` filled). When `true`, the confirm button
   * is rendered as non-interactive and `onConfirm` is never invoked.
   */
  confirmDisabled?: boolean;
  /**
   * Story C.1.1 (Sprint 7.1) — per-context `aria-label` for the close icon
   * button in the top-right corner. Forwards to the underlying `<Modal>`,
   * which renders `<CloseIconButton>`. Defaults to the generic Vietnamese
   * "Đóng" so existing consumers stay backwards-compatible.
   *
   * Recommended copy is the action being confirmed, e.g.
   * "Đóng xác nhận xóa khách hàng".
   */
  closeLabel?: string;
}

const VARIANT_TONE: Record<ConfirmDialogVariant, {
  iconBg: string;
  iconColor: string;
  panelRing: string;
  confirmBtnVariant: 'danger' | 'primary';
}> = {
  info: {
    iconBg: 'bg-swan-50',
    iconColor: 'text-swan-500',
    panelRing: 'ring-1 ring-swan-200/70',
    confirmBtnVariant: 'primary',
  },
  warning: {
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
    panelRing: 'ring-1 ring-amber-300/70',
    confirmBtnVariant: 'primary',
  },
  danger: {
    iconBg: 'bg-red-50',
    iconColor: 'text-red-500',
    panelRing: 'ring-1 ring-red-300/70',
    confirmBtnVariant: 'danger',
  },
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  variant = 'danger',
  loading = false,
  confirmDisabled = false,
  closeLabel,
}: ConfirmDialogProps) {
  const tone = VARIANT_TONE[variant];
  // Info uses an "info" glyph; warning + danger both signal "caution" and
  // share the triangle visual with different palette colors.
  const Icon = variant === 'info' ? Info : AlertTriangle;

  // Story C.1.1 (Sprint 7.1) — when the consumer does not pass a per-context
  // `closeLabel`, synthesize one from the dialog's `title` so the screen
  // reader still gets meaningful context. Falls back to the Modal default
  // ("Đóng") only when both pieces are missing.
  const resolvedCloseLabel =
    closeLabel ??
    (title
      ? `Đóng xác nhận — ${title.replace(/\?$/, '').trim()}`
      : undefined);

  return (
    // The title is forwarded to `Modal` so the dialog panel automatically
    // wires `aria-labelledby` to the heading (Story A.2 a11y contract).
    // The body content (icon + description + buttons) is provided as
    // children — `description` itself is a ReactNode so it can host
    // arbitrary rich content (date inputs, checklist summaries, etc).
    // Story C.1.1 (Sprint 7.1) — `closeLabel` flows through `<Modal>` →
    // `<CloseIconButton>` so screen readers announce the specific dialog.
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      {...(resolvedCloseLabel !== undefined ? { closeLabel: resolvedCloseLabel } : {})}
    >
      <div className={`p-6 text-center ring-inset ${tone.panelRing}`}>
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${tone.iconBg} animate-scale-in`}>
          <Icon className={`h-7 w-7 ${tone.iconColor}`} aria-hidden="true" />
        </div>
        <div className="mt-2 text-sm text-gray-500">{description}</div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone.confirmBtnVariant}
            className="flex-1"
            onClick={onConfirm}
            isLoading={loading}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
