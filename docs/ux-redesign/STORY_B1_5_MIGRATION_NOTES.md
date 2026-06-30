# Story B.1.5 — Migration Notes

> **Story:** B.1.5 — Auto-escalate `issue_reported` / `painLevel >= 4` to assigned doctor + nurse
> **Backlog ref:** F-HIGH-20
> **Sprint:** 6.2 (Phase 6 Sprint 2 of 9 — "Clinical Gates")
> **Date:** 2026-06-30
> **Owner:** FE-2 | **Risk:** 🟡 | **Feature flag:** _none_ (no gate; safe by design)
> **Migration type:** additive only (no data loss, no destructive changes)

---

## Why migrate?

Pre-B.1.5 the only way to surface a high-pain followup was for a CSKH agent to manually open the case, spot the `issue_reported` status, and page the doctor. A patient reporting `painLevel=5` on a D1 followup could wait hours before anyone saw it — exactly the patient-safety gap the UX audit flagged as F-HIGH-20.

B.1.5 turns the threshold into an automatic, audited signal: every save on a post-op followup is checked, and when a high-pain reading or a `issue_reported` transition is detected the case's assigned doctor + nurse are notified within the same HTTP round-trip. A 6-hour debounce window prevents the same noisy case from spamming the medical team, and a `case.lastEscalatedAt` field gives clinical ops full visibility into how often escalations fire.

---

## What is additive in this story?

The migration is **additive only** — every change is a new field, a new helper, or an extended union. No data is destroyed, no permissions are removed, no enum values are deprecated.

| Area | Type of change | Additive? |
|---|---|---|
| `CaseRecord.lastEscalatedAt?` | New optional field on the case record | ✅ |
| `UpdateCaseInput.lastEscalatedAt?` | New optional field on the update input | ✅ |
| `AuditAction`: `'followup_escalated'` | New union member | ✅ |
| `NotificationEventType`: `'followup_escalation'` | New union member | ✅ |
| `src/lib/followups/escalate.ts` | New pure helper module | ✅ |
| `src/lib/followups/__tests__/escalate.test.ts` | New unit tests | ✅ |
| `src/app/api/followups/[id]/__tests__/route.test.ts` | New API integration tests | ✅ |
| `getFollowup(id)` on `src/lib/firestore/followups.ts` | New helper exported (does not change existing call sites) | ✅ |
| `buildFollowupEscalationNotification(...)` | New template function | ✅ |
| `triggerFollowupEscalation(...)` | New trigger function | ✅ |
| `PATCH /api/followups/[id]` orchestration | New fire-and-forget post-persist block; sync `updateFollowup` + `followup_completed` audit log order preserved | ✅ |

**No existing call sites were rewritten.** The pre-existing `updateFollowup(...)` and `followup_completed` audit log behaviour are preserved as the synchronous pre-image of the route handler — the B.1.5 orchestration runs only after that pre-image completes, in a self-contained async IIFE that swallows its own errors.

### Backward compatibility

| Existing API consumer | Behavior change? |
|---|---|
| `updateFollowup(id, input)` | No change. New `getFollowup(id)` added as a separate function; existing callers continue to work. |
| `PATCH /api/followups/[id]` with `status: 'completed'` | Same response shape. Audit log `followup_completed` still emitted synchronously. |
| `PATCH /api/followups/[id]` with `painLevel`/`status` not in escalation range | Same response shape. New `followup_escalated` audit entry added with `decision.reason = 'below_threshold'/'no_change'` (for clinical-ops visibility). |
| `PATCH /api/followups/[id]` with pain crossing the threshold or status moving to `issue_reported` | Same response shape (`{ success: true }`). New behavior: notification fired, `case.lastEscalatedAt` set, second `followup_escalated` audit entry written with `decision.reason = 'pain_above_threshold'/'issue_reported'`. |
| UI client of followups page (status badges, etc.) | No change. The audit log entries are written — there is no change to the followup response payload. |
| Notification listing UI (topbar bell, notifications page) | New `followup_escalation` event type now appears alongside the existing 14. Icon: `AlertTriangle`, color: red. |

### Rollback

Because the migration is purely additive, rollback is the simplest possible: revert the commit. No data has been deleted, and the only stateful side effect on existing cases is the new `lastEscalatedAt` field which, when undefined, is treated as "never escalated" by `evaluateEscalation`.

The "5 rapid painLevel saves → exactly 1 escalation" sprint smoke (§8.3 item 4) is verified manually; the per-request debounce + already-above-threshold logic is exercised in `escalate.test.ts` and the `route.test.ts` regression.

---

## What was out of scope (per Sprint 6.2 §1)

- ❌ Other Sprint 6.2 stories (B.2.1, B.2.3, B.2.4, RR-2)
- ❌ B.1.5 manual smoke sign-off by medical-workflow-expert (this story ships with engineering evidence; sign-off chain still requires the workflow expert per §7.2)
- ❌ UI surfacing in the followups page (status badges are unchanged; escalation is a notification + audit signal, not a UI affordance)
- ❌ Feature-flag gating (decision: B.1.5 ships un-flagged because the only stateful side effect is a notification + a single new field; both are reversible by reverting the commit)

---

## File-by-file change log

### Created

| Path | Purpose |
|---|---|
| `src/lib/followups/escalate.ts` | Pure helpers: `evaluateEscalation`, `resolveEscalationRecipients`, `buildEscalationAuditSnapshot`. Constants `ESCALATION_PAIN_THRESHOLD = 4`, `ESCALATION_DEBOUNCE_MS = 6h`. Discriminated `EscalationDecision` type. |
| `src/lib/followups/__tests__/escalate.test.ts` | 26 unit tests covering threshold, debounce, already-medical-alert guard, recipient fallback. |
| `src/app/api/followups/[id]/__tests__/route.test.ts` | 12 integration tests covering pain cross, issue_reported transition, debounce, already-medical-alert, fallback recipients, A11 PII redaction, failure tolerance. |

### Modified

| Path | Change |
|---|---|
| `src/lib/types/case.ts` | Add `lastEscalatedAt?: string` on `CaseRecord` + `UpdateCaseInput`. |
| `src/lib/types/notification.ts` | Add `'followup_escalation'` to `NotificationEventType`. |
| `src/lib/types/audit.ts` | Add `'followup_escalated'` to `AuditAction`. |
| `src/lib/firestore/followups.ts` | Add `getFollowup(id)` helper (read single followup). |
| `src/lib/notifications/templates.ts` | Add `buildFollowupEscalationNotification(...)` template (Vietnamese, no PII). |
| `src/lib/notifications/trigger.ts` | Add `triggerFollowupEscalation(...)` fire-and-forget trigger. |
| `src/app/api/followups/[id]/route.ts` | Read prev followup → update → audit `followup_completed` → orchestration block → resolve recipients → fire notification → update `case.lastEscalatedAt` → audit `followup_escalated`. The orchestration runs in a self-contained async IIFE. |
| `src/app/(protected)/audit-logs/page.tsx` | Add `followup_escalated` row to `AUDIT_ACTION_LABELS`. |
| `src/app/(protected)/notifications/page.tsx` | Add `followup_escalation: AlertTriangle` to `EVENT_ICONS` (+ import). |
| `src/components/layout/topbar.tsx` | Add `followup_escalation: AlertTriangle` to `EVENT_ICONS` (+ import). |

### Created (docs)

| Path | Purpose |
|---|---|
| `docs/ux-redesign/STORY_B1_5_MIGRATION_NOTES.md` | This file. |
| `docs/ux-redesign/STORY_B1_5_IMPLEMENTATION_REPORT.md` | Engineering / sign-off evidence. |

---

## Anti-pattern gate (§4.3 + §8.5)

| Anti-pattern | Status | Evidence |
|---|---|---|
| **A2** — raw user/entity IDs in copy | ✅ N/A | Recipient display names resolved via `getAllUsers()` + `displayName`. |
| **A6** — hidden-only permissions | ✅ N/A | Escalation runs server-side in the route handler, not in client UI. |
| **A9** — native `confirm()`/`alert()` | ✅ N/A | No dialog surface. |
| **A11** — PII in audit log diffs | ✅ Pass | `escalate.test.ts → PII safety test` + `route.test.ts → A11 anti-pattern test` verify `medicalNote`/`privacyNote`/`nationalIdNumber`/`address` strings never appear in the audit-log payload. Combined with B.2.3 redaction in `writeAuditLog`. |
| **A12** — skipped clinical gates | ✅ N/A | This story adds a gate (escalation), not removes one. |

---

## Verification end-to-end

```bash
# Build & quality gates — all green
npx tsc --noEmit                # 0 errors
npm run lint                    # 0 warnings
npm run build                   # 34 routes, 0 errors
npx vitest run                  # 396 tests, all green (includes +38 new B.1.5 tests)

# Anti-pattern grep — PII leak guard
grep -rE "nationalIdNumber|medicalNote|privacyNote" src/app/api/followups/[id]/route.ts \
                                                src/lib/followups/escalate.ts \
                                                src/lib/notifications/trigger.ts   # → 0 matches

# Feature flag inventory (this story adds none)
grep -E "FOLLOWUP_ESCALATION" .env.local          # → 0 matches (no flag)
```

---

*End of Story B.1.5 Migration Notes.*
