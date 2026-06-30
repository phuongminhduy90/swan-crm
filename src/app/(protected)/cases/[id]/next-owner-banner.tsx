'use client';

import { UserCheck } from 'lucide-react';
import { ROLE_LABELS } from '@/config/roles';
import type { NextOwner, NextOwnerUrgency } from '@/constants/case-status';

/**
 * Story B.4.2 (F-CRIT-09) — Inline composite that surfaces the next-action
 * owner for a case on the Info tab. NOT a new UI primitive — composed from
 * existing tokens only (per UI_REFACTOR_PLAN §2 migration order #10).
 *
 * Co-located with the case detail page (sibling file) so it stays
 * "inline" in spirit while being importable from tests AND from any
 * future case-detail surface (e.g. customer detail, calendar slot).
 *
 * Visual rules (DESIGN_DIRECTION §15.3):
 *   - Color is always paired with an icon (UserCheck) AND text label
 *   - Status badge colors stay in `Badge`; this banner uses
 *     bg-*-50 / text-*-800 / border-*-200 utility palettes
 *   - Brand colors (swan aqua, champagne gold) communicate ownership/CTA,
 *     not state — urgency colors below are functional (red/amber/aqua-as-info)
 *
 * The component is pure: caller resolves the staffAssignment lookup so we
 * keep the test surface small and the component reusable in other case views.
 */
export function NextOwnerBanner({
  nextOwner,
  resolvedName,
}: {
  nextOwner: NextOwner;
  resolvedName: { displayName: string; isRoleFallback: boolean } | null;
}) {
  const urgencyStyles: Record<NextOwnerUrgency, {
    container: string;
    icon: string;
    title: string;
    roleChip: string;
  }> = {
    red: {
      container: 'border-red-200 bg-red-50',
      icon: 'text-red-500',
      title: 'text-red-800',
      roleChip: 'bg-white text-red-700 border-red-200',
    },
    amber: {
      container: 'border-amber-200 bg-amber-50',
      icon: 'text-amber-600',
      title: 'text-amber-800',
      roleChip: 'bg-white text-amber-700 border-amber-200',
    },
    aqua: {
      container: 'border-swan-200 bg-swan-50',
      icon: 'text-swan-600',
      title: 'text-swan-800',
      roleChip: 'bg-white text-swan-700 border-swan-200',
    },
  };
  const styles = urgencyStyles[nextOwner.urgency];

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="next-owner-banner"
      data-urgency={nextOwner.urgency}
      data-role={nextOwner.role}
      className={`rounded-2xl border p-4 shadow-sm ${styles.container}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white ${styles.icon}`}
          aria-hidden="true"
        >
          <UserCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-xs font-semibold uppercase tracking-wide ${styles.title}`}>
              Người phụ trách tiếp theo
            </p>
            <span
              data-testid="next-owner-role"
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles.roleChip}`}
            >
              {ROLE_LABELS[nextOwner.role]}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className={`text-sm font-medium ${styles.title}`}>
              {resolvedName ? resolvedName.displayName : 'Chưa phân công'}
            </span>
            {resolvedName?.isRoleFallback && (
              <span className="text-xs text-gray-500">(vai trò tổ chức)</span>
            )}
            {!resolvedName && (
              <span className="text-xs text-gray-500">(cần cập nhật phân công)</span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">{nextOwner.reason}</p>
        </div>
      </div>
    </div>
  );
}