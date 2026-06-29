# Story B.1.2 — Implementation Report

> **Story:** B.1.2 — Remove `'scheduled'` from `hospital_confirmed` Transitions
> **Audit ID:** F-CRIT-04 · **Sprint:** 6.1 · **Owner:** FE-1
> **Status:** ✅ Complete · **Risk realized:** 🟢 Low (as planned)

---

## Summary

Closed patient-safety defect F-CRIT-04 by removing the `"scheduled"` skip from the `hospital_confirmed` forward-transition set. Cases must now pass through `waiting_doctor_review → medically_approved` (with optional `waiting_lab_test` branch) before reaching `scheduled`.

| Dimension | Outcome |
|-----------|---------|
| Code lines changed | 4 (one removal + 3-line rationale comment) |
| Files modified | 1 (`src/constants/case-status.ts`) |
| Files created | 1 test + 2 docs |
| `npm run lint` | ✅ 0 warnings |
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm run build` | ✅ 34 routes, 0 errors |
| `npm run test` | ✅ 8 test files, 133 tests pass |

---

## 1. Files changed

### Modified
- **`src/constants/case-status.ts`** (line 73)
  - Removed the string `'scheduled'` from `CASE_STATUS_TRANSITIONS['hospital_confirmed']`.
  - Added 3-line JSDoc-style comment above the entry documenting the F-CRIT-04 rationale and pointing to the migration notes.

### Created
- **`src/constants/__tests__/case-status.test.ts`** — Vitest unit test suite with 7 test cases:
  - `hospital_confirmed` does NOT include `'scheduled'`.
  - `hospital_confirmed` still includes `'waiting_doctor_review'`.
  - `hospital_confirmed` still includes `'waiting_lab_test'`.
  - `hospital_confirmed` has exactly `[waiting_doctor_review, waiting_lab_test]` (snapshot of allowed set).
  - `'scheduled'` is still reachable via `'medically_approved'` (clinical gate path remains open).
  - `'medically_approved'` is the **sole** direct entry into `'scheduled'` (regression guard against future re-introduction of shortcuts).
  - Regression suite: `'draft'`, `'medical_alert'`, `'scheduled'` transition rows are untouched.

- **`docs/ux-redesign/STORY_B1_2_MIGRATION_NOTES.md`** — context, before/after, consumer impact, rollback procedure.

- **`docs/ux-redesign/STORY_B1_2_IMPLEMENTATION_REPORT.md`** — this file.

### Explicitly NOT touched (per "preserve existing status workflow except the approved transition removal")
- `src/constants/case-status.ts:90` — `medical_alert: ['procedure_completed', 'complaint', 'completed']` — **preserved** (B.2.2 scope).
- `CaseStatus` union in `src/lib/types/case.ts` — **not extended** with `medical_alert_resolved` (B.2.2 scope).
- `src/app/api/cases/[id]/status/route.ts` — **not modified** (B.1.3 scope).
- `src/components/cases/status-workflow.tsx` — **not modified** (already reads from the constant; no code change needed).
- All other `CASE_STATUS_TRANSITIONS` rows — **preserved verbatim**.

---

## 2. Tests executed

### Automated (Vitest)

```bash
$ npm run test

 ✓ src/components/ui/__tests__/textarea.test.tsx          (19 tests)
 ✓ src/components/ui/__tests__/close-icon-button.test.tsx (19 tests)
 ✓ src/components/ui/__tests__/tabs.test.tsx              (21 tests)
 ✓ src/components/ui/__tests__/modal.test.tsx             (24 tests)
 ✓ src/components/customers/__tests__/customer-form.test.tsx (14 tests)
 ✓ src/constants/__tests__/case-status.test.ts            ( 7 tests)   ← NEW

 Test Files  8 passed (8)
      Tests  133 passed (133)
```

The 7 new tests in `case-status.test.ts` are part of the 133 total.

### Build gates

```bash
$ npm run lint
✔ No ESLint warnings or errors

$ npx tsc --noEmit
(zero output)

$ npm run build
✓ Compiled successfully
34 routes, 0 errors
```

(Note: initial `npm run build` failed with a stale `.next` cache pointing at `/api/cases/[id]/staff` — cleared the cache and re-ran, then build passed. The failure was unrelated to this story.)

---

## 3. Risks introduced

**Risk profile:** minimal. The change is behaviour-only, single-file, additive-comment, no schema change.

| Risk | Likelihood | Impact | Mitigation in place |
|------|-----------|--------|---------------------|
| Operator mid-flight on `hospital_confirmed` clicks "Đã xếp lịch" and gets an error | **Certain** (for the very small subset of operators who were using the shortcut) | Low — clear UX fallback: route through `waiting_doctor_review` first | Toast error already surfaces the existing 400 message in `src/app/api/cases/[id]/status/route.ts:43-48`. No code change required. |
| Some latent documentation references the old transition as a happy path | Low | Low — docs need sweeping, not code | The user-facing transition label "Đã xếp lịch" is rendered dynamically from `CASE_STATUS_LABELS`. No copy hardcoded in JSX. |
| Unrelated code path relied on `hospital_confirmed → scheduled` for fixture / test data | **None** — no fixtures or seed data were found that depend on this transition | None | Verified by grep on `mock/store.ts` and all `__tests__/` directories. |
| B.1.3 / B.2.2 might be implemented against a stale assumption | Low | Medium if their authors don't see this commit | Migration notes §"Related stories" calls out this dependency explicitly. |
| Hidden transition in `route.ts` short-circuits the constant | Low | High if true | Audited `route.ts` — it reads `CASE_STATUS_TRANSITIONS[existing.status]` dynamically on every request. No static fallbacks. |

### Risks explicitly NOT introduced by this story

- No enum extension (`CaseStatus` union unchanged).
- No new RBAC matrix mutation.
- No API route behavioural change beyond the 400-when-not-allowed contract that already existed.
- No UI rendering change (component already derives from the constant).

---

## 4. Rollback steps

**Time to rollback:** < 5 minutes. **Data impact:** none. **User impact:** none once removed.

```bash
# Step 1 — Revert the source edit
git diff src/constants/case-status.ts   # confirm change is local
# Edit line 73 back to:
#   hospital_confirmed: ['waiting_doctor_review', 'waiting_lab_test', 'scheduled'],
# Remove the 3-line rationale comment above it.

# Step 2 — Drop or skip the new test cases
rm src/constants/__tests__/case-status.test.ts
# OR, if you want to keep the test suite alive during partial rollback:
#   - replace the failing assertion `expect(allowed).not.toContain('scheduled')`
#     with `expect(allowed).toContain('scheduled')` and document.

# Step 3 — Verify
npm run test                  # expect green
npm run lint                  # expect 0 warnings
npx tsc --noEmit              # expect 0 errors
npm run build                 # expect 34 routes, 0 errors

# Step 4 — Push
git add src/constants/case-status.ts src/constants/__tests__/case-status.test.ts
git commit -m "revert(B.1.2): re-add hospital_confirmed → scheduled transition"
```

### Why rollback is safe

- Single-line behavioural edit; downstream consumers were never depending on `hospital_confirmed → scheduled` semantically (they only read the constant).
- No DB migration ran.
- No user state changed.
- The test file can be deleted in one shot or patched in < 1 min.

---

## 5. Definition of Done — verification

From `SPRINT_6_1_EXECUTION_PLAN.md` §8.2:

- [x] **B.1.2 DoD:** `getAllowedTransitions('hospital_confirmed')` does NOT include `'scheduled'`; unit test green.
- [x] **B.1.2 DoD:** Unit test committed (`src/constants/__tests__/case-status.test.ts`).
- [x] **Build & code quality (Sprint §8.1):**
  - [x] `npx tsc --noEmit` → 0 errors
  - [x] `npm run lint` → 0 warnings
  - [x] `npm run build` → 34 routes, 0 errors
  - [x] `npm run test` → 133 tests pass (8 files)
- [x] **No new `eslint-disable` / `@ts-ignore` comments added.**
- [x] **No new env vars introduced.**
- [x] **Anti-pattern gate:** No A6, A8, A13 anti-patterns introduced. (A13 = permissive transitions is the very thing this story *fixes*.)
- [x] **Documentation:** Migration notes + this implementation report committed.

---

## 6. Manual smoke (recommended in dev mode)

Per `SPRINT_6_1_EXECUTION_PLAN.md` §6.3 — B.1.2 manual smoke:

```bash
npm run dev
# 1. Open /cases/[id] for any case in 'hospital_confirmed'
# 2. Verify the "Đã xếp lịch" button does NOT appear in the StatusWorkflow panel.
# 3. Verify the two correct forward-transition buttons ("Chờ bác sĩ duyệt", "Chờ xét nghiệm") still appear.
# 4. (Optional) curl POST /api/cases/[id]/status with {status: "scheduled"}; expect HTTP 400.
```

---

*End of implementation report.*
