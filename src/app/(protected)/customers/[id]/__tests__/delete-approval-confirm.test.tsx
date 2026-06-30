/**
 * Story 6.3.5 / B.4.5 (F-MED-01) — Customer delete-approval uses
 * `<ConfirmDialog>` for both request and approve paths.
 *
 * Verifies that:
 *   1. NO `window.confirm` / `window.alert` calls remain in
 *      `customers/[id]/page.tsx` (A9 anti-pattern closure).
 *   2. The page imports `<ConfirmDialog>` from the UI library.
 *   3. The "Yêu cầu xóa" (request-delete) button triggers a ConfirmDialog
 *      with `variant="warning"` (since the action is *requested*, not yet
 *      destructive — the actual deletion still needs DELETE_APPROVE_ROLES
 *      approval).
 *   4. The "Phê duyệt xóa" (approve-delete) button triggers a ConfirmDialog
 *      with `variant="danger"` (the irreversible destructive step).
 *   5. The "Từ chối" (reject-delete) button does NOT open a confirm dialog —
 *      it calls `handleRejectDelete` directly (the rejection is a one-step
 *      safe action, not a destructive one).
 *   6. Both dialogs use Vietnamese titles matching the existing copy
 *      ("Gửi yêu cầu xóa khách hàng?" / "Phê duyệt xóa khách hàng?").
 *   7. Permission gating still uses `DELETE_APPROVE_ROLES` — no RBAC
 *      regression.
 *
 * @see docs/ux-redesign/SPRINT_6_3_EXECUTION_PLAN.md §1 (B.4.5 row)
 * @see docs/ux-redesign/STORY_6_3_5_MIGRATION_NOTES.md
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PAGE_PATH = resolve(
  process.cwd(),
  'src/app/(protected)/customers/[id]/page.tsx',
);

describe('Story 6.3.5 / B.4.5 — customers/[id] delete-approval uses <ConfirmDialog>', () => {
  const source = readFileSync(PAGE_PATH, 'utf8');

  describe('A9 anti-pattern gate — no native confirm()/alert() in this file', () => {
    it('does NOT call window.confirm()', () => {
      expect(source).not.toMatch(/window\.confirm\s*\(/);
    });

    it('does NOT call window.alert()', () => {
      expect(source).not.toMatch(/window\.alert\s*\(/);
    });

    it('does NOT use bare confirm() global', () => {
      // Block bare `confirm(` calls — must be a confirm dialog (React component).
      expect(source).not.toMatch(/(?<!\w)confirm\(\s*['"`]/);
    });

    it('does NOT use bare alert() global', () => {
      expect(source).not.toMatch(/(?<!\w)alert\(\s*['"`]/);
    });
  });

  describe('<ConfirmDialog> primitive is imported', () => {
    it('imports ConfirmDialog from @/components/ui/confirm-dialog', () => {
      expect(source).toMatch(
        /import\s*\{\s*ConfirmDialog\s*\}\s*from\s*['"]@\/components\/ui\/confirm-dialog['"]/,
      );
    });
  });

  describe('request-delete flow — warning variant', () => {
    it('renders a ConfirmDialog with variant="warning" for the request step', () => {
      // Find the first ConfirmDialog block (request) — title="Gửi yêu cầu xóa..."
      const requestBlock = source.match(
        /<ConfirmDialog[\s\S]*?title="Gửi yêu cầu xóa khách hàng\?"[\s\S]*?\/>/,
      );
      expect(requestBlock).not.toBeNull();
      expect(requestBlock![0]).toMatch(/variant="warning"/);
      // `open` is wired to the requestDelete state
      expect(requestBlock![0]).toMatch(/open=\{requestDelete\}/);
      // `onConfirm` fires the request handler
      expect(requestBlock![0]).toMatch(/onConfirm=\{handleRequestDelete\}/);
      // Vietnamese confirm label
      expect(requestBlock![0]).toMatch(/confirmLabel="Gửi yêu cầu"/);
      // Loading state wired
      expect(requestBlock![0]).toMatch(/loading=\{requesting\}/);
    });

    it('"Yêu cầu xóa" button sets requestDelete state (does NOT call native confirm)', () => {
      const buttonMatch = source.match(
        /<Button[\s\S]*?leftIcon=\{<Trash2[\s\S]*?>[\s\S]*?>[\s\S]*?Yêu cầu xóa[\s\S]*?<\/Button>/,
      );
      expect(buttonMatch).not.toBeNull();
      const buttonText = buttonMatch![0];
      // Onclick opens the state, not native confirm
      expect(buttonText).toMatch(/onClick=\{\s*\(\)\s*=>\s*setRequestDelete\(\s*true\s*\)\s*\}/);
      expect(buttonText).not.toMatch(/confirm\s*\(/);
    });

    it('does NOT render the "Yêu cầu xóa" button when deletion is already pending', () => {
      // Existing behavior: hide the request button while deletionRequested is true.
      // Verify the guard is in place — guards against double-request.
      const buttonMatch = source.match(
        /\{canWrite\s*&&\s*!customer\.deletionRequested\s*&&[\s\S]*?Yêu cầu xóa[\s\S]*?\}/,
      );
      expect(buttonMatch).not.toBeNull();
    });
  });

  describe('approve-delete flow — danger variant', () => {
    it('renders a ConfirmDialog with variant="danger" for the approve step', () => {
      const approveBlock = source.match(
        /<ConfirmDialog[\s\S]*?title="Phê duyệt xóa khách hàng\?"[\s\S]*?\/>/,
      );
      expect(approveBlock).not.toBeNull();
      expect(approveBlock![0]).toMatch(/variant="danger"/);
      expect(approveBlock![0]).toMatch(/open=\{approveDelete\}/);
      expect(approveBlock![0]).toMatch(/onConfirm=\{handleApproveDelete\}/);
      // Vietnamese destructive label
      expect(approveBlock![0]).toMatch(/confirmLabel="Xóa vĩnh viễn"/);
      expect(approveBlock![0]).toMatch(/loading=\{approving\}/);
      // The destructive step is gated on DELETE_APPROVE_ROLES
      // (verified separately — see "RBAC regression gate" below).
    });

    it('"Phê duyệt xóa" button sets approveDelete state (does NOT call native confirm)', () => {
      const buttonMatch = source.match(
        /<Button[\s\S]*?variant="danger"[\s\S]*?Phê duyệt xóa[\s\S]*?<\/Button>/,
      );
      expect(buttonMatch).not.toBeNull();
      const buttonText = buttonMatch![0];
      expect(buttonText).toMatch(/onClick=\{\s*\(\)\s*=>\s*setApproveDelete\(\s*true\s*\)\s*\}/);
      expect(buttonText).not.toMatch(/confirm\s*\(/);
    });
  });

  describe('reject-delete flow — no dialog, direct handler', () => {
    it('"Từ chối" button calls handleRejectDelete directly (no confirm)', () => {
      // Rejection is a safe action — no destructive dialog needed.
      const buttonMatch = source.match(
        /<Button[\s\S]*?variant="outline"[\s\S]*?onClick=\{handleRejectDelete\}[\s\S]*?>\s*Từ chối\s*<\/Button>/,
      );
      expect(buttonMatch).not.toBeNull();
      const buttonText = buttonMatch![0];
      // No ConfirmDialog appears for the reject path
      expect(buttonText).not.toMatch(/setRejecting\s*\(/);
      expect(buttonText).not.toMatch(/open\s*=\s*\{/);
    });
  });

  describe('RBAC regression gate — permission constants preserved', () => {
    it('still imports DELETE_APPROVE_ROLES from @/constants/permissions', () => {
      expect(source).toMatch(
        /import\s*\{[\s\S]*?DELETE_APPROVE_ROLES[\s\S]*?\}\s*from\s*['"]@\/constants\/permissions['"]/,
      );
    });

    it('still gates the "Phê duyệt xóa" button on canDeleteApprove', () => {
      // The destructive approve button must be visible only to DELETE_APPROVE_ROLES.
      const gatedBlock = source.match(
        /\{canDeleteApprove\s*&&[\s\S]*?Phê duyệt xóa[\s\S]*?\}/,
      );
      expect(gatedBlock).not.toBeNull();
    });

    it('still derives canDeleteApprove from DELETE_APPROVE_ROLES membership', () => {
      expect(source).toMatch(
        /const\s+canDeleteApprove\s*=\s*!!user\s*&&\s*DELETE_APPROVE_ROLES\.includes\(\s*user\.role\s*\)/,
      );
    });
  });

  describe('handler wiring — handler functions exist and call firestore', () => {
    it('declares handleRequestDelete that calls requestCustomerDeletion', () => {
      expect(source).toMatch(
        /async\s+function\s+handleRequestDelete\s*\(\s*\)\s*\{[\s\S]*?await\s+requestCustomerDeletion\s*\(/,
      );
    });

    it('declares handleApproveDelete that calls approveCustomerDeletion + deleteCustomer', () => {
      expect(source).toMatch(
        /async\s+function\s+handleApproveDelete\s*\(\s*\)\s*\{[\s\S]*?await\s+approveCustomerDeletion\s*\(/,
      );
      expect(source).toMatch(/await\s+deleteCustomer\s*\(/);
    });

    it('declares handleRejectDelete that calls rejectCustomerDeletion', () => {
      expect(source).toMatch(
        /async\s+function\s+handleRejectDelete\s*\(\s*\)\s*\{[\s\S]*?await\s+rejectCustomerDeletion\s*\(/,
      );
    });
  });
});