# Story B.1.2 — Migration Notes

> **ID:** F-CRIT-04 · **Sprint:** 6.1 · **Owner:** FE-1 · **Story:** B.1.2
> **Date:** 2026-06-29
> **Scope:** 1 source file edited, 1 test file created, 2 doc files created.
> **Risk:** 🟢 Low · **Effort:** ~1h

---

## What changed

Removed `'scheduled'` from the `hospital_confirmed` entry of `CASE_STATUS_TRANSITIONS` in `src/constants/case-status.ts:73`.

**Before**
```ts
hospital_confirmed: ['waiting_doctor_review', 'waiting_lab_test', 'scheduled'],
```

**After**
```ts
// B.1.2 (F-CRIT-04): clinical-safety gate — case must pass doctor review (and
// lab when applicable) before scheduling. `scheduled` is reachable only via
// `medically_approved`. See docs/ux-redesign/STORY_B1_2_MIGRATION_NOTES.md.
hospital_confirmed: ['waiting_doctor_review', 'waiting_lab_test'],
```

A 3-line rationale comment was added above the entry to document the patient-safety rationale inline (so future contributors don't accidentally re-add the shortcut).

---

## Why this matters

Pre-fix, a case in `hospital_confirmed` could jump straight to `scheduled`
without ever passing through `waiting_doctor_review` or `medically_approved`.
This is the **single highest-ranked clinical-gate defect** flagged by the
`UX_AUDIT_REPORT.md` (F-CRIT-04, A12 anti-pattern "Skipped clinical gates").

The only correct path to `scheduled` is now:

```
hospital_confirmed → waiting_doctor_review → medically_approved → scheduled
                       └─→ waiting_lab_test → lab_test_done → medically_approved → scheduled
```

The new entry-point-guard test (`medical_alert_resolved` analogous check) ensures no future regression re-introduces a back-door: `medically_approved` is the **sole** direct entry into `scheduled`.

---

## Consumer impact

### Code surfaces touched

| File | Impact |
|------|--------|
| `src/constants/case-status.ts:73` | 1 string removal + 3-line comment. |
| `src/components/cases/status-workflow.tsx` | Reads `CASE_STATUS_TRANSITIONS[currentStatus]` to render forward-transition buttons. The "Đã xếp lịch" button no longer renders for cases in `hospital_confirmed`. **No code change required** — the component already derives from the constant. |
| `src/app/api/cases/[id]/status/route.ts` | The PATCH handler validates `newStatus ∈ CASE_STATUS_TRANSITIONS[existing.status]` and returns HTTP 400 on mismatch. `hospital_confirmed → scheduled` now returns `{ "error": "Không thể chuyển trạng thái từ \"hospital_confirmed\" sang \"scheduled\"" }` with HTTP 400. **No code change required.** |
| `src/app/(protected)/cases/[id]/page.tsx` | Visual badge + step indicator still renders; forward-transition controls now omit the "Đã xếp lịch" button. |

### Adjacent code surfaces explicitly NOT touched (per scope rule)

- `medical_alert: ['procedure_completed', 'complaint', 'completed']` (line 90) — **preserved as-is.** Removing `procedure_completed` from there belongs to Story B.2.2.
- The `medical_alert_resolved` status itself — **not added.** Belongs to B.2.2.
- API route RBAC check (`FEATURE_SERVER_RBAC`) — **not added.** Belongs to B.1.3.
- Any other transition row in `CASE_STATUS_TRANSITIONS` — **preserved verbatim.**

### Tests / mocks / seed data

- No mock seed data references `hospital_confirmed → scheduled` as a happy-path.
- No audit-log row references this transition.
- The 8 existing audit-log rows about cases stay in `mock/store.ts` — none of them log this transition.

---

## Data migration

None. This is **behavioural-only** — the field schema (`CaseStatus` union) is unchanged. Existing case rows in any state remain valid; only the user-initiated transition is now blocked at both UI and API.

---

## Backward compatibility

- **Existing `hospital_confirmed` rows:** untouched.
- **Existing `scheduled` rows:** untouched — they remain in that state.
- **Existing in-flight case progressions** (if any operator was mid-click when this shipped): their next click on "Đã xếp lịch" will fail with a toast error. Operators must transition through `waiting_doctor_review → medically_approved` first.

---

## Rollback procedure

| Step | Action | Time |
|------|--------|------|
| 1 | Revert the single edit in `src/constants/case-status.ts` (re-add `'scheduled'` to the array). | < 1 min |
| 2 | Delete the corresponding test case (or skip with `.skip` for the duration of the rollback). | < 1 min |
| 3 | Re-run `npm run test` to confirm green. | < 30s |
| 4 | Re-run `npm run build` to confirm green. | < 30s |

**Total rollback time:** < 5 minutes.

There is no DB migration to undo. No user-facing surfaces (pages, modals, dashboards, reports) reference this transition by hardcoded string — every consumer reads from the constant, so the revert is a single-line edit with no cascading fixes needed.

---

## Related stories

- **B.1.3** (Server RBAC enforcement) — uses the now-cleaner `CASE_STATUS_TRANSITIONS` as its data source for the 400 validation. This story ships B.1.2's contract.
- **B.2.2** (`medical_alert_resolved`) — ships a different transition removal in the same file. The test file `src/constants/__tests__/case-status.test.ts` is scoped B.1.2 only; B.2.2 should extend (not replace) the file when its story lands.
- **B.1.4** (`lab_overdue_count` StatCard) — counts `hospital_confirmed` cases with overdue labs. The lab path (`hospital_confirmed → waiting_lab_test → lab_test_done → medically_approved → scheduled`) is unaffected by this removal.

---

*End of migration notes.*
