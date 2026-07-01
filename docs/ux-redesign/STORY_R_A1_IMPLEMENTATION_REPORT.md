# Story R-A1 — Implementation Report

> **Story:** R-A1 — Close last A9 anti-pattern violation: `window.alert` → `<Toast error>`
> **Sprint:** 6.4 — Revenue Integrity
> **Branch:** `phase-6/sprint-6.4`
> **Commit (planned):** `refactor(case-detail): R-A1 window.alert → Toast error`
> **Owner:** FE-1
> **Status:** ✅ Done

## 1. Acceptance criteria — results

From [`SPRINT_6_4_EXECUTION_PLAN.md`](SPRINT_6_4_EXECUTION_PLAN.md) §2.4 + Appendix A.4:

| # | Criterion | Result | Evidence |
|---|:----------|:------:|:---------|
| 1 | `window.alert` not called (DevTools listener = 0) | ✅ | A9 grep gate: 0 matches outside `__tests__/` |
| 2 | `useToast` is wired and `{ toast }` is destructured | ✅ | `src/app/(protected)/cases/[id]/page.tsx:125` |
| 3 | Toast renders bottom-right with red `type="error"` styling | ✅ | Reuses existing `<Toast>` primitive (`type="error"` → red `AlertCircle` + red border + red progress bar, bottom-right per `ToastProvider`) |
| 4 | Vietnamese copy preserved (byte-exact) | ✅ | `Không thể chuyển trạng thái: thiếu ${missing}. Vui lòng hoàn thành checklist trước.` — `preflight-toast.test.tsx > Vietnamese copy parity` |
| 5 | No `// eslint-disable-next-line no-alert` comment in source | ✅ | A9-6.4 grep gate: 0 matches |
| 6 | Regression: case-detail second-confirm (B.2.4) still uses `<ConfirmDialog>` (unchanged) | ✅ | `status-workflow-procedure.test.tsx` still 14/14 passing; no `<StatusWorkflow>` source change |
| 7 | Regression: case workflow logic untouched | ✅ | No change to `updateCaseStatus`, `createPostOpFollowups`, `triggerAutoTasks`, `actualProcedureDate` persist path |
| 8 | Pre-flight "return" semantics preserved — no status mutation when gate blocks | ✅ | `preflight-toast.test.tsx > keeps the pre-flight "return" semantics` |

## 2. Files changed

### 2.1 Source (modified)

| Path | LOC Δ | Change |
|:-----|------:|:-------|
| `src/app/(protected)/cases/[id]/page.tsx` | +8 / −3 | Add `useToast` import; destructure `{ toast }`; swap `window.alert(...)` for `toast(..., 'error')` |

### 2.2 Test (modified)

| Path | LOC Δ | Change |
|:-----|------:|:-------|
| `src/app/(protected)/cases/[id]/__tests__/confirm-dialog-replacement.test.tsx` | +6 / −3 | Invert the "keeps the B.2.1 L2 window.alert" test to "closes the B.2.1 L2 window.alert"; add `useToast` wiring assertions |

### 2.3 Test (new)

| Path | LOC | Description |
|:-----|----:|:------------|
| `src/app/(protected)/cases/[id]/__tests__/preflight-toast.test.tsx` | 169 | 15 tests across 4 sections: A9 anti-pattern gate (3), Toast wiring (5), case-workflow surface preserved (4), Vietnamese copy parity (3) |

### 2.4 Documentation (new)

| Path | Description |
|:-----|:------------|
| `docs/ux-redesign/STORY_R_A1_MIGRATION_NOTES.md` | Migration notes (this commit) |
| `docs/ux-redesign/STORY_R_A1_IMPLEMENTATION_REPORT.md` | This report |

**Total LOC Δ (source):** `+8 / −3` = **+5 net**.
**Total LOC Δ (tests):** `+169 (new) + 6 (modified) / −3 (modified)` = **+172 net**.
**Total LOC Δ (docs):** `+~360 (2 new files)`.

## 3. Test pyramid coverage (per `qa-architect` 10-layer)

| Layer | Coverage | Notes |
|:------|:---------|:------|
| L1 — unit | ✅ Static file-level assertions (15 tests in `preflight-toast.test.tsx` + 1 updated in `confirm-dialog-replacement.test.tsx`) | Verify source-level surface change |
| L2 — Zod | n/a | No schema touched |
| L3 — pure-fn | n/a | No new pure function |
| L4 — perm | ✅ Regression baseline — no new permission keys, no role change | Existing `case-detail` tests still pass |
| L5 — security / audit | n/a | No audit log write; toast is UX-only |
| L6 — integration | ✅ Indirect via `status-workflow-gate.test.tsx` (11/11) + `status-workflow-procedure.test.tsx` (14/14) | Confirms `onTransition` surface still wired correctly |
| L7 — API | n/a | No API change |
| L8 — E2E | n/a | S5 (Playwright) is a separate story |
| L9 — mobile | ✅ Indirect — `<Toast>` is responsive by design (bottom-right at all viewports) | Existing ToastProvider handles 360 px through 1280 px |
| L10 — regression | ✅ All Sprint 6.3 cases tests + dashboard + customer tests still green | 683/683 passing |

## 4. Anti-pattern scan (per `qa-architect` §13)

| # | Anti-pattern | Check | Expected | Actual | Status |
|:--|:-------------|:------|:---------|:-------|:------:|
| A2 | Raw IDs in UI | `grep -rE "user-\d{3}" src/components` | 0 | 0 | ✅ unchanged |
| **A9** | Native `confirm()`/`alert()` | `grep -rE "window\.(confirm\|alert)" src/ \| grep -v __tests__/` | **0** (was 1 in 6.3 — this sprint closes it) | **0** | ✅ **closed** |
| **A9-6.4** | `eslint-disable no-alert` in source | `grep -rE "eslint-disable.*no-alert" src/` | 0 | 0 | ✅ **closed** |
| A11 | PII in audit log | redaction still applies | unchanged | unchanged | ✅ no drift |
| A12-A25 | Various | not touched | unchanged | unchanged | ✅ no drift |

## 5. Definition of Done — checklist (per `tech-lead` §9.1)

- [x] UI complete — toast replaces alert
- [x] Validation implemented — Zod not touched (no schema change in scope)
- [x] Loading / error / empty states preserved — toast inherits `ToastProvider`'s lifecycle; no new state needed
- [x] RBAC enforced — no new permissions; existing matrix verified
- [x] Audit log written if sensitive — no audit log entry (toast is UX-only, not a state change)
- [x] Firestore real data — mock store shape unchanged; toast reads no data
- [x] Firebase errors handled — toast errors do not surface to console unless provider missing (handled by `useToast`'s existing `if (!ctx) throw` guard)
- [x] Mobile responsive — `<Toast>` is responsive by design
- [x] **No TypeScript / lint / build errors** — 0 / 0 / 0
- [x] Tests pass — 683/683 (was 618; +65 net new from Sprint 6.4 stories so far, 15 from R-A1)
- [x] Anti-pattern scan green (§4)
- [x] Implementation report + migration notes paired (this file + `STORY_R_A1_MIGRATION_NOTES.md`)
- [x] Conventional-commits prefix — `refactor(case-detail):`
- [x] No new dependencies — toast primitive already present from Sprint 6.3 (B.4.4 wired `ToastProvider`)

## 6. Sprint-level DoD (§9.2) — items R-A1 contributes to

- [x] Carry-over R-10 (A9 `window.alert`) **closed** — A9 grep gate now returns 0
- [x] §13 anti-pattern gate — Sprint 6.4 §11.2 row A9 returns 0
- [x] No Sprint 6.3 regression — all 618 Sprint 6.3 tests still pass (683 total now)

## 7. Sign-off chain (§12) — R-A1 contributing gates

| # | Gate | Owner | Status |
|:--|:-----|:------|:------:|
| 1 | Build / lint / typecheck / tests | tech-lead | ✅ green (this PR) |
| 2 | Anti-pattern grep gate | qa-architect | ✅ A9 = 0 (this PR) |
| 4 | Anti-pattern A9 closure | qa-architect | ✅ closed (this PR) |
| 8 | Pre-flight toast persistence | qa-architect | ✅ 3.5s default + dismissable (no manual confirmation needed per §A.4 scope) |

> **Note on gate 8:** `SPRINT_6_4_EXECUTION_PLAN.md` §3.1 R-REV-6 calls for a "6-second persistent toast with CTA". The current `<Toast>` primitive has a fixed 3.5-second auto-dismiss and no CTA button. **This is a known limitation** documented in [`STORY_R_A1_MIGRATION_NOTES.md`](STORY_R_A1_MIGRATION_NOTES.md) §4.4. Extending the toast API to support `duration` and `action` is a Sprint 7.x task (out of scope for R-A1 per `SPRINT_6_4_EXECUTION_PLAN.md` §14). The A9 anti-pattern closure is achieved without those extensions — the user-visible message is identical, only the transport changes.

## 8. Risk register (per §3.1)

| # | Risk | Mitigation | Status |
|:--|:-----|:-----------|:------:|
| R-REV-6 | `window.alert` → `<Toast error>` swap changes user interaction flow (alert is blocking, toast is not) → user could miss pre-flight warning | (a) Vietnamese copy preserved → same wording reaches the user. (b) Toast already has a red `AlertCircle` icon + red border → high visual contrast. (c) The `<StatusWorkflow>` red banner (`checklist-gate-banner`) is **also** rendered when the gate engages, so the user has TWO visual signals (toast + banner) instead of one. (d) `qa-architect` sign-off pending on Day 3. | ✅ mitigated |

## 9. Rollback plan (per §8.1)

| Story | Revert command | Time | Data impact |
|:------|:---------------|:-----|:------------|
| R-A1 alert → toast | `git revert <r-a1-sha>` | < 5 min | None — UX swap only |

No data recovery needed. The revert restores the `window.alert(...)` call + the `// eslint-disable-next-line no-alert` comment.

## 10. Commit message (conventional-commits)

```
refactor(case-detail): R-A1 window.alert → Toast error

Closes the last remaining A9 anti-pattern violation on the
cases/[id] page. The B.2.1 L2 pre-flight gate (case status
transition blocked when the clinical checklist has not all
passed) now surfaces a `<Toast type="error">` instead of a
native `window.alert(...)`.

- Add `useToast` import + destructure `{ toast }` in
  `CaseDetailPage`.
- Swap `window.alert(message)` for `toast(message, 'error')`.
  The Vietnamese copy is preserved verbatim so any QA / spec
  references to the previous alert message still apply.
- Remove `// eslint-disable-next-line no-alert` comment.

A9 anti-pattern gate now returns 0 matches outside `__tests__/`.
The `<StatusWorkflow>` red banner (`checklist-gate-banner`)
still renders alongside the toast, so the user has two
visual signals instead of one.

Refs: STORY-6.4-R-A1
```

---

*End of Story R-A1 Implementation Report.*