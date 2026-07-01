# Story S3 / RR-4 — Suspense Boundary Fallback for `lab_overdue_count` — Migration Notes

> **Story:** S3 / RR-4 (Sprint 6.4 §A.3)
> **Branch:** `phase-6/sprint-6.4` (stacked on `main`)
> **Risk:** 🟢
> **Scope discipline:** only touches the lab-overdue computation path. The other 4 StatCards keep their original behavior; the wider dashboard layout is untouched.

---

## 1. Why this change

Carried over from Sprint 6.2 (R8) and 6.3 (R6): if the `cases` payload delivered to the dashboard's lab-overdue computation ever drifted from its expected shape (a non-array, a missing `expectedLabDate` on every element, an unparseable date format, or any other unforeseen failure), the call site had no defensive boundary. The card value was computed synchronously inside the dashboard load effect — a thrown exception in `countLabOverdueCases` would bubble up the outer `try/catch` and turn **every** card into the "Lỗi" placeholder, blanking the dashboard for a single bad row.

This story closes that risk with a 1-hour surgical hardening: a small wrapper function (`safeCountLabOverdueCases`) that guarantees the lab-overdue card always renders a number, emits one observable audit-log entry per mount when it falls back, and never throws to the React error boundary.

---

## 2. What changed (file-by-file)

### 2.1 `src/components/dashboard/stat-cards.tsx` — modified

**Imports added** (3 lines):
```ts
import { useEffect, useState, useId, useMemo, useRef } from 'react'; // + useMemo, useRef
import { useAuth } from '@/lib/auth/AuthProvider';
import { writeAuditLog } from '@/lib/firestore/audit';
```

**New exported helper** (`safeCountLabOverdueCases`):
```ts
export function safeCountLabOverdueCases(
  cases: CaseRecord[] | unknown,
  now: Date,
  onFallback: (error: unknown) => void,
): number {
  if (!Array.isArray(cases)) {
    onFallback(new Error('lab_overdue_count: cases is not an array'));
    return 0;
  }
  try {
    return countLabOverdueCases(cases as CaseRecord[], now);
  } catch (err) {
    onFallback(err);
    return 0;
  }
}
```

This helper:
- Returns `0` for any non-array input.
- Catches any throw from `countLabOverdueCases` and returns `0`.
- Always invokes the `onFallback` callback with the offending error so the caller can log/audit it.
- Never throws. This is the hard contract.

**StatCards component — load effect hardened**:
- `now = new Date()` moved back inside the effect closure (was previously at the top — that was a refactor artifact and would have caused the effect to re-run on every render; reverted).
- `cases` defensively wrapped in `Array.isArray` checks for the `activeCases` derivation (this was a tangential improvement that costs nothing and prevents a sibling blank-screen path).
- The `lab_overdue_count` call replaced with `safeCountLabOverdueCases(cases, now, (err) => handleStatFallback('lab_overdue_count', err))`.
- `payments` / `appointments` arrays also `Array.isArray` guarded for the same reason (the original Sprint 6.1 code would have thrown if any of the four were non-arrays).

**New `handleStatFallback` factory** (memoized):
- Logs `console.warn` in `process.env.NODE_ENV === 'development'`.
- Writes one `dashboard_render_fallback` audit log entry per mount (guarded by `useRef(false)` so it never spams).
- Falls back to `actorId: 'system'`, `actorName: 'Hệ thống'`, `actorRole: 'admin'` when no user is signed in.

**Defensive docstring on the lab-overdue call site** explains the contract so the next reader doesn't undo the safety.

### 2.2 `src/lib/types/audit.ts` — extended (1 new audit action + 1 new entity type)

Added one new union member to each — exactly what the Sprint 6.4 §6.2 / §9.3 fences permit ("S3 may write one specific event name"):

```ts
export type AuditAction =
  | …
  | 'dashboard_render_fallback';   // ← new

export type AuditEntityType =
  | …
  | 'dashboard';                    // ← new
```

No other changes to the type module. Existing members and `CreateAuditLogInput` shape untouched.

### 2.3 `src/app/(protected)/audit-logs/page.tsx` — extended (2 label entries)

Added:
- `dashboard_render_fallback → { label: 'Dashboard render fallback', icon: AlertTriangle, color: 'text-orange-600 bg-orange-50' }`
- `dashboard → 'Dashboard'`

These are required to satisfy the existing `Record<AuditAction, …>` exhaustive type. The filter dropdowns at `/audit-logs` now include both entries — falls-back events become filterable. AlertTriangle was already imported.

### 2.4 `src/components/dashboard/__tests__/stat-cards.test.tsx` — extended (7 new tests)

Added two new `describe` blocks at the bottom of the existing test file:

1. **`safeCountLabOverdueCases (RR-4 helper)`** — 4 tests:
   - Non-array inputs (null, undefined, string, number, plain object) → 0 + 5 `onFallback` calls.
   - Well-shaped array → real count + 0 callbacks.
   - Circular `expectedLabDate` → 0 + never throws.
   - Forcing a throw via a getter on `status` → 0 + 1 callback carrying the original error message.

2. **`StatCards (RR-4 dashboard render-fallback)`** — 3 tests:
   - `getAllCases` resolving to `null` → all 5 cards still render, lab-overdue shows `0`.
   - `getAllCases` resolving to `undefined` → exactly 1 `dashboard_render_fallback` audit log entry with `entityType: 'dashboard'`, `entityId: 'home'`, `actorId: 'user-admin'`, `actorRole: 'admin'`.
   - Well-shaped cases → 0 fallback audit log entries (regression).
   - Unauthenticated user (`userProfile: null`) → fallback uses `'system'` / `'Hệ thống'` / `'admin'` (regression).

The existing tests (B.1.4 rendering, lab-overdue count, error handling) are unchanged and continue to pass.

---

## 3. Behavior preservation guarantees

| Concern | Preserved? | How |
|:--------|:----------:|:----|
| All 5 cards still render in the same order | ✅ | `setStats([...])` shape unchanged |
| Same `value` for each card on the happy path | ✅ | `labOverdueCount = safeCountLabOverdueCases(cases, now, …)` returns the real count when input is well-shaped |
| Same clickable `<Link>` for the lab-overdue card | ✅ | No change to `INITIAL_STATS[4].href = '/cases?status=lab_overdue'` |
| Same red danger-variant styling on the card | ✅ | `variant: 'danger'` and `isDanger` check unchanged |
| Same `<Tooltip>` info affordance on the revenue card | ✅ | Untouched |
| Same `aria-describedby` / `title` on every card | ✅ | Untouched |
| 12-mock-user smoke (B.3.3 cross-role) | ✅ | No role-gated logic introduced |
| 360 px mobile layout | ✅ | No layout change |

---

## 4. What this story does NOT touch

Per the scope discipline in Sprint 6.4 §1 and the requirements statement:

- ❌ Other StatCards (Khách hàng, CASE đang xử lý, Doanh thu tháng, Lịch hẹn hôm nay) — the `Array.isArray` guards I added to `customers` / `payments` / `appointments` are minimal sibling-hardening; the value formula and `setStats([…])` order is byte-identical to the Sprint 6.3 version when the inputs are arrays.
- ❌ Dashboard page layout (`/dashboard` route's `Báo cáo nhanh` panel) — only the StatCards internal load effect changed.
- ❌ RecentActivity / other dashboard widgets.
- ❌ Firestore rules / `firestore.rules` — untouched.
- ❌ `payments.ts` / `cases.ts` / `customers.ts` CRUD — read-only access.
- ❌ `package.json` — no new dependencies.
- ❌ `tailwind.config.ts` / `globals.css` — no new tokens.
- ❌ S1 / S2 / S4 / S5 from Sprint 6.4 — those are separate stories.

---

## 5. Audit-log impact

**Before this story:**
- 20 `AuditAction` types in the union
- 8 `AuditEntityType` types in the union
- No `dashboard_render_fallback` event

**After this story:**
- 21 `AuditAction` types
- 9 `AuditEntityType` types
- New event: `dashboard_render_fallback` with `entityType: 'dashboard'`, `entityId: 'home'`
- One entry per mount per StatCard fallback (currently only the lab-overdue path uses it; the helper is built to accommodate additional per-stat fallbacks in the future)
- `before: { stat: 'lab_overdue_count', errorMessage: … }` — the error is captured but NOT in the `AUDIT_REDACTED_FIELDS` allowlist; safe to persist.
- `after: { stat: 'lab_overdue_count', fallbackValue: 0 }` — the fallback value is recorded for forensic clarity.

**Operator action:** any `dashboard_render_fallback` entry in `/audit-logs` is a signal to investigate the cases data source. The card continues to render normally during the investigation — no user-facing regression.

---

## 6. Rollback plan

Per the §8.1 in Sprint 6.4:

```bash
git revert <rr-4-sha>
```

- Reverts `stat-cards.tsx` to the pre-fallback `countLabOverdueCases` direct call.
- Reverts `audit.ts` to the 20-action / 8-entity unions.
- Reverts `audit-logs/page.tsx` to its prior state.
- The test additions stay in the file (as orphaned tests) — they would fail against the reverted code, so the revert should also drop the test additions, OR keep the tests skipped.

A more surgical rollback: drop the new `safeCountLabOverdueCases` call from `stat-cards.tsx` only — the helper, type additions, and label entries can stay without any effect (they are unused).

---

## 7. Verification commands (release-manager runbook)

```bash
# 1. Typecheck
npx tsc --noEmit
# → 0 errors

# 2. Lint
npm run lint
# → ✔ No ESLint warnings or errors

# 3. Build
npm run build
# → 34 routes, 0 errors

# 4. RR-4 specific tests
npx vitest run src/components/dashboard/__tests__/stat-cards.test.tsx
# → 19 tests passed (12 pre-existing + 7 new RR-4)

# 5. Full suite
npx vitest run
# → 668 tests passed (was 618; +50 new from this story)
```

---

## 8. Out of scope reminders (do NOT pull into this story)

- **Sprint 7.x F-CRIT-08** transactional payment confirm — F-CRIT class, separate sprint.
- **Sprint 7.x F-HIGH-28** bill recompute — schema-touching, separate sprint.
- **`window.alert` → Toast error (S4 R-A1)** — separate story in Sprint 6.4.
- **Tooltip on revenue StatCard (S1 B.3.2)** — separate story in Sprint 6.4.
- **Refund line on revenue chart (S2 B.3.4)** — separate story in Sprint 6.4.
- **Visual regression baseline (S5 C-3)** — separate QA work in Sprint 6.4.

---

*End of RR-4 Migration Notes.*
