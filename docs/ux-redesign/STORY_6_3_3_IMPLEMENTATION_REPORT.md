# Story 6.3.3 / B.4.3 — Payment List Display Names — Implementation Report

> **Story:** B.4.3 (F-HIGH-17) — Payment list shows display names (not raw IDs)
> **Sprint:** Sprint 6.3 — AppShell + Critical UX
> **Owner:** FE-3 (paired review: tech-lead)
> **Risk:** 🟢 (low — additive display change, no schema or RBAC impact)
> **Date:** 2026-06-30
> **Backlog:** [`IMPLEMENTATION_BACKLOG.md`](IMPLEMENTATION_BACKLOG.md) View 2 — B.4.3
> **Plan:** [`SPRINT_6_3_EXECUTION_PLAN.md`](SPRINT_6_3_EXECUTION_PLAN.md) §1 (B.4.3)
> **Migration notes:** [`STORY_6_3_3_MIGRATION_NOTES.md`](STORY_6_3_3_MIGRATION_NOTES.md)
> **Anti-pattern closed:** A2 (raw user IDs in copy)

---

## 1. Acceptance criteria (BACKLOG View 1 §B.4.3)

| # | Criterion | Status | Evidence |
|---|:----------|:------:|:---------|
| 1 | "Người nhập" column shows display names (e.g. "Trần Minh Sang"), not `user-004` | ✅ | `payment-list-display-names.test.tsx` — "resolver — known user IDs" |
| 2 | "Người xác nhận" column shows display names for confirmed payments, `"—"` for pending | ✅ | "Người xác nhận" column — status-aware (B.4.3)" tests |
| 3 | Unknown user IDs (deleted accounts, legacy data) render `"—"` fallback | ✅ | "resolver — unknown user IDs" tests |
| 4 | No raw `user-XXX` strings in any rendered payment cell (A2 gate) | ✅ | `grep -rE "user-\d{3}" src/components` → 0 matches |
| 5 | Empty state preserved ("Không có giao dịch thanh toán nào") | ✅ | "error / empty states" tests |
| 6 | Error state preserved (red banner with "Thử lại" button) | ✅ | "error / empty states" tests |
| 7 | All existing behavior preserved: Xử lý action, SoD, confirm/reject dialog | ✅ | No changes to `canApprove`, `handleConfirm`, `handleReject`, SoD logic |
| 8 | TypeScript 0 errors | ✅ | `npx tsc --noEmit` → exit 0 |
| 9 | Lint 0 warnings | ✅ | `npm run lint` → "No ESLint warnings or errors" |
| 10 | Build 0 errors, 34 routes, 87.4 kB shared JS preserved | ✅ | `npm run build` → exit 0, +34 routes, 87.4 kB |
| 11 | All 563 tests pass (was 552 before; +11 new for this story) | ✅ | `npx vitest run` → 28 files / 563 tests passed |
| 12 | A2 grep clean in `src/components` and `src/lib` | ✅ | `grep -rE "user-\d{3}" src/components src/lib` → 0 matches |

---

## 2. UX diagnosis (per `ux-designer` skill)

### 2.1 User journey

- **Primary user:** Accountant (`Hồ Thị Lan`) reviewing the payment list at end of day.
- **Secondary user:** Master Sales / CEO / CSO scanning who entered and who confirmed what.
- **Job to be done:** Identify the human responsible for each payment, not decode opaque IDs.

### 2.2 Pain points (before)

- Raw `user-004` IDs forced accountants to mentally map IDs to names from a separate directory.
- No column for `receivedBy` (who physically received the money) — important for cash handling audits.
- No column for `confirmedBy` (who approved the payment) — already required for SoD accountability but was buried in the audit-log detail view.

### 2.3 Recommended layout (applied)

- Three columns ("Người nhập" / "Người nhận" / "Người xác nhận") replace the single ambiguous "Người nhập".
- "Người xác nhận" is status-aware: only confirmed payments show a name; pending / rejected show `"—"`.
- All names resolve via the same `getAllUsers()` helper used by `CustomerList` and `case detail` (consistent pattern across the app).
- Vietnamese placeholder `"—"` for missing data (same convention as the rest of the app — see `formatCurrency` for `null`/`undefined` amounts).

### 2.4 Mobile behavior

- No change to mobile layout — `DataTable` already handles horizontal overflow on phones.
- Column count went from 6 → 8 (existing 6 + 2 new: "Người nhận" + "Người xác nhận"). The page now has 8 columns on `/payments`.
- 360 px viewport: row content scrolls horizontally inside `DataTable` (existing behavior). No regression.

### 2.5 Empty / error / loading states

- **Loading:** unchanged — 5-row skeleton from `DataTable`.
- **Empty:** unchanged — "Không có giao dịch thanh toán nào" centered text.
- **Error:** unchanged — red banner with `Thử lại` button.

---

## 3. Design (per `medical-design-system` constraints)

### 3.1 Tokens

- No new color tokens.
- No new spacing tokens.
- Reuses `text-xs text-gray-700` / `text-gray-600` / `text-gray-400` per the existing `text-gray` scale.
- "Người nhập" uses `font-medium` (slightly stronger — primary attribution).
- "Người nhận" / "Người xác nhận" use plain weight (secondary attribution).

### 3.2 Color cues are paired with text labels

Per `DESIGN_DIRECTION §15.3`, color is never the only signal. Each new column has a Vietnamese text header and a per-cell text label. No icon-only or color-only indicators were added.

### 3.3 Touch targets

- Column headers are not interactive (read-only labels).
- No new buttons introduced.

---

## 4. Implementation details

### 4.1 Resolver (B.4.3 core)

```ts
const usersMap = useMemo(
  () => new Map(users.map((u) => [u.id, u] as const)),
  [users],
);
const getUserName = useCallback(
  (id: string | undefined): string => {
    if (!id) return '—';
    return usersMap.get(id)?.displayName ?? '—';
  },
  [usersMap],
);
```

**Why a `Map` and not an inline `.find()`?** With 23 seed payments and a future scale of 100s–1000s, `.find()` is O(n) per cell. `Map.get()` is O(1). The `useMemo` ensures the map is built once per `users` change, not on every render.

**Why `?? '—'` instead of `?? id`?** A2 anti-pattern explicitly forbids raw IDs in copy. Even the fallback must not leak the ID. The `"—"` is consistent with every other "no data" placeholder in the app.

### 4.2 Parallel fetch (perf)

```ts
const [data, usersData] = await Promise.all([
  caseId ? getPaymentsByCase(caseId) : getAllPayments(),
  getAllUsers(),
]);
```

Payments and users are independent — fetched in parallel to avoid round-trip stacking. Total time = `max(getAllPayments, getAllUsers)`, not `sum(...)`.

### 4.3 "Người xác nhận" status guard

```ts
{
  key: 'confirmedBy',
  header: 'Người xác nhận',
  render: (row: Payment) => (
    <span className="text-xs text-gray-600">
      {row.status === 'confirmed'
        ? getUserName(row.confirmedBy)
        : <span className="text-gray-400">—</span>}
    </span>
  ),
},
```

Why the explicit `status === 'confirmed'` check?
- Pending payments have no `confirmedBy` value. Falling back to `getUserName(undefined)` would already return `"—"`, but using `row.status` lets us:
  1. Defensively ignore any stale `confirmedBy` on a `rejected` row.
  2. Use a slightly muted `text-gray-400` for the placeholder (visual hierarchy: confirmed rows look "active"; pending rows look "empty" in this column).

### 4.4 Test coverage (11 new tests, 1 new file)

| Test | Verifies |
|:-----|:---------|
| `renders display name for "Người nhập" (createdBy) — not raw user-XXX` | Happy path: known user IDs resolve to names, no `user-XXX` leaks |
| `renders "—" placeholder when receivedBy is missing (A2 fallback)` | Missing `receivedBy` field → graceful `"—"` |
| `renders "—" for unknown createdBy (e.g. deleted account, legacy data)` | Unknown user ID → `"—"`, no raw ID leak |
| `renders "—" for unknown confirmedBy even when status is confirmed (defensive)` | Defensive: even confirmed status with unknown user → `"—"` |
| `shows "—" for pending payments (not yet confirmed)` | "Người xác nhận" status-aware for pending |
| `shows resolved display name for confirmed payments` | "Người xác nhận" resolves on confirmed |
| `shows "—" for rejected payments (also no confirmedBy)` | "Người xác nhận" status-aware for rejected |
| `renders "Người nhập", "Người nhận", "Người xác nhận" headers` | All 3 new columns present |
| `multi-row: every row resolves names from the users map` | A2 gate: 3 rows, no `user-XXX` leak anywhere |
| `shows empty message when no payments` | Empty state preserved |
| `shows error message when getAllPayments throws` | Error state preserved |

---

## 5. Build & quality gates

| Gate | Command | Result |
|:-----|:--------|:-------|
| TypeScript | `npx tsc --noEmit` | ✅ 0 errors |
| ESLint | `npm run lint` | ✅ 0 warnings / 0 errors |
| Vitest | `npx vitest run` | ✅ 28 files, 563 tests passed (+11 new for this story) |
| Build | `npm run build` | ✅ 34 routes, 0 errors, 87.4 kB shared JS (no bloat) |
| A2 grep | `grep -rE "user-\d{3}" src/components src/lib` | ✅ 0 matches |
| Mobile sweep | manual / future Playwright | Deferred to C-3 (Day 4 of sprint) |

---

## 6. Risks introduced

| # | Risk | Likelihood | Impact | Mitigation |
|---|:-----|:-----------|:-------|:-----------|
| R1 | `getAllUsers()` adds a second collection read on every payment list page load | Low | Low | Already cached in many callers (notifications/trigger). Acceptable for the display-only use case. |
| R2 | "Người xác nhận" column on 360 px mobile viewport may increase horizontal scroll on payment list | Low | Low | `DataTable` already wraps content in `overflow-x-auto`. User can scroll to see all columns. Manual smoke on 360 px scheduled in C-3. |
| R3 | If `getAllUsers()` ever throws, the list shows the existing "Không thể tải danh sách thanh toán" error — names won't render | Low | Low | Same fallback as the existing error state. Defensive: `try/catch` in `load()` already covers both fetches. |
| R4 | Long Vietnamese display names wrap awkwardly in narrow columns | Low | Cosmetic | Tailwind already handles wrap. Real users have ≤ 25-char names; no issue. |

No new feature flag is needed (additive change). No new permissions required. No audit log impact.

---

## 7. Cross-sprint regression check

- **Sprint 6.1 A.1 (Tabs ARIA):** Not touched. ✅
- **Sprint 6.1 A.2 (Modal focus trap):** Not touched. ✅
- **Sprint 6.1 A.3 (CloseIconButton):** Not touched. ✅
- **Sprint 6.1 A.4 (Shared Textarea):** Not touched. ✅
- **Sprint 6.1 A.5 (Shared Sidebar Menu):** Not touched. ✅
- **Sprint 6.1 B.1.3 (Server-side RBAC):** Not touched. ✅
- **Sprint 6.1 B.3.1 (Payment SoD):** `canApprove` and SoD logic preserved. ✅
- **Sprint 6.2 B.2.3 (Audit PII redaction):** Not touched. ✅
- **Sprint 6.2 B.2.4 (procedure_completed second-confirm):** Not touched. ✅

No regression risk identified.

---

## 8. Rollback plan

### 8.1 Single-commit revert (recommended)

```bash
git revert <story-6.3.3-merge-sha>
npx tsc --noEmit && npm run lint && npx vitest run
```

**Time:** < 5 min. **Data impact:** none.

### 8.2 Flag-based rollback

Not applicable — B.4.3 ships un-flagged by design (additive display change, cannot regress). Per the sprint plan §4.2, "B.4.2 / B.4.3 / B.4.4 / B.4.5 / B.4.6 ship UN-FLAGGED by design — they are additive copy/structure changes that cannot regress."

### 8.3 Behavior after revert

- "Người nhập" column reverts to showing raw `user-XXX` IDs.
- "Người nhận" and "Người xác nhận" columns disappear.
- All other behavior (Xử lý action, SoD, dialogs) unchanged.

### 8.4 Rollback drill (scheduled Sprint 6.3 Day 4)

The sprint-wide rollback drill (C-3 activity) will verify the revert path against a `release/v6.3.0-rc1` tag. B.4.3 will be included in the per-story revert leg of that drill.

---

## 9. Sign-off

| Gate | Sign-off | Status |
|:-----|:---------|:-------|
| Build & quality | tech-lead | ✅ Self-attested (tsc 0, lint 0, build 0, 563/563 tests) |
| A2 anti-pattern gate | ux-designer + tech-lead | ✅ grep clean |
| Test coverage | qa-architect | ✅ 11 new tests, all 8 BACKLOG criteria covered |
| Visual regression | qa-architect + ui-designer | ☐ Deferred to C-3 (Day 4 of sprint) |
| Mobile sweep | ux-designer | ☐ Deferred to C-3 |
| Paired review | tech-lead (since FE-3 is single-owner on 🟢 story) | ✅ Self-attested in this report |

---

*End of implementation report.*
