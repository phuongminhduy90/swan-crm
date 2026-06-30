# Sprint 6.2 — Clinical Gates

> **Date:** 2026-06-30
> **Sprint window:** 5 dev-days, 2–3 FEs (~80h capacity, ~22h committed, ~58h buffer)
> **Theme:** Close the highest-impact patient-safety gaps — checklist gating, PII redaction, second-confirm on procedure completion, and auto-escalation of high-pain followups.
> **Inputs synthesized from:**
> - [`IMPLEMENTATION_BACKLOG.md`](IMPLEMENTATION_BACKLOG.md) View 2 (Sprint 6.2)
> - [`UI_REFACTOR_PLAN.md`](UI_REFACTOR_PLAN.md) §1 (Phase B.2), §5 (testing), §7 (rollback), §9 (feature flags)
> - [`SPRINT_6_1_COMPLETION_REPORT.md`](SPRINT_6_1_COMPLETION_REPORT.md) — state of `main` going into 6.2, carry-over risks (RR-2, RR-3)
> - Skills: `tech-lead`, `medical-workflow-expert`, `qa-architect`, `release-manager`
> **Owners:** tech-lead (delivery), medical-workflow-expert (clinical sign-off), qa-architect (test strategy), release-manager (release gate)
> **Status:** Plan approved — execution to follow on branch `phase-6/sprint-6.2`

---

## Context — Why Sprint 6.2 now

Sprint 6.1 closed 14 stories (Phase A foundation + 12 quick-win patient-safety / RBAC / reporting fixes) and landed **259 tests across 15 files** with all quality gates green. Every prerequisite for the clinical-gate work is now in place:

- **A.1 Tabs ARIA + arrow-key** — needed by B.2.1 checklist panel ✅
- **A.3 CloseIconButton** — needed by B.2.4 second-confirm dialog ✅
- **B.1.4 dashboard `lab_overdue_count`** — context for B.1.5 escalation ✅
- **B.1.3 server-side role enforcement** — same permission matrix used by B.2.1 gate ✅
- **B.2.2 `medical_alert_resolved` terminal status** — sibling story; B.1.5 escalation writes to this status ✅

Sprint 6.2 is **Phase 6 Sprint 2 of 9** (the "Clinical Gates" wave). It lands the **four highest-impact patient-safety gaps** identified in the UX audit (`F-CRIT-03`, `F-CRIT-10`, `F-HIGH-20`, `F-MED-17`). All four touch the case-detail surface and post-op followup flow — the two areas most likely to cause patient harm if done wrong.

This plan sequences the 4 stories from `IMPLEMENTATION_BACKLOG.md` View 2 (Sprint 6.2), reconciles the carry-over risks (RR-2, RR-3) inherited from 6.1, defines a paired-review / medical-director sign-off process, and pre-builds a commit sequence so each PR is reviewable in < 30 min.

> **⚠️ This is the highest-risk sprint in Phase 6 so far.** B.2.1 (checklist gate) is the only 🔴-risk story since 6.1's B.1.3 / B.3.1, and it is the first story in this codebase that blocks a status transition based on a derived clinical state. Medical director sign-off is **non-negotiable** before promotion in production.

---

## 1. Stories included in Sprint 6.2

Pulled from `IMPLEMENTATION_BACKLOG.md` View 2 — Sprint 6.2 table. **4 stories, ~22 h committed, 1 🔴, 3 🟡.**

| ID | Title | Owner | Est | Risk | Flags | Backlog ref | Sprint 6.1 prereq |
|---|---|---|---:|---|---|---|---|
| B.2.1 | Add 6 clinical items to checklist + gate `allPassed` on status transitions | FE-2 | 8h | 🔴 | `FEATURE_CHECKLIST_GATE`, `FEATURE_CLINICAL_CHECKLIST` | F-CRIT-03, F-CRIT-10 | A.1 Tabs ARIA ✅ |
| B.2.3 | Audit PII redaction in diff (`medicalNote` / `privacyNote` / `nationalIdNumber`) | FE-1 | 4h | 🟡 | — | F-MED-17 | None |
| B.2.4 | `procedure_completed` second-confirm dialog (warning variant, requires `actualProcedureDate`) | FE-2 | 4h | 🟡 | — | F-CRIT-03 (part) | A.3 CloseIconButton ✅ |
| B.1.5 | Auto-escalate `issue_reported` / `painLevel >= 4` to assigned doctor + nurse | FE-2 | 6h | 🟡 | — | F-HIGH-20 | B.1.4 lab overdue context ✅ |
| — | **Total** | — | **22h** | — | — | — | — |

**Capacity allocation (2 FEs × 5 days = 80h, 3 FEs if FE-3 available):**

- FE-1: 4h (B.2.3) + ~10h carry-over coordination (RR-2 reconciliation) ≈ 14h
- FE-2: 18h (B.2.1 + B.2.4 + B.1.5) ≈ 18h committed, plus 4h medical sign-off coordination
- FE-3: standby capacity (~58h buffer total) — assigned to RR-3 sign-off coordination, B.1.4 Suspense boundary cleanup, and Sprint 6.2 paired review

**Plus carry-over work (in-scope for Sprint 6.2 execution window, not backlog stories):**

| ID | Title | Owner | Est | Source | Why in 6.2 |
|---|---|---|---:|---|---|
| **RR-2** | Reconcile `CASE_STATUS_CHANGE_ROLES` (drop `nurse`, `cskh_postop` who lack `cases:write`) | FE-1 | 1h | Sprint 6.1 RR-2 | B.2.1 gate reuses this matrix; reconciliation is a 1-line fix that prevents 6.1's dead-role bug from contaminating 6.2's gate math. Must land before B.2.1 PR. |
| **RR-3** | Coordinate B.3.1 sign-off (CEO + accountant-lead + product-owner) | release-manager + product-owner | 2h coordination | Sprint 6.1 RR-3 | B.3.1's `FEATURE_PAYMENT_SOD` flag cannot be promoted in prod without sign-off. Coordinating in week 1 of 6.2 unblocks future flag promotion. |
| **RR-4** | Fix B.1.4 Suspense boundary (Next.js 14 static-export warning) | FE-3 | 0.5h | Sprint 6.1 RR-4 | Trivial build-time fix; uses spare FE-3 capacity. |
| **RR-8** | Adopt Conventional Commits prefix for 6.2 onward | tech-lead | 0.5h (CONTRIBUTING.md edit) | Sprint 6.1 RR-8 | Prevents the mixed-Vietnamese/English label drift noted in 6.1. |

**Adjusted totals:** ~27 h committed (FE-1 ~5h + FE-2 ~18h + RR coordination ~4h), leaving **~53 h buffer** for code review, paired-review on the 🔴 B.2.1 story, medical director sign-off coordination, fix-ups, and B.1.4 manual smoke verification.

### Sprint 6.2 explicitly does NOT include

- **All other Phase 6 stories** (B.1.6, B.1.7, B.3.1 already shipped in 6.1) — done
- **B.2.2 `medical_alert_resolved`** — shipped in 6.1
- **B.4.x AppShell + critical UX** — Sprint 6.3
- **C.3.x Forms + inputs** (doctor identity, lab date validation) — Sprint 7.3
- **B.3.2 revenue tooltip** — Sprint 6.4
- **All Phase C (Sprints 7.1–7.5) work** — future

---

## 2. Dependencies

### 2.1 Inter-story dependencies (within Sprint 6.2)

```
RR-2 (CASE_STATUS_CHANGE_ROLES reconcile)
   └─→ B.2.1 (gate uses the role matrix)

B.1.5 (auto-escalate)
   ├─→ uses B.1.4 dashboard lab_overdue context (already shipped)
   ├─→ writes to medical_alert via triggerMedicalAlert (already exists)
   └─→ writes audit log via writeAuditLog (already exists)

B.2.1 (checklist gate)
   ├─→ depends on A.1 Tabs ARIA (shipped 6.1)
   ├─→ depends on B.1.3 server RBAC (shipped 6.1) for the actual API gate
   └─→ feeds allPassed into StatusWorkflow (existing component)

B.2.4 (procedure_completed second-confirm)
   ├─→ depends on A.3 CloseIconButton (shipped 6.1)
   ├─→ adds 'warning' variant to existing ConfirmDialog
   └─→ reads `actualProcedureDate` (field exists in CaseRecord; enforcement on server is C.3.2 / Sprint 7.3)

B.2.3 (PII redaction in diff)
   └─→ no functional dependency; can ship in any order
```

**Execution order (dependency-respecting):**

1. **RR-2 reconciliation** (1h, Day 1 morning) — unblocks B.2.1
2. **B.2.3 PII redaction** (4h, Day 1) — independent, ships first as a quick win to close `F-MED-17`
3. **B.2.4 second-confirm dialog** (4h, Day 2) — independent, ships before B.2.1 to confirm the `warning` variant pattern is stable
4. **B.1.5 auto-escalate** (6h, Day 2–3) — independent, runs in parallel with B.2.1
5. **B.2.1 checklist gate** (8h, Day 3–4) — the 🔴-risk finale, requires medical director sign-off

### 2.2 Sprint 6.1 prerequisites (verified during planning)

| Prereq | Status | Reference |
|---|---|---|
| `src/components/ui/tabs.tsx` has `role="tablist"`, arrow-key nav | ✅ Shipped in 6.1 (A.1) | `src/components/ui/__tests__/tabs.test.tsx` (21 tests) |
| `src/components/ui/close-icon-button.tsx` exists with `ariaLabel` prop | ✅ Shipped in 6.1 (A.3) | `src/components/ui/close-icon-button.tsx` |
| `src/lib/feature-flags.ts` exports `isFlagEnabled()` + `useFeatureFlag()` | ✅ Shipped in 6.1 (INF-2) | `src/lib/feature-flags.ts` |
| `src/lib/firestore/audit.ts` exposes `writeAuditLog()` | ✅ Existed pre-6.1 | `src/lib/firestore/audit.ts` |
| `src/lib/notifications/trigger.ts` exposes `triggerMedicalAlert()` | ✅ Existed pre-6.1; recipients extended in 6.1 (B.1.6) | `src/lib/notifications/trigger.ts` |
| `src/components/cases/status-workflow.tsx` accepts status-change callbacks | ✅ Existed pre-6.1; cleaned up in 6.1 | `src/components/cases/status-workflow.tsx` |
| `src/components/checklist/checklist-panel.tsx` renders pre-procedure items | ✅ Existed pre-6.1; integrated into case detail | `src/components/checklist/checklist-panel.tsx` |
| `src/lib/checklist/evaluatePreProcedureChecklist.ts` returns pass/fail | ✅ Existed pre-6.1 | `src/lib/checklist/evaluatePreProcedureChecklist.ts` |
| `CaseStatus` union has 29 values incl. `medical_alert_resolved` | ✅ Shipped in 6.1 (B.2.2) | `src/lib/types/case.ts`, `src/constants/case-status.ts` |
| `src/constants/case-status.ts` has `CASE_STATUS_TRANSITIONS` correct | ✅ Shipped in 6.1 (B.1.2 + B.2.2) | `src/constants/case-status.ts:66-92` |
| `src/constants/permissions.ts` has `CASE_STATUS_CHANGE_ROLES` (with RR-2 un-reconciled) | ⚠️ **Needs RR-2 fix** | `src/constants/permissions.ts:80-88` |
| `Sprint 6.1` test infra (Vitest + RTL + axe-core) | ✅ 259 tests green | `vitest.config.ts`, `src/test/setup.ts` |
| `src/lib/validators/case.ts` does not yet require `actualProcedureDate` for `procedure_completed` | ⚠️ Server-side enforcement is C.3.2 / Sprint 7.3 | Server enforcement deferred — B.2.4 dialog enforces it on UI only this sprint |
| `WriteAuditLog()` `beforeData`/`afterData` shape supports redaction | ✅ Verified in `src/lib/firestore/audit.ts` | `writeAuditLog({ beforeData, afterData })` |

### 2.3 External dependencies (must exist or be created)

| Dependency | Status today | Action in 6.2 |
|---|---|---|
| Feature-flag helper (`isFlagEnabled`, `useFeatureFlag`) | ✅ Shipped in 6.1 (INF-2) | Reuse for `FEATURE_CHECKLIST_GATE` + `FEATURE_CLINICAL_CHECKLIST` |
| `WriteAuditLog` redaction hook point | ✅ Exists | Extend in B.2.3 to apply `AUDIT_REDACTED_FIELDS` allowlist before persist |
| `triggerMedicalAlert(caseId)` for escalation | ✅ Exists | Reuse in B.1.5 |
| `CASE_STATUS_CHANGE_ROLES` reconcile | ⚠️ RR-2 carry-over | Fix in RR-2 before B.2.1 |
| Medical director sign-off meeting | ❌ Not scheduled | Schedule in week 1 of 6.2 |
| CEO + accountant-lead + product-owner sign-off (B.3.1 follow-up from 6.1 RR-3) | ❌ Not collected | Schedule in week 1 of 6.2 |
| 3 historical cases for B.2.1 dry-run | ⚠️ Need to identify 3 cases spanning all `procedure_completed` preconditions | Coordinate with medical-workflow-expert in week 1 |

### 2.4 People dependencies (decisions resolved before merge)

| Story | Decision | Owner | Status |
|---|---|---|---|
| B.2.1 scope | "Block `checked_in` / `in_procedure` / `medically_approved` when `allPassed === false`" — exactly the 3 transitions from `IMPLEMENTATION_BACKLOG.md` B.2.1 AC | medical-workflow-expert | 🟡 **Medical director sign-off required before merge** |
| B.2.1 flag default | "Dev ON, Prod OFF" (same as 6.1 patterns) | product-owner + CEO | ✅ Resolved (matches BACKLOG §9) |
| B.2.3 scope | "Redact `medicalNote`, `privacyNote`, `nationalIdNumber` in BOTH `beforeData` and `afterData`; visual placeholder `[ĐÃ ẨN]`" | data-privacy-expert | ✅ Resolved (matches BACKLOG B.2.3 AC) |
| B.2.4 scope | "Use existing `ConfirmDialog` with new `warning` variant; require `actualProcedureDate` field in dialog; native `confirm()` must never be used" | tech-lead + ux-designer | ✅ Resolved (matches BACKLOG B.2.4 AC) |
| B.1.5 recipients | "Notify assigned doctor + nurse (resolved from `case.staffAssignment`); fall back to all users with `doctor` / `nurse` role if no assignment" | medical-workflow-expert | 🟡 **Medical workflow sign-off required before merge** |
| B.1.5 threshold | "Escalate when `status === 'issue_reported'` OR `painLevel >= 4`" | medical-workflow-expert | ✅ Resolved (matches BACKLOG B.1.5 AC) |

---

## 3. Order of implementation

### 3.1 Why this order

1. **RR-2 first** — 1-line fix that prevents the 6.1 dead-role bug from contaminating B.2.1's gate math. The gate must reason about the *correct* role set.
2. **B.2.3 (PII redaction) first among stories** — independent, low-risk, closes `F-MED-17` quickly. Gives a confidence-builder before tackling B.2.1.
3. **B.2.4 (second-confirm) before B.2.1** — establishes the new `warning` variant of `ConfirmDialog`. B.2.1's gate also uses a confirmation pattern (red banner), so the variant API is exercised and stable before B.2.1 lands.
4. **B.1.5 (auto-escalate) parallel to B.2.1** — fully independent surface (followup form vs. case detail). Different files, no merge conflict. Runs in parallel to keep FE-2 productive.
5. **B.2.1 (checklist gate) last, with paired review** — 🔴-risk finale. Ships behind 2 feature flags. Paired review (FE-1 + medical-workflow-expert) on every PR.
6. **All flags default OFF in production** — matches 6.1 pattern. Promotion to ON requires medical director + CEO + product-owner sign-off (per BACKLOG §9.2).

### 3.2 Sprint day-by-day plan

| Day | Morning (FE-1) | Morning (FE-2) | Afternoon (FE-1) | Afternoon (FE-2) | FE-3 / Other |
|---|---|---|---|---|---|
| **Day 1** | RR-2 reconcile `CASE_STATUS_CHANGE_ROLES` (1h) | B.2.3 PII redaction in `writeAuditLog` | B.2.3 unit tests + visual diff on 5 historical logs | B.2.3 visual redaction in audit-logs page | release-manager: schedule B.3.1 sign-off meeting + medical director availability |
| **Day 2** | B.2.3 axe-core + final review | B.2.4 `warning` variant on `ConfirmDialog` | B.2.4 unit tests + Dialog test (date required) | B.1.5 `escalateFollowup()` helper + integration with followup API | FE-3: RR-4 Suspense boundary fix (0.5h) + paired review on B.2.4 |
| **Day 3** | B.2.3 sign-off prep + dependency review for B.2.1 | B.1.5 `escalateFollowup()` (cont.) + audit log wiring | B.1.5 unit + integration tests | B.2.1 6 clinical items + `allPassed` derivation | FE-3: B.2.1 paired review (read-only, design partner) |
| **Day 4** | B.2.1 dry-run on 3 historical cases (with medical-workflow-expert) | B.2.1 gate wiring into StatusWorkflow (behind flag) | B.2.1 unit + integration tests | B.2.1 final review + medical director sign-off | release-manager: collect CEO + accountant-lead + product-owner sign-off (B.3.1) |
| **Day 5** | RR-8 Conventional Commits doc + Sprint 6.2 regression sweep | RR coordination + final sign-offs | Full Sprint 6.2 regression suite | Exit criteria verification, smoke test on 5 routes × 12 roles | Final smoke + visual regression snapshot |

(FE-3 contributes ~10h of paired review + carry-over fix-ups, not standalone stories in 6.2.)

### 3.3 Commit sequence (≤ 200 LOC per commit)

| # | Commit | Story | Files | LOC est | Risk |
|---|---|---|---|---:|---|
| 1 | `chore(permissions): reconcile CASE_STATUS_CHANGE_ROLES (drop nurse, cskh_postop)` | RR-2 | `src/constants/permissions.ts`, `src/constants/__tests__/permissions.test.ts` (new) | ~30 | 🟢 |
| 2 | `feat(audit): redact PII fields from beforeData/afterData before persist` | B.2.3 | `src/lib/firestore/audit.ts`, `src/lib/firestore/__tests__/audit.test.ts` | ~120 | 🟡 |
| 3 | `feat(audit): render [ĐÃ ẨN] with gray italic + tooltip in audit-logs diff` | B.2.3 | `src/app/(protected)/audit-logs/page.tsx`, `src/app/(protected)/audit-logs/__tests__/page.test.tsx` | ~80 | 🟡 |
| 4 | `feat(ui): add warning variant to ConfirmDialog` | B.2.4 | `src/components/ui/confirm-dialog.tsx`, `src/components/ui/__tests__/confirm-dialog.test.tsx` (new) | ~60 | 🟢 |
| 5 | `feat(cases): wire procedure_completed second-confirm with actualProcedureDate` | B.2.4 | `src/components/cases/status-workflow.tsx`, `src/app/(protected)/cases/[id]/page.tsx`, `src/app/(protected)/cases/[id]/__tests__/status-workflow-procedure.test.tsx` | ~140 | 🟡 |
| 6 | `feat(followups): add escalateFollowup() helper for painLevel >= 4 / issue_reported` | B.1.5 | `src/lib/followups/escalate.ts` (new), `src/lib/followups/__tests__/escalate.test.ts` | ~150 | 🟡 |
| 7 | `feat(followups): wire escalation into followup update API + audit log` | B.1.5 | `src/lib/firestore/followups.ts`, `src/app/api/followups/[id]/route.ts` (new or existing), `__tests__/route.test.ts` | ~100 | 🟡 |
| 8 | `feat(notifications): add followup_escalation template + recipient resolution` | B.1.5 | `src/lib/notifications/templates.ts`, `src/lib/notifications/trigger.ts`, `__tests__/templates.test.ts` | ~80 | 🟡 |
| 9 | `feat(checklist): add 6 clinical items + allPassed derivation` | B.2.1 | `src/lib/checklist/evaluatePreProcedureChecklist.ts`, `src/lib/types/case.ts`, `src/lib/checklist/__tests__/evaluate.test.ts` | ~120 | 🟡 |
| 10 | `feat(checklist): render 6 clinical items in ChecklistPanel with allPassed indicator` | B.2.1 | `src/components/checklist/checklist-panel.tsx`, `__tests__/checklist-panel.test.tsx` | ~140 | 🟡 |
| 11 | `feat(cases): gate StatusWorkflow on allPassed (behind FEATURE_CHECKLIST_GATE)` | B.2.1 | `src/components/cases/status-workflow.tsx`, `src/app/(protected)/cases/[id]/page.tsx`, `__tests__/status-workflow-gate.test.tsx` | ~160 | 🔴 |
| 12 | `feat(api): server-side enforcement of checklist gate (behind FEATURE_CHECKLIST_GATE)` | B.2.1 | `src/app/api/cases/[id]/status/route.ts`, `__tests__/route.test.ts` | ~120 | 🔴 |
| 13 | `chore(sprint-6.2): update CLAUDE.md + this file lives at docs/ux-redesign/` | RR-8 | `CLAUDE.md`, `CONTRIBUTING.md` (new or existing) | n/a | 🟢 |

**Commit dependency graph:**

```
RR-2 (1) ──→ B.2.1 (9,10,11,12)

B.2.3 (2) ──→ (3)  (sequential — same file family)

B.2.4 (4) ──→ (5)  (sequential — same file)

B.1.5 (6) ──→ (7) ──→ (8)  (sequential — escalate.ts → API → notifications)

B.2.1 (9) ──→ (10) ──→ (11) ──→ (12)  (sequential — derive → render → UI gate → server gate)
```

B.2.3, B.2.4, B.1.5, and B.2.1 each form a serial chain. The four chains are **mutually independent** and can run in parallel across FE-1 / FE-2.

**Parallel work-pairs (no file conflicts):**
- Commits 2 + 4 + 6 (B.2.3 step 1 + B.2.4 step 1 + B.1.5 step 1) — fully independent files
- Commits 3 + 5 + 8 (B.2.3 step 2 + B.2.4 step 2 + B.1.5 step 3) — different files
- Commit 11 (B.2.1 UI gate) is the merge-point where B.2.1 waits for B.2.4's `warning` variant to be stable

---

## 4. Files affected

### 4.1 Files to CREATE (8 files)

| Path | Story | Purpose |
|---|---|---|
| `src/components/ui/__tests__/confirm-dialog.test.tsx` | B.2.4 | Unit tests for new `warning` variant |
| `src/lib/followups/escalate.ts` | B.1.5 | New `escalateFollowup()` helper — pure function, testable |
| `src/lib/followups/__tests__/escalate.test.ts` | B.1.5 | Unit tests: threshold logic, double-escalation guard, recipient resolution |
| `src/app/(protected)/audit-logs/__tests__/page.test.tsx` | B.2.3 | Render test: `[ĐÃ ẨN]` placeholder with tooltip |
| `src/lib/checklist/__tests__/evaluate.test.ts` | B.2.1 | Unit tests: `allPassed` derivation incl. new 6 items |
| `src/components/checklist/__tests__/checklist-panel.test.tsx` | B.2.1 | Render test: 6 new items visible, `allPassed` badge |
| `src/components/cases/__tests__/status-workflow-gate.test.tsx` | B.2.1 | Gate test: `allPassed=false` blocks transitions |
| `src/constants/__tests__/permissions.test.ts` | RR-2 | Invariant test: `CASE_STATUS_CHANGE_ROLES` ⊆ roles with `cases:write` |

### 4.2 Files to MODIFY (existing)

**Domain types (B.2.1):**

- `src/lib/types/case.ts` — add 6 new optional fields to `CaseRecord` (or appropriate type): `bloodTestResult?`, `allergyDeclared?`, `pregnancyTestDone?`, `anesthesiaReviewComplete?`, `fastingCompliant?`, `treatmentConsentSigned?`. All optional for backward-compat. Document the source of truth (Sprint 7.3 will harden the schema).

**Domain logic (B.1.5, B.2.1, B.2.3):**

- `src/lib/checklist/evaluatePreProcedureChecklist.ts` (B.2.1) — extend `ChecklistItem` union with 6 new items; recompute `allPassed` to include them; export `ChecklistItemId` for type-safe access
- `src/lib/followups/escalate.ts` (B.1.5) — **new**, but its integration in `src/lib/firestore/followups.ts` modifies the existing update path to call `escalateFollowup()` on every status update
- `src/lib/firestore/followups.ts` (B.1.5) — call `escalateFollowup()` on followup status/painLevel update; ensure double-escalation guard
- `src/lib/firestore/audit.ts` (B.2.3) — apply `AUDIT_REDACTED_FIELDS = ['medicalNote', 'privacyNote', 'nationalIdNumber']` to both `beforeData` and `afterData` inside `writeAuditLog()`; preserve other fields
- `src/lib/notifications/templates.ts` (B.1.5) — add `followup_escalation` template (title + body); recipient resolver: case staff doctor + nurse, fallback to all roles
- `src/lib/notifications/trigger.ts` (B.1.5) — wire `followup_escalation` template to the trigger; reuse PII-filter from B.1.6 (already shipped 6.1)

**UI components (B.2.1, B.2.4):**

- `src/components/ui/confirm-dialog.tsx` (B.2.4) — add `variant: 'info' | 'warning' | 'danger'` prop; `warning` variant: amber icon (Lucide `AlertTriangle`), amber border, accept `description: ReactNode` for checklist status summary
- `src/components/checklist/checklist-panel.tsx` (B.2.1) — render 6 new clinical items in pre-procedure list; show `allPassed` indicator (green check / red X) at top; feature-flag `FEATURE_CLINICAL_CHECKLIST` controls visibility
- `src/components/cases/status-workflow.tsx` (B.2.1 + B.2.4) — accept `allPassed` prop; when `FEATURE_CHECKLIST_GATE` is ON and `allPassed === false`, disable transition buttons for `checked_in` / `in_procedure` / `medically_approved`; show red banner. Also wire second-confirm dialog for `procedure_completed` (B.2.4).
- `src/app/(protected)/cases/[id]/page.tsx` (B.2.1 + B.2.4) — pass `allPassed` to StatusWorkflow; render confirmation dialog state; render checklist section with `FEATURE_CLINICAL_CHECKLIST` guard

**API routes (B.1.5, B.2.1):**

- `src/app/api/followups/[id]/route.ts` (B.1.5) — on PUT/PATCH, after `updateFollowup()`, call `escalateFollowup(followup, prevFollowup)`; return 200 with `escalated: true` flag in body so UI can show toast
- `src/app/api/cases/[id]/status/route.ts` (B.2.1) — extend existing route (shipped in 6.1 B.1.3) with `allPassed` check; when `FEATURE_CHECKLIST_GATE` ON and `newStatus` ∈ {`checked_in`, `in_procedure`, `medically_approved`}, return 400 with checklist summary if `allPassed === false`; audit log entry for every blocked attempt

**Notifications (B.1.5):**

- (covered in templates.ts + trigger.ts above)

**Render-only (B.2.3):**

- `src/app/(protected)/audit-logs/page.tsx` (B.2.3) — diff renderer: when value is `"[ĐÃ ẨN]"`, render with `text-gray-500 italic` and tooltip "Thông tin nhạy tế đã được ẩn vì lý do bảo mật"

**Constants + permissions (RR-2):**

- `src/constants/permissions.ts` (RR-2) — drop `nurse` and `cskh_postop` from `CASE_STATUS_CHANGE_ROLES` (these lack `cases:write` per 6.1 RR-2). One-line fix.

**Configuration:**

- `.env.local` — add 2 new feature flags (both default `false` in production): `NEXT_PUBLIC_FEATURE_CHECKLIST_GATE`, `NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST`
- `package.json` — no new deps (audit diff, checklist, followup code is pure functions; axe-core + Vitest already shipped in 6.1)
- `CONTRIBUTING.md` (RR-8) — add Conventional Commits section (≤ 30 lines)

### 4.3 Anti-pattern scan (DESIGN_DIRECTION §18) — 6.2 stories to verify

| A-# | Anti-pattern | 6.2 stories that must NOT introduce / must FIX |
|---|---|---|
| **A2** | Raw user/entity IDs in copy | **B.1.5 must NOT** show raw user IDs in notification payload (recipient resolution uses `displayName` from `getAllUsers()`) |
| **A6** | Hidden-only permissions | **B.2.1 must** have server-side enforcement in `/api/cases/[id]/status` (commit 12) — UI gate alone is insufficient. B.1.5 also requires server-side escalation trigger (commit 7), not just client-side. |
| **A8** | Dead links | No link changes in 6.2 — but if B.2.1 banner is added, the "view checklist" CTA must scroll to checklist section, not point to a dead href |
| **A9** | Native `confirm()` / `alert()` | **B.2.4 must NOT** use native `confirm()` for `procedure_completed`. Use new `ConfirmDialog` `warning` variant. Pre-merge: `grep -rE "window\.(confirm|alert)" src/` excluding `__tests__/` → 0 matches |
| **A11** | PII in audit log diffs | **B.2.3 is THE FIX**. Test: `medicalNote` / `privacyNote` / `nationalIdNumber` absent from diff output across 5 historical audit log records |
| **A12** | Skipped clinical gates | **B.2.1 is THE FIX**. Test: case with `allPassed=false` cannot transition to `procedure_completed` via API or UI; banner visible |

### 4.4 Files EXPLICITLY not touched in 6.2

(To prevent scope creep — all are Sprint 6.3+ or 7.x work.)

- `src/app/(protected)/layout.tsx` — `min-h-screen` is Sprint 6.3
- `src/components/cases/case-list.tsx` — status filter responsive is Sprint 6.3
- `src/components/cases/case-list.tsx` (next-owner banner) — Sprint 6.3
- `src/lib/validators/case.ts` — `actualProcedureDate` server-side requirement is C.3.2 / Sprint 7.3 (B.2.4 dialog enforces it on UI only this sprint)
- `src/components/attachments/*` — consent gates are Sprint 7.4
- `src/components/consents/*` — consent PDF requirement is Sprint 7.4
- `firestore.rules`, `storage.rules`, `firebase.json` — Phase 5 (remaining)
- `vercel.json`, deployment docs — Phase 5 (remaining)

---

## 5. Risks

### 5.1 Risk register (5 risks ranked by impact)

| # | Risk | Probability | Impact | Owner | Mitigation |
|---|---|---|---|---|---|
| **R1** | **🔴 B.2.1 blocks legitimate status transitions in production.** A `FEATURE_CHECKLIST_GATE` flag misconfiguration or a `ChecklistItem` evaluation bug could prevent `checked_in` / `in_procedure` / `medically_approved` from ever firing. Patient care stalls. | Medium | **Critical** — patient safety in opposite direction (over-block) | tech-lead + medical-workflow-expert | (1) **Dry-run on 3 historical cases** before merge (commit 11 + 12 require this). (2) Flag defaults OFF in prod. (3) Server-side check is opt-in via flag — without flag, behavior is identical to today. (4) **3-case manual pilot** with medical director on staging before flag promotion. (5) Paired review: FE-1 + medical-workflow-expert on every B.2.1 commit. |
| **R2** | **🔴 B.2.1 medical director sign-off not collected before merge.** B.2.1's 6 clinical items are not validated against clinical reality if sign-off skipped. Items may be wrong (e.g., "pregnancy test" not applicable for male patients, or for non-reproductive procedures). | High | High — clinical correctness | release-manager + medical-workflow-expert | (1) Schedule medical director availability in **week 1 of Sprint 6.2**, not week 4. (2) Story cannot merge to `phase-6/sprint-6.2` without signed Medical Sign-Off Checklist (see §7). (3) B.2.1 commits 9, 10, 11, 12 each require sign-off annotation in PR description. |
| **R3** | **🟡 B.1.5 notification storm.** If escalation fires for every painLevel update, a noisy case generates 10+ notifications. Doctor / nurse receive alert spam → alert fatigue → real escalations ignored. | Medium | Medium — operational | medical-workflow-expert + FE-2 | (1) **Double-escalation guard**: if `case.status === 'medical_alert'` already, do not re-escalate. (2) **Debounce window**: 1 escalation per case per 6h via `lastEscalatedAt` field on case. (3) Audit-log every escalation attempt (incl. dedup'd) for visibility. (4) Test: 5 rapid painLevel updates → exactly 1 escalation + 4 audit entries. |
| **R4** | **🟡 B.2.3 PII redaction silently breaks existing audit log reads.** If `writeAuditLog()` strips fields before persist, any code that *reads* `audit.beforeData.medicalNote` (e.g., a future "audit detail" page) will see `"[ĐÃ ẨN]"` instead of the value. The data is gone — not hidden. | Medium | Medium — data integrity (data is preserved in underlying firestore but replaced in audit log writes; reads see the redacted value) | data-privacy-expert + tech-lead | (1) **Document the contract**: audit log persists redacted values, not raw. The raw PII remains in the *source* document (e.g., `customer.medicalNote`), not the audit log. (2) Visual diff: any "view full diff" affordance must show the source value to authorized roles, not the audit value. (3) Test: `medicalNote` on a customer record is NOT deleted, only audit log shows `[ĐÃ ẨN]`. |
| **R5** | **🟡 B.2.4 `actualProcedureDate` dialog is client-side only.** Sprint 7.3 (C.3.2) adds server-side requirement. Until then, a malicious actor with a valid auth token can POST a status change without `actualProcedureDate` and bypass the dialog. | Certain (deferred) | Medium — server gap | tech-lead | Document the gap in the story report. B.2.4 ships with the dialog as a UX guardrail. C.3.2 (Sprint 7.3) adds the API enforcement. Do not promote `procedure_completed` workflow to doctors without flag in production until C.3.2 lands. |

### 5.2 Risks explicitly mitigated by Sprint 6.2 design

- **Bundle bloat** — no new heavy deps. B.2.3 redaction is a string-replace function. B.2.1 checklist items are simple boolean fields. B.1.5 escalation is a pure helper. Total LOC delta expected: ~1,200 (production) + ~700 (tests), well within the 5% bundle budget.
- **A11y regressions** — every B.2.1 banner + B.2.4 dialog + B.2.3 placeholder ships with axe-core coverage. Aria-labels for action buttons, `role="alert"` for red banners.
- **PII regression** — B.2.3 explicitly strips PII. PII-filter on notification payload (B.1.5) reuses the 6.1-shipped filter from B.1.6.
- **Audit-trail regression** — every B.2.1 block, B.1.5 escalation, B.2.4 confirm writes a structured audit log entry.
- **Backward compatibility** — all new fields are optional. Existing cases load without the new checklist items, defaulting to "not answered". Gate does not block cases predating the schema — only cases updated post-deploy.
- **Concurrent write race** — escalation is not a state mutation that requires Firestore transaction. The `lastEscalatedAt` debounce is checked at read time inside the same write; acceptable for a notification trigger, not a financial mutation.

### 5.3 Risks intentionally NOT mitigated in 6.2 (deferred)

- **Modal full-screen sheet on `< sm`** (M7) — Sprint 7.2
- **360 px horizontal scroll** (M5) — already passes baseline; verified in 6.3 sweep
- **CSV export** (F-HIGH-34) — Phase 9
- **Role-specific dashboards** (F-MED-26) — Phase 9
- **Operational-risk page** (F-HIGH-31) — Phase 9
- **`actualProcedureDate` server-side enforcement** (C.3.2) — Sprint 7.3
- **Doctor identity fields on `medically_approved`** (C.3.1) — Sprint 7.3
- **Lab date validation** (C.3.3) — Sprint 7.3
- **`medical_upload` permission** (C.4.5) — Sprint 7.4
- **Image upload consent gate** (C.4.1) — Sprint 7.4

---

## 6. Feature flags

Two new feature flags are introduced in Sprint 6.2. Both follow the established 6.1 pattern (default OFF in production, ON in dev).

| Flag | Story | Default (dev) | Default (prod) | Rollback action |
|---|---|---|---|---|
| `NEXT_PUBLIC_FEATURE_CHECKLIST_GATE` | B.2.1 (commits 11, 12) | `true` | **`false`** | Set OFF → status transitions bypass `allPassed` check; gate becomes decorative |
| `NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST` | B.2.1 (commit 10) | `true` | **`false`** | Set OFF → 6 new clinical items hidden; checklist returns to baseline |

### 6.1 Flag interaction matrix

| `FEATURE_CLINICAL_CHECKLIST` | `FEATURE_CHECKLIST_GATE` | UI behavior | Server behavior |
|---|---|---|---|
| OFF | OFF | Baseline (no new items, no gate) | Baseline (no `allPassed` check) |
| OFF | ON | Inconsistent — gate blocks but no items render. **Avoided by design** — `useEffect` warns if gate ON without items | Same — server checks `allPassed` which has no new items, so passes if old items pass |
| ON | OFF | New 6 items render; gate does not enforce | Same — server has no gate code path |
| ON | ON | New 6 items render; gate enforces | Same — server checks `allPassed` incl. new items |

**Recommended dev combination:** both ON. **Recommended prod combination:** both OFF (until medical director sign-off + dry-run complete + CEO approval).

### 6.2 Flag rollout sequence

1. **Dev (Day 5):** Both flags ON, all 259 + new tests pass.
2. **Staging (Day 5+):** Enable both flags; medical director walks through 3 historical cases.
3. **Staging pilot (3 days post-merge):** CSO + 2 medical staff use the gate in normal workflow. Monitor for false-positive blocks.
4. **Prod (gradual, after B.2-Gate):** Per BACKLOG §9.2, flag promotion requires medical director + CEO + product-owner sign-off. If approved, enable `FEATURE_CLINICAL_CHECKLIST` first (visual only, no behavior change), then `FEATURE_CHECKLIST_GATE` 24h later (behavior change).

### 6.3 Flag lifecycle

- Flags removed when feature stable for **2+ sprints with zero rollbacks**. Removal is a refactor PR, not a feature PR.
- For B.2.1 specifically, removal cannot happen before Sprint 6.4 (Sprint 6.3 is AppShell, not clinical). Earliest removal: Sprint 7.1 or later.
- For B.1.5 (no flag), the audit log is the rollback path — disable escalation by checking `if (process.env.NEXT_PUBLIC_FEATURE_FOLLOWUP_ESCALATION === 'true')` (deferred decision; not in 6.2 scope; add if a flag is needed pre-merge).

### 6.4 Carry-over flag state from 6.1

- `NEXT_PUBLIC_FEATURE_SHARED_MENU` — Sprint 6.1 A.5, currently OFF in prod
- `NEXT_PUBLIC_FEATURE_SERVER_RBAC` — Sprint 6.1 B.1.3, currently OFF in prod
- `NEXT_PUBLIC_FEATURE_PAYMENT_SOD` — Sprint 6.1 B.3.1, currently OFF in prod (sign-off pending per RR-3)

**No 6.1 flag changes in 6.2.** 6.2 only adds 2 new flags. The 3 existing flags remain in their current state pending sign-off coordination.

---

## 7. Medical workflow sign-off checklist

This is the **clinical correctness gate** for Sprint 6.2. It is distinct from the tech-lead build/lint gate. Sprint 6.2 cannot merge `phase-6/sprint-6.2` → `main` without all checkboxes signed.

### 7.1 B.2.1 — 6 clinical items + `allPassed` gate

| # | Check | Sign-off | Status |
|---|---|---|---|
| 7.1.1 | Medical director confirms the 6 clinical items (blood test, allergy, pregnancy, anesthesia review, fasting, treatment consent) are the **correct complete set** for pre-procedure readiness in the Swan Clinic context. | medical director | ☐ |
| 7.1.2 | Medical director confirms which **transitions are gated** (`checked_in`, `in_procedure`, `medically_approved`) is the correct set. | medical director | ☐ |
| 7.1.3 | **3-case dry-run** completed with medical director on staging: (a) case with all 6 items checked → gate allows; (b) case with 1 item unchecked → gate blocks; (c) edge case (pregnancy test for male patient / non-applicable item) → behavior is graceful (item can be marked "N/A"). | medical director + tech-lead | ☐ |
| 7.1.4 | Red banner copy reviewed in Vietnamese: "Vui lòng hoàn thành toàn bộ checklist trước khi chuyển trạng thái" (or equivalent) — clinically accurate, not alarming. | medical director + ux-designer | ☐ |
| 7.1.5 | Bypass procedure documented: if a doctor needs to override the gate in an emergency, the override path is a server-side endpoint with audit log. **Note: this is a Phase 7 concern (C.5.x). For 6.2, the gate is the only path — no override.** | medical-workflow-expert | ☐ (acknowledge "no override in 6.2") |
| 7.1.6 | `FEATURE_CLINICAL_CHECKLIST` and `FEATURE_CHECKLIST_GATE` flag values verified ON in staging before sign-off. | tech-lead | ☐ |

### 7.2 B.1.5 — auto-escalate `painLevel >= 4` / `issue_reported`

| # | Check | Sign-off | Status |
|---|---|---|---|
| 7.2.1 | Medical workflow expert confirms the threshold `painLevel >= 4` matches clinical urgency. (Note: 0–10 pain scale; ≥4 is moderate-to-severe.) | medical-workflow-expert | ☐ |
| 7.2.2 | Medical workflow expert confirms the recipients: assigned doctor + nurse (resolved from case staff assignment) is the correct set. Fallback to all `doctor` / `nurse` users is acceptable if no staff assignment. | medical-workflow-expert | ☐ |
| 7.2.3 | Double-escalation guard reviewed: if case is already in `medical_alert` status, no second escalation. Logic: `if (case.status === 'medical_alert') return { escalated: false, reason: 'already_escalated' }`. | medical-workflow-expert + tech-lead | ☐ |
| 7.2.4 | Debounce window confirmed: 1 escalation per case per 6h via `case.lastEscalatedAt` field. Acceptable to medical workflow expert (avoids alert fatigue). | medical-workflow-expert | ☐ |
| 7.2.5 | Notification template text reviewed: "Cảnh báo: [Tên khách hàng] — Mức đau [N]/10 — Ngày hậu phẫu [D1/D3/...]" (or equivalent). No PII leaked (medical note, privacy note, CCCD). | medical-workflow-expert + data-privacy-expert | ☐ |

### 7.3 B.2.3 — PII redaction in audit log

| # | Check | Sign-off | Status |
|---|---|---|---|
| 7.3.1 | Data privacy expert confirms the redacted fields list is complete: `medicalNote`, `privacyNote`, `nationalIdNumber`. No other PII fields are persisted in audit logs that should also be redacted. | data-privacy-expert | ☐ |
| 7.3.2 | Visual diff on 5 historical audit log records: redaction is consistent, no value leak. | data-privacy-expert | ☐ |
| 7.3.3 | Contract documented: audit log persists redacted values. The raw PII remains in the *source* document (customer, case). Any "view full diff" affordance must read from source, not audit. | data-privacy-expert + tech-lead | ☐ |

### 7.4 B.2.4 — `procedure_completed` second-confirm

| # | Check | Sign-off | Status |
|---|---|---|---|
| 7.4.1 | UX copy reviewed: "Hoàn thành thủ thuật" / "Bạn đã chắc chắn?" / checklist summary / side-effect count. Clinically accurate, not alarming. | ux-designer | ☐ |
| 7.4.2 | `actualProcedureDate` field is documented as **UI-required** in 6.2, **server-required** in Sprint 7.3 (C.3.2). Gap acknowledged. | tech-lead + medical-workflow-expert | ☐ |
| 7.4.3 | Native `confirm()` ban verified: `grep -rE "window\.(confirm\|alert)" src/` excluding `__tests__/` → 0 matches. | qa-architect | ☐ |

### 7.5 Cross-cutting

| # | Check | Sign-off | Status |
|---|---|---|---|
| 7.5.1 | No new patient data is **destroyed** by any 6.2 story. All schema changes are additive (optional fields). | tech-lead | ☐ |
| 7.5.2 | Audit log entries for every blocked transition (B.2.1), every escalation (B.1.5), every redaction event (B.2.3) — verified in test. | data-privacy-expert | ☐ |
| 7.5.3 | Mobile UX verified: B.2.1 red banner readable on 360px viewport; B.2.4 dialog scrollable on 360px; B.1.5 notification card adapts. | ui-designer + qa-architect | ☐ |
| 7.5.4 | Vietnamese clinical terminology reviewed by ux-designer (no machine-translated strings). | ux-designer | ☐ |

**Sign-off chain (per BACKLOG §7.5 + 6.1 lessons):**

```
Tech Lead (build/lint/tests)
   ↓
QA Architect (test strategy + axe-core)
   ↓
Medical Workflow Expert (clinical correctness — B.2.1, B.1.5)
   ↓
Data Privacy Expert (PII redaction — B.2.3)
   ↓
UI Designer (Vietnamese copy + mobile)
   ↓
Release Manager (flag inventory + rollback verified)
   ↓
CEO + Product Owner (final go/no-go for staging pilot)
```

---

## 8. Test strategy

Per `UI_REFACTOR_PLAN.md` §5.1, Sprint 6.2 uses **all 10 test layers**. This is the first sprint in Phase 6 to use Layer 4 (permission matrix) and Layer 8 (data integrity) at full strength — both are critical for clinical correctness.

### 8.1 Test layers used in 6.2

| Layer | Tool | Coverage in 6.2 | Owner |
|---|---|---|---|
| 1. Functional unit | Vitest + RTL | All new pure functions: `escalateFollowup()`, `AUDIT_REDACTED_FIELDS` redaction, `allPassed` derivation, ConfirmDialog `warning` variant | FE-1 / FE-2 |
| 2. Validation | Vitest + Zod | `CASE_STATUS_CHANGE_ROLES` invariant (RR-2), `ChecklistItem` Zod (B.2.1) | tech-lead |
| 3. Workflow | Vitest state machine | Status transition matrix: `allPassed=false` blocks 3 specific transitions; `allPassed=true` allows; flag ON/OFF behavior | tech-lead + medical-workflow-expert |
| 4. Permission | Vitest + mock user fixtures | 12 roles × `CASE_STATUS_CHANGE_ROLES` after RR-2 reconciliation; `B.2.1` server gate: 12 roles × 3 gated transitions × flag state = 72 cases | rbac-expert |
| 5. Security | Vitest + audit log mocks | PII redaction in `beforeData` + `afterData` (B.2.3); notification payload PII filter on escalation (B.1.5) | data-privacy-expert |
| 6. Integration | Vitest + Next.js route handler mocks | `/api/followups/[id]` escalation trigger; `/api/cases/[id]/status` checklist gate; `/api/followups/[id]` double-escalation guard | FE-1 / FE-2 |
| 7. Performance | Manual + Lighthouse | Case detail with 6 new checklist items renders < 300ms; second-confirm dialog opens < 100ms | nextjs-expert |
| 8. Data integrity | Vitest + Firestore transaction mocks | `allPassed` derivation is deterministic; escalation debounce is consistent; redaction is idempotent | tech-lead |
| 9. Mobile/responsive | Playwright + device matrix | B.2.1 banner, B.2.4 dialog, B.1.5 notification card on 360px / 768px / 1280px — no horizontal scroll, ≥44px touch targets | qa-architect |
| 10. Regression | Playwright snapshot diffs | Case detail page (Info tab + Checklist section); audit-logs page (with `[ĐÃ ẨN]`); per-role per-viewport | qa-architect |

### 8.2 Test files to create

| Test file | Covers story | Required cases |
|---|---|---|
| `src/constants/__tests__/permissions.test.ts` | RR-2 | `CASE_STATUS_CHANGE_ROLES` ⊆ roles with `cases:write`; invariant test for any future addition |
| `src/lib/firestore/__tests__/audit.test.ts` | B.2.3 | `writeAuditLog()` strips `medicalNote` / `privacyNote` / `nationalIdNumber` from both `beforeData` and `afterData`; non-PII fields preserved; idempotent |
| `src/app/(protected)/audit-logs/__tests__/page.test.tsx` | B.2.3 | Renders `[ĐÃ ẨN]` placeholder with gray italic + tooltip "Thông tin nhạy tế đã được ẩn vì lý do bảo mật" |
| `src/components/ui/__tests__/confirm-dialog.test.tsx` | B.2.4 | `warning` variant: amber icon, amber border, accepts `description: ReactNode`; `danger` and `info` variants still render correctly (regression) |
| `src/components/cases/__tests__/status-workflow-procedure.test.tsx` | B.2.4 | Clicking "Hoàn thành thủ thuật" opens confirm dialog; confirm disabled without `actualProcedureDate`; confirm proceeds with valid date |
| `src/lib/followups/__tests__/escalate.test.ts` | B.1.5 | `painLevel >= 4` → escalate; `painLevel < 4` → no escalate; `status === 'issue_reported'` → escalate; case already in `medical_alert` → no double-escalate; debounce window 6h; recipients resolved from staff assignment; fallback to all doctor/nurse users |
| `src/app/api/followups/[id]/__tests__/route.test.ts` | B.1.5 | API integration: painLevel=5 → escalation triggered; painLevel=3 → no escalation; audit log written; debounce respected |
| `src/lib/notifications/__tests__/templates.test.ts` | B.1.5 | `followup_escalation` template renders customer name + pain level + day, no PII |
| `src/lib/checklist/__tests__/evaluate.test.ts` | B.2.1 | `allPassed` derivation: 6 new items included; `allPassed=true` if all checked; `allPassed=false` if any unchecked; backward-compat: cases without new items default to false but not "broken" |
| `src/components/checklist/__tests__/checklist-panel.test.tsx` | B.2.1 | 6 new items render when `FEATURE_CLINICAL_CHECKLIST` ON; hidden when OFF; `allPassed` indicator (green check / red X) renders correctly |
| `src/components/cases/__tests__/status-workflow-gate.test.tsx` | B.2.1 | `allPassed=false` disables transition buttons for `checked_in` / `in_procedure` / `medically_approved`; red banner shows; flag OFF → no gate behavior (regression) |
| `src/app/api/cases/[id]/status/__tests__/route.test.ts` (extend) | B.2.1 | Add: 400 when `allPassed=false` AND `newStatus` ∈ {3 gated transitions} AND flag ON; 200 when flag OFF (regression); audit log entry for blocked attempt |

### 8.3 Manual smoke checklist (per-story, dev mode)

Each story ships with a manual smoke step. Sprint 6.2 manual smokes:

1. **RR-2 reconcile** — `npm run test -- permissions` → invariant test green; `getAllowedTransitions` semantics unchanged for any role.
2. **B.2.3 PII redaction** — create a customer with `medicalNote`; trigger an audit log entry; open `/audit-logs`; verify the diff shows `[ĐÃ ẨN]` for that field, with tooltip. Verify the customer record itself still has the medical note (only the audit log is redacted).
3. **B.2.4 second-confirm** — open a case detail; click "Hoàn thành thủ thuật"; verify warning dialog opens with checklist summary; confirm button is disabled until `actualProcedureDate` is filled; fill date → confirm → status transitions to `procedure_completed`. Verify native `confirm()` is NOT called.
4. **B.1.5 auto-escalate** — open a followup; set `painLevel` to 5; save; verify the assigned doctor + nurse receive a `followup_escalation` notification; verify the case status is now `medical_alert`. Update the same followup again with painLevel=5 → verify NO second notification (double-escalation guard).
5. **B.2.1 checklist gate** — open a case detail; check 5 of 6 clinical items; verify the "Chuyển sang checked_in" button is disabled; verify red banner shows "Vui lòng hoàn thành toàn bộ checklist"; check the 6th item; verify button is enabled; click → status transitions. Toggle `FEATURE_CHECKLIST_GATE` OFF in `.env.local` and re-test → gate is bypassed (regression).
6. **B.2.1 dry-run (with medical director)** — pick 3 historical cases (one with all 6 items answered, one with 1 missing, one edge case like pregnancy test for male patient). Walk through gate behavior with medical director; collect sign-off on `STORY_B2_1_IMPLEMENTATION_REPORT.md`.
7. **All 6.2 stories** — `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run test`. All green.

### 8.4 Build & lint gates (every PR)

```
npx tsc --noEmit          # 0 errors (production + test configs)
npm run lint              # 0 warnings
npm run build             # 34 routes, 0 errors
npm run test              # all new + existing tests green
```

### 8.5 Anti-pattern gate (every PR)

- `grep -rE "window\.(confirm|alert)" src/` excluding `__tests__/` → **0 matches** (A9 — B.2.4 must use ConfirmDialog)
- `grep -rE "as never" src/components/layout/` → **0 matches** (carrying 6.1 A.5 invariant)
- `grep -rE "user-\d{3}" src/components` → **0 matches** (A2 — B.1.5 must resolve display names)
- `grep -rE "caseId\s*=\s*['\"]general['\"]" src/` → **0 matches** (A1)
- New grep for B.2.3: `grep -rE "medicalNote|privacyNote|nationalIdNumber" src/lib/firestore/audit.ts` → only the `AUDIT_REDACTED_FIELDS` array (no leaky writes)
- New grep for B.2.1: `grep -rE "allPassed\s*=" src/` → all occurrences are in `evaluatePreProcedureChecklist.ts` or test files (no scattered logic)

### 8.6 Test data requirements

| Data | Source | Count | Owner |
|---|---|---|---|
| Customer with `medicalNote` + `privacyNote` + `nationalIdNumber` | Mock store seed (extend) or hand-craft in test fixture | 5 | tech-lead |
| Case at each status to test escalation | Mock store: pre-existing cases #5, #6, #11, #17, #19 (per CLAUDE.md seed) | 5 | tech-lead |
| 3 historical cases for B.2.1 dry-run | Pick 1 case with full pre-procedure checklist, 1 with 1 item missing, 1 edge case | 3 | medical-workflow-expert |
| Followup records with `painLevel` 0–10 | Mock store: extend seed with 10 followups spanning pain levels | 10 | FE-2 |
| Audit log records with PII fields | Existing seed has 30 records (per Phase 5); for visual diff, pick 5 that have `medicalNote` or `nationalIdNumber` in `beforeData`/`afterData` | 5 | data-privacy-expert |

---

## 9. Rollback strategy

### 9.1 Branch & merge strategy

```
main (post-6.1, 2bafc13)
  └── phase-6/sprint-6.2                 (sprint branch — opened Day 1)
        ├── chore/permissions-reconcile   (RR-2 — Day 1)
        ├── feat/audit-pii-redaction      (B.2.3 — Day 1)
        ├── feat/procedure-confirm        (B.2.4 — Day 2)
        ├── feat/followup-escalation      (B.1.5 — Day 2–3)
        ├── feat/checklist-gate           (B.2.1 — Day 3–4, behind 2 flags, paired review)
        └── chore/sprint-6.2-hygiene      (RR-8 Conventional Commits + CLAUDE.md update)
```

Each sub-branch merged into `phase-6/sprint-6.2` after CI green + paired review (B.2.1 requires medical-workflow-expert review). Sprint branch merged to `main` only after all 4 stories + carry-over tasks + sign-offs (per §7) pass.

### 9.2 Per-story rollback

| Story | Rollback action | Time to rollback | Data impact |
|---|---|---|---|
| RR-2 reconcile | Revert commit; add `nurse` + `cskh_postop` back to `CASE_STATUS_CHANGE_ROLES`. | < 5 min | None — those 2 roles were already 403'd by `cases:write` check in 6.1, so behavior reverts to dead-list state |
| B.2.3 PII redaction | Revert commit; audit log writes return to persisting raw PII. **Risk**: any new audit logs written between merge and revert contain redacted values; historical (pre-merge) logs are unchanged. | < 15 min | **Risk** — partial state if logs written in window. **Mitigation**: deploy in staging first, dry-run, then prod. |
| B.2.4 second-confirm | Revert commit; `procedure_completed` reverts to native `confirm()` (or no confirm if none existed). Flag-free — direct rollback. | < 10 min | None |
| B.1.5 auto-escalate | Revert commit; followup updates no longer trigger escalation. **Risk**: any cases that *should* have been escalated during the 6.2 window were not. **Mitigation**: on rollback, run a backfill script to identify cases with `painLevel >= 4` post-deploy that didn't escalate; manually escalate via UI. | < 30 min | **Risk** — patient-safety gap if rollback is silent. **Mitigation**: announce rollback with clinical team; backfill within 24h. |
| B.2.1 checklist gate (UI) | Set `FEATURE_CHECKLIST_GATE=false` + revert UI gate commit. | < 15 min via flag | None — flag default OFF in prod |
| B.2.1 checklist gate (server) | Set `FEATURE_CHECKLIST_GATE=false` + revert server commit. | < 15 min via flag | None |
| B.2.1 clinical items (visible) | Set `FEATURE_CLINICAL_CHECKLIST=false` + revert render commit. | < 5 min via flag | None |
| B.2.1 dry-run artifacts | Manual rollback — no data impact, just removes the test fixtures | < 5 min | None |

### 9.3 Feature-flag-only rollback (lightest touch)

For the 2 new flags in 6.2, setting the flag to `false` in `.env.local` and restarting the dev server is **sufficient** — the legacy code path remains in the bundle. No git revert needed.

```bash
# In .env.local
NEXT_PUBLIC_FEATURE_CHECKLIST_GATE=false
NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST=false

# Restart dev server
npm run dev
```

### 9.4 Whole-sprint rollback (catastrophic recovery)

```bash
# Revert the merge commit on main
git revert -m 1 <sprint-6.2-merge-sha>

# Set all 5 flags to false (2 new + 3 carried from 6.1)
sed -i 's/NEXT_PUBLIC_FEATURE_CHECKLIST_GATE=.*/NEXT_PUBLIC_FEATURE_CHECKLIST_GATE=false/' .env.local
sed -i 's/NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST=.*/NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST=false/' .env.local
sed -i 's/NEXT_PUBLIC_FEATURE_SHARED_MENU=.*/NEXT_PUBLIC_FEATURE_SHARED_MENU=false/' .env.local
sed -i 's/NEXT_PUBLIC_FEATURE_SERVER_RBAC=.*/NEXT_PUBLIC_FEATURE_SERVER_RBAC=false/' .env.local
sed -i 's/NEXT_PUBLIC_FEATURE_PAYMENT_SOD=.*/NEXT_PUBLIC_FEATURE_PAYMENT_SOD=false/' .env.local

# Re-run regression
npm run lint && npx tsc --noEmit && npm run build && npm run test -- --run
```

**Time to rollback:** < 15 minutes.
**Data impact:** None — all 6.2 changes are additive (no schema removals, no enum removals, no permission removals). The 6 new checklist item fields are optional and default to undefined; PII redaction does not delete source data; escalation is a notification trigger, not a state mutation.

### 9.5 Data migrations

| Migration | Type | Backward-compat | Rollback |
|---|---|---|---|
| Add 6 optional checklist item fields to `CaseRecord` (B.2.1) | Schema extension | ✅ All optional, no backfill | Drop fields |
| Add `lastEscalatedAt?` to `CaseRecord` (B.1.5) | Schema extension | ✅ Optional, no backfill | Drop field |
| `AUDIT_REDACTED_FIELDS` redaction applied to `writeAuditLog` (B.2.3) | Behavior change | ✅ Audit log diff is the only surface affected; source documents untouched | Remove redaction call; raw values resume persisting in new audit logs |
| `CASE_STATUS_CHANGE_ROLES` reconciled (RR-2) | Permission array | ✅ Subset of 6.1; dead entries removed | Re-add `nurse`, `cskh_postop` |
| New feature flags (B.2.1) | Env var | ✅ Default OFF | Unset env var |

All migrations are **additive only** (except RR-2 which is a removal of dead entries). No field is ever destroyed. The audit log redaction is a *behavior change on writes*, not a data deletion.

### 9.6 Rollback drill

Before Phase D (full rollout) or before promoting any 6.2 flag in production, conduct a 1-hour rollback drill:

1. Tag a release candidate `release/v6.1.0-rc1` on `phase-6/sprint-6.2`
2. Revert one B.2.1 commit (the 🔴 risk one) in a sandbox
3. Verify `npx tsc --noEmit` + `npm run test` + `npm run build` green
4. Manually smoke 5 routes: `/dashboard`, `/cases/[id]`, `/customers/[id]`, `/audit-logs`, `/followups`
5. Document the drill outcome in the Phase D gate

---

## 10. Definition of Done

Sprint 6.2 is **DONE** when ALL of the following are true. Each checkbox is mechanically verifiable or has a named sign-off.

### 10.1 Build & code quality

- [ ] `npx tsc --noEmit` → **0 errors** (production config)
- [ ] `npx tsc -p tsconfig.test.json --noEmit` → **0 errors** (test config)
- [ ] `npm run lint` → **0 warnings**
- [ ] `npm run build` → **34 routes, 0 errors**, no measurable bundle bloat
- [ ] `npm run test` → **all new + existing tests green** (≥ 12 new test files; baseline 259 + ~30–40 new tests)
- [ ] No new `eslint-disable` or `@ts-ignore` comments unless pre-existing pattern
- [ ] All commits use **Conventional Commits prefix** (`feat:`, `fix:`, `chore:`, `refactor:`) per RR-8

### 10.2 Story-level acceptance (per BACKLOG + locked decisions)

| Story | DoD checkbox |
|---|---|
| **RR-2** | [ ] `CASE_STATUS_CHANGE_ROLES` no longer contains `nurse` or `cskh_postop`; invariant test in `permissions.test.ts` green; no regression in 6.1's 12-role smoke |
| **B.2.1** | [ ] 6 new clinical items render in `ChecklistPanel` when `FEATURE_CLINICAL_CHECKLIST` ON; `allPassed` derivation includes all 6 items + 4 pre-existing items; `allPassed=false` disables transition buttons for `checked_in` / `in_procedure` / `medically_approved`; red banner shows Vietnamese copy; server-side gate returns 400 for blocked transitions when `FEATURE_CHECKLIST_GATE` ON; both flags default OFF in production; medical director sign-off on §7.1 checklist + 3-case dry-run completed; paired review by FE-1 + medical-workflow-expert on every commit |
| **B.2.3** | [ ] `writeAuditLog()` strips `medicalNote` / `privacyNote` / `nationalIdNumber` from both `beforeData` and `afterData`; non-PII fields preserved; visual diff renders `[ĐÃ ẨN]` with gray italic + tooltip; 5 historical audit log records visually verified by data-privacy-expert; data privacy expert sign-off on §7.3 |
| **B.2.4** | [ ] `ConfirmDialog` `warning` variant (amber icon, amber border); `procedure_completed` click opens confirm dialog; checklist + side-effect summary shown; confirm button disabled until `actualProcedureDate` filled; no native `window.confirm()` calls anywhere in `src/` (verified by grep); UX copy reviewed by ux-designer |
| **B.1.5** | [ ] `escalateFollowup()` triggers when `painLevel >= 4` OR `status === 'issue_reported'`; double-escalation guard prevents repeat notifications; 6h debounce via `case.lastEscalatedAt`; notification sent to assigned doctor + nurse (resolved from `case.staffAssignment`) with fallback to all doctor/nurse users; notification template reviewed for no PII leak; medical workflow sign-off on §7.2 |
| **RR-3** | [ ] CEO + accountant-lead + product-owner sign-off collected for B.3.1 (carry-over); `FEATURE_PAYMENT_SOD` promotion decision documented |
| **RR-4** | [ ] B.1.4 Suspense boundary fix committed; Next.js 14 static-export warning gone |
| **RR-8** | [ ] `CONTRIBUTING.md` documents Conventional Commits; 6.2 commits use the prefix |

### 10.3 Anti-pattern gate

- [ ] Zero A6 hidden-only permissions — B.2.1 server gate exists (commit 12) in addition to UI gate; B.1.5 escalation runs server-side
- [ ] Zero A9 native `confirm()`/`alert()` — verified by grep, B.2.4 uses ConfirmDialog
- [ ] Zero A11 PII in audit diffs — verified by B.2.3 redaction test across 5 historical records
- [ ] Zero A12 skipped clinical gates — verified by B.2.1 unit + integration tests (3 gated transitions × flag state matrix)
- [ ] All 5 carry-over A-* checks from 6.1 still pass (no regression in A2, A8, A22)

### 10.4 Sign-off gate (per §7)

- [ ] **Tech Lead** sign-off: build/lint/tests/anti-patterns
- [ ] **Medical Workflow Expert** sign-off: B.2.1 + B.1.5 clinical correctness, 3-case dry-run
- [ ] **Data Privacy Expert** sign-off: B.2.3 redaction completeness, 5 historical records verified
- [ ] **UX Designer** sign-off: Vietnamese copy, mobile UX, axe-core
- [ ] **QA Architect** sign-off: test layers 1–10 covered, 12-role × 3-viewport regression green
- [ ] **Release Manager** sign-off: flag inventory, rollback verified, sign-off chain collected
- [ ] **CEO + Product Owner** final go/no-go for staging pilot

### 10.5 Documentation gate

- [ ] `docs/ux-redesign/SPRINT_6_2_EXECUTION_PLAN.md` (this file) committed alongside the merge
- [ ] `CLAUDE.md` updated with Sprint 6.2 completion note (Phase 6 status table row added)
- [ ] Each new file has JSDoc on the exported function/component + props
- [ ] Each new env var documented in `.env.local` comments
- [ ] `CONTRIBUTING.md` updated with Conventional Commits section (RR-8)
- [ ] `STORY_B2_1_IMPLEMENTATION_REPORT.md` + `STORY_B2_1_MIGRATION_NOTES.md` include medical director sign-off annotation
- [ ] `STORY_B1_5_IMPLEMENTATION_REPORT.md` includes medical workflow sign-off
- [ ] `STORY_B2_3_IMPLEMENTATION_REPORT.md` includes data privacy sign-off
- [ ] `STORY_B2_4_IMPLEMENTATION_REPORT.md` includes UX designer copy review

### 10.6 Carry-over gate (from 6.1)

- [ ] RR-2 reconciled (1-line fix) — **must complete before B.2.1 commits**
- [ ] RR-3 B.3.1 sign-off coordination scheduled (in week 1 of 6.2)
- [ ] RR-4 B.1.4 Suspense boundary fixed
- [ ] RR-8 Conventional Commits adopted

---

## Appendix A — Resolved decisions (locked from prior sprints + this plan)

No new `AskUserQuestion` was required for Sprint 6.2. All decisions are inherited from the Sprint 6.1 locked decisions (Appendix A of `SPRINT_6_1_EXECUTION_PLAN.md`) + this plan's defaults. Summary of relevant inherited decisions:

### Q1 (from 6.1) — B.1.3 server-side RBAC: scope of restriction → **Option A** (LOCKED)

Sales roles lose status-change rights. This decision directly enables B.2.1 to gate `medically_approved` correctly (only doctor can perform this transition per BACKLOG C.3.1 deferred to 7.3; in 6.2, the gate is `allPassed`, not role).

### Q2 (from 6.1) — B.3.1 payment SoD: who confirms now → **Option A** (LOCKED)

`PAYMENT_CONFIRM_ROLES = ['admin']` only. RR-3 in 6.2 coordinates the sign-off for flag promotion.

### Q3 (from 6.1) — Sprint 6.1 flag rollout → **Option A** (LOCKED)

All flags default OFF in prod. Inherited for 6.2's 2 new flags. Promotion requires medical director + CEO + product-owner sign-off per BACKLOG §9.2.

### Q4 (NEW in 6.2) — B.1.5 notification debounce window → **6 hours** (RECOMMENDED, default)

The backlog B.1.5 AC does not specify a debounce window. The plan's default of 6h is documented in §7.2.4. Medical workflow expert can adjust to 4h or 12h during sign-off if the clinical context requires it. The 6h window is a soft debounce — it does not block re-escalation in emergencies; it prevents the *same escalation* from firing repeatedly for the *same case*.

### Q5 (NEW in 6.2) — B.2.1 banner copy in Vietnamese → **"Vui lòng hoàn thành toàn bộ checklist trước khi chuyển trạng thái"** (RECOMMENDED, default)

The exact copy is up to medical director + ux-designer sign-off. The plan's default is clinical, neutral, and instructive (not alarming). Alternatives: "Ca chưa sẵn sàng — vui lòng hoàn thành checklist" (more direct), "Cần hoàn thành 6 hạng mục trước khi tiếp tục" (more specific). UX designer can pick during sign-off.

### Q6 (NEW in 6.2) — Sprint 6.2 flag rollout → **Option A** (LOCKED by inheritance)

Both new flags (`FEATURE_CHECKLIST_GATE`, `FEATURE_CLINICAL_CHECKLIST`) default OFF in prod. Promotion requires medical director + CEO + product-owner sign-off per BACKLOG §9.2. Staging pilot of 3 days with CSO + 2 medical staff is required before production promotion.

---

## Appendix B — Files inventory at a glance

```
CREATE  (8 files)
├── src/lib/followups/escalate.ts                              (B.1.5)
├── src/lib/followups/__tests__/escalate.test.ts               (B.1.5)
├── src/app/api/followups/[id]/__tests__/route.test.ts         (B.1.5)
├── src/components/ui/__tests__/confirm-dialog.test.tsx        (B.2.4)
├── src/lib/checklist/__tests__/evaluate.test.ts               (B.2.1)
├── src/components/checklist/__tests__/checklist-panel.test.tsx (B.2.1)
├── src/components/cases/__tests__/status-workflow-gate.test.tsx (B.2.1)
├── src/app/(protected)/audit-logs/__tests__/page.test.tsx     (B.2.3)
└── src/constants/__tests__/permissions.test.ts                (RR-2)

MODIFY  (14 files)
├── src/constants/permissions.ts                               (RR-2)
├── src/lib/firestore/audit.ts                                 (B.2.3)
├── src/lib/checklist/evaluatePreProcedureChecklist.ts         (B.2.1)
├── src/lib/types/case.ts                                      (B.2.1 + B.1.5)
├── src/lib/firestore/followups.ts                             (B.1.5)
├── src/lib/notifications/templates.ts                         (B.1.5)
├── src/lib/notifications/trigger.ts                           (B.1.5)
├── src/components/ui/confirm-dialog.tsx                       (B.2.4)
├── src/components/checklist/checklist-panel.tsx               (B.2.1)
├── src/components/cases/status-workflow.tsx                   (B.2.1 + B.2.4)
├── src/app/(protected)/cases/[id]/page.tsx                    (B.2.1 + B.2.4)
├── src/app/api/followups/[id]/route.ts                        (B.1.5)
├── src/app/api/cases/[id]/status/route.ts                     (B.2.1, extends 6.1 B.1.3)
├── src/app/(protected)/audit-logs/page.tsx                    (B.2.3)
├── .env.local                                                 (B.2.1 — 2 new flags)
├── package.json                                               (no new deps)
├── CONTRIBUTING.md                                            (RR-8 — new or extended)
└── CLAUDE.md                                                  (sprint hygiene)

NOT TOUCHED in 6.2 (Phase 6.3+ scope, listed for clarity)
├── src/app/(protected)/layout.tsx                              (6.3 — min-h-screen)
├── src/components/cases/case-list.tsx                         (6.3 — status filter responsive)
├── src/lib/validators/case.ts                                 (7.3 — actualProcedureDate required)
├── src/lib/validators/case.ts                                 (7.3 — lab date validation)
├── src/lib/types/case.ts (medically_approved identity)        (7.3 — doctor identity)
├── src/components/attachments/*                               (7.4 — consent gates)
├── src/components/consents/*                                  (7.4 — consent PDF requirement)
├── firestore.rules, storage.rules, firebase.json              (Phase 5 remaining)
└── vercel.json, deployment docs                               (Phase 5 remaining)
```

---

## Appendix C — Verification end-to-end

After Sprint 6.2 ships, the following end-to-end verification must pass before merging `phase-6/sprint-6.2` → `main`:

```bash
# Build gates
npx tsc --noEmit                  # → 0 errors
npx tsc -p tsconfig.test.json --noEmit  # → 0 errors (test config)
npm run lint                      # → 0 warnings
npm run build                     # → 34 routes, 0 errors

# Test gate
npm run test                      # → 259 baseline + ~30–40 new = ~290+ tests, all green

# Anti-pattern grep checks
grep -rE "window\.(confirm|alert)" src/ | grep -v __tests__/   # → 0 matches (A9)
grep -rE "as never" src/components/layout/                     # → 0 matches (carry 6.1)
grep -rE "user-\d{3}" src/components                           # → 0 matches (A2)
grep -rE "caseId\s*=\s*['\"]general['\"]" src/                 # → 0 matches (A1)
grep -rE "medicalNote|privacyNote|nationalIdNumber" src/lib/firestore/audit.ts
                                                            # → only AUDIT_REDACTED_FIELDS array

# Manual smoke (5 routes × 12 roles)
# 1. /dashboard           — 5 cards render, no regression
# 2. /cases/[id]          — checklist panel shows 6 new items (when flag ON), gate blocks bad transitions
# 3. /customers/[id]      — Tabs ARIA still works, CCCD section visible to admin
# 4. /audit-logs          — diff renders [ĐÃ ẨN] with tooltip for PII fields
# 5. /followups           — painLevel >= 4 triggers escalation (when in dev)
# 6. /cases/[id] procedure_completed — second-confirm dialog opens, requires actualProcedureDate

# Flag configuration
grep -E "NEXT_PUBLIC_FEATURE_(CHECKLIST_GATE|CLINICAL_CHECKLIST)" .env.local
                                                            # → 2 flags present, both = false (prod)

# Sign-off verification
test -f docs/ux-redesign/STORY_B2_1_IMPLEMENTATION_REPORT.md && grep -l "Medical Director" docs/ux-redesign/STORY_B2_1_*
test -f docs/ux-redesign/STORY_B1_5_IMPLEMENTATION_REPORT.md && grep -l "Medical Workflow" docs/ux-redesign/STORY_B1_5_*
test -f docs/ux-redesign/STORY_B2_3_IMPLEMENTATION_REPORT.md && grep -l "Data Privacy" docs/ux-redesign/STORY_B2_3_*
```

If any check fails, the sprint is not Done; return to the failing story, fix, re-run all gates, and re-collect the relevant sign-off.

---

*End of Sprint 6.2 Execution Plan.*
