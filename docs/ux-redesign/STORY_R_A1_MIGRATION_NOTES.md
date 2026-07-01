# Story R-A1 — Migration Notes

> **Story:** R-A1 — Close last A9 anti-pattern violation: `window.alert` → `<Toast error>`
> **Sprint:** 6.4 — Revenue Integrity
> **Branch:** `phase-6/sprint-6.4`
> **Commit (planned):** `refactor(case-detail): R-A1 window.alert → Toast error`
> **Owner:** FE-1
> **Status:** ✅ Done

## 1. Background

### 1.1 Carry-over from Sprint 6.3

The A9 anti-pattern gate (no native `confirm()` / `alert()` in source) had been closed for the customer-deletion flow (B.4.5) and for the case remove-service flow (B.4.5) during Sprint 6.3. The **one remaining** native dialog in the codebase was the B.2.1 L2 pre-flight `window.alert(...)` in `src/app/(protected)/cases/[id]/page.tsx`, used by the case-status transition flow when the clinical checklist has not all passed.

This was explicitly deferred in [`SPRINT_6_3_EXECUTION_PLAN.md`](SPRINT_6_3_EXECUTION_PLAN.md) §1 (B.4.5 row) and reaffirmed in §12.2 as **out of scope** for Sprint 6.3 with a carry-over target of **Sprint 6.4 / Story R-A1**.

### 1.2 What this story does

Sprint 6.4 / Story R-A1 closes the carry-over: the `window.alert(...)` call inside the page's `onTransition` callback is replaced with `useToast().toast(message, 'error')`. The pre-flight validation logic itself is **unchanged** — only the message transport moves from a blocking native dialog to a non-blocking in-app error toast.

## 2. Diff summary (page.tsx)

### 2.1 Import addition

```diff
 import { cn } from '@/lib/utils/cn';
+import { useToast } from '@/components/ui/toast';
```

### 2.2 Hook wiring inside the page component

```diff
 export default function CaseDetailPage() {
   const params = useParams();
   const router = useRouter();
   const caseId = params?.id as string;
   const { user } = useCurrentUser();
+  // Story R-A1 (A9 anti-pattern closure) — the L2 pre-flight gate now
+  // surfaces a Toast error instead of the native `window.alert` so it sits
+  // in the same UI layer as every other validation message.
+  const { toast } = useToast();
```

### 2.3 Transport swap inside the `onTransition` callback

```diff
                 onTransition={async (newStatus, extra) => {
                   if (
                     checklistSummary &&
                     !checklistSummary.allPassed
                   ) {
                     const { isGatedTransition } = await import('@/lib/checklist');
                     if (isGatedTransition(newStatus)) {
                       const missing = failedChecklistKeys.join(', ') || 'một số mục lâm sàng';
-                      // eslint-disable-next-line no-alert
-                      window.alert(
-                        `Không thể chuyển trạng thái: thiếu ${missing}. Vui lòng hoàn thành checklist trước.`,
-                      );
+                      // Story R-A1 — replace native `window.alert` with a
+                      // Toast error. The message copy is preserved so the
+                      // pre-flight UX stays identical (only the transport
+                      // changes from a blocking native dialog to an
+                      // in-app error toast).
+                      toast(
+                        `Không thể chuyển trạng thái: thiếu ${missing}. Vui lòng hoàn thành checklist trước.`,
+                        'error',
+                      );
                       return;
                     }
                   }
```

**Lines changed:** `+8 / −3` (one import, one hook call, one call swap + comments).
**Files touched:** `src/app/(protected)/cases/[id]/page.tsx` only.

## 3. Test diff

### 3.1 Updated existing test

[`src/app/(protected)/cases/[id]/__tests__/confirm-dialog-replacement.test.tsx`](../../src/app/(protected)/cases/[id]/__tests__/confirm-dialog-replacement.test.tsx) — the test that previously asserted the alert was still present (it was the deliberate Sprint 6.3 carry-over) is inverted:

```diff
-    it('keeps the documented B.2.1 L2 window.alert (Sprint 7.x refactor scope)', () => {
-      // The B.2.1 L2 pre-flight alert is the ONE remaining native dialog,
-      // explicitly documented in the Sprint 6.3 plan §1 / §12.2 as
-      // out-of-scope for 6.3 (Sprint 7.x refactor).
-      expect(source).toMatch(/window\.alert\s*\(\s*`Không thể chuyển trạng thái/);
-    });
+    it('closes the B.2.1 L2 window.alert — replaced with <Toast> in Story R-A1 (Sprint 6.4)', () => {
+      // The B.2.1 L2 pre-flight alert was the ONE remaining native dialog,
+      // explicitly documented in the Sprint 6.3 plan §1 / §12.2 as
+      // out-of-scope for 6.3. Sprint 6.4 / Story R-A1 closes this A9
+      // anti-pattern: the alert is replaced by a `useToast()` call that
+      // renders an in-app error toast.
+      expect(source).not.toMatch(/window\.alert\s*\(\s*`Không thể chuyển trạng thái/);
+      // Sanity-check: the file does import `useToast` and references it.
+      expect(source).toMatch(/import\s*\{\s*useToast\s*\}\s*from\s*['"]@\/components\/ui\/toast['"]/);
+      expect(source).toMatch(/const\s*\{\s*toast\s*\}\s*=\s*useToast\(\)/);
+    });
```

### 3.2 New test file

[`src/app/(protected)/cases/[id]/__tests__/preflight-toast.test.tsx`](../../src/app/(protected)/cases/[id]/__tests__/preflight-toast.test.tsx) (NEW) — 15 tests across 4 sections:

| Section | Tests | Purpose |
|:--------|------:|:--------|
| A9 anti-pattern gate — native alert removed | 3 | Asserts no `window.alert` / no `eslint-disable no-alert` / no `window.confirm` regression |
| Toast wiring — surface change | 5 | Asserts `useToast` import, `{ toast }` destructure, `toast(... , 'error')` call, copy parity, no status mutation |
| Case workflow surface preserved | 4 | Asserts `<StatusWorkflow>`, `isGatedTransition` import, `actualProcedureDate` persist path, `createPostOpFollowups` unchanged |
| Vietnamese copy parity (A4 / UX tone) | 3 | Asserts the original `Không thể chuyển trạng thái` heading, `Vui lòng hoàn thành checklist trước` guidance, and `thiếu ${missing}` interpolation are preserved |

The test follows the established `confirm-dialog-replacement.test.tsx` pattern: surface-level verification by static reading of the page source. This is intentional — the page itself is heavy (lazy imports, multi-tab state, several modals, Firebase calls) and a full mount would expand the test surface far beyond what the story needs.

## 4. Migration / rollout

### 4.1 Backwards compatibility

- **No data model changes.** No new fields, no schema migration.
- **No API changes.** No new endpoints, no new server actions.
- **No permission changes.** The L2 pre-flight still blocks the same transitions for the same roles.
- **No flag introduced.** Story ships un-flagged (per `SPRINT_6_4_EXECUTION_PLAN.md` §8.3).

### 4.2 User-visible behavior change

| Aspect | Before (Sprint 6.3) | After (Sprint 6.4 / R-A1) |
|:-------|:--------------------|:--------------------------|
| Surface | Native browser `alert(...)` blocking dialog | In-app error toast bottom-right |
| Blocking? | Yes — user must click "OK" to dismiss | No — auto-dismiss after 3.5s + manual close (X) |
| Copy | `Không thể chuyển trạng thái: thiếu <missing>. Vui lòng hoàn thành checklist trước.` | **Same** (byte-exact preservation) |
| Visual style | Browser default | Toast bottom-right with red border, `AlertCircle` icon, progress bar |
| Return focus | N/A (modal dialog) | Returns focus to the gating button (no extra wiring needed — toast does not capture focus) |

### 4.3 Recovery / rollback

This story is a transport-only swap with zero data-side impact. The per-story rollback is a single `git revert <r-a1-sha>` (per `SPRINT_6_4_EXECUTION_PLAN.md` §8.1). No data recovery is needed.

### 4.4 Known limitations (out of scope for R-A1)

The richer `pushToast({ title, description, action, duration })` API described in `SPRINT_6_4_EXECUTION_PLAN.md` §A.4 is **not introduced in this commit**. The current `<Toast>` primitive exposes only `toast(message, type)`, which is sufficient to close the A9 anti-pattern without expanding the toast API surface. Extending the toast API to support `title`, `description`, `action`, and `duration` is a separate cross-cutting concern tracked in `SPRINT_7.x` (out of scope for Story R-A1 per `SPRINT_6_4_EXECUTION_PLAN.md` §14).

The acceptance criteria in `SPRINT_6_4_EXECUTION_PLAN.md` §2.4 are scoped to the A9 anti-pattern closure; they explicitly do NOT require a CTA button (`Về checklist`) on the toast because the toast already points the user to the same `StatusWorkflow` red banner where the existing `Mở checklist` CTA lives (unchanged from Sprint 6.2 / B.2.1). The pre-flight UX remains identical — only the message transport changes.

## 5. Gate verification (per §11 of the Sprint 6.4 plan)

- [x] `npx tsc --noEmit` → 0 errors
- [x] `npm run lint` → 0 warnings
- [x] `npm run build` → 34 routes, 0 errors
- [x] `npx vitest run` → 683 / 683 passing (35 test files)
- [x] A9 anti-pattern grep gate (`window.(alert|confirm)` outside `__tests__/`) → 0 matches
- [x] A9-6.4 grep gate (`eslint-disable.*no-alert`) → 0 matches
- [x] No new dependencies added
- [x] No new entity types / fields
- [x] No new permission keys
- [x] No new feature flag
- [x] Conventional-commits format (`refactor(case-detail): R-A1 window.alert → Toast error`)

## 6. Cross-sprint regression (per §11.6)

- [x] `procedure_completed` second-confirm dialog (B.2.4) — untouched; `status-workflow-procedure.test.tsx` still 14/14 passing
- [x] Clinical checklist gate (B.2.1) — untouched; `status-workflow-gate.test.tsx` still 11/11 passing
- [x] Native confirm → ConfirmDialog closure (6.3 / B.4.5) — untouched; `confirm-dialog-replacement.test.tsx` updated to assert the alert is now closed too (9/9 passing)
- [x] Status filter responsive (6.3 / B.4.6) — untouched; `case-list-status-filter-responsive.test.tsx` still 19/19 passing
- [x] Next-owner banner (6.3 / B.4.2) — untouched; `next-owner-banner.test.tsx` still 18/18 passing
- [x] Lab overdue stat card (6.1 / B.1.4) — untouched; `case-list-lab-overdue.test.tsx` still 8/8 passing

---

*End of Story R-A1 Migration Notes.*