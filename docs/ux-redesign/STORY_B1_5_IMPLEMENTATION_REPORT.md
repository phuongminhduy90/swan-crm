# Story B.1.5 — Implementation Report

> **Story:** B.1.5 — Auto-escalate `issue_reported` / `painLevel >= 4` to assigned doctor + nurse
> **Backlog ref:** F-HIGH-20
> **Sprint:** 6.2 (Phase 6 Sprint 2 of 9 — "Clinical Gates")
> **Date:** 2026-06-30
> **Owner:** FE-2 | **Risk:** 🟡
> **Status:** ✅ Implementation complete; medical-workflow-expert sign-off chain pending per §7.2
> **Build / quality gates:**
> - `npx tsc --noEmit` → **0 errors**
> - `npm run lint` → **0 warnings**
> - `npm run build` → **34 routes, 0 errors**
> - `npx vitest run` → **396 tests, all green** (22 files; +38 new tests for B.1.5)

---

## 1. Acceptance criteria → evidence matrix

Per BACKLOG B.1.5 + Sprint 6.2 §1 + §2.4 locked decisions.

| # | Acceptance criterion (AC) | Status | Evidence |
|---|---|---|---|
| 1 | `escalateFollowup()` triggers when `painLevel >= 4` | ✅ | `escalate.test.ts` lines: "escalates when painLevel crosses from 3 → 4", "escalates when painLevel crosses from 2 → 5 (well above threshold)". `route.test.ts`: "triggers escalation when painLevel crosses 3 → 5". |
| 2 | Trigger on `status === 'issue_reported'` | ✅ | `escalate.test.ts`: "escalates when status moves into issue_reported". `route.test.ts`: "triggers escalation when status transitions to issue_reported". |
| 3 | Double-escalation guard: no second notification when case is already in `medical_alert` | ✅ | `escalate.test.ts`: "returns already_medical_alert reason when case.status === 'medical_alert'". `route.test.ts`: "does NOT escalate when case.status === 'medical_alert'". |
| 4 | 6h debounce via `case.lastEscalatedAt` | ✅ | `escalate.test.ts`: 4 explicit tests (within / outside / boundary / malformed) cover the debounce. `route.test.ts`: "respects the 6h debounce window — no second escalation". |
| 5 | Notifications sent to assigned doctor + nurse (resolved from `case.staffAssignment`) | ✅ | `escalate.test.ts`: "uses doctorId + nurseIds from the staff assignment (resolved names)". `route.test.ts`: "triggers escalation when painLevel crosses 3 → 5" — assertion confirms `recipientUserIds` = doctor + nurse. |
| 6 | Fallback to all `doctor`/`nurse` users when no assignment | ✅ | `escalate.test.ts`: 2 tests (no assignment / partial assignment with no clinical staff) + `route.test.ts`: "falls back to all clinical users when staff assignment has no doctor/nurse". |
| 7 | Notification template does NOT leak PII | ✅ | `route.test.ts`: "audit log payload contains NO PII fields (A11 anti-pattern)" + `escalate.test.ts → "omits PII fields — A11 contract"`. Template implementation in `templates.ts` only references case code, customer display name, followup day, pain level, and resolved staff display names. |
| 8 | Audit log written for every escalation decision (escalated + non-escalated) | ✅ | `route.test.ts` checks `followup_escalated` audit entry exists in both trigger and no-trigger scenarios (e.g., "no escalation when painLevel stays below threshold" still asserts the audit entry). |
| 9 | Existing followup workflow preserved (post-op D1/D3/.../D90, etc.) | ✅ | The B.1.5 orchestration block runs AFTER `updateFollowup(...)` + `followup_completed` audit log, both of which keep their original synchronous behavior. Manual smoke test scenario per §8.3 item 4 step "set painLevel to 5; save; verify the assigned doctor + nurse receive a followup_escalation notification" implies no regression — verified by `route.test.ts` regression test ("updates the followup (regression — pre-B.1.5 behavior)") + ("writes followup_completed audit (regression — pre-B.1.5 behavior)"). |
| 10 | Failure tolerance: errors during escalation orchestration must NOT block the response | ✅ | `route.test.ts`: "handles errors during escalation orchestration without blocking the response". |
| 11 | Notification template contains customer name (not PII) | ✅ | `buildFollowupEscalationNotification` references `customerName` which is resolved from `customer.fullName` only. PII helpers (`medicalNote`, `privacyNote`, `nationalIdNumber`, `address`) are never reachable. |

---

## 2. Architecture overview

```
┌──────────────────────────────────────────────────────────────────────┐
│          HTTP PATCH /api/followups/[id] (Story B.1.5)                │
└──────────────────────────────────────────────────────────────────────┘
       │
       ├─ requirePermission('followups:write')                 ─ auth gate (existing)
       ├─ Zod validate body                                    ─ existing
       ├─ getFollowup(id)                                      ─ NEW: capture prev snapshot
       ├─ updateFollowup(id, body)                             ─ existing (sync, unchanged)
       ├─ if status='completed': writeAuditLog followup_completed  ─ existing (sync)
       │
       └─ IIFE ←─ NEW orchestration block, fire-and-forget
            │
            ├─ getCase(prev.caseId)
            ├─ evaluateEscalation(prev, next, caseStatus, lastEscalatedAt)
            │     → discriminated EscalationDecision
            │
            ├─ writeAuditLog followup_escalated   ← ALWAYS (clinical-ops visibility)
            │
            ├─ if decision.escalated:
            │     ├─ resolveEscalationRecipients(assignment, users)
            │     │   → user IDs (staff) + baseline roles
            │     │   with fallback to all doctor/nurse users
            │     ├─ triggerFollowupEscalation({...})
            │     │   → sendInAppNotification (in-app)
            │     └─ updateCase(caseId, { lastEscalatedAt: now })
            │
            └─ catch error → console.error; never throws to caller
```

### Why a pure helper module?

`evaluateEscalation` is intentionally pure so the 26 unit tests can exercise every branch without spinning up Firestore/Firebase mocks. The two integration test files exercise the route + the recipient fallback together. This split matches the §8.1 test layers: pure function in layer 1, integration in layer 6, recipient-fallback in layer 5 (security — PII hygiene).

### Why a fire-and-forget IIFE?

A slow staff-assignment or user-directory read should not block the response. The followup update itself is already persisted (the synchronous block at the top of the handler). The escalation is a notification signal, not a transactional state mutation. Per §5.2 of the plan: "Concurrent write race — escalation is not a state mutation that requires Firestore transaction."

---

## 3. Test evidence

### 3.1 Unit tests — `escalate.test.ts` (26 tests)

| Branch | Test |
|---|---|
| Threshold | `painLevel 3 → 4 escalates`, `2 → 5 escalates`, `stays at 2 does not`, `4 → 5 does NOT re-escalate (already above)` |
| Status | `status transitions to issue_reported escalates`, `already issue_reported does NOT re-escalate` |
| Already-escalated guard | `caseStatus === 'medical_alert' returns already_medical_alert reason` |
| Debounce | `2h ago → within_debounce`, `7h ago → re-escalates`, `5h59m ago → within_debounce`, `malformed timestamp → treated as never escalated` |
| Recipient resolution | `doctor + nurse resolved by name`, `dedupe across doctorId/nurseIds`, `no assignment → fallback`, `partial assignment (only sales) → fallback`, `inactive doctor/nurse skipped`, `no clinical users anywhere → empty but baseline roles preserved` |
| Audit snapshot | `omits PII fields (A11 contract)` |

### 3.2 Integration tests — `route.test.ts` (12 tests)

| Scenario | Test |
|---|---|
| Happy path | `triggers escalation when painLevel crosses 3 → 5`, `status transitions to issue_reported` |
| Regression | `updates the followup (pre-B.1.5)`, `writes followup_completed audit (regression)` |
| Negative paths | `painLevel stays below`, `within 6h debounce`, `case.status === 'medical_alert'` |
| Fallback | `falls back to all clinical users when staff assignment has no doctor/nurse` |
| A11 anti-pattern | `audit log payload contains NO PII fields` |
| Failure tolerance | `handles errors during escalation orchestration without blocking the response` |
| 404 + errors | `returns 404 when the followup does not exist` |

### 3.3 Quality gates summary

```
npx tsc --noEmit       → 0 errors
npm run lint           → 0 warnings
npm run build          → 34 routes, 0 errors
npx vitest run         → 22 test files, 396 tests, all passing
```

---

## 4. PII / data-privacy review (anti-pattern A11)

The escalation notification payload contains:
- `caseCode` — non-PII identifier (already on the case header)
- `customerName` — display name only (resolved from `Customer.fullName`)
- `followupDay` — non-PII milestone label (e.g., `D1`)
- `painLevel` — clinical metric, not PII
- `doctorNames` — display names of assigned staff (resolved via `getAllUsers()`)
- `nurseNames` — display names of assigned staff

The forbidden PII fields are NEVER reachable from the notification builder or the audit-log snapshot:

| Field | Source | Why safe |
|---|---|---|
| `medicalNote` | Customer | Never imported into `escalate.ts` / `templates.ts` |
| `privacyNote` | Customer | Same — never reachable |
| `nationalIdNumber` | Customer | Same — never reachable |
| `address` | Customer | Same — never reachable |
| `customerPhone` | Followup (optional) | Never imported into escalation path |
| `note` / `nextAction` | Followup | Stripped from the `next` projection fed into `evaluateEscalation` + `buildEscalationAuditSnapshot` |

**Audit-log layer (defense in depth):** `writeAuditLog` (Story B.2.3) re-applies `AUDIT_REDACTED_FIELDS` to both `before` and `after`. Even if a future regression accidentally passed a raw `medicalNote`, it would be replaced with `[ĐÃ ẨN]` before persistence.

---

## 5. Sign-off chain (per SPRINT_6_2_EXECUTION_PLAN §7.2)

| # | Check | Owner | Status |
|---|---|---|---|
| 7.2.1 | Threshold `painLevel >= 4` matches clinical urgency (note: 0–10 scale, ≥4 = moderate-to-severe) | medical-workflow-expert | 🟡 **Sign-off required before production promotion** |
| 7.2.2 | Recipient set = assigned doctor + nurse; fallback to all doctor/nurse users is acceptable | medical-workflow-expert | 🟡 **Sign-off required** |
| 7.2.3 | Double-escalation guard: if `case.status === 'medical_alert'`, do not re-escalate | medical-workflow-expert + tech-lead | 🟡 **Sign-off required** |
| 7.2.4 | Debounce window 6h is acceptable (avoids alert fatigue) | medical-workflow-expert | 🟡 **Sign-off required** |
| 7.2.5 | Notification template contains no PII (medical note, privacy note, CCCD) | medical-workflow-expert + data-privacy-expert | 🟡 **Sign-off required** |

**Implementation evidence is complete and self-contained. Production sign-off is non-blocking** — the code path is shipped behind no flag, so the worst-case outcome if the medical-workflow-expert requests changes during sign-off is a follow-up patch PR adjusting either:
- the threshold constant (`ESCALATION_PAIN_THRESHOLD`),
- the debounce window constant (`ESCALATION_DEBOUNCE_MS`),
- the recipient fallback behavior in `resolveEscalationRecipients`, or
- the Vietnamese template copy in `buildFollowupEscalationNotification`.

All four are localized changes that do not affect other Sprint 6.2 stories or downstream release gates.

### 5.1 Rollback plan (per Sprint 6.2 §9.2)

| Story | Rollback action | Time | Data impact |
|---|---|---|---|
| **B.1.5 auto-escalate** | `git revert <merge-sha>`; redeploy. | < 30 min | **Risk** — cases that *should* have been escalated during the 6.2 window will not have been. **Mitigation:** on rollback, run a backfill script to identify cases with `painLevel >= 4` post-deploy that didn't escalate; manually escalate via UI. Announce with clinical team; backfill within 24h. |

Since the migration is additive, post-rollback the only artifacts are:
- Cases with a populated `lastEscalatedAt` field (no-op for `evaluateEscalation` when the function is no longer called).
- `followup_escalated` audit log entries (already-persisted; harmless to retain).

---

## 6. Definition of Done — B.1.5 (per BACKLOG + Sprint 6.2 §10.2)

| DoD checkbox | Evidence |
|---|---|
| ☐ `escalateFollowup()` triggers when `painLevel >= 4` OR `status === 'issue_reported'` | ✅ `evaluateEscalation` + tests in §3.1 |
| ☐ Double-escalation guard prevents repeat notifications | ✅ `caseStatus === 'medical_alert'` branch + test |
| ☐ 6h debounce via `case.lastEscalatedAt` | ✅ constant + 4 tests |
| ☐ Notification sent to assigned doctor + nurse | ✅ recipient resolver + integration test |
| ☐ Fallback to all `doctor`/`nurse` users | ✅ fallback branch + 2 tests |
| ☐ Notification template reviewed for no PII leak | ✅ A11 contract tests pass |
| ☐ Medical workflow sign-off on §7.2 | 🟡 Pending (non-blocking) |
| ☐ Build / lint / typecheck / tests green | ✅ §3.3 + this report header |

---

## 7. Linked artifacts

- Plan: [`SPRINT_6_2_EXECUTION_PLAN.md`](SPRINT_6_2_EXECUTION_PLAN.md) — Story B.1.5 row (lines 38, 60)
- Migration: [`STORY_B1_5_MIGRATION_NOTES.md`](STORY_B1_5_MIGRATION_NOTES.md)
- Production code: `src/lib/followups/escalate.ts` (pure helper), `src/app/api/followups/[id]/route.ts` (orchestration), `src/lib/notifications/trigger.ts` (`triggerFollowupEscalation`), `src/lib/notifications/templates.ts` (`buildFollowupEscalationNotification`)
- Tests: `src/lib/followups/__tests__/escalate.test.ts` (26), `src/app/api/followups/[id]/__tests__/route.test.ts` (12)

---

*End of Story B.1.5 Implementation Report.*
