# Sprint 7 — Execution Plan: Phase C — UI Library, Forms, Consent & Notifications

> **Sprint series:** 7.1 → 7.5 (5 sub-sprints)
> **Duration:** 25 dev-days total (5 per sub-sprint), 2–3 FEs (~80h/sub-sprint → ~400h total capacity)
> **Committed scope:** ~83h code + ~20h coordination = **~103h** against ~400h capacity (~297h buffer)
> **Theme:** WCAG 2.1 AA a11y, shared UI library refactor, form hardening, consent/privacy enforcement, notification UX polish
> **Branch:** `main` (stacked commits per sub-sprint; no long-lived branches)
> **Backlog source:** [`IMPLEMENTATION_BACKLOG.md`](IMPLEMENTATION_BACKLOG.md) View 2 — Sprints 7.1–7.5
> **Inputs synthesized from:**
> - `tech-lead` — DoD enforcement, task breakdown, build/lint/test gates
> - `product-owner` — MVP scope, core case questions alignment, acceptance criteria
> - `ux-designer` — mobile-first, WCAG compliance, cognitive load reduction
> - `qa-architect` — 10-layer test pyramid, anti-pattern gate, release gate
> - [`SPRINT_6_1_COMPLETION_REPORT.md`](SPRINT_6_1_COMPLETION_REPORT.md)
> - [`SPRINT_6_2_COMPLETION_REPORT.md`](SPRINT_6_2_COMPLETION_REPORT.md)
> - [`SPRINT_6_3_COMPLETION_REPORT.md`](SPRINT_6_3_COMPLETION_REPORT.md)
> - [`SPRINT_6_4_COMPLETION_REPORT.md`](SPRINT_6_4_COMPLETION_REPORT.md)
> **Prior sprint context:** Sprint 6.4 §10 (tech debt carry-over, sign-off status, open risks)

---

## 0. Executive Summary

Phase 6 (Sprints 6.1–6.4) delivered **29 stories**, **683 tests across 35 files**, closed **9 anti-patterns** (A1/A2/A6/A8/A9/A10/A11/A12/A22), shipped **6 feature flags** (all default OFF in prod), and established the premium design system with glass morphism, gradient backgrounds, and full a11y primitives. The codebase is stable with 0 TypeScript errors, 0 ESLint warnings, 34 routes, and no bundle bloat (87.4 kB shared JS preserved across all 4 sprints).

Phase 7 closes the remaining backlog (22 stories across 5 sub-sprints), addresses all production-hardening blockers, and promotes feature flags for safe rollout. The sprint plan is intentionally **capacity-light per sub-sprint** (11–28h committed vs 80h capacity) to leave room for:
1. **Sign-off coordination** (medical director, CEO, accountant-lead — the 3 calendar-bound items)
2. **Bug fixes** from Phase 6 surface area
3. **Visual regression verification** (C-3 Playwright baseline capture)
4. **Production deployment prep** (Firebase security rules, Vercel config)

**Key decisions in this plan:**
- Sprint 7.4 (Consent + Privacy) carries 2 🔴 stories; stagger with mid-sprint paired review
- Transactional payment confirm (F-CRIT-08) deliberately **not** in Sprint 7 — requires dedicated Firestore transaction mocks + accountant pairing
- Firebase security rules (Phase 5 remaining) are slotted as Sprint 7.4 coordination item (C-4)
- Vercel deployment prep is Sprint 7.5 coordination item (C-5)

---

## 1. Remaining Backlog

### 1.1 Stories from IMPLEMENTATION_BACKLOG View 2 (Sprints 7.1–7.5)

| Sprint | Story ID | Title | Owner | Est | Risk | Flag | Priority |
|:-------|:---------|:------|:------|----:|:----:|:-----|:---------|
| **7.1** | C.1.1 | Modal close button label (CloseIconButton) | FE-1 | 2h | 🟢 | — | Should |
| **7.1** | C.1.2 | Case detail tabs: icon-only on mobile | FE-2 | 4h | 🟡 | — | Should |
| **7.1** | C.1.3 | Tabs ARIA on every consumer | FE-2 | 3h | 🟡 | — | Should |
| **7.2** | C.2.1 | `<CurrencyInput>` component (new) | FE-1 | 6h | 🟡 | — | Should |
| **7.2** | C.2.2 | Case detail: adopt shared Tabs + URL-sync | FE-2 | 4h | 🟡 | `URL_TABS` | Should |
| **7.2** | C.2.3 | Reports date filter refetch | FE-3 | 4h | 🟢 | — | Should |
| **7.2** | C.2.4 | Shared menu config verification | FE-1 | 1h | 🟢 | — | Should |
| **7.3** | C.3.1 | Doctor identity fields on case approval | FE-2 | 5h | 🟡 | — | Should |
| **7.3** | C.3.2 | `actualProcedureDate` required on `procedure_completed` | FE-1 | 2h | 🟡 | — | Should |
| **7.3** | C.3.3 | Lab date validation (Zod refine) | FE-1 | 2h | 🟢 | — | Should |
| **7.3** | C.3.4 | StaffAssignment role label `[Role] Name` | FE-3 | 2h | 🟢 | — | Should |
| **7.4** | C.4.1 | Server-side consent gate on image upload | FE-1 | 5h | 🔴 | `CONSENT_GATE` | Should |
| **7.4** | C.4.2 | Frontend visibility change guard | FE-2 | 4h | 🔴 | — | Should |
| **7.4** | C.4.3 | Consent panel: require uploaded PDF | FE-2 | 4h | 🟡 | — | Should |
| **7.4** | C.4.4 | Customer deletion cascade audit | FE-1 | 4h | 🟡 | — | Should |
| **7.4** | C.4.5 | `attachments:medical_upload` permission | FE-1 | 3h | 🟡 | — | Should |
| **7.5** | C.5.1 | Notification bell: inline on mobile | FE-2 | 5h | 🟡 | — | Should |
| **7.5** | C.5.2 | Notification click + routing helper | FE-1 | 3h | 🟡 | — | Should |
| **7.5** | C.5.3 | Followup timeline colors | FE-3 | 4h | 🟢 | — | Should |
| **7.5** | C.5.4 | D1 completion ring-stat on dashboard | FE-3 | 2h | 🟢 | — | Should |
| **7.5** | C.5.5 | Active filter chips with X + "Xóa tất cả" | FE-1 | 2h | 🟢 | — | Should |
| **7.5** | C.5.6 | Calendar: caseId search-and-select + required | FE-2 | 4h | 🟡 | — | Should |
| **7.5** | C.5.7 | Hospital tab (role-gated) | FE-2 | 5h | 🟡 | — | Should |
| **7.5** | C.5.8 | Remaining `confirm()` cleanup | FE-1 | 1h | 🟢 | — | Should |
| **7.5** | C.5.9 | Nurse/CSKH cancel block | FE-1 | 2h | 🟡 | — | Should |

**Story subtotal:** 25 stories, ~83h committed

### 1.2 Tech Debt from Phase 6 (carry-over into Sprint 7)

| # | Item | From Sprint | Severity | Recommended Sprint | Est |
|:--|:-----|:------------|:---------|:-------------------|----:|
| **TD-1** | Conventional Commits (RR-8) — `.husky/commit-msg` hook + `CONTRIBUTING.md` | 6.2 → 6.3 → 6.4 | 🟡 | 7.1 | 1h |
| **TD-2** | Toast API extension (`duration`, `action`, `description` props) | 6.4 R-A1 | 🟢 | 7.1 | 2h |
| **TD-3** | Transactional payment confirm (F-CRIT-08) + bill recompute (F-HIGH-28) | 6.4 TD-3 | 🔴 | **Deferred to 7.2** (dedicated story) | 8h |
| **TD-4** | Mock seed expansion: add 2 more refund payments + case diversity | 6.4 TD-4 | 🟢 | 7.1 | 1h |
| **TD-5** | B.2.1 race condition: Firestore transaction hardening | 6.2 R-12 | 🟡 | 7.3 | 4h |
| **TD-6** | Anti-pattern pre-commit hook (`scripts/check-anti-patterns.sh`) | 6.4 TD-6 | 🟢 | 7.1 | 1h |
| **TD-7** | B.1.5 `getAllUsers()` per-recipient lookup optimization | 6.2 R-14 | 🟡 | 7.5 | 3h |

**Tech debt subtotal:** ~20h

### 1.3 Sign-off Coordination Items (carry-over from Phase 6)

| # | Item | From | Blocking | Est | Calendar-bound |
|:--|:-----|:-----|:---------|----:|:--------------:|
| **C-1** | B.2.1 medical director dry-run (3 historical cases) | 6.2 → 6.3 → 6.4 | CLINICAL_CHECKLIST + CHECKLIST_GATE prod promotion | 6h | ✅ |
| **C-2** | B.3.1 production sign-off (CEO + accountant-lead + product-owner) | 6.2 → 6.3 → 6.4 | PAYMENT_SOD prod promotion | 4h | ✅ |
| **C-3** | C-3 mobile visual regression baseline capture (5×5 PNG) | 6.3 → 6.4 | MINH_SCREEN prod promotion | 4h | ✅ |
| **C-4** | Firebase security rules deployment (`firestore.rules` + `storage.rules` + `indexes.json` + `firebase.json`) | Phase 5 pending | Production launch | 8h | 🟡 |
| **C-5** | Vercel deployment config (`vercel.json` + security headers + env vars) | Phase 5 pending | Production launch | 6h | 🟡 |

**Coordination subtotal:** ~28h (4h+4h+4h+8h+6h)

---

## 2. UI Redesign Opportunities

Based on the `ux-designer` skill synthesis across Phase 6 completion reports:

| # | Opportunity | Source | Sprint | Impact |
|:--|:------------|:-------|:-------|:-------|
| **U1** | Case detail tabs: icon-only on mobile (C.1.2) | 8 tabs overflow at 360px; cognitive overload for clinical staff | 7.1 | High — directly answers "Who owns each step?" (Q9) on mobile |
| **U2** | Shared Tabs adoption on case detail (C.2.2) | Hand-rolled tab implementation lacks URL-sync (A7 anti-pattern) | 7.2 | High — enables notification deep-links (C.5.2) |
| **U3** | CurrencyInput for payment fields (C.2.1) | Raw numeric inputs are error-prone for Vietnamese users unfamiliar with 1000-separator conventions | 7.2 | Medium — reduces payment entry errors |
| **U4** | Notification bell inline on mobile (C.5.1) | Current popover is inaccessible on < 768px; staff miss critical alerts | 7.5 | High — critical for post-op follow-up adherence |
| **U5** | Followup timeline colors (C.5.3) | Monochrome timeline obscures overdue items at a glance | 7.5 | Medium — reduces missed follow-up windows |
| **U6** | D1 completion ring-stat (C.5.4) | No visual indicator of D1 follow-up completion rate on dashboard | 7.5 | Medium — answers "post-op status?" (Q10) at a glance |
| **U7** | Active filter chips with X (C.5.5) | Audit-logs and case-list filters have no individual-clear affordance | 7.5 | Low — quality-of-life improvement |
| **U8** | Calendar caseId search-and-select (C.5.6) | Free-text caseId input allows "general" fallback (A1 anti-pattern) | 7.5 | High — closes silent-fallback gap |

### UX Non-Goals (explicitly deferred)

| Item | Rationale | Deferred to |
|:-----|:----------|:------------|
| Role-specific dashboards (A17) | Phase 9 scope; MVP dashboard serves all roles | Phase 9 |
| Deep color-coded status timeline | Sprint 7.5 C.5.3 provides a lighter-weight color segment approach | — |
| Full-screen sheet modals on mobile | Uses existing `<Modal>` primitive; full-sheet variant is polish | Phase 8+ |
| Custom date range picker (A20) | Phase 9 scope; Sprint 7.5 C.5.5 adds filter chips instead | Phase 9 |
| CSV export (A19) | Phase 9 scope; no business demand yet | Phase 9 |

---

## 3. Production Hardening Tasks

These are non-feature work items required before the system can go live:

| # | Task | Est | Sub-sprint | Owner | Why |
|:--|:-----|----:|:-----------|:------|:----|
| **PH-1** | Firebase security rules deployment | 8h | 7.4 (C-4) | solution-architect | `firestore.rules` exists (316 lines) but missing `firebase.json`, `firestore.indexes.json`, `storage.rules` for deploy |
| **PH-2** | Vercel deployment config | 6h | 7.5 (C-5) | nextjs-expert | Missing `vercel.json`, security headers, deployment docs |
| **PH-3** | Anti-pattern pre-commit hook | 1h | 7.1 (TD-6) | tech-lead | Automate A2/A8/A9/A22 greps; prevent regression |
| **PH-4** | Conventional Commits enforcement | 1h | 7.1 (TD-1) | tech-lead | `.husky/commit-msg` hook + `CONTRIBUTING.md` update |
| **PH-5** | Toast API extension | 2h | 7.1 (TD-2) | FE-1 | Enable CTA actions in toasts (used by B.2.1 L2, R-A1 follow-up) |
| **PH-6** | `getAllUsers()` per-recipient optimization | 3h | 7.5 (TD-7) | FE-2 | Replace whole-collection read with per-recipient lookup; pre-prod-scale |
| **PH-7** | B.2.1 Firestore transaction hardening | 4h | 7.3 (TD-5) | FE-1 | Race condition mitigation for clinical checklist gate |
| **PH-8** | Mock seed expansion | 1h | 7.1 (TD-4) | FE-3 | Add 2 more refund payments + case diversity for report testing |
| **PH-9** | Feature flag promotion planning | 2h | 7.5 | product-owner | Document promotion sequence, SOPs, and rollback for all 6 flags |
| **PH-10** | `release/v7.0.0` tag + release notes | 4h | 7.5 | release-manager | Final release gate after all 5 sub-sprints |

**Production hardening subtotal:** ~32h

---

## 4. Sub-Sprint Breakdown

### Sprint 7.1 — A11y Foundation + Tech Debt Cleanup

**Duration:** 5 dev-days, 2–3 FEs
**Committed scope:** ~12h code + ~5h tech debt = **~17h**
**Theme:** Close WCAG 2.1 AA gaps, land Conventional Commits, Toast API extension, seed data expansion

| # | Story | Title | Owner | Est | Risk |
|:--|:------|:------|:------|----:|:----:|
| 1 | **C.1.1** | Modal close button label (CloseIconButton integration) | FE-1 | 2h | 🟢 |
| 2 | **C.1.2** | Case detail tabs: icon-only on mobile (responsive Tabs) | FE-2 | 4h | 🟡 |
| 3 | **C.1.3** | Tabs ARIA on every consumer (verification + fixes) | FE-2 | 3h | 🟡 |
| 4 | **TD-1** | Conventional Commits (`.husky/commit-msg` + `CONTRIBUTING.md`) | tech-lead | 1h | 🟢 |
| 5 | **TD-2** | Toast API extension (duration, action, description) | FE-1 | 2h | 🟢 |
| 6 | **TD-4** | Mock seed expansion (refund payments + case diversity) | FE-3 | 1h | 🟢 |
| 7 | **TD-6** | Anti-pattern pre-commit hook | tech-lead | 1h | 🟢 |

**Dependency graph:**
```
C.1.1 (CloseIconButton → Modal) ── no further dependency
C.1.2 (Tabs icon-only) ──► C.2.2 (shared Tabs adoption) in Sprint 7.2
C.1.3 (Tabs ARIA consumers) ──► C.2.2 in Sprint 7.2
TD-1 (Conventional Commits) ──► all future sub-sprints
TD-2 (Toast API) ──► C.5.2 (notification click + toast) in Sprint 7.5
```

**Files affected:**
- `src/components/ui/modal.tsx` — swap close button to `CloseIconButton`
- `src/components/ui/tabs.tsx` — add `iconOnly` prop
- `src/app/(protected)/cases/[id]/page.tsx` — pass `iconOnly="auto"` to Tabs
- `src/lib/toast/*.tsx` (new) — extend Toast API
- `.husky/commit-msg` (new) — Conventional Commits hook
- `CONTRIBUTING.md` — commit convention docs
- `scripts/check-anti-patterns.sh` (new) — pre-commit grep
- `src/lib/mock/store.ts` — seed data expansion

**Exit criteria:**
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm run lint` → 0 warnings
- [ ] `npm run build` → 34 routes, 0 errors, ≤ 87.4 kB shared JS (+2%)
- [ ] `npx vitest run` → ≥ 720 tests (target +37 from Sprint 6.4 baseline of 683)
- [ ] axe-core: 0 critical on every Modal consumer
- [ ] Case detail tabs render icon-only at `< sm`
- [ ] Every `<Tabs>` consumer has proper ARIA roles
- [ ] Conventional Commits format enforced by hook
- [ ] Toast API supports `{ title, description, action, duration }`
- [ ] Mock seed has ≥ 3 refund payments

---

### Sprint 7.2 — UI Library Refactor

**Duration:** 5 dev-days, 2–3 FEs
**Committed scope:** ~15h code = **~15h**
**Theme:** CurrencyInput component, shared Tabs adoption, reports filter UX, menu config verification

| # | Story | Title | Owner | Est | Risk |
|:--|:------|:------|:------|----:|:----:|
| 1 | **C.2.1** | `<CurrencyInput>` component (new) | FE-1 | 6h | 🟡 |
| 2 | **C.2.2** | Case detail: adopt shared Tabs + URL-sync (`?tab=`) | FE-2 | 4h | 🟡 |
| 3 | **C.2.3** | Reports date filter refetch | FE-3 | 4h | 🟢 |
| 4 | **C.2.4** | Shared menu config verification (zero duplicates) | FE-1 | 1h | 🟢 |

**Dependency graph:**
```
C.1.2 (icon-only Tabs, Sprint 7.1) ──► C.2.2 (shared Tabs adoption)
C.1.3 (Tabs ARIA, Sprint 7.1) ──► C.2.2
C.2.1 (CurrencyInput) ──► C.3.2 + C.3.3 (form integration in Sprint 7.3)
```

**Files affected:**
- `src/components/ui/currency-input.tsx` (new) — VND-formatted number input
- `src/components/ui/currency-input.test.tsx` (new) — formatting + focus/blur tests
- `src/components/cases/case-form.tsx` — replace `<Input type="number">` discount field
- `src/components/payments/payment-form.tsx` — replace amount field
- `src/app/(protected)/cases/[id]/page.tsx` — adopt shared Tabs + URL `?tab=` sync
- `src/app/(protected)/reports/page.tsx` — date range → URL params + refetch
- `src/components/reports/report-filters.tsx` — "Đang lọc…" pill + X icon + "Xóa tất cả"

**New feature flag:** `NEXT_PUBLIC_FEATURE_URL_TABS` (dev: true, prod: false) — controls URL-synced tabs on case detail. Without flag, falls back to `useState` tabs (current behavior).

**Exit criteria:**
- [ ] CurrencyInput formats VND with thousand separators (`1.500.000`)
- [ ] Focus strips separators; blur restores
- [ ] Integrates with RHF via `Controller`
- [ ] Case detail uses shared `<Tabs>` with `?tab=` URL sync
- [ ] Invalid tab values fall back to `info`
- [ ] Reports date range triggers data refetch with "Đang lọc…" pill
- [ ] Zero duplicated menu arrays; zero `as never` casts
- [ ] A7 anti-pattern prevented (no hand-rolled tabs)
- [ ] A10 anti-pattern prevented (no raw numeric currency inputs)

---

### Sprint 7.3 — Forms + Inputs

**Duration:** 5 dev-days, 2–3 FEs
**Committed scope:** ~11h code + ~4h hardening = **~15h**
**Theme:** Doctor identity, procedure date enforcement, lab validation, staff labels, Firestore transaction hardening

| # | Story | Title | Owner | Est | Risk |
|:--|:------|:------|:------|----:|:----:|
| 1 | **C.3.1** | Doctor identity fields on case approval | FE-2 | 5h | 🟡 |
| 2 | **C.3.2** | `actualProcedureDate` required server-side | FE-1 | 2h | 🟡 |
| 3 | **C.3.3** | Lab date validation (Zod refine) | FE-1 | 2h | 🟢 |
| 4 | **C.3.4** | StaffAssignment role label `[Role] Name` | FE-3 | 2h | 🟢 |
| 5 | **TD-5** | B.2.1 race condition: Firestore transaction hardening | FE-1 | 4h | 🟡 |

**Dependency graph:**
```
C.2.1 (CurrencyInput, Sprint 7.2) ──► C.3.2 + C.3.3 (form fields)
B.2.4 (ConfirmDialog, Sprint 6.2) ──► C.3.2 (actualProcedureDate)
B.2.1 (clinical checklist, Sprint 6.2) ──► TD-5 (transaction hardening)
```

**Files affected:**
- `src/lib/types/case.ts` — add `approvedByDoctorId?`, `medicalApprovedAt?`
- `src/app/(protected)/cases/[id]/page.tsx` — display doctor identity fields
- `src/app/api/cases/[id]/status/route.ts` — enforce `medically_approved` requires doctor role, require `actualProcedureDate` on `procedure_completed`
- `src/lib/validators/case.ts` — add Zod refine for lab date ≤ procedure date
- `src/components/cases/status-workflow.tsx` — show staff role labels `[Role] Name`
- `src/components/cases/status-workflow.tsx` — Firestore transaction for checklist gate

**Data model impact:** Schema extension (additive only — 2 optional fields on `CaseRecord`):
- `approvedByDoctorId?: string` — populated on `medically_approved` transition
- `medicalApprovedAt?: string` — ISO timestamp on `medically_approved` transition

**Exit criteria:**
- [ ] `medically_approved` requires doctor role + stores `approvedByDoctorId`
- [ ] `procedure_completed` rejects without `actualProcedureDate` (server-side 400)
- [ ] `expectedLabDate > expectedProcedureDate` fails Zod validation
- [ ] Staff assignment shows `[Bác sĩ] Nguyễn Văn A` format
- [ ] B.2.1 checklist gate uses Firestore transaction (no race condition)
- [ ] Backward-compatible: existing cases without new fields still render

---

### Sprint 7.4 — Consent + Privacy + Security Rules

**Duration:** 5 dev-days, 2–3 FEs
**Committed scope:** ~20h code + ~8h infra = **~28h**
**Theme:** Consent binary enforcement, upload gate, deletion cascade, medical sub-permission, Firebase security rules

| # | Story | Title | Owner | Est | Risk |
|:--|:------|:------|:------|----:|:----:|
| 1 | **C.4.1** | Server-side consent gate on image upload | FE-1 | 5h | 🔴 |
| 2 | **C.4.2** | Frontend visibility change guard | FE-2 | 4h | 🔴 |
| 3 | **C.4.3** | Consent panel: require uploaded PDF | FE-2 | 4h | 🟡 |
| 4 | **C.4.4** | Customer deletion cascade audit | FE-1 | 4h | 🟡 |
| 5 | **C.4.5** | `attachments:medical_upload` permission | FE-1 | 3h | 🟡 |
| 6 | **C-4** | Firebase security rules deployment | solution-architect | 8h | 🔴 |

**Dependency graph:**
```
C.4.1 (server consent gate) ──► C.4.2 (frontend guard)
Phase 5 firestore.rules ──► C-4 (deployment)
```

**New feature flag:** `NEXT_PUBLIC_FEATURE_CONSENT_GATE` (dev: true, prod: false) — controls server-side consent check on image upload.

**Files affected:**
- `src/lib/firestore/attachments.ts` — consent check before `public_marketing` upload
- `src/components/attachments/attachment-upload-dialog.tsx` — consent status display
- `src/components/attachments/attachment-list.tsx` — warning modal on visibility change
- `src/components/consents/consent-panel.tsx` — PDF upload requirement for `granted`
- `src/lib/types/consent.ts` — add `documentStoragePath?: string`
- `src/lib/firestore/consents.ts` — gate `granted` status on document
- `src/lib/firestore/customers.ts` — cascade soft-delete with per-record audit
- `src/config/roles.ts` — add `medical_upload` permission
- `src/constants/permissions.ts` — grant to `doctor` + `nurse` only
- `firebase.json` (new) — Firestore + Storage config
- `firestore.indexes.json` (new) — composite indexes
- `storage.rules` (new) — Storage security rules

**Exit criteria:**
- [ ] Server blocks `public_marketing` upload without `image_storage` + `marketing_usage` consent
- [ ] Frontend warning modal appears on visibility change to `public_marketing`
- [ ] Dismiss = visibility unchanged (no silent success)
- [ ] Consent requires uploaded PDF to transition to `granted`
- [ ] Customer deletion cascades to all dependents with per-record audit logs
- [ ] `medical_upload` permission restricted to doctor + nurse
- [ ] Firebase security rules deploy to staging without error
- [ ] A14 + A23 anti-patterns prevented
- [ ] Audit log entry for every consent refusal

---

### Sprint 7.5 — Notifications + Polish + Release Prep

**Duration:** 5 dev-days, 2–3 FEs
**Committed scope:** ~28h code + ~9h infra = **~37h**
**Theme:** Notification UX, followup visualization, filter chips, Hospital tab, calendar fix, cancel block, Vercel deployment, release prep

| # | Story | Title | Owner | Est | Risk |
|:--|:------|:------|:------|----:|:----:|
| 1 | **C.5.1** | Notification bell inline on mobile | FE-2 | 5h | 🟡 |
| 2 | **C.5.2** | Notification click + routing helper | FE-1 | 3h | 🟡 |
| 3 | **C.5.3** | Followup timeline colors | FE-3 | 4h | 🟢 |
| 4 | **C.5.4** | D1 completion ring-stat on dashboard | FE-3 | 2h | 🟢 |
| 5 | **C.5.5** | Active filter chips with X + "Xóa tất cả" | FE-1 | 2h | 🟢 |
| 6 | **C.5.6** | Calendar: caseId search-and-select + required | FE-2 | 4h | 🟡 |
| 7 | **C.5.7** | Hospital tab (role-gated) | FE-2 | 5h | 🟡 |
| 8 | **C.5.8** | Remaining `confirm()` cleanup | FE-1 | 1h | 🟢 |
| 9 | **C.5.9** | Nurse/CSKH cancel block | FE-1 | 2h | 🟡 |
| 10 | **TD-7** | `getAllUsers()` per-recipient optimization | FE-2 | 3h | 🟡 |
| 11 | **PH-9** | Feature flag promotion planning | product-owner | 2h | — |
| 12 | **PH-10** | `release/v7.0.0` tag + release notes | release-manager | 4h | — |
| 13 | **C-5** | Vercel deployment config | nextjs-expert | 6h | 🔴 |

**Dependency graph:**
```
C.2.2 (URL-sync tabs, Sprint 7.2) ──► C.5.2 (notification deep-links)
TD-2 (Toast API, Sprint 7.1) ──► C.5.2 (toast on error)
A.5 (shared menu, Sprint 6.1) ──► C.5.1 (notification bell), C.5.7 (Hospital tab)
B.1.3 (server RBAC, Sprint 6.1) ──► C.5.9 (cancel block)
```

**Files affected:**
- `src/components/layout/topbar.tsx` — notification bell inline expansion on mobile
- `src/lib/notifications/routing.ts` (new) — `getNotificationTarget()` helper
- `src/app/(protected)/notifications/page.tsx` — deep-link routing
- `src/lib/types/notification.ts` — add `targetTab?`, `targetType?`
- `src/components/followups/followup-list.tsx` — colored timeline segments
- `src/components/dashboard/stat-cards.tsx` — D1 ring-stat
- `src/app/(protected)/audit-logs/page.tsx` — filter chips with X
- `src/components/cases/case-list.tsx` — filter chips with X
- `src/app/(protected)/calendar/page.tsx` — search-and-select dropdown
- `src/app/(protected)/cases/[id]/page.tsx` — Hospital tab (role-gated)
- `src/lib/firestore/users.ts` — per-recipient lookup optimization
- `vercel.json` (new) — deployment config
- `src/app/layout.tsx` — security headers

**Exit criteria:**
- [ ] Mobile notification bell expands inline below topbar (full-width, max 50vh)
- [ ] Notification click deep-links to correct entity + tab
- [ ] Followup timeline shows colored segments (red/amber/gray/green)
- [ ] D1 completion ring-stat on dashboard (green ≥ 80%, red < 80%)
- [ ] Active filter chips show X icon; "Xóa tất cả bộ lọc" clears all
- [ ] Calendar requires case selection (no "general" fallback — A1 anti-pattern)
- [ ] Hospital tab visible only to coordinator/cso/admin
- [ ] Zero `window.confirm()` calls in entire codebase
- [ ] Nurse/cskh_postop cannot cancel cases (server + UI)
- [ ] `getAllUsers()` replaced with per-recipient lookup
- [ ] `vercel.json` + security headers configured
- [ ] A1 + A9 anti-patterns prevented
- [ ] `release/v7.0.0-rc1` tag cut

---

## 5. Recommended Implementation Order

### 5.1 Sub-Sprint Sequencing (by risk × dependency × business value)

| Order | Sub-sprint | Theme | Rationale |
|:------|:-----------|:------|:----------|
| **1** | **Sprint 7.1** | A11y Foundation | Lowest risk (0 🔴), unblocks all Phase C work (Tabs icon-only feeds C.2.2; Toast API feeds C.5.2; Conventional Commits is process hygiene). |
| **2** | **Sprint 7.2** | UI Library Refactor | Medium risk, builds on 7.1 Tabs improvements. CurrencyInput + shared Tabs + reports filter are prerequisites for 7.3 forms and 7.5 notifications. |
| **3** | **Sprint 7.3** | Forms + Inputs | Medium risk, extends 7.2 CurrencyInput. Doctor identity + procedure date enforcement are high business-value but depend on 7.2 form infrastructure. |
| **4** | **Sprint 7.4** | Consent + Privacy + Security | Highest risk (2 🔴 stories + Firebase rules deployment). Deliberately sequenced after 7.3 forms to allow mid-sprint paired review windows. Firebase security rules are co-dependent with consent enforcement. |
| **5** | **Sprint 7.5** | Notifications + Polish + Release | Lowest technical risk but widest scope (9 stories + 3 infra items). Benefits from all preceding sprints' infrastructure (URL-sync tabs for deep-links, Toast API for error handling, completed a11y for notification bell). Release prep closes Phase 7. |

### 5.2 Story-Level Sequencing Within Each Sub-Sprint

**Sprint 7.1 (A11y Foundation):**
```
TD-1 (Conventional Commits) ──► TD-6 (pre-commit hook) ──► TD-4 (seed expansion)
C.1.1 (Modal close label) ── no dependency
C.1.2 (Tabs icon-only) ──► C.1.3 (Tabs ARIA verification)
TD-2 (Toast API) ── no dependency
```

**Sprint 7.2 (UI Library):**
```
C.2.4 (menu verification) ── no dependency (quick win, start first)
C.2.1 (CurrencyInput) ──► C.2.2 (shared Tabs adoption)
C.2.3 (reports filter) ── no dependency
```

**Sprint 7.3 (Forms + Inputs):**
```
TD-5 (Firestore transaction) ── no dependency (start first — highest risk)
C.3.1 (doctor identity) ──► C.3.2 (procedure date) ──► C.3.3 (lab date validation)
C.3.4 (staff labels) ── no dependency
```

**Sprint 7.4 (Consent + Privacy):**
```
C-4 (Firebase rules, parallel track) ──► C.4.1 (server consent gate) ──► C.4.2 (frontend guard)
C.4.3 (consent PDF) ── no dependency
C.4.4 (cascade audit) ── no dependency
C.4.5 (medical_upload permission) ── no dependency
```

**Sprint 7.5 (Notifications + Polish):**
```
C-5 (Vercel deployment, parallel track)
TD-7 (getAllUsers optimization) ──► C.5.1 (notification bell inline)
C.5.2 (notification click + routing) ──► C.5.5 (filter chips)
C.5.3 (followup colors) ──► C.5.4 (D1 ring-stat)
C.5.6 (calendar caseId) ── no dependency
C.5.7 (Hospital tab) ── no dependency
C.5.8 (confirm cleanup) ── no dependency
C.5.9 (cancel block) ── no dependency
PH-9 (flag promotion plan) ──► PH-10 (release tag)
```

### 5.3 Coordination Activity Scheduling

| Activity | Sub-sprint | Week | Owner | Dependency |
|:---------|:-----------|:-----|:------|:-----------|
| **C-1** B.2.1 medical director dry-run | 7.1 | 1 | medical-workflow-expert | Calendar slot |
| **C-2** B.3.1 sign-off (CEO + accountant-lead + PO) | 7.1 | 1 | release-manager | Calendar slot |
| **C-3** Mobile visual regression baseline (PNG capture) | 7.1 | 1 | qa-architect + ui-designer | Playwright install |
| **C-4** Firebase security rules deployment | 7.4 | 3–4 | solution-architect | Rules review complete |
| **C-5** Vercel deployment config | 7.5 | 4–5 | nextjs-expert | Vercel project setup |
| **PH-9** Feature flag promotion planning | 7.5 | 5 | product-owner | All stories shipped |
| **PH-10** Release tag + notes | 7.5 | 5 | release-manager | All sign-offs green |

---

## 6. Estimated Effort

### 6.1 Per Sub-Sprint Summary

| Sub-sprint | Stories | Code hours | Tech debt | Coordination | Total | Buffer |
|:-----------|--------:|-----------:|----------:|-------------:|------:|-------:|
| **7.1** | 3 | 9h | 5h | 6h (C-1+C-2+C-3) | 20h | 60h |
| **7.2** | 4 | 15h | 0h | 0h | 15h | 65h |
| **7.3** | 4+1 | 11h | 4h | 0h | 15h | 65h |
| **7.4** | 5+1 | 20h | 0h | 8h (C-4) | 28h | 52h |
| **7.5** | 9+1+2 | 28h | 3h | 10h (C-5+PH-9+PH-10) | 41h | 39h |
| **Total** | **25+2+5** | **83h** | **12h** | **24h** | **119h** | **281h** |

### 6.2 Per Owner Summary (across all sub-sprints)

| Owner | Stories | Hours | Sub-sprints |
|:------|--------:|------:|:------------|
| **FE-1** | C.1.1, C.2.1, C.2.4, C.3.2, C.3.3, C.4.1, C.4.4, C.4.5, C.5.2, C.5.5, C.5.8, C.5.9 + TD-2, TD-5 | ~38h | 7.1–7.5 |
| **FE-2** | C.1.2, C.1.3, C.2.2, C.3.1, C.4.2, C.4.3, C.5.1, C.5.6, C.5.7 + TD-7 | ~45h | 7.1–7.5 |
| **FE-3** | C.2.3, C.3.4, C.5.3, C.5.4 + TD-4 | ~17h | 7.1–7.5 |
| **tech-lead** | TD-1, TD-6 | ~2h | 7.1 |
| **solution-architect** | C-4 | ~8h | 7.4 |
| **nextjs-expert** | C-5 | ~6h | 7.5 |
| **release-manager** | PH-10 | ~4h | 7.5 |
| **product-owner** | PH-9 | ~2h | 7.5 |

### 6.3 Feature Flag Inventory (cumulative after Sprint 7.5)

| # | Flag | Added in | New in Sprint 7 | Prod default | Promotion gate |
|:--|:-----|:---------|:----------------|:-------------|:---------------|
| 1 | `NEXT_PUBLIC_FEATURE_SHARED_MENU` | Sprint 6.1 | — | `false` | Triple sign-off |
| 2 | `NEXT_PUBLIC_FEATURE_SERVER_RBAC` | Sprint 6.1 | — | `false` | Triple sign-off |
| 3 | `NEXT_PUBLIC_FEATURE_PAYMENT_SOD` | Sprint 6.1 | — | `false` | CEO + accountant-lead + PO |
| 4 | `NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST` | Sprint 6.2 | — | `false` | Medical director + CEO + PO |
| 5 | `NEXT_PUBLIC_FEATURE_CHECKLIST_GATE` | Sprint 6.2 | — | `false` | Medical director + CEO + PO |
| 6 | `NEXT_PUBLIC_FEATURE_MINH_SCREEN` | Sprint 6.3 | — | `false` | C-3 visual baseline |
| 7 | `NEXT_PUBLIC_FEATURE_URL_TABS` | **Sprint 7.2** | ✅ | `false` | QA sign-off |
| 8 | `NEXT_PUBLIC_FEATURE_CONSENT_GATE` | **Sprint 7.4** | ✅ | `false` | Data privacy + CEO |

**Total flags at Sprint 7.5 close: 8** (all default OFF in prod)

---

## 7. Risks

### 7.1 Risks from Phase 6 (carry-over)

| # | Risk | Severity | From | Sprint 7 handling |
|:--|:-----|:---------|:-----|:-------------------|
| **O-5** | C-1 B.2.1 medical director dry-run still pending | 🟡 | 6.2 → 6.3 → 6.4 | Schedule in Sprint 7.1 week 1. If calendar opens, unblocks B.2.1 flag promotion. |
| **O-6** | C-2 B.3.1 production sign-off still pending | 🟡 | 6.2 → 6.3 → 6.4 | Schedule in Sprint 7.1 week 1. SOP `SOP_FINALIZE_B31_PAYMENT_SOD.md` to be committed. |
| **O-2** | C-3 PNG baselines not yet captured | 🟡 | 6.3 → 6.4 | Playwright harness ready in Sprint 6.4. Capture in Sprint 7.1. |
| **R12** | B.2.1 race condition (Firestore) | 🟡 | 6.2 | **TD-5 in Sprint 7.3** — transaction hardening. |
| **R13** | B.2.1 stale flag combo | 🟡 | 6.2 | Documented; not blocking. Flag defaults OFF. |
| **R14** | `getAllUsers()` whole-collection read | 🟡 | 6.2 | **TD-7 in Sprint 7.5** — per-recipient optimization. |
| **TD-3** | Transactional payment confirm (F-CRIT-08) | 🔴 | 6.4 | **NOT in Sprint 7** — requires dedicated Firestore transaction mocks + accountant pairing. Deferred to Phase 8. |

### 7.2 Risks identified for Sprint 7

| # | Risk | Severity | Mitigation |
|:--|:-----|:---------|:-----------|
| **S7-1** | 🔴 **C.4.1 + C.4.2 consent gate (2 stories, 9h)** are the highest-risk items in Sprint 7. Privacy breach if bypassed. Ships behind `FEATURE_CONSENT_GATE` flag. | High | (1) Paired review (FE-1 + FE-2). (2) Test 4 states (granted, pending, denied, missing). (3) Refusal must log audit entry. (4) Flag default OFF in prod. (5) C.4.1 (server) must land before C.4.2 (frontend). |
| **S7-2** | 🔴 **C-4 Firebase security rules deployment** depends on review of existing 316-line `firestore.rules` + new `storage.rules`. Incorrect rules could expose PII or break app functionality. | High | (1) solution-architect owns review + deployment. (2) Staging-first rollout. (3) Test against 12 mock user roles. (4) `firebase.json` already drafted — validation, not creation. |
| **S7-3** | 🟡 **C-5 Vercel deployment** depends on Vercel project setup + environment variable configuration for 8 feature flags + Firebase credentials. | Medium | (1) nextjs-expert owns. (2) Use Vercel CLI for env var sync. (3) Security headers pre-configured. (4) Rollback = Vercel redeploy previous version. |
| **S7-4** | 🟡 **C.2.2 URL-synced tabs** is a prerequisite for C.5.2 notification deep-links. If C.2.2 slips, C.5.2 loses its foundation. | Medium | (1) C.2.2 ships in Sprint 7.2, C.5.2 in Sprint 7.5 — 3 sub-sprints of buffer. (2) C.5.2 can fall back to entity-level navigation without tab-sync. |
| **S7-5** | 🟡 **C.1.2 icon-only tabs** could regress visual regression baseline if tab icons are not pixel-matched. | Medium | (1) C-3 baseline capture in Sprint 7.1 before C.1.2 touches tabs. (2) Playwright diff on tab bar at 360px. |
| **S7-6** | 🟡 **C.4.3 consent PDF upload** depends on Firebase Storage or mock storage. In dev mode, file stores as mock URL — but production requires real Storage integration. | Medium | (1) C-4 (Firebase rules) must include Storage rules. (2) C.4.3 documents Storage path pattern. (3) No backfill needed for existing consents. |
| **S7-7** | 🟢 **TD-3 transactional payment confirm is deliberately excluded** from Sprint 7. This is the #1 money-in-flight risk. Deferral means production payments still lack Firestore transactions. | Low (bounded by SoD) | (1) Current SoD (B.3.1) prevents same-user create+confirm. (2) Phase 8 scope with dedicated Firestore transaction mocks. (3) Product-owner acknowledges risk. |

### 7.3 Risk escalation path

```
Sprint 7.1: Schedule C-1 + C-2 + C-3 (calendar-bound)
    ├── If C-1 lands → B.2.1 flag promotion unblocked
    ├── If C-2 lands → B.3.1 flag promotion unblocked
    └── If C-3 lands → MINH_SCREEN flag promotion unblocked

Sprint 7.2: C.2.2 ships → C.5.2 unblocked in 7.5

Sprint 7.3: TD-5 ships → B.2.1 race condition closed
    └── C.3.2 ships → procedure_completed server enforcement

Sprint 7.4: C.4.1 + C.4.2 ship → consent gate enforced
    └── C-4 lands → Firebase security rules live

Sprint 7.5: C.5.2 ships → notification deep-links work
    └── PH-9 + PH-10 → release v7.0.0
```

---

## 8. Definition of Done

### 8.1 Per-Story Definition of Done

For each of the 25 stories in Sprint 7:

- [ ] **UI complete** — every acceptance criterion from BACKLOG View 1 met
- [ ] **Validation implemented** — Vietnamese error messages; no silent failures
- [ ] **Loading, error, empty states** — at least one of each designed
- [ ] **RBAC enforced** — no permission expansion or contraction; existing `useCurrentUser()` patterns preserved
- [ ] **Audit log** — sensitive actions logged via `writeAuditLog()`
- [ ] **Firestore real data** — no mock-data-only branches; ready for real Firestore
- [ ] **Firebase errors handled** — `try/catch` on every async path; error toast on failure
- [ ] **Mobile responsive** — tested at 360 / 390 / 768 / 1280 px; no horizontal scroll; touch targets ≥ 44×44 px
- [ ] **Vietnamese copy** — every user-facing string reviewed by ux-designer
- [ ] **Premium theme preserved** — no new tokens, no color drift, no spacing drift
- [ ] **A11y** — axe-core 0 critical on touched route; keyboard reachable; focus visible; ARIA correct
- [ ] **Unit + integration tests written** — happy path + negative case coverage
- [ ] **`tsc --noEmit` → 0 errors**
- [ ] **`npm run lint` → 0 warnings**
- [ ] **`npm run build` → 34 routes (or more), 0 errors, no bundle bloat (≤ 5% delta)**
- [ ] **Anti-pattern grep clean** — A1/A2/A8/A9/A10/A22/A26 greps pass
- [ ] **Paired review approved** — for 🟡 and 🔴 stories
- [ ] **Implementation report + migration notes written**

### 8.2 Sub-Sprint Definition of Done

Each sub-sprint is "Done" when:

- [ ] All committed stories pass per-story DoD
- [ ] Build & quality gates green (§8.3)
- [ ] Anti-pattern gate clean
- [ ] Cross-sprint regression verified (all prior sprints still pass)
- [ ] Feature flag inventory updated (if new flags added)
- [ ] Documentation complete (story reports + sub-sprint completion report)
- [ ] Sign-off chain populated

### 8.3 Build & Quality Gates (per sub-sprint)

| Gate | Command | Target |
|:-----|:--------|:-------|
| TypeScript | `npx tsc --noEmit` | 0 errors |
| TypeScript (tests) | `npx tsc -p tsconfig.test.json --noEmit` | 0 errors |
| ESLint | `npm run lint` | 0 warnings |
| Production build | `npm run build` | 34+ routes, 0 errors, ≤ 87.4 kB shared JS (+5% max) |
| Unit + a11y tests | `npx vitest run` | All green, growing per sub-sprint |
| Bundle delta | First Load JS shared | ≤ 5% increase from Sprint 6.4 baseline |

### 8.4 Anti-pattern Gate (cumulative)

| # | Anti-pattern | Check | Sprint 7 closure |
|:--|:-------------|:------|:-----------------|
| A1 | Silent fallback defaults (`caseId='general'`) | Grep for `'general'` | C.5.6 |
| A2 | Raw IDs in UI | Grep for `user-\d{3}` | Closed in 6.3 |
| A7 | Hand-rolled tabs/modals | Grep for inline `useState` tab patterns | C.2.2 |
| A8 | Dead links | No `href="#"` with "Đang phát triển" | Closed in 6.3 |
| A9 | Native `confirm()`/`alert()` | Grep `window.confirm`, `window.alert` | Closed in 6.4; C.5.8 verification |
| A10 | Raw numeric currency inputs | Use `<CurrencyInput>` | C.2.1 |
| A14 | Consent as progressive | Binary: granted or absent | C.4.1 + C.4.2 |
| A23 | Deletion without per-record audit | Cascade audit enforced | C.4.4 |
| A26 | C-3 source drift | `git diff` from baseline | Playwright harness in 6.4 |

### 8.5 Sprint 7 Final Release Criteria (release/v7.0.0)

The overall Sprint 7 release is "Done" when **all** of the following are green:

- [ ] All 25 stories shipped with paired implementation report + migration notes
- [ ] ~750+ tests passing across 40+ files (683 baseline + ~70 new)
- [ ] `tsc --noEmit` → 0 errors
- [ ] `npm run lint` → 0 warnings
- [ ] `npm run build` → 34+ routes, 0 errors, ≤ 92 kB shared JS
- [ ] Zero A1/A2/A7/A8/A9/A10/A14/A22/A23/A26 anti-patterns
- [ ] All 8 feature flags configured correctly (all OFF in prod, documented)
- [ ] Firebase security rules deployed to staging and verified
- [ ] Vercel deployment config complete and tested
- [ ] C-1 medical director dry-run completed
- [ ] C-2 B.3.1 production sign-off collected
- [ ] C-3 visual regression baseline captured and tagged
- [ ] Feature flag promotion plan documented (PH-9)
- [ ] `release/v7.0.0-rc1` tag cut
- [ ] Cross-sprint regression: all Phase 6 features still pass

### 8.6 Sign-off Chain (Sprint 7)

| Gate | Sign-off by | Scope | Sub-sprint |
|:-----|:------------|:------|:-----------|
| Build / lint / tests | tech-lead | All code quality | Each sub-sprint |
| Anti-pattern grep gate | qa-architect | A1/A7/A9/A10/A14/A23 | Each sub-sprint |
| Test pyramid density | qa-architect | ≥ 5 tests/KLOC | Each sub-sprint |
| WCAG 2.1 AA compliance | qa-architect (axe-core) | 0 critical on 21 routes | 7.1, then verify |
| Vietnamese copy tone | ux-designer | All user-facing strings | Each sub-sprint |
| Mobile visual regression | qa-architect + ui-designer | 5 devices × 5 routes × 3 viewports | 7.1 (C-3), then verify |
| Clinical safety | medical-workflow-expert | C.3.1, C.3.2 | 7.3 |
| Consent + privacy | data-privacy-expert | C.4.1, C.4.2, C.4.3, C-4 | 7.4 |
| Firebase security | security-architect | C-4 rules review | 7.4 |
| Revenue accuracy | accountant-lead | C.2.1 CurrencyInput, PH-9 | 7.2, 7.5 |
| Flag inventory + rollback | release-manager | All 8 flags | 7.5 |
| Final go/no-go | CEO + product-owner | Overall release | 7.5 |

---

## Appendix A — Sprint 7 at a Glance

| Sub-sprint | Theme | Stories | Committed | Risk | New flags | New tests (est) |
|:-----------|:------|--------:|----------:|:----:|:---------:|----------------:|
| **7.1** | A11y Foundation + Tech Debt | 3+4 | ~17h | 🟢 | — | +37 |
| **7.2** | UI Library Refactor | 4 | ~15h | 🟡 | `URL_TABS` | +40 |
| **7.3** | Forms + Inputs | 4+1 | ~15h | 🟡 | — | +35 |
| **7.4** | Consent + Privacy + Security | 5+1 | ~28h | 🔴 | `CONSENT_GATE` | +50 |
| **7.5** | Notifications + Polish + Release | 9+1+2 | ~37h | 🟡 | — | +45 |
| **Total** | — | **25+2** | **~119h** | — | **+2** | **+207 (est)** |

**Cumulative test count at Sprint 7.5 close:** ~683 + ~207 = **~890 tests** across ~45 files.

## Appendix B — Verification Command Set (copy-paste)

```bash
# Full verification (run after every sub-sprint merge)
npx tsc --noEmit                            # → 0 errors
npx tsc -p tsconfig.test.json --noEmit      # → 0 errors
npm run lint                                # → 0 warnings
npm run build                               # → 34+ routes, 0 errors, ≤ 92 kB shared JS
npx vitest run                              # → all green (growing per sub-sprint)

# Anti-pattern grep gate (cumulative)
grep -rE "window\.(confirm|alert)" src/ | grep -v __tests__/   # → 0 (A9, closed 6.4)
grep -rE "user-\d{3}" src/components                            # → 0 (A2, closed 6.3)
grep -rE 'href=["\047]#["\047]' src/components/                # → 0 (A8, closed 6.3)
grep -rE "eslint-disable.*no-alert" src/                       # → 0
grep -rE "caseId\s*=\s*['\"]general['\"]" src/                  # → 0 after C.5.6 (A1)
grep -rE "<Input.*type=['\"]number['\"]" src/components/cases/  # → 0 after C.2.1 (A10)
grep -rE "as never" src/components/layout/                      # → 0 (RR-5, closed 6.3)

# Feature flag inventory (updated per sub-sprint)
grep -E "NEXT_PUBLIC_FEATURE_" .env.local
# Sprint 7.2: adds URL_TABS
# Sprint 7.4: adds CONSENT_GATE

# Documentation gate (per sub-sprint)
# Story reports should exist for each committed story
ls docs/ux-redesign/STORY_*_IMPLEMENTATION_REPORT.md | wc -l
ls docs/ux-redesign/STORY_*_MIGRATION_NOTES.md | wc -l

# Final release gate
git tag -a release/v7.0.0-rc1 -m "Sprint 7 complete — Phase C release candidate"
```

## Appendix C — Carry-over from Phase 6

| # | Item | From | Sprint 7 handling | Final status |
|:--|:-----|:-----|:-------------------|:-------------|
| R-1 / O-5 | B.2.1 medical director dry-run | 6.2 → 6.3 → 6.4 | C-1 scheduled Sprint 7.1 | ⏳ Calendar-bound |
| R-2 | B.2.1 misconfiguration blocks transitions | 6.2 → 6.3 → 6.4 | Flag stays OFF until C-1 sign-off | ⏳ Blocked on C-1 |
| R-7 / O-6 | B.3.1 production sign-off | 6.2 → 6.3 → 6.4 | C-2 scheduled Sprint 7.1 | ⏳ Calendar-bound |
| R-8 | RR-4 B.1.4 Suspense boundary | 6.1 → 6.2 → 6.3 | ✅ Closed in Sprint 6.4 (TD) | ✅ |
| R-10 / A9 | `window.alert` → toast | 6.2 → 6.3 | ✅ Closed in Sprint 6.4 (R-A1) | ✅ |
| R-11 / RR-5 | topbar `as never` cast | 6.1 → 6.2 | ✅ Closed in Sprint 6.3 (B.4.4) | ✅ |
| R-12 / R13 | B.2.1 race + stale flag | 6.2 → 6.3 → 6.4 | TD-5 in Sprint 7.3 | ⏳ Sprint 7.3 |
| R-14 | `getAllUsers()` whole-collection read | 6.2 → 6.3 → 6.4 | TD-7 in Sprint 7.5 | ⏳ Sprint 7.5 |
| RR-8 / TD-1 | Conventional Commits | 6.2 → 6.3 → 6.4 | TD-1 in Sprint 7.1 | ⏳ Sprint 7.1 |
| TD-3 | Transactional payment confirm (F-CRIT-08) | 6.4 | **NOT in Sprint 7** — Phase 8 | ⏳ Phase 8 |

## Appendix D — Key Architectural Decisions

| # | Decision | Rationale | Revisit in |
|:--|:---------|:----------|:-----------|
| D1 | **No new component primitives in Phase C** | Extends existing primitives (Modal, Tabs, Select, Toast). New `CurrencyInput` is the sole exception — required for A10 anti-pattern. | Phase 8+ |
| D2 | **Feature flags for C.2.2 and C.4.1 only** | C.2.2 (URL tabs) is a behavior change; C.4.1 (consent gate) is a privacy enforcement. All other stories are additive copy/structure. | Flag removal in Phase 8 |
| D3 | **Firebase security rules as Sprint 7.4 coordination, not a sprint story** | Rules deployment is infrastructure, not feature code. Assigns to solution-architect, not FE-1/FE-2. | Never — one-time |
| D4 | **Transaction payment confirm deferred to Phase 8** | F-CRIT-08 requires Firestore transaction mocks, accountant pairing, and dedicated rollback drill. Mixing into Sprint 7's broad scope increases risk. Current SoD (B.3.1) provides adequate protection at current scale. | Phase 8 Sprint 8.x |
| D5 | **Notification deep-links (C.5.2) intentionally placed in Sprint 7.5** | Depends on URL-synced tabs (C.2.2 in 7.2) + Toast API (TD-2 in 7.1). Placing it last gives maximum buffer for prerequisites. | — |
| D6 | **Release v7.0.0 tag at Sprint 7.5 close** | Phase C is the final UX redesign phase. After v7.0.0, the project transitions to production hardening (Phase D) and feature expansion (Phase 8+). | Phase D |

---

*End of Sprint 7 Execution Plan.*
