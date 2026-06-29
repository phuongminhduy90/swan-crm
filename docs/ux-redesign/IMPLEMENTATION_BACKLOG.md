# Swan CRM — UX Redesign Implementation Backlog

> **Generated:** 2026-06-29
> **Scope:** 49 approved changes (22 Must-Have + 27 Should-Have)
> **Duration:** ~55 dev-days across 9 sprints (6.1 → 7.5)
> **Source docs:** `DESIGN_DIRECTION.md`, `UX_DECISION_DOCUMENT.md`, `SITEMAP.md`, `INFORMATION_ARCHITECTURE.md`, `UI_REFACTOR_PLAN.md`

---

## How to Read This Document

This backlog has **two views:**

| View | Purpose | Use When |
|------|---------|----------|
| **View 1 — Epic Hierarchy** | Epics → Stories → Tasks → Subtasks, grouped by Phase A/B/C | Product planning, dependency analysis, architecture review |
| **View 2 — Sprint Backlogs** | Stories grouped by sprint (6.1–7.5) with hours, owners, exit criteria | Sprint planning, daily standups, capacity tracking |

Story IDs (e.g., `F-CRIT-02`) are shared across both views for cross-referencing.

---

# VIEW 1 — EPIC HIERARCHY

## Legend

| Symbol | Meaning |
|--------|---------|
| **S** | Small (1–3 hours) |
| **M** | Medium (4–8 hours) |
| **L** | Large (9–16 hours) |
| **XL** | Extra Large (17+ hours) |
| 🔴 | High risk (requires paired review + verification test) |
| 🟡 | Medium risk |
| 🟢 | Low risk |
| `[F]` | Feature flag required |
| `[D]` | Data migration required |

---

## EPIC 1 — Design System Foundation

> **Phase:** A (4 dev-days, parallel to Sprint 6.1)
> **Goal:** Land component primitives that every later epic depends on. Zero route churn — only UI primitives and shared config.

### Story A.1 — Tabs Component: ARIA + Arrow-Key Navigation

**ID:** `F-HIGH-11` | **Priority:** Must | **Sprint:** 6.1 | **Owner:** FE-1 | **Est:** 6h | **Risk:** 🟡

**Dependencies:** None (foundation story)
**Blocks:** Story C.1.3 (ARIA on every consumer), Story C.2.2 (case detail tab adoption)

**Files to modify:**
- `src/components/ui/tabs.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Add ARIA roles to Tabs | S1: Add `role="tablist"` to tab container · S2: Add `role="tab"` + `aria-selected` to each tab trigger · S3: Add `role="tabpanel"` to content wrapper | 2h |
| T2: Implement arrow-key navigation | S1: Handle `ArrowLeft`/`ArrowRight` to move focus between tabs · S2: Implement `Home`/`End` key support · S3: Wrap focus at boundaries (first↔last) | 2h |
| T3: Manage focus with `tabIndex` | S1: Active tab gets `tabIndex={0}`, others `-1` · S2: Sync `tabIndex` on programmatic value change · S3: Ensure `roving tabindex` pattern for screen readers | 1h |
| T4: Write unit tests | S1: Test ARIA attributes rendered correctly · S2: Test keyboard navigation via `fireEvent.keyDown` · S3: Test `Home`/`End` behavior | 1h |

**Acceptance Criteria:**
- [ ] Tabs container has `role="tablist"`, each trigger has `role="tab"`, content has `role="tabpanel"`
- [ ] Arrow keys cycle through tabs; Home jumps to first, End to last
- [ ] Active tab has `tabIndex={0}`, inactive have `tabIndex={-1}`
- [ ] `aria-selected="true"` on active tab only
- [ ] axe-core reports 0 critical issues on any page using Tabs
- [ ] `tsc --noEmit` → 0 errors

---

### Story A.2 — Modal Component: Focus Trap + `aria-labelledby`

**ID:** `F-HIGH-12` | **Priority:** Must | **Sprint:** 6.1 | **Owner:** FE-2 | **Est:** 5h | **Risk:** 🟡

**Dependencies:** None
**Blocks:** Story C.1.1 (CloseIconButton label on Modal), all modals across routes

**Files to modify:**
- `src/components/ui/modal.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Implement focus trap | S1: On open, focus first focusable element inside modal · S2: On Tab/Shift+Tab, cycle within modal boundaries · S3: Prevent focus escaping to body/background | 2h |
| T2: Focus return on close | S1: Store trigger element ref on open · S2: Call `triggerRef.focus()` after modal unmount animation · S3: Fallback: focus `<main>` if trigger ref lost | 1h |
| T3: Add `aria-labelledby` | S1: Accept optional `titleId` prop · S2: Wire `aria-labelledby={titleId}` to dialog element · S3: Render `<span id={titleId}>` inside modal header slot | 1h |
| T4: Write unit tests | S1: Test focus trap via `fireEvent.keyDown` (Tab cycling) · S2: Test focus return on close · S3: Test `aria-labelledby` presence | 1h |

**Acceptance Criteria:**
- [ ] `Tab` key cycles within modal, never escapes to background
- [ ] On close, focus returns to the element that triggered the modal
- [ ] `aria-labelledby` points to the modal title element
- [ ] ESC key closes modal and returns focus
- [ ] No axe-core critical issues on any modal

---

### Story A.3 — CloseIconButton Component (New)

**ID:** `F-HIGH-15` | **Priority:** Must | **Sprint:** 6.1 | **Owner:** FE-1 | **Est:** 2h | **Risk:** 🟢

**Dependencies:** None
**Blocks:** Story B.3.5 (native confirm → ConfirmDialog), Story C.1.1 (modal close label)

**Files to create:**
- `src/components/ui/close-icon-button.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Create CloseIconButton | S1: Accept `ariaLabel` prop (required, Vietnamese default "Đóng") · S2: Render `<button>` with Lucide `X` icon, `size={20}`, `strokeWidth={1.5}` · S3: Apply `rounded-full`, `hover:bg-black/5`, `transition-colors` · S4: Add `focus-visible:ring-4 ring-swan-500` focus style | 1.5h |
| T2: Write unit test | S1: Test `ariaLabel` renders as `aria-label` attribute · S2: Test click fires `onClose` | 0.5h |

**Acceptance Criteria:**
- [ ] `ariaLabel="Đóng"` renders as `aria-label="Đóng"` on the `<button>`
- [ ] Visible focus ring on keyboard Tab
- [ ] Lucide `X` icon, stroke 1.5, 20×20
- [ ] Click fires `onClose`

---

### Story A.4 — Shared Textarea Adoption

**ID:** `F-MED-02` | **Priority:** Must | **Sprint:** 6.1 | **Owner:** FE-2 | **Est:** 2h | **Risk:** 🟢

**Dependencies:** None (shared component already exists at `src/components/ui/textarea.tsx`)
**Blocks:** None

**Files to modify:**
- `src/components/ui/textarea.tsx` (minor prop additions)
- `src/components/customers/customer-form.tsx` (ensure import)
- `src/components/cases/case-form.tsx` (ensure import)

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Audit Textarea consumers | S1: Grep for inline `<textarea>` in components · S2: Verify each imports shared `Textarea` · S3: Replace any inline `<textarea>` with `<Textarea>` | 1h |
| T2: Add `aria-required` prop | S1: Pass through `required` prop to `aria-required` · S2: Add `aria-describedby` support for error messages | 1h |

**Acceptance Criteria:**
- [ ] Zero inline `<textarea>` elements outside `src/components/ui/textarea.tsx`
- [ ] All `required` fields show `aria-required="true"` and visual asterisk `*`

---

### Story A.5 — Shared Sidebar Menu Config (New)

**ID:** `F-HIGH-02` | **Priority:** Must | **Sprint:** 6.1 | **Owner:** FE-1 | **Est:** 5h | **Risk:** 🔴

**Dependencies:** None
**Blocks:** Story B.3.4 (topbar profile), Story C.5.1 (notification bell inline)

**Files to create:**
- `src/config/sidebar-menu.ts`
- `src/lib/hooks/useVisibleMenu.ts`

**Files to modify:**
- `src/components/layout/sidebar.tsx`
- `src/components/layout/mobile-nav.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Create `sidebar-menu.ts` | S1: Define `MenuItem` type with `id`, `label`, `icon`, `href`, `requiredPermission` · S2: Export `MENU_ITEMS` (8 main), `SETTINGS_SUB_ITEMS` (4), `BOTTOM_ITEMS` (2) · S3: Each item maps to an existing `PermissionKey` from `@/config/roles.ts` | 1.5h |
| T2: Create `useVisibleMenu` hook | S1: Accept `role: UserRole` · S2: Filter `MENU_ITEMS` via `hasPermission()` from `@/lib/auth/rb.ts` · S3: Return filtered arrays for main, settings, bottom sections | 1h |
| T3: Migrate `sidebar.tsx` | S1: Replace inline `MENU_ITEMS` array with `useVisibleMenu()` · S2: Remove duplicated permission logic · S3: Visual regression: all 12 roles render correct items | 1.5h |
| T4: Migrate `mobile-nav.tsx` | S1: Replace inline items + `as never` casts with `useVisibleMenu()` · S2: Remove `as never` type hacks · S3: Visual regression: all 12 roles | 0.5h |
| T5: Write tests | S1: Test `useVisibleMenu` returns correct items per role (admin gets all, sales_offline gets subset) · S2: Verify no `as never` in sidebar or mobile-nav | 0.5h |

**Acceptance Criteria:**
- [ ] Single source of truth in `src/config/sidebar-menu.ts`
- [ ] `useVisibleMenu(role)` returns role-filtered items
- [ ] `sidebar.tsx` and `mobile-nav.tsx` contain zero duplicated menu arrays
- [ ] Zero `as never` type casts in either file
- [ ] Visual diff: all 12 roles → sidebar renders identically to current
- [ ] axe-core 0 critical on sidebar + mobile-nav

---

## EPIC 2 — Patient Safety & Clinical Workflow

> **Phase:** B (Sprints 6.1–6.3)
> **Goal:** Close patient safety gaps — CCCD capture, checklist gating, status transition enforcement, medical alert handling, next-owner visibility.

### Story B.1.1 — Render CCCD Fields in Customer Form

**ID:** `F-CRIT-02` | **Priority:** Must | **Sprint:** 6.1 | **Owner:** FE-2 | **Est:** 3h | **Risk:** 🟢

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/components/customers/customer-form.tsx`
- `src/lib/types/customer.ts`
- `src/lib/validators/customer.ts`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Add CCCD fields to Customer type | S1: Add `nationalIdNumber?: string`, `nationalIdIssueDate?: string`, `nationalIdIssuePlace?: string` to `Customer` type · S2: Update Zod validator with optional string fields | 0.5h |
| T2: Add "Giấy tờ tùy thân" section to form | S1: Create collapsible section with heading "Giấy tờ tùy thân" · S2: Add `Số CCCD` (masked input, 12-digit pattern), `Ngày cấp` (date), `Nơi cấp` (text) · S3: Wire to RHF fields with same Zod schema · S4: Add `SENSITIVE_FIELD_ACCESS_ROLES` guard — hide section if role not in list | 1.5h |
| T3: Verify persistence | S1: Create customer with CCCD → Firestore mock stores all 3 fields · S2: Edit customer → CCCD fields load from existing data · S3: Verify `nationalIdNumber` excluded from audit diff (`F-MED-17`) | 0.5h |
| T4: Write unit tests | S1: Test CCCD renders for admin, hidden for media · S2: Test persistence round-trip · S3: Test audit log diff does not include `nationalIdNumber` | 0.5h |

**Acceptance Criteria:**
- [ ] Customer form has "Giấy tờ tùy thân" section with 3 fields
- [ ] Fields persist to Firestore and load on edit
- [ ] Section visible only to `SENSITIVE_FIELD_ACCESS_ROLES` (8 roles)
- [ ] `nationalIdNumber` NOT in audit log diff

---

### Story B.1.2 — Remove `'scheduled'` from `hospital_confirmed` Transitions

**ID:** `F-CRIT-04` | **Priority:** Must | **Sprint:** 6.1 | **Owner:** FE-1 | **Est:** 1h | **Risk:** 🟢

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/constants/case-status.ts` (line ~73)

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Remove transition | S1: Open `CASE_STATUS_TRANSITIONS` object · S2: Find `hospital_confirmed` key · S3: Remove `'scheduled'` from its `to` array · S4: Add comment explaining rationale | 0.5h |
| T2: Write test | S1: Test that `getAllowedTransitions('hospital_confirmed')` does not include `'scheduled'` · S2: Test that UI does not render "Sắp xếp lịch" button for `hospital_confirmed` | 0.5h |

**Acceptance Criteria:**
- [ ] `hospital_confirmed` → `scheduled` is not in `CASE_STATUS_TRANSITIONS`
- [ ] StatusWorkflow component does not render "Sắp xếp lịch" for `hospital_confirmed`
- [ ] `tsc --noEmit` passes

---

### Story B.1.3 — Server-Side Case Status Transition Enforcement

**ID:** `F-CRIT-05` | **Priority:** Must | **Sprint:** 6.1 | **Owner:** FE-1 | **Est:** 3h | **Risk:** 🔴

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/app/api/cases/[id]/status/route.ts`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Add server RBAC check | S1: Read current user role from request session · S2: Validate role is in `CASE_STATUS_CHANGE_ROLES` · S3: Return 403 JSON `{ error: 'Bạn không có quyền thay đổi trạng thái' }` if not allowed | 1h |
| T2: Validate transition in API | S1: Read `newStatus` from request body · S2: Load current case status from store · S3: Check `newStatus` is in `getAllowedTransitions(currentStatus)` · S4: Return 400 JSON if invalid transition | 1h |
| T3: Write integration tests | S1: Test 403 when unauthorized role (e.g., `media`) tries status change · S2: Test 400 for invalid transition (`hospital_confirmed` → `scheduled`) · S3: Test 200 for valid transition with authorized role | 1h |

**Acceptance Criteria:**
- [ ] API returns 403 for roles not in `CASE_STATUS_CHANGE_ROLES`
- [ ] API returns 400 for invalid transitions (e.g., `hospital_confirmed` → `scheduled`)
- [ ] Existing UI callers continue to work (no regression)
- [ ] Audit log entry written for every transition

---

### Story B.1.4 — Dashboard: `lab_overdue_count` StatCard

**ID:** `F-CRIT-07` | **Priority:** Must | **Sprint:** 6.1 | **Owner:** FE-3 | **Est:** 2h | **Risk:** 🟡

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/app/(protected)/dashboard/page.tsx`
- `src/components/dashboard/stat-cards.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Compute `lab_overdue_count` | S1: Filter cases where `expectedLabDate < today` AND status NOT in terminal states · S2: Return count from dashboard API/mock · S3: Wire to StatCards with red `Badge` | 1h |
| T2: Make card clickable | S1: Wrap StatCard in `<Link href="/cases?status=lab_overdue">` · S2: Add `cursor-pointer` + hover scale · S3: Tooltip: "Xem danh sách ca quá hạn xét nghiệm" | 0.5h |
| T3: Write test | S1: Test count computation with 3 overdue + 2 current + 1 terminal → count = 3 · S2: Test link navigates to filtered case list | 0.5h |

**Acceptance Criteria:**
- [ ] Red StatCard shows `lab_overdue_count` on dashboard
- [ ] Card links to `/cases?status=lab_overdue` filtered list
- [ ] Count excludes terminal cases (completed, cancelled)
- [ ] Tooltip explains what "quá hạn xét nghiệm" means

---

### Story B.1.5 — Auto-Escalate `issue_reported` / painLevel≥4 to Doctor

**ID:** `F-HIGH-20` | **Priority:** Must | **Sprint:** 6.2 | **Owner:** FE-2 | **Est:** 6h | **Risk:** 🟡

**Dependencies:** Story B.1.4 (lab overdue count for context)
**Blocks:** None

**Files to create:**
- `src/lib/followups/escalate.ts`

**Files to modify:**
- `src/lib/firestore/followups.ts`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Create escalation logic | S1: Detect `status === 'issue_reported'` or `painLevel >= 4` on followup update · S2: Call `triggerMedicalAlert(caseId)` from `@/lib/firestore/cases.ts` · S3: Create notification to `doctor` role with case details · S4: Log escalation event via `writeAuditLog()` | 2h |
| T2: Integrate with followup API | S1: Call `escalateFollowup()` on followup status update in API handler · S2: Handle edge case: case already in `medical_alert` status (no double-escalate) | 1h |
| T3: Wire notification template | S1: Add `followup_escalation` notification template in `templates.ts` · S2: Recipient: case-assigned doctor + nurse · S3: Include pain level, followup day, customer name | 1h |
| T4: Write tests | S1: Test escalation triggers when painLevel ≥ 4 · S2: Test no escalation when painLevel < 4 · S3: Test double-escalation guard · S4: Test notification sent to correct recipients | 2h |

**Acceptance Criteria:**
- [ ] Followup update with `painLevel >= 4` triggers medical alert
- [ ] Followup update with `status === 'issue_reported'` triggers medical alert
- [ ] No double-escalation if case already in `medical_alert`
- [ ] Doctor + nurse receive notification with case details
- [ ] Audit log entry for every escalation

---

### Story B.1.6 — Include Doctor/Nurse in Complaint Notifications

**ID:** `F-HIGH-21` | **Priority:** Must | **Sprint:** 6.1 | **Owner:** FE-3 | **Est:** 2h | **Risk:** 🟢

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/lib/notifications/trigger.ts`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Expand complaint recipients | S1: Load case staff assignments (doctor, nurse, coordinator) · S2: Add to `recipients` array alongside CSKH · S3: Filter out `nationalIdNumber`/`medicalNote`/`privacyNote` from notification payload | 1h |
| T2: Test | S1: Verify doctor receives complaint notification · S2: Verify sensitive fields not in payload | 1h |

**Acceptance Criteria:**
- [ ] Complaint notifications sent to doctor, nurse, and coordinator (in addition to CSKH)
- [ ] Payload excludes `nationalIdNumber`, `medicalNote`, `privacyNote`

---

### Story B.1.7 — Resolve CSKH from StaffAssignment

**ID:** `F-MED-19` | **Priority:** Must | **Sprint:** 6.1 | **Owner:** FE-2 | **Est:** 2h | **Risk:** 🟢

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/app/api/cases/[id]/status/route.ts`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Dynamic CSKH resolution | S1: Read `staffAssignment.cskhPostopId` from case · S2: Resolve display name via `getAllUsers()` map · S3: Replace hardcoded "CSKH" with resolved name in notifications/audit | 1h |
| T2: Test | S1: Test CSKH name resolves from staff assignment · S2: Test fallback to "CSKH" if no assignment | 1h |

**Acceptance Criteria:**
- [ ] Notifications show actual CSKH name, not hardcoded "CSKH"
- [ ] Fallback to "CSKH" when no staff assignment exists

---

### Story B.2.1 — Add 6 Clinical Items to Checklist + Gate UI

**ID:** `F-CRIT-03`, `F-CRIT-10` | **Priority:** Must | **Sprint:** 6.2 | **Owner:** FE-2 | **Est:** 8h | **Risk:** 🔴

**Dependencies:** Story A.1 (Tabs ARIA for checklist tab)
**Blocks:** None

**Files to modify:**
- `src/components/checklist/checklist-panel.tsx`
- `src/lib/checklist/evaluatePreProcedureChecklist.ts`
- `src/app/(protected)/cases/[id]/page.tsx` (StatusWorkflow integration)
- `src/lib/notifications/templates.ts`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Add 6 clinical items | S1: Blood test result (`bloodTestResult`) · S2: Allergy declaration (`allergyDeclared`) · S3: Pregnancy test (`pregnancyTestDone`) · S4: Anesthesia review (`anesthesiaReviewComplete`) · S5: Fasting compliance (`fastingCompliant`) · S6: Treatment consent signed (`treatmentConsentSigned`) | 2h |
| T2: Wire `allPassed` gate | S1: Compute `allPassed` from all checklist items (existing + new) · S2: Pass `allPassed` to `StatusWorkflow` component · S3: Block transitions to `checked_in`, `in_procedure`, `medically_approved` when `allPassed === false` · S4: Show red banner: "Vui lòng hoàn thành toàn bộ checklist trước khi chuyển trạng thái" | 2h |
| T3: Feature flag | S1: Wrap gate logic behind `NEXT_PUBLIC_FEATURE_CHECKLIST_GATE` · S2: Dev default: `true`; Prod default: `false` · S3: When flag off, gate is bypassed (current behavior) | 1h |
| T4: Medical director sign-off | S1: Checklist items reviewed with medical director · S2: Items confirmed as complete set | 1h |
| T5: Write tests | S1: Test `allPassed=false` blocks `checked_in` transition · S2: Test `allPassed=true` allows transition · S3: Test feature flag off → bypass · S4: Test with 3 historical cases (dry-run) | 2h |

**Acceptance Criteria:**
- [ ] Checklist shows 6 new clinical items (blood test, allergy, pregnancy, anesthesia, fasting, consent)
- [ ] `allPassed === false` prevents transition to `checked_in` / `in_procedure` / `medically_approved`
- [ ] Red banner displays when gate blocks
- [ ] Feature flag `NEXT_PUBLIC_FEATURE_CHECKLIST_GATE` controls behavior
- [ ] Medical director sign-off on checklist items
- [ ] Dry-run passed on 3 historical cases

---

### Story B.2.2 — Add `medical_alert_resolved` Terminal Status

**ID:** `F-HIGH-19` | **Priority:** Must | **Sprint:** 6.1 | **Owner:** FE-1 | **Est:** 2h | **Risk:** 🟡

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/constants/case-status.ts`
- `src/lib/types/case.ts` (if CaseStatus union needs extension)

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Add status to transitions | S1: Add `medical_alert_resolved` to `CaseStatus` union type · S2: Add transitions: `medical_alert` → `medical_alert_resolved` · S3: Remove `'completed'` from `medical_alert` transitions · S4: Set `medical_alert_resolved` as terminal (no outgoing transitions) | 1h |
| T2: Add badge + label | S1: Add `medical_alert_resolved` to `CASE_STATUS_LABELS` · S2: Add success (green) color to `CASE_STATUS_HEX` · S3: Add icon (Lucide `CheckCircle`) to badge | 0.5h |
| T3: Write test | S1: Test `medical_alert` cannot transition to `procedure_completed` · S2: Test `medical_alert` can transition to `medical_alert_resolved` · S3: Test `medical_alert_resolved` has no outgoing transitions | 0.5h |

**Acceptance Criteria:**
- [ ] `medical_alert_resolved` exists as a terminal CaseStatus
- [ ] `medical_alert` → `procedure_completed` is NOT allowed
- [ ] `medical_alert` → `medical_alert_resolved` IS allowed
- [ ] Green badge with `CheckCircle` icon

---

### Story B.2.3 — Audit PII Redaction in Diff

**ID:** `F-MED-17` | **Priority:** Must | **Sprint:** 6.2 | **Owner:** FE-1 | **Est:** 4h | **Risk:** 🟡

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/lib/firestore/audit.ts`
- `src/components/audit-logs/` (diff renderer)

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Define PII allowlist | S1: Create `AUDIT_REDACTED_FIELDS = ['medicalNote', 'privacyNote', 'nationalIdNumber']` in `audit.ts` · S2: Apply redaction in `writeAuditLog()` — replace values with `"[ĐÃ ẨN]"` before persisting · S3: Redact in both `beforeData` and `afterData` | 2h |
| T2: Update diff renderer | S1: Render `"[ĐÃ ẨN]"` with gray italic styling · S2: Add tooltip: "Thông tin nhạy tế đã được ẩn vì lý do bảo mật" | 1h |
| T3: Write tests | S1: Test `writeAuditLog()` strips PII fields from diff · S2: Test historical logs (visual diff 5 records) · S3: Test no regression for non-PII fields | 1h |

**Acceptance Criteria:**
- [ ] Audit log diff NEVER contains `medicalNote`, `privacyNote`, or `nationalIdNumber` values
- [ ] Redacted values show `"[ĐÃ ẨN]"` with gray italic styling
- [ ] Tooltip explains redaction
- [ ] 5 historical audit log records visually verified

---

### Story B.2.4 — `procedure_completed` Second-Confirm Dialog

**ID:** `F-CRIT-03` (part) | **Priority:** Must | **Sprint:** 6.2 | **Owner:** FE-2 | **Est:** 4h | **Risk:** 🟡

**Dependencies:** Story A.3 (CloseIconButton for ConfirmDialog)
**Blocks:** None

**Files to modify:**
- `src/components/ui/confirm-dialog.tsx` (variant)
- `src/app/(protected)/cases/[id]/page.tsx` (StatusWorkflow integration)
- `src/components/cases/status-workflow.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Create clinical ConfirmDialog variant | S1: Add `variant: 'info' | 'warning' | 'danger'` prop to ConfirmDialog · S2: `warning` variant: amber icon, amber border · S3: Accept custom `description: ReactNode` for checklist status summary | 1.5h |
| T2: Wire second-confirm for `procedure_completed` | S1: When user clicks "Hoàn thành thủ thuật" → open ConfirmDialog · S2: Dialog shows: side-effect count, checklist state (`allPassed`), required `actualProcedureDate` field · S3: Confirm button disabled until `actualProcedureDate` filled · S4: On confirm: proceed with status transition | 1.5h |
| T3: Write tests | S1: Test dialog opens on button click · S2: Test confirm disabled without date · S3: Test confirm proceeds with valid date | 1h |

**Acceptance Criteria:**
- [ ] `procedure_completed` shows ConfirmDialog with checklist + side-effect summary
- [ ] Confirm button disabled until `actualProcedureDate` is provided
- [ ] Dialog uses `warning` variant (amber)
- [ ] Native `confirm()` never used for this transition

---

## EPIC 3 — Revenue & Financial Integrity

> **Phase:** B (Sprint 6.4) + C (Sprint 7.2–7.3)
> **Goal:** Restore financial accuracy — separation of duties, transactional writes, bill recompute, report disambiguation.

### Story B.3.1 — Remove Accountant from `PAYMENT_CONFIRM_ROLES` + Server Check

**ID:** `F-CRIT-06` | **Priority:** Must | **Sprint:** 6.1 | **Owner:** FE-1 | **Est:** 2h | **Risk:** 🔴

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/constants/permissions.ts` (line ~41)
- `src/app/api/payments/[id]/confirm/route.ts`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Remove accountant from confirm roles | S1: Remove `'accountant'` from `PAYMENT_CONFIRM_ROLES` array · S2: Now only `admin` can confirm payments | 0.5h |
| T2: Add server-side SoD check | S1: In confirm API, compare `payment.createdBy` with `currentUser.uid` · S2: If same → return 403: "Không thể xác nhận phiếu thanh toán do chính mình tạo" · S3: Log SoD violation attempt via `writeAuditLog()` | 1h |
| T3: Write tests | S1: Test accountant gets 403 on confirm · S2: Test creator trying to confirm own payment gets 403 · S3: Test admin confirming another's payment succeeds | 0.5h |

**Acceptance Criteria:**
- [ ] `PAYMENT_CONFIRM_ROLES` = `['admin']` only
- [ ] Server blocks `createdBy === confirmedBy` with 403
- [ ] SoD violation logged in audit trail
- [ ] `admin` can confirm any payment (except own, if they created it)

---

### Story B.3.2 — Tooltip: "Chỉ tính thanh toán đã xác nhận" on Revenue

**ID:** `F-HIGH-29` | **Priority:** Must | **Sprint:** 6.4 | **Owner:** FE-3 | **Est:** 1h | **Risk:** 🟢

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/components/dashboard/stat-cards.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Add tooltip | S1: Add `<Tooltip>` on "Doanh thu tháng này" StatCard · S2: Text: "Chỉ tính thanh toán đã xác nhận, không bao gồm đang chờ hoặc hoàn tiền" · S3: Use Lucide `Info` icon trigger | 0.5h |
| T2: Test | S1: Hover shows tooltip text · S2: Screen reader reads tooltip description | 0.5h |

**Acceptance Criteria:**
- [ ] Tooltip visible on hover with explanatory text
- [ ] Accessible via screen reader (`aria-describedby`)

---

### Story B.3.3 — Rename Pipeline Chart + Revenue Annotation

**ID:** `F-HIGH-32`, `F-HIGH-33` | **Priority:** Must | **Sprint:** 6.1 | **Owner:** FE-3 | **Est:** 2h | **Risk:** 🟢

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/components/reports/pipeline-report.tsx`
- `src/components/reports/revenue-trend-chart.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Rename pipeline chart | S1: Change title from "Bill / Doanh thu tiềm năng" to "Bill / Doanh thu tiềm năng" (already correct in some versions — verify) · S2: Add explicit tooltip: "Tổng bill (chưa trừ giảm giá + chưa xác nhận thanh toán)" | 1h |
| T2: Revenue annotation + refund line | S1: Add annotation text "Đã xác nhận − Hoàn tiền" below revenue Line chart · S2: Add refund line in red (#EF4444) to Line chart · S3: Tooltip for refund: "Tổng hoàn tiền đã xác nhận trong kỳ" | 1h |

**Acceptance Criteria:**
- [ ] Pipeline chart tooltip clarifies "Bill = tổng chưa xác nhận"
- [ ] Revenue chart shows red refund line
- [ ] Annotation "Đã xác nhận − Hoàn tiền" visible below chart

---

## EPIC 4 — AppShell & Mobile

> **Phase:** B (Sprint 6.3)
> **Goal:** Fix critical mobile layout issues, establish responsive patterns, improve case detail UX.

### Story B.4.1 — AppShell `min-h-screen` Fix

**ID:** `F-CRIT-01` | **Priority:** Must | **Sprint:** 6.3 | **Owner:** FE-1 | **Est:** 2h | **Risk:** 🔴

**Dependencies:** None
**Blocks:** All mobile stories

**Files to modify:**
- `src/app/(protected)/layout.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Replace `h-screen` with `min-h-screen` | S1: Change outer wrapper from `h-screen` to `min-h-screen` · S2: Verify `min-h-screen` renders correctly on iOS Safari (URL bar overlap fix) · S3: Add `feature flag`: `NEXT_PUBLIC_FEATURE_MINH_SCREEN` (dev: true, prod: false) | 1h |
| T2: Visual regression | S1: Test 5 routes × 3 viewports (360px, 768px, 1440px) · S2: Verify no horizontal scroll at 360px · S3: Confirm iOS Safari renders without URL-bar overlap | 1h |

**Acceptance Criteria:**
- [ ] AppShell uses `min-h-screen` (not `h-screen`)
- [ ] Mobile Safari (iPhone 12, iOS 17+) renders without URL-bar overlap
- [ ] No horizontal scroll at 360px on any route
- [ ] Visual regression green on 5 routes × 3 viewports

---

### Story B.4.2 — Next-Owner Banner on Case Info Tab

**ID:** `F-CRIT-09` | **Priority:** Must | **Sprint:** 6.3 | **Owner:** FE-2 | **Est:** 5h | **Risk:** 🟡

**Dependencies:** Story B.1.2 (transition table must be correct)
**Blocks:** None

**Files to modify:**
- `src/app/(protected)/cases/[id]/page.tsx`
- `src/components/cases/status-workflow.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Compute next owner | S1: Read current status from case · S2: Look up `CASE_STATUS_TRANSITIONS[status].nextOwner` · S3: Resolve display name from `getAllUsers()` · S4: Determine color: red (blocked/overdue), amber (action needed), aqua (neutral) | 2h |
| T2: Render banner component | S1: Create `<NextOwnerBanner>` composite component inline in case detail · S2: Show: "Người tiếp theo: [Role] [Name] — [Reason]" · S3: Place above status badge in Info tab (position 1 in information hierarchy) | 1.5h |
| T3: Write tests | S1: Test banner shows correct owner for 5 statuses · S2: Test color logic (red/amber/aqua) · S3: Test missing assignment fallback | 1.5h |

**Acceptance Criteria:**
- [ ] Banner displays above status badge on case Info tab
- [ ] Shows next owner role + resolved display name
- [ ] Color matches urgency: red/blocked, amber/action, aqua/neutral
- [ ] Handles missing assignment gracefully

---

### Story B.4.3 — Payment List Display Name

**ID:** `F-HIGH-17` | **Priority:** Must | **Sprint:** 6.3 | **Owner:** FE-3 | **Est:** 2h | **Risk:** 🟢

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/components/payments/payment-list.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Add display name columns | S1: Replace raw user IDs with display names via `getAllUsers()` map · S2: Add "Người nhập" column showing `createdByName` · S3: Add "Người xác nhận" column showing `confirmedByName` | 1.5h |
| T2: Test | S1: Verify display names render (not raw IDs) · S2: Verify fallback "—" when user not found | 0.5h |

**Acceptance Criteria:**
- [ ] Payment list shows display names, not raw IDs
- [ ] "Người nhập" and "Người xác nhận" columns present
- [ ] Fallback "—" if user record not found

---

### Story B.4.4 — Topbar Profile Placeholder

**ID:** `F-HIGH-01` | **Priority:** Must | **Sprint:** 6.3 | **Owner:** FE-3 | **Est:** 1h | **Risk:** 🟢

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/components/layout/topbar.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Add profile toast | S1: Click "Hồ sơ" menu item → show `<Toast>` message: "Tính năng đang phát triển" · S2: Toast type: `info` · S3: Auto-dismiss after 3 seconds | 0.5h |
| T2: Test | S1: Click "Hồ sơ" → info toast appears | 0.5h |

**Acceptance Criteria:**
- [ ] Clicking "Hồ sơ" shows info toast "Tính năng đang phát triển"
- [ ] Toast auto-dismisses after 3 seconds
- [ ] No dead link (A8 anti-pattern prevented)

---

### Story B.4.5 — Replace Native `confirm()` with `<ConfirmDialog>`

**ID:** `F-MED-01` | **Priority:** Must | **Sprint:** 6.3 | **Owner:** FE-2 | **Est:** 3h | **Risk:** 🟡

**Dependencies:** Story A.3 (CloseIconButton), Story B.2.4 (ConfirmDialog variant)
**Blocks:** None

**Files to modify:**
- `src/app/(protected)/cases/[id]/page.tsx` (remove-service, status changes)
- `src/app/(protected)/customers/[id]/page.tsx` (delete approval)
- Other pages with `window.confirm()`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Audit all `window.confirm()` calls | S1: `grep -r "window.confirm" src/` · S2: List every location · S3: Categorize by risk (delete, status change, destructive) | 0.5h |
| T2: Replace each with `<ConfirmDialog>` | S1: Remove-service → `<ConfirmDialog variant="danger" title="Xác nhận xóa dịch vụ">` · S2: Delete approval → `<ConfirmDialog variant="warning" title="Phê duyệt xóa khách hàng">` · S3: Each uses shared `ConfirmDialog` with CloseIconButton | 2h |
| T3: Write test | S1: Verify no `window.confirm` calls remain · S2: Test one ConfirmDialog flow end-to-end | 0.5h |

**Acceptance Criteria:**
- [ ] Zero `window.confirm()` calls in `src/`
- [ ] All destructive actions use `<ConfirmDialog>`
- [ ] A9 anti-pattern prevented

---

### Story B.4.6 — Status Filter: Chips Desktop, `<Select>` Mobile

**ID:** `F-MED-06` | **Priority:** Must | **Sprint:** 6.3 | **Owner:** FE-1 | **Est:** 2h | **Risk:** 🟢

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/components/cases/case-list.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Responsive filter | S1: Desktop (`md+`): render status chips (current behavior) · S2: Mobile (`< md`): render `<Select>` dropdown with all status options · S3: Add `md:hidden` / `hidden md:flex` classes for responsive toggle | 1h |
| T2: Test | S1: Render at 360px → Select dropdown · S2: Render at 1024px → Chips · S3: Both filter cases correctly | 1h |

**Acceptance Criteria:**
- [ ] Desktop (≥768px): status chips visible
- [ ] Mobile (<768px): `<Select>` dropdown
- [ ] Both filter the case list identically
- [ ] No horizontal overflow at 360px

---

## EPIC 5 — UI Library & Accessibility

> **Phase:** C (Sprints 7.1–7.3)
> **Goal:** WCAG 2.1 AA compliance, consistent component adoption, form improvements, report UX refinement.

### Story C.1.1 — Modal Close Button Label

**ID:** `F-HIGH-15` (carry) | **Priority:** Should | **Sprint:** 7.1 | **Owner:** FE-1 | **Est:** 2h | **Risk:** 🟢

**Dependencies:** Story A.3 (CloseIconButton created)
**Blocks:** None

**Files to modify:**
- `src/components/ui/modal.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Integrate CloseIconButton into Modal | S1: Import `CloseIconButton` · S2: Replace raw `<button>` close with `<CloseIconButton ariaLabel="Đóng" onClose={onClose} />` · S3: Position top-right with consistent spacing | 1h |
| T2: Write test | S1: Verify `aria-label="Đóng"` on close button · S2: Verify ESC also closes | 1h |

**Acceptance Criteria:**
- [ ] Modal close button uses `CloseIconButton` with `ariaLabel="Đóng"`
- [ ] `aria-label="Đóng"` present on close button

---

### Story C.1.2 — Case-Detail Tabs: Icon-Only on Mobile

**ID:** `F-MED-13` | **Priority:** Should | **Sprint:** 7.1 | **Owner:** FE-2 | **Est:** 4h | **Risk:** 🟡

**Dependencies:** Story A.1 (Tabs component with responsive props)
**Blocks:** None

**Files to modify:**
- `src/components/ui/tabs.tsx` (add `iconOnly` prop)
- `src/app/(protected)/cases/[id]/page.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Add responsive prop to Tabs | S1: Add `iconOnly?: boolean | 'auto'` prop · S2: When `iconOnly={true}`, render only Lucide icon (hide label text) · S3: When `iconOnly='auto'`, use `useMediaQuery` to toggle at `sm` breakpoint · S4: Show "More" overflow for tabs 5–8 on mobile | 2h |
| T2: Apply to case detail | S1: Pass `iconOnly="auto"` to case detail tabs · S2: Define icons for each of 8 tabs · S3: Verify tabs 5–8 collapse to "More" on mobile | 1h |
| T3: Write test | S1: Test at 360px → icon-only · S2: Test at 1024px → full labels · S3: Test "More" overflow shows hidden tabs | 1h |

**Acceptance Criteria:**
- [ ] Case detail tabs show icons only at `< sm` breakpoint
- [ ] Tabs 5–8 collapse into "More" overflow menu on mobile
- [ ] Full labels shown at ≥ `sm`
- [ ] Touch targets ≥ 44×44px

---

### Story C.1.3 — `<Tabs>` ARIA on Every Consumer

**ID:** `F-HIGH-11` (carry) | **Priority:** Should | **Sprint:** 7.1 | **Owner:** FE-2 | **Est:** 3h | **Risk:** 🟡

**Dependencies:** Story A.1 (Tabs ARIA implemented)
**Blocks:** None

**Files to modify:**
- All pages using `<Tabs>`: cases/[id], customers/[id], reports, notifications, followups

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Grep all Tabs consumers | S1: Find every `<Tabs>` usage · S2: Verify each imports from `@/components/ui/tabs` · S3: List non-conformant usages | 0.5h |
| T2: Fix non-conformant consumers | S1: Add `role` prop where missing · S2: Ensure `aria-label` on each TabList · S3: Fix any hand-rolled tab implementations | 1.5h |
| T3: axe-core scan | S1: Run axe-core on every route using Tabs · S2: Verify 0 critical issues | 1h |

**Acceptance Criteria:**
- [ ] Every `<Tabs>` consumer has proper ARIA attributes
- [ ] axe-core: 0 critical issues on all routes using Tabs

---

### Story C.2.1 — `<CurrencyInput>` Component (New)

**ID:** `F-HIGH-08` | **Priority:** Should | **Sprint:** 7.2 | **Owner:** FE-1 | **Est:** 6h | **Risk:** 🟡

**Dependencies:** None
**Blocks:** Story C.3.2 (form integration)

**Files to create:**
- `src/components/ui/currency-input.tsx`

**Files to modify:**
- `src/components/cases/case-form.tsx` (discount field)
- `src/components/payments/payment-form.tsx` (amount field)

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Create CurrencyInput component | S1: Accept `value: number`, `onChange`, `currency: 'VND'` props · S2: Display formatted with thousand separators (e.g., "1.500.000") · S3: On focus, strip separators (show raw number) · S4: On blur, reformat · S5: Accept `min`, `max`, `disabled`, `error` props · S6: Support `aria-required`, `aria-describedby` for error | 3h |
| T2: Integrate into forms | S1: Replace `<Input type="number">` in case form discount field · S2: Replace in payment form amount field · S3: Verify RHF integration (controlled via `Controller`) | 1.5h |
| T3: Write tests | S1: Test formatting: 1500000 → "1.500.000" · S2: Test focus: "1.500.000" → "1500000" · S3: Test blur: "1500000" → "1.500.000" · S4: Test min/max validation · S5: Test error state renders | 1.5h |

**Acceptance Criteria:**
- [ ] CurrencyInput formats numbers with VND thousand separators
- [ ] Focus strips separators; blur restores
- [ ] Integrates with RHF via `Controller`
- [ ] A10 anti-pattern prevented (no raw numeric inputs)

---

### Story C.2.2 — Case Detail Tabs: Adopt Shared `<Tabs>`

**ID:** `F-HIGH-04` | **Priority:** Should | **Sprint:** 7.2 | **Owner:** FE-2 | **Est:** 4h | **Risk:** 🟡

**Dependencies:** Story A.1 (Tabs ARIA), Story C.1.2 (icon-only variant)
**Blocks:** None

**Files to modify:**
- `src/app/(protected)/cases/[id]/page.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Replace hand-rolled tabs | S1: Identify current tab implementation (likely manual `useState` + conditional render) · S2: Import shared `<Tabs>` component · S3: Define 8 tab items with labels + icons · S4: Wire `value`/`onValueChange` to shared Tabs · S5: Pass `iconOnly="auto"` for responsive behavior | 2h |
| T2: URL-sync tabs (`?tab=`) | S1: Use `useSearchParams()` to read `?tab` · S2: Default to `info` if missing or invalid · S3: Use `router.replace()` on tab change (no history push) · S4: Validate tab value against allowed list | 1.5h |
| T3: Write test | S1: Test default tab = `info` · S2: Test URL `?tab=payments` opens payments tab · S3: Test invalid tab falls back to `info` | 0.5h |

**Acceptance Criteria:**
- [ ] Case detail uses shared `<Tabs>` component (no hand-rolled tabs)
- [ ] Tabs sync with URL `?tab=` query param
- [ ] Invalid tab values fall back to `info`
- [ ] A7 anti-pattern prevented

---

### Story C.2.3 — Reports Date Filter Refetch

**ID:** `F-HIGH-18` | **Priority:** Should | **Sprint:** 7.2 | **Owner:** FE-3 | **Est:** 4h | **Risk:** 🟢

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/app/(protected)/reports/page.tsx`
- `src/components/reports/report-filters.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Wire refetch on range change | S1: Move `dateRange` into URL search params (`?range=3m`) · S2: Use `useEffect` on `dateRange` to trigger data refetch · S3: Show "Đang lọc…" pill during fetch (loading state) | 2h |
| T2: Improve filter pills | S1: Active pill gets checkmark icon + stronger border · S2: Add X icon on active pill to deselect · S3: Add "Xóa tất cả bộ lọc" button when any filter active · S4: Toast confirmation: "Đã xóa bộ lọc" | 1.5h |
| T3: Write test | S1: Test range change triggers refetch · S2: Test "Đang lọc…" visible during fetch · S3: Test "Xóa tất cả" resets to default | 0.5h |

**Acceptance Criteria:**
- [ ] Date range change triggers data refetch
- [ ] "Đang lọc…" pill visible during fetch
- [ ] Active pills show X icon
- [ ] "Xóa tất cả bộ lọc" button clears all filters

---

### Story C.2.4 — Shared Menu Config Carry

**ID:** `F-HIGH-02` (carry) | **Priority:** Should | **Sprint:** 7.2 | **Owner:** FE-1 | **Est:** 1h | **Risk:** 🟢

**Dependencies:** Story A.5 (useVisibleMenu created)
**Blocks:** None

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Verify migration complete | S1: Grep for duplicate menu arrays in sidebar + mobile-nav · S2: Confirm zero duplicates · S3: Confirm zero `as never` | 1h |

**Acceptance Criteria:**
- [ ] Zero duplicated menu arrays
- [ ] Zero `as never` casts

---

### Story C.3.1 — Doctor Identity Fields on Case Approval

**ID:** `F-HIGH-22` | **Priority:** Should | **Sprint:** 7.3 | **Owner:** FE-2 | **Est:** 5h | **Risk:** 🟡

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/lib/types/case.ts`
- `src/app/(protected)/cases/[id]/page.tsx`
- `src/app/api/cases/[id]/status/route.ts`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Add fields to CaseRecord | S1: Add `approvedByDoctorId?: string` to `CaseRecord` type · S2: Add `medicalApprovedAt?: string` (ISO timestamp) · S3: Both fields optional for backward-compat (no backfill needed) | 0.5h |
| T2: Enforce on `medically_approved` transition | S1: When status → `medically_approved`, require caller role is `doctor` · S2: Auto-populate `approvedByDoctorId = currentUser.uid` and `medicalApprovedAt = new Date().toISOString()` · S3: Return 400 if non-doctor attempts `medically_approved` transition | 2h |
| T3: Display on case detail | S1: Show "Bác sĩ phê duyệt: [Name] — [Date]" in Info tab · S2: Format date as `dd/MM/yyyy HH:mm` · S3: Only render when fields exist (backward-compat) | 1h |
| T4: Write tests | S1: Test `medically_approved` requires doctor role · S2: Test fields auto-populated · S3: Test non-doctor gets 400 · S4: Test existing cases without fields still render | 1.5h |

**Acceptance Criteria:**
- [ ] `approvedByDoctorId` and `medicalApprovedAt` stored on `medically_approved` transition
- [ ] Only doctors can trigger `medically_approved`
- [ ] Case detail shows doctor name + date
- [ ] Backward-compatible: existing cases without fields still work

---

### Story C.3.2 — `actualProcedureDate` Required on `procedure_completed`

**ID:** `F-HIGH-23` | **Priority:** Should | **Sprint:** 7.3 | **Owner:** FE-1 | **Est:** 2h | **Risk:** 🟡

**Dependencies:** Story B.2.4 (second-confirm dialog already shows date field)
**Blocks:** None

**Files to modify:**
- `src/app/api/cases/[id]/status/route.ts`
- `src/lib/validators/case.ts`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Server-side enforcement | S1: When `newStatus === 'procedure_completed'`, require `actualProcedureDate` in request body · S2: Return 400 if missing: "Ngày thực hiện thủ thuật là bắt buộc" · S3: This is the source of truth for D1–D90 follow-up scheduling | 1h |
| T2: Zod validation | S1: Add `actualProcedureDate: z.string().datetime()` required on `procedure_completed` transition · S2: Validate format (ISO 8601) | 0.5h |
| T3: Write tests | S1: Test 400 when `actualProcedureDate` missing · S2: Test 200 when provided | 0.5h |

**Acceptance Criteria:**
- [ ] Server rejects `procedure_completed` without `actualProcedureDate`
- [ ] Date used as source of truth for D1–D90 scheduling

---

### Story C.3.3 — Lab Date Validation

**ID:** `F-HIGH-24` | **Priority:** Should | **Sprint:** 7.3 | **Owner:** FE-1 | **Est:** 2h | **Risk:** 🟢

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/lib/validators/case.ts`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Add Zod refine | S1: Add `.refine(date => date <= expectedProcedureDate, "Ngày xét nghiệm phải trước ngày phẫu thuật")` to `expectedLabDate` field · S2: Error message: "Ngày xét nghiệm dự kiến phải trước hoặc bằng ngày phẫu thuật dự kiến" | 1h |
| T2: Write test | S1: Test lab date > procedure date → validation error · S2: Test lab date ≤ procedure date → valid | 1h |

**Acceptance Criteria:**
- [ ] `expectedLabDate > expectedProcedureDate` fails validation
- [ ] Error message in Vietnamese

---

### Story C.3.4 — StaffAssignment Role Label

**ID:** `F-MED-21` | **Priority:** Should | **Sprint:** 7.3 | **Owner:** FE-3 | **Est:** 2h | **Risk:** 🟢

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/app/(protected)/cases/[id]/page.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Format role labels | S1: For each staff assignment, prefix display name with role in brackets · S2: Example: `[Bác sĩ] Nguyễn Văn A`, `[Điều dưỡng] Trần Thị B` · S3: Use `ROLE_LABELS` from `@/config/roles.ts` for mapping | 1h |
| T2: Test | S1: Test role labels render correctly · S2: Test missing role fallback | 1h |

**Acceptance Criteria:**
- [ ] Staff assignment shows `[Role] Display Name` format
- [ ] Uses `ROLE_LABELS` for role name mapping

---

## EPIC 6 — Consent & Privacy

> **Phase:** C (Sprint 7.4)
> **Goal:** Enforce binary consent model, prevent privacy breaches on image uploads, cascade audit on customer deletion.

### Story C.4.1 — Server-Side Consent Gate on Image Upload

**ID:** `F-HIGH-25` | **Priority:** Should | **Sprint:** 7.4 | **Owner:** FE-1 | **Est:** 5h | **Risk:** 🔴

**Dependencies:** None
**Blocks:** Story C.4.2 (frontend guard)

**Files to modify:**
- `src/lib/firestore/attachments.ts`
- `src/components/attachments/attachment-upload-dialog.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Server-side consent check | S1: Before allowing upload with `visibility === 'public_marketing'`, check `image_storage` consent status · S2: Also check `marketing_usage` consent status · S3: Both must be `granted` · S4: Return 403: "Chưa có đồng thuận lưu trữ hình ảnh/marketing" if not granted | 2h |
| T2: Feature flag | S1: Wrap behind `NEXT_PUBLIC_FEATURE_CONSENT_GATE` · S2: Dev: true, Prod: false | 0.5h |
| T3: Audit log | S1: Log consent check result via `writeAuditLog()` · S2: Include refusal reason in log entry | 0.5h |
| T4: Write tests | S1: Test upload blocked when `image_storage` not granted · S2: Test upload blocked when `marketing_usage` not granted · S3: Test upload allowed when both granted · S4: Test upload allowed when visibility ≠ `public_marketing` · S5: Test audit log entry for refusal | 2h |

**Acceptance Criteria:**
- [ ] Server blocks `public_marketing` upload without `image_storage` + `marketing_usage` consent
- [ ] Refusal logged in audit trail
- [ ] Feature flag controls enforcement
- [ ] Non-marketing uploads unaffected

---

### Story C.4.2 — Frontend Guard: Visibility Change Requires Consent

**ID:** `F-HIGH-26` | **Priority:** Should | **Sprint:** 7.4 | **Owner:** FE-2 | **Est:** 4h | **Risk:** 🔴

**Dependencies:** Story C.4.1 (server gate established)
**Blocks:** None

**Files to modify:**
- `src/components/attachments/attachment-list.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Warning modal on visibility change | S1: When user selects `public_marketing` visibility, check consent · S2: If not granted, show warning modal: "Bạn cần đồng thuận từ khách hàng trước khi đặt ảnh ở chế độ Công khai Marketing" · S3: Modal shows consent status (pending/denied/not found) · S4: "Đồng thuận" button links to consent panel · S5: "Hủy" button cancels visibility change | 2h |
| T2: Refusal path must not silently succeed | S1: If user dismisses modal without granting consent, visibility stays at previous value · S2: Never auto-grant consent on user dismiss | 1h |
| T3: Write tests | S1: Test warning modal appears when consent not granted · S2: Test dismiss → visibility unchanged · S3: Test grant consent → visibility change proceeds | 1h |

**Acceptance Criteria:**
- [ ] Warning modal appears when changing visibility to `public_marketing` without consent
- [ ] Dismiss = visibility unchanged (no silent success)
- [ ] Grant consent = visibility change proceeds
- [ ] A14 anti-pattern prevented

---

### Story C.4.3 — Consent Panel: Require Uploaded PDF

**ID:** `F-HIGH-27` | **Priority:** Should | **Sprint:** 7.4 | **Owner:** FE-2 | **Est:** 4h | **Risk:** 🟡

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/components/consents/consent-panel.tsx`
- `src/lib/types/consent.ts`
- `src/lib/firestore/consents.ts`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Add `documentStoragePath` field | S1: Add `documentStoragePath?: string` to `Consent` type · S2: Accept optional file upload in consent create form · S3: Store path in Firestore | 1h |
| T2: Gate `granted` status on document | S1: When transitioning consent to `granted`, require `documentStoragePath` to be non-empty · S2: Show error: "Vui lòng tải lên bản cam kết đã ký trước khi cấp đồng thuận" · S3: Document types: PDF, JPG, PNG, max 10MB | 2h |
| T3: Write tests | S1: Test transition to `granted` blocked without document · S2: Test transition succeeds with document · S3: Test file type + size validation | 1h |

**Acceptance Criteria:**
- [ ] Consent cannot transition to `granted` without uploaded document
- [ ] Error message in Vietnamese when document missing
- [ ] `documentStoragePath` stored in Firestore

---

### Story C.4.4 — Customer Deletion Cascade Audit

**ID:** `F-MED-16` | **Priority:** Should | **Sprint:** 7.4 | **Owner:** FE-1 | **Est:** 4h | **Risk:** 🟡

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/lib/firestore/customers.ts`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Cascade soft-delete | S1: When customer deletion approved, iterate all related entities (cases, payments, followups, attachments, consents) · S2: Set `active: false` on each · S3: Write separate `writeAuditLog()` entry per record: `{ entity: 'case', entityId, action: 'soft_deleted' }` | 2h |
| T2: Batch audit log | S1: Collect all cascade audit entries into a batch array · S2: Write in parallel (not sequential) for performance · S3: Include summary in customer-level audit: "Xóa khách hàng X — đã vô hiệu hóa Y cases, Z payments, ..." | 1h |
| T3: Write tests | S1: Test cascade deletes 3 related cases + 5 payments + 2 followups · S2: Test each gets individual audit log · S3: Test summary audit log correct | 1h |

**Acceptance Criteria:**
- [ ] Customer deletion cascades to all related records (`active: false`)
- [ ] Each cascade writes individual audit log entry
- [ ] Summary audit entry at customer level
- [ ] A23 anti-pattern prevented

---

### Story C.4.5 — New `attachments:medical_upload` Permission

**ID:** `F-MED-18` | **Priority:** Should | **Sprint:** 7.4 | **Owner:** FE-1 | **Est:** 3h | **Risk:** 🟡

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/config/roles.ts`
- `src/constants/permissions.ts`
- `src/components/attachments/attachment-upload-dialog.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Add permission | S1: Add `'medical_upload'` to permission keys · S2: Add to `ATTACHMENT_PERMISSIONS` group · S3: Grant to `doctor` and `nurse` roles only | 0.5h |
| T2: Enforce in upload | S1: When attachment type is `medical_*` (preop, postop, lab), check `medical_upload` permission · S2: Hide medical type options if role not authorized · S3: Block server-side too | 1.5h |
| T3: Write tests | S1: Test doctor can upload medical attachments · S2: Test nurse can upload · S3: Test sales cannot see medical upload option · S4: Test server rejects medical upload from unauthorized role | 1h |

**Acceptance Criteria:**
- [ ] `attachments:medical_upload` permission exists
- [ ] Only `doctor` and `nurse` have this permission
- [ ] Medical attachment types hidden from unauthorized roles
- [ ] Server-side enforcement as backup

---

## EPIC 7 — Notifications & Workflow Polish

> **Phase:** C (Sprint 7.5)
> **Goal:** Complete notification UX, followup visual improvement, filter consistency, Hospital tab, remaining workflow polish.

### Story C.5.1 — Notification Bell: Inline on Mobile

**ID:** `F-HIGH-03` | **Priority:** Should | **Sprint:** 7.5 | **Owner:** FE-2 | **Est:** 5h | **Risk:** 🟡

**Dependencies:** Story A.5 (shared menu config for layout consistency)
**Blocks:** None

**Files to modify:**
- `src/components/layout/topbar.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Desktop dropdown (existing) | S1: Verify current dropdown behavior works at `md+` · S2: Pagination with "Xem thêm" · S3: Mark-as-read on click | 1h |
| T2: Mobile inline expansion | S1: On `< md`, clicking bell expands a panel below topbar (not popover) · S2: Panel is full-width, max-height 50vh, scrollable · S3: Auto-close on notification click · S4: "Hiển thị đã đọc" toggle switch · S5: Collapse read notifications behind toggle | 3h |
| T3: Write test | S1: Test inline expansion at 360px · S2: Test close on click · S3: Test toggle shows/hides read | 1h |

**Acceptance Criteria:**
- [ ] Mobile: bell expands inline below topbar (not popover)
- [ ] Full-width panel, scrollable, max 50vh
- [ ] Auto-close on notification click
- [ ] "Hiển thị đã đọc" toggle works

---

### Story C.5.2 — Notification Click: Error Handling

**ID:** `F-HIGH-10` | **Priority:** Should | **Sprint:** 7.5 | **Owner:** FE-1 | **Est:** 3h | **Risk:** 🟡

**Dependencies:** Story A.5 (useVisibleMenu), Story C.2.2 (URL-synced tabs for deep-link target)
**Blocks:** None

**Files to create:**
- `src/lib/notifications/routing.ts`

**Files to modify:**
- `src/components/layout/topbar.tsx`
- `src/app/(protected)/notifications/page.tsx`
- `src/lib/types/notification.ts`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Add `targetTab` + `targetType` to Notification | S1: Add `targetTab?: string` and `targetType?: 'case' | 'customer' | 'report' | 'followup'` to `Notification` type · S2: Optional fields — backward-compatible | 0.5h |
| T2: Create routing helper | S1: `getNotificationTarget(n)` returns `{ href, tab? }` · S2: Map 14 event types to targets (e.g., `new_case` → `/cases/${caseId}?tab=info`, `postop_followup_due` → `/cases/${caseId}?tab=postop`) · S3: Fallback: invalid tab → `info`; missing permission → `/notifications` with toast; deleted entity → `/notifications` + error toast | 1.5h |
| T3: Update click handlers | S1: Topbar bell: use `getNotificationTarget()` instead of hardcoded paths · S2: Notifications page: same · S3: Disable click while in-flight (prevent double-navigate) · S4: On error, revert mark-as-read + show toast: "Không thể mở liên kết" | 1h |

**Acceptance Criteria:**
- [ ] Notification click lands on correct entity + tab
- [ ] Error handling: deleted entity → `/notifications` + toast
- [ ] No double-click navigation
- [ ] Mark-as-read reverts on navigation error

---

### Story C.5.3 — Followup Timeline Colors

**ID:** `F-HIGH-16` | **Priority:** Should | **Sprint:** 7.5 | **Owner:** FE-3 | **Est:** 4h | **Risk:** 🟢

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/components/followups/followup-list.tsx`
- `src/app/(protected)/followups/page.tsx`
- `src/app/(protected)/cases/[id]/page.tsx` (postop tab)

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Colored segments | S1: Red = overdue (past due date, not completed) · S2: Amber = due today · S3: Gray = upcoming (future) · S4: Green = completed · S5: Each segment is a horizontal bar with left color indicator | 2h |
| T2: Sticky headers per day | S1: Group followups by day (D1, D3, D7, etc.) · S2: Each group header sticks on scroll · S3: Show completion count per group (e.g., "D7 — 2/4 hoàn thành") | 1h |
| T3: Write test | S1: Test color mapping per status · S2: Test sticky header behavior | 1h |

**Acceptance Criteria:**
- [ ] Followup segments colored by status (red/amber/gray/green)
- [ ] Group headers stick on scroll
- [ ] Completion count per group visible

---

### Story C.5.4 — D1 Completion Ring-Stat on Dashboard

**ID:** `F-HIGH-30` | **Priority:** Should | **Sprint:** 7.5 | **Owner:** FE-3 | **Est:** 2h | **Risk:** 🟢

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/components/dashboard/stat-cards.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Compute D1 completion rate | S1: Count followups where `day === 'D1'` AND `status === 'done'` · S2: Divide by total D1 followups · S3: Display as ring-stat (progress ring) · S4: Green if ≥ 80%, red if < 80% | 1h |
| T2: Write test | S1: Test 8/10 completed → 80% → green · S2: Test 6/10 → 60% → red | 1h |

**Acceptance Criteria:**
- [ ] Dashboard shows D1 completion rate ring-stat
- [ ] Green ≥ 80%, red < 80%
- [ ] Ring shows percentage number in center

---

### Story C.5.5 — Active Filter Chips with X + "Xóa tất cả"

**ID:** `F-MED-05` | **Priority:** Should | **Sprint:** 7.5 | **Owner:** FE-1 | **Est:** 2h | **Risk:** 🟢

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/app/(protected)/audit-logs/page.tsx`
- `src/components/cases/case-list.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Add X icon to active chips | S1: Each active filter chip gets an X button · S2: Click X → removes that filter · S3: "Xóa tất cả bộ lọc" text button appears when ≥1 filter active | 1h |
| T2: Write test | S1: Test X removes individual filter · S2: Test "Xóa tất cả" clears all | 1h |

**Acceptance Criteria:**
- [ ] Active filter chips show X icon
- [ ] X removes individual filter
- [ ] "Xóa tất cả bộ lọc" clears all filters

---

### Story C.5.6 — Calendar: caseId Search-and-Select + Required

**ID:** `F-MED-11`, `F-MED-02` (carry) | **Priority:** Should | **Sprint:** 7.5 | **Owner:** FE-2 | **Est:** 4h | **Risk:** 🟡

**Dependencies:** None
**Blocks:** None

**Files to modify:**
- `src/app/(protected)/calendar/page.tsx`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Case search-and-select | S1: Replace free-text `caseId` input with search-and-select dropdown · S2: Search matches `caseCode`, customer `name`, customer `phone` · S3: Debounced (300ms) · S4: No "general" fallback — `caseId` is required | 2h |
| T2: Remove `'general'` fallback | S1: Remove any code that creates appointments with `caseId = 'general'` · S2: Show validation error if no case selected | 1h |
| T3: Write test | S1: Test search returns matching cases · S2: Test submit without case shows error · S3: Test `caseId = 'general'` never created | 1h |

**Acceptance Criteria:**
- [ ] Appointment creation requires case selection via search dropdown
- [ ] Search matches caseCode, name, phone
- [ ] No "general" fallback appointments
- [ ] A1 anti-pattern prevented

---

### Story C.5.7 — Hospital Tab (Coordinator/CSO/Admin Only)

**ID:** `F-MED-15` | **Priority:** Should | **Sprint:** 7.5 | **Owner:** FE-2 | **Est:** 5h | **Risk:** 🟡

**Dependencies:** Story A.5 (useVisibleMenu for role-checking pattern)
**Blocks:** None

**Files to modify:**
- `src/app/(protected)/cases/[id]/page.tsx`
- `src/constants/permissions.ts`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Define Hospital tab | S1: Add tab definition: key `hospital`, label "Bệnh viện", icon `Building2` · S2: Content: hospital coordination toggles, coordinator assignment, status tracking · S3: Gate behind `coordinator`, `cso`, `admin` roles via `hasPermission()` | 2h |
| T2: Role-gated rendering | S1: Only render Hospital tab in tab list if user role is in allowed list · S2: If URL has `?tab=hospital` but user not authorized → redirect to `?tab=info` + toast | 1.5h |
| T3: Write test | S1: Test coordinator sees Hospital tab · S2: Test sales_offline does NOT see it · S3: Test URL `?tab=hospital` redirected for unauthorized | 1.5h |

**Acceptance Criteria:**
- [ ] Hospital tab visible only to coordinator, cso, admin
- [ ] Unauthorized access via URL → redirect + toast
- [ ] Tab renders hospital coordination content

---

### Story C.5.8 — Replace Native `confirm()` on Remove Service

**ID:** `F-MED-01` (carry) | **Priority:** Should | **Sprint:** 7.5 | **Owner:** FE-1 | **Est:** 1h | **Risk:** 🟢

**Dependencies:** Story B.4.5 (primary confirm() replacement)
**Blocks:** None

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Verify no remaining `window.confirm` | S1: Grep `src/` for `window.confirm` · S2: If any remain, replace with `<ConfirmDialog>` | 1h |

**Acceptance Criteria:**
- [ ] Zero `window.confirm()` calls in entire `src/`

---

### Story C.5.9 — Nurse/CSKH Cancel Block

**ID:** `F-MED-14` | **Priority:** Should | **Sprint:** 7.5 | **Owner:** FE-1 | **Est:** 2h | **Risk:** 🟡

**Dependencies:** Story B.1.3 (server-side status enforcement)
**Blocks:** None

**Files to modify:**
- `src/constants/permissions.ts`
- `src/app/api/cases/[id]/status/route.ts`

| Task | Subtasks | Hours |
|------|----------|------:|
| T1: Split cancel roles | S1: Create `CASE_CANCEL_ROLES = ['admin', 'ceo', 'cso', 'master_sales']` (excluding `nurse`, `cskh_postop`) · S2: In status API, when `newStatus === 'cancelled'`, check against `CASE_CANCEL_ROLES` · S3: Return 403 if nurse/cskh_postop tries to cancel | 1h |
| T2: Hide cancel button in UI | S1: In `StatusWorkflow`, hide "Hủy ca" button if role not in `CASE_CANCEL_ROLES` | 0.5h |
| T3: Write test | S1: Test nurse gets 403 on cancel · S2: Test cskh_postop gets 403 · S3: Test admin succeeds | 0.5h |

**Acceptance Criteria:**
- [ ] Nurse and cskh_postop cannot cancel cases
- [ ] Server-side enforcement + UI hidden button
- [ ] Other roles (admin, ceo, cso, master_sales) can cancel

---

# VIEW 2 — SPRINT BACKLOGS

## Sprint 6.1 — Quick Win Blitz + UI Foundation

**Duration:** 5 dev-days (2 developers = 80h capacity)
**Theme:** Land low-risk fixes, component primitives, and shared config before clinical safety sprint.

| Story ID | Title | Owner | Est | Risk | Blocked By | Feature Flag |
|----------|-------|-------|----:|------|------------|-------------|
| A.1 | Tabs: ARIA + arrow-key | FE-1 | 6h | 🟡 | — | — |
| A.2 | Modal: focus trap + a11y | FE-2 | 5h | 🟡 | — | — |
| A.3 | CloseIconButton (new) | FE-1 | 2h | 🟢 | — | — |
| A.4 | Shared Textarea adoption | FE-2 | 2h | 🟢 | — | — |
| A.5 | Sidebar menu config (new) | FE-1 | 5h | 🔴 | — | `FEATURE_SHARED_MENU` |
| B.1.1 | CCCD fields in form | FE-2 | 3h | 🟢 | — | — |
| B.1.2 | Remove `scheduled` transition | FE-1 | 1h | 🟢 | — | — |
| B.1.3 | Server status enforcement | FE-1 | 3h | 🔴 | — | `FEATURE_SERVER_RBAC` |
| B.1.4 | Dashboard `lab_overdue_count` | FE-3 | 2h | 🟡 | — | — |
| B.1.6 | Complaint notification recipients | FE-3 | 2h | 🟢 | — | — |
| B.1.7 | Dynamic CSKH resolution | FE-2 | 2h | 🟢 | — | — |
| B.2.2 | `medical_alert_resolved` status | FE-1 | 2h | 🟡 | — | — |
| B.3.1 | Payment SoD (accountant) | FE-1 | 2h | 🔴 | — | — |
| B.3.3 | Pipeline rename + revenue annotation | FE-3 | 2h | 🟢 | — | — |

**Total:** ~39h across FE-1 (21h), FE-2 (12h), FE-3 (6h)
**Remaining capacity:** ~41h buffer (available for carry-over or tech debt)

### Sprint 6.1 Risk Callout
- **A.5 (Shared Menu):** 🔴 HIGH — Visual regression on 12 roles × sidebar. Ship behind `FEATURE_SHARED_MENU` flag. Paired review by FE-1 + FE-2.
- **B.1.3 (Server RBAC):** 🔴 HIGH — Permission regression risk. Ship behind `FEATURE_SERVER_RBAC` flag. Inventory all existing callers before merge.

### Sprint 6.1 Exit Criteria
- [ ] `tsc --noEmit` → 0 errors
- [ ] `npm run lint` → 0 warnings
- [ ] `npm run build` → 34 routes, 0 errors
- [ ] axe-core 0 critical on Tabs, Modal components
- [ ] CCCD fields render + persist in customer form
- [ ] `hospital_confirmed` → `scheduled` transition blocked
- [ ] Dashboard shows `lab_overdue_count` with red StatCard
- [ ] `medical_alert_resolved` terminal status exists
- [ ] Payment confirm blocked for accountants + creator-SoD
- [ ] 12 role sidebar visual regression: zero drift

---

## Sprint 6.2 — Clinical Gates

**Duration:** 5 dev-days (2 developers = 80h capacity)
**Theme:** Checklist gating, PII redaction, clinical escalation — highest patient-safety impact sprint.

| Story ID | Title | Owner | Est | Risk | Blocked By | Feature Flag |
|----------|-------|-------|----:|------|------------|-------------|
| B.2.1 | Checklist gate (6 items + allPassed) | FE-2 | 8h | 🔴 | A.1 (Tabs) | `FEATURE_CHECKLIST_GATE`, `FEATURE_CLINICAL_CHECKLIST` |
| B.2.3 | Audit PII redaction | FE-1 | 4h | 🟡 | — | — |
| B.2.4 | `procedure_completed` second-confirm | FE-2 | 4h | 🟡 | A.3 (CloseIconButton) | — |
| B.1.5 | Auto-escalate painLevel / issue_reported | FE-2 | 6h | 🟡 | — | — |

**Total:** ~22h across FE-1 (4h), FE-2 (18h)
**Remaining capacity:** ~58h buffer (FE-3 free, FE-1 has 36h)

### Sprint 6.2 Risk Callout
- **B.2.1 (Checklist Gate):** 🔴 HIGHEST — Ships behind `FEATURE_CHECKLIST_GATE`. Requires medical director sign-off on 6-item checklist. Dry-run on 3 historical cases before merge.
- **B.2.3 (PII Redaction):** 🟡 MEDIUM — Requires explicit allowlist. Visual diff on 5 historical audit logs. Risk #9 paired review.

### Sprint 6.2 Exit Criteria
- [ ] Checklist gate: 6 clinical items visible in case detail
- [ ] `allPassed=false` blocks `checked_in` / `in_procedure` / `medically_approved`
- [ ] Red banner displays when gate blocks
- [ ] `procedure_completed` shows second-confirm dialog
- [ ] `actualProcedureDate` required in confirm dialog
- [ ] Audit log diff does NOT contain `medicalNote`, `privacyNote`, `nationalIdNumber`
- [ ] `medical_alert` auto-escalated to doctor on painLevel ≥ 4
- [ ] Medical director sign-off on checklist items
- [ ] 3-case dry-run completed

---

## Sprint 6.3 — AppShell + Critical UX

**Duration:** 5 dev-days (2 developers = 80h capacity)
**Theme:** Mobile layout fix, next-owner visibility, UX consistency (native confirm → ConfirmDialog, profile placeholder).

| Story ID | Title | Owner | Est | Risk | Blocked By | Feature Flag |
|----------|-------|-------|----:|------|------------|-------------|
| B.4.1 | AppShell `min-h-screen` | FE-1 | 2h | 🔴 | — | `FEATURE_MINH_SCREEN` |
| B.4.2 | Next-owner banner | FE-2 | 5h | 🟡 | B.1.2 (transitions correct) | — |
| B.4.3 | Payment display names | FE-3 | 2h | 🟢 | — | — |
| B.4.4 | Topbar profile toast | FE-3 | 1h | 🟢 | — | — |
| B.4.5 | Native confirm → ConfirmDialog | FE-2 | 3h | 🟡 | A.3, B.2.4 | — |
| B.4.6 | Status filter responsive | FE-1 | 2h | 🟢 | — | — |

**Total:** ~15h across FE-1 (4h), FE-2 (8h), FE-3 (3h)
**Remaining capacity:** ~65h buffer

### Sprint 6.3 Risk Callout
- **B.4.1 (min-h-screen):** 🔴 HIGH — Visual regression on 5 routes × 3 viewports. Risk #6 paired review with ui-designer.

### Sprint 6.3 Exit Criteria
- [ ] Mobile Safari renders dashboard without URL-bar overlap
- [ ] No horizontal scroll at 360px on any route
- [ ] Case Info tab shows next-owner banner with role + name
- [ ] Payment list shows display names (not raw IDs)
- [ ] Profile "Hồ sơ" shows info toast
- [ ] Zero `window.confirm()` calls remain
- [ ] Status filter: chips on desktop, Select on mobile
- [ ] Visual regression green on 5 routes × 3 viewports

---

## Sprint 6.4 — Revenue Integrity

**Duration:** 5 dev-days (2 developers = 80h capacity)
**Theme:** Transactional payment confirm, bill recompute, revenue chart accuracy.

| Story ID | Title | Owner | Est | Risk | Blocked By | Feature Flag |
|----------|-------|-------|----:|------|------------|-------------|
| B.3.2 | Revenue tooltip | FE-3 | 1h | 🟢 | — | — |

**Total:** ~1h across FE-3
**Remaining capacity:** ~79h — Sprint 6.4 is lightweight by design. The main revenue integrity work (transactional confirm, bill recompute) was deprioritized from Phase B and moved to Phase C (Sprint 7.2–7.3) for stability. Sprint 6.4 ships only the low-risk tooltip. Use remaining capacity for:
- Bug fixes from Sprints 6.1–6.3
- Tech debt from earlier sprints
- Preparation for Phase C (Sprint 7.1–7.5)

### Sprint 6.4 Exit Criteria
- [ ] Revenue StatCard tooltip explains "chỉ tính thanh toán đã xác nhận"
- [ ] All Sprints 6.1–6.3 exit criteria still passing (no regression)
- [ ] Build + lint clean

---

## Sprint 7.1 — A11y Foundation

**Duration:** 5 dev-days (2 developers = 80h capacity)
**Theme:** WCAG 2.1 AA foundation — modal labels, tab ARIA consumers, mobile tab reflow.

| Story ID | Title | Owner | Est | Risk | Blocked By | Feature Flag |
|----------|-------|-------|----:|------|------------|-------------|
| C.1.1 | Modal close button label | FE-1 | 2h | 🟢 | A.3 (CloseIconButton) | — |
| C.1.2 | Case tabs: icon-only on mobile | FE-2 | 4h | 🟡 | A.1 (Tabs) | — |
| C.1.3 | Tabs ARIA on every consumer | FE-2 | 3h | 🟡 | A.1 (Tabs) | — |

**Total:** ~9h across FE-1 (2h), FE-2 (7h)
**Remaining capacity:** ~71h buffer

### Sprint 7.1 Exit Criteria
- [ ] axe-core: 0 critical on every route using Modal
- [ ] Case detail tabs show icon-only at `< sm`
- [ ] Every `<Tabs>` consumer has proper ARIA
- [ ] axe-core: 0 critical on all routes

---

## Sprint 7.2 — UI Library Refactor

**Duration:** 5 dev-days (2 developers = 80h capacity)
**Theme:** CurrencyInput, shared Tabs adoption on case detail, reports refetch, menu config verification.

| Story ID | Title | Owner | Est | Risk | Blocked By | Feature Flag |
|----------|-------|-------|----:|------|------------|-------------|
| C.2.1 | `<CurrencyInput>` (new) | FE-1 | 6h | 🟡 | — | — |
| C.2.2 | Case detail: adopt shared Tabs | FE-2 | 4h | 🟡 | A.1, C.1.2 | — |
| C.2.3 | Reports date filter refetch | FE-3 | 4h | 🟢 | — | — |
| C.2.4 | Shared menu config verify | FE-1 | 1h | 🟢 | A.5 | — |

**Total:** ~15h across FE-1 (7h), FE-2 (4h), FE-3 (4h)
**Remaining capacity:** ~65h buffer

### Sprint 7.2 Risk Callout
- **C.2.2 (Shared Tabs):** 🟡 URL-sync is prerequisite for notification deep-links (C.5.2). Must ship cleanly.
- **C.2.2 (shared menu carry):** Verify zero duplicated arrays, zero `as never`.

### Sprint 7.2 Exit Criteria
- [ ] CurrencyInput formats VND with thousand separators
- [ ] Case detail uses shared `<Tabs>` with `?tab=` URL sync
- [ ] Reports date range triggers refetch with "Đang lọc…" pill
- [ ] Zero duplicated menu arrays, zero `as never`
- [ ] A10 anti-pattern prevented (no raw numeric currency inputs)
- [ ] A7 anti-pattern prevented (no hand-rolled tabs)

---

## Sprint 7.3 — Forms + Inputs

**Duration:** 5 dev-days (2 developers = 80h capacity)
**Theme:** Doctor identity, procedure date enforcement, lab date validation, staff role labels.

| Story ID | Title | Owner | Est | Risk | Blocked By | Feature Flag |
|----------|-------|-------|----:|------|------------|-------------|
| C.3.1 | Doctor identity fields | FE-2 | 5h | 🟡 | — | — |
| C.3.2 | `actualProcedureDate` required | FE-1 | 2h | 🟡 | B.2.4 (confirm dialog) | — |
| C.3.3 | Lab date validation | FE-1 | 2h | 🟢 | — | — |
| C.3.4 | StaffAssignment role label | FE-3 | 2h | 🟢 | — | — |

**Total:** ~11h across FE-1 (4h), FE-2 (5h), FE-3 (2h)
**Remaining capacity:** ~69h buffer

### Sprint 7.3 Exit Criteria
- [ ] `medically_approved` requires doctor role + stores `approvedByDoctorId`
- [ ] `procedure_completed` requires `actualProcedureDate`
- [ ] `expectedLabDate > expectedProcedureDate` fails validation
- [ ] StaffAssignment shows `[Role] Name` format
- [ ] Backward-compatible: existing cases without new fields still render

---

## Sprint 7.4 — Consent + Privacy

**Duration:** 5 dev-days (2 developers = 80h capacity)
**Theme:** Consent binary enforcement, upload gate, deletion cascade, medical sub-permission.

| Story ID | Title | Owner | Est | Risk | Blocked By | Feature Flag |
|----------|-------|-------|----:|------|------------|-------------|
| C.4.1 | Server consent gate (image upload) | FE-1 | 5h | 🔴 | — | `FEATURE_CONSENT_GATE` |
| C.4.2 | Frontend visibility change guard | FE-2 | 4h | 🔴 | C.4.1 | — |
| C.4.3 | Consent PDF requirement | FE-2 | 4h | 🟡 | — | — |
| C.4.4 | Customer deletion cascade audit | FE-1 | 4h | 🟡 | — | — |
| C.4.5 | `medical_upload` permission | FE-1 | 3h | 🟡 | — | — |

**Total:** ~20h across FE-1 (12h), FE-2 (8h)
**Remaining capacity:** ~60h buffer

### Sprint 7.4 Risk Callout
- **C.4.1 (Consent Gate):** 🔴 HIGH — Privacy breach if bypassed. Ships behind `FEATURE_CONSENT_GATE`. Risk #4/5 paired review. Test 4 states (granted, pending, denied, missing). Refusal must log audit entry.
- **C.4.2 (Visibility Guard):** 🔴 HIGH — Refusal path must not silently succeed. Risk #5 paired review.

### Sprint 7.4 Exit Criteria
- [ ] Image upload with `public_marketing` fails when consent not granted
- [ ] Frontend warning modal appears on visibility change to `public_marketing`
- [ ] Dismiss = visibility unchanged (no silent success)
- [ ] Consent requires uploaded PDF to transition to `granted`
- [ ] Customer deletion cascades to all dependents with audit logs
- [ ] `medical_upload` permission restricted to doctor + nurse
- [ ] A14 + A23 anti-patterns prevented
- [ ] Audit log entry for every consent refusal

---

## Sprint 7.5 — Notifications + Filtering

**Duration:** 5 dev-days (2 developers = 80h capacity)
**Theme:** Notification bell UX, click handler, followup colors, filter chips, Hospital tab, calendar, cancel block.

| Story ID | Title | Owner | Est | Risk | Blocked By | Feature Flag |
|----------|-------|-------|----:|------|------------|-------------|
| C.5.1 | Notification bell inline (mobile) | FE-2 | 5h | 🟡 | A.5 | — |
| C.5.2 | Notification click + routing | FE-1 | 3h | 🟡 | C.2.2 (URL-sync tabs) | — |
| C.5.3 | Followup timeline colors | FE-3 | 4h | 🟢 | — | — |
| C.5.4 | D1 ring-stat on dashboard | FE-3 | 2h | 🟢 | — | — |
| C.5.5 | Active filter chips + X + "Xóa tất cả" | FE-1 | 2h | 🟢 | — | — |
| C.5.6 | Calendar caseId search + required | FE-2 | 4h | 🟡 | — | — |
| C.5.7 | Hospital tab (role-gated) | FE-2 | 5h | 🟡 | A.5 | — |
| C.5.8 | Remaining `confirm()` cleanup | FE-1 | 1h | 🟢 | B.4.5 | — |
| C.5.9 | Nurse/CSKH cancel block | FE-1 | 2h | 🟡 | B.1.3 | — |

**Total:** ~28h across FE-1 (8h), FE-2 (14h), FE-3 (6h)
**Remaining capacity:** ~52h buffer

### Sprint 7.5 Exit Criteria
- [ ] Mobile notification bell expands inline
- [ ] Notification click deep-links to correct entity + tab
- [ ] Followup timeline shows colored segments (red/amber/gray/green)
- [ ] D1 completion ring-stat on dashboard
- [ ] Filter chips have X icon; "Xóa tất cả bộ lọc" clears all
- [ ] Calendar requires case selection (no "general")
- [ ] Hospital tab visible only to coordinator/cso/admin
- [ ] Zero `window.confirm()` calls in entire codebase
- [ ] Nurse/cskh_postop cannot cancel cases
- [ ] A1 + A9 anti-patterns prevented

---

# RECOMMENDED IMPLEMENTATION ORDER

## Route Migration Order (by risk × traffic volume × role diversity)

| Order | Route | Phase | Changes | Rationale |
|------:|-------|-------|--------:|-----------|
| 1 | `/dashboard` | B.1, B.4, C.5 | 4 | Highest traffic, most roles, design system canary |
| 2 | `/cases/[id]` | A, B, C | **10** | Densest surface — 8 tabs, clinical gates, banners |
| 3 | `/customers/[id]` | B, C | 3 | Second detail page, CCCD fields |
| 4 | `/customers` | B | 2 | List page, CCCD rendering |
| 5 | `/cases` | B, C | 2 | Status filter responsive |
| 6 | `/payments` | B | 1 | Display names, SoD |
| 7 | `/payments/new` | C | 1 | CurrencyInput integration |
| 8 | `/cases/new` | C | 1 | Form validation |
| 9 | `/calendar` | B, C | 2 | Case search, required caseId |
| 10 | `/followups` | C | 2 | Timeline colors, D1 stat |
| 11 | `/reports` | B, C | 3 | Pipeline rename, revenue annotation, filter refetch |
| 12 | `/notifications` | C | 2 | Click handler, routing |
| 13 | `/audit-logs` | B | 1 | PII redaction |
| 14 | `/notifications` (topbar) | C | 3 | Bell inline, click handler, routing |
| 15 | `/settings/users` | — | 0 | No changes |
| 16 | `/settings/roles` | — | 0 | No changes |
| 17 | `/settings/services` | — | 0 | No changes |
| 18 | `/settings/treatment-locations` | — | 0 | No changes |
| 19 | `/login` | — | 0 | No changes |
| 20 | `/customers/new` | B | 1 | CCCD form |
| 21 | Global shell `(protected)/layout.tsx` | B | 1 | `min-h-screen` |

## Component Migration Order

| Order | Component | Phase | Reason |
|------:|-----------|-------|--------|
| 1 | `<CloseIconButton>` | A.3 | Pure leaf, no dependencies |
| 2 | `<Textarea>` (shared) | A.4 | Enforce adoption, minimal change |
| 3 | `<Modal>` (focus trap + a11y) | A.2 | Foundation for all modals |
| 4 | `<ConfirmDialog>` variants | B.2.4 | Depends on Modal + CloseIconButton |
| 5 | `<Tabs>` (ARIA + arrow-key) | A.1 | Foundation for all tab consumers |
| 6 | `<CurrencyInput>` | C.2.1 | Form inputs only |
| 7 | `useVisibleMenu` + `sidebar-menu.ts` | A.5 | Navigation consistency |
| 8 | `<StatCard>` (clickable + tooltip) | B.1, B.3 | Dashboard improvement |
| 9 | `<DataTable>` (compact variant) | C.1.2 | Mobile responsive |
| 10 | `<NextOwnerBanner>`, `<MedicalAlertBanner>`, `<BillRecomputeIndicator>` | B.4, C.5 | New composite components |

---

# FEATURE FLAGS

| # | Flag | Phase | Dev Default | Prod Default | Rollback Action |
|---|------|-------|-------------|--------------|-----------------|
| 1 | `NEXT_PUBLIC_FEATURE_CHECKLIST_GATE` | B.2 | `true` | `false` | Bypass gate; allow all transitions |
| 2 | `NEXT_PUBLIC_FEATURE_CONSENT_GATE` | C.4 | `true` | `false` | Allow all uploads; skip consent check |
| 3 | `NEXT_PUBLIC_FEATURE_PAYMENT_TX` | B.4 | `true` | `false` | Revert to non-transactional confirm |
| 4 | `NEXT_PUBLIC_FEATURE_SERVER_RBAC` | B.1 | `true` | `false` | Revert to client-only RBAC |
| 5 | `NEXT_PUBLIC_FEATURE_SHARED_MENU` | A.5 | `true` | `false` | Revert to inline menu arrays |
| 6 | `NEXT_PUBLIC_FEATURE_MINH_SCREEN` | B.4 | `true` | `false` | Revert to `h-screen` |
| 7 | `NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST` | B.2 | `true` | `false` | Hide 6 clinical items |
| 8 | `NEXT_PUBLIC_FEATURE_URL_TABS` | C.5 | `true` | `false` | Revert to useState tabs |
| 9 | `NEXT_PUBLIC_FEATURE_DASHBOARD_QUEUE` | B.4 | `true` | `false` | Revert to display-only stat cards |
| 10 | `NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE` | B.4 | `true` | `false` | Disable bill recompute indicator |

**Flag lifecycle:** Remove when feature stable for 2+ sprints with zero rollbacks. Removal is a refactor PR.

---

# DATA MIGRATIONS

| # | Migration | Type | Phase | Backward-Compat | Rollback |
|---|-----------|------|-------|-----------------|----------|
| D1 | Add `CaseRecord.approvedByDoctorId`, `medicalApprovedAt` | Schema extension | C.3 | ✅ Optional fields, no backfill | Drop fields |
| D2 | Add `medical_alert_resolved` status value | Enum extension | B.2 | ✅ New value only | Remove value |
| D3 | Add `attachments:medical_upload` permission | Permission extension | C.4 | ✅ Additive | Remove permission |
| D4 | Add `Consent.documentStoragePath` | Schema extension | C.4 | ✅ Optional field | Drop field |

All migrations are **additive only** — no field removals, no renames, no data transformation.

---

# ANTI-PATTERN ENFORCEMENT CHECKLIST

Every PR in Phase 6/7 must pass this scan before merge:

| # | Anti-Pattern | Check |
|---|--------------|-------|
| A1 | Silent fallback defaults (`caseId='general'`) | Grep for `'general'` as default |
| A2 | Raw IDs in UI | Grep for `user-001`, `case-001` in JSX |
| A3 | Ambiguous aggregates without tooltip | Check stat cards have tooltip/label |
| A4 | Conflated forecast/cash | Check reports label "Bill" vs "Doanh thu" |
| A5 | Decorative status indicators | Every colored element pairs with icon/text |
| A6 | Hidden-only permissions | Server-side RBAC in route handlers |
| A7 | Hand-rolled tabs/modals | Grep for inline `useState` tab patterns |
| A8 | Dead links | No href with "Đang phát triển" |
| A9 | Native `confirm()`/`alert()` | Grep `window.confirm`, `window.alert` |
| A10 | Raw numeric currency inputs | Use `<CurrencyInput>` |
| A11 | PII in audit diffs | `AUDIT_REDACTED_FIELDS` applied |
| A12 | Skipped clinical gates | Checklist `allPassed` enforced |
| A13 | Permissive transitions | `CASE_STATUS_TRANSITIONS` correct |
| A14 | Consent as progressive | Binary: granted or absent |
| A15 | Tasks on life-support | No new Tasks features |
| A16 | Media Library resurrected | Keep removed |
| A17 | Role-specific dashboards | Deferred to Phase 9 |
| A18 | Operational-risk page | Deferred to Phase 9 |
| A19 | CSV export | Deferred to Phase 9 |
| A20 | Custom date range | Deferred to Phase 9 |
| A21 | Logout confirmation | Rejected |
| A22 | Modal for 22-field form on mobile | Use full-screen sheet |
| A23 | Deletion without per-record audit | Cascade audit enforced |
| A24 | Same role create + confirm payment | SoD enforced |
| A25 | Timeline placeholder shipped | Keep as placeholder |

---

# SIGN-OFF MATRIX

| Gate | Sign-Off By | Scope | Gate # |
|------|-------------|-------|--------|
| Phase 6 Complete | Tech Lead | All code quality + build | G1 |
| Clinical Safety | Medical Director | F-CRIT-03, F-CRIT-10, F-HIGH-20 | G2 |
| Revenue Integrity | Accountant Lead | F-CRIT-06, F-CRIT-08, F-HIGH-28 | G3 |
| Privacy & PII | Data Privacy Lead | F-MED-17, F-HIGH-25, F-HIGH-26 | G4 |
| A11y Compliance | Tech Lead (axe-core) | 0 critical on 21 routes | G5 |
| Mobile Quality | UI Designer | Visual regression 5 devices | G6 |
| Release | CEO | Overall sign-off for `release/v6.0.0` | G7 |

---

# TESTING STRATEGY SUMMARY

| Layer | Tool | Scope | Sprint |
|-------|------|-------|--------|
| Unit (components) | Vitest + React Testing Library | All new/modified components | Each sprint |
| Unit (validators) | Vitest + Zod | All Zod schema changes | 6.1, 7.3 |
| Workflow (state) | Vitest state machine | Status transitions, consent flow | 6.2, 7.4 |
| Permission | Vitest + mock user fixtures | 12 roles × 35 permissions | 6.1, 7.4 |
| Security (audit) | Vitest + audit log mocks | PII redaction, SoD | 6.2, 6.4 |
| Integration (API) | Vitest + Next.js route mocks | Server RBAC, status enforcement | 6.1, 6.2 |
| A11y | axe-core | 21 routes × 0 critical | 7.1, after each phase |
| Mobile | Playwright + device matrix | iPhone SE, iPhone 12, Pixel 7, iPad Mini, Desktop | 6.3, after each phase |
| Visual regression | Playwright snapshot diffs | 21 routes × 3 viewports | Each sprint |
| Build regression | `tsc`, `lint`, `build` | Every PR | Each sprint |
| Bundle delta | `next build --analyze` | ≤ 5% increase | Each phase |
