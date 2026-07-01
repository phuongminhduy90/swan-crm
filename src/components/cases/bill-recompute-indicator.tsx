'use client';

import { CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { isFlagEnabled } from '@/lib/feature-flags';
import { Tooltip } from '@/components/ui/tooltip';
import type { CaseRecord } from '@/lib/types';
import type { RecomputeStatus, RecomputeTrigger } from '@/lib/types/billing';

/**
 * Story PI-1 (Sprint 7.2) — Bill recompute indicator chip.
 *
 * Renders next to "Tổng bill" on the case-detail Info tab to answer the
 * accountant question "when was the bill last reconciled with the payment
 * history?". Three observable states:
 *
 *  - `synced`  — `Đã đồng bộ hóa lúc HH:mm`  (emerald, steady state)
 *  - `syncing` — `Đang đồng bộ hóa...`        (swan, transient spinner)
 *  - `stale`   — `Cần đồng bộ hóa`            (amber, no recompute yet)
 *
 * The chip is gated behind `NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE` so production
 * keeps the Sprint 6.4 baseline (no visual surface) until the C-7 / C-8
 * accountant sign-off in Sprint 7.2 §3.3.
 *
 * Design notes:
 *  - Until F-HIGH-28 ships `recomputeBill()`, the chip uses
 *    `caseRecord.updatedAt` as a proxy for "last recompute timestamp". This
 *    is intentional — the chip must render correctly without depending on the
 *    pure recompute function (see Sprint 7.2 §4.2 day 2 dependency edge).
 *  - Vietnamese copy: every visible string passes the ux-designer copy spec
 *    in Sprint 7.2 §8.1 "Vietnamese copy reviewed".
 *  - Tooltip is built from the shared `<Tooltip>` primitive (Sprint 6.4) so
 *    we do not regress anti-pattern A1 (hand-rolled hover overlays).
 *  - `data-testid` is stable across viewports — Playwright visual regression
 *    harness (qa-architect Layer 9) targets the same selector on every
 *    breakpoint.
 *
 * @see docs/ux-redesign/SPRINT_7_2_EXECUTION_PLAN.md §1 (PI-1), §5.1, §10.3
 */

export interface BillRecomputeIndicatorProps {
  caseRecord: CaseRecord;
  /** Override status (e.g. parent owns the in-flight boolean). Optional. */
  status?: RecomputeStatus;
  /**
   * Optional pre-computed snapshot. When omitted the indicator falls back to
   * `caseRecord.updatedAt` as a proxy timestamp (PI-1 ships without the full
   * F-HIGH-28 recompute function).
   */
  recomputedAt?: string;
  /** Optional trigger for the tooltip copy. Defaults to `'case_loaded'`. */
  trigger?: RecomputeTrigger;
  /** Extra className for the chip wrapper. */
  className?: string;
}

const TRIGGER_COPY: Record<RecomputeTrigger, string> = {
  service_added: 'Sau khi thêm dịch vụ',
  service_removed: 'Sau khi xóa dịch vụ',
  payment_confirmed: 'Sau khi xác nhận thanh toán',
  payment_rejected: 'Sau khi từ chối thanh toán',
  refund_created: 'Sau khi tạo hoàn tiền',
  manual_recompute: 'Đồng bộ hóa thủ công',
  case_loaded: 'Khi mở hồ sơ CASE',
};

/**
 * Format an ISO timestamp as `HH:mm` (24h, local time).
 * Returns `'--:--'` for unparseable input so the chip never renders blank.
 */
function formatHHmm(input: string | null | undefined): string {
  if (!input) return '--:--';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '--:--';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

interface ChipStyle {
  container: string;
  iconColor: string;
}

const CHIP_STYLES: Record<RecomputeStatus, ChipStyle> = {
  synced: {
    container:
      'border-emerald-200 bg-emerald-50/80 text-emerald-700',
    iconColor: 'text-emerald-500',
  },
  syncing: {
    container:
      'border-swan-200 bg-swan-50/80 text-swan-700',
    iconColor: 'text-swan-500',
  },
  stale: {
    container:
      'border-amber-200 bg-amber-50/80 text-amber-700',
    iconColor: 'text-amber-500',
  },
};

const STATUS_COPY: Record<RecomputeStatus, (time: string) => string> = {
  synced: (time) => `Đã đồng bộ hóa lúc ${time}`,
  syncing: () => 'Đang đồng bộ hóa...',
  stale: () => 'Cần đồng bộ hóa',
};

const STATUS_TEST_ID: Record<RecomputeStatus, string> = {
  synced: 'bill-recompute-synced',
  syncing: 'bill-recompute-syncing',
  stale: 'bill-recompute-stale',
};

const STATUS_ICON_TEST_ID: Record<RecomputeStatus, string> = {
  synced: 'bill-recompute-icon-synced',
  syncing: 'bill-recompute-icon-syncing',
  stale: 'bill-recompute-icon-stale',
};

export function BillRecomputeIndicator({
  caseRecord,
  status: statusOverride,
  recomputedAt,
  trigger = 'case_loaded',
  className,
}: BillRecomputeIndicatorProps) {
  // Feature-flag gate — production keeps the indicator hidden until the
  // C-7 accountant pairing session signs off (Sprint 7.2 §3.3).
  if (!isFlagEnabled('BILL_RECOMPUTE')) return null;

  // Determine the chip state. Priority: explicit override > proxy timestamp.
  const timestamp = recomputedAt ?? caseRecord.updatedAt;
  const hasValidTimestamp =
    !!timestamp && !Number.isNaN(new Date(timestamp).getTime());

  let status: RecomputeStatus;
  if (statusOverride) {
    status = statusOverride;
  } else if (!hasValidTimestamp) {
    status = 'stale';
  } else {
    status = 'synced';
  }

  const time = formatHHmm(timestamp);
  const label = STATUS_COPY[status](time);
  const tooltipText = `${label} — ${TRIGGER_COPY[trigger]}`;
  const styles = CHIP_STYLES[status];

  return (
    <Tooltip content={tooltipText}>
      <span
        data-testid={STATUS_TEST_ID[status]}
        data-recompute-status={status}
        data-recompute-time={time}
        data-recompute-trigger={trigger}
        aria-label={tooltipText}
        role="status"
        aria-live={status === 'syncing' ? 'polite' : 'off'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shadow-soft transition-colors',
          styles.container,
          className,
        )}
      >
        <StatusIcon status={status} iconColor={styles.iconColor} />
        <span className="whitespace-nowrap">{label}</span>
      </span>
    </Tooltip>
  );
}

function StatusIcon({
  status,
  iconColor,
}: {
  status: RecomputeStatus;
  iconColor: string;
}) {
  const sharedProps = {
    'aria-hidden': true,
    className: cn('h-3.5 w-3.5 flex-shrink-0', iconColor),
  };

  if (status === 'synced') {
    return (
      <span data-testid={STATUS_ICON_TEST_ID.synced}>
        <CheckCircle2 {...sharedProps} />
      </span>
    );
  }
  if (status === 'syncing') {
    return (
      <span data-testid={STATUS_ICON_TEST_ID.syncing}>
        <Loader2 {...sharedProps} className={cn(sharedProps.className, 'animate-spin')} />
      </span>
    );
  }
  // stale
  return (
    <span data-testid={STATUS_ICON_TEST_ID.stale}>
      {/* RefreshCw is the "needs refresh" icon — distinct from the syncing spinner. */}
      <RefreshCw {...sharedProps} />
    </span>
  );
}