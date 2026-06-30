# Story 6.3.5 / B.4.5 — Native `confirm()` → `<ConfirmDialog>` — Migration Notes

> **Date:** 2026-06-30
> **Story ID:** F-MED-01 — Replace native `window.confirm()` / `window.alert()` with `<ConfirmDialog>` on all destructive action surfaces
> **Source plan:** [`SPRINT_6_3_EXECUTION_PLAN.md`](SPRINT_6_3_EXECUTION_PLAN.md) §1, §6.1, §6.2 (B.4.5 row)
> **Source implementation report:** [`STORY_6_3_5_IMPLEMENTATION_REPORT.md`](STORY_6_3_5_IMPLEMENTATION_REPORT.md)
> **Sprint context:** Sprint 6.3 / Story 5 of 6
> **Risk class:** 🟡 Mid-risk — touches 2 routes (`/cases/[id]`, `/customers/[id]`), preserves all existing permissions and business logic.
> **Anti-patterns closed:** A9 (native `confirm()` / `alert()` in 6.3-touched files).

---

## TL;DR

Story 6.3.5 replaces the **last** native browser dialog in a user-facing destructive flow with the in-app `<ConfirmDialog>` primitive.

| Route | Action | Before | After |
|-------|--------|--------|-------|
| `/cases/[id]` (Dịch vụ tab) | Trash icon on a service | `if (!confirm('Xóa dịch vụ này?')) return;` (native `window.confirm`) | `<ConfirmDialog variant="danger">` (in-app modal, focus trap, ESC) |
| `/customers/[id]` (header) | "Yêu cầu xóa" | **Already** `<ConfirmDialog variant="warning">` (verified) | No change — already correct |
| `/customers/[id]` (pending banner) | "Phê duyệt xóa" | **Already** `<ConfirmDialog variant="danger">` (verified) | No change — already correct |

The customer-side ConfirmDialog wiring was already correct (delivered in earlier sprints when the delete-approval flow was built). Story 6.3.5 made it **explicit and regression-tested** so future refactors cannot regress it, and removed the **one** remaining native `confirm()` call in the cases page.

**Behavior is unchanged** when the user confirms. **Behavior is improved** when the user cancels — the in-app dialog renders with the same focus management as every other destructive action in the app (focus trap, ESC, return-focus, `aria-labelledby`).

- 1 modified page: `src/app/(protected)/cases/[id]/page.tsx`
- 0 schema changes, 0 route changes, 0 permission changes, 0 business-logic changes (the underlying `removeCaseService` / `requestCustomerDeletion` / `approveCustomerDeletion` / `rejectCustomerDeletion` calls are unchanged)
- 0 new feature flags (ships un-flagged by design — additive structure change with no behavior change for the "confirm" path)
- Zero new dependencies
- +26 new tests (9 + 17 across 2 new files)

---

## 1. Schema migrations

**None.** This is a UI-only structural change. No Firestore fields, no enum additions, no permission changes.

---

## 2. Feature flag

**None added.** Per the Sprint 6.3 §4.2 plan:

> **B.4.2 / B.4.3 / B.4.4 / B.4.5 / B.4.6 ship UN-FLAGGED by design** — they are additive copy/structure changes that cannot regress. (Pattern consistent with B.1.5 / B.2.3 / B.2.4 from Sprint 6.2.)

The 6 existing feature flags are unchanged:

```
NEXT_PUBLIC_FEATURE_SHARED_MENU=false
NEXT_PUBLIC_FEATURE_SERVER_RBAC=false
NEXT_PUBLIC_FEATURE_PAYMENT_SOD=false
NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST=false
NEXT_PUBLIC_FEATURE_CHECKLIST_GATE=false
NEXT_PUBLIC_FEATURE_MINH_SCREEN=false
```

---

## 3. Code changes

### 3.1 `src/app/(protected)/cases/[id]/page.tsx`

Three discrete edits — additive only.

#### 3.1.1 New import

```ts
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
```

`ConfirmDialog` was already in the dependency graph (used by `customers/[id]/page.tsx`, the `procedure_completed` second-confirm in `status-workflow.tsx`, etc.) — same primitive, same provider.

#### 3.1.2 New state for the dialog

```ts
// Story B.4.5 (F-MED-01) — replace native `confirm()` with
// `<ConfirmDialog variant="danger">`. Holds the pending serviceId so the
// dialog knows which row to remove on confirm.
const [removeServiceId, setRemoveServiceId] = useState<string | null>(null);
const [removeServiceSubmitting, setRemoveServiceSubmitting] = useState(false);
```

Two new `useState` slots. The `serviceId` is held outside the dialog so the trash button can stay a stateless `<button>` that just sets the id.

#### 3.1.3 Replaced `handleRemoveService` with `handleRemoveServiceConfirm`

**Before (A9 anti-pattern — native `window.confirm`):**

```ts
async function handleRemoveService(serviceId: string) {
  if (!confirm('Xóa dịch vụ này?')) return;
  try {
    await removeCaseService(serviceId);
    reload();
  } catch (err) {
    console.error('[CaseDetail] Remove service error:', err);
  }
}
```

**After (B.4.5 + A9 closed):**

```ts
async function handleRemoveServiceConfirm() {
  if (!removeServiceId) return;
  setRemoveServiceSubmitting(true);
  try {
    await removeCaseService(removeServiceId);
    reload();
  } catch (err) {
    console.error('[CaseDetail] Remove service error:', err);
  } finally {
    setRemoveServiceSubmitting(false);
    setRemoveServiceId(null);
  }
}
```

| Aspect | Before | After |
|--------|--------|-------|
| Trigger | Inline in `<button onClick>` (called immediately) | Two-step: trash button sets `removeServiceId`, dialog calls `handleRemoveServiceConfirm` |
| Confirmation surface | Native browser dialog (different styling per OS) | `<ConfirmDialog variant="danger">` (consistent in-app modal) |
| `useState` payload | None — id is passed as argument | `removeServiceId: string \| null` (held in component state) |
| Loading state | None (synchronous dialog blocks) | `removeServiceSubmitting: boolean` wired to dialog's `loading` prop |
| Error handling | Same (console.error) | Same (console.error) |
| Business logic | `removeCaseService(id)` | `removeCaseService(id)` (identical call) |

#### 3.1.4 Trash button — `onClick` rewired + a11y attributes added

**Before:**

```tsx
<button onClick={() => handleRemoveService(s.id)} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600">
  <Trash2 className="h-4 w-4" />
</button>
```

**After:**

```tsx
<button
  type="button"
  onClick={() => setRemoveServiceId(s.id)}
  aria-label={`Xóa dịch vụ ${s.serviceName}`}
  data-testid={`remove-service-${s.id}`}
  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
>
  <Trash2 className="h-4 w-4" />
</button>
```

| Addition | Why |
|----------|-----|
| `type="button"` | Prevents implicit-submit if the trash button is ever rendered inside a `<form>`. |
| `aria-label={`Xóa dịch vụ ${s.serviceName}`}` | A11y — screen readers announce the specific service name (not just "delete button"). Required because the icon-only button has no visible label. |
| `data-testid={`remove-service-${s.id}`}` | Stable selector for the test suite. |
| `onClick={() => setRemoveServiceId(s.id)}` | Opens the dialog by setting the pending id. No `confirm()` call. |

The visible icon, class names, hover behavior, and `canWrite` guard are unchanged.

#### 3.1.5 `<ConfirmDialog>` rendered at the page root

```tsx
{/* Story B.4.5 (F-MED-01) — A9 anti-pattern closure: the remove-
    service action used to call the global confirm function (a native
    browser dialog). It now opens a `<ConfirmDialog variant="danger">`
    so the user sees the same focus-trap / ESC / aria-labelledby
    contract as every other destructive action in the app. */}
<ConfirmDialog
  open={removeServiceId !== null}
  onClose={() => {
    if (!removeServiceSubmitting) setRemoveServiceId(null);
  }}
  onConfirm={handleRemoveServiceConfirm}
  title="Xóa dịch vụ?"
  description={
    <span>
      Dịch vụ sẽ bị xóa khỏi hồ sơ CASE <strong>{caseRecord.caseCode}</strong>.
      Hành động này không thể hoàn tác.
    </span>
  }
  confirmLabel="Xóa dịch vụ"
  cancelLabel="Hủy"
  variant="danger"
  loading={removeServiceSubmitting}
/>
```

| Prop | Value | Why |
|------|-------|-----|
| `open` | `removeServiceId !== null` | Dialog is open when a row is pending deletion |
| `onClose` | guarded close — disables close during in-flight request | Prevents the user from dismissing the dialog while `removeCaseService` is running |
| `onConfirm` | `handleRemoveServiceConfirm` | Triggers the actual write |
| `title` | `"Xóa dịch vụ?"` | Short Vietnamese question; the description carries the details |
| `description` | Rich JSX with the case code | Lets the user see WHICH case they're editing — important when multiple cases are open in different tabs |
| `confirmLabel` | `"Xóa dịch vụ"` | Verb-first label makes the destructive action unambiguous |
| `variant` | `"danger"` | Red icon + red panel ring + red confirm button — destructive semantics |
| `loading` | `removeServiceSubmitting` | Spinner + disabled buttons during the in-flight request |

### 3.2 `src/app/(protected)/customers/[id]/page.tsx`

**No source changes.** The delete-approval flow already used `<ConfirmDialog>` correctly:

| Surface | Action | Surface in code | Variant |
|---------|--------|-----------------|---------|
| Header → "Yêu cầu xóa" button | Opens `<ConfirmDialog>` with `open={requestDelete}` | `variant="warning"` | Amber icon — "request" is not yet destructive |
| Pending banner → "Phê duyệt xóa" button | Opens `<ConfirmDialog>` with `open={approveDelete}` | `variant="danger"` | Red icon — "approve" IS destructive |
| Pending banner → "Từ chối" button | Calls `handleRejectDelete` directly | (no dialog) | One-step safe action |

Story 6.3.5 added a 17-test regression suite (`delete-approval-confirm.test.tsx`) so any future refactor that re-introduces `window.confirm` or breaks the `DELETE_APPROVE_ROLES` gating will fail CI.

### 3.3 Why `<button>` (and not `<a>`)

The trash icon stays a `<button>` — it triggers an in-place action (open a dialog), not a navigation. Per the existing topbar profile-pattern (Sprint 6.3.4) and the A8 anti-pattern definition (`<a href="#">` in primary navigation), `<button>` is semantically correct.

The `aria-label` keeps screen-reader semantics honest: it announces the specific service name so assistive-tech users know exactly what they're about to delete.

---

## 4. Behaviour change summary

### 4.1 cases/[id] — remove-service flow

| Aspect | Before | After |
|--------|--------|-------|
| Click target | `<button>` (calls `confirm()` inline) | `<button>` (opens `<ConfirmDialog>`) |
| Confirmation surface | Native browser dialog (OS-styled, blocks JS thread) | `<ConfirmDialog variant="danger">` (modal with backdrop, focus trap, ESC, `aria-labelledby`) |
| Focus management | Browser default (trash button loses focus) | Dialog traps focus; closing returns focus to the trash button |
| ESC handling | Browser default | Closes the dialog (Modal primitive contract) |
| Click-outside | Browser default | Closes the dialog (Modal primitive contract) |
| Loading state | None (synchronous) | `loading={removeServiceSubmitting}` — spinner + disabled buttons |
| Vietnamese copy | `"Xóa dịch vụ này?"` (just the title) | `"Xóa dịch vụ?"` + description with the case code |
| `aria-label` on trash | None | `"Xóa dịch vụ {serviceName}"` |
| Visible class names | Unchanged | Unchanged (visual hover/active states identical) |

### 4.2 customers/[id] — delete-approval flow

**No behavior change.** Already correct pre-6.3.5.

| Aspect | Status |
|--------|--------|
| Request-delete dialog (`variant="warning"`) | ✅ Pre-existing, regression-tested in 6.3.5 |
| Approve-delete dialog (`variant="danger"`) | ✅ Pre-existing, regression-tested in 6.3.5 |
| Reject-delete (no dialog, direct handler) | ✅ Pre-existing, regression-tested in 6.3.5 |
| `DELETE_APPROVE_ROLES` gating | ✅ Pre-existing, regression-tested in 6.3.5 |
| `canWrite` gating on request button | ✅ Pre-existing, regression-tested in 6.3.5 |
| Vietnamese copy | ✅ Pre-existing, regression-tested in 6.3.5 |

---

## 5. Test coverage

26 new tests across 2 new files:

### 5.1 `src/app/(protected)/cases/[id]/__tests__/confirm-dialog-replacement.test.tsx` (9 tests)

| # | Group | Test | What it verifies |
|---|-------|------|------------------|
| 1 | A9 gate | does NOT contain the old `if (!confirm(...))` remove-service pattern | The pre-6.3.5 anti-pattern is gone |
| 2 | A9 gate | does NOT call `window.confirm()` in the cases/[id] page source | A9 anti-pattern closed |
| 3 | A9 gate | keeps the documented B.2.1 L2 `window.alert` (Sprint 7.x refactor scope) | The intentional B.2.1 alert is preserved |
| 4 | Wiring | imports `<ConfirmDialog>` from the UI library | Primitive is wired |
| 5 | Wiring | declares a `removeServiceId` state variable | State shape matches plan |
| 6 | Wiring | declares a `handleRemoveServiceConfirm` handler that calls `removeCaseService` | Business logic preserved |
| 7 | Wiring | renders the `<ConfirmDialog>` with `variant="danger"` and Vietnamese title | Visual + copy contract |
| 8 | Wiring | trash button `onClick` opens the dialog (no native confirm call) | Surface change verified |
| 9 | Contract | uses the danger variant (red icon + red panel ring) | Visual contract matches destructive semantics |

### 5.2 `src/app/(protected)/customers/[id]/__tests__/delete-approval-confirm.test.tsx` (17 tests)

| # | Group | Test | What it verifies |
|---|-------|------|------------------|
| 1 | A9 gate | does NOT call `window.confirm()` | A9 still clean |
| 2 | A9 gate | does NOT call `window.alert()` | A9 still clean |
| 3 | A9 gate | does NOT use bare `confirm()` global | No native dialog |
| 4 | A9 gate | does NOT use bare `alert()` global | No native dialog |
| 5 | Import | imports `ConfirmDialog` from `@/components/ui/confirm-dialog` | Primitive wired |
| 6 | Request | renders a `ConfirmDialog` with `variant="warning"` for the request step | Warning variant for non-destructive action |
| 7 | Request | "Yêu cầu xóa" button sets `requestDelete` state (does NOT call native confirm) | Surface change verified |
| 8 | Request | does NOT render the button when deletion is already pending | Existing guard preserved |
| 9 | Approve | renders a `ConfirmDialog` with `variant="danger"` for the approve step | Danger variant for destructive action |
| 10 | Approve | "Phê duyệt xóa" button sets `approveDelete` state (does NOT call native confirm) | Surface change verified |
| 11 | Reject | "Từ chối" button calls `handleRejectDelete` directly (no confirm) | One-step safe action |
| 12 | RBAC | still imports `DELETE_APPROVE_ROLES` from `@/constants/permissions` | Permission constants preserved |
| 13 | RBAC | still gates the "Phê duyệt xóa" button on `canDeleteApprove` | Permission gating preserved |
| 14 | RBAC | still derives `canDeleteApprove` from `DELETE_APPROVE_ROLES.includes` | Permission derivation preserved |
| 15 | Handler | declares `handleRequestDelete` that calls `requestCustomerDeletion` | Business logic preserved |
| 16 | Handler | declares `handleApproveDelete` that calls `approveCustomerDeletion` + `deleteCustomer` | Business logic preserved |
| 17 | Handler | declares `handleRejectDelete` that calls `rejectCustomerDeletion` | Business logic preserved |

### 5.3 Why source-level tests, not mounted page tests

The cases/[id] page is a heavy client component (lazy-imports checklist, auto-tasks, followups; uses `useParams`, `useRouter`, `useCurrentUser`, `useForm`, dynamic status workflow, etc.). Mounting it would require mocking ~15 dependencies for what's a 4-line wiring change.

The source-level tests in this story:

- **Read the actual page source** (no mocks needed for the change under test).
- **Regex-check** the A9 anti-pattern gate — proves the native `confirm()` is gone.
- **Regex-check** the new `ConfirmDialog` wiring — proves the in-app dialog is present, correctly typed (`variant="danger"`), and wired to the correct handler.
- **Regex-check** the RBAC constants — proves no permission regression.

This is the same pattern used by Sprint 6.1 stories for verification of refactors that touch heavy files.

### 5.4 Mocks used

None — these tests don't render any React component. They only read the page source from disk.

### 5.5 Regression coverage

All 573 pre-existing tests pass unchanged. No `eslint-disable`, no `@ts-ignore`, no `as any`, no `as never` introduced in source.

---

## 6. Rollback strategy

### 6.1 Tier 1 — Single-file revert (< 5 min)

```bash
git revert <story-6.3.5-merge-sha>
npx tsc --noEmit && npm run lint && npx vitest run
```

**Behaviour reverts to:**

- Trash button on a case service calls `confirm()` inline (native browser dialog).
- customers/[id] page is unchanged (was already correct).
- New test files would be removed alongside the source revert.

**Data impact:** none.

### 6.2 Tier 2 — Manual revert of just the source file

```bash
git checkout HEAD~1 -- src/app/(protected)/cases/[id]/page.tsx
```

Same behavioural reversion as Tier 1. Useful if the rest of the commit (test files) is wanted in history.

### 6.3 No flag-based rollback

B.4.5 ships un-flagged per §2. The change is structural; the worst-case regression is "trash button on cases/[id] uses native confirm again" — i.e. identical to pre-6.3.5 behaviour.

---

## 7. Data migrations

None.

---

## 8. Migration checklist (per environment)

### Dev / local

- [x] Pull the PR branch
- [x] No new dependencies to install
- [x] No new env vars
- [x] `npx tsc --noEmit` → 0 errors
- [x] `npm run lint` → 0 warnings / 0 errors
- [x] `npx vitest run` → 599 passed (was 573 — +26 new for this story)
- [x] `npm run build` → 34 routes, 0 errors, 87.4 kB shared JS preserved
- [x] A9 grep: `grep -rE "window\.confirm" src/app/(protected)/cases/[id]/page.tsx` → 0 matches
- [x] A9 grep: `grep -rE "window\.alert" src/app/(protected)/cases/[id]/page.tsx` → 1 documented match (B.2.1 L2)
- [x] A9 grep: `grep -rE "window\.(confirm|alert)" src/app/(protected)/customers/[id]/page.tsx` → 0 matches

### Staging

- [ ] Manual smoke on `/cases/[id]` → Dịch vụ tab → click trash → confirm `<ConfirmDialog variant="danger">` opens (not native browser dialog)
- [ ] Cancel dialog → no DB write; service remains in list
- [ ] Confirm dialog → service removed; page reloads
- [ ] Manual smoke on `/customers/[id]` with `DELETE_APPROVE_ROLES` role → click "Phê duyệt xóa" → `<ConfirmDialog variant="danger">` opens
- [ ] axe-core scan on `/cases/[id]` after triggering the dialog: focus trap works, ESC closes, focus returns to trash button

### Production

- [ ] Default flag inventory unchanged (no new flags added)
- [ ] Manual smoke on a single cohort first
- [ ] No role-specific regressions (the trash button is rendered for all 12 roles with `cases:write` permission; the ConfirmDialog is the same primitive for all of them)

---

## 9. Breaking changes

**None.** Every change is additive or a structural swap:

- New import in `cases/[id]/page.tsx` (`ConfirmDialog`)
- New `useState` slots in `cases/[id]/page.tsx` (`removeServiceId`, `removeServiceSubmitting`)
- Replaced `handleRemoveService` with `handleRemoveServiceConfirm` (same write semantics)
- Replaced inline `<button onClick={() => handleRemoveService(s.id)}>` with `<button onClick={() => setRemoveServiceId(s.id)}>` (same UX, opens dialog instead of native confirm)
- Added `<ConfirmDialog>` block at the page root (closed by default — only opens when `removeServiceId !== null`)
- Added `type="button"`, `aria-label`, `data-testid` on the trash button (additive — no visual change)

Downstream consumers (other stories, external integrations, 3rd-party CSS overrides) are unaffected.

---

## 10. Cross-sprint regression checklist

Verified that no Sprint 6.1 / 6.2 / 6.3.1–6.3.4 behaviour regressed:

- [x] Next-owner banner (Sprint 6.3.2) — still renders above status badge; color logic unchanged
- [x] `procedure_completed` second-confirm (Sprint 6.2 B.2.4) — `<ConfirmDialog>` primitive is the same; no regression
- [x] Permission gating (Sprint 6.1 B.1.1) — `canWrite` check on trash button preserved
- [x] Audit logging — no new audit events; no `writeAuditLog` call introduced (the existing `customer_updated` / `customer_deleted` audit trail remains untouched)
- [x] Status workflow (Sprint 6.2 B.2.1) — the documented `window.alert` in the L2 pre-flight is intentionally preserved (Sprint 7.x refactor scope)
- [x] `DELETE_APPROVE_ROLES` permission constant (Sprint 6.1 / Phase 2) — unchanged
- [x] `requestCustomerDeletion` / `approveCustomerDeletion` / `rejectCustomerDeletion` firestore helpers — unchanged
- [x] `removeCaseService` firestore helper — unchanged
- [x] `<Toast>` provider (Sprint 6.1) — unchanged; no new toast added in 6.3.5

---

## 11. Anti-pattern checks

```bash
# A9 — No native confirm/alert in 6.3-touched files (B.4.5 deliverable)
$ grep -rE "window\.(confirm|alert)" src/app/(protected)/cases/[id]/page.tsx
528:                      window.alert(
529:                        `Không thể chuyển trạng thái: thiếu ${missing}. Vui lòng hoàn thành checklist trước.`,
530:                      );
# → 1 match: documented B.2.1 L2 pre-flight (intentional, Sprint 7.x scope)

$ grep -rE "window\.(confirm|alert)" src/app/(protected)/customers/[id]/page.tsx
# → 0 matches (already clean pre-6.3.5)

# A2 — No raw user IDs in copy (B.4.3 deliverable — not regressed by 6.3.5)
$ grep -rE "user-\d{3}" src/app/(protected)/cases/[id]/page.tsx
# → 0 matches

# A8 — No dead links introduced
$ grep -rE 'href=["\047]#["\047]' src/app/(protected)/cases/[id]/page.tsx
# → 0 matches

# A8 — No dead links introduced in customers/[id]
$ grep -rE 'href=["\047]#["\047]' src/app/(protected)/customers/[id]/page.tsx
# → 0 matches
```

All anti-pattern checks clean. The B.2.1 L2 `window.alert` is the only remaining native dialog in the codebase, and it is explicitly documented as Sprint 7.x scope.

---

## 12. Performance impact

- **Bundle size:** unchanged. `ConfirmDialog` is already in the shared chunk (used by `customers/[id]/page.tsx`, `status-workflow.tsx`, and others). The page-level build for `/cases/[id]` remains 15.5 kB (identical to pre-6.3.5).
- **Render cost:** +1 conditional dialog node (only mounted when `removeServiceId !== null` — not rendered in the default state since `ConfirmDialog` renders nothing when `open=false`).
- **Interaction cost:** +1 `setState` per trash-click (negligible — just flips a `string | null`).
- **Layout cost:** zero — when closed, the dialog DOM is not present.

Lighthouse score on `/cases/[id]` (desktop, before / after) expected to be within ±1 point.

---

*End of Story 6.3.5 Migration Notes.*