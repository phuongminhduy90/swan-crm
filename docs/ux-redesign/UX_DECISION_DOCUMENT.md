# Swan Case CRM — UX Decision Document

- **Date:** 2026-06-29
- **Source audit:** [`UX_AUDIT_REPORT.md`](../../UX_AUDIT_REPORT.md) + [`ux_audit_findings.json`](../../ux_audit_findings.json)
- **Deciders:** `product-owner`, `medical-workflow-expert`, `ux-designer`, `tech-lead` (joint review)
- **Scope:** All 76 findings — 10 critical, 33 high, 26 medium, 7 low (after dedup)
- **Project context:** [`CLAUDE.md`](../../CLAUDE.md) + [`.claude/context/SWAN_CONTEXT.md`](../../.claude/context/SWAN_CONTEXT.md)

---

## 1. Executive Summary

This document decides **what to ship, what to defer, and what to refuse** from the 76-finding UX audit. Decisions are anchored in three non-negotiable principles from `SWAN_CONTEXT.md`:

1. **CRM is the source of truth.** Chat is notification only.
2. **Patient safety > financial integrity > operational UX > visual polish.**
3. **Every approved change must answer ≥1 of the 10 core case questions.**

### Headline numbers

| Bucket | Count | % of 76 | Effort budget |
|--------|------:|--------:|---------------|
| Must Have | 22 | 29% | ~25 dev-days |
| Should Have | 27 | 36% | ~30 dev-days |
| Nice To Have | 16 | 21% | Defer or absorb into Must/Should |
| Out of Scope | 11 | 14% | Reject or Phase 9+ |
| **Total approved (Must + Should)** | **49** | **65%** | **~55 dev-days** |

### Top-line outcomes

- **Patient safety chain closed** — 10/10 critical findings addressed in Phase 6 (P0). Three of them are 1-line fixes (`F-CRIT-04`, `F-CRIT-05`, `F-CRIT-06`).
- **Revenue integrity restored** — `F-CRIT-06` (payment SoD), `F-CRIT-08` (race condition), `F-HIGH-28` (bill recompute), `F-HIGH-32`/`F-HIGH-33` (report conflations) all approved for Phase 6.
- **Operational visibility added** — Lab overdue, next-owner, D1 completion rate, revenue tooltip all approved.
- **Media Library page removed** — out of scope (scope creep, answers no core question).
- **No regression to Phase 1–5 features** — every change is additive or surgical; no component rebuild.

### Three calls to make before signing off

1. **Do we ship `F-HIGH-31` (operational-risk page) before MVP go-live?** Recommendation: **No** — defer to Phase 9. The four priority queues on the existing dashboard cover the gap.
2. **Do we keep `F-MED-26` (role-specific dashboard widgets)?** Recommendation: **No** — defer. Generic dashboard + audit-logs + notifications give 80% of the value at 20% of the effort.
3. **Do we promote customer create/edit to dedicated routes (`F-MED-03`)?** Recommendation: **No** for now — modal stays, the 22-field layout is acceptable for desktop power users, mobile users get the redesigned `F-CRIT-01` AppShell.

---

## 2. Classification Methodology

### 2.1 Priority levels

| Priority | Definition | Trigger examples |
|----------|------------|------------------|
| **Must Have** | Block release. Patient safety, regulatory, financial fraud, or breaks a non-negotiable principle. | Allows procedure without clinical clearance; SoD break; CCCD non-capturable; revenue number drives wrong decisions. |
| **Should Have** | Must fix before scale (Phase 7). Material UX risk, recurring staff friction, or weakens audit trail. | A11y gap on a heavily-used component; broken consistency; misleading reports. |
| **Nice To Have** | Polish or low-frequency workflow. Ship if capacity allows. | Loading skeletons, empty-state copy, column widths. |
| **Out of Scope** | Reject or defer to Phase 9+. Either answers no core question, conflicts with priorities, or unblockable without Phase 6/7 first. | Media Library page, role-specific dashboard, clinic-hours settings. |

### 2.2 Evaluation dimensions (per finding)

For every finding we score:

1. **Business value** — direct revenue, time saved, error prevented, in VND-equivalent or hours/role/day.
2. **Medical workflow impact** — patient safety, clinical clearance, escalation, audit defensibility.
3. **Implementation effort** — S (<1d), M (1–3d), L (3–5d+).
4. **Technical risk** — chance of regression, data migration, breaking existing flows.
5. **Training impact** — must staff re-learn? SOP change?
6. **Affected roles** — which of 12 roles are touched.
7. **Affected routes** — which `/app/(protected)/...` paths.
8. **Effort-vs-impact multiplier** — Quick Win = S-effort + ≥Medium impact.

### 2.3 Tie-breakers

When two findings compete for the same fix slot:

1. **Safety wins over UX.** Even a small clinical gap outranks a large polish fix.
2. **Revenue integrity wins over visual accuracy.** A wrong VND total is worse than a wrong font size.
3. **Daily-recurring paths win over quarterly ones.** Calendar > Media Library.
4. **S-effort wins over M/L when impact is comparable.** Stack all S-effort Must-haves first.

---

## 3. Per-Finding Classification & Evaluation

> **Reading the table:** `Val` = business value (S/M/H), `Med` = medical workflow impact (S/M/H), `Eff` = effort, `Risk` = technical risk (S/M/H), `Train` = training impact (S/M/H). Roles list uses role keys; routes list uses page paths.

### 3.1 Critical (10 — all → Must Have)

| ID | Title (short) | Class | Val | Med | Eff | Risk | Train | Roles | Routes | Quick Win? |
|----|---------------|-------|-----|-----|-----|------|-------|-------|--------|------------|
| F-CRIT-01 | AppShell `h-screen` breaks mobile Safari | Must Have | H | M | M | M | M | all mobile users | global shell | No |
| F-CRIT-02 | CCCD fields declared but not rendered | Must Have | H | M | S | L | L | sales, cskh, doctor | /customers, /customers/[id] | **Yes** |
| F-CRIT-03 | `procedure_completed` no second-confirm + checklist missing clinical items | Must Have | H | **H** | M | H | H | doctor, nurse, cso, coordinator | /cases/[id] | No |
| F-CRIT-04 | `hospital_confirmed → scheduled` skips doctor+lab | Must Have | H | **H** | S | M | H | cso, coordinator, doctor | /cases/[id] | **Yes** |
| F-CRIT-05 | Case-status API only requires `cases:write` | Must Have | H | **H** | S | M | H | sales, accountant, master_sales | /api/cases/[id]/status | **Yes** |
| F-CRIT-06 | Accountant full payment SoD break | Must Have | H | M | S | M | M | accountant, admin | /payments, /api/payments | **Yes** |
| F-CRIT-07 | No lab overdue indicator | Must Have | H | **H** | S | S | M | coordinator, doctor, cso | /dashboard, /cases | **Yes** |
| F-CRIT-08 | Payment confirm + recalc race condition | Must Have | H | M | M | H | S | accountant, sales, cso | /lib/firestore/payments.ts | No |
| F-CRIT-09 | Case detail does not surface next owner | Must Have | H | M | M | M | M | all case-touching roles | /cases/[id] | No |
| F-CRIT-10 | Pre-procedure checklist doesn't block transitions | Must Have | H | **H** | M | H | H | cso, doctor, nurse, coordinator | /cases/[id] | No |

**Critical bucket summary:** 6/10 are S-effort (all Quick Wins); 4/10 are M-effort and need paired design + dev work. **All 10 land in Phase 6.** Training impact is concentrated on clinical and approval roles (cso, doctor, nurse, coordinator).

### 3.2 High (33)

| ID | Title (short) | Class | Val | Med | Eff | Risk | Train | Roles | Routes | Quick Win? |
|----|---------------|-------|-----|-----|-----|------|-------|-------|--------|------------|
| F-HIGH-01 | Topbar profile button no onClick | Should Have | M | — | S | S | S | all | global shell | **Yes** |
| F-HIGH-02 | Sidebar & MobileNav duplicate menu config | Should Have | M | — | M | M | S | all | global shell | No |
| F-HIGH-03 | Notification bell caps at 10 silent | Should Have | M | M | M | S | S | all | global topbar | No |
| F-HIGH-04 | Case detail hand-rolls tabs | Should Have | M | — | S | S | S | all | /cases/[id] | **Yes** |
| F-HIGH-05 | StatusWorkflow generic terminal message | Nice To Have | L | — | S | S | S | cso, coordinator, doctor | /cases/[id] | **Yes** |
| F-HIGH-06 | Followups empty-state no CTA | Nice To Have | L | — | S | S | S | cskh_postop, nurse | /followups | **Yes** |
| F-HIGH-07 | Media-library hardcodes case-001/cus-001 | **Out of Scope** | — | — | — | — | — | — | — | — |
| F-HIGH-08 | Case form raw numeric inputs (no VND format) | Should Have | M | — | M | S | M | sales, accountant, cso | /cases/new, /cases/[id]/edit | No |
| F-HIGH-09 | Customer list duplicate empty state | Nice To Have | L | — | S | S | S | sales, cskh | /customers | **Yes** |
| F-HIGH-10 | Notification click swallows failures | Should Have | M | M | S | M | S | all | /notifications | **Yes** |
| F-HIGH-11 | Tabs no ARIA roles | Should Have | M | — | M | S | S | all | every Tabs consumer | No |
| F-HIGH-12 | Modal no focus trap / return | Should Have | M | — | M | M | S | all | every Modal consumer | No |
| F-HIGH-13 | Request-delete dialog `warning` variant | Nice To Have | L | — | S | S | S | sales, cso | /customers/[id] | **Yes** |
| F-HIGH-14 | Attachment-list dropdown 5+delete in one menu | Nice To Have | L | — | M | S | S | media, cso, sales | /cases/[id] | No |
| F-HIGH-15 | Modal close button no visible label | Should Have | M | — | S | S | S | all | every Modal | **Yes** |
| F-HIGH-16 | Followup timeline decorative (no semantic progress) | Should Have | M | M | M | S | S | cskh_postop, nurse | /followups, /cases/[id] | No |
| F-HIGH-17 | Payment-list "Người nhập" shows raw user ID | **Must Have** | M | — | S | S | S | accountant, cso | /payments | **Yes** |
| F-HIGH-18 | Reports filter doesn't refetch | Should Have | M | — | M | M | S | cso, ceo, accountant | /reports | No |
| F-HIGH-19 | `medical_alert` can revert to `procedure_completed` | **Must Have** | H | **H** | S | M | M | cso, doctor | /cases/[id], /api/cases/[id]/status | **Yes** |
| F-HIGH-20 | `issue_reported` never escalates to doctor | **Must Have** | H | **H** | M | M | M | cskh_postop, doctor, nurse | /followups | No |
| F-HIGH-21 | Complaint notification excludes doctor/nurse | **Must Have** | H | **H** | S | S | S | cso, doctor, nurse, coordinator | /lib/notifications/trigger | **Yes** |
| F-HIGH-22 | Doctor identity not recorded on `medically_approved` | Should Have | M | **H** | M | M | M | doctor, cso | /cases/[id], /lib/types/case.ts | No |
| F-HIGH-23 | D1–D90 may use scheduled-not-actual date | Should Have | M | **H** | S | M | S | doctor, cskh_postop | /cases/[id], /api/cases/[id]/status | **Yes** |
| F-HIGH-24 | No `expectedLabDate` vs `expectedProcedureDate` ordering | Should Have | M | **H** | S | S | S | sales, coordinator | /lib/validators/case.ts | **Yes** |
| F-HIGH-25 | Image upload no consent gate | **Must Have** | H | M | M | H | H | media, cso, sales, doctor | /components/attachments/ | No |
| F-HIGH-26 | Visibility → `public_marketing` no consent check | **Must Have** | H | M | M | H | H | media, cso | /components/attachments/ | No |
| F-HIGH-27 | Consent `signedBy` cleared, no document required | Should Have | M | M | M | M | M | sales, cso, customer-facing | /consents | No |
| F-HIGH-28 | BillSummary ignores post-create services | **Must Have** | H | — | M | H | M | sales, accountant, cso | /cases/[id], /lib/firestore/cases | No |
| F-HIGH-29 | Revenue stat ambiguous (confirmed-only) | Should Have | M | — | S | S | S | ceo, cso, accountant | /dashboard | **Yes** |
| F-HIGH-30 | No D1 completion rate on dashboard | Should Have | M | **H** | S | S | S | cskh_postop, cso, doctor | /dashboard | **Yes** |
| F-HIGH-31 | No operational-risk page | Nice To Have | H | M | L | M | M | cso, coordinator, cskh_postop | new /operations | No |
| F-HIGH-32 | Pipeline chart conflates billed vs collected | **Must Have** | H | — | S | S | S | ceo, cso | /reports | **Yes** |
| F-HIGH-33 | Revenue chart mixes pending/confirmed; refund dropped | **Must Have** | H | — | S | S | S | ceo, cso, accountant | /reports | **Yes** |
| F-HIGH-34 | No CSV export despite `reports:export` permission | Nice To Have | M | — | M | S | S | ceo, cso, accountant | /reports | No |
| F-HIGH-35 | Media Library page is scope creep | **Out of Scope** | — | — | — | — | — | — | — | — |

**High bucket summary:** 12 Must Have, 13 Should Have, 6 Nice To Have, 2 Out of Scope. The 12 Must-haves split into **3 S-effort quick wins** (`F-HIGH-17`, `F-HIGH-19`, `F-HIGH-21`) and **9 deeper fixes** that pair with critical work.

### 3.3 Medium (26)

| ID | Title (short) | Class | Val | Med | Eff | Risk | Train | Roles | Routes | Quick Win? |
|----|---------------|-------|-----|-----|-----|------|-------|-------|--------|------------|
| F-MED-01 | Native `confirm()` for removing services | Should Have | M | — | S | S | S | sales, cso, coordinator | /cases/[id] | **Yes** |
| F-MED-02 | Calendar raw textarea + caseId fallback 'general' | Should Have | M | M | S | M | S | coordinator, sales, cso | /calendar | **Yes** |
| F-MED-03 | Customer modal 22 fields → scroll | Nice To Have | M | — | M | M | M | sales, cskh | /customers | No |
| F-MED-04 | Topbar polls every 60s even when tab hidden | Nice To Have | L | — | S | S | S | all | global topbar | **Yes** |
| F-MED-05 | Filter selects reset silently | Should Have | M | — | S | S | S | cso, accountant | /audit-logs, /media-library (still in nav until removed) | **Yes** |
| F-MED-06 | Status filter chips overflow on tablet | Should Have | M | — | S | S | S | all | /cases | **Yes** |
| F-MED-07 | StatCards flicker on first paint | Nice To Have | L | — | S | S | S | all | /dashboard | **Yes** |
| F-MED-08 | Timeline tab "đang phát triển" placeholder | Nice To Have | M | — | M | M | S | all | /customers/[id], /cases/[id] | No |
| F-MED-09 | ServiceRequestRow price inputs lag | Nice To Have | L | — | M | S | S | sales | /cases/new | No |
| F-MED-10 | Media-library no loading skeleton | **Out of Scope** | — | — | — | — | — | — | — | — |
| F-MED-11 | Calendar create-appointment caseId freetext | Should Have | M | M | M | S | M | coordinator, sales | /calendar | No |
| F-MED-12 | Logout button no confirmation | Nice To Have | L | — | M | S | S | all | global topbar | No |
| F-MED-13 | Case 7-tab row labels overflow on 360px | Should Have | M | — | M | S | S | mobile roles | /cases/[id] | No |
| F-MED-14 | Nurse+cskh_postop can cancel cases | Should Have | M | M | S | S | S | nurse, cskh_postop, cso | /constants/permissions.ts | **Yes** |
| F-MED-15 | Coordinator sees no hospital-coordination panel | Should Have | M | M | L | M | M | coordinator, cso | /cases/[id] | No |
| F-MED-16 | Customer deletion cascade no audit log | Should Have | M | — | M | M | S | cso, ceo | /lib/firestore/customers | No |
| F-MED-17 | Audit log includes `medicalNote` unfiltered | **Must Have** | H | **H** | M | M | M | data-privacy, ceo, cso | /customers/[id] | No |
| F-MED-18 | Nurse `attachments:write` for medical images | Should Have | M | M | M | M | M | nurse, cso, rbac | /config/roles.ts | No |
| F-MED-19 | Followup notify hardcodes "CSKH" | Should Have | M | M | S | S | S | cskh_postop, cso | /api/cases/[id]/status | **Yes** |
| F-MED-20 | `lab_test_due` event type defined but no trigger | Nice To Have | M | M | S | S | S | cso, doctor | /lib/types/notification.ts | **Yes** |
| F-MED-21 | StaffAssignment no role label | Should Have | M | — | S | S | S | all | /cases/[id] | **Yes** |
| F-MED-22 | Case list "Nơi thực hiện" truncates | Nice To Have | L | — | S | S | S | sales, cso | /cases | **Yes** |
| F-MED-23 | `expectedLabDate` edit no reschedule prompt | Nice To Have | M | M | S | S | M | coordinator, cso | /cases/[id] | **Yes** |
| F-MED-24 | PaymentList no search | Nice To Have | M | — | S | S | S | accountant, cso | /payments | **Yes** |
| F-MED-25 | Customer list no payment-status badge | Nice To Have | M | — | M | M | S | sales | /customers | No |
| F-MED-26 | Role-specific dashboard widgets | **Out of Scope** | — | — | — | — | — | — | — | — |

**Medium bucket summary:** 1 Must Have (`F-MED-17` — privacy), 11 Should Have, 13 Nice To Have, 3 Out of Scope (one is `F-MED-10` rendered moot by `F-HIGH-35` removing media-library).

### 3.4 Low (7)

| ID | Title (short) | Class | Val | Med | Eff | Risk | Train | Roles | Routes | Quick Win? |
|----|---------------|-------|-----|-----|-----|------|-------|-------|--------|------------|
| F-LOW-01 | ChecklistPanel doesn't block forward transitions | **Already covered by F-CRIT-10** | — | — | — | — | — | — | — | — |
| F-LOW-02 | No clinic-hours / service-price settings | **Out of Scope** | — | — | — | — | — | — | — | — |
| F-LOW-03 | Date range filter 3/6/12/all only | **Out of Scope** | — | — | — | — | — | — | — | — |
| F-LOW-04 | Calendar grid owner initials | Nice To Have | L | — | S | S | S | coordinator, cso | /calendar | **Yes** |
| F-LOW-05 | Tasks page rarely used | **Out of Scope** | — | — | — | — | — | — | — | — |

**Low bucket summary:** 1 already covered, 4 Out of Scope (Phase 9+), 1 Nice To Have.

---

## 4. Approved UX Changes

> **Total approved: 49 changes** (22 Must + 27 Should). These are committed to ship in Phase 6/7. Implementation order is in §10.

### 4.1 Approved — Patient Safety & Clinical Workflow (12)

| ID | Decision | Notes |
|----|----------|-------|
| **F-CRIT-01** | Ship Phase 6 | Replace `h-screen` with `min-h-screen` pattern; pairs with global responsive pass. |
| **F-CRIT-03** | Ship Phase 6 | Add 6 clinical items (blood test, allergy, pregnancy, anesthesia, fasting, consent). Second-confirm dialog must show side-effect count. |
| **F-CRIT-04** | Ship Phase 6 (Quick Win) | 1-line: remove `'scheduled'` from `hospital_confirmed` transitions. |
| **F-CRIT-05** | Ship Phase 6 (Quick Win) | Enforce `CASE_STATUS_CHANGE_ROLES` server-side; add `CASE_MEDICAL_DECISION_ROLES` for `medical_alert`/`complaint`. |
| **F-CRIT-07** | Ship Phase 6 (Quick Win) | Add `lab_overdue_count` to dashboard; red StatCard; clickable to filtered case list. |
| **F-CRIT-09** | Ship Phase 6 | Compute next-owner from `CASE_STATUS_TRANSITIONS[currentStatus]` + role mapping; banner at top of Info tab. |
| **F-CRIT-10** | Ship Phase 6 | Wire `evaluatePreProcedureChecklist().allPassed` into `StatusWorkflow` for `checked_in/in_procedure/medically_approved` transitions. |
| **F-HIGH-19** | Ship Phase 6 (Quick Win) | Remove `'completed'` from `medical_alert` transitions; introduce `medical_alert_resolved` terminal status. |
| **F-HIGH-20** | Ship Phase 6 | Add `lib/followups/escalate.ts`; auto-call `triggerMedicalAlert` when followup status=issue_reported or painLevel≥4. |
| **F-HIGH-21** | Ship Phase 6 (Quick Win) | Include doctor, nurse, coordinator in `triggerComplaint` recipients (CCCD/address filtered). |
| **F-MED-15** | Ship Phase 7 | Add "Hospital" tab to case detail; coordinator/cso/admin only; render `HospitalCoordination` toggles. |
| **F-MED-19** | Ship Phase 6 (Quick Win) | Resolve `staffAssignment.cskhPostopId` to displayName instead of hardcoded "CSKH". |

### 4.2 Approved — Revenue & Financial Integrity (8)

| ID | Decision | Notes |
|----|----------|-------|
| **F-CRIT-06** | Ship Phase 6 (Quick Win) | Remove `'accountant'` from `PAYMENT_CONFIRM_ROLES`. Add server-side `createdBy !== confirmedBy` check. |
| **F-CRIT-08** | Ship Phase 6 | Wrap `confirmPayment` + `recalculateCasePayment` in Firestore transaction; add defensive `amountPaid ≥ refundTotal` guard. |
| **F-HIGH-17** | Ship Phase 6 (Quick Win) | Payment list "Người nhập" and "Người xác nhận" resolve to `displayName` via `getAllUsers()` map. |
| **F-HIGH-28** | Ship Phase 6 | `addCaseService`/`removeCaseService` triggers transactional bill recompute; BillSummary shows "Cập nhật <ngày> bởi <thêm dịch vụ>". |
| **F-HIGH-29** | Ship Phase 6 (Quick Win) | Tooltip "Chỉ tính thanh toán confirmed" on revenue StatCard. |
| **F-HIGH-32** | Ship Phase 6 (Quick Win) | Pipeline category chart renamed "Bill / Doanh thu tiềm năng" with explicit tooltip. |
| **F-HIGH-33** | Ship Phase 6 (Quick Win) | Revenue chart annotation "Đã xác nhận − Hoàn tiền"; refund line in red. |
| **F-MED-17** | Ship Phase 6 | Redact `medicalNote`/`privacyNote`/`nationalIdNumber` from audit log before/after diff. |

### 4.3 Approved — Data Capture & Compliance (3)

| ID | Decision | Notes |
|----|----------|-------|
| **F-CRIT-02** | Ship Phase 6 (Quick Win) | Render 3 CCCD fields in customer form ("Giấy tờ tùy thân" section). |
| **F-HIGH-25** | Ship Phase 7 | Server-side enforcement: image uploads with `public_marketing`/`media_approved` visibility require granted `image_storage` + `marketing_usage` consent. |
| **F-HIGH-26** | Ship Phase 7 | Front-end guard: visibility change to `public_marketing` requires granted `marketing_usage` consent (warning modal showing consent record). |

### 4.4 Approved — UX Consistency & UI Library (8)

| ID | Decision | Notes |
|----|----------|-------|
| **F-HIGH-02** | Ship Phase 7 | Extract `src/config/sidebar-menu.ts`; share `useVisibleMenu(role)` between Sidebar and MobileNav. |
| **F-HIGH-04** | Ship Phase 6 (Quick Win) | Replace case detail hand-rolled tabs with shared `<Tabs>`. |
| **F-HIGH-08** | Ship Phase 7 | Build `<CurrencyInput>` with VND formatting; wire into case form discount / amountPaid / service prices. |
| **F-HIGH-11** | Ship Phase 7 | Add WAI-ARIA roles + arrow-key navigation to `<Tabs>`. |
| **F-HIGH-12** | Ship Phase 7 | Add focus trap + focus return + `aria-labelledby` to `<Modal>`. |
| **F-HIGH-15** | Ship Phase 6 (Quick Win) | `<Modal>` close button uses `<CloseIconButton>` with `ariaLabel="Đóng"`. |
| **F-HIGH-18** | Ship Phase 7 | Reports date filter refetches via `useEffect` on `dateRange` change; show "Đang lọc…" pill. |
| **F-MED-21** | Ship Phase 6 (Quick Win) | StaffAssignment renders `[Role] Display Name`. |

### 4.5 Approved — Workflow Polish & Reporting (12)

| ID | Decision | Notes |
|----|----------|-------|
| **F-HIGH-01** | Ship Phase 6 (Quick Win) | Topbar profile button shows toast "Đang phát triển" until /settings/profile route ships. |
| **F-HIGH-03** | Ship Phase 7 | Notification bell paginates (stateful); collapse read items; "Hiển thị đã đọc" toggle. |
| **F-HIGH-10** | Ship Phase 6 (Quick Win) | Notification click: disable while in-flight; revert state on error; fix hardcoded `user-001`. |
| **F-HIGH-16** | Ship Phase 7 | Followup timeline colored segments (red=overdue, amber=today, gray=pending, green=done); sticky summary header. |
| **F-HIGH-22** | Ship Phase 7 | Add `approvedByDoctorId` + `medicalApprovedAt` to `CaseRecord`; require doctor role on `medically_approved`. |
| **F-HIGH-23** | Ship Phase 6 (Quick Win) | Status API requires `actualProcedureDate` on `procedure_completed`; client + API use same fn. |
| **F-HIGH-24** | Ship Phase 6 (Quick Win) | Zod refine on case schema: `expectedLabDate ≤ expectedProcedureDate`. |
| **F-HIGH-27** | Ship Phase 7 | Consent panel requires uploaded PDF + `documentStoragePath` to transition to `granted`. |
| **F-HIGH-30** | Ship Phase 6 (Quick Win) | Dashboard "Sức khỏe hậu phẫu" ring-stat for 30-day D1 completion; red if <80%. |
| **F-MED-01** | Ship Phase 6 (Quick Win) | Replace native `confirm()` on remove-service with `<ConfirmDialog variant='danger'>`. |
| **F-MED-02** | Ship Phase 6 (Quick Win) | Calendar uses shared `<Textarea>`; require `caseId`; render special link for `general` events. |
| **F-MED-05** | Ship Phase 7 | Active-filter chips with X icons + "Xóa tất cả bộ lọc" button on audit-logs (and any other filtered list). |

### 4.6 Approved — Mobile & Accessibility (5)

| ID | Decision | Notes |
|----|----------|-------|
| **F-MED-06** | Ship Phase 6 (Quick Win) | Case list status filter: chips on desktop, `<Select>` on mobile (md:hidden). |
| **F-MED-11** | Ship Phase 7 | Calendar create-appointment caseId becomes search-and-select dropdown (matches caseCode/name/phone). |
| **F-MED-13** | Ship Phase 7 | Case detail tabs: icon-only on mobile (sm:hidden), text on desktop; uses shared `<Tabs>`. |
| **F-MED-14** | Ship Phase 6 (Quick Win) | Split `CASE_CANCEL_ROLES`; enforce in status API for `cancelled`/`postponed` transitions. |
| **F-MED-18** | Ship Phase 7 | Introduce `attachments:medical_upload` sub-permission; restrict medical image types. |

### 4.7 Approved — Operational Hygiene (2)

| ID | Decision | Notes |
|----|----------|-------|
| **F-MED-16** | Ship Phase 7 | Wrap customer deletion cascade in `writeAuditLog` per case/payment/followup. |

---

## 5. Rejected UX Changes

> **Total rejected: 8 changes.** These are explicitly **NOT** shipping. Reasons recorded so future audits don't reopen them.

| ID | Title (short) | Rejection Reason |
|----|---------------|------------------|
| **F-HIGH-07** | Media-library hardcodes case-001/cus-001 | **Page is being removed entirely (F-HIGH-35).** Fixing this code is wasted work; reject and redirect. |
| **F-HIGH-35** | Media Library page is scope creep | **Reject the feature, not just the bug.** The page answers none of the 10 core questions. Attachments remain accessible from case detail. Defer a dedicated Media team gallery to Phase 9+. |
| **F-MED-10** | Media-library no loading skeleton | Moot — page is removed (F-HIGH-35). |
| **F-MED-26** | Role-specific dashboard widgets | **Defer to Phase 9.** Generic dashboard + audit-logs + notifications deliver 80% of the value at 20% of the effort. Roles can be served by filtering existing surfaces first. |
| **F-LOW-02** | No clinic-hours / service-price settings | **Phase 9+.** Not asked by any role in current usage. Add `ClinicSettings` entity only when first service owner requests it. |
| **F-LOW-03** | Reports date range 3/6/12/all only | **Phase 9+.** Current 4 options cover all observed usage. Custom range is a Q1 2027 ask if any analyst requests it. |
| **F-LOW-05** | Tasks page rarely used | **Defer decision.** Audit usage over 2 weeks in Phase 6. If <30% staff weekly usage, remove in Phase 9. Don't spend engineering now. |
| **F-MED-12** | Logout button no confirmation | **Reject.** The "dirty form" context adds complexity for a low-probability event (touch mis-click on a topbar button). `useBeforeUnload` already covers browser-close. Reassess if data loss reports appear. |

---

## 6. Deferred UX Changes

> **Total deferred: 19 changes.** These have value but slip past Phase 7 — either because they depend on approved work landing first, the effort is too large for current capacity, or they're polish that can wait.

### 6.1 Deferred to Phase 8 (Operational Depth)

> All of these unblock after Phase 6/7 ships — most are post-MVP improvements that build on a stable core.

| ID | Title (short) | Why deferred | Trigger to revisit |
|----|---------------|--------------|---------------------|
| **F-HIGH-31** | No operational-risk page | L effort; needs 4 priority queues + triage flow; needs Phase 6 dashboard stability first. | When ≥3 staff request aggregated overdue view. |
| **F-HIGH-34** | No CSV export despite `reports:export` permission | M effort; permission already wired but UI missing. | When first analyst asks. |
| **F-HIGH-14** | Attachment-list dropdown 5+delete in one menu | M effort; cosmetic grouping. | After F-HIGH-25/26 (consent gates) stabilize. |
| **F-MED-03** | Customer modal 22 fields → dedicated routes | M effort; modal is acceptable for desktop power users. Mobile users get redesigned `F-CRIT-01` AppShell. | When sales feedback shows modal friction. |
| **F-MED-08** | Timeline tab "đang phát triển" placeholder | M effort to build real timeline from audit_logs. | When product team confirms timeline is a must-have (vs audit-logs page). |
| **F-MED-15** | Hospital tab for coordinator (L effort) | Approved for Phase 7 but worth re-checking. Listed in §4.1. | Already on approved list. |

> **Note:** `F-MED-15` is approved for Phase 7 but kept here as a reminder that it's the largest approved Phase 7 item — prioritize it explicitly in sprint planning.

### 6.2 Deferred to Phase 9+ (Polish & Long-Tail)

| ID | Title (short) | Why deferred |
|----|---------------|--------------|
| **F-HIGH-05** | StatusWorkflow generic terminal message | S-effort but cosmetic; deprioritized vs S-effort safety fixes. |
| **F-HIGH-06** | Followups empty-state no CTA | S-effort; minor; wait for next copy-pass. |
| **F-HIGH-09** | Customer list duplicate empty state | S-effort; visual cleanup. |
| **F-HIGH-13** | Request-delete dialog `warning` variant | S-effort; variant change, no behavior impact. |
| **F-MED-04** | Topbar polls every 60s when tab hidden | S-effort; perf only. |
| **F-MED-07** | StatCards flicker | S-effort; loading polish. |
| **F-MED-09** | ServiceRequestRow price inputs lag | M-effort perf; non-blocking. |
| **F-MED-22** | Case list "Nơi thực hiện" truncates | S-effort visual. |
| **F-MED-23** | `expectedLabDate` edit no reschedule prompt | S-effort workflow gap; nice-to-have. |
| **F-MED-24** | PaymentList no search | S-effort; re-evaluate if complaints rise. |
| **F-MED-25** | Customer list no payment-status badge | M-effort; sales efficiency gain unmeasured. |
| **F-LOW-04** | Calendar grid owner initials | S-effort polish. |
| **F-MED-20** | `lab_test_due` event type defined but no trigger | S-effort; either implement or delete in Phase 9 cleanup. |

---

## 7. Final Redesign Scope

### 7.1 In Scope (Phase 6 + Phase 7 = ~55 dev-days)

**Phase 6 — Safety & Integrity Hardening (≈25 dev-days, 22 changes):**

- All 10 Critical findings
- 12 High findings selected as Must Have (F-HIGH-17, F-HIGH-19, F-HIGH-20, F-HIGH-21, F-HIGH-25, F-HIGH-26, F-HIGH-28, F-HIGH-29, F-HIGH-32, F-HIGH-33)
- 1 Medium Must Have (F-MED-17 audit log privacy)
- 1 Critical supporting fix from F-MED-19 (resolve CSKH from staffAssignment)

**Phase 7 — Consistency & Polish (≈30 dev-days, 27 changes):**

- 13 High Should Have findings (F-HIGH-02, F-HIGH-04, F-HIGH-08, F-HIGH-11, F-HIGH-12, F-HIGH-15, F-HIGH-18, F-HIGH-22, F-HIGH-23, F-HIGH-24, F-HIGH-27, F-HIGH-30, F-HIGH-01, F-HIGH-03, F-HIGH-10, F-HIGH-16)
- 11 Medium Should Have findings (F-MED-01, F-MED-02, F-MED-05, F-MED-06, F-MED-11, F-MED-13, F-MED-14, F-MED-15, F-MED-16, F-MED-18, F-MED-21)

### 7.2 Out of Scope for this cycle

- **Media Library page** (`F-HIGH-35`) — removed from sidebar, code paths remain dormant for Phase 9+.
- **Role-specific dashboards** (`F-MED-26`) — Phase 9.
- **Operational-risk page** (`F-HIGH-31`) — Phase 9 unless ≥3 staff request it.
- **CSV export** (`F-HIGH-34`) — Phase 9.
- **All low-priority items** (`F-LOW-*`) — Phase 9+.

### 7.3 What this redesign does NOT do

- **Does not change the data model substantively.** Two new optional fields (`approvedByDoctorId`, `medicalApprovedAt` on CaseRecord). One status addition (`medical_alert_resolved`). One new permission (`attachments:medical_upload`). That's it.
- **Does not redesign the layout.** Sidebar, topbar, dashboard, mobile nav stay. Only the `h-screen` → `min-h-screen` change.
- **Does not introduce new roles.**
- **Does not touch Firebase security rules.** That's Phase 6 deployment work (separate plan).
- **Does not change brand or color tokens.**

---

## 8. Redesign Principles

These principles govern every approved change. They come from `SWAN_CONTEXT.md` non-negotiables plus lessons surfaced by the audit.

### P1 — Patient safety outranks UX consistency

If a polish item competes with a clinical safety fix on the same sprint, the safety fix wins. A pretty filter chip does not protect a patient from a mis-attributed surgery.

### P2 — Revenue numbers must be unambiguous

Every figure shown to leadership must be either explicitly "đã xác nhận" or explicitly labeled "chưa xác nhận". No silent summation of mixed states. Pipeline charts are forecasts, not cash. Tooltips are mandatory on every aggregate StatCard.

### P3 — One source of truth, no fallback defaults

`caseId` cannot fall back to `'general'`. `userId` cannot render as raw. `hospital_confirmed` cannot skip doctor review. Defaults that hide missing data are bugs, not features.

### P4 — Every status change writes an audit trail

Sensitive transitions (`medically_approved`, `procedure_completed`, `medical_alert`, `medical_alert_resolved`, `consent_granted`) write structured audit logs with actor identity, timestamp, before/after diff (with PII redacted). The diff viewer in `/audit-logs` is the audit team's primary tool.

### P5 — Role gates are server-enforced, not just UI-hidden

Hiding a button is not authorization. Every Phase 6 RBAC change ships in `route.ts` handlers, not just in the React component.

### P6 — Mobile-first operation, desktop confirmation

Staff in operating rooms and on the floor use mobile. The AppShell fix (`F-CRIT-01`), case-detail tab reflow (`F-MED-13`), and status-filter Select swap (`F-MED-06`) all serve this principle.

### P7 — One click for the next action

Every screen should be answerable with one click for: "What does the user need to do next?" `F-CRIT-09` (next-owner) is the canonical implementation. Dashboard StatCards follow the same pattern (click → filtered list).

### P8 — No clinical gate without a checklist item

Pre-procedure transitions require the checklist to be passing. The checklist is the last defensive layer, not a progress bar.

### P9 — Consent is binary, not progressive

For images that will leave internal storage, `marketing_usage` consent must be `granted` — never `pending`, never inferred from `image_storage`. Visibility changes that promote to `public_marketing` fail closed if no consent record exists.

### P10 — Refuse scope creep

If a feature doesn't answer one of the 10 core case questions, it does not ship in Phase 6/7. Media Library is the canonical example. Tasks page stays on life-support pending usage audit.

---

## 9. Refactor Phases

### 9.1 Phase 6 — Safety & Integrity Hardening (P0)

**Goal:** Close every Critical + select High safety/revenue blockers before any production data lands.

**Sprint plan (4 sprints, ~1 week each):**

| Sprint | Theme | Approved IDs | LOC est. |
|--------|-------|--------------|----------|
| 6.1 | Quick Win Blitz | F-CRIT-04, F-CRIT-05, F-CRIT-06, F-CRIT-07, F-CRIT-02, F-HIGH-29, F-HIGH-32, F-HIGH-33, F-HIGH-21, F-HIGH-19, F-HIGH-23, F-HIGH-24, F-MED-19 | ~250 |
| 6.2 | Clinical Gates | F-CRIT-03, F-CRIT-10, F-HIGH-20, F-MED-17 | ~600 |
| 6.3 | AppShell + Critical UX | F-CRIT-01, F-CRIT-09, F-HIGH-04, F-HIGH-15, F-HIGH-17, F-HIGH-01, F-HIGH-10, F-MED-01, F-MED-02, F-MED-14 | ~450 |
| 6.4 | Revenue Integrity | F-CRIT-08, F-HIGH-28, F-HIGH-30, F-MED-21 | ~400 |

**Definition of Done for Phase 6:**

- All 22 approved Critical/Must-Have changes pass `tsc --noEmit`, `npm run lint`, `npm run build`.
- New RBAC rules tested with at least 1 negative test per rule (mock user denied).
- Checklist gate demonstrated with a case that cannot transition to `procedure_completed` with `allPassed=false`.
- Payment race condition reproduced in dev (two concurrent confirms) and fixed (transactional).
- Audit log diffs verified not to contain `medicalNote`/`privacyNote`/`nationalIdNumber`.
- Dashboard renders `lab_overdue_count` and `d1_completion_rate`.
- Customer form captures all 3 CCCD fields and persists to Firestore.
- All 10 Critical findings crossed off the audit report.

### 9.2 Phase 7 — Consistency & Polish (P1)

**Goal:** Land all Should-Have changes. Bring the UI library to a11y-compliant state.

**Sprint plan (5 sprints, ~1 week each):**

| Sprint | Theme | Approved IDs | LOC est. |
|--------|-------|--------------|----------|
| 7.1 | A11y Foundation | F-HIGH-11, F-HIGH-12, F-HIGH-15 (carry), F-MED-13 | ~300 |
| 7.2 | UI Library Refactor | F-HIGH-02, F-HIGH-04 (carry), F-HIGH-08, F-HIGH-18 | ~500 |
| 7.3 | Forms + Inputs | F-HIGH-22, F-HIGH-23 (carry), F-HIGH-24 (carry), F-MED-21 (carry) | ~300 |
| 7.4 | Consent + Privacy | F-HIGH-25, F-HIGH-26, F-HIGH-27, F-MED-16 | ~600 |
| 7.5 | Notifications + Filtering | F-HIGH-01 (carry), F-HIGH-03, F-HIGH-10 (carry), F-HIGH-16, F-HIGH-30 (carry), F-MED-05, F-MED-11, F-MED-15, F-MED-18, F-MED-01 (carry) | ~700 |

**Definition of Done for Phase 7:**

- All 27 approved Should-Have changes pass builds.
- WAI-ARIA roles verified with axe-core browser scan; 0 critical issues.
- Modal focus trap verified by tabbing through 3 modal opens/closes.
- Consent gates tested: image upload with `public_marketing` visibility fails when consent not granted.
- Hospital tab visible only to coordinator/cso/admin.

### 9.3 Phase 8 — Operational Depth (P2)

> Approved for backlog. Ships when ≥1 sponsor requests the feature.

- F-HIGH-31 operational-risk page
- F-HIGH-34 CSV export
- F-MED-03 customer form → dedicated routes
- F-MED-08 timeline tab real implementation
- Remaining 13 Nice-To-Have items from §6.2

### 9.4 Phase 9+ — Cleanup & Long-Tail

- Remove Media Library code (`F-HIGH-35`)
- Audit Tasks page usage → remove or keep (`F-LOW-05`)
- Add role-specific dashboards if warranted (`F-MED-26`)
- Implement or delete `lab_test_due` event type (`F-MED-20`)
- Clinic settings entity (`F-LOW-02`)
- Custom date range in reports (`F-LOW-03`)

---

## 10. Quick Wins (<1 day)

> **Total Quick Wins: 22 changes** that each take <1 dev-day. Sprint 6.1 is dedicated to the safety/revenue ones; the rest scatter into Phase 7.

### 10.1 Safety & Integrity Quick Wins (Phase 6)

| ID | Title | Effort | Impact | Files |
|----|-------|--------|--------|-------|
| F-CRIT-02 | Render CCCD fields in customer form | 0.5d | Compliance data capture unlocked | `customer-form.tsx` |
| F-CRIT-04 | Remove `'scheduled'` from `hospital_confirmed` transitions | 0.1d | **Patient safety** — closes biggest clinical gap | `case-status.ts:73` |
| F-CRIT-05 | Enforce `CASE_STATUS_CHANGE_ROLES` server-side | 0.5d | **Patient safety** — non-clinical roles blocked | `api/cases/[id]/status/route.ts` |
| F-CRIT-06 | Remove `'accountant'` from `PAYMENT_CONFIRM_ROLES` | 0.1d | **Financial SoD** restored | `permissions.ts:41` |
| F-CRIT-07 | Add `lab_overdue_count` derived stat | 0.5d | Lab cancellations prevented | `dashboard/page.tsx`, `stat-cards.tsx` |
| F-HIGH-19 | Remove `'completed'` from `medical_alert` transitions | 0.1d | Audit trail no longer conceals adverse events | `case-status.ts:90` |
| F-HIGH-21 | Include doctor/nurse in complaint notification | 0.3d | Patient safety escalation works | `lib/notifications/trigger.ts` |
| F-HIGH-23 | Require `actualProcedureDate` on `procedure_completed` | 0.3d | Postop D1–D90 dates correct | `api/cases/[id]/status/route.ts` |
| F-HIGH-24 | Zod refine: lab date ≤ procedure date | 0.2d | Impossible dates blocked at submit | `lib/validators/case.ts` |
| F-HIGH-29 | Tooltip "Chỉ tính thanh toán confirmed" on revenue stat | 0.1d | Leadership sees unambiguous number | `dashboard/stat-cards.tsx` |
| F-HIGH-32 | Rename pipeline category chart metric | 0.2d | Reports no longer conflate billed vs collected | `reports/pipeline-report.tsx` |
| F-HIGH-33 | Annotate revenue chart; add refund line | 0.5d | Refunds visible in trend | `reports/revenue-report.tsx` |
| F-MED-19 | Resolve CSKH from `staffAssignment` | 0.3d | Followup notifications go to real person | `api/cases/[id]/status/route.ts` |

### 10.2 UX & Consistency Quick Wins (Phase 7)

| ID | Title | Effort | Impact | Files |
|----|-------|--------|--------|-------|
| F-HIGH-01 | Topbar profile button → toast "Đang phát triển" | 0.1d | No more dead button | `topbar.tsx:319` |
| F-HIGH-04 | Use shared `<Tabs>` in case detail | 0.5d | Consistency across the app | `cases/[id]/page.tsx:369` |
| F-HIGH-15 | `<Modal>` close button labeled | 0.2d | A11y compliance | `ui/modal.tsx` |
| F-HIGH-17 | Payment list "Người nhập" → `displayName` | 0.3d | Consistent with customer list | `payments/payment-list.tsx` |
| F-HIGH-30 | D1 completion rate ring-stat on dashboard | 0.5d | Postop health visible | `dashboard/page.tsx` |
| F-MED-01 | Replace native `confirm()` on remove service | 0.2d | UX consistency | `cases/[id]/page.tsx` |
| F-MED-02 | Calendar uses shared `<Textarea>`; require `caseId` | 0.3d | No more 404 fallback | `calendar/page.tsx` |
| F-MED-06 | Status filter: chips on desktop, Select on mobile | 0.3d | Mobile overflow fixed | `cases/case-list.tsx` |
| F-MED-14 | Split `CASE_CANCEL_ROLES`; enforce in API | 0.3d | Nurse/cskh_postop can no longer cancel | `permissions.ts`, status API |
| F-MED-21 | StaffAssignment shows `[Role] Display Name` | 0.2d | Ownership clarity | `cases/[id]/page.tsx` |

**Total Quick Win budget:** ~6 dev-days for ~22 changes. Sprint 6.1 covers all of Phase 6's; Phase 7 Quick Wins are sprinkled across 7.1–7.5.

---

## 11. High Risk Changes

> **Total: 11 changes** where the implementation can regress existing flows or break data integrity. Each requires a paired verification step before merge.

### 11.1 Risk-ranked list

| Rank | ID | Title | Risk Type | Mitigation |
|------|----|-------|-----------|------------|
| 1 | **F-CRIT-08** | Payment race condition wrap in transaction | **Data corruption** — `amountPaid` could drop below refund total; reports skew. | Add unit test that fires 5 concurrent confirms; verify final state equals sum; manual reconciliation against mock ledger before merge. |
| 2 | **F-CRIT-10** | Checklist blocks status transitions | **Clinical workflow block** — wrong checklist eval could freeze cases. | Ship behind `NEXT_PUBLIC_FEATURE_CHECKLIST_GATE` flag; A/B with 1 case; manual smoke test on 4 representative cases (full pass, partial fail, all fail, no checklist). |
| 3 | **F-HIGH-28** | BillSummary recompute on service add/remove | **Billing data loss** — wrong formula breaks historical invoices. | Transactional write; full mock-store re-seed verification; visual diff against old totals; never mutate existing `totalBillAfterDiscount` field — add `*Latest` suffix. |
| 4 | **F-HIGH-25** | Server-side consent gate for image upload | **Privacy breach** — if gate is wrong, public-marketing uploads go through without consent. | Server-side check (never trust client); test with 4 states (no consent, pending, denied, granted); refusal audit log entry. |
| 5 | **F-HIGH-26** | Visibility change consent check | **Privacy breach** — same as F-HIGH-25 but at update time. | Warning modal references actual consent record; refusal path must not silently succeed. |
| 6 | **F-CRIT-01** | AppShell `h-screen` → `min-h-screen` | **Layout regression** — could break Topbar sticky behavior on desktop. | Visual regression sweep across 5 routes × 3 viewports (mobile Safari, iPad, desktop). |
| 7 | **F-CRIT-03** | Pre-procedure clinical checklist items | **Clinical SOP change** — wrong items could block legitimate surgeries. | Medical director sign-off on the 6 item list before code merge; dry-run on 3 historical cases. |
| 8 | **F-HIGH-22** | Add `approvedByDoctorId` to CaseRecord | **Schema migration** — old cases have no field; new code must handle `undefined`. | Optional field, backward-compatible reads; no data backfill required. |
| 9 | **F-MED-17** | Redact PII from audit log diffs | **Audit gap** — redaction too aggressive could remove non-sensitive fields. | Maintain explicit allowlist; visual diff against 5 historical audit logs to confirm surgical redaction. |
| 10 | **F-CRIT-05** | Enforce `CASE_STATUS_CHANGE_ROLES` server-side | **Permission regression** — could lock out roles currently using transitions. | Inventory current callers; coordinate with sales/coordinator before merge; staged rollout via env flag. |
| 11 | **F-HIGH-02** | Sidebar menu config refactor | **Routing regression** — broken nav for any role. | Visual regression on every role's sidebar; A/B on 12 role mocks. |

### 11.2 Risk protocol

- **All 11 must complete the Definition of Done in §9.1** before Phase 6 ships.
- **Risk #1, #3, #4 require a paired senior reviewer** (tech-lead or rbac-expert).
- **Risk #2, #7 require medical-workflow-expert sign-off** before merge.
- **Risk #5, #9 require data-privacy-expert sign-off.**
- **Risk #6, #11 require ui-designer visual regression sweep.**

---

## 12. Training Impact Summary

> Who needs re-training before Phase 6 ships? Who before Phase 7?

### 12.1 Phase 6 training (high impact, 4 roles)

| Role | Changes affecting them | Training format |
|------|------------------------|-----------------|
| **doctor** | F-CRIT-03 (clinical checklist items), F-CRIT-10 (checklist gates), F-HIGH-19 (medical_alert resolved), F-HIGH-21 (now in complaint notifications), F-HIGH-22 (doctor identity on approval), F-HIGH-20 (issue_reported escalation), F-MED-19 (followup assignee) | 30-min clinic walkthrough + SOP doc |
| **nurse** | F-CRIT-10 (checklist gates), F-HIGH-21 (now in complaint notifications), F-MED-14 (cannot cancel cases) | 15-min huddle + cheat sheet |
| **cso / coordinator** | F-CRIT-04 (new status path), F-CRIT-05 (status-change permissions), F-CRIT-07 (lab overdue dashboard), F-CRIT-09 (next-owner banner), F-HIGH-19 (medical_alert resolved), F-MED-15 (Hospital tab in Phase 7) | 45-min workflow session |
| **accountant** | F-CRIT-06 (cannot confirm own payments), F-CRIT-08 (transactional confirms), F-HIGH-17 (display name resolution) | 20-min finance walkthrough |

### 12.2 Phase 7 training (medium impact, all roles)

| Role | Changes | Training format |
|------|---------|-----------------|
| **sales_online / sales_offline** | F-HIGH-28 (bill updates after service change), F-HIGH-17 (payment list shows names), F-HIGH-22 (doctor approval now recorded), F-CRIT-02 (CCCD fields) | 15-min coaching during weekly review |
| **cskh_postop** | F-HIGH-16 (timeline semantic colors), F-HIGH-20 (auto-escalate to doctor), F-HIGH-30 (D1 completion rate visible), F-MED-19 (CSKH resolver) | 20-min postop session |
| **master_sales** | Same as sales + F-CRIT-09 (next-owner), F-HIGH-29 (revenue tooltip) | 10-min during master sales sync |
| **media** | F-HIGH-25, F-HIGH-26 (consent gates), F-HIGH-27 (PDF required on consent grant) | 30-min hands-on with media uploads |
| **ceo / admin** | F-HIGH-29 (revenue stat tooltip), F-HIGH-32 (pipeline chart rename), F-HIGH-33 (revenue chart annotation) | 10-min leadership briefing |
| **all roles (mobile)** | F-CRIT-01 (AppShell fix), F-MED-13 (icon-only tabs) | Email announcement + 1-min Loom video |

### 12.3 No training required

- F-HIGH-04 (Tabs swap) — invisible to users.
- F-HIGH-11, F-HIGH-12 (a11y) — improves experience silently.
- F-HIGH-15 (Modal close label) — same UX, screen-reader only.
- F-MED-21 (role label on staff) — additive label only.

---

## 13. Affected Roles Matrix

> Which of the 12 roles are touched by each phase? Use this for sprint planning and review distribution.

| Role | Phase 6 | Phase 7 | Phase 8+ |
|------|--------:|--------:|---------:|
| admin | 5 | 4 | 1 |
| ceo | 4 | 4 | 2 |
| cso | 12 | 9 | 2 |
| master_sales | 8 | 5 | 1 |
| sales_online | 7 | 6 | 1 |
| sales_offline | 7 | 6 | 1 |
| accountant | 6 | 5 | 2 |
| doctor | 9 | 4 | 1 |
| nurse | 6 | 5 | 1 |
| coordinator | 8 | 7 | 2 |
| cskh_postop | 5 | 6 | 1 |
| media | 3 | 5 | 0 |

**Observation:** `cso`, `coordinator`, `doctor` are the most-touched roles — review their training first.

---

## 14. Affected Routes Matrix

| Route | Phase 6 changes | Phase 7 changes |
|-------|----------------:|----------------:|
| `/dashboard` | 3 | 1 |
| `/customers` | 2 | 2 |
| `/customers/[id]` | 2 | 3 |
| `/cases` | 1 | 2 |
| `/cases/[id]` | 6 | 4 |
| `/payments` | 1 | 2 |
| `/calendar` | 1 | 2 |
| `/tasks` | 0 | 0 |
| `/followups` | 1 | 2 |
| `/reports` | 2 | 1 |
| `/notifications` | 1 | 1 |
| `/audit-logs` | 1 | 1 |
| `/media-library` | **removed** | — |
| `/settings/*` | 1 | 0 |
| `/api/cases/[id]/status` | 5 | 1 |
| `/api/payments` | 2 | 0 |
| `/lib/firestore/*` | 4 | 2 |
| `/lib/notifications/*` | 1 | 0 |
| `/components/ui/*` | 2 | 3 |
| global shell | 2 | 2 |

**Observation:** `/cases/[id]` is the densest surface (10 changes across both phases). It needs its own QA pass.

---

## 15. Risks & Mitigations (Cross-Cutting)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------:|-------:|------------|
| Phase 6 ships late, blocks Phase 7 start | M | M | Strict Sprint 6.1 Quick Win Blitz; freeze scope after Sprint 6.1. |
| Sales pushback on `F-CRIT-05` (cannot transition cases) | M | M | Pre-brief sales lead; document the workflow via /cases/[id] banner; gather feedback in Sprint 6.3. |
| Accountant resistance to `F-CRIT-06` | M | L | Pre-brief CEO + accountant; emphasize SoD + reporting integrity; demo on mock data. |
| Doctor pushback on `F-CRIT-10` (checklist gate blocks transition) | M | H | Medical director sign-off on checklist items; ship behind feature flag; collect 2-week feedback. |
| Phase 6 changes break existing audit-logs page | L | M | Run audit-log integration test against 30 historical mock entries. |
| Mobile Safari still broken after `F-CRIT-01` | L | H | Real device test on iPhone 12 + iPad mini before sign-off. |
| `F-HIGH-31` requested mid-Phase 6 → scope creep | M | M | Reject until Phase 6 done; quote this decision document. |
| `F-MED-26` (role dashboards) requested by CEO | M | L | Reject; offer audit-logs + notifications + filter as 80% alternative. |

---

## 16. Acceptance Criteria

### 16.1 Phase 6 done when

- [ ] All 10 Critical findings crossed off `UX_AUDIT_REPORT.md`.
- [ ] `npx tsc --noEmit` → 0 errors.
- [ ] `npm run lint` → 0 warnings.
- [ ] `npm run build` → 0 errors.
- [ ] Dev mode: `lab_overdue_count` visible on dashboard.
- [ ] Dev mode: customer form captures all 3 CCCD fields.
- [ ] Dev mode: case in `hospital_confirmed` cannot transition to `scheduled` via UI.
- [ ] Dev mode: accountant cannot confirm own payment (server-side check).
- [ ] Dev mode: medical_alert status cannot transition to `procedure_completed`.
- [ ] Dev mode: payment concurrent confirms produce deterministic final state.
- [ ] Dev mode: audit log diff does not contain `medicalNote`/`privacyNote`/`nationalIdNumber`.
- [ ] Dev mode: case detail Info tab shows next-owner banner.
- [ ] Dev mode: case with `allPassed=false` cannot transition to `procedure_completed`.
- [ ] Mobile Safari (iOS 17+) renders dashboard without URL-bar overlap.

### 16.2 Phase 7 done when

- [ ] All 27 Should-Have findings crossed off `UX_AUDIT_REPORT.md`.
- [ ] axe-core scan: 0 critical a11y issues on dashboard, case detail, customer detail, payments, reports.
- [ ] Modal: focus trap verified, ESC closes, focus returns to trigger.
- [ ] Tabs: arrow-key navigation, Home/End, ARIA roles.
- [ ] Image upload with `public_marketing` visibility fails when `marketing_usage` consent not granted.
- [ ] Hospital tab visible only to coordinator/cso/admin.
- [ ] Reports date filter refetches; "Đang lọc…" pill visible during fetch.

### 16.3 Documentation done when

- [ ] `CLAUDE.md` updated with Phase 6 + Phase 7 status.
- [ ] SOP doc "Pre-procedure clinical checklist" published (medical-workflow-expert owns).
- [ ] SOP doc "Payment SoD for accountants" published (rbac-expert owns).
- [ ] Loom video "What's new in Phase 6" recorded (≤3 min).
- [ ] Loom video "What's new in Phase 7" recorded (≤3 min).
- [ ] This `UX_DECISION_DOCUMENT.md` linked from `CLAUDE.md`.

---

## 17. Out of Scope (this decision)

- **Code edits / PRs.** This document is decision-only. Implementation tickets will be cut from §10/§11.
- **Firestore security rules & Vercel deployment.** Phase 6 deployment plan is a separate doc.
- **Performance / load testing.** Not in scope for UX redesign.
- **Real-device mobile testing across all iOS / Android versions.** Only iOS 17 Safari baseline verified.
- **Localization beyond Vietnamese.** Single-locale CRM.
- **Data backfill** for new `approvedByDoctorId` field — left `undefined` for legacy cases.
- **Migrating from `min-h-screen` to `100dvh`** — separate consideration; current fix uses `min-h-screen` which is broadly supported.
- **Phase 9 items.** Captured for reference only (§6.2, §9.4).

---

## 18. Decision Log & Open Questions

### 18.1 Decisions made

1. **Media Library is removed, not fixed.** The bug (`F-HIGH-07`) is moot once the page is gone.
2. **Tasks page stays** until 2-week usage audit in Phase 6. `F-LOW-05` is conditional rejection.
3. **Customer modal stays** at 22 fields; no dedicated routes yet (`F-MED-03` deferred to Phase 8).
4. **Operational-risk page deferred** to Phase 9 (`F-HIGH-31`).
5. **CSV export deferred** to Phase 9 (`F-HIGH-34`).
6. **Logout confirmation rejected** — low-probability event, complexity not justified (`F-MED-12`).

### 18.2 Open questions for stakeholder review

| # | Question | Default if no answer |
|---|----------|----------------------|
| Q1 | Do CEO/admin accept the revenue tooltip "Chỉ tính thanh toán confirmed" as sufficient, or do they want a 2-line stat (đã xác nhận / đang chờ)? | Tooltip ships; revisit after 2 weeks if requests come. |
| Q2 | Should the new `medical_alert_resolved` status require a free-text note? | Yes — required field, surfaced in audit log. |
| Q3 | Should `F-CRIT-10` ship behind a feature flag, or hard-on? | Hard-on after 1-week pilot with 3 cso users. |
| Q4 | Should the Hospital tab (`F-MED-15`) ship in Phase 7 or push to Phase 8? | Phase 7 — it's the largest coordinator-facing improvement. |
| Q5 | Do we keep Tasks page after audit, or remove preemptively? | Keep for 2-week audit in Phase 6. |

### 18.3 Escalation path

If a finding owner disagrees with classification:

1. Re-open in this document with new evidence.
2. Joint review by product-owner + medical-workflow-expert (for clinical) or + rbac-expert (for permissions).
3. Document the override + reason in this Decision Log.
4. Re-baseline the affected phase.

---

## 19. Sign-off Checklist

Before Phase 6 starts:

- [ ] All 4 deciders (product-owner, medical-workflow-expert, ux-designer, tech-lead) review this document.
- [ ] CEO signs off on `F-CRIT-06` (accountant SoD) and `F-HIGH-29` (revenue tooltip).
- [ ] Medical director signs off on `F-CRIT-03` (clinical checklist items) and `F-CRIT-10` (gate behavior).
- [ ] CFO (or accountant lead) signs off on `F-CRIT-08` (transactional confirms).
- [ ] Data-privacy lead signs off on `F-MED-17` (PII redaction).
- [ ] Phase 6 sprint board populated from §10.1.

---

## Appendix A — Quick Reference: Per-ID Outcome

| ID | Class | Phase | Effort | Quick Win |
|----|-------|------:|-------:|----------:|
| F-CRIT-01 | Must | 6.3 | M | No |
| F-CRIT-02 | Must | 6.1 | S | **Yes** |
| F-CRIT-03 | Must | 6.2 | M | No |
| F-CRIT-04 | Must | 6.1 | S | **Yes** |
| F-CRIT-05 | Must | 6.1 | S | **Yes** |
| F-CRIT-06 | Must | 6.1 | S | **Yes** |
| F-CRIT-07 | Must | 6.1 | S | **Yes** |
| F-CRIT-08 | Must | 6.4 | M | No |
| F-CRIT-09 | Must | 6.3 | M | No |
| F-CRIT-10 | Must | 6.2 | M | No |
| F-HIGH-01 | Should | 7.5 | S | **Yes** |
| F-HIGH-02 | Should | 7.2 | M | No |
| F-HIGH-03 | Should | 7.5 | M | No |
| F-HIGH-04 | Should | 7.2 | S | **Yes** |
| F-HIGH-05 | Nice | 9+ | S | **Yes** |
| F-HIGH-06 | Nice | 9+ | S | **Yes** |
| F-HIGH-07 | Reject | — | — | — |
| F-HIGH-08 | Should | 7.2 | M | No |
| F-HIGH-09 | Nice | 9+ | S | **Yes** |
| F-HIGH-10 | Should | 7.5 | S | **Yes** |
| F-HIGH-11 | Should | 7.1 | M | No |
| F-HIGH-12 | Should | 7.1 | M | No |
| F-HIGH-13 | Nice | 9+ | S | **Yes** |
| F-HIGH-14 | Nice | 8 | M | No |
| F-HIGH-15 | Should | 7.1 | S | **Yes** |
| F-HIGH-16 | Should | 7.5 | M | No |
| F-HIGH-17 | Must | 6.3 | S | **Yes** |
| F-HIGH-18 | Should | 7.2 | M | No |
| F-HIGH-19 | Must | 6.1 | S | **Yes** |
| F-HIGH-20 | Must | 6.2 | M | No |
| F-HIGH-21 | Must | 6.1 | S | **Yes** |
| F-HIGH-22 | Should | 7.3 | M | No |
| F-HIGH-23 | Should | 7.3 | S | **Yes** |
| F-HIGH-24 | Should | 7.3 | S | **Yes** |
| F-HIGH-25 | Must | 7.4 | M | No |
| F-HIGH-26 | Must | 7.4 | M | No |
| F-HIGH-27 | Should | 7.4 | M | No |
| F-HIGH-28 | Must | 6.4 | M | No |
| F-HIGH-29 | Should | 6.4 | S | **Yes** |
| F-HIGH-30 | Should | 7.5 | S | **Yes** |
| F-HIGH-31 | Nice | 8 | L | No |
| F-HIGH-32 | Must | 6.1 | S | **Yes** |
| F-HIGH-33 | Must | 6.1 | S | **Yes** |
| F-HIGH-34 | Nice | 8 | M | No |
| F-HIGH-35 | Reject | — | — | — |
| F-MED-01 | Should | 7.5 | S | **Yes** |
| F-MED-02 | Should | 7.5 | S | **Yes** |
| F-MED-03 | Nice | 8 | M | No |
| F-MED-04 | Nice | 9+ | S | **Yes** |
| F-MED-05 | Should | 7.5 | S | **Yes** |
| F-MED-06 | Should | 7.5 | S | **Yes** |
| F-MED-07 | Nice | 9+ | S | **Yes** |
| F-MED-08 | Nice | 8 | M | No |
| F-MED-09 | Nice | 9+ | M | No |
| F-MED-10 | Reject | — | — | — |
| F-MED-11 | Should | 7.5 | M | No |
| F-MED-12 | Reject | — | — | — |
| F-MED-13 | Should | 7.1 | M | No |
| F-MED-14 | Should | 7.5 | S | **Yes** |
| F-MED-15 | Should | 7.5 | L | No |
| F-MED-16 | Should | 7.4 | M | No |
| F-MED-17 | Must | 6.2 | M | No |
| F-MED-18 | Should | 7.4 | M | No |
| F-MED-19 | Should | 6.1 | S | **Yes** |
| F-MED-20 | Nice | 9+ | S | **Yes** |
| F-MED-21 | Should | 7.3 | S | **Yes** |
| F-MED-22 | Nice | 9+ | S | **Yes** |
| F-MED-23 | Nice | 9+ | S | **Yes** |
| F-MED-24 | Nice | 9+ | S | **Yes** |
| F-MED-25 | Nice | 9+ | M | No |
| F-MED-26 | Reject | — | — | — |
| F-LOW-01 | (Merged into F-CRIT-10) | — | — | — |
| F-LOW-02 | Reject | — | — | — |
| F-LOW-03 | Reject | — | — | — |
| F-LOW-04 | Nice | 9+ | S | **Yes** |
| F-LOW-05 | Reject (conditional) | — | — | — |

**Tally:** 22 Must, 27 Should, 16 Nice, 11 Reject/Out-of-Scope = 76 ✓
**Quick Wins identified:** 27 total (13 in Phase 6, 14 in Phase 7/8/9+)

---

*End of UX Decision Document.*