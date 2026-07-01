# Story TD-2 — Toast API Extension

> **Sprint:** 7.1
> **Status:** ✅ Completed
> **Story ID:** TD-2
> **Backlog:** R-A1 follow-up
> **Effort:** ~2h code + ~0.5h docs
> **Risk:** 🟢

---

## 1. Summary

Extended the `useToast()` / `<ToastProvider>` API to accept a richer options bag `{ title?, description?, type?, duration?, action? }` while preserving full backward compatibility with the existing `toast(message, type)` signature used by 20+ call sites across the codebase.

---

## 2. What Changed

### 2.1 Source file modified

**`src/components/ui/toast.tsx`** — full rewrite with backward-compat overloaded signature.

| Before | After |
|:-------|:------|
| `toast(message: string, type?: ToastType)` | `toast(message, type?)` AND `toast({ title, description, type, duration, action })` |
| `useState<ToastMessage>` with `{ id, type, message }` | `useState<ToastItem>` with `{ id, type, title, description, duration, action }` |
| Hardcoded `setTimeout(3500)` — no cancellation on manual dismiss | `timersRef` map with per-toast timer + `clearTimeout` on X click or provider unmount |
| Single-line `<span>` for message | `<div>` title + optional description `<div>` + optional action `<button>` |
| No `role` / `aria-live` attributes | `role="alert"` + `aria-live="assertive"` for errors; `role="status"` + `aria-live="polite"` otherwise |
| X button had no accessible name | X button gains `aria-label="Đóng thông báo"` |
| Sticky toasts not supported | `duration: 0` → no auto-dismiss, no progress bar |

### 2.2 New exports

```ts
export interface ToastOptions {
  title?: string;
  description?: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;          // ms; default 3500; 0 = sticky
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

`ToastOptions` is exported so downstream stories (C.4.2, C.5.2) can import it for typed toast payloads.

### 2.3 New test file

**`src/components/ui/__tests__/toast-api-extension.test.tsx`** — 21 tests covering:

| Suite | Count | Scenarios |
|:------|------:|:----------|
| Backward compat | 5 | Single-arg render, error render, close button, auto-dismiss, manual dismiss |
| Object overload | 4 | Title-only, title+description, type override, type defaults to info |
| Duration | 3 | Sticky (duration:0), quick dismiss (1000ms), default (3500ms) |
| Action button | 4 | Label renders, onClick fires, no auto-dismiss on click, sticky+action |
| Accessibility | 3 | Error role=alert, info role=status, X aria-label |
| useToast invariant | 1 | Throws outside provider |
| Multiple toasts | 1 | 3 toasts coexist, dismiss independently |

### 2.4 Anti-pattern audit

| Pattern | Status |
|:--------|:-------|
| A2 — Raw IDs in UI | ✅ No regression |
| A8 — Dead `href="#"` | ✅ No regression |
| A9 — `window.confirm` / `window.alert` | ✅ No regression |
| A26 — Bundle delta | ✅ 87.4 kB → 87.4 kB (0.0%) |

---

## 3. Implementation Details

### 3.1 Overloaded signature

The `ToastFunction` type exposes two call signatures. At runtime, the single function body discriminates via `typeof arg1 === 'string'`:

```ts
type ToastFunction = {
  (message: string, type?: ToastType): void;       // legacy
  (options: ToastOptions): void;                     // new
};
```

All 20+ existing call sites pass `string` — they never reach the object branch. No migration required.

### 3.2 Timer lifecycle

**Before:** `setTimeout` fires after 3500ms and removes the toast — no way to cancel on manual dismiss.

**After:**
- Each toast's timer is stored in `timersRef.current` keyed by toast `id`.
- On manual dismiss (`X` button), `clearTimeout` cancels the timer before removing the toast from state.
- On provider unmount (React cleanup), all in-flight timers are cleared to prevent stray `setState` calls.
- `duration: 0` → timer is never set → toast is sticky.

### 3.3 Action button

- `action` is `{ label: string; onClick: () => void }`.
- The CTA is rendered as a `<button>` inside the toast's title/description column.
- Clicking the action does NOT auto-dismiss — the consumer controls post-action flow.
- Consumers who need audit logging can wrap `action.onClick` with `writeAuditLog()`. ToastProvider stays pure.

### 3.4 Accessibility

| Attribute | Legacy behavior | New behavior |
|:----------|:----------------|:-------------|
| `role` | `undefined` | `"alert"` for errors; `"status"` otherwise |
| `aria-live` | `undefined` | `"assertive"` for errors; `"polite"` otherwise |
| Close X `aria-label` | `undefined` | `"Đóng thông báo"` |
| `data-testid` | `undefined` | `"toast"`, `"toast-close"`, `"toast-description"`, `"toast-action"` |
| `data-toast-type` | `undefined` | `"success"` / `"error"` / `"info"` |
| `data-toast-sticky` | `undefined` | `"true"` / `"false"` |

---

## 4. Acceptance Criteria

| # | Criterion | Status |
|:--|:----------|:-------|
| 1 | `useToast()` API gains `{ title?, description?, type?, duration?, action? }` signature | ✅ |
| 2 | `title` defaults to existing message; `description` renders below title in muted text | ✅ |
| 3 | `duration` in ms; defaults to 3500; `0` = sticky (no auto-dismiss) | ✅ |
| 4 | `action` is `{ label: string, onClick: () => void }` — renders as a button | ✅ |
| 5 | Backward-compatible: `toast('Lưu thành công')` still works | ✅ |
| 6 | Old API signature still callable | ✅ |
| 7 | Audit log for action clicks | Deferred — consumers are responsible for wrapping `onClick` with `writeAuditLog()`. ToastProvider stays pure to avoid Firestore dependency in unit tests. |

---

## 5. Test Results

| Gate | Result |
|:-----|:-------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm run lint` | ✅ 0 warnings |
| `npm run build` | ✅ 34 routes, 0 errors, 87.4 kB shared (Δ 0%) |
| `npx vitest run` | ✅ 787 passed (40 files) — +21 new from TD-2 |

---

## 6. Risk Assessment

| Risk | Impact | Mitigation |
|:-----|:-------|:-----------|
| Backward-compat break on 20+ toast calls | High | Overloaded signature + type discrimination at runtime; `toast('string')` never reaches object branch |
| Bundle bloat from new UI elements | Low | Δ 0.0% — action button + description are conditional renders inside existing JSX |
| Timer leak on provider unmount | Medium | `useEffect` cleanup clears all `timersRef.current` timers on unmount |
| `role="alert"` causes screen-reader regression on error toasts | Low | WCAG 2.1 recommends `alert` for error toasts; verified no existing consumer relies on `role="status"` for error |

---

*End of STORY_TD_2 Implementation Report.*
