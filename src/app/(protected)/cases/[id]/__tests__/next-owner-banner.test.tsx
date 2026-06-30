/**
 * Story B.4.2 (F-CRIT-09) — Next-owner banner component tests.
 *
 * Verifies:
 *  - Banner renders role + display name + reason
 *  - Color tokens match urgency level (red/amber/aqua)
 *  - "Chưa phân công" fallback when resolvedName is null
 *  - "(vai trò tổ chức)" suffix shown when role fallback used
 *  - Vietnamese copy throughout
 *  - a11y: role="status" + aria-live="polite"
 *
 * @see docs/ux-redesign/STORY_6_3_2_IMPLEMENTATION_REPORT.md
 */

import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { NextOwnerBanner } from '@/app/(protected)/cases/[id]/next-owner-banner';
import { getNextOwner } from '@/constants/case-status';
import type { CaseStatus } from '@/lib/types';

describe('NextOwnerBanner — Story B.4.2 (F-CRIT-09)', () => {
  describe('renders role + display name + reason', () => {
    it('shows role label, name, and reason for waiting_doctor_review', () => {
      const nextOwner = getNextOwner('waiting_doctor_review')!;
      expect(nextOwner).not.toBeNull();
      expect(nextOwner.role).toBe('doctor');

      renderWithProviders(
        <NextOwnerBanner
          nextOwner={nextOwner}
          resolvedName={{ displayName: 'BS. Nguyễn Văn A', isRoleFallback: false }}
        />,
      );

      // Header label
      expect(screen.getByText('Người phụ trách tiếp theo')).toBeInTheDocument();
      // Role chip uses ROLE_LABELS['doctor'] → 'Bác sĩ'
      expect(screen.getByText('Bác sĩ')).toBeInTheDocument();
      // Display name
      expect(screen.getByText('BS. Nguyễn Văn A')).toBeInTheDocument();
      // Reason text — must be present
      expect(
        screen.getByText(/Đang chờ bác sĩ duyệt hồ sơ chuyên môn/i),
      ).toBeInTheDocument();
    });
  });

  describe('urgency-driven color tokens', () => {
    it('medical_alert → red urgency token on container', () => {
      const nextOwner = getNextOwner('medical_alert')!;
      const { container } = renderWithProviders(
        <NextOwnerBanner
          nextOwner={nextOwner}
          resolvedName={{ displayName: 'BS. Trần', isRoleFallback: false }}
        />,
      );
      const banner = container.querySelector('[data-testid="next-owner-banner"]');
      expect(banner).not.toBeNull();
      expect(banner?.getAttribute('data-urgency')).toBe('red');
      expect(banner?.className).toMatch(/border-red-200/);
      expect(banner?.className).toMatch(/bg-red-50/);
    });

    it('waiting_doctor_review → amber urgency token', () => {
      const nextOwner = getNextOwner('waiting_doctor_review')!;
      const { container } = renderWithProviders(
        <NextOwnerBanner
          nextOwner={nextOwner}
          resolvedName={{ displayName: 'BS. Lê', isRoleFallback: false }}
        />,
      );
      const banner = container.querySelector('[data-testid="next-owner-banner"]');
      expect(banner?.getAttribute('data-urgency')).toBe('amber');
      expect(banner?.className).toMatch(/border-amber-200/);
      expect(banner?.className).toMatch(/bg-amber-50/);
    });

    it('hospital_confirmed → aqua (swan) urgency token', () => {
      const nextOwner = getNextOwner('hospital_confirmed')!;
      const { container } = renderWithProviders(
        <NextOwnerBanner
          nextOwner={nextOwner}
          resolvedName={{ displayName: 'BS. Phạm', isRoleFallback: false }}
        />,
      );
      const banner = container.querySelector('[data-testid="next-owner-banner"]');
      expect(banner?.getAttribute('data-urgency')).toBe('aqua');
      expect(banner?.className).toMatch(/border-swan-200/);
      expect(banner?.className).toMatch(/bg-swan-50/);
    });
  });

  describe('missing assignment fallback', () => {
    it('renders "Chưa phân công" when resolvedName is null', () => {
      const nextOwner = getNextOwner('draft')!;
      renderWithProviders(
        <NextOwnerBanner nextOwner={nextOwner} resolvedName={null} />,
      );

      // Should show the fallback Vietnamese text — NO raw user-001 leakage
      expect(screen.getByText('Chưa phân công')).toBeInTheDocument();
      expect(screen.queryByText(/user-\d{3}/)).toBeNull();
    });

    it('shows "(cần cập nhật phân công)" hint next to fallback', () => {
      const nextOwner = getNextOwner('draft')!;
      renderWithProviders(
        <NextOwnerBanner nextOwner={nextOwner} resolvedName={null} />,
      );
      expect(screen.getByText(/\(cần cập nhật phân công\)/)).toBeInTheDocument();
    });
  });

  describe('org-level role fallback (CSO on complaint)', () => {
    it('renders the role label and "(vai trò tổ chức)" suffix', () => {
      const nextOwner = getNextOwner('complaint')!;
      expect(nextOwner.staffField).toBeNull();
      renderWithProviders(
        <NextOwnerBanner
          nextOwner={nextOwner}
          resolvedName={{ displayName: 'Giám đốc CS', isRoleFallback: true }}
        />,
      );
      // ROLE_LABELS['cso'] → 'Giám đốc CS' — appears in both the role chip
      // AND the display name when isRoleFallback is true, so we use
      // getAllByText.
      expect(screen.getAllByText('Giám đốc CS').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/\(vai trò tổ chức\)/)).toBeInTheDocument();
    });
  });

  describe('post-op statuses → CSKH', () => {
    const postOpStatuses: CaseStatus[] = [
      'post_op_d1', 'post_op_d3', 'post_op_d7',
      'post_op_d14', 'post_op_d30', 'post_op_d90',
    ];

    it.each(postOpStatuses)('"%s" → CSKH chip', (status) => {
      const nextOwner = getNextOwner(status)!;
      expect(nextOwner.role).toBe('cskh_postop');
      const { container } = renderWithProviders(
        <NextOwnerBanner
          nextOwner={nextOwner}
          resolvedName={{ displayName: 'NV. CSKH', isRoleFallback: false }}
        />,
      );
      const banner = container.querySelector('[data-testid="next-owner-banner"]');
      expect(banner?.getAttribute('data-role')).toBe('cskh_postop');
      // ROLE_LABELS['cskh_postop'] → 'CSKH sau phẫu thuật'
      expect(screen.getByText('CSKH sau phẫu thuật')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has role="status" + aria-live="polite" so screen readers announce changes', () => {
      const nextOwner = getNextOwner('waiting_doctor_review')!;
      const { container } = renderWithProviders(
        <NextOwnerBanner
          nextOwner={nextOwner}
          resolvedName={{ displayName: 'BS. A', isRoleFallback: false }}
        />,
      );
      const banner = container.querySelector('[data-testid="next-owner-banner"]');
      expect(banner?.getAttribute('role')).toBe('status');
      expect(banner?.getAttribute('aria-live')).toBe('polite');
    });

    it('icon has aria-hidden="true" (decorative)', () => {
      const nextOwner = getNextOwner('draft')!;
      const { container } = renderWithProviders(
        <NextOwnerBanner
          nextOwner={nextOwner}
          resolvedName={{ displayName: 'Sales A', isRoleFallback: false }}
        />,
      );
      const iconWrapper = container.querySelector('[aria-hidden="true"]');
      expect(iconWrapper).not.toBeNull();
    });
  });

  describe('Vietnamese copy', () => {
    it('uses Vietnamese heading text', () => {
      const nextOwner = getNextOwner('draft')!;
      renderWithProviders(
        <NextOwnerBanner
          nextOwner={nextOwner}
          resolvedName={{ displayName: 'Trưởng KD', isRoleFallback: false }}
        />,
      );
      expect(screen.getByText('Người phụ trách tiếp theo')).toBeInTheDocument();
    });

    it('no English text leaks into the banner', () => {
      const nextOwner = getNextOwner('scheduled')!;
      const { container } = renderWithProviders(
        <NextOwnerBanner
          nextOwner={nextOwner}
          resolvedName={{ displayName: 'Sales A', isRoleFallback: false }}
        />,
      );
      // No "Next owner", "Owner:", "Owner of", etc.
      expect(container.textContent).not.toMatch(/Next owner/i);
      expect(container.textContent).not.toMatch(/Owner:/);
    });
  });

  describe('data attributes for testability', () => {
    it('exposes data-urgency + data-role for visual regression tooling', () => {
      const nextOwner = getNextOwner('medical_alert')!;
      const { container } = renderWithProviders(
        <NextOwnerBanner
          nextOwner={nextOwner}
          resolvedName={{ displayName: 'BS. A', isRoleFallback: false }}
        />,
      );
      const banner = container.querySelector('[data-testid="next-owner-banner"]');
      expect(banner?.getAttribute('data-urgency')).toBe('red');
      expect(banner?.getAttribute('data-role')).toBe('doctor');
    });
  });
});