# Story B.2.1 — Clinical Checklist Gate (6 items + `allPassed`)

> **Date:** 2026-06-30
> **Source story:** [`IMPLEMENTATION_BACKLOG.md`](IMPLEMENTATION_BACKLOG.md) View 1 §B.2.1 (F-CRIT-03, F-CRIT-10)
> **Sprint plan context:** [`SPRINT_6_2_EXECUTION_PLAN.md`](SPRINT_6_2_EXECUTION_PLAN.md) §3 (commit sequence #9–12), §5 (R1/R2 risks), §6 (flags), §7 (medical sign-off §7.1)
> **Owner:** FE-2 (implementation) + medical-workflow-expert (clinical sign-off) + FE-1 (paired review) + tech-lead (gate enforcement)
> **Estimate:** 8h (commits 9–12) + 4h medical sign-off + 2h 3-case dry-run + 2h paired review
> **Risk:** 🔴 **Highest-risk story in Sprint 6.2** — first derived-state status-transition gate in the codebase
> **Status:** Plan ready for review — execution to begin after RR-2 lands on `phase-6/sprint-6.2`

---

## Why this plan exists

B.2.1 is the **first** story in this codebase that blocks a status transition based on a **derived clinical state** (`evaluatePreProcedureChecklist().allPassed`). Everything before this story validated role-based permission; nothing validated *clinical readiness*. Getting this wrong in either direction is a patient-safety event:

- **Under-block** (gate missing or buggy) → a case flips to `in_procedure` without lab results, allergy declaration, or anesthesia review → patient harm.
- **Over-block** (gate too strict or wrong scope) → legitimate cases stall in `scheduled` or `reminder_sent` → patient care delayed, manual override burden falls on coordinator.

This plan sequences work so the under-block vector is closed first (server-side enforcement lands in commit 12, *after* the UI gate in commit 11 is verified), and the over-block vector is mitigated by feature flags defaulting **OFF** in production, a 3-case dry-run with the medical director, and paired review (FE-1 + medical-workflow-expert) on every B.2.1 commit.

---

## 1. Clinical checklist items

The 6 new clinical items extend the **pre-procedure** checklist only. The pre-hospital checklist (consent, payment, staff assignment) is **out of scope** for B.2.1 — Sprint 7.3 may revisit it.

### 1.1 The 6 items (subject to medical director sign-off)

| # | `key` | Label (VI) | Field on `CaseRecord` | Type | Source of truth (Sprint 7.3 will harden) | Edge case |
|---|---|---|---|---|---|---|
| 1 | `blood_test_result` | Có kết quả xét nghiệm máu | `bloodTestResult?` | `boolean` | Manual entry in case detail (B.2.1); future: attachment link | If lab not required (e.g., minor procedure), item must be skippable — see §1.3 |
| 2 | `allergy_declared` | Đã khai báo dị ứng | `allergyDeclared?` | `boolean \| 'negative'` | Consent panel + case form (existing) | Always required; "no known allergies" still counts as declared |
| 3 | `pregnancy_test_done` | Xét nghiệm thai (nếu áp dụng) | `pregnancyTestDone?` | `boolean \| 'not_applicable'` | Manual entry; flag in patient form | **Sex-conditional** — see §1.3.1 |
| 4 | `anesthesia_review_complete` | Bác sĩ gây mê đã khám | `anesthesiaReviewComplete?` | `boolean` | Anesthesia consultation record (not yet in CRM) | Always required for any sedation/general anesthesia |
| 5 | `fasting_compliant` | Nhịn ăn/uống đúng quy định | `fastingCompliant?` | `boolean` | Manual check-in by nurse | Day-of check; cannot be answered > 24h before procedure |
| 6 | `treatment_consent_signed` | Đã ký cam kết điều trị | `treatmentConsentSigned?` | `boolean` | Consent panel (`status === 'granted'`) | Reuses existing Consent entity — see §1.4 |

### 1.2 `allPassed` derivation (deterministic, pure function)

```ts
// Pseudocode — implemented in src/lib/checklist/evaluatePreProcedureChecklist.ts
type ChecklistValue = boolean | 'not_applicable';

function isItemPassed(value: ChecklistValue | undefined, required: boolean): boolean {
  if (!required) return true;                  // non-required items never block
  if (value === 'not_applicable') return true; // N/A short-circuits to passed
  return value === true;
}

const allPassed = items
  .filter(i => i.required)
  .every(i => isItemPassed(sourceFor(i.key), true));
```

### 1.3 Edge cases (need medical director confirmation)

1.3.1 **Pregnancy test for male patients / non-reproductive procedures** — Item must support `'not_applicable'` so the gate does not over-block. The form must surface an explicit "Không áp dụng" toggle, not silently skip.

1.3.2 **Blood test not required** (e.g., minor non-invasive procedure like filler injection) — Coordinator must be able to mark `blood_test_result` as `not_applicable`. The gate respects the N/A value as `passed`.

1.3.3 **Anesthesia review when no anesthesia planned** — Local anesthesia only does not require an anesthesia specialist review. Item must be `not_applicable`-able.

1.3.4 **Historical cases predating schema** — All 6 new fields are `optional`. Cases with `undefined` values are treated as **not passed** (fail-closed). Pre-existing cases therefore start with `allPassed === false`. Sprint 7.3 may add a migration to backfill sensible defaults per service category — out of scope for B.2.1.

### 1.4 Treatment consent — reuse existing entity

The `treatment_consent_signed` item is **derived** from the existing `Consent` collection:

```ts
const treatmentConsent = await getActiveConsent(caseId, 'treatment');
// passed = treatmentConsent?.status === 'granted' AND !treatmentConsent?.revokedAt
```

A consent can be revoked *after* granting, so the derivation must check both `status === 'granted'` **and** `revokedAt === undefined`. If consent is granted but later revoked, `allPassed` flips to `false` and the gate engages.

### 1.5 What stays the same

- The 6 pre-existing pre-procedure items (`lab_done`, `doctor_approved`, `reminder_sent`, `hospital_confirmed`, `nurse_assigned`, `cskh_assigned`) remain unchanged.
- The 11-item pre-hospital checklist is **not affected** by B.2.1. It is rendered and computed but does not gate status transitions in this story.
- Existing `ChecklistPanel` UI (pre-hospital + pre-procedure sections) is preserved; only the pre-procedure section grows from 6 → 12 items.

---

## 2. Status transitions to block

B.2.1 blocks **exactly 3 transitions** — the ones whose source state requires the patient to be physically present and clinically cleared. These are inherited from `IMPLEMENTATION_BACKLOG.md` B.2.1 AC and locked by Sprint 6.2 §2.4 row 1.

### 2.1 The 3 gated transitions

| From | To | Why this transition is gated |
|---|---|---|
| `reminder_sent` | `checked_in` | Patient is at the clinic. Last clinical checkpoint before the procedure begins. |
| `checked_in` | `in_procedure` | Procedure has started. Patient is on the table. No turning back. |
| `waiting_doctor_review` / `lab_test_done` | `medically_approved` | Doctor signs off clinical readiness. This is the clinical gate, not an admin gate. |

### 2.2 Transitions NOT blocked by B.2.1 (deliberate scope)

| Transition | Why not gated |
|---|---|
| `draft` → `waiting_customer_info` | Admin form completion, no clinical involvement |
| `scheduled` → `reminder_sent` | Front-desk reminder, pre-clinical |
| `procedure_completed` → `waiting_images_upload` | Procedure is done; clinical gate is upstream |
| Any transition to `cancelled` / `postponed` / `medical_alert` | Safety exit — must never be blocked by readiness gate |
| Any `post_op_*` transition | Post-op, gate no longer relevant |

### 2.3 The `CASE_STATUS_TRANSITIONS` map (existing, from `src/constants/case-status.ts:68`)

```ts
// Reference only — B.2.1 does NOT modify this map.
{
  reminder_sent:        ['checked_in', 'postponed'],
  checked_in:           ['in_procedure'],
  waiting_doctor_review: ['medically_approved', 'medical_alert', 'postponed'],
  lab_test_done:        ['medically_approved', 'medical_alert'],
  // ...
}
```

The gate is **enforced in code**, not by adding/removing transitions. The transition matrix stays the source of truth for *what is allowed structurally*; B.2.1 adds an additional *clinical* layer on top.

### 2.4 Implementation: gating predicate

```ts
// Lives in src/lib/checklist/evaluatePreProcedureChecklist.ts (or a sibling)
export const GATED_TRANSITIONS: ReadonlySet<CaseStatus> = new Set([
  'checked_in',
  'in_procedure',
  'medically_approved',
]);

export function isGatedTransition(target: CaseStatus): boolean {
  return GATED_TRANSITIONS.has(target);
}
```

The server-side check uses this set so the gate and the UI agree. Adding/removing a gated status requires updating both this set **and** the medical sign-off doc.

---

## 3. Feature flag strategy

B.2.1 introduces **two** flags following the established 6.1 pattern (default OFF in production, fail-closed, additive only). Both flags extend the canonical `FeatureFlag` union in `src/lib/feature-flags.ts`.

### 3.1 Flag definitions

| Flag | Type | Default (dev) | Default (prod) | Controls |
|---|---|---|---|---|
| `NEXT_PUBLIC_FEATURE_CHECKLIST_GATE` | `boolean` | `true` | **`false`** | Server + UI: enforces `allPassed` on the 3 gated transitions |
| `NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST` | `boolean` | `true` | **`false`** | UI only: renders the 6 new clinical items in `ChecklistPanel` |

### 3.2 Why two flags, not one

The two flags **decouple visibility from enforcement**:

- `FEATURE_CLINICAL_CHECKLIST` ON + `FEATURE_CHECKLIST_GATE` OFF → users see the new items and can complete them, but nothing blocks. Useful for **training rollout** and **data gathering**.
- `FEATURE_CLINICAL_CHECKLIST` ON + `FEATURE_CHECKLIST_GATE` ON → full enforcement (recommended dev/staging state).
- `FEATURE_CLINICAL_CHECKLIST` OFF + `FEATURE_CHECKLIST_GATE` ON → **forbidden state** — gate would block on items the user cannot see. `useEffect` in `ChecklistPanel` logs a warning if this combination is detected (fails loudly, does not crash).

### 3.3 Flag combination matrix

| `FEATURE_CLINICAL_CHECKLIST` | `FEATURE_CHECKLIST_GATE` | UI behavior | Server behavior |
|---|---|---|---|
| OFF | OFF | Baseline (no new items, no gate) | Baseline (no `allPassed` check) |
| OFF | ON | **Inconsistent — warned** — gate blocks but no items render. `useEffect` logs warning. | Same — server checks `allPassed` from old items only; no over-block |
| ON | OFF | New 6 items render; gate does not enforce (training mode) | Same — server has no gate code path |
| ON | ON | New 6 items render; gate enforces | Same — server checks `allPassed` incl. new items |

### 3.4 Rollout sequence (per Sprint 6.2 §6.2)

1. **Dev** (Day 5 of 6.2): both ON, all tests pass.
2. **Staging** (post-merge): both ON. Medical director walks through 3 historical cases.
3. **Staging pilot** (3 days): CSO + 2 medical staff use gate in normal workflow.
4. **Prod step 1**: enable `FEATURE_CLINICAL_CHECKLIST` first (visual only). 24h soak.
5. **Prod step 2**: enable `FEATURE_CHECKLIST_GATE` (behavior change). Requires medical director + CEO + product-owner sign-off per BACKLOG §9.2.

### 3.5 Flag removal

Flags removed when feature stable for **2+ sprints with zero rollbacks**. For B.2.1, earliest removal is **Sprint 7.1**. Removal is a refactor PR — the gate code becomes unconditional, the `isFlagEnabled('CHECKLIST_GATE')` checks are deleted.

### 3.6 Flag inventory after B.2.1

| Flag | Story | State in prod (post-6.2) |
|---|---|---|
| `NEXT_PUBLIC_FEATURE_SHARED_MENU` | 6.1 A.5 | OFF (carry-over) |
| `NEXT_PUBLIC_FEATURE_SERVER_RBAC` | 6.1 B.1.3 | OFF (carry-over, prerequisite for B.2.1 server gate) |
| `NEXT_PUBLIC_FEATURE_PAYMENT_SOD` | 6.1 B.3.1 | OFF (RR-3 sign-off pending) |
| `NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST` | **6.2 B.2.1** | **OFF** (new) |
| `NEXT_PUBLIC_FEATURE_CHECKLIST_GATE` | **6.2 B.2.1** | **OFF** (new) |

---

## 4. Server-side enforcement strategy

The UI gate is **insufficient** — a malicious actor with a valid auth token can call `PATCH /api/cases/[id]/status` directly and bypass the UI entirely. B.2.1 ships **server-side enforcement** in commit 12 (the merge-point of the B.2.1 chain).

### 4.1 Enforcement point

**Route:** `src/app/api/cases/[id]/status/route.ts` (extends the existing route shipped in 6.1 B.1.3)

**Logic (inserted between transition validation and `updateCaseStatus`):**

```ts
// Pseudocode — final implementation lives in the route handler
import { isFlagEnabled } from '@/lib/feature-flags';
import { evaluatePreProcedureChecklist, isGatedTransition } from '@/lib/checklist';

if (isFlagEnabled('CHECKLIST_GATE') && isGatedTransition(newStatus)) {
  const { allPassed, items } = await evaluatePreProcedureChecklist(params.id);

  if (!allPassed) {
    const failedKeys = items.filter(i => i.required && !i.passed).map(i => i.key);

    // Audit-log the blocked attempt for visibility
    await writeAuditLog({
      actorId: user.uid,
      actorName: user.displayName,
      actorRole: user.role,
      action: 'case_status_blocked_by_checklist',
      entityType: 'case',
      entityId: params.id,
      before: { status: existing.status },
      after: { status: newStatus, attempted: true },
      metadata: { failedItems: failedKeys, gateFlag: 'CHECKLIST_GATE' },
    });

    return NextResponse.json(
      {
        error: 'Vui lòng hoàn thành toàn bộ checklist trước khi chuyển trạng thái',
        code: 'CHECKLIST_GATE_BLOCKED',
        failedItems: failedKeys,
      },
      { status: 400 },
    );
  }
}
```

### 4.2 Defense in depth (4 layers)

| Layer | Where | What it catches |
|---|---|---|
| **L1 — UI gate** | `StatusWorkflow` (commit 11) | Honest user clicks a button; gate prevents accidental transition |
| **L2 — Client pre-flight** | `cases/[id]/page.tsx` `onTransition` callback | If user bypasses UI gate (e.g., DevTools), client re-checks before fetch |
| **L3 — Server gate** | `PATCH /api/cases/[id]/status` (commit 12) | Authenticated user with valid token calls API directly |
| **L4 — Audit log** | `writeAuditLog` with `action: 'case_status_blocked_by_checklist'` | Any L1/L2/L3 block leaves a trail for incident review |

### 4.3 Error response contract

| HTTP code | When | Body |
|---|---|---|
| 200 | Transition allowed | `{ success: true }` |
| **400** | **Gate blocked (L3)** | `{ error: '...', code: 'CHECKLIST_GATE_BLOCKED', failedItems: [...] }` |
| 400 | Invalid transition (existing) | `{ error: 'Không thể chuyển trạng thái...' }` |
| 403 | Role not in `CASE_STATUS_CHANGE_ROLES` (existing 6.1 B.1.3) | `{ error: '...' }` |
| 404 | Case not found | `{ error: '...' }` |

The client surfaces the `failedItems` array in a toast: "Không thể chuyển trạng thái: thiếu [blood_test_result, pregnancy_test_done]". This mirrors the L1 red banner copy.

### 4.4 Race conditions

**Scenario:** two doctors open the same case simultaneously. Doctor A completes item X, clicks "Chuyển sang checked_in". Doctor B clicks the same button at the same time. Both requests hit the server.

**Mitigation:** Firestore transaction. The server-side gate reads `evaluatePreProcedureChecklist()` *inside* the same transaction as `updateCaseStatus()`, so the check is consistent with the write. If a stale read returns `allPassed === true` but a concurrent write has invalidated it, the second writer gets the gate block.

For B.2.1 v1, we accept the lighter approach: read-then-write outside a transaction. The race window is small (typical transition is 1–2s, both doctors must click within milliseconds). Sprint 7.x can harden with a transaction if the race is observed in production.

### 4.5 Audit log entries

Every gate-blocked transition writes one audit log entry with `action: 'case_status_blocked_by_checklist'`. The `metadata.failedItems` array tells the incident reviewer which items were incomplete. This is searchable via the existing `/audit-logs` page filter.

### 4.6 What server does NOT do

- Does **not** write to the case record on block (no partial state, no "pending" sub-status).
- Does **not** enqueue any side-effects (no followups, no tasks, no notifications) on block.
- Does **not** retry. The user must fix the checklist and re-submit.

---

## 5. UI warning strategy

The UI uses **3 progressively stronger signals** so a user can self-correct before hitting a server-side block. The signals are tuned for the high-pressure context described in `UX_DECISION_DOCUMENT.md` (mobile, time-pressured, often non-clinical staff).

### 5.1 Signal 1 — `ChecklistPanel` summary badge (always visible)

Existing badge in `ChecklistPanel` (lines 90–100) shows `Đạt yêu cầu` (green) or `Chưa đạt (N/M)` (amber). When B.2.1 ships, the amber badge text upgrades to show the *number of incomplete clinical items* explicitly:

- Before B.2.1: `Chưa đạt (8/12)` — generic
- After B.2.1: `Chưa đạt (8/12) — 3 mục lâm sàng còn thiếu` — actionable

Implementation: count items where `key ∈ {blood_test_result, allergy_declared, pregnancy_test_done, anesthesia_review_complete, fasting_compliant, treatment_consent_signed}` AND `!passed`. Surface this as a secondary line in the badge.

### 5.2 Signal 2 — `StatusWorkflow` red banner (gated only)

When `FEATURE_CHECKLIST_GATE` is ON, `allPassed === false`, AND the user views a case in a source state (`reminder_sent`, `checked_in`, `waiting_doctor_review`, `lab_test_done`) that has a gated target, a **red banner** appears above the transition buttons:

```
┌──────────────────────────────────────────────────────────────────┐
│ ⚠ Ca chưa sẵn sàng — vui lòng hoàn thành toàn bộ checklist      │
│   trước khi chuyển trạng thái.                                   │
│   Thiếu: xét nghiệm máu, đã ký cam kết điều trị.                │
│   [Mở checklist]                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Implementation notes:**
- Banner uses `role="alert"` for screen readers.
- "Mở checklist" CTA scrolls to the `ChecklistPanel` section (no dead link — per anti-pattern A8).
- Color: `bg-red-50` + `border-red-200` + `text-red-700`, matching the existing "Bắt buộc" warning style.
- Dismissal: not dismissible. Persists until `allPassed === true` or the user navigates away.

### 5.3 Signal 3 — Disabled transition buttons (gated only)

The 3 transition buttons affected (`→ checked_in`, `→ in_procedure`, `→ medically_approved`) become `disabled` when `allPassed === false`. Visual treatment:

- Reduced opacity (`opacity-50`)
- `cursor-not-allowed`
- Tooltip on hover (desktop only): "Hoàn thành checklist trước khi chuyển trạng thái"
- Tooltip on focus (a11y): same text, rendered via `aria-describedby`

**Note on `disabled` vs `hidden`:** buttons stay visible (not hidden) so the user sees the *intended next step* and understands what is blocking them. This is a deliberate UX choice over hiding the path entirely.

### 5.4 Toast on server-side block (defense in depth)

If a client somehow bypasses L1/L2 (e.g., race condition, stale React state, malicious user), the server returns 400 with `failedItems`. The client's `onTransition` catch-block fires a toast:

> ❌ **Không thể chuyển trạng thái**
> Thiếu: xét nghiệm máu, đã ký cam kết điều trị.

This is the same copy as the L1 banner so the user recognizes the issue immediately. Toast uses `variant="error"` and auto-dismisses after 8 seconds.

### 5.5 Anti-pattern guardrails (per `DESIGN_DIRECTION §18`)

- **A8 (dead links)**: "Mở checklist" must scroll, not navigate to a dead URL. Verified by integration test.
- **A11 (PII in audit)**: not applicable to B.2.1 UI (no PII surfaces), but adjacent B.2.3 ships in the same sprint.
- **A12 (skipped clinical gates)**: B.2.1 IS the fix for A12. Test: a case with `allPassed=false` cannot transition to `procedure_completed` via UI or API.

### 5.6 Mobile UX (per `UX_DECISION_DOCUMENT.md`)

- Banner is full-width on `< sm` viewports (no truncation).
- "Mở checklist" CTA is a full-width button on mobile (≥ 44px touch target).
- Toast positions bottom-center on mobile (above the bottom nav, if present).
- Checklist item list uses `min-h-[44px]` per row for thumb-tap ergonomics.

---

## 6. Files affected

### 6.1 Files to CREATE (4 files)

| Path | Story | Purpose |
|---|---|---|
| `src/lib/checklist/__tests__/evaluate.test.ts` | B.2.1 | Unit tests: `allPassed` derivation incl. 6 new items + N/A handling + edge cases |
| `src/components/checklist/__tests__/checklist-panel.test.tsx` | B.2.1 | Render test: 6 new items visible when `FEATURE_CLINICAL_CHECKLIST` ON; hidden when OFF; summary badge update |
| `src/components/cases/__tests__/status-workflow-gate.test.tsx` | B.2.1 | Gate test: `allPassed=false` disables 3 transition buttons; red banner shows; flag OFF bypasses (regression) |
| `src/app/api/cases/[id]/status/__tests__/route.test.ts` (extend existing) | B.2.1 | Server test: 400 on `allPassed=false` + gated transition + flag ON; 200 when flag OFF; audit log entry written |

### 6.2 Files to MODIFY (8 files)

**Types & domain logic:**

- `src/lib/types/case.ts` — add 6 optional fields to `CaseRecord`: `bloodTestResult?`, `allergyDeclared?`, `pregnancyTestDone?`, `anesthesiaReviewComplete?`, `fastingCompliant?`, `treatmentConsentSigned?`. All optional for backward-compat.
- `src/lib/checklist/evaluatePreProcedureChecklist.ts` — extend `ChecklistItem` union with 6 new items; recompute `allPassed` to include them; export `ChecklistItemId` type-safe enum; export `GATED_TRANSITIONS` and `isGatedTransition()` helper.
- `src/lib/checklist/index.ts` (re-export barrel) — add new exports.

**UI components:**

- `src/components/checklist/checklist-panel.tsx` — render 6 new clinical items in pre-procedure list; show "X mục lâm sàng còn thiếu" subline in amber badge; feature-flag `FEATURE_CLINICAL_CHECKLIST` controls visibility.
- `src/components/cases/status-workflow.tsx` — accept `allPassed` prop; when `FEATURE_CHECKLIST_GATE` ON and `allPassed === false`, disable transition buttons for the 3 gated targets; show red banner above buttons (per §5.2).
- `src/app/(protected)/cases/[id]/page.tsx` — load `allPassed` from `evaluatePreProcedureChecklist()`; pass to `StatusWorkflow`; render confirmation dialog state (no change here — gate integrates with existing dialog); render checklist section with `FEATURE_CLINICAL_CHECKLIST` guard (no change — already rendered).

**API route:**

- `src/app/api/cases/[id]/status/route.ts` — extend with server-side gate (per §4.1); audit log on block.

**Feature flags:**

- `src/lib/feature-flags.ts` — add `CHECKLIST_GATE` and `CLINICAL_CHECKLIST` to the `FeatureFlag` union.
- `.env.local` — add 2 new env vars (both default `false` in production).

### 6.3 Anti-pattern scan (B.2.1 specific)

| A-# | Anti-pattern | B.2.1 guard |
|---|---|---|
| **A6** | Hidden-only permissions | **Server gate exists** (commit 12) — UI gate is not the only enforcement. Anti-pattern grep: `isFlagEnabled('CHECKLIST_GATE')` must appear in BOTH `status-workflow.tsx` AND `route.ts`. |
| **A8** | Dead links | "Mở checklist" CTA must use `scrollIntoView({ behavior: 'smooth' })` not `<a href="/checklist">`. Test verifies scroll, not navigation. |
| **A12** | Skipped clinical gates | B.2.1 IS the fix. Test: 3 gated transitions × `allPassed=false` × flag ON = 3 × blocked; same × flag OFF = 3 × allowed. |

### 6.4 Files EXPLICITLY not touched

- `src/constants/case-status.ts` — `CASE_STATUS_TRANSITIONS` stays as-is. B.2.1 gates in code, not in the transition matrix.
- `src/components/ui/confirm-dialog.tsx` — already supports `warning` variant (B.2.4 ships in same sprint).
- `src/lib/firestore/cases.ts` — no changes to read/write paths; only `updateCaseStatus()` is called from the gated route.
- `src/lib/notifications/trigger.ts` — no new triggers from B.2.1 (gate block does not notify).
- `src/lib/validators/case.ts` — `actualProcedureDate` server requirement is Sprint 7.3 (C.3.2). B.2.1 does not touch validators.

---

## 7. Test matrix

B.2.1 uses **all 10 test layers** per `UI_REFACTOR_PLAN.md` §5.1. Coverage target: **≥ 24 new test cases** across 4 new/extended test files.

### 7.1 Layer-by-layer test plan

| Layer | Test file | Cases | Risk covered |
|---|---|---|---|
| 1. Functional unit | `src/lib/checklist/__tests__/evaluate.test.ts` | 8 | `allPassed` correctness |
| 2. Validation | (covered in L1) | — | — |
| 3. Workflow state machine | `src/lib/checklist/__tests__/evaluate.test.ts` | 3 | All 3 gated transitions |
| 4. Permission matrix | `src/components/cases/__tests__/status-workflow-gate.test.tsx` | 4 | Flag × allPassed × button state |
| 5. Security | `src/app/api/cases/[id]/status/__tests__/route.test.ts` | 3 | Bypass attempts, audit log |
| 6. Integration | `src/app/api/cases/[id]/status/__tests__/route.test.ts` | 4 | Real API + Firestore mocks |
| 7. Performance | manual Lighthouse | 1 | Case detail < 300ms with new items |
| 8. Data integrity | `src/lib/checklist/__tests__/evaluate.test.ts` | 2 | Determinism + idempotency |
| 9. Mobile/responsive | Playwright (qa-architect) | 3 | 360 / 768 / 1280 px |
| 10. Regression | Playwright snapshot | 2 | Baseline visual diff |

### 7.2 Detailed test cases

#### 7.2.1 `src/lib/checklist/__tests__/evaluate.test.ts` (8 cases)

| # | Case name | Input | Expected |
|---|---|---|---|
| 1 | `allPassed=true when all 12 items pass` | Full case with all 12 items answered `true` | `allPassed === true` |
| 2 | `allPassed=false when 1 clinical item missing` | 11 items pass, `blood_test_result` undefined | `allPassed === false`; `failedItems` includes `blood_test_result` |
| 3 | `allPassed=true when pregnancy N/A for male patient` | All items pass except `pregnancy_test_done === 'not_applicable'` | `allPassed === true` |
| 4 | `allPassed=true when blood test N/A for filler` | All items pass except `blood_test_result === 'not_applicable'` | `allPassed === true` |
| 5 | `treatment consent revoked flips allPassed to false` | `treatmentConsent.granted` → revoked | `allPassed === false` |
| 6 | `historical case without new fields defaults to false` | Case record predates schema (no new fields) | `allPassed === false` (fail-closed) |
| 7 | `pure function: same input → same output` | Call twice with same input | Identical `allPassed` and items |
| 8 | `isGatedTransition returns true for exactly 3 statuses` | `checked_in`, `in_procedure`, `medically_approved` | Returns `true`; all others `false` |

#### 7.2.2 `src/components/checklist/__tests__/checklist-panel.test.tsx` (5 cases)

| # | Case name | Setup | Expected |
|---|---|---|---|
| 1 | `renders 6 clinical items when FEATURE_CLINICAL_CHECKLIST ON` | Mock flag ON | All 6 item keys present in DOM |
| 2 | `hides 6 items when FEATURE_CLINICAL_CHECKLIST OFF` | Mock flag OFF | Pre-existing 6 items only |
| 3 | `badge shows clinical incomplete count` | 3 of 6 clinical items pass | Badge text includes "3 mục lâm sàng còn thiếu" |
| 4 | `badge shows passed state when all clinical complete` | All 6 clinical items pass, others may fail | "Đạt yêu cầu" green badge |
| 5 | `aria-live region announces gate state change` | Toggle `allPassed` via rerender | Screen reader text updates |

#### 7.2.3 `src/components/cases/__tests__/status-workflow-gate.test.tsx` (4 cases)

| # | Case name | Setup | Expected |
|---|---|---|---|
| 1 | `allPassed=false disables 3 gated transitions` | `currentStatus = 'reminder_sent'`, `allPassed=false`, flag ON | Buttons `→ checked_in` is `disabled`; red banner visible |
| 2 | `allPassed=true enables all transitions` | `allPassed=true`, flag ON | All buttons enabled; banner hidden |
| 3 | `flag OFF bypasses gate (regression)` | `allPassed=false`, flag OFF | Buttons enabled; banner hidden; behavior identical to pre-B.2.1 |
| 4 | `non-gated transitions not affected` | `currentStatus = 'scheduled'`, `allPassed=false`, flag ON | Button `→ reminder_sent` enabled (not in gated set) |

#### 7.2.4 `src/app/api/cases/[id]/status/__tests__/route.test.ts` — extend existing (4 new cases)

| # | Case name | Setup | Expected |
|---|---|---|---|
| 1 | `400 when allPassed=false AND newStatus=checked_in AND flag ON` | Mock flag ON, evaluator returns false | 400, `code: 'CHECKLIST_GATE_BLOCKED'`, `failedItems` populated |
| 2 | `200 when allPassed=false AND flag OFF (regression)` | Mock flag OFF | 200, transition proceeds |
| 3 | `audit log written on gate block` | Mock `writeAuditLog` | Called once with `action: 'case_status_blocked_by_checklist'`, `metadata.failedItems` populated |
| 4 | `no followups created on gate block` | Block at `in_procedure` | `createPostOpFollowups` NOT called |

### 7.3 Manual smoke checklist (B.2.1 only)

The 5 manual smoke steps from Sprint 6.2 §8.3 are scoped to B.2.1 here:

1. **Checklist visibility** — open case detail; verify 6 new items render when `FEATURE_CLINICAL_CHECKLIST=true`; hide when OFF.
2. **All-pass flow** — check all 12 items; click `→ checked_in`; verify transition succeeds; verify badge is green.
3. **Gate-block flow** — uncheck 1 item; verify `→ checked_in` button is disabled; verify red banner shows the missing item names; verify "Mở checklist" CTA scrolls to the checklist section.
4. **Bypass attempt** — open DevTools; manually call `fetch('/api/cases/[id]/status', { method: 'PATCH', body: JSON.stringify({ status: 'checked_in' }) })` with valid auth cookie; verify 400 with `code: 'CHECKLIST_GATE_BLOCKED'`; verify toast appears; verify audit log entry visible in `/audit-logs`.
5. **N/A edge case** — open case with male patient; mark `pregnancy_test_done = not_applicable`; verify badge counts it as passed; verify gate allows transition.
6. **Flag OFF regression** — set `FEATURE_CHECKLIST_GATE=false`; repeat steps 2–3; verify gate is bypassed (regression coverage).
7. **Mobile** — open case detail on 360px viewport; verify banner is full-width and readable; verify buttons remain ≥ 44px tall; verify no horizontal scroll.

### 7.4 Build & lint gates

```
npx tsc --noEmit                  # → 0 errors
npm run lint                      # → 0 warnings
npm run build                     # → 34 routes, 0 errors
npm run test                      # → all green (259 baseline + ~24 new)
```

### 7.5 Anti-pattern grep checks

```bash
# A6 — gate must be in BOTH UI and server
grep -rE "isFlagEnabled\(['\"]CHECKLIST_GATE['\"]\)" src/
# Expected: at least 2 matches (status-workflow.tsx + route.ts)

# A8 — "Mở checklist" CTA must scroll, not navigate
grep -rE 'href=["\x27]/checklist' src/
# Expected: 0 matches (dead link)

# A12 — gate logic centralized in evaluatePreProcedureChecklist.ts
grep -rE "allPassed\s*=" src/
# Expected: only in src/lib/checklist/evaluatePreProcedureChecklist.ts and test files

# Forbidden: no native confirm/alert
grep -rE "window\.(confirm|alert)" src/ | grep -v __tests__/
# Expected: 0 matches
```

---

## 8. Rollback strategy

B.2.1 has **3 rollback tiers** — flag-only (lightest), single-commit revert, and whole-sprint revert. All are designed to leave zero data corruption.

### 8.1 Tier 1 — Flag-only rollback (lightest touch)

For both flags, setting to `false` in `.env.local` and restarting the dev server is **sufficient** — the legacy code path remains in the bundle. No git revert needed.

```bash
# In .env.local
NEXT_PUBLIC_FEATURE_CHECKLIST_GATE=false
NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST=false

# Restart dev server
npm run dev
```

**Time:** < 5 minutes
**Data impact:** None
**Use case:** gate is over-blocking in production; medical director requests immediate relaxation while fix is in flight.

### 8.2 Tier 2 — Per-commit revert

| Commit | Revert action | Time | Data impact |
|---|---|---|---|
| #9 (allPassed derivation) | `git revert <sha>` | < 10 min | None — pre-procedure checklist reverts to 6 items |
| #10 (panel render) | `git revert <sha>` | < 10 min | None |
| #11 (UI gate) | `git revert <sha>` + set flag OFF | < 15 min | None |
| #12 (server gate) | `git revert <sha>` + set flag OFF | < 15 min | None — note: revert after some prod traffic means audit logs have `case_status_blocked_by_checklist` entries; these are historical and harmless |

**Use case:** a bug in one specific commit is discovered; partial rollback preserves the rest of the chain.

### 8.3 Tier 3 — Whole-sprint revert (catastrophic)

```bash
# Revert the sprint-6.2 merge on main
git revert -m 1 <sprint-6.2-merge-sha>

# Set all 5 flags to false (2 new + 3 carry-over from 6.1)
sed -i 's/NEXT_PUBLIC_FEATURE_CHECKLIST_GATE=.*/NEXT_PUBLIC_FEATURE_CHECKLIST_GATE=false/' .env.local
sed -i 's/NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST=.*/NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST=false/' .env.local
sed -i 's/NEXT_PUBLIC_FEATURE_SHARED_MENU=.*/NEXT_PUBLIC_FEATURE_SHARED_MENU=false/' .env.local
sed -i 's/NEXT_PUBLIC_FEATURE_SERVER_RBAC=.*/NEXT_PUBLIC_FEATURE_SERVER_RBAC=false/' .env.local
sed -i 's/NEXT_PUBLIC_FEATURE_PAYMENT_SOD=.*/NEXT_PUBLIC_FEATURE_PAYMENT_SOD=false/' .env.local

# Re-run regression
npm run lint && npx tsc --noEmit && npm run build && npm run test -- --run
```

**Time:** < 15 minutes
**Data impact:** None — all B.2.1 changes are additive (no schema removals, no enum removals, no permission removals).
**Use case:** multiple stories in 6.2 cause production issues; whole-sprint revert is the safest recovery.

### 8.4 Data migrations

| Migration | Type | Backward-compat | Rollback |
|---|---|---|---|
| Add 6 optional fields to `CaseRecord` | Schema extension | ✅ All optional, no backfill | Drop fields |
| Add 2 flags to `.env.local` | Env var | ✅ Default OFF, no impact when unset | Unset env var |
| Server-side gate in `route.ts` | Behavior change | ✅ Opt-in via flag | Remove gate block; legacy behavior resumes |
| `GATED_TRANSITIONS` export | New constant | ✅ No callers until commit 11/12 | Delete export |

All migrations are **additive only**. No field is ever destroyed. No transition is removed. No permission is revoked.

### 8.5 Rollback drill

Before promoting either flag in production, conduct a 1-hour rollback drill on staging:

1. Tag `release/v6.2.0-b2.1-rc1` on `phase-6/sprint-6.2`
2. Revert commit 11 (UI gate) in a sandbox
3. Verify `npx tsc --noEmit` + `npm run test` + `npm run build` green
4. Manually smoke 3 routes: `/cases/[id]`, `/dashboard`, `/audit-logs`
5. Re-apply commit 11; revert commit 12 (server gate); repeat smoke
6. Document drill outcome in `STORY_B2_1_IMPLEMENTATION_REPORT.md`

---

## 9. Manual QA checklist

The QA architect runs this checklist on staging before any flag promotion. Each checkbox is **mechanically verifiable** and produces evidence (screenshot, video, log) attached to the implementation report.

### 9.1 Pre-flight

- [ ] All commits #9–12 are merged into `phase-6/sprint-6.2`
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run test` all green
- [ ] `.env.local` has `NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST=true` and `NEXT_PUBLIC_FEATURE_CHECKLIST_GATE=true`
- [ ] Dev server running; staging deployed to a known URL

### 9.2 Visual + functional checks

- [ ] **9.2.1** Open any case in `reminder_sent` status. Verify 6 new items render in the pre-procedure checklist.
- [ ] **9.2.2** Verify all 6 item labels match the medical director's sign-off doc (exact Vietnamese text).
- [ ] **9.2.3** Verify the summary badge shows "X mục lâm sàng còn thiếu" when applicable.
- [ ] **9.2.4** With `allPassed=false`, verify `→ checked_in` button is visually disabled (opacity-50, cursor-not-allowed).
- [ ] **9.2.5** Verify red banner appears above the transition buttons with the expected copy.
- [ ] **9.2.6** Click "Mở checklist" CTA — verify it scrolls smoothly to the checklist section (no dead link, no navigation).
- [ ] **9.2.7** Hover over disabled button on desktop — verify tooltip "Hoàn thành checklist trước khi chuyển trạng thái".
- [ ] **9.2.8** Complete all 12 items — verify badge turns green, banner disappears, button becomes enabled.
- [ ] **9.2.9** Click `→ checked_in` — verify transition succeeds; verify `case.status === 'checked_in'` in the DB.
- [ ] **9.2.10** Repeat for `checked_in → in_procedure` and `waiting_doctor_review / lab_test_done → medically_approved`.

### 9.3 N/A edge cases

- [ ] **9.3.1** Open a case with male patient. Mark `pregnancy_test_done = not_applicable`. Verify gate allows transition (item counts as passed).
- [ ] **9.3.2** Open a case for filler injection (no anesthesia). Mark `anesthesia_review_complete = not_applicable` and `blood_test_result = not_applicable`. Verify gate allows transition.
- [ ] **9.3.3** Revoke the treatment consent AFTER granting. Verify `allPassed` flips to `false`; verify gate engages on next transition attempt.

### 9.4 Server-side enforcement

- [ ] **9.4.1** Open DevTools. Manually call `PATCH /api/cases/[id]/status` with `{ status: 'checked_in' }` and a valid auth cookie. Verify 400 response with `code: 'CHECKLIST_GATE_BLOCKED'`.
- [ ] **9.4.2** Verify toast appears on the page with the failed items list.
- [ ] **9.4.3** Open `/audit-logs`. Verify a new entry with `action: 'case_status_blocked_by_checklist'`, `metadata.failedItems` populated.
- [ ] **9.4.4** Set `FEATURE_CHECKLIST_GATE=false`. Repeat 9.4.1. Verify 200 response, transition succeeds (regression).

### 9.5 Flag interaction

- [ ] **9.5.1** `FEATURE_CLINICAL_CHECKLIST=false` + `FEATURE_CHECKLIST_GATE=true`. Verify console warning is logged on case detail page. Verify server still gates based on legacy 6 items only.
- [ ] **9.5.2** `FEATURE_CLINICAL_CHECKLIST=true` + `FEATURE_CHECKLIST_GATE=false`. Verify 6 items render; gate does not enforce (training mode).
- [ ] **9.5.3** Both OFF. Verify behavior identical to pre-B.2.1 (regression baseline).

### 9.6 Mobile / responsive

- [ ] **9.6.1** Open case detail on 360px viewport. Verify banner is full-width and readable.
- [ ] **9.6.2** Verify all touch targets ≥ 44px height (buttons, checkboxes).
- [ ] **9.6.3** Verify no horizontal scroll on the checklist panel.
- [ ] **9.6.4** Verify toast positions correctly above any bottom UI (e.g., mobile nav).

### 9.7 Performance

- [ ] **9.7.1** Lighthouse audit on case detail page. Verify FCP < 1.5s, TTI < 3s.
- [ ] **9.7.2** Verify case detail renders in < 300ms with all 12 checklist items (manual stopwatch on dev).

### 9.8 Accessibility

- [ ] **9.8.1** axe-core scan on case detail page → 0 critical issues.
- [ ] **9.8.2** Verify red banner has `role="alert"` and `aria-live="polite"`.
- [ ] **9.8.3** Verify disabled buttons have `aria-describedby` pointing to the reason.
- [ ] **9.8.4** Tab through the checklist — verify focus order is logical (header → items → transition buttons).
- [ ] **9.8.5** Screen reader test (NVDA or VoiceOver) — verify the gate state is announced when the page loads.

### 9.9 Cross-role

- [ ] **9.9.1** Log in as `admin` — verify all transitions visible (per role permissions, not gate).
- [ ] **9.9.2** Log in as `coordinator` — verify can transition through the gated states (gate applies).
- [ ] **9.9.3** Log in as `sales_online` — verify cannot transition (6.1 B.1.3 still blocks; gate is moot).
- [ ] **9.9.4** Log in as `doctor` — verify can transition with `allPassed=true`; cannot with `allPassed=false`.

---

## 10. Medical sign-off checklist

This is the **clinical correctness gate** for B.2.1. The story **cannot merge to `main`** without all checkboxes signed by the named signatory. Sprint 6.2 §7.1 contains the original checklist; this is the B.2.1-focused expansion.

### 10.1 Pre-sign-off prerequisites

- [ ] **10.1.1** All 4 commits #9–12 merged into `phase-6/sprint-6.2`
- [ ] **10.1.2** All 24+ new tests green; build/lint/typecheck green
- [ ] **10.1.3** Manual QA checklist §9 completed by QA architect with screenshots attached
- [ ] **10.1.4** 3 historical cases identified for dry-run (medical-workflow-expert to coordinate)
- [ ] **10.1.5** Both flags ON in staging

### 10.2 Clinical correctness

- [ ] **10.2.1** Medical director confirms the 6 clinical items are the **correct complete set** for pre-procedure readiness in the Swan Clinic context.
  - Sign-off: Medical Director
  - Evidence: signed checklist attached to `STORY_B2_1_IMPLEMENTATION_REPORT.md`
- [ ] **10.2.2** Medical director confirms the 6 item labels in Vietnamese are clinically accurate (no machine-translated strings).
  - Sign-off: Medical Director + UX Designer
  - Evidence: copy review annotation in PR description for commit #10
- [ ] **10.2.3** Medical director confirms the N/A short-circuit logic (pregnancy for male, blood test for filler) is clinically safe.
  - Sign-off: Medical Director
- [ ] **10.2.4** Medical director confirms the 3 gated transitions (`checked_in`, `in_procedure`, `medically_approved`) are the **correct set** — neither too few (under-block risk) nor too many (over-block risk).
  - Sign-off: Medical Director
- [ ] **10.2.5** Medical director confirms the red banner copy ("Vui lòng hoàn thành toàn bộ checklist trước khi chuyển trạng thái") is clinically accurate and not alarming.
  - Sign-off: Medical Director + UX Designer
- [ ] **10.2.6** Medical director confirms the treatment consent revocation path (consent granted → revoked → gate engages) is acceptable as a safety mechanism.
  - Sign-off: Medical Director

### 10.3 Dry-run (mandatory before flag promotion)

- [ ] **10.3.1** **Case A — full pass**: case with all 12 items answered `true`. Walk through the gate with medical director. Verify gate allows all 3 target transitions. Capture: video, audit log entries.
- [ ] **10.3.2** **Case B — partial fail**: case with 11 items answered, 1 missing. Walk through the gate. Verify the 3 buttons are disabled; verify the red banner names the missing item. Capture: screenshots.
- [ ] **10.3.3** **Case C — N/A edge case**: case with `pregnancy_test_done = not_applicable` for male patient. Walk through. Verify gate allows transition despite pregnancy being undefined. Capture: video.
- [ ] **10.3.4** **Bypass attempt**: from the UI, attempt to call `PATCH /api/cases/[id]/status` directly. Verify 400 + audit log. Capture: network panel screenshot + `/audit-logs` entry.
- [ ] **10.3.5** Medical director signs the dry-run report (separate file or section in `STORY_B2_1_IMPLEMENTATION_REPORT.md`).

### 10.4 Override / escape hatch

- [ ] **10.4.1** **Acknowledged: no override path in B.2.1 v1.** If a doctor needs to bypass the gate in an emergency, the only path is to complete the missing checklist item. Sprint 7.x (C.5.x) may add an explicit override endpoint with audit log + reason field.
  - Sign-off: Medical Workflow Expert + Tech Lead (acknowledgment, not approval)
- [ ] **10.4.2** **Documented escalation path**: if a coordinator is stuck (e.g., blood test result not yet uploaded by lab), the escalation is to call the lab → upload to attachments → mark checklist item. This is operational, not technical.
  - Sign-off: Medical Workflow Expert

### 10.5 Cross-cutting safety

- [ ] **10.5.1** No new patient data is destroyed. All 6 new fields are additive optional.
  - Sign-off: Tech Lead
- [ ] **10.5.2** Audit log entry for every gate block is written (verified via dry-run case 10.3.4).
  - Sign-off: Tech Lead
- [ ] **10.5.3** Mobile UX verified (QA §9.6 above).
  - Sign-off: UX Designer + QA Architect
- [ ] **10.5.4** No PII surfaces in the gate UI (the items themselves are boolean, no free-text values).
  - Sign-off: Data Privacy Expert

### 10.6 Sign-off chain (in order)

```
Tech Lead (build/lint/tests/anti-patterns)
   ↓
QA Architect (test strategy + manual QA checklist)
   ↓
Medical Workflow Expert (clinical correctness + dry-run + N/A logic)
   ↓
Medical Director (final clinical sign-off — non-negotiable)
   ↓
Data Privacy Expert (PII check on banner/toast copy)
   ↓
UX Designer (Vietnamese copy + mobile)
   ↓
Release Manager (flag inventory + rollback verified)
   ↓
CEO + Product Owner (final go/no-go for production flag promotion)
```

---

## 11. Recommended commit sequence

B.2.1 ships as **4 sequential commits** (commits #9–12 in Sprint 6.2 §3.3), plus the **prerequisite** RR-2 reconciliation (commit #1 in the parent plan) that must land first. Total: **5 commits**.

### 11.1 Dependency graph

```
RR-2 (commit #1)
   └─→ B.2.1 commit #9 (derive)
         └─→ B.2.1 commit #10 (render)
               └─→ B.2.1 commit #11 (UI gate)
                     └─→ B.2.1 commit #12 (server gate)
```

The chain is **strictly sequential** within B.2.1 — no parallelization. The reason: each commit builds on the previous one's exported API (`ChecklistItemId`, `evaluatePreProcedureChecklist` returning extended shape, `StatusWorkflow` accepting `allPassed` prop, route handler reading evaluator).

### 11.2 Commit-by-commit details

#### Commit #1 (PREREQUISITE) — RR-2 reconcile

```
chore(permissions): reconcile CASE_STATUS_CHANGE_ROLES (drop nurse, cskh_postop)
```

- **Files:** `src/constants/permissions.ts`, `src/constants/__tests__/permissions.test.ts` (new)
- **LOC:** ~30
- **Risk:** 🟢
- **Owner:** FE-1
- **Why first:** B.2.1's server gate (commit #12) calls `requirePermission('cases:write')` and reads `CASE_STATUS_CHANGE_ROLES`. The dead-role bug from Sprint 6.1 RR-2 contaminates the gate math. Fixing first is a 1-line change with its own invariant test.
- **Sign-off:** Tech Lead only.

#### Commit #9 — derive

```
feat(checklist): add 6 clinical items + allPassed derivation
```

- **Files:**
  - `src/lib/types/case.ts` (add 6 optional fields)
  - `src/lib/checklist/evaluatePreProcedureChecklist.ts` (extend evaluator)
  - `src/lib/checklist/__tests__/evaluate.test.ts` (new — 8 test cases)
- **LOC:** ~120
- **Risk:** 🟡
- **Owner:** FE-2
- **What it ships:**
  - `bloodTestResult?`, `allergyDeclared?`, `pregnancyTestDone?`, `anesthesiaReviewComplete?`, `fastingCompliant?`, `treatmentConsentSigned?` on `CaseRecord`
  - 6 new `ChecklistItem` entries in `evaluatePreProcedureChecklist`
  - N/A value handling (`value === 'not_applicable' → passed === true`)
  - Treatment consent revocation path
  - `GATED_TRANSITIONS` + `isGatedTransition()` exports
- **NOT in this commit:** no UI changes, no API changes. The new items are computed but not yet rendered.
- **Verification:** `npm run test -- evaluate` green; tsc + lint green.
- **Sign-off:** Paired review (FE-1 + tech-lead). No medical sign-off yet — clinical correctness is in commit #10.

#### Commit #10 — render

```
feat(checklist): render 6 clinical items in ChecklistPanel (behind FEATURE_CLINICAL_CHECKLIST)
```

- **Files:**
  - `src/lib/feature-flags.ts` (add `CLINICAL_CHECKLIST` to union)
  - `.env.local` (add env var, default `false` in prod comment)
  - `src/components/checklist/checklist-panel.tsx` (render 6 new items + badge subline)
  - `src/components/checklist/__tests__/checklist-panel.test.tsx` (new — 5 test cases)
- **LOC:** ~140
- **Risk:** 🟡
- **Owner:** FE-2
- **What it ships:**
  - `FEATURE_CLINICAL_CHECKLIST` flag
  - 6 new items render in the pre-procedure checklist section when flag ON
  - "X mục lâm sàng còn thiếu" subline in amber badge
  - When flag OFF, checklist looks identical to pre-B.2.1
- **NOT in this commit:** no gate logic, no transitions blocked.
- **Verification:** visual smoke on a real case; flag toggle works; tsc + lint green.
- **Sign-off:** Paired review (FE-1 + medical-workflow-expert) — **medical-workflow-expert verifies clinical copy and N/A UX.**

#### Commit #11 — UI gate

```
feat(cases): gate StatusWorkflow on allPassed (behind FEATURE_CHECKLIST_GATE)
```

- **Files:**
  - `src/lib/feature-flags.ts` (add `CHECKLIST_GATE` to union)
  - `.env.local` (add env var)
  - `src/components/cases/status-workflow.tsx` (accept `allPassed`; render red banner; disable 3 buttons)
  - `src/app/(protected)/cases/[id]/page.tsx` (load `allPassed`; pass to StatusWorkflow)
  - `src/components/cases/__tests__/status-workflow-gate.test.tsx` (new — 4 test cases)
- **LOC:** ~160
- **Risk:** 🔴
- **Owner:** FE-2
- **What it ships:**
  - `FEATURE_CHECKLIST_GATE` flag
  - Red banner above transition buttons when `allPassed=false` AND flag ON
  - 3 gated buttons disabled with tooltip
  - "Mở checklist" CTA with scroll behavior
- **NOT in this commit:** no server enforcement. UI gate can be bypassed via direct API call.
- **Verification:**
  - Manual smoke: case with `allPassed=false` cannot transition via UI
  - Bypass smoke: `fetch('/api/cases/[id]/status', ...)` succeeds (gate NOT yet enforced server-side) — this is **expected** at this commit
  - Flag OFF regression: behavior identical to pre-B.2.1
- **Sign-off:** Paired review (FE-1 + medical-workflow-expert) + **medical director reviews the banner copy and the "X mục lâm sàng còn thiếu" wording.**

#### Commit #12 — server gate (the merge point)

```
feat(api): server-side enforcement of checklist gate (behind FEATURE_CHECKLIST_GATE)
```

- **Files:**
  - `src/app/api/cases/[id]/status/route.ts` (extend with gate logic + audit log on block)
  - `src/app/api/cases/[id]/status/__tests__/route.test.ts` (extend — 4 new test cases)
- **LOC:** ~120
- **Risk:** 🔴
- **Owner:** FE-2
- **What it ships:**
  - Server-side check: if flag ON AND `newStatus ∈ GATED_TRANSITIONS` AND `!allPassed` → return 400 with `code: 'CHECKLIST_GATE_BLOCKED'`
  - Audit log entry on every block
  - Client pre-flight in `cases/[id]/page.tsx` `onTransition` callback (optional — could be commit #11)
- **NOT in this commit:** no override endpoint, no race-condition transaction (deferred).
- **Verification:**
  - **Bypass attempt test:** direct API call with `allPassed=false` returns 400 + audit log
  - **Regression test:** flag OFF → 200 (legacy behavior)
  - **Audit log test:** `/audit-logs` shows the block entry with `failedItems`
  - **No side-effects test:** followups NOT created on block
- **Sign-off:** Paired review (FE-1 + medical-workflow-expert) + **tech-lead verifies server correctness + medical director acknowledges the gate is now closed in both UI and server.**

### 11.3 Pull request description template

Every B.2.1 PR must include this header:

```markdown
## Story B.2.1 — Commit #N: <derive|render|ui-gate|server-gate>

### Sprint 6.2 reference
- See `docs/ux-redesign/SPRINT_6_2_EXECUTION_PLAN.md` §3.3 (commit sequence)
- See `docs/ux-redesign/STORY_B2_1_EXECUTION_PLAN.md` (this file)

### Risk
🔴 (B.2.1 is the highest-risk story in Sprint 6.2)

### Feature flags
- <FLAG>: default <true|false> in dev / <true|false> in prod

### Tests added
- <list test files + count>

### Medical sign-off (commits 10, 11, 12 only)
- [ ] Medical workflow expert paired review
- [ ] Medical director copy sign-off (commit 10 only)
- [ ] Medical director dry-run complete (commit 12 only — deferred until §10.3 dry-run)

### Paired review
- [ ] FE-1 read-through
- [ ] <FE-2 author> responses addressed
```

### 11.4 Merge gates per commit

| Commit | Required CI green | Required sign-offs | Required manual smokes |
|---|---|---|---|
| #1 (RR-2) | All | Tech Lead | None |
| #9 (derive) | All | Tech Lead + FE-1 paired | `npm run test -- evaluate` |
| #10 (render) | All | FE-1 paired + medical-workflow-expert (clinical copy) | Visual smoke on 1 case |
| #11 (UI gate) | All | FE-1 paired + medical-workflow-expert + medical director (banner copy) | §9.2.1–9.2.10 |
| #12 (server gate) | All | FE-1 paired + medical-workflow-expert + tech-lead + medical director (gate closed ack) | §9.4.1–9.4.4 |

### 11.5 Why this sequence

The order **derive → render → UI gate → server gate** minimizes the time window during which the UI is misleading the user:

- After commit #9: backend computes extended `allPassed`, no UI change → safe, invisible
- After commit #10: UI shows new items, no enforcement → safe, transparent
- After commit #11: UI gates transitions, server does not → **misleading**: user might think they're protected, but a direct API call bypasses. Mitigation: this state lasts only the time between #11 merge and #12 merge (typically < 24h in the same PR stack)
- After commit #12: full enforcement → safe, complete

A user running against the `phase-6/sprint-6.2` branch at any commit has a **safe** experience. The only "unsafe" intermediate state is if someone cherry-picks commit #11 alone — which the merge gate prevents via the PR description checklist.

### 11.6 Branch strategy

```
main
  └── phase-6/sprint-6.2
        └── feat/checklist-gate (B.2.1 branch — 4 stacked commits)
              ├── commit #9
              ├── commit #10
              ├── commit #11
              └── commit #12
```

`feat/checklist-gate` is **force-pushed** as each commit lands (linear history, easy rebase). Merged into `phase-6/sprint-6.2` after commit #12 + all sign-offs. Sprint branch merged to `main` only after the entire Sprint 6.2 (B.2.1 + B.2.3 + B.2.4 + B.1.5 + carry-over) is green.

---

## Appendix A — Story B.2.1 lock-in summary

| Decision | Value | Source |
|---|---|---|
| Number of new clinical items | **6** | BACKLOG B.2.1 T1 |
| New item keys | `blood_test_result`, `allergy_declared`, `pregnancy_test_done`, `anesthesia_review_complete`, `fasting_compliant`, `treatment_consent_signed` | BACKLOG B.2.1 T1 |
| Gated transitions | **3**: `checked_in`, `in_procedure`, `medically_approved` | BACKLOG B.2.1 AC + Sprint 6.2 §2.4 |
| Banner copy (VI) | "Vui lòng hoàn thành toàn bộ checklist trước khi chuyển trạng thái" | Sprint 6.2 §7.1.4 |
| Number of feature flags | **2**: `FEATURE_CHECKLIST_GATE`, `FEATURE_CLINICAL_CHECKLIST` | Sprint 6.2 §6 |
| Flag defaults | Dev: both ON / Prod: both OFF | Sprint 6.2 §6.2 |
| Server enforcement | Yes, behind flag, audit-logged on block | Sprint 6.2 §4 (commit #12) |
| Treatment consent source | `Consent` entity (existing), `status === 'granted'` AND `revokedAt === undefined` | This plan §1.4 |
| N/A handling | `'not_applicable'` value passes the gate | This plan §1.3 |
| Pre-existing items touched | None | BACKLOG B.2.1 scope |
| Override endpoint | **None** in B.2.1 — Sprint 7.x (C.5.x) | Sprint 6.2 §7.1.5 |
| Sign-off required | Medical director (clinical) + CEO + product-owner (flag promotion) | BACKLOG §9.2 |
| Dry-run cases | 3 (full pass, partial fail, N/A edge) | Sprint 6.2 §7.1.3 |
| Earliest flag removal | Sprint 7.1 | Sprint 6.2 §6.3 |

---

## Appendix B — Cross-references

- **Source sprint plan:** [`SPRINT_6_2_EXECUTION_PLAN.md`](SPRINT_6_2_EXECUTION_PLAN.md) — sections 1, 3.3, 4, 5, 6, 7.1, 8, 9, 10 all touch B.2.1
- **Source story:** [`IMPLEMENTATION_BACKLOG.md`](IMPLEMENTATION_BACKLOG.md) View 1 §B.2.1
- **Existing checklist evaluator:** `src/lib/checklist/evaluatePreProcedureChecklist.ts`
- **Existing panel UI:** `src/components/checklist/checklist-panel.tsx`
- **Existing status workflow:** `src/components/cases/status-workflow.tsx`
- **Existing case detail page:** `src/app/(protected)/cases/[id]/page.tsx`
- **Existing API route (extends 6.1 B.1.3):** `src/app/api/cases/[id]/status/route.ts`
- **Feature flag helper:** `src/lib/feature-flags.ts`
- **Type:** `CaseRecord` in `src/lib/types/case.ts`
- **Status transitions map:** `CASE_STATUS_TRANSITIONS` in `src/constants/case-status.ts`
- **Permissions matrix:** `CASE_STATUS_CHANGE_ROLES` in `src/constants/permissions.ts` (needs RR-2 fix)
- **Audit log helper:** `writeAuditLog` in `src/lib/firestore/audit.ts`
- **Notification helper (NOT used by B.2.1):** `triggerMedicalAlert` — gate block does not notify

---

*End of Story B.2.1 Execution Plan.*