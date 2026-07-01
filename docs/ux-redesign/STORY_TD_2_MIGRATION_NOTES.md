# Story TD-2 — Migration Notes

> **Sprint:** 7.1
> **Scope:** Toast API extension (forward migration guide for Sprint 7.4 / C.4.2 and Sprint 7.5 / C.5.2)

---

## TL;DR for downstream consumers

The Toast API gained an **optional** object-overload. **No existing call site needs to change.** Sprint 7.4 (consent gate) and Sprint 7.5 (notification deep-links) can adopt the new shape when they need `description` or `action`.

```ts
// Legacy — still works, identical UX
toast('Đã lưu thay đổi', 'success');
toast('Không thể cập nhật', 'error');

// New — opt-in
toast({
  title: 'Đã gửi yêu cầu xóa',
  description: 'Quản lý sẽ phê duyệt trong vòng 24 giờ.',
  type: 'info',
  duration: 0,                                  // sticky
  action: { label: 'Xem', onClick: () => push(`/customers/${id}`) },
});
```

---

## 1. What is new

| Field | Type | Default | Purpose |
|:------|:-----|:--------|:--------|
| `title` | `string` | `''` | Replaces legacy `message` arg |
| `description` | `string` | `undefined` | Optional muted-text line below title |
| `type` | `'success' \| 'error' \| 'info'` | `'info'` | Border color + icon |
| `duration` | `number` | `3500` | Auto-dismiss delay in ms. Use `0` for sticky. |
| `action` | `{ label: string; onClick: () => void }` | `undefined` | Optional CTA button |

### Field-by-field migration mapping

| Old API | New API equivalent |
|:--------|:-------------------|
| `toast('msg')` | `toast({ title: 'msg' })` |
| `toast('msg', 'error')` | `toast({ title: 'msg', type: 'error' })` |
| n/a | `toast({ title, description, ... })` |
| n/a | `toast({ ..., duration: 0 })` (sticky) |
| n/a | `toast({ ..., duration: 5000 })` (override 3500 ms default) |
| n/a | `toast({ ..., action: { label, onClick } })` |

---

## 2. What is unchanged

- **`toastProvider` lives at `src/components/ui/toast.tsx`** — `<ToastProvider>` mounting in `src/app/providers.tsx` is unchanged.
- **`useToast()` hook returns `{ toast }`** — same shape.
- **Default duration** for legacy calls is still `3500` ms.
- **Close (X) button** still appears on every toast.
- **Auto-dismiss progress bar** is unchanged.
- **Bundle size** — 87.4 kB shared (no delta).

---

## 3. Do consumers need to migrate now?

**No.** Sprint 7.1 ships TD-2 as a hygiene story (R-A1 follow-up). Existing 20+ call sites stay on the legacy form. Migration is fully opt-in.

When to migrate (future criteria):

| When | Rationale |
|:-----|:----------|
| A toast copy has multiple sentences | Use `description` for the secondary line |
| A toast wants users to act (e.g. "Thu hồi quyền") | Use `action.label` + `action.onClick` |
| A toast should NOT auto-dismiss | Use `duration: 0` |
| A toast has a self-explanatory link copy | Use `description` and keep title short |

---

## 4. Anti-pattern guidance

### 4.1 Don't use `action` to dump HTML

`action.label` is plain text. Wrap rich content in a separate modal or use `description` for prose.

### 4.2 Sticky toasts should be rare

`duration: 0` should only apply when a destructive decision is at hand (C.4.2 consent revocation) — not for routine confirmations. The X button must remain visible.

### 4.3 Audit-log wrapper is consumer responsibility

If the action represents a sensitive mutation (e.g. undo a destructive op), wrap `onClick` with `writeAuditLog()`:

```ts
toast({
  title: 'Consent đã thu hồi',
  description: 'Ảnh case này sẽ bị ẩn khỏi thư viện sau khi đóng thông báo.',
  type: 'info',
  duration: 0,
  action: {
    label: 'Hoàn tác',
    onClick: async () => {
      await writeAuditLog({
        actorId: user.id,
        actorName: user.displayName,
        actorRole: user.role,
        action: 'consent_revoked',
        entityType: 'consent',
        entityId: consent.id,
      });
      await restoreConsent(consent.id, user.id);
    },
  },
});
```

### 4.4 Accessibility — error toasts automatically get `role="alert"`

When you pass `type: 'error'`, the rendered DOM gets `role="alert"` and `aria-live="assertive"`. **Don't** add a second `role="alert"` consumer alongside it (e.g. focus-trap modal) without testing the screen-reader announcement order.

---

## 5. Sprint 7.4 / C.4.2 — Frontend consent visibility guard

The next planned consumer is the consent visibility guard on `/media-library`:

```ts
import { useToast, ToastOptions } from '@/components/ui/toast';

const { toast } = useToast();

function showConsentRevokedToast(consent: Consent) {
  toast({
    title: 'Consent đã thu hồi',
    description: 'Ảnh đính kèm trong case này sẽ không hiển thị trên media-library.',
    type: 'warning',  // (would require expanding ToastType — see §6.1)
    duration: 0,
    action: {
      label: 'Hoàn tác',
      onClick: () => restoreConsent(consent.id, user.id),
    },
  });
}
```

### 5.1 Open question for Sprint 7.4

C.4.2 currently needs a `warning` type. The TD-2 surface intentionally limits types to `success | error | info` because no existing call site needs `warning`. **Recommendation for C.4.2:** keep `info` for now (consent revocation is a neutral operational event), unless the team prefers `error` (it IS destructive). A decision must be made before C.4.2 lands.

---

## 6. Sprint 7.5 / C.5.2 — Notification deep-link routing

The notification toast on click of a notification bell will use:

```ts
toast({
  title: `Đã đánh dấu đã đọc: ${notification.title}`,
  description: 'Bạn có thể xem chi tiết case ngay.',
  type: 'success',
  action: {
    label: 'Xem case',
    onClick: () => router.push(`/cases/${notification.caseId}`),
  },
});
```

This unblocks C.5.2 from landing toast-on-deep-link.

---

## 7. Rollback

If TD-2 must be reverted:

1. Revert [src/components/ui/toast.tsx](src/components/ui/toast.tsx) to the Sprint 6.4 version (single-arg `toast(message, type)`).
2. Revert [src/components/ui/__tests__/toast-api-extension.test.tsx](src/components/ui/__tests__/toast-api-extension.test.tsx) deletion.
3. **No call sites need to change** — the new object overload is purely additive.
4. All 20+ existing `toast('msg', 'type')` calls continue to compile and run identically.

No data layer change, no migration script, no feature flag flip required for rollback.

---

## 8. Test surface

| File | Purpose | Tests |
|:-----|:--------|------:|
| `src/components/ui/__tests__/toast-api-extension.test.tsx` | New prop surface + backward-compat | 21 |

Existing toast-related tests (no migration required):

| File | Tests |
|:-----|------:|
| `src/components/layout/__tests__/topbar-profile-toast.test.tsx` | 11 (mock `useToast`, unaffected) |
| `src/app/(protected)/cases/[id]/__tests__/preflight-toast.test.tsx` | Source-pattern assertions, unaffected |
| `src/app/(protected)/audit-logs/__tests__/page.test.tsx` | Mocks `useToast`, unaffected |

---

*End of STORY_TD_2 Migration Notes.*
