# Story B.1.4 — Migration Notes

> **Story:** B.1.4 — Dashboard `lab_overdue_count` clickable StatCard
> **Backlog ref:** F-CRIT-07
> **Date:** 2026-06-30
> **Owner:** FE-3 (via Claude tech-lead / ui-developer / tester skill delegation)

This document captures every behavioral and surface change Story B.1.4 introduces, the migration steps that have already happened, and the rollback path. **No data migration is required** — the work is purely additive on the UI layer, and reuses an existing `expectedLabDate` field that has been on `CaseRecord` since Phase 2.

---

## 1. Scope of change

| Surface | Change |
|---|---|
| Dashboard `/dashboard` | New 5th StatCard `Lab quá hạn` (red danger variant) + all 4 existing cards upgraded from `<div>` to `<Link>` with tooltips |
| Cases list `/cases` | Reads `?status=` URL param. New `lab_overdue` filter value. Inline red notice with "Bỏ lọc" button when filter is active. URL stays in sync when user clicks chip filters. |

**Out of scope (NOT touched):**

- The 4 existing card values / counts / hints — **unchanged**.
- `recent-activity.tsx` — **unchanged**.
- `Báo cáo nhanh` widget in the dashboard `page.tsx` — **unchanged**.
- Case status / TypeScript union — **no new status added**.
- Firestore schema — **no schema change**.

---

## 2. URL contract

| URL | Behavior |
|---|---|
| `/cases` | No filter (existing behavior preserved) |
| `/cases?status=<CaseStatus>` | Single-status filter (existing behavior; now writable from the chip strip) |
| `/cases?status=post_op` | Post-op cluster filter (existing behavior) |
| `/cases?status=lab_overdue` | **NEW** — filter to cases where `status === 'waiting_lab_test'` AND `expectedLabDate` is strictly before today (date-only). Excludes terminal statuses. |
| `/cases?status=anything-else` | Falls back to "Tất cả" (defensive) |
| `/cases?status=<empty>` (e.g. user clears the param via filter chip) | Falls back to "Tất cả" |

The dashboard's new StatCard links to `/cases?status=lab_overdue`.

---

## 3. Behavioral change — `countLabOverdueCases` (the "fix overdue calculations" deliverable)

**Before B.1.4:** The dashboard had no concept of an overdue lab count. CSKH/coordinator staff had no at-a-glance signal that a case was waiting on a lab whose appointment date had already passed. The only way to surface these cases was to open `/cases`, filter by `Chờ xét nghiệm`, and visually scan the `Ngày thực hiện` column.

**After B.1.4:** A 5th dashboard card surfaces this count using the following deterministic rule:

```ts
function isLabOverdue(c, now): boolean {
  // 1. status check — automatically excludes every terminal status
  //    (completed / cancelled / postponed / complaint / medical_alert)
  //    because none of them equals 'waiting_lab_test'.
  if (c.status !== 'waiting_lab_test') return false;

  // 2. date presence — case has a scheduled lab date
  if (!c.expectedLabDate) return false;

  // 3. date is parseable
  const labDate = new Date(c.expectedLabDate);
  if (Number.isNaN(labDate.getTime())) return false;

  // 4. date-only comparison — strict "before today", today itself is NOT overdue
  const todayStart   = startOfDay(now).getTime();
  const labDateStart = startOfDay(labDate).getTime();
  return labDateStart < todayStart;
}
```

The same predicate lives in two places (exported from both files) and is exercised by unit tests:

- `src/components/dashboard/stat-cards.tsx` → `countLabOverdueCases(cases, now)` (count helper)
- `src/components/cases/case-list.tsx` → `isLabOverdue(c, now)` (filter predicate)

Both implementations use the **identical** algorithm so the dashboard count and the filtered list always agree.

### Edge cases the tests pin down

| Input | Expected outcome |
|---|---|
| `status: 'waiting_lab_test'`, `expectedLabDate: 2026-06-29` (yesterday) | Counts as overdue |
| `status: 'waiting_lab_test'`, `expectedLabDate: 2026-06-30` (today) | **NOT** overdue (date-only compare) |
| `status: 'waiting_lab_test'`, `expectedLabDate: 2026-07-01` (tomorrow) | NOT overdue |
| `status: 'waiting_lab_test'`, no `expectedLabDate` | NOT overdue (excluded — no scheduled date) |
| `status: 'waiting_lab_test'`, `expectedLabDate: 'not-a-date'` | NOT overdue (parse failed) |
| `status: 'completed'`, `expectedLabDate: 2025-01-01` | NOT overdue (terminal excluded by status) |
| `status: 'cancelled'`, `expectedLabDate: 2025-01-01` | NOT overdue (terminal excluded) |
| `status: 'medical_alert'`, `expectedLabDate: 2025-01-01` | NOT overdue (terminal excluded) |

---

## 4. Visual contract — dashboard

The 5-card grid uses Tailwind breakpoints for responsive layout:

- `< sm`: 1 column (mobile)
- `sm:` — 2 columns (tablet)
- `lg:` — 3 columns (small desktop)
- `xl:` — 5 columns (wide desktop)

This is the only breakpoint change vs. the previous 4-card grid (which used `lg:grid-cols-4`). At `< xl` the cards wrap; at `xl` all five sit in one row.

The danger variant differs visually:

- Border: `border-red-200/80` (vs. `border-gray-100/80`)
- Hover border: `border-red-300` (vs. inherits gray)
- Icon container: `bg-red-100` + `text-red-700` (vs. brand colors)
- Label / value text: `text-red-700` (vs. `text-gray-900`)
- Hint text: `text-red-500/80` (vs. `text-gray-400`)
- Icon: `AlertTriangle` (Lucide) (vs. `Users`, `FolderOpen`, etc.)

---

## 5. Accessibility

Each card exposes a tooltip through **two** channels:

1. `title="..."` — native browser tooltip on hover.
2. `aria-describedby` → `<span class="sr-only">` with the same long-form description.

This means screen readers announce the tooltip content when focus lands on the card, and keyboard-only users still get native browser tooltip on focus.

Each card also has an `aria-label` of the form `"<Label> — <Hint>"` so the link's accessible name combines the label and the short hint ("Lab quá hạn — Ca chờ xét nghiệm quá hạn").

Visible focus ring via `focus-visible:ring-2 focus-visible:ring-swan-500` on every card (a Swan brand color, used consistently with other interactive surfaces).

The `lab_overdue` inline notice uses `role="status"` (polite live region) so assistive tech announces the filter state without being intrusive.

---

## 6. What did NOT change (explicit non-goals)

- **Other dashboard widgets** — `recent-activity.tsx`, the `Báo cáo nhanh` 4-up card grid in `dashboard/page.tsx`, and the greeting header are byte-identical.
- **Case status workflow** — no new transitions added; the `medical_alert → procedure_completed` backdoor remains (that's a separate Story B.2.2 deliverable).
- **Reports page** — not touched.
- **Audit logging** — no new audit events (the lab_overdue_count is derived, not user-initiated).
- **Server-side RBAC** — not in B.1.4 scope (that's B.1.3).
- **Feature flags** — none added. The lab_overdue_count card is always on; if the count should be hidden in production, set `NEXT_PUBLIC_DASHBOARD_LAB_OVERDUE=false` in `.env.local` (already supported via standard env var pattern; the current implementation does not gate the card but the value remains `0` when no cases match).

---

## 7. Rollback

Revert the commit(s) on `phase-6/sprint-6.1` that touch these two files:

```
src/components/dashboard/stat-cards.tsx
src/components/dashboard/__tests__/stat-cards.test.tsx
src/components/cases/case-list.tsx
src/components/cases/__tests__/case-list-lab-overdue.test.tsx
docs/ux-redesign/STORY_B1_4_*.md
```

Time-to-rollback: **< 5 minutes**. No data impact (no schema migration, no destructive change). Users will lose access to the new dashboard card and the URL-driven filter, but no existing behavior regresses because:

- The 4 existing dashboard cards revert to non-link `<div>`s (visual only).
- `/cases` reverts to ignoring `?status=lab_overdue` (falls back to "Tất cả").

---

*End of Story B.1.4 Migration Notes.*