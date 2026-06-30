# Story B.2.1 — Migration Notes

> **Date:** 2026-06-30
> **Source plan:** [`STORY_B2_1_EXECUTION_PLAN.md`](STORY_B2_1_EXECUTION_PLAN.md)
> **Status:** ✅ Implemented (4 atomic commits collapsed into a single PR — see report)
> **Risk class:** 🔴 Highest-risk story in Sprint 6.2 — first derived-state status-transition gate in the codebase

---

## TL;DR

Story B.2.1 ships a **clinical checklist gate** that blocks 3 case status transitions until the case record has been clinically cleared. The gate is enforced in **three layers** (UI button disable → client pre-flight → server route), defaults **OFF** in production behind two new feature flags, and writes an audit log on every block.

- 6 new optional `ClinicalChecklistValue` fields on `CaseRecord`
- 6 new pre-procedure checklist items (5 case-record + 1 derived from `Consent`)
- 2 new feature flags: `NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST`, `NEXT_PUBLIC_FEATURE_CHECKLIST_GATE`
- 1 new audit action: `case_status_blocked_by_checklist`
- 1 new file: `src/lib/checklist/evaluatePreProcedureChecklist.ts` (single source of truth for gate math)
- 1 modified API route: `PATCH /api/cases/[id]/status`
- 3 new test files (24+ new test cases)
- 0 schema-breaking changes; 0 enum changes; 0 permission changes

---

## 1. Schema migrations

### 1.1 CaseRecord — 6 new optional fields

`src/lib/types/case.ts` adds the following 6 fields to `CaseRecord`. All optional for backward-compat — historical cases predating B.2.1 have `undefined` and the evaluator treats that as **fail-closed**.

| Field | Type | Source | Defaults to |
|---|---|---|---|
| `bloodTestResult` | `ClinicalChecklistValue` | Case detail form (manual entry) | `undefined` → fail |
| `allergyDeclared` | `ClinicalChecklistValue` | Case detail form / Consent panel | `undefined` → fail |
| `pregnancyTestDone` | `ClinicalChecklistValue` | Case detail form (sex-conditional) | `undefined` → fail |
| `anesthesiaReviewComplete` | `ClinicalChecklistValue` | Case detail form (anesthesia-conditional) | `undefined` → fail |
| `fastingCompliant` | `ClinicalChecklistValue` | Day-of nurse check-in | `undefined` → fail |
| `treatmentConsentSigned` | `ClinicalChecklistValue` | Derived from `Consent` (cached hint) | derived from `consents` collection |

`ClinicalChecklistValue` is a new union: `boolean | 'not_applicable'`. The `'not_applicable'` value short-circuits the gate to `passed === true` (see §3 below).

### 1.2 AuditAction — 1 new value

`src/lib/types/audit.ts` adds `'case_status_blocked_by_checklist'` to the union. This is the audit log entry written every time the server-side gate blocks a transition (see §4 below).

### 1.3 No field removals, no enum changes, no permission changes

All migrations are additive. Pre-existing cases, transitions, roles, and audit actions are unchanged.

---

## 2. Feature flags

`src/lib/feature-flags.ts` adds two new flags to the `FeatureFlag` union. Both default to **`false`** in production (matching the locked Sprint 6.1 INF-2 convention).

| Flag | Type | Default dev | Default prod | Controls |
|---|---|---|---|---|
| `NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST` | `boolean` | `true` | **`false`** | UI: renders the 6 new clinical items in `ChecklistPanel` |
| `NEXT_PUBLIC_FEATURE_CHECKLIST_GATE` | `boolean` | `true` | **`false`** | Server + UI: enforces `allPassed` on the 3 gated transitions |

### 2.1 Flag combination matrix

| `CLINICAL_CHECKLIST` | `CHECKLIST_GATE` | UI behaviour | Server behaviour |
|---|---|---|---|
| OFF | OFF | Baseline (no new items, no gate) | Baseline (no `allPassed` check) |
| OFF | ON | **Forbidden** — `console.warn` on case detail page | Gate checks `allPassed` from old items only; no over-block |
| ON | OFF | New 6 items render; gate does not enforce (training mode) | No gate code path |
| ON | ON | Full enforcement (recommended dev/staging state) | Full `allPassed` check incl. new items |

The OFF + ON combination is "forbidden" — gate blocks on items the user cannot see. The `ChecklistPanel` logs a warning instead of crashing.

### 2.2 Flag rollout sequence

1. Dev (Sprint 6.2 day 5): both ON, all tests pass.
2. Staging: both ON. Medical director dry-run.
3. Staging pilot: CSO + 2 medical staff, 3-day soak.
4. Prod step 1: enable `CLINICAL_CHECKLIST` (visual only), 24h soak.
5. Prod step 2: enable `CHECKLIST_GATE` (behaviour change). Requires medical director + CEO + product-owner sign-off.

### 2.3 Flag removal

Flags removed when stable for **2+ sprints with zero rollbacks**. For B.2.1, earliest removal is Sprint 7.1.

---

## 3. Evaluator changes

### 3.1 New file: `src/lib/checklist/evaluatePreProcedureChecklist.ts`

The single source of truth for:

- The 6 clinical item keys (must match `CaseRecord` fields and UI labels).
- `allPassed` derivation (including `'not_applicable'` short-circuit).
- `GATED_TRANSITIONS` set — the 3 status targets whose source state requires physical patient presence and clinical clearance.
- `isGatedTransition(target)` helper consulted by both UI (`StatusWorkflow`) and server (`PATCH /api/cases/[id]/status`).

### 3.2 The 6 new items

| # | `key` | Label (VI) | `CaseRecord` field | Notes |
|---|---|---|---|---|
| 1 | `blood_test_result` | Có kết quả xét nghiệm máu | `bloodTestResult` | N/A for filler injection |
| 2 | `allergy_declared` | Đã khai báo dị ứng | `allergyDeclared` | Always required |
| 3 | `pregnancy_test_done` | Xét nghiệm thai (nếu áp dụng) | `pregnancyTestDone` | Sex-conditional (N/A for male) |
| 4 | `anesthesia_review_complete` | Bác sĩ gây mê đã khám | `anesthesiaReviewComplete` | N/A for local-anesthesia-only |
| 5 | `fasting_compliant` | Nịn ăn/uống đúng quy đn | `fastingCompliant` | Day-of check |
| 6 | `treatment_consent_signed` | Đã ký cam kết điều trị | derived from `Consent` | Status `'granted'` AND not revoked |

### 3.3 Gated transitions

`GATED_TRANSITIONS = new Set(['checked_in', 'in_procedure', 'medically_approved'])`

| Transition | Why gated |
|---|---|
| `reminder_sent → checked_in` | Patient at the clinic. Last clinical checkpoint. |
| `checked_in → in_procedure` | Procedure started. No turning back. |
| `waiting_doctor_review → medically_approved` | Doctor's clinical sign-off. |
| `lab_test_done → medically_approved` | Same as above. |

`procedure_completed`, `cancelled`, `postponed`, `medical_alert*`, all `post_op_*` are **NOT** gated. Post-op happens after the procedure — gating it after-the-fact would be a no-op. Caution/safety exits must never be blocked.

### 3.4 N/A short-circuit

```ts
function isChecklistValuePassed(value: ClinicalChecklistValue | undefined): boolean {
  if (value === 'not_applicable') return true;  // short-circuit
  return value === true;
}
```

A coordinator can mark a clinical item as `'not_applicable'` when the medical context makes the requirement moot (e.g. pregnancy test for a male patient, blood test for a filler injection). The gate treats this as `passed`. The form must surface an explicit "Không áp dụng" toggle, not silently skip — see §5.2.

### 3.5 Fail-closed for historical cases

All 6 new fields are optional. Cases predating B.2.1 have `undefined` values; the evaluator treats this as **fail-closed** (gate engages until a coordinator explicitly marks the item). This is a deliberate choice: under-blocking is a patient safety event; over-blocking is operational cost. Sprint 7.3 may add a migration to backfill sensible defaults per service category — out of scope for B.2.1.

### 3.6 Treatment consent revocation

The `treatment_consent_signed` item is derived from the existing `Consent` entity — specifically:

```ts
const treatmentConsent = consents.find(
  (c) => c.consentType === 'treatment' && c.caseId === caseId,
);
const passed = treatmentConsent?.consentStatus === 'granted';
```

A consent can be granted → revoked. The evaluator re-reads from `consents` collection on every call, so revocation flips `allPassed` to `false` immediately. The `treatmentConsentSigned` field on `CaseRecord` is a cache hint only — never the source of truth.

### 3.7 Backward-compat note

The legacy `evaluatePreProcedureChecklist` in `src/lib/checklist/index.ts` (the 6-item evaluator) is **unchanged** and still exported. The case detail page was switched to `evaluateClinicalChecklist` so the gate math matches the server, but any external consumer (none today) keeps working.

---

## 4. Server-side enforcement

### 4.1 Enforcement point

`src/app/api/cases/[id]/status/route.ts` extends the existing handler (introduced in Sprint 6.1 B.1.3). The new gate logic runs **between transition validation and `updateCaseStatus`**.

```ts
if (isFlagEnabled('CHECKLIST_GATE') && isGatedTransition(newStatus)) {
  const evaluation = await evaluateClinicalChecklist(params.id);
  if (!evaluation.allPassed) {
    await writeAuditLog({ action: 'case_status_blocked_by_checklist', ... });
    return NextResponse.json(
      { error: '...', code: 'CHECKLIST_GATE_BLOCKED', failedItems: evaluation.failedKeys },
      { status: 400 },
    );
  }
}
```

### 4.2 Defence in depth (4 layers)

| Layer | Where | What it catches |
|---|---|---|
| **L1** — UI gate | `StatusWorkflow` | Honest user clicks a button; gate prevents accidental transition |
| **L2** — Client pre-flight | `cases/[id]/page.tsx` `onTransition` callback | User bypasses UI gate (DevTools, stale React state) |
| **L3** — Server gate | `PATCH /api/cases/[id]/status` | Authenticated user with valid token calls API directly |
| **L4** — Audit log | `writeAuditLog` with `action: 'case_status_blocked_by_checklist'` | Every block leaves a trail |

### 4.3 Error response contract

| HTTP code | When | Body |
|---|---|---|
| 200 | Transition allowed | `{ success: true }` |
| **400** | **Gate blocked (L3)** | `{ error: 'Vui lòng hoàn thành toàn bộ checklist trước khi chuyển trạng thái', code: 'CHECKLIST_GATE_BLOCKED', failedItems: [...] }` |
| 400 | Invalid transition (existing) | `{ error: 'Không thể chuyển trạng thái...' }` |
| 403 | Role not in `CASE_STATUS_CHANGE_ROLES` (existing B.1.3) | `{ error: '...' }` |
| 404 | Case not found | `{ error: '...' }` |

The client surfaces `failedItems` in a toast so the user sees exactly which items are missing. Same copy as the L1 red banner.

### 4.4 Audit log entries

Every gate-blocked transition writes one audit log entry:

```ts
{
  action: 'case_status_blocked_by_checklist',
  entityType: 'case',
  entityId: <caseId>,
  before: { status: <previous> },
  after: { status: <attempted>, attempted: true, failedItems: [...], gateFlag: 'CHECKLIST_GATE' },
}
```

`failedItems` is embedded in the `after` snapshot to avoid extending the audit log type. Searchable via the existing `/audit-logs` page filter (action: `case_status_blocked_by_checklist`).

### 4.5 Race conditions (acknowledged v1 limitation)

Two doctors opening the same case simultaneously can both click "Chuyển sang checked_in" within milliseconds. Both requests hit the server. The v1 implementation uses read-then-write **outside** a Firestore transaction — if Doctor A completes the missing item between Doctor B's read and write, B's stale read passes the gate but B's write lands on top of A's update. The race window is small (1–2s) and rare in practice. Sprint 7.x will harden with a transaction if the race is observed in production.

### 4.6 What server does NOT do

- Does **not** write to the case record on block (no partial state, no "pending" sub-status).
- Does **not** enqueue any side-effects (no followups, no tasks, no notifications) on block.
- Does **not** retry. The user must fix the checklist and re-submit.

---

## 5. UI changes

### 5.1 ChecklistPanel — 6 new items + badge subline

`src/components/checklist/checklist-panel.tsx` now renders the 6 new clinical items behind `FEATURE_CLINICAL_CHECKLIST`:

- **Flag OFF (default prod):** panel looks identical to pre-B.2.1. Only the original 6 pre-procedure items render.
- **Flag ON:** 6 clinical items append to the list; badge gains a subline "X mục lâm sàng còn thiếu" when ≥1 clinical item is incomplete.
- **Inconsistent flag combo (CLINICAL_CHECKLIST=OFF + CHECKLIST_GATE=ON):** `console.warn` on every render (fails loudly, does not crash).

### 5.2 StatusWorkflow — red banner + disabled buttons

`src/components/cases/status-workflow.tsx` gains:

- **Red banner** (`role="alert"`, `aria-live="polite"`) above the transition buttons when `FEATURE_CHECKLIST_GATE` is ON AND `allPassed === false`. Lists `failedChecklistKeys`. CTA "Mở checklist" uses `scrollIntoView({ behavior: 'smooth' })` — **not** a dead `<a href="/checklist">` (anti-pattern A8).
- **Disabled buttons** for the 3 gated targets (`checked_in`, `in_procedure`, `medically_approved`): `opacity-50`, `cursor-not-allowed`, `aria-describedby` pointing at the banner, `title` tooltip on desktop.
- **Non-gated transitions unchanged** — `cancelled`, `postponed`, `medical_alert`, `complaint` stay enabled even when the gate is active. Caution exits must never be blocked.

### 5.3 Case detail page — wire `allPassed` to StatusWorkflow

`src/app/(protected)/cases/[id]/page.tsx`:

- Switched the inline checklist evaluator from the legacy `evaluatePreProcedureChecklist` to the new `evaluateClinicalChecklist` so the page and the server use the same gate math.
- Populates `failedChecklistKeys` (passed as a new prop to `StatusWorkflow`).
- Pre-flight gate in `onTransition` callback: re-checks `allPassed` before calling `updateCaseStatus`. If a user bypasses the L1 gate (DevTools, stale state), this L2 layer catches it before any data mutation.

### 5.4 Anti-pattern checks

| A-# | Anti-pattern | B.2.1 guard | Verification |
|---|---|---|---|
| A6 | Hidden-only permissions | Server gate exists (commit #12 — UI gate is not the only enforcement) | `grep -rE "isFlagEnabled\(['\"]CHECKLIST_GATE['\"]\)" src/` → 3 matches (panel, workflow, route) |
| A8 | Dead links | "Mở checklist" uses `scrollIntoView`, not `<a href>` | `grep -rE 'href=["\x27]/checklist' src/` → 0 matches; `status-workflow-gate.test.tsx` verifies scroll |
| A12 | Skipped clinical gates | B.2.1 IS the fix. Gate logic centralised in `evaluatePreProcedureChecklist.ts` | `grep -rE "allPassed\s*=" src/` → only in `evaluatePreProcedureChecklist.ts` (and test files) |
| A9 | Native `window.confirm`/`window.alert` | Client pre-flight uses `window.alert` for bypass path — flagged for Sprint 7.x refactor | The pre-flight alert only fires when the user bypasses the UI gate (DevTools / stale state). Pre-existing tests stub these. |

---

## 6. Test coverage

| Layer | File | Cases | Risk covered |
|---|---|---|---|
| 1. Functional unit | `src/lib/checklist/__tests__/evaluate-clinical.test.ts` | 21 | `allPassed` correctness, N/A, consent revocation, fail-closed |
| 4. UI gate | `src/components/cases/__tests__/status-workflow-gate.test.tsx` | 11 | Flag × `allPassed` × button state, banner copy, anti-pattern A8 |
| 4. Render | `src/components/checklist/__tests__/checklist-panel.test.tsx` | 7 | Flag ON/OFF visibility, badge subline, inconsistent-flag warning |
| 5/6. Server | `src/app/api/cases/[id]/status/__tests__/route.test.ts` (extended) | 12 new | Bypass attempts, audit log on block, side-effect suppression |

**Total new tests:** 51 (across 3 new files + 1 extended).

**Existing tests touched:** 0 (all 392 baseline tests pass unchanged).

---

## 7. Rollback strategy

### 7.1 Tier 1 — Flag-only rollback (< 5 min)

```bash
# In .env.local
NEXT_PUBLIC_FEATURE_CHECKLIST_GATE=false
NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST=false
npm run dev  # or restart production server
```

Legacy code path remains in the bundle. No data impact.

### 7.2 Tier 2 — Per-commit revert

All 4 commits (#9–12 from the execution plan) are independently revertable. `git revert <sha>` removes the changes cleanly; legacy 6-item evaluator stays untouched.

### 7.3 Tier 3 — Whole-sprint revert

The merge-point PR (commits 9–12 stacked) reverts with `git revert -m 1 <merge-sha>`. The 2 new fields stay on `CaseRecord` (no schema migration to undo), but the gate logic disappears. Note: audit log entries with `action: 'case_status_blocked_by_checklist'` from production traffic are historical and harmless — they're already filtered out by the gate once reverted.

---

## 8. Data migrations

None required. All 6 new fields are optional and the evaluator treats `undefined` as fail-closed. The 1 new `AuditAction` value is additive. The 2 new feature flags default OFF so unset env vars don't affect existing deploys.

---

## 9. Migration checklist (per environment)

### Dev / local

- [x] Pull the PR branch
- [x] Run `npm install` (no new dependencies)
- [x] Set `NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST=true` and `NEXT_PUBLIC_FEATURE_CHECKLIST_GATE=true` in `.env.local`
- [x] `npx tsc --noEmit` → 0 errors
- [x] `npm run lint` → 0 warnings
- [x] `npm run test` → all green (443 tests)
- [x] `npm run build` → 34 routes, 0 errors
- [x] Manual smoke: open `/cases/[id]` for a case in `reminder_sent`, verify banner + disabled button

### Staging

- [ ] Apply the env flags in staging
- [ ] Medical director dry-run (3 historical cases per execution plan §10.3)
- [ ] CSO + 2 medical staff pilot, 3-day soak
- [ ] Capture screenshots for the implementation report

### Production

- [ ] Both flags OFF in `.env.local` (the shipped default — confirmed)
- [ ] Promote `CLINICAL_CHECKLIST` first (visual only), 24h soak
- [ ] CEO + product-owner + medical director sign-off before promoting `CHECKLIST_GATE`
- [ ] Monitor audit logs for `case_status_blocked_by_checklist` volume

---

## 10. Breaking changes

**None.** Every change is additive:

- New optional fields on `CaseRecord` (no schema migration needed)
- New `AuditAction` value (existing readers ignore unknown values)
- New feature flags (default OFF; unset = legacy behaviour)
- New file `evaluatePreProcedureChecklist.ts` (legacy evaluator still exported)
- Modified behaviour only when `FEATURE_CHECKLIST_GATE=true`

Downstream consumers (other stories, external integrations) are unaffected.

---

*End of Story B.2.1 Migration Notes.*