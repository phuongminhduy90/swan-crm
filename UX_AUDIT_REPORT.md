# Swan Case CRM — UX Audit Report

- **Date:** 2026-06-29
- **Project:** Swan Case CRM (Next.js 14 + TypeScript + Firebase)
- **Auditors:** `ux-designer`, `medical-workflow-expert`, `product-owner` (3 parallel subagent)
- **Scope:** Toàn bộ UI (11 protected pages + 8 domain components + UI library)
- **Findings:** 76 total — **10 critical, 33 high, 26 medium, 7 low** (after dedup of 4 merge pairs)

---

## Executive Summary

### Top 3 Critical Issues (block release)

1. **F-CRIT-04 + F-CRIT-05 + F-CRIT-10 — Case-lifecycle safety chain has 3 broken links.** A case can move from `hospital_confirmed` directly to `scheduled` (skipping doctor review + lab). The status API only requires `cases:write` (granted to sales & accountant), not `CASE_STATUS_CHANGE_ROLES`. The pre-procedure checklist contains zero clinical safety items (no blood test, allergy, pregnancy, anesthesia, fasting, treatment-consent). Net: a non-clinical user can mark a surgery as `procedure_completed` without any clinical clearance — **direct patient-safety risk**.

2. **F-CRIT-06 — Accountant can both create and confirm payments** (full SoD break). Combined with the missing audit log in `confirmPayment`, the revenue ledger used for medical-resource decisions cannot separate enterer from confirmer. Financial fraud risk + reporting integrity broken.

3. **F-CRIT-07 + F-CRIT-09 — Dashboard has no operational-risk view.** No "lab overdue by N days" indicator (a 24–72h clinical window passes silently → surgery cancellations), no "next owner" surfaced on case detail (2.5h/day of Zalo chasing). The 10-question coverage matrix confirms questions 4, 7, 9, 10 are all `partial` — the case-management value proposition is half-built.

### Top 5 Quick Wins (high impact, ≤1 day each)

1. **F-CRIT-04** — Remove `'scheduled'` from `hospital_confirmed` transitions. **Effort: S.** 1-line change in `src/constants/case-status.ts:73`.
2. **F-CRIT-06** — Remove `'accountant'` from `PAYMENT_CONFIRM_ROLES`. **Effort: S.** 1-line change in `src/constants/permissions.ts:41`.
3. **F-CRIT-07** — Add `lab_overdue_count` derived stat to dashboard. **Effort: S.** Compute in `StatCards`, render as red StatCard.
4. **F-CRIT-02** — Render CCCD fields in customer form. **Effort: S.** Add a 4th form section with 3 Inputs.
5. **F-HIGH-29** — Add "Chỉ tính thanh toán confirmed" tooltip to revenue stat. **Effort: S.** 1 attribute change.

### Theme & Consistency Score: 7/10

- Premium theme is applied consistently (gradient, glass morphism, animation classes are reused).
- **Inconsistencies:** Sidebar and MobileNav duplicate menu config (F-HIGH-02). Customer form defaults CCCD fields but doesn't render them — silent schema/UI drift (F-CRIT-02). Payment list shows raw user ID while customer list resolves names (F-HIGH-17). Case detail hand-rolls tabs (F-HIGH-04) while customer detail uses the shared `<Tabs>`.

### 10 Core Case Questions Coverage

| # | Question | Coverage | Click Count | Gaps |
|---|----------|----------|-------------|------|
| 1 | Who is the customer? | ✅ good | 2 | No outstanding-balance badge (F-MED-25); Timeline placeholder (F-MED-08) |
| 2 | What service? | ✅ good | 1 | — |
| 3 | Total bill? | ⚠️ partial | 2 | Bill doesn't reflect post-create services (F-HIGH-28) |
| 4 | Paid amount? | ⚠️ partial | 2 | Race condition (F-CRIT-08); ambiguous stat (F-HIGH-29); no search (F-MED-24) |
| 5 | Remaining amount? | ✅ good | 1 | No aggregate at customer level (F-MED-25) |
| 6 | Where is it performed? | ✅ good | 1 | Column truncation (F-MED-22); chart conflates billed vs collected (F-HIGH-32) |
| 7 | When is lab test? | ⚠️ partial | 2 | No overdue indicator (F-CRIT-07); no auto-reschedule on edit (F-MED-23) |
| 8 | When is procedure? | ✅ good | 1 | — |
| 9 | Who owns each step? | ⚠️ partial | 3 | Next-owner not on info tab (F-CRIT-09); staff without role label (F-MED-21); calendar omits owner (F-LOW-04) |
| 10 | What is post-op status? | ⚠️ partial | 1 | No D1 completion rate (F-HIGH-30); no operational-risk page (F-HIGH-31) |

**Summary:** 5/10 `good`, 5/10 `partial`, 0/10 `missing`. Three partials (Q4, Q9, Q10) directly hurt daily operations.

---

## Findings by Severity

### 🔴 Critical (10 — block release)

| ID | Title | File:Line | Owner | Effort |
|----|-------|-----------|-------|--------|
| F-CRIT-01 | AppShell h-screen breaks mobile Safari and traps focus in nested scrollers | `src/components/layout/app-shell.tsx:13` | ui-designer | M |
| F-CRIT-02 | Customer form declares CCCD fields in defaultValues but never renders inputs | `src/components/customers/customer-form.tsx:76` | ui-designer | S |
| F-CRIT-03 | procedure_completed transition has no second-confirm AND pre-procedure checklist lacks clinical safety items | `src/app/(protected)/cases/[id]/page.tsx:413` + `src/lib/checklist/index.ts:110` | surgery-coordination-expert | M |
| F-CRIT-04 | hospital_confirmed can transition to scheduled without doctor review or lab | `src/constants/case-status.ts:73` | tech-lead | S |
| F-CRIT-05 | Case-status API only requires 'cases:write' — sales/accountant can transition into procedure_completed/medical_alert | `src/app/api/cases/[id]/status/route.ts:25` | rbac-expert | S |
| F-CRIT-06 | Accountant has full payment SoD break — can create AND confirm own payments | `src/constants/permissions.ts:41` | rbac-expert | S |
| F-CRIT-07 | No 'lab overdue by N days' indicator on dashboard | `src/app/(protected)/dashboard/page.tsx:54` | product-owner | S |
| F-CRIT-08 | Payment confirm + recalc race condition — amountPaid can drift on concurrent confirms | `src/lib/firestore/payments.ts:101` | tech-lead | M |
| F-CRIT-09 | Case detail does not surface 'next owner' on Info tab | `src/app/(protected)/cases/[id]/page.tsx:386` | product-owner | M |
| F-CRIT-10 | Pre-procedure checklist does not block transitions when clinical items are missing | `src/components/checklist/checklist-panel.tsx:79` | surgery-coordination-expert | M |

### 🟠 High (33 — must fix before scale)

> See `ux_audit_findings.json` `highFindings` for the full list. Highlights:

- **F-HIGH-04** Case detail hand-rolls tabs instead of using shared `<Tabs>` (consistency)
- **F-HIGH-08** Case form uses raw numeric inputs for discount/amountPaid — no VND format
- **F-HIGH-11 + F-HIGH-12** Tabs + Modal lack ARIA roles / focus trap (a11y)
- **F-HIGH-15** Modal close button has no visible label for keyboard users
- **F-HIGH-19** medical_alert can revert to procedure_completed (audit trail hole)
- **F-HIGH-25 + F-HIGH-26 + F-HIGH-27** Consent workflow gaps (no consent gate on image upload, no consent check on visibility promotion, signedBy cleared but no document)
- **F-HIGH-28** BillSummary doesn't include services added after case creation
- **F-HIGH-30** No aggregate D1-followup completion rate on dashboard
- **F-HIGH-31** No operational-risk page (overdue payments/labs/followups/complaints in one place)
- **F-HIGH-32** Pipeline category chart conflates billed vs collected revenue
- **F-HIGH-35** Media Library page is scope creep — remove or defer

### 🟡 Medium (26 — next sprint)

Native `confirm()` usage, raw textareas, Tab content overflow on mobile, status filter chip overflow on tablet, skeleton-loaders missing in places, payment-list no search, expectedLabDate edit doesn't reschedule calendar, etc.

> Full list in `ux_audit_findings.json` `mediumFindings`.

### 🟢 Low (7 — nice-to-have)

Tasks page usage audit, custom date range in reports, calendar grid staff initials, clinic-hours settings, etc.

> Full list in `ux_audit_findings.json` `lowFindings`.

---

## Findings by Domain

### Case Management (10 findings)

The heart of the CRM. Multiple critical issues here cluster around the safety chain:
- **F-CRIT-04, F-CRIT-05, F-CRIT-10** — broken safety gates (above)
- **F-HIGH-19** — medical_alert can revert to procedure_completed (conceals adverse events)
- **F-HIGH-22** — no doctor-identity record on medically_approved transition
- **F-HIGH-24** — no date-ordering validator (lab scheduled after procedure)
- **F-MED-20** — `lab_test_due` event type defined but no trigger exists
- **F-MED-23** — editing `expectedLabDate` doesn't reschedule calendar appointment

### Customer Management (5 findings)

- **F-CRIT-02** — CCCD fields not rendered (compliance)
- **F-HIGH-09** — duplicate empty state
- **F-HIGH-13** — request-delete dialog uses 'warning' variant (should be 'info')
- **F-MED-03** — 22-field modal forces scroll inside a centered modal
- **F-MED-25** — customer list no payment-outstanding badge

### Payment Flow (5 findings)

- **F-CRIT-06** — accountant SoD break
- **F-CRIT-08** — payment race condition
- **F-HIGH-28** — BillSummary doesn't reflect post-create services
- **F-HIGH-29** — dashboard stat ambiguous about confirmed-only
- **F-MED-24** — payment list no customer/case search

### Post-op Followup (4 findings)

- **F-HIGH-16** — timeline line is decorative; no semantic color/status
- **F-HIGH-20** — issue_reported never escalates to doctor
- **F-HIGH-21** — complaint notification excludes doctor/nurse
- **F-HIGH-23** — D1–D90 dueDate may use wrong date
- **F-MED-19** — assignee hardcoded as "CSKH" instead of staffAssignment

### Consent & Privacy (4 findings)

- **F-HIGH-25, F-HIGH-26, F-HIGH-27** — image upload / visibility change / signed-document gaps
- **F-MED-17** — audit log before/after diff includes medicalNote unfiltered

### Reports & Analytics (5 findings)

- **F-HIGH-32** — pipeline chart conflates billed vs collected
- **F-HIGH-33** — revenue trend chart mixes pending/confirmed; refund dropped
- **F-HIGH-34** — no CSV export despite `reports:export` permission existing
- **F-LOW-03** — only 4 date-range options (no quarter / custom)
- **F-LOW-04** — calendar grid omits owner

### Mobile UX (6 findings)

- **F-CRIT-01** — AppShell h-screen
- **F-HIGH-03** — notification bell caps at 10
- **F-MED-06** — status filter chips overflow on tablet
- **F-MED-13** — case detail 7-tab row labels overflow on 360px
- **F-MED-04** — topbar polls every 60s even when tab hidden
- **F-MED-08** — timeline tab is placeholder

### RBAC & Sensitive Data (5 findings)

- **F-CRIT-05, F-CRIT-06** — critical role gates
- **F-MED-14** — nurse+cskh_postop can cancel cases
- **F-MED-17** — audit log leaks medicalNote via diff
- **F-MED-18** — sales roles have attachments:write for medical images

### Operational Risk & Dashboard (5 findings)

- **F-CRIT-07, F-CRIT-09** — no overdue-lab indicator, no next-owner
- **F-HIGH-30** — no D1 completion rate
- **F-HIGH-31** — no operational-risk page
- **F-MED-26** — all roles share generic dashboard

### UX Library & Accessibility (7 findings)

- **F-HIGH-11, F-HIGH-12, F-HIGH-15** — Tabs/Modal a11y gaps
- **F-HIGH-04** — case detail hand-rolls tabs
- **F-HIGH-02** — sidebar/mobile-nav duplication
- **F-MED-07** — StatCards flicker
- **F-MED-10** — media-library no loading skeleton

### Hospital Coordination (2 findings)

- **F-MED-15** — coordinator sees no hospital-coordination panel
- **F-CRIT-04** — hospital_confirmed can skip medical gates

### Audit Log (3 findings)

- **F-HIGH-19** — medical_alert transition can hide adverse events
- **F-MED-16** — customer deletion cascade not logged per record
- **F-MED-17** — audit diff includes medicalNote unfiltered

---

## Findings by 10 Core Case Questions

| # | Question | Coverage | Critical Gaps |
|---|----------|----------|---------------|
| 1 | Who is the customer? | good | — |
| 2 | What service? | good | — |
| 3 | Total bill? | partial | F-HIGH-28 |
| 4 | Paid amount? | partial | F-CRIT-08, F-HIGH-29 |
| 5 | Remaining amount? | good | — |
| 6 | Where is it performed? | good | F-HIGH-32 |
| 7 | When is lab test? | partial | **F-CRIT-07** |
| 8 | When is procedure? | good | — |
| 9 | Who owns each step? | partial | **F-CRIT-09** |
| 10 | What is post-op status? | partial | F-HIGH-30, F-HIGH-31 |

---

## Roadmap (Prioritized by Impact × Effort)

| Priority | ID | Title | Owner | Effort | Impact |
|----------|----|-------|-------|--------|--------|
| P0 | F-CRIT-04 | Remove 'scheduled' from hospital_confirmed transitions | tech-lead | S | Patient safety |
| P0 | F-CRIT-05 | Enforce CASE_STATUS_CHANGE_ROLES in case-status API | rbac-expert | S | Patient safety |
| P0 | F-CRIT-06 | Remove accountant from PAYMENT_CONFIRM_ROLES | rbac-expert | S | Financial SoD |
| P0 | F-CRIT-10 | Gate status transitions on checklist.allPassed | surgery-coordination-expert | M | Patient safety |
| P0 | F-CRIT-02 | Render CCCD fields in customer form | ui-designer | S | Compliance |
| P0 | F-CRIT-03 | Add clinical safety items to pre-procedure checklist | surgery-coordination-expert | M | Patient safety |
| P0 | F-CRIT-01 | Fix AppShell h-screen for mobile Safari | ui-designer | M | Mobile UX |
| P1 | F-CRIT-07 | Add lab_overdue_count to dashboard | product-owner | S | Operational risk |
| P1 | F-CRIT-09 | Surface "next owner" on case Info tab | product-owner | M | Ownership |
| P1 | F-CRIT-08 | Wrap confirm + recalc in transaction | tech-lead | M | Revenue integrity |
| P1 | F-HIGH-19 | Remove 'completed' from medical_alert transitions | tech-lead | S | Audit trail |
| P1 | F-HIGH-22 | Record doctor identity on medically_approved | tech-lead | M | Audit trail |
| P1 | F-HIGH-23 | Require actualProcedureDate on procedure_completed | postop-process-expert | S | Postop accuracy |
| P1 | F-HIGH-25 | Server-side enforce consent for image uploads | consent-expert | M | Privacy/compliance |
| P1 | F-HIGH-26 | Block public_marketing without granted marketing consent | consent-expert | M | Privacy/compliance |
| P1 | F-HIGH-20 | Auto-escalate issue_reported followup to doctor | postop-process-expert | M | Patient safety |
| P1 | F-HIGH-28 | Recompute case bill after service add/remove | tech-lead | M | Revenue accuracy |
| P1 | F-HIGH-29 | Tooltip "Chỉ tính thanh toán confirmed" on stat | product-owner | S | Reporting clarity |
| P1 | F-HIGH-30 | Add D1 completion rate to dashboard | product-owner | S | Postop health |
| P2 | F-HIGH-02 | Extract sidebar menu config to shared module | tech-lead | M | Consistency |
| P2 | F-HIGH-04 | Use shared <Tabs> in case detail | ui-designer | S | Consistency |
| P2 | F-HIGH-11 | Add ARIA roles to <Tabs> | ui-designer | M | A11y |
| P2 | F-HIGH-12 | Add focus trap + return to <Modal> | ui-designer | M | A11y |
| P2 | F-HIGH-17 | Resolve payment-list 'Người nhập' to displayName | ui-designer | S | Consistency |
| P2 | F-HIGH-32 | Rename pipeline category chart metric | report-architect | S | Reporting accuracy |
| P2 | F-HIGH-33 | Annotate revenue chart; add refund line | report-architect | S | Reporting accuracy |
| P2 | F-HIGH-34 | Add CSV export to reports | report-architect | M | Reporting usability |
| P2 | F-HIGH-08 | Build <CurrencyInput> for case form | ui-designer | M | Form UX |
| P2 | F-MED-15 | Add Hospital tab for coordinator | surgery-coordination-expert | L | Hospital workflow |
| P3 | F-HIGH-35 | Remove /media-library from sidebar | product-owner | S | Scope creep |
| P3 | F-MED-08 | Build real timeline from audit_logs (or hide tab) | tech-lead | M | Deceptive UX |
| P3 | F-MED-25 | Add customer-list outstanding balance | product-owner | M | Sales efficiency |
| P3 | F-MED-26 | Add role-specific dashboard widgets (defer to phase 6) | product-owner | L | Future |
| P3 | F-MED-17 | Redact medicalNote from audit log diffs | data-privacy-expert | M | Privacy |
| P4 | F-LOW-* | Various (clinic hours, custom date range, etc.) | various | various | Polish |

---

## Quick-Win Sprint (1 week, 5 fixes)

If you can only ship 5 things this week:

1. **F-CRIT-04** — 1-line fix, closes biggest patient-safety gap.
2. **F-CRIT-06** — 1-line fix, restores payment SoD.
3. **F-CRIT-07** — Add `lab_overdue_count` StatCard to dashboard. ~30 LOC.
4. **F-CRIT-02** — Add 3-form-section "Giấy tờ tùy thân" to customer form. ~40 LOC.
5. **F-HIGH-29** — Tooltip on revenue stat. ~5 LOC.

Total: ~80 LOC, addresses 3 of 10 critical + 1 high. Recommended to deploy before any production data lands.

---

## Verification

How to verify the audit is complete and accurate:

1. ✅ All 76 findings in `ux_audit_findings.json` have a real `file` and `line` — no speculation.
2. ✅ All 10 critical findings cross-reference at least one of the 10 core case questions OR a non-negotiable principle from `SWAN_CONTEXT.md`.
3. ✅ Each finding has a concrete fix recommendation and an `owner` skill for assignment.
4. ✅ Cross-reference matrix in `ux_audit_findings.json` groups findings by domain for sprint planning.
5. ✅ 10-question coverage matrix honestly scores each question.
6. ✅ Severity scale: `critical` = potential patient harm OR data leak OR revenue-fraud OR blocks release; `high` = missing safety gate OR RBAC gap OR common-task friction; `medium` = UX polish; `low` = future enhancement.

---

## Out of Scope (this audit)

- Code edits / PRs (only findings + recommendations).
- Firestore security rules and Vercel deployment (Phase 6).
- Performance testing, load testing, real-Firestore-data validation.
- Mobile native testing (only static analysis of responsive classes).
- Localization (Vietnamese text only).
