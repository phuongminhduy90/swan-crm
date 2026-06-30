# Story 6.3.3 / B.4.3 — Payment List Display Names — Migration Notes

> **Story:** B.4.3 (F-HIGH-17) — Payment list shows display names (not raw IDs)
> **Sprint:** Sprint 6.3 — AppShell + Critical UX
> **Date:** 2026-06-30
> **Backlog source:** [`IMPLEMENTATION_BACKLOG.md`](IMPLEMENTATION_BACKLOG.md) View 2 — B.4.3 row
> **Plan source:** [`SPRINT_6_3_EXECUTION_PLAN.md`](SPRINT_6_3_EXECUTION_PLAN.md) §1 (B.4.3 row)
> **Implementation report:** [`STORY_6_3_3_IMPLEMENTATION_REPORT.md`](STORY_6_3_3_IMPLEMENTATION_REPORT.md)

---

## 1. What changed (delta from prior `PaymentList`)

### Before

The "Người nhập" column rendered `row.createdBy` directly — i.e. raw `user-XXX` IDs from the seed data and from real Firestore.

```
| Ngày TT | Loại | Số tiền | Hình thức | Người nhập    | Trạng thái |
| 2026-06 | Đặt cọc | 10.000.000 ₫ | Tiền mặt | user-004  | Đã xác nhận |
```

There was no column for "Người nhận" (`receivedBy`) or "Người xác nhận" (`confirmedBy`).

### After

Three columns now render Vietnamese display names resolved via `getAllUsers()`:

```
| Ngày TT | Loại | Số tiền | Hình thức | Người nhập         | Người nhận        | Người xác nhận     | Trạng thái |
| 2026-06 | Đặt cọc | 10.000.000 ₫ | Tiền mặt | Trần Minh Sang     | Nguyễn Thị Lan Anh | Hồ Thị Lan        | Đã xác nhận |
```

The resolver is a stable, fallback-safe `Map<id, User>` lookup:

```ts
const getUserName = (id?: string): string => {
  if (!id) return '—';
  return usersMap.get(id)?.displayName ?? '—';
};
```

A2 anti-pattern grep is **zero** in `src/components` and `src/lib` (no raw `user-XXX` substrings leak into any rendered payment cell).

---

## 2. File-by-file migration

### 2.1 Modified: `src/components/payments/payment-list.tsx`

| Change | Detail |
|:-------|:-------|
| Import `User` type | `import { Payment, User } from '@/lib/types';` |
| Import `getAllUsers` | Added to existing firestore import block |
| New `useState` for users | `const [users, setUsers] = useState<User[]>([]);` |
| `useMemo` for users map | `new Map(users.map((u) => [u.id, u]))` — built once per `users` change |
| `useCallback` for `getUserName` | Falls back to `'—'` for missing/undefined/unknown IDs |
| `load()` now uses `Promise.all` | `getAllPayments()` + `getAllUsers()` fetched in parallel |
| Replaced "Người nhập" column render | `<span>{getUserName(row.createdBy)}</span>` |
| **New** "Người nhận" column | Renders `getUserName(row.receivedBy)` |
| **New** "Người xác nhận" column | Renders `getUserName(row.confirmedBy)` only when `status === 'confirmed'`, else `'—'` |

**No other behavior changed**:
- Action button logic (Xử lý) preserved
- SoD (separation of duties) enforcement preserved
- `canApprove` permission check preserved
- Confirm/reject dialog wiring preserved
- Empty state + error state preserved

### 2.2 New: `src/components/payments/__tests__/payment-list-display-names.test.tsx`

11 tests covering:

- Resolver — known user IDs (3 tests)
- Resolver — unknown user IDs (2 tests)
- "Người xác nhận" column status-aware behavior (3 tests)
- Column headers (1 test)
- A2 anti-pattern grep on rendered DOM (1 test)
- Error/empty states preserved (1 test)

---

## 3. Compatibility / no-regression notes

- **No schema changes.** `Payment.createdBy`, `Payment.receivedBy`, `Payment.confirmedBy` already exist on the type.
- **No RBAC changes.** `canApprove` and the SoD SoD check use the same `PAYMENT_CONFIRM_ROLES` allow-list and the same `userProfile` source.
- **No audit log changes.** No new `writeAuditLog()` call introduced.
- **No flag changes.** Display name resolution is always-on (additive, like B.4.4 and B.4.5 from this sprint).
- **No new dependencies.** `getAllUsers()` is an existing helper.
- **No new tokens or primitives.** Only existing `<DataTable>`, `<Badge>`, `<Button>` are used.
- **Loading / error / empty states preserved.** The `loading` state shows the same skeleton; the error state shows the same red banner with retry; the empty state shows the same "Không có giao dịch thanh toán nào" message.

---

## 4. Anti-pattern gate (post-merge verification)

```bash
$ grep -rE "user-\d{3}" src/components
# (no matches)

$ grep -rE "user-\d{3}" src/lib
# (no matches)
```

The `Người nhập` column previously showed raw IDs. After this story:

- All payment list cells render Vietnamese display names.
- A2 anti-pattern (raw user IDs in copy) is **fully closed** in the payment list surface.
- The audit-log surface already uses `actorName` (verified in Phase 5 mock store), so this is the last user-facing place raw IDs leaked.

---

## 5. Rollback

Pure code-only revert. The change is contained to `src/components/payments/payment-list.tsx` and the new test file. See [`STORY_6_3_3_IMPLEMENTATION_REPORT.md`](STORY_6_3_3_IMPLEMENTATION_REPORT.md) §8 for the full rollback plan.

```bash
# Single-commit revert
git revert <story-6.3.3-merge-sha>
# Verify
npx tsc --noEmit && npm run lint && npx vitest run
# Behavior reverts to "Người nhập" showing raw `user-XXX` IDs; no new columns.
```

**Time to rollback:** < 5 min. **Data impact:** none.

---

*End of migration notes.*
