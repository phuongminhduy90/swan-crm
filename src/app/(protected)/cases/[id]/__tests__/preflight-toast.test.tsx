/**
 * Story R-A1 (Sprint 6.4) — Replace the remaining `window.alert` in the
 * cases/[id] B.2.1 L2 pre-flight gate with a `<Toast type="error">`.
 *
 * A9 anti-pattern closure: the last native dialog call on cases/[id] was a
 * `window.alert(...)` inside the `onTransition` callback. Sprint 6.4 swaps
 * it for `useToast().toast(message, 'error')` so the pre-flight warning
 * rides the same in-app toast pipeline as every other validation surface.
 *
 * The page itself is heavy (lazy imports, multi-tab state, several modals,
 * Firebase calls), so this test follows the established `confirm-dialog-
 * replacement.test.tsx` pattern: surface-level verification by static
 * reading of the page source. The runtime behavior (toast vs alert) is
 * additionally pinned by an `A9 anti-pattern gate` block that asserts the
 * source no longer contains ANY `window.alert`/`window.confirm` call sites
 * AND no `eslint-disable.*no-alert` comment.
 *
 * Acceptance (per `SPRINT_6_4_EXECUTION_PLAN.md` §2.4 + Appendix A.4):
 *   1. `window.alert` not called — A9 anti-pattern gate at the file level.
 *   2. `useToast` is wired and the page destructures `{ toast }`.
 *   3. The pre-flight path calls `toast(message, 'error')` with the
 *      original Vietnamese copy preserved (copy is byte-exact).
 *   4. No `// eslint-disable-next-line no-alert` comment.
 *   5. The `<StatusWorkflow>` block is untouched (B.2.1 / B.2.4 surface
 *      preserved — only the transport for the pre-flight message changed).
 *
 * @see docs/ux-redesign/SPRINT_6_4_EXECUTION_PLAN.md §2.4 (S4 / R-A1)
 * @see docs/ux-redesign/SPRINT_6_4_EXECUTION_PLAN.md §A.4 (story card)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PAGE_PATH = resolve(
  process.cwd(),
  'src/app/(protected)/cases/[id]/page.tsx',
);

// String that must appear verbatim — the B.2.1 L2 pre-flight error copy
// is preserved (transport-only change). See SPRINT_6_4 §A.4.
const PREFLIGHT_COPY = 'Không thể chuyển trạng thái: thiếu ${missing}. Vui lòng hoàn thành checklist trước.';

describe('Story R-A1 (Sprint 6.4) — cases/[id] pre-flight alert → Toast', () => {
  const source = readFileSync(PAGE_PATH, 'utf8');

  describe('A9 anti-pattern gate — native alert removed', () => {
    it('does NOT call window.alert() anywhere in the cases/[id] page source', () => {
      // A9 anti-pattern closure for cases/[id]. This was the ONE remaining
      // `window.alert(...)` call on this page (the B.2.1 L2 pre-flight).
      // Sprint 6.4 / R-A1 closes it.
      expect(source).not.toMatch(/window\.alert\s*\(/);
      // Also block bare `alert(` calls — the page no longer relies on the
      // global alert at all.
      expect(source).not.toMatch(/(?<!\w)alert\(\s*[`'"]/);
    });

    it('does NOT contain an eslint-disable for no-alert', () => {
      // The pre-R-A1 code had a `// eslint-disable-next-line no-alert`
      // comment suppressing the warning on the `window.alert(...)` line.
      // The replacement is a Toast call, which does NOT trigger the rule,
      // so the disable comment must be gone too.
      expect(source).not.toMatch(/eslint-disable.*no-alert/);
      // And neither does it use the file-level form.
      expect(source).not.toMatch(/eslint-disable\s+no-alert/);
    });

    it('does NOT call window.confirm() either (regression — Sprint 6.3 closed confirm too)', () => {
      // Belt-and-suspenders: Sprint 6.3 closed `window.confirm()` on this
      // page (B.4.5 remove-service handler). This test asserts the
      // replacement path didn't accidentally regress that closure.
      expect(source).not.toMatch(/window\.confirm\s*\(/);
    });
  });

  describe('Toast wiring — surface change', () => {
    it('imports useToast from @/components/ui/toast', () => {
      expect(source).toMatch(
        /import\s*\{\s*useToast\s*\}\s*from\s*['"]@\/components\/ui\/toast['"]/,
      );
    });

    it('destructures { toast } from useToast() inside the page component', () => {
      // Match `const { toast } = useToast();` somewhere inside the
      // page-level component (not at module scope).
      expect(source).toMatch(/const\s*\{\s*toast\s*\}\s*=\s*useToast\(\)/);
    });

    it('calls toast(message, "error") on the B.2.1 L2 pre-flight path', () => {
      // The pre-flight gate fires when the checklist has not all passed
      // AND the requested transition is gated. We verify the toast call
      // shape and the type argument.
      expect(source).toMatch(/toast\s*\(\s*`Không thể chuyển trạng thái/);
      // The error type literal appears immediately after the message
      // template literal — match across newlines via [\s\S].
      expect(source).toMatch(/hoàn thành checklist trước\.`,\s*\n\s*['"]error['"]/);
    });

    it('preserves the original Vietnamese pre-flight copy (transport-only change)', () => {
      // The B.2.1 L2 message text is preserved verbatim so any QA / spec
      // references to the previous alert message still apply.
      expect(source).toContain(PREFLIGHT_COPY);
    });

    it('keeps the pre-flight "return" semantics — no status mutation when gate blocks', () => {
      // The pre-flight check still `return`s before any status mutation,
      // so the gated transition is blocked as before.
      const preflightBlock = source.match(
        /if\s*\(\s*checklistSummary[\s\S]*?!\s*checklistSummary\.allPassed[\s\S]*?\)\s*\{[\s\S]*?return\s*;\s*\}/,
      );
      expect(preflightBlock).not.toBeNull();
      expect(preflightBlock![0]).toMatch(/toast\s*\(/);
      // The pre-flight path MUST NOT contain `await updateCaseStatus`.
      expect(preflightBlock![0]).not.toMatch(/await\s+updateCaseStatus/);
    });
  });

  describe('case workflow surface preserved', () => {
    it('still renders <StatusWorkflow> with the same prop surface', () => {
      // Story R-A1 must NOT touch the B.2.1 / B.2.4 StatusWorkflow surface
      // — only the inside of the `onTransition` callback changes.
      expect(source).toMatch(/<StatusWorkflow/);
      expect(source).toMatch(/currentStatus=\{caseRecord\.status\}/);
      expect(source).toMatch(/checklistSummary=\{checklistSummary \?\? undefined\}/);
      expect(source).toMatch(/failedChecklistKeys=\{failedChecklistKeys\}/);
    });

    it('still lazy-imports isGatedTransition from @/lib/checklist', () => {
      // The gate math is unchanged — only the messaging transport moves
      // from `window.alert` to `toast(...)`.
      expect(source).toMatch(
        /await\s+import\(['"]@\/lib\/checklist['"]\)[\s\S]*?isGatedTransition\s*\(\s*newStatus\s*\)/,
      );
    });

    it('still persists actualProcedureDate for procedure_completed transitions', () => {
      // Regression baseline — the B.2.4 procedure-date persist path must
      // remain intact, untouched by the R-A1 refactor.
      expect(source).toMatch(
        /newStatus\s*===\s*['"]procedure_completed['"][\s\S]*?actualProcedureDate[\s\S]*?toISOString\(\)/,
      );
    });

    it('still auto-creates post-op followups on procedure_completed', () => {
      // Regression baseline — D1/D3/D7/D14/D30/D90 followup creation is
      // outside the scope of R-A1.
      expect(source).toMatch(/createPostOpFollowups\s*\(/);
    });
  });

  describe('Vietnamese copy parity (A4 / UX tone)', () => {
    it('preserves "Không thể chuyển trạng thái" heading in the toast copy', () => {
      expect(source).toMatch(/Không thể chuyển trạng thái/);
    });

    it('preserves "Vui lòng hoàn thành checklist trước" guidance copy', () => {
      expect(source).toMatch(/Vui lòng hoàn thành checklist trước/);
    });

    it('preserves the "thiếu {missing}" insertion in the template literal', () => {
      // The template literal must interpolate the failed-keys list (or
      // the "một số mục lâm sàng" fallback) — same wording as before.
      expect(source).toMatch(/thiếu\s+\$\{missing\}/);
      expect(source).toMatch(/'một số mục lâm sàng'/);
    });
  });
});