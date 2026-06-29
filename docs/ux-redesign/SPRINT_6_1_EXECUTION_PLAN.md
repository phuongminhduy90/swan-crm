# Sprint 6.1 — Quick Win Blitz + UI Foundation

> **Date:** 2026-06-29
> **Sprint window:** 5 dev-days, 2 FEs (80h capacity, ~39h committed, ~41h buffer)
> **Theme:** Land low-risk fixes + design-system primitives so Sprint 6.2's clinical-gate work has stable foundation.
> **Inputs synthesized from:**
> - [`IMPLEMENTATION_BACKLOG.md`](IMPLEMENTATION_BACKLOG.md) View 2 (Sprint 6.1)
> - [`UI_REFACTOR_PLAN.md`](UI_REFACTOR_PLAN.md) §1 (Phase A), §5 (testing), §7 (rollback)
> - [`DESIGN_DIRECTION.md`](DESIGN_DIRECTION.md) §18 (anti-patterns), §14 (component standard)
> - File-state verification of the actual repo (see Appendix B)
> **Owners:** tech-lead (delivery), ui-developer (a11y), tester (test infra + verification), product-owner (scope)
> **Status:** Plan approved — execution to follow on branch `phase-6/sprint-6.1`

---

## Context — Why Sprint 6.1 now

Swan CRM ships Phases 1–5 across 34 routes and 12 roles. A 76-finding UX audit (`UX_AUDIT_REPORT.md`) flagged systemic gaps: hand-rolled tabs/modals, duplicated sidebar config between desktop and mobile, hidden-only RBAC (sales roles can flip `medical_alert`), and missing audit trails on payment confirms.

Sprint 6.1 is **Phase 6 Sprint 1 of 9** (the "Quick Win Blitz + UI Foundation" wave). It pairs foundation work (UI primitives every later story depends on) with surgical fixes to the worst audit findings (`F-CRIT-02`, `F-CRIT-04`, `F-CRIT-05`, `F-CRIT-06`, `F-CRIT-07`, `F-HIGH-02`, `F-HIGH-17`, `F-HIGH-19`, `F-HIGH-29`, `F-HIGH-32`, `F-HIGH-33`, `F-MED-19`, `F-MED-21`). Sprint 6.2 then layers clinical-gate work on top.

This plan sequences 14 stories from `IMPLEMENTATION_BACKLOG.md` View 2 (Sprint 6.1), verifies every file referenced in those stories, calls out newly discovered gaps (most importantly: **zero test infrastructure today**), and pre-builds a 19-commit sequence so each PR is reviewable in < 30 min.

---

## 1. Stories included in Sprint 6.1

Pulled verbatim from `IMPLEMENTATION_BACKLOG.md` View 2 — Sprint 6.1 table. 14 stories, ~39 h, no new primitives invented.

| ID | Title | Owner | Est | Risk | Flags | Backlog ref |
|---|---|---|---:|---|---|---|
| A.1 | Tabs: ARIA + arrow-key navigation | FE-1 | 6h | 🟡 | — | F-HIGH-11 |
| A.2 | Modal: focus trap + `aria-labelledby` + focus return | FE-2 | 5h | 🟡 | — | F-HIGH-12 |
| A.3 | CloseIconButton (new leaf primitive) | FE-1 | 2h | 🟢 | — | F-HIGH-15 |
| A.4 | Shared `<Textarea>` adoption + `aria-required` | FE-2 | 2h | 🟢 | — | F-MED-02 |
| A.5 | Shared sidebar menu config + `useVisibleMenu` | FE-1 | 5h | 🔴 | `FEATURE_SHARED_MENU` | F-HIGH-02 |
| B.1.1 | CCCD fields in customer form (Giấy tờ tùy thân) | FE-2 | 3h | 🟢 | — | F-CRIT-02 |
| B.1.2 | Remove `scheduled` from `hospital_confirmed` transitions | FE-1 | 1h | 🟢 | — | F-CRIT-04 |
| B.1.3 | Server-side role enforcement for case status | FE-1 | 3h | 🔴 | `FEATURE_SERVER_RBAC` | F-CRIT-05 |
| B.1.4 | Dashboard `lab_overdue_count` clickable StatCard | FE-3 | 2h | 🟡 | — | F-CRIT-07 |
| B.1.6 | Add doctor/nurse/coordinator to complaint notifications | FE-3 | 2h | 🟢 | — | F-HIGH-21 |
| B.1.7 | Resolve CSKH name dynamically from staff assignment | FE-2 | 2h | 🟢 | — | F-MED-19 |
| B.2.2 | `medical_alert_resolved` terminal status + transitions | FE-1 | 2h | 🟡 | — | F-HIGH-19 |
| B.3.1 | Remove accountant from `PAYMENT_CONFIRM_ROLES` + SoD check | FE-1 | 2h | 🔴 | `FEATURE_PAYMENT_SOD` | F-CRIT-06 |
| B.3.3 | Pipeline rename + revenue annotation + refund line | FE-3 | 2h | 🟢 | — | F-HIGH-32 / F-HIGH-33 |

**Plus 2 prerequisite infrastructure tasks** (NOT in the backlog, surfaced during file-state verification — see Risks §5):

| ID | Title | Owner | Est | Why it's in 6.1 |
|---|---|---|---:|---|
| INF-1 | Add Vitest + RTL + axe-core scaffolding + npm scripts | FE-1 | 3h | Every story in the backlog lists "Write unit tests" sub-tasks. Repo has zero test infrastructure today (no Vitest, no Playwright, no axe-core). Without INF-1, exit criteria "tests pass" cannot be met. |
| INF-2 | Add lightweight feature-flag helper (`useFeatureFlag` + `isFlagEnabled`) | FE-1 | 1.5h | Backlog flags `FEATURE_SHARED_MENU` and `FEATURE_SERVER_RBAC` for Stories A.5 and B.1.3. B.3.1 ships behind `FEATURE_PAYMENT_SOD` (added in this plan). Repo has no flag utility today. |

**Adjusted totals:** ~43.5 h committed (FE-1 ~26 h, FE-2 ~12 h, FE-3 ~6 h), leaving **~36.5 h buffer** for code review, paired-review on 🔴 stories, fix-ups, and tech-debt payoff.

### Sprint 6.1 explicitly does NOT include

- Checklist gate (`F-CRIT-10`) — Sprint 6.2 (medical director sign-off dependency)
- Audit PII redaction (`F-MED-17`) — Sprint 6.2
- `procedure_completed` second-confirm (`F-CRIT-03`) — Sprint 6.2
- Auto-escalate `painLevel ≥ 4` (`F-HIGH-20`) — Sprint 6.2
- AppShell `min-h-screen` (`F-CRIT-01`) — Sprint 6.3
- Next-owner banner (`F-CRIT-09`) — Sprint 6.3
- All Phase C work (Sprints 7.1–7.5)

---

## 2. Dependencies

### 2.1 Inter-story dependencies (within Sprint 6.1)

```
INF-1 (test infra) ──┬─→ A.1, A.2, A.3, A.4 (unit-testable primitives)
                     └─→ B.* unit-testable stories

INF-2 (flag helper) ─┬─→ A.5 (FEATURE_SHARED_MENU)
                     ├─→ B.1.3 (FEATURE_SERVER_RBAC)
                     └─→ B.3.1 (FEATURE_PAYMENT_SOD)

A.3 (CloseIconButton) ──→ (no consumers land in 6.1; becomes foundation for 6.2)

A.4 (Textarea) ──→ (no consumer migrations in 6.1; foundation)

A.5 (useVisibleMenu) ──→ (no downstream blockers in 6.1; foundation for 6.3 topbar)

B.1.2 (drop scheduled) ──→ B.1.3 (server role enforcement reads transitions)
                          B.2.2 (medical_alert_resolved modifies same file)
```

### 2.2 External dependencies (must exist or be created)

| Dependency | Status today | Action in 6.1 |
|---|---|---|
| `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@testing-library/user-event`, `axe-core` | ❌ Missing | **Add via INF-1** |
| `vitest.config.ts` + `src/test/setup.ts` | ❌ Missing | **Add via INF-1** |
| `package.json` `test` / `test:watch` scripts | ❌ Missing | **Add via INF-1** |
| Feature flag helper (read `NEXT_PUBLIC_FEATURE_*` env) | ❌ Missing | **Add via INF-2** |
| `src/config/sidebar-menu.ts` | ❌ Missing | **Create in A.5** |
| `src/lib/hooks/useVisibleMenu.ts` | ❌ Missing | **Create in A.5** |
| `src/components/ui/close-icon-button.tsx` | ❌ Missing | **Create in A.3** |
| `SENSITIVE_FIELD_ACCESS_ROLES` already includes 8 roles | ✅ Exists in `src/constants/permissions.ts:15-24` | Reuse for B.1.1 RBAC guard |
| `CASE_STATUS_TRANSITIONS` | ✅ Exists at `src/constants/case-status.ts:66-92` | Mutate for B.1.2 + B.2.2 |
| `CaseStatus` union | ✅ Exists in `src/lib/types/case.ts` | Extend for B.2.2 |
| `CASE_STATUS_HEX` + `CASE_STATUS_COLORS` + `CASE_STATUS_LABELS` | ✅ Exists | Extend for B.2.2 |
| `CASE_STATUS_CHANGE_ROLES` constant | ✅ Exists at `src/constants/permissions.ts:80-88` | Wire into B.1.3 (currently unused by route) |
| `PAYMENT_CONFIRM_ROLES` constant | ✅ Exists at `src/constants/permissions.ts:64-67` | Mutate for B.3.1 |
| `PAYMENT_CREATE_ROLES` constant | ✅ Exists | Used by B.3.1 fallback logic |
| `getAllUsers()` map helper | ✅ Exists (used in reports) | Reuse in B.1.7 |
| `writeAuditLog()` helper | ✅ Exists at `src/lib/firestore/audit.ts` | Use in B.1.3, B.1.6, B.1.7, B.3.1 |
| `triggerMedicalAlert()` + `triggerComplaint()` + `triggerPaymentConfirmedNotification()` | ✅ Exists at `src/lib/notifications/trigger.ts:91-176` | Extend in B.1.6 (add recipients), B.1.7 (resolve CSKH name) |

### 2.3 People dependencies (decisions resolved before merge)

| Story | Decision | Owner | Status |
|---|---|---|---|
| B.1.3 scope | "Only CASE_STATUS_CHANGE_ROLES" (sales roles lose status-change rights) | product-owner | ✅ Resolved (locked from AskUserQuestion) |
| B.3.1 scope | "Admin-only + SoD guard" (`PAYMENT_CONFIRM_ROLES = ['admin']`, no self-confirm) | CEO + accountant lead | ✅ Resolved (locked from AskUserQuestion) |
| B.2.2 label | Vietnamese label "Đã xử lý cảnh báo" + Lucide `CheckCircle` icon | ux-designer | 🟡 Cosmetic — default recommendation stands, ui-designer can override during Story B.2.2 |

---

## 3. Order of implementation

### 3.1 Why this order

1. **Foundation before features** — Test infra (INF-1) and flag helper (INF-2) unblock every story's verification step. UI primitives (A.3, A.4, A.1, A.2) ship before consumers.
2. **Additive quick wins before destructive fixes** — Render-only and copy-only changes (B.1.1, B.1.6, B.1.7, B.3.3) ship first because they have no rollback story needed.
3. **Static config before runtime RBAC** — `CASE_STATUS_TRANSITIONS` mutations (B.1.2, B.2.2) ship before route-level enforcement (B.1.3) so the route reads correct data.
4. **High-risk stories last, behind flags, with paired review** — B.3.1 (SoD), B.1.3 (server RBAC), A.5 (menu dedup) land at the tail so any regression is caught by already-shipped quick wins.
5. **Dashboard + reports polish early** — B.1.4 and B.3.3 are low-risk, low-coupling, perfect mid-sprint wins.

### 3.2 Sprint day-by-day plan

| Day | Morning (FE-1) | Morning (FE-2) | Afternoon (FE-1) | Afternoon (FE-2) | FE-3 |
|---|---|---|---|---|---|
| **Day 1** | INF-1: vitest+RTL scaffolding; INF-2: flag helper | A.2 Modal focus trap | A.3 CloseIconButton + unit test | A.2 Modal aria-labelledby + focus return | Standby (review) |
| **Day 2** | A.1 Tabs ARIA + arrow keys + roving tabindex | A.4 Textarea audit + aria-required | A.1 unit tests | A.2 unit tests | B.1.1 CCCD schema + form section |
| **Day 3** | A.5 sidebar-menu.ts + useVisibleMenu hook | B.1.1 unit tests + persistence verification | A.5 migrate sidebar.tsx → useVisibleMenu (flag OFF) | B.1.7 CSKH dynamic resolution | B.1.6 complaint recipients |
| **Day 4** | A.5 migrate mobile-nav.tsx (drop `as never`) + 12-role visual regression | B.2.2 `medical_alert_resolved` (transition + label + hex) | B.1.2 drop `scheduled` transition | B.1.4 dashboard `lab_overdue_count` StatCard + tooltip | B.3.3 pipeline rename + revenue annotation + refund line |
| **Day 5** | B.1.3 server role enforcement (FEATURE_SERVER_RBAC off by default) | B.1.3 unit + integration tests | B.3.1 SoD check + remove accountant + audit + integration tests | Full Sprint 6.1 regression sweep, axe-core run, exit criteria sign-off | Final smoke + visual regression snapshot |

(FE-3 contributes ~6h of stories — primarily the dashboard/reports polish — and reviews FE-1/FE-2 PRs in spare capacity.)

---

## 4. Files affected

### 4.1 Files to CREATE (7 files)

| Path | Story | Purpose |
|---|---|---|
| `vitest.config.ts` | INF-1 | Vitest + jsdom + RTL setup, `@/` alias resolve |
| `src/test/setup.ts` | INF-1 | `jest-dom` matchers, axe-core extend, global mocks |
| `src/test/test-utils.tsx` | INF-1 | Render with `AuthProvider` + `ToastProvider` wrappers |
| `src/lib/feature-flags.ts` | INF-2 | `isFlagEnabled(name)`, `useFeatureFlag(name)` hook |
| `src/components/ui/close-icon-button.tsx` | A.3 | Leaf primitive — Lucide `X`, 20×20, `ariaLabel="Đóng"`, focus ring |
| `src/config/sidebar-menu.ts` | A.5 | Single source of truth: `MENU_ITEMS`, `SETTINGS_SUB_ITEMS`, `BOTTOM_ITEMS` |
| `src/lib/hooks/useVisibleMenu.ts` | A.5 | Role-filtered menu hook using `hasPermission()` |

### 4.2 Files to MODIFY (existing)

**Component primitives (Stories A.1, A.2, A.4):**

- `src/components/ui/tabs.tsx` — add `role="tablist"`/`role="tab"`/`role="tabpanel"` (via parent-rendered panel hint), arrow-key handler, `Home`/`End`, roving `tabIndex` (A.1)
- `src/components/ui/modal.tsx` — add focus trap (focus first focusable on open, cycle on Tab/Shift+Tab), focus return on close, `titleId` prop → `aria-labelledby`, focus-on-open (A.2)
- `src/components/ui/textarea.tsx` — pass-through `aria-required`, add `aria-describedby` slot for errors (A.4)

**Layout (Story A.5):**

- `src/components/layout/sidebar.tsx` — replace inline arrays with `useVisibleMenu()`; remove `MENU_ITEMS`/`SETTINGS_SUB_ITEMS`/`BOTTOM_ITEMS` const declarations; gate behind `FEATURE_SHARED_MENU`
- `src/components/layout/mobile-nav.tsx` — same migration; replace `permission: string` with `permission: Permission`; remove all 3× `as never` casts; gate behind flag

**Domain types / validators (Stories B.1.1, B.2.2):**

- `src/lib/types/customer.ts` — add `nationalIdNumber?`, `nationalIdIssueDate?`, `nationalIdIssuePlace?` to `Customer`, `CreateCustomerInput`, `UpdateCustomerInput`
- `src/lib/validators/customer.ts` — extend Zod schema with 3 optional fields (12-digit pattern on `nationalIdNumber`)
- `src/lib/types/case.ts` — add `'medical_alert_resolved'` to `CaseStatus` union (28 → 29 values)

**Domain constants (Stories B.1.2, B.2.2, B.3.1):**

- `src/constants/case-status.ts` — remove `'scheduled'` from `hospital_confirmed` transitions (line 73); remove `'procedure_completed'` from `medical_alert` transitions (line 90); add `'medical_alert_resolved': []` and `'medical_alert' → ['medical_alert_resolved', 'complaint', 'completed']`; add label/color/hex entries; add `'medical_alert_resolved'` to `TERMINAL_STATUSES`
- `src/constants/permissions.ts` — change `PAYMENT_CONFIRM_ROLES` from `['admin','accountant']` to `['admin']`

**UI consumers:**

- `src/components/customers/customer-form.tsx` — add collapsible "Giấy tờ tùy thân" section with 3 fields, gated by `SENSITIVE_FIELD_ACCESS_ROLES` (B.1.1)
- `src/components/dashboard/stat-cards.tsx` — replace 4-card grid with 5-card grid (existing 4 + new `lab_overdue_count`); make all cards clickable Links with tooltips; add loading skeleton (B.1.4)
- `src/components/reports/pipeline-report.tsx` — add explanatory tooltip near title clarifying "Bill = tổng chưa xác nhận" (B.3.3)
- `src/components/reports/revenue-trend-chart.tsx` — add annotation "Đã xác nhận − Hoàn tiền" below chart; add red refund line (#EF4444); add tooltip for refund (B.3.3)
- `src/components/payments/payment-list.tsx` — fix hardcoded `canApprove = role === 'accountant' || 'admin'` to read `PAYMENT_CONFIRM_ROLES` (incidental cleanup during B.3.1 review; **does NOT change auth — B.3.1 owns the SoD contract**)

**API routes (Stories B.1.3, B.3.1):**

- `src/app/api/cases/[id]/status/route.ts` — add `CASE_STATUS_CHANGE_ROLES` server-side guard returning 403 for roles not in the list; add per-status role check for medical transitions (`medically_approved` requires doctor; `medical_alert` requires medical roles); gate behind `FEATURE_SERVER_RBAC`; add structured audit log entry
- `src/app/api/payments/[id]/confirm/route.ts` — add SoD check (`createdBy === confirmedBy` → 403); remove `accountant` from permitted roles at route layer; write structured SoD-violation audit log; gate behind `FEATURE_PAYMENT_SOD`

**Notifications (Stories B.1.6, B.1.7):**

- `src/lib/notifications/trigger.ts` — `triggerComplaint()` to also notify `doctor` + `nurse` + `coordinator` resolved from case staff assignment; filter out `nationalIdNumber`/`medicalNote`/`privacyNote` from payload (B.1.6)
- `src/lib/notifications/trigger.ts` (same file, different function) — replace hardcoded "CSKH" with `getAllUsers().get(staffAssignment.cskhPostopId)?.displayName ?? 'CSKH'`; same fix for any other notification referencing staff by raw ID (B.1.7)

**Configuration:**

- `package.json` — add `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `axe-core`, `@axe-core/react` to `devDependencies`; add scripts: `test`, `test:watch`, `test:cov`, `test:ui` (INF-1)
- `.env.local` — add `NEXT_PUBLIC_FEATURE_SHARED_MENU=false`, `NEXT_PUBLIC_FEATURE_SERVER_RBAC=false`, `NEXT_PUBLIC_FEATURE_PAYMENT_SOD=false` (defaults; all default **OFF** in production)

### 4.3 Anti-pattern scan (DESIGN_DIRECTION §18)

Before merge, every PR is scanned against the 25 anti-patterns. Stories in 6.1 specifically touch:

| A-# | Anti-pattern | 6.1 stories that must NOT introduce |
|---|---|---|
| A1 | Silent fallback defaults (`caseId='general'`) | None of 6.1 introduces `caseId`; B.1.7 CSKH fallback uses explicit `'CSKH'` literal (not `'unknown'`). |
| A2 | Raw user IDs in copy | **B.1.7 is the FIX for this**; B.1.6 must also resolve doctor/nurse IDs. |
| A6 | Hidden-only permissions | **B.1.3 + B.3.1 add server-side enforcement** (fix). UI-only hiding is insufficient. |
| A8 | Dead links | A.5 migration must preserve every existing link href. |
| A13 | Permissive transitions | **B.1.2 + B.2.2 are the FIX** (drop `scheduled` skip + drop `medical_alert → procedure_completed` backdoor). |
| A22 | Modal for 22-field form on mobile | B.1.1 CCCD section stays within Modal (deferred M7 sheet migration is Phase 7 scope). |

### 4.4 Files EXPLICITLY not touched in 6.1

(To prevent scope creep — all are Phase 7+ work.)

- `src/app/(protected)/cases/[id]/page.tsx` — touched in 6.2 (checklist gate) and 6.3 (next-owner banner), not 6.1
- `src/app/(protected)/layout.tsx` — touched in 6.3 (`min-h-screen`)
- `src/components/cases/status-workflow.tsx` — touched in 6.2 (second-confirm)
- `src/components/checklist/checklist-panel.tsx` — touched in 6.2
- `src/components/reports/` beyond pipeline-report + revenue-trend-chart — touched in 7.2 (CurrencyInput) / 7.5 (Hospital tab)
- `src/components/attachments/` — touched in 7.4 (consent gates)
- `src/components/consents/consent-panel.tsx` — touched in 7.4 (PDF requirement)
- `firestore.rules`, `storage.rules`, `firebase.json` — Phase 5 (remaining), separate epic
- `vercel.json`, deployment docs — Phase 5 (remaining), separate epic

---

## 5. Risks

### 5.1 Risk register (5 risks ranked by impact)

| # | Risk | Probability | Impact | Owner | Mitigation |
|---|---|---|---|---|---|
| **R1** | **🔴 No test infrastructure today.** Repo has zero Vitest, RTL, Playwright, axe-core. 9 of 14 stories list "Write unit tests" sub-tasks. Without INF-1, "tests pass" cannot be verified. | 100% (already true) | High — exit criteria gap | FE-1 | Land INF-1 (vitest+RTL+axe) on **Day 1 morning** before any other story. Story-level unit tests are co-located with their story; axe-core is added to setup.ts. |
| **R2** | **🔴 B.1.3 server-side RBAC breaks existing flows.** Current route checks only `cases:write` permission. Many roles (including `sales_online`, `sales_offline` per `ROLE_PERMISSIONS`) inherit `cases:write`. Adding `CASE_STATUS_CHANGE_ROLES` check wholesale will 403 them on any status change. | High | High — regression for sales roles | FE-1 + product-owner | **Inventory callers BEFORE coding.** Run grep on all `cases:write` consumers + status API usages. Gate behind `FEATURE_SERVER_RBAC` (default OFF in prod). Decision locked: Option A — sales roles lose status-change rights. **Pre-merge action**: notify sales team + product-owner; update workflow docs. |
| **R3** | **🔴 B.3.1 SoD check breaks the accountant happy path.** Current `confirmPayment` API lets an accountant confirm their own payment. Removing `accountant` from `PAYMENT_CONFIRM_ROLES` + adding SoD check will change who can confirm. | Medium | Medium — operational change | FE-1 + CEO + accountant lead | Gate change behind `FEATURE_PAYMENT_SOD` flag. Default OFF. Decision locked: Option A — `PAYMENT_CONFIRM_ROLES = ['admin']`, no self-confirm even for admin. **Pre-merge action**: notify accountant lead + CEO; new SOP "Admin confirms, accountant creates + reconciles". |
| **R4** | **🔴 A.5 shared menu visual regression.** Sidebar and MobileNav currently render identical menu for all 12 roles. Migrating to `useVisibleMenu(role)` filters per permission — there's a non-zero chance of subtle drift in active states, badge counts, or icon sizing. | Medium | Medium — visual + UX | FE-1 + ui-designer | Gate behind `FEATURE_SHARED_MENU`. Capture Playwright snapshot baseline **before** migration, diff **after**. Visual regression = 0 is exit criterion. Paired review with FE-2. |
| **R5** | **🟡 B.1.4 dashboard link target not yet supported.** Acceptance criterion: "Card links to `/cases?status=lab_overdue` filtered list". Current `/cases` page does not consume `?status=` query param. | Certain | Low — needs sub-task | FE-3 | Add `?status=` URL-sync to `case-list.tsx` as part of B.1.4 T1 (S1.5). 30-min sub-task. |

### 5.2 Risks explicitly mitigated by Sprint 6.1 design

- **Bundle bloat** — no new heavy deps. Only Vitest + RTL + axe-core (dev-only).
- **A11y regressions** — every primitive upgrade (A.1, A.2) is paired with axe-core scan; B.1.4 tooltip has `aria-describedby`.
- **PII regression** — B.1.6 explicitly filters `nationalIdNumber`/`medicalNote`/`privacyNote` from complaint payloads.
- **Audit-trail regression** — every status change (B.1.3) and payment confirm (B.3.1) and notification (B.1.6, B.1.7) writes a structured audit log.
- **Concurrent write race** — **NOT in 6.1 scope.** Sprint 6.4 deferred the transactional `confirmPayment` to Phase 7 (per BACKLOG); 6.1 only adds the SoD guard. Document this explicitly.

### 5.3 Risks intentionally NOT mitigated in 6.1 (deferred)

- Modal full-screen sheet on `< sm` (M7) — Phase 7
- 360 px horizontal scroll (M5) — already passes baseline; verified in 6.3 sweep
- CSV export (F-HIGH-34) — Phase 9
- Role-specific dashboards (F-MED-26) — Phase 9
- Operational-risk page (F-HIGH-31) — Phase 9

---

## 6. Test strategy

### 6.1 Test layers used in 6.1

Per `UI_REFACTOR_PLAN.md` §5.1, Sprint 6.1 uses Layers 1, 2, 3, 5, 6 (deferring 4, 7, 8, 9, 10 to later sprints because test infra for those doesn't exist yet).

| Layer | Tool | Coverage in 6.1 | Owner |
|---|---|---|---|
| 1. Functional unit | Vitest + RTL | All new/modified pure functions (`getAllowedTransitions`, `hasPermission`, `isFlagEnabled`, `useVisibleMenu`) | FE-1 / FE-2 |
| 2. Validation | Vitest + Zod | Customer Zod schema (CCCD fields), `CASE_STATUS_TRANSITIONS` matrix, `PAYMENT_CONFIRM_ROLES` invariants | FE-1 / FE-2 |
| 3. Workflow | Vitest state machine | All 28 → 29 CaseStatus transitions, role × status matrix, accountant SoD | FE-1 + rbac-expert |
| 5. Security | Vitest + audit log mocks | Complaint payload PII filter, SoD audit log on confirm | data-privacy-expert |
| 6. Integration | Vitest + Next.js route handler mocks | `/api/cases/[id]/status` role enforcement, `/api/payments/[id]/confirm` SoD check | FE-1 |

Layers **4 (permission matrix)**, **7 (perf)**, **8 (data integrity / Firestore tx)**, **9 (mobile)**, **10 (regression snapshots)** are deferred to Sprints 6.2–7.5 where they apply.

### 6.2 Test files to create

| Test file | Covers story | Required cases |
|---|---|---|
| `src/components/ui/__tests__/sample.test.tsx` | INF-1 | Smoke test that `expect(1+1).toBe(2)` passes through Vitest + jsdom |
| `src/lib/feature-flags.test.ts` | INF-2 | `isFlagEnabled('FOO')` reads `NEXT_PUBLIC_FOO`; defaults to false when missing |
| `src/components/ui/__tests__/tabs.test.tsx` | A.1 | ARIA roles render; arrow keys cycle; Home/End jump; roving `tabIndex` |
| `src/components/ui/__tests__/modal.test.tsx` | A.2 | First focusable focused on open; Tab cycles; ESC closes; focus returns to trigger; `aria-labelledby` points to title |
| `src/components/ui/__tests__/close-icon-button.test.tsx` | A.3 | `ariaLabel` renders as `aria-label`; click fires `onClose` |
| `src/components/ui/__tests__/textarea.test.tsx` | A.4 | `required` → `aria-required`; `error` → `aria-describedby` |
| `src/lib/hooks/__tests__/useVisibleMenu.test.ts` | A.5 | Returns correct items per role (admin = all; media = subset); no `as never` |
| `src/lib/validators/__tests__/customer.test.ts` | B.1.1 | CCCD fields validate; 12-digit pattern rejects; all 3 fields persist round-trip |
| `src/constants/__tests__/case-status.test.ts` | B.1.2 + B.2.2 | `getAllowedTransitions('hospital_confirmed')` excludes `'scheduled'`; `getAllowedTransitions('medical_alert')` excludes `'procedure_completed'`; `medical_alert_resolved` has no outgoing transitions |
| `src/app/api/cases/[id]/status/__tests__/route.test.ts` | B.1.3 | 403 for `media`; 200 for `cso` on valid transition; 400 on `hospital_confirmed → scheduled`; 403 for `sales_online`; audit log written |
| `src/app/api/payments/[id]/confirm/__tests__/route.test.ts` | B.3.1 | 403 for `accountant`; 403 when `createdBy === confirmedBy`; 200 when `admin` confirms other's payment; SoD violation logged |
| `src/lib/notifications/__tests__/trigger.test.ts` | B.1.6 + B.1.7 | Complaint recipients include doctor/nurse/coordinator; payload excludes PII; CSKH name resolves from staff assignment; falls back to literal `'CSKH'` |
| `src/components/dashboard/__tests__/stat-cards.test.tsx` | B.1.4 | Renders 5 cards; `lab_overdue_count` is clickable Link; tooltip text rendered; skeleton shows on loading |
| `src/components/reports/__tests__/revenue-trend-chart.test.tsx` | B.3.3 | Refund line rendered in red (#EF4444); annotation text "Đã xác nhận − Hoàn tiền" present; tooltip on refund point |

### 6.3 Manual smoke checklist (no Playwright yet)

Until Phase 6.3 adds Playwright, every story ships with a manual smoke step. Sprint 6.1 manual smokes:

1. **A.1 Tabs** — `npm run dev` → open `/customers/[id]`, Tab through tab strip, Arrow keys cycle, Home/End jump.
2. **A.2 Modal** — open any create dialog (customer, payment), confirm focus is trapped, ESC closes, focus returns to trigger.
3. **A.3 CloseIconButton** — visually verify all Modal/ConfirmDialog close buttons now use Lucide `X` with hover + focus ring.
4. **A.4 Textarea** — open customer form, verify all `<textarea>` have visible labels + asterisk for required.
5. **A.5 Sidebar** — login as each of 12 roles (via mock user switcher), verify identical sidebar to pre-migration baseline.
6. **B.1.1 CCCD** — create a customer as `admin` → fill CCCD → save → reload → fields persist; login as `media` → CCCD section is hidden.
7. **B.1.2 Transition** — attempt `hospital_confirmed → scheduled` via API; expect 400.
8. **B.1.3 Server RBAC** — login as `sales_online`; try any status change; expect 403. Login as `cso`; expect 200 for valid transitions.
9. **B.1.4 Dashboard** — verify 5th red card "Lab quá hạn" appears, hover for tooltip, click navigates to filtered `/cases?status=lab_overdue`.
10. **B.1.6 Complaint** — trigger complaint on a case; verify doctor + nurse + coordinator receive notification; payload has no PII.
11. **B.1.7 CSKH** — verify complaint/followup notifications show actual CSKH name (not literal "CSKH").
12. **B.2.2 medical_alert_resolved** — attempt `medical_alert → procedure_completed` via API; expect 400. Verify new status renders with green badge.
13. **B.3.1 SoD** — login as `accountant`; attempt `/api/payments/[id]/confirm`; expect 403. Create payment as `accountant`, login as `admin` (different user), try to confirm; expect 200.
14. **B.3.3 Reports** — open `/reports`; verify pipeline tooltip text + revenue annotation + red refund line.

### 6.4 Build & lint gates (every PR)

```
npx tsc --noEmit        # 0 errors
npm run lint            # 0 warnings
npm run build           # 34 routes, 0 errors
npm run test            # all new tests green
```

---

## 7. Rollback strategy

### 7.1 Branch & merge strategy

```
main (frozen, Phase 5 baseline)
  └── phase-6/sprint-6.1           (sprint branch — opened Day 1)
        ├── chore/test-infra        (INF-1, INF-2 — Day 1)
        ├── feat/ui-foundation       (A.3, A.4, A.1, A.2 — Day 1–2)
        ├── feat/nav-shared-menu    (A.5 — Day 3–4, behind flag)
        ├── feat/customer-cccd      (B.1.1 — Day 2–3)
        ├── feat/case-status-fixes  (B.1.2, B.2.2 — Day 4)
        ├── feat/server-rbac        (B.1.3 — Day 5, behind flag)
        ├── feat/dashboard-lab-count (B.1.4 — Day 4)
        ├── feat/notifications      (B.1.6, B.1.7 — Day 3)
        ├── feat/payment-sod        (B.3.1 — Day 5, behind flag)
        └── feat/reports-polish     (B.3.3 — Day 4)
```

Each sub-branch merged into `phase-6/sprint-6.1` after CI green + paired review (for 🔴 stories). Sprint branch merged to `main` only after all 14 stories + exit criteria pass.

### 7.2 Per-story rollback

| Story | Rollback action | Time to rollback | Data impact |
|---|---|---|---|
| INF-1, INF-2 | Revert PR | < 5 min | None (additive: devDeps, scripts, helper file) |
| A.1 Tabs | Revert; consumers fall back to old `role`-less behavior. Manual smoke required. | < 15 min | None |
| A.2 Modal | Revert; consumers lose focus trap but still render. Manual smoke required. | < 15 min | None |
| A.3 CloseIconButton | Revert; consumers fall back to inline X buttons (still render). | < 5 min | None |
| A.4 Textarea | Revert; `aria-required` removed. | < 5 min | None |
| A.5 Shared menu | **Set `FEATURE_SHARED_MENU=false`** in `.env.local` + redeploy. OR revert PR (falls back to inline arrays in sidebar.tsx/mobile-nav.tsx). | < 5 min via flag | None — feature flag carries the legacy code path |
| B.1.1 CCCD | Revert; CCCD fields removed from form. | < 10 min | **Customer records keep stored CCCD** (additive schema); no data loss |
| B.1.2 Transition | Revert; `hospital_confirmed → scheduled` re-allowed. Document why if reverting. | < 5 min | None |
| B.1.3 Server RBAC | **Set `FEATURE_SERVER_RBAC=false`** in `.env.local` + redeploy. | < 5 min via flag | None |
| B.1.4 Dashboard | Revert; 4-card layout returns. | < 10 min | None |
| B.1.6 / B.1.7 Notifications | Revert; complaint recipients revert to CSKH-only. | < 10 min | None |
| B.2.2 medical_alert_resolved | Revert; status enum reverts to 28 values. **Existing cases in `medical_alert_resolved` need migration** if any are mid-flight. | < 30 min | **Risk**: if any case already in `medical_alert_resolved`, reverting Zod enum breaks reads. **Mitigation**: ship behind data migration (add field as nullable, no removal). |
| B.3.1 SoD | **Set `FEATURE_PAYMENT_SOD=false`** + revert PR. | < 5 min via flag | None |
| B.3.3 Reports | Revert; chart revert to existing labels. | < 10 min | None |

### 7.3 Feature flag inventory for 6.1

| Flag | Story | Default dev | Default prod | Rollback action |
|---|---|---|---|---|
| `NEXT_PUBLIC_FEATURE_SHARED_MENU` | A.5 | true | **false** | Inline arrays restored in sidebar.tsx + mobile-nav.tsx |
| `NEXT_PUBLIC_FEATURE_SERVER_RBAC` | B.1.3 | true | **false** | Route falls back to `cases:write`-only check |
| `NEXT_PUBLIC_FEATURE_PAYMENT_SOD` | B.3.1 | true | **false** | Route falls back to `payments:approve`-only, no SoD check (added in 6.1 — not in original BACKLOG) |

All 3 flags default OFF in production per locked decision Q3. Promotion to ON requires CEO + accountant + product-owner sign-off per BACKLOG §9.2.

### 7.4 Data migrations

| Migration | Type | Backward-compat | Rollback |
|---|---|---|---|
| Add `nationalIdNumber`, `nationalIdIssueDate`, `nationalIdIssuePlace` to Customer | Schema extension | ✅ Optional fields, no backfill | Drop fields |
| Add `'medical_alert_resolved'` to CaseStatus union | Enum extension | ✅ New value; existing cases stay | **Risk**: if any case set to this value, downstream readers must handle it. **Mitigation**: ship with no production data — flag stays OFF until CEO approves rollout |
| Remove `'accountant'` from `PAYMENT_CONFIRM_ROLES` | Permission array | ✅ Additive removal (existing users unaffected) | Re-add accountant |
| Remove `'scheduled'` from `hospital_confirmed` transitions | Static config | ✅ Behavior change only; no data migration | Re-add 'scheduled' |

### 7.5 Whole-sprint rollback

If Sprint 6.1 must be reverted wholesale:

1. `git revert -m 1 <sprint-6.1-merge-sha>` on `main`
2. Set all 3 flags to `false`
3. Re-run regression suite (manual smoke — Playwright not yet added)
4. `release-manager` posts incident; product-owner + CEO notified
5. Post-mortem within 48h; Phase 6 sprints 6.2/6.3/6.4 continue without 6.1 if needed

---

## 8. Definition of Done

Sprint 6.1 is **DONE** when ALL of the following are true. Each checkbox is mechanically verifiable.

### 8.1 Build & code quality
- [ ] `npx tsc --noEmit` → **0 errors**
- [ ] `npm run lint` → **0 warnings**
- [ ] `npm run build` → **34 routes, 0 errors**
- [ ] `npm run test` → **all new + existing tests green** (≥ 13 test files)
- [ ] No new lint disable comments (`eslint-disable`, `@ts-ignore`) added unless pre-existing pattern

### 8.2 Story-level acceptance (per BACKLOG + locked decisions)

| Story | DoD checkbox |
|---|---|
| A.1 | [ ] `role="tablist"`/`role="tab"`/`role="tabpanel"` render; arrow keys cycle; Home/End jump; roving `tabIndex` correct; `axe-core` 0 critical on Tabs component |
| A.2 | [ ] Focus trapped inside Modal; ESC closes; focus returns to trigger; `aria-labelledby` points to title; axe-core 0 critical |
| A.3 | [ ] `CloseIconButton` renders with `aria-label="Đóng"`; click fires `onClose`; visible focus ring |
| A.4 | [ ] Zero inline `<textarea>` outside `src/components/ui/textarea.tsx` (grep verified); `required` → `aria-required`; errors → `aria-describedby` |
| A.5 | [ ] `src/config/sidebar-menu.ts` + `src/lib/hooks/useVisibleMenu.ts` exist; `sidebar.tsx` and `mobile-nav.tsx` contain zero inline arrays; zero `as never` casts in either file; 12-role sidebar visual diff = 0 vs baseline snapshot |
| B.1.1 | [ ] "Giấy tờ tùy thân" section renders with 3 fields; fields persist round-trip; section hidden for roles not in `SENSITIVE_FIELD_ACCESS_ROLES`; `nationalIdNumber` not in audit log diff (verify in mock store audit log) |
| B.1.2 | [ ] `getAllowedTransitions('hospital_confirmed')` does NOT include `'scheduled'`; unit test green |
| B.1.3 | [ ] **Decision A applied**: API returns 403 for `sales_online`/`sales_offline` (and any role not in `CASE_STATUS_CHANGE_ROLES`); API returns 400 for invalid transitions including `hospital_confirmed → scheduled`; audit log written for every transition; flag `FEATURE_SERVER_RBAC` controls behavior |
| B.1.4 | [ ] Dashboard shows 5 cards including red `lab_overdue_count`; card is `<Link>` to `/cases?status=lab_overdue`; `/cases` page consumes `?status=` query param; tooltip explains "quá hạn xét nghiệm"; count excludes terminal statuses |
| B.1.6 | [ ] Complaint notifications sent to doctor + nurse + coordinator (resolved via `getAllUsers()`); payload excludes `nationalIdNumber`/`medicalNote`/`privacyNote`; unit test green |
| B.1.7 | [ ] Notifications show actual CSKH display name from `staffAssignment.cskhPostopId`; falls back to literal `'CSKH'` when no assignment; unit test green |
| B.2.2 | [ ] `'medical_alert_resolved'` exists in `CaseStatus`; `medical_alert` cannot transition to `'procedure_completed'`; `medical_alert` CAN transition to `'medical_alert_resolved'`; new status is terminal (no outgoing transitions); green badge with `CheckCircle` icon |
| B.3.1 | [ ] **Decision A applied**: `PAYMENT_CONFIRM_ROLES === ['admin']`; API returns 403 for `accountant`; API returns 403 when `createdBy === confirmedBy` (any role, including admin); SoD violation logged in audit; flag `FEATURE_PAYMENT_SOD` controls behavior |
| B.3.3 | [ ] Pipeline chart tooltip explains "Bill = tổng chưa xác nhận"; revenue chart shows red refund line; annotation "Đã xác nhận − Hoàn tiền" visible |
| INF-1 | [ ] `npm run test` works; sample test green; `vitest.config.ts` resolves `@/` alias; `src/test/setup.ts` extends jest-dom + axe; new scripts: `test`, `test:watch`, `test:cov`, `test:ui` |
| INF-2 | [ ] `src/lib/feature-flags.ts` exports `isFlagEnabled()` + `useFeatureFlag()`; reads `NEXT_PUBLIC_FEATURE_*` env vars; defaults to false when missing; unit test green |

### 8.3 Anti-pattern gate

- [ ] Zero A6, A13 anti-patterns introduced (verified by code review + grep for `cases:write && role === 'sales'`, etc.)
- [ ] Zero A8 dead links (every existing link in migrated nav still resolves)
- [ ] Anti-pattern grep checks added to CI (per BACKLOG §4.4):
  - `grep -rE "'general'" src/` → 0 matches
  - `grep -rE "user-\\d{3}" src/components` → 0 matches (raw IDs in JSX)
  - `grep -rE "window\\.(confirm|alert)" src/` → 0 matches (except in `__tests__/`)
  - `grep -rE "as never" src/components/layout/` → 0 matches (mobile-nav cleanup)

### 8.4 Documentation gate

- [ ] `docs/ux-redesign/SPRINT_6_1_EXECUTION_PLAN.md` (this file) is committed alongside the merge
- [ ] `CLAUDE.md` updated with Sprint 6.1 completion note (Phase 6 status table row added)
- [ ] Each new component has JSDoc on the exported component + props
- [ ] Each new env var documented in `.env.example` (if one exists) or `.env.local` comments

### 8.5 Sign-off

- [ ] Tech-lead sign-off: code quality, build, tests
- [ ] ui-designer sign-off: visual regression baseline (12 roles × 2 nav surfaces)
- [ ] rbac-expert sign-off: server RBAC + SoD tests passing
- [ ] product-owner sign-off: scope matches BACKLOG View 2 Sprint 6.1

---

## 9. Recommended implementation sequence by commit

19 atomic commits, each ≤ 200 LOC, each mergeable to `phase-6/sprint-6.1` standalone after CI green.

### Phase 0 — Infrastructure (Day 1 morning)

| # | Commit | Files | LOC est | Risk |
|---|---|---|---|---|
| 1 | `chore(test): scaffold Vitest + RTL + axe-core, add npm scripts` | `package.json`, `vitest.config.ts`, `src/test/setup.ts`, `src/test/test-utils.tsx`, `src/components/ui/__tests__/sample.test.tsx` | ~80 | 🟢 |
| 2 | `feat(flags): add isFlagEnabled() helper + useFeatureFlag() hook` | `src/lib/feature-flags.ts`, `src/lib/feature-flags.test.ts` | ~60 | 🟢 |

### Phase 1 — UI primitive foundation (Day 1 afternoon → Day 2)

| # | Commit | Files | LOC est | Risk |
|---|---|---|---|---|
| 3 | `feat(ui): add CloseIconButton primitive` | `src/components/ui/close-icon-button.tsx`, `src/components/ui/__tests__/close-icon-button.test.tsx` | ~50 | 🟢 |
| 4 | `feat(ui): extend Textarea with aria-required + aria-describedby` | `src/components/ui/textarea.tsx`, `src/components/ui/__tests__/textarea.test.tsx` | ~30 | 🟢 |
| 5 | `feat(ui): add ARIA roles + arrow-key nav + roving tabindex to Tabs` | `src/components/ui/tabs.tsx`, `src/components/ui/__tests__/tabs.test.tsx` | ~120 | 🟡 |
| 6 | `feat(ui): add focus trap + focus return + aria-labelledby to Modal` | `src/components/ui/modal.tsx`, `src/components/ui/__tests__/modal.test.tsx` | ~110 | 🟡 |

### Phase 2 — Shared navigation config (Day 3)

| # | Commit | Files | LOC est | Risk |
|---|---|---|---|---|
| 7 | `feat(nav): extract sidebar-menu.ts config + useVisibleMenu hook` | `src/config/sidebar-menu.ts`, `src/lib/hooks/useVisibleMenu.ts`, `src/lib/hooks/__tests__/useVisibleMenu.test.ts` | ~110 | 🟡 |
| 8 | `feat(nav): migrate sidebar.tsx to useVisibleMenu (behind FEATURE_SHARED_MENU)` | `src/components/layout/sidebar.tsx` | ~50 | 🟡 |
| 9 | `feat(nav): migrate mobile-nav.tsx to useVisibleMenu, drop as never casts` | `src/components/layout/mobile-nav.tsx` | ~40 | 🟡 |

### Phase 3 — Quick-win additive fixes (Day 3–4)

| # | Commit | Files | LOC est | Risk |
|---|---|---|---|---|
| 10 | `feat(customer): add CCCD type fields + Zod schema` | `src/lib/types/customer.ts`, `src/lib/validators/customer.ts`, `src/lib/validators/__tests__/customer.test.ts` | ~50 | 🟢 |
| 11 | `feat(customer): render Giấy tờ tùy thân section in customer form (RBAC-gated)` | `src/components/customers/customer-form.tsx` | ~80 | 🟢 |
| 12 | `feat(notifications): extend complaint recipients to medical team + filter PII` | `src/lib/notifications/trigger.ts`, `src/lib/notifications/__tests__/trigger.test.ts` | ~60 | 🟢 |
| 13 | `feat(notifications): resolve CSKH display name dynamically from staff assignment` | `src/lib/notifications/trigger.ts` (same file, different fn), update test | ~30 | 🟢 |
| 14 | `feat(reports): pipeline tooltip + revenue annotation + red refund line` | `src/components/reports/pipeline-report.tsx`, `src/components/reports/revenue-trend-chart.tsx`, `src/components/reports/__tests__/revenue-trend-chart.test.tsx` | ~70 | 🟢 |

### Phase 4 — Static config corrections (Day 4)

| # | Commit | Files | LOC est | Risk |
|---|---|---|---|---|
| 15 | `fix(case-status): drop scheduled from hospital_confirmed transitions` | `src/constants/case-status.ts`, `src/constants/__tests__/case-status.test.ts` | ~30 | 🟢 |
| 16 | `feat(case-status): add medical_alert_resolved status + transitions + terminal` | `src/constants/case-status.ts`, `src/lib/types/case.ts`, update test | ~30 | 🟡 |

### Phase 5 — High-risk stories, behind flags (Day 4–5)

| # | Commit | Files | LOC est | Risk |
|---|---|---|---|---|
| 17 | `feat(dashboard): add lab_overdue_count clickable StatCard with tooltip + /cases ?status= support` | `src/components/dashboard/stat-cards.tsx`, `src/components/cases/case-list.tsx`, `src/components/dashboard/__tests__/stat-cards.test.tsx` | ~110 | 🟡 |
| 18 | `feat(api): server-side role enforcement for case status (behind FEATURE_SERVER_RBAC)` | `src/app/api/cases/[id]/status/route.ts`, `src/app/api/cases/[id]/status/__tests__/route.test.ts` | ~80 | 🔴 |
| 19 | `feat(payments): remove accountant from PAYMENT_CONFIRM_ROLES + add SoD check (behind FEATURE_PAYMENT_SOD)` | `src/constants/permissions.ts`, `src/app/api/payments/[id]/confirm/route.ts`, `src/app/api/payments/[id]/confirm/__tests__/route.test.ts`, `src/components/payments/payment-list.tsx` | ~90 | 🔴 |

### Phase 6 — Sprint hygiene (Day 5)

| # | Commit | Files | LOC est | Risk |
|---|---|---|---|---|
| - | `chore(sprint-6.1): update CLAUDE.md + this file lives at docs/ux-redesign/` | `CLAUDE.md` | n/a | 🟢 |

(Docs land alongside the merge commit that closes the sprint branch.)

### Commit dependency graph (simplified)

```
1 ─→ 2 ─┬─→ 3
        ├─→ 4
        ├─→ 5
        ├─→ 6
        └─→ 7 ─→ 8 ─→ 9
              ↓
              10 ─→ 11
              ↓
              12, 13, 14  (independent quick wins, parallelizable)
              ↓
              15, 16  (case-status fixes, must ship before 18)
              ↓
              17  (dashboard)
              ↓
              18 ─→ 19  (high-risk stories, serial so reviewer can chain context)
```

FE-1 owns commits 1, 2, 3, 5, 7, 8, 9, 15, 16, 18, 19.
FE-2 owns commits 4, 6, 10, 11, 12, 13.
FE-3 owns commits 14, 17.

**Critical parallel work-pairs (no file conflicts, can land simultaneously):**
- Commits 5 (Tabs) + 6 (Modal) — different files, both 🔴-prone, parallel
- Commits 8 (sidebar) + 9 (mobile-nav) — different files, parallel after 7 lands
- Commits 12 (complaint) + 13 (CSKH) + 14 (reports) — three different surfaces, fully parallel
- Commits 15 + 16 (case-status) — same file, must serial (one after the other)

---

## Appendix A — Resolved decisions (locked from AskUserQuestion 2026-06-29)

Three decisions were gathered before plan finalization. All three came back as the **recommended** option, which matches the plan defaults. Locked decisions:

### Q1 — `B.1.3` server-side RBAC: scope of restriction → **Option A**

Only roles in `CASE_STATUS_CHANGE_ROLES` can change ANY status. Sales roles (`sales_online`, `sales_offline`) lose status-change rights entirely. Coordinators + clinical roles retain them.

**Implication for Story B.1.3 implementation:**
- API guard: `if (!CASE_STATUS_CHANGE_ROLES.includes(role)) return 403`
- Sales roles that previously flipped `draft → waiting_payment_confirmation` will now get 403. **Pre-merge action**: notify product-owner + sales team. Update their workflow docs to instruct "ask cso/master_sales to advance status".
- Flag `FEATURE_SERVER_RBAC` defaults: dev ON, prod OFF.
- Exit criterion update: "API returns 403 for `sales_online`/`sales_offline` when flag ON".

### Q2 — `B.3.1` payment SoD: who confirms now → **Option A**

`PAYMENT_CONFIRM_ROLES = ['admin']` only. Accountant retains create + view but loses confirm. Admin cannot confirm own payment either (SoD).

**Implication for Story B.3.1 implementation:**
- `PAYMENT_CONFIRM_ROLES` array becomes `['admin']`.
- SoD check: `if (payment.createdBy === currentUser.uid) return 403`. Applies to **all** roles, including admin.
- Accountant happy path: create payment → admin (any admin, not the creator if creator is admin) confirms.
- Flag `FEATURE_PAYMENT_SOD` defaults: dev ON, prod OFF (added in this plan).
- Exit criterion update: "API returns 403 when `createdBy === confirmedBy` (any role)".

### Q3 — Sprint 6.1 flag rollout → **Option A**

All 3 flags default OFF in prod. Sprint 6.1 lands in code, runs in dev, can be toggled in staging for QA, but production users see no behavior change until Phase 6.4 / 7.x promotes flags.

**Implication for Story merge order:**
- All high-risk stories (A.5, B.1.3, B.3.1) ship behind flags that default OFF in prod.
- Sprint 6.1 sign-off gates on staging verification, not production rollout.
- Flag promotion happens in Phase 6.4 (Sprint 6.4) and Phase 7.x after CEO + accountant + product-owner sign-off per BACKLOG §9.2.
- Exit criterion update: "All 3 feature flags present in `.env.local` with value `false`".

---

## Appendix B — Files inventory at a glance

```
CREATE  (7 files)
├── vitest.config.ts                                       (INF-1)
├── src/test/setup.ts                                      (INF-1)
├── src/test/test-utils.tsx                                (INF-1)
├── src/lib/feature-flags.ts                               (INF-2)
├── src/components/ui/close-icon-button.tsx                (A.3)
├── src/config/sidebar-menu.ts                             (A.5)
└── src/lib/hooks/useVisibleMenu.ts                        (A.5)

MODIFY  (16 files)
├── package.json                                           (INF-1 — devDeps + scripts)
├── .env.local                                             (INF-2 — flag defaults)
├── src/components/ui/tabs.tsx                             (A.1)
├── src/components/ui/modal.tsx                            (A.2)
├── src/components/ui/textarea.tsx                         (A.4)
├── src/components/layout/sidebar.tsx                      (A.5)
├── src/components/layout/mobile-nav.tsx                   (A.5)
├── src/components/customers/customer-form.tsx             (B.1.1)
├── src/lib/types/customer.ts                              (B.1.1)
├── src/lib/validators/customer.ts                         (B.1.1)
├── src/lib/types/case.ts                                  (B.2.2)
├── src/constants/case-status.ts                           (B.1.2 + B.2.2)
├── src/constants/permissions.ts                           (B.3.1)
├── src/components/dashboard/stat-cards.tsx                (B.1.4)
├── src/components/cases/case-list.tsx                     (B.1.4 — ?status= URL support)
├── src/components/reports/pipeline-report.tsx             (B.3.3)
├── src/components/reports/revenue-trend-chart.tsx         (B.3.3)
├── src/components/payments/payment-list.tsx               (B.3.1 — incidental cleanup)
├── src/app/api/cases/[id]/status/route.ts                 (B.1.3)
├── src/app/api/payments/[id]/confirm/route.ts             (B.3.1)
└── src/lib/notifications/trigger.ts                       (B.1.6 + B.1.7)

CREATE  (13 test files)
├── src/components/ui/__tests__/sample.test.tsx            (INF-1 sample)
├── src/components/ui/__tests__/tabs.test.tsx              (A.1)
├── src/components/ui/__tests__/modal.test.tsx             (A.2)
├── src/components/ui/__tests__/close-icon-button.test.tsx (A.3)
├── src/components/ui/__tests__/textarea.test.tsx          (A.4)
├── src/lib/hooks/__tests__/useVisibleMenu.test.ts         (A.5)
├── src/lib/feature-flags.test.ts                          (INF-2)
├── src/lib/validators/__tests__/customer.test.ts          (B.1.1)
├── src/constants/__tests__/case-status.test.ts            (B.1.2 + B.2.2)
├── src/app/api/cases/[id]/status/__tests__/route.test.ts  (B.1.3)
├── src/app/api/payments/[id]/confirm/__tests__/route.test.ts (B.3.1)
├── src/lib/notifications/__tests__/trigger.test.ts        (B.1.6 + B.1.7)
├── src/components/dashboard/__tests__/stat-cards.test.tsx (B.1.4)
└── src/components/reports/__tests__/revenue-trend-chart.test.tsx (B.3.3)

NOT TOUCHED in 6.1 (Phase 7+ scope, listed for clarity)
├── src/app/(protected)/cases/[id]/page.tsx                 (6.2 + 6.3)
├── src/app/(protected)/layout.tsx                          (6.3)
├── src/components/cases/status-workflow.tsx                (6.2)
├── src/components/checklist/checklist-panel.tsx            (6.2)
├── src/components/attachments/*                            (7.4)
├── src/components/consents/*                               (7.4)
└── firestore.rules, storage.rules, firebase.json, vercel.json  (Phase 5 remaining)
```

---

## Appendix C — Verification end-to-end

After Sprint 6.1 ships, the following end-to-end verification must pass before merging `phase-6/sprint-6.1` → `main`:

```bash
# Build gates
npx tsc --noEmit          # → 0 errors
npm run lint              # → 0 warnings
npm run build             # → 34 routes, 0 errors

# Test gate
npm run test              # → all 13+ test files green

# Manual smoke (5 routes × 12 roles)
# 1. /dashboard      — 5 cards render, lab_overdue clickable, no horizontal scroll
# 2. /customers/[id] — Tabs ARIA works, CCCD section visible to admin, hidden from media
# 3. /cases/[id]     — StatusWorkflow renders without regressions
# 4. /payments       — payment list renders, accountant cannot confirm own
# 5. /reports        — pipeline tooltip + revenue annotation + refund line visible

# Anti-pattern grep checks
grep -rE "'general'" src/                          # → 0 matches
grep -rE "user-\\d{3}" src/components              # → 0 matches
grep -rE "window\\.(confirm|alert)" src/           # → 0 matches
grep -rE "as never" src/components/layout/         # → 0 matches (post A.5)

# Flag configuration
grep -E "NEXT_PUBLIC_FEATURE_(SHARED_MENU|SERVER_RBAC|PAYMENT_SOD)" .env.local  # → 3 flags present, all = false
```

If any check fails, the sprint is not Done; return to the failing story, fix, re-run all gates.

---

*End of Sprint 6.1 Execution Plan.*