# Swan Case CRM — UI Refactor Plan

- **Date:** 2026-06-29
- **Scope:** Phase 6 (Safety & Integrity Hardening) + Phase 7 (Consistency & Polish) UI refactor
- **Inputs synthesized from:**
  - [`docs/ux-redesign/UX_DECISION_DOCUMENT.md`](UX_DECISION_DOCUMENT.md) — 49 approved changes (22 Must + 27 Should), 11 high-risk items, Quick Win budget
  - [`docs/ux-redesign/DESIGN_DIRECTION.md`](DESIGN_DIRECTION.md) — component standardization plan, 25 anti-patterns (A1–A25), status color system, a11y rules
  - [`docs/ux-redesign/SITEMAP.md`](SITEMAP.md) — 21 protected pages, route ownership, permission matrix, deep-link strategy
  - [`docs/ux-redesign/INFORMATION_ARCHITECTURE.md`](INFORMATION_ARCHITECTURE.md) — tab architecture, URL structure, cross-module linking
  - [`CLAUDE.md`](../../CLAUDE.md) — stack, conventions, premium theme, Phase 5 baseline
- **Owners:** tech-lead (delivery), solution-architect (architecture), nextjs-expert (framework patterns), qa-architect (test/release gates)
- **Constraints:** TypeScript strict, Firebase (Auth + Firestore + Storage), Vietnamese UI, premium theme intact, **no new design tokens**, **no new component primitives** (DESIGN_DIRECTION §13.3)
- **Out of scope:** Media Library removal code-cleanup (F-HIGH-35 Phase 9+), operational-risk page (F-HIGH-31 Phase 9+), role-specific dashboards (F-MED-26 Phase 9+), CSV export (F-HIGH-34 Phase 9+)

---

## Context

The codebase has 21 protected routes and a 20-primitive UI library that has drifted over Phase 1–5. A 76-finding UX audit flagged systemic issues: hand-rolled tabs/modals, duplicated sidebar config between desktop and mobile, decorative (non-action) StatCards, ambiguous revenue aggregates, and missing ARIA roles. This refactor is the **UI-side implementation plan** for the 49 approved changes — it sequences component migration, route-by-route rollout, design system lock-in, and QA gates so that Phase 6 closes safety gaps and Phase 7 lands polish without regression.

The plan does **not** ship new features, new colors, or new primitives. It standardizes what already exists, makes hidden defaults explicit (DESIGN_DIRECTION P3), enforces RBAC server-side, and adds URL-synced tab routing so notifications can deep-link to the right surface (SITEMAP §11).

---

## 1. Refactor Phases

The refactor follows the existing Phase 6/7 sprint plan from `UX_DECISION_DOCUMENT.md` §9, but groups work by **UI layer** (component → route → integration) rather than by finding. Each UI-phase ends with a visual regression sweep + axe-core scan before the next phase starts.

### Phase A — UI Foundation (4 dev-days, parallel to Sprint 6.1)

**Goal:** Land the component primitives that every later phase depends on, with zero route churn.

| Sprint | Theme | Tasks | Exit criteria |
|--------|-------|-------|---------------|
| A.1 | Component primitive upgrades | `<Tabs>` ARIA + arrow-key nav (F-HIGH-11); `<Modal>` focus trap + `aria-labelledby` (F-HIGH-12); `<CloseIconButton>` (F-HIGH-15); `<Textarea>` shared adoption (F-MED-02) | `tsc --noEmit` clean; axe-core 0 critical on primitives; new props documented |
| A.2 | Shared menu config | Extract `src/config/sidebar-menu.ts`; `src/lib/hooks/useVisibleMenu.ts`; migrate `sidebar.tsx` and `mobile-nav.tsx` to single source (F-HIGH-02) | Visual diff vs current = 0 on all 12 role mocks |

**Why first:** Every later sprint imports these primitives. Skipping A means re-touching the same files 5+ times.

### Phase B — Safety Sprint (parallels Sprints 6.1–6.4, 25 dev-days)

**Goal:** Land 22 Must-Have changes that protect patient safety and revenue integrity. UI changes here are **surgical** — they touch specific files only.

| Sprint | Theme | UI work | Critical UI risks |
|--------|-------|---------|-------------------|
| B.1 | Quick Win Blitz (Sprint 6.1) | Render CCCD fields (F-CRIT-02); payment list display name (F-HIGH-17); revenue tooltip (F-HIGH-29); pipeline rename (F-HIGH-32); revenue annotation (F-HIGH-33) | None — additive copy + tooltip only |
| B.2 | Clinical Gates (Sprint 6.2) | Checklist gate UI (F-CRIT-10); medical_alert_resolved status badge (F-HIGH-19); audit PII redaction in diff (F-MED-17); procedure_completed second-confirm (F-CRIT-03) | Feature-flag the checklist gate; medical director sign-off on checklist items |
| B.3 | AppShell + Critical UX (Sprint 6.3) | `min-h-screen` (F-CRIT-01); next-owner banner (F-CRIT-09); shared `<Tabs>` adoption in case detail (F-HIGH-04); topbar profile placeholder (F-HIGH-01); native `confirm()` → `<ConfirmDialog>` (F-MED-01); status filter Select on mobile (F-MED-06) | Visual regression sweep across 5 routes × 3 viewports |
| B.4 | Revenue Integrity (Sprint 6.4) | Bill recompute indicator (F-HIGH-28); D1 completion ring-stat (F-HIGH-30); StaffAssignment role label (F-MED-21) | Transactional bill recompute — never mutate `totalBillAfterDiscount` |

### Phase C — Polish Sprint (parallels Sprints 7.1–7.5, 30 dev-days)

**Goal:** Land 27 Should-Have changes that bring UI to WCAG AA and consistency baseline.

| Sprint | Theme | UI work | Critical UI risks |
|--------|-------|---------|-------------------|
| C.1 | A11y Foundation | `<Modal>` close button label (F-HIGH-15 carry); case-detail tabs icon-only on mobile (F-MED-13); `<Tabs>` ARIA on every consumer | axe-core on all consumers |
| C.2 | UI Library Refactor | `<CurrencyInput>` (F-HIGH-08); reports date filter refetch (F-HIGH-18); shared menu config carry | Stale store references; hydration mismatch on `useVisibleMenu` |
| C.3 | Forms + Inputs | Doctor identity fields (F-HIGH-22); actualProcedureDate required (F-HIGH-23); lab date validation (F-HIGH-24) | Schema backward-compat — `approvedByDoctorId` optional |
| C.4 | Consent + Privacy | Image upload consent gate (F-HIGH-25); visibility change guard (F-HIGH-26); consent PDF requirement (F-HIGH-27); cascade audit (F-MED-16); medical upload sub-permission (F-MED-18) | Server-side enforcement; refusal audit log |
| C.5 | Notifications + Filtering | Notification bell inline on mobile (F-HIGH-03); notification click handler (F-HIGH-10); followup timeline colors (F-HIGH-16); filter chips with X (F-MED-05); calendar caseId search (F-MED-11); Hospital tab (F-MED-15); calendar required caseId (F-MED-02 carry); nurse/cskh cancel block (F-MED-14) | URL-synced tab sync + permission gate on Hospital tab |

### Phase D — Rollout & QA Gate (3 dev-days, after Phase C)

- Run full visual regression suite across 12 roles × 3 viewports × 21 routes
- axe-core scan on every protected route; 0 critical issues
- Manual smoke on iPhone 12 (Safari), iPad Mini, Pixel 7, desktop Chrome
- CEO + medical director + accountant sign-off

### Phase E — Documentation & Handoff (1 dev-day)

- Update `CLAUDE.md` with Phase 6 + 7 status table
- Update `docs/ux-redesign/SITEMAP.md` if any new routes added (none expected)
- Record 2 × ≤3 min Loom videos ("What's new in Phase 6", "What's new in Phase 7")
- Publish SOPs: "Pre-procedure clinical checklist", "Payment SoD for accountants"

---

## 2. Component Migration Order

Components are migrated in **dependency order** (primitives → composite consumers → page-level), with each primitive stabilized before its consumers land.

| Order | Component | Why this slot | Consumers touched (representative) | Pattern reference |
|------:|-----------|---------------|-----------------------------------|-------------------|
| 1 | `<CloseIconButton>` | Pure leaf, no deps | `<Modal>`, `<ConfirmDialog>`, MobileNav drawer, attachment-list | DESIGN_DIRECTION §14 |
| 2 | `<Textarea>` | Already exists; just enforce adoption | `calendar/page.tsx`, consent panel, customer notes | F-MED-02 |
| 3 | `<Modal>` (focus trap + a11y) | Used by 12+ dialogs | All `*Dialog` components, customer/care/payment create | F-HIGH-12, F-HIGH-15, F-CRIT-01 (sheet on mobile) |
| 4 | `<ConfirmDialog>` variants | Native `confirm()` ban (A9) | Remove service (F-MED-01), request delete (F-HIGH-13), status terminal transitions | F-MED-01, F-HIGH-13 |
| 5 | `<Tabs>` (ARIA + arrow nav + URL sync) | 8 tabs in case detail + 5 tabs in customer detail | `cases/[id]/page.tsx`, `customers/[id]/page.tsx`, reports, notifications | F-HIGH-04, F-HIGH-11, SITEMAP §11.6 |
| 6 | `<CurrencyInput>` | Form inputs only | `cases/new`, case detail edit, payment create, service editor | F-HIGH-08, A10 |
| 7 | `useVisibleMenu` hook + `sidebar-menu.ts` | Eliminates F-HIGH-02 duplication | `sidebar.tsx`, `mobile-nav.tsx` | F-HIGH-02, SITEMAP §7.2 |
| 8 | `<StatCard>` (clickable + tooltip) | Depends on URL-synced filter routes | `dashboard/stat-cards.tsx`, `dashboard/quick-reports.tsx` | F-CRIT-07, F-HIGH-29, F-HIGH-30, SITEMAP §8.2 |
| 9 | `<DataTable>` (mobile compact variant) | Touch targets ≥44 px | All list pages on `< sm` | M2, V3, DESIGN_DIRECTION §16 |
| 10 | `<NextOwnerBanner>`, `<MedicalAlertBanner>`, `<BillRecomputeIndicator>` | New composites, no deps | `cases/[id]/page.tsx` (Info tab only) | F-CRIT-09, P1, F-HIGH-28 |

**Migration rule (DESIGN_DIRECTION §14.1):** A new page or modal **must** use these primitives. The case detail page is the canary — if it ships without hand-rolled tabs, the rollout is healthy.

**Pattern reference sources:**
- `<Tabs>` URL sync: `useSearchParams()` + `router.replace(`?tab=${tab}`, { scroll: false })`
- `<Modal>` sheet on `< sm`: responsive variant prop, full-screen below 640px
- `<CurrencyInput>`: number-only `inputMode="decimal"`, format on blur, parse on change

---

## 3. Route Migration Order

Routes are migrated by **user-traffic volume × role-diversity × risk**, so that high-leverage routes stabilize first and act as reference implementations for tail routes.

| Order | Route | Why this slot | Migration scope | Key references |
|------:|-------|---------------|-----------------|----------------|
| 1 | `/dashboard` | Home for all 12 roles; references new dashboard queue | StatCards become clickable (F-CRIT-07, F-HIGH-29, F-HIGH-30); 8 ranked cards; next-owner banner; tooltips | SITEMAP §8, DESIGN_DIRECTION §7 |
| 2 | `/cases/[id]` | Clinical heart; densest surface (10 changes); canary for `<Tabs>` + banner composites | 8 tabs URL-synced; `<Tabs>` adoption; status workflow gate; next-owner banner; medical alert banner; checklist gate; bill recompute indicator | SITEMAP §9.4, DESIGN_DIRECTION §9 |
| 3 | `/customers/[id]` | Cross-references case detail; 4 tabs | URL-synced tabs; CCCD fields (F-CRIT-02); display name resolution; delete approval banner | INFORMATION_ARCHITECTURE §3.2 |
| 4 | `/customers` (list) | High-volume; sales/cso master_sales daily | Search debounce verified; row density compact on mobile; actions column dropdown already wired | F-MED-25 deferred direction noted |
| 5 | `/cases` (list) | High-volume; 7 roles daily | Status filter chips on desktop, `<Select>` on mobile (F-MED-06); new `?status=` query param | SITEMAP §11.7 |
| 6 | `/payments` (list) | Accountant daily; revenue surface | Display name resolution (F-HIGH-17); `?status=` filter (proposed); search deferred (F-MED-24) | F-HIGH-17 |
| 7 | `/payments/new` | Mutation hot path; uses `<CurrencyInput>` | VND-formatted input; caseId search-and-select; mobile sheet (M7) | F-HIGH-08 |
| 8 | `/cases/new` | Sales primary entry; 22-field form | `<CurrencyInput>` adoption; lab date ≤ procedure date validation (F-HIGH-24); mobile sheet | F-HIGH-08, F-HIGH-24 |
| 9 | `/calendar` | Coordinator/sales daily | Required `caseId` (F-MED-02); `<Textarea>` adoption; search-and-select (F-MED-11); event opens Procedure tab | F-MED-02, F-MED-11 |
| 10 | `/followups` | cskh_postop/nurse daily | Semantic timeline colors (F-HIGH-16); `?day=D1` + `?status=pending` filters; auto-escalate to doctor (F-HIGH-20) | F-HIGH-16, F-HIGH-20, F-HIGH-30 |
| 11 | `/reports` | CEO/accountant/cso weekly | Revenue tooltip + refund line (F-HIGH-33); pipeline rename (F-HIGH-32); filter refetch (F-HIGH-18); "Đang lọc…" pill | F-HIGH-18, F-HIGH-32, F-HIGH-33 |
| 12 | `/notifications` | All 12 roles | Click handler with error path (F-HIGH-10); inline expand on mobile (F-HIGH-03); filter chips with X (F-MED-05) | F-HIGH-03, F-HIGH-10, F-MED-05 |
| 13 | `/audit-logs` | cso/ceo/admin | PII redaction in diff (F-MED-17); filter chips with X (F-MED-05); keyboard nav | F-MED-05, F-MED-17 |
| 14 | `/notifications` (topbar dropdown) | Mobile entry | Inline expansion pattern (M10); deep-link handler reuses page logic | F-HIGH-03 |
| 15 | `/settings/users` | Admin only; existing primitives | Audit log verification; toggle active confirmation | (carry) |
| 16 | `/settings/roles` | Admin only; read-only | (carry) | (carry) |
| 17 | `/settings/services` | Admin only | `<CurrencyInput>` for price | F-HIGH-08 |
| 18 | `/settings/treatment-locations` | Admin only | (carry) | (carry) |
| 19 | `/login` | Public | (carry) | (carry) |
| 20 | `/customers/new` | Mobile entry | Full-screen sheet on `< sm` (M7); single-column form | M7, M8 |
| 21 | Global shell (`(protected)/layout.tsx`) | Wraps all 21 | `min-h-screen` (F-CRIT-01); use `useVisibleMenu` (F-HIGH-02); `<CloseIconButton>` adoption | F-CRIT-01, F-HIGH-02 |

**Migration rules:**
- Routes 1–3 ship first as a "design system canary" — every primitive is exercised, every anti-pattern from A1–A25 is reviewed.
- Routes 4–9 follow after canary ships; pair with quick wins from B.1 for low-risk rollouts.
- Routes 10–14 are the "Polish" wave; they depend on `<Tabs>` URL sync and `<ConfirmDialog>` being stable.
- Routes 15–21 are mostly carry-overs; only migrate if they share a primitive being upgraded.

---

## 4. Design System Migration

The design system is **extended, not forked** (DESIGN_DIRECTION §13.3). No new color tokens, no new typography weights, no new component primitives.

### 4.1 Tokens — what stays, what gets reused

| Token | Action | Notes |
|-------|--------|-------|
| Swan Aqua `#00ADBE` | **Keep** | Primary brand; primary CTA, focus ring |
| Champagne Gold `#C9A96E` | **Keep** | Premium tier only (V2) |
| Cream `#FFF9F0` | **Keep** | Page background base |
| `shadow-soft / medium / elevated / glow-swan` | **Keep** | Card elevation tiered |
| `bg-gradient-swan / champagne / page` | **Keep** | Premium feel |
| Status tones (success/warning/danger/info/neutral) | **Keep + reuse** | §15; revenue refund always red (F-HIGH-33) |
| Typography (Inter, 4 px scale) | **Keep** | Vietnamese diacritics OK |
| Lucide icons only, stroke 1.5/2 | **Keep** | V4 |

### 4.2 New design-system tokens (additions only)

| Token | Purpose | Source |
|-------|---------|--------|
| `medical_alert_resolved` status | Replaces the audit-breaking `medical_alert → completed` path | F-HIGH-19 |
| `attachments:medical_upload` permission | Restricts medical image upload to nurse/doctor | F-MED-18 |
| `CaseRecord.approvedByDoctorId` + `medicalApprovedAt` | Doctor identity on `medically_approved` (optional, backward-compatible) | F-HIGH-22 |
| `Consent.documentStoragePath` | Required to transition consent to `granted` | F-HIGH-27 |
| `Notification.targetTab?` + `targetType?` | Deep-link hint from notification to case tab | SITEMAP §11.3 |

### 4.3 Component variant additions (no new primitives)

| Component | New variants | Replaces |
|-----------|-------------|----------|
| `<Button>` | `danger`, `gold` already exist; ensure consistent | (existing) |
| `<Badge>` | `success`/`warning`/`danger`/`info`/`neutral`/`gold` | (existing) |
| `<Card>` | `default`/`glass`/`elevated`/`compact` | (existing) |
| `<Tabs>` | `pill` (existing) / `underline` (existing) / URL-synced (new behavior) | Hand-rolled tabs (A7) |
| `<Modal>` | `default`/`sheet` (mobile, new) / `fullscreen` | Hand-rolled dialogs |
| `<ConfirmDialog>` | `info`/`warning`/`danger` (new variants) | Native `confirm()` (A9) |
| `<Input>` | `default`/`error`/`disabled` (existing) | (existing) |
| `<DataTable>` | `comfortable`/`compact` (compact is mobile) | (existing) |
| `<CurrencyInput>` (new) | VND formatting only | Raw number inputs (A10) |
| `<CloseIconButton>` (new leaf) | `ariaLabel` prop required | Inline X buttons |

### 4.4 Anti-pattern enforcement (DESIGN_DIRECTION §18, A1–A25)

The audit caught 25 anti-patterns. Each refactored PR is scanned against this list before merge. New patterns require **Decision Log entry** to add.

| Anti-pattern | PR-blocking check |
|--------------|-------------------|
| A1 Silent fallback defaults | grep for `?? 'general'` / `?? 'unknown'` / `'pending'` as defaults |
| A2 Raw user/entity IDs in copy | grep for `user-001`, `case-001` in JSX strings |
| A3 Ambiguous aggregates | lint rule: every StatCard has `tooltip` prop |
| A4 Conflated forecast/cash | grep for `Doanh thu` without "đã xác nhận" or "Bill" qualifier |
| A5 Decorative-only status indicators | UI: status badges must change color/text by state |
| A6 Hidden-only permissions | grep `hidden &&` for action buttons; require `disabled` instead |
| A7 Hand-rolled tabs/modals/textareas | grep for `<div role="tab"` outside `<Tabs>`; raw `<textarea>` |
| A8 Dead links | grep for `onClick={() => {}}` in buttons |
| A9 Native `confirm()`/`alert()` | grep `confirm(` and `alert(` outside `__tests__` |
| A10 Raw numeric inputs for currency | grep `type="number"` for money fields |
| A11 PII in audit log diffs | unit test: redaction function strips `medicalNote`/`privacyNote`/`nationalIdNumber` |
| A12 Skipped clinical gates | e2e: hospital_confirmed cannot transition to scheduled |
| A13 Permissive status transitions | e2e: medical_alert cannot revert to procedure_completed |
| A14 Consent treated as progressive | server-side: `marketing_usage` must be `granted`, never inherited |
| A15–A25 | Various — covered by individual test scenarios |

### 4.5 Status color rule (DESIGN_DIRECTION §15.3)

- Status color appears on **badges, banners, dots** only — never on button labels, never on card borders (use shadow).
- Every color cue is paired with an icon or text label (no color-only signals).
- Revenue refund is **always red** (F-HIGH-33).
- Brand colors do not communicate state (Gold is for premium tier only).

---

## 5. Testing Strategy

The QA-architect skill defines 10 test layers; the refactor uses all 10, with priority order matched to the 11 high-risk items from `UX_DECISION_DOCUMENT.md` §11.

### 5.1 Test pyramid (per-route, per-role)

| Layer | Tool | Coverage target | Owner |
|-------|------|-----------------|-------|
| 1. Functional (unit) | Vitest + React Testing Library | All new/modified pure functions, hooks (`useVisibleMenu`, `getNextOwner`, `getNotificationTarget`, `tooltipFormatVND`) | tech-lead |
| 2. Validation | Vitest + Zod | Every Zod schema: valid + boundary + invalid cases (lab date > procedure date, empty CCCD, negative bill) | tech-lead |
| 3. Workflow | Vitest state machine | Case status transitions matrix (28 statuses × role × checklist state) | medical-workflow-expert + tech-lead |
| 4. Permission | Vitest + mock user fixtures | All 35 permissions × 12 roles — negative test for every rule | rbac-expert |
| 5. Security | Vitest + audit log mocks | PII redaction in diff (F-MED-17); consent gate refusal paths (F-HIGH-25/26) | data-privacy-expert |
| 6. Integration | Vitest + Next.js route handler mocks | API routes: status transitions, payment confirm, attachment visibility change, consent grant | tech-lead |
| 7. Performance | Manual + Lighthouse | Dashboard 8-card render < 200 ms; case detail 8 tabs < 300 ms; reports chart first paint < 1 s | nextjs-expert |
| 8. Data integrity | Vitest + Firestore transaction mocks | Concurrent payment confirms produce deterministic state (F-CRIT-08); bill recompute never mutates historical field (F-HIGH-28) | tech-lead |
| 9. Mobile/responsive | Playwright + device matrix | 360 px (iPhone SE), 390 px (iPhone 12), 768 px (iPad Mini), 1024 px (laptop), 1280 px (desktop) — no horizontal scroll, ≥44 px touch targets | qa-architect |
| 10. Regression | Playwright snapshot diffs | Per-route per-viewport screenshots; per-role sidebar visible-item matrix | qa-architect |

### 5.2 Per-finding test scenario matrix (high-risk items only)

11 high-risk items from `UX_DECISION_DOCUMENT.md` §11 each require a paired verification test before merge. Examples:

| Finding | Test | Pass criteria |
|---------|------|---------------|
| F-CRIT-08 (race) | Fire 5 concurrent payment confirms via Promise.all in unit test | Final `amountPaid` equals sum of confirmed payments; no double-count |
| F-CRIT-10 (checklist gate) | E2E: case with `allPassed=false` cannot transition to `procedure_completed` | API returns 403; UI shows banner |
| F-HIGH-28 (bill recompute) | Add then remove service in test; `totalBillAfterDiscountLatest` matches formula; original field untouched | Database diff confirms |
| F-HIGH-25 (consent gate upload) | Try `public_marketing` upload with `marketing_usage=pending` | Server returns 403; audit log entry written |
| F-HIGH-26 (visibility change) | Change visibility to `public_marketing` with `marketing_usage=denied` | Modal shows refusal; no DB write |
| F-CRIT-01 (AppShell) | Playwright snapshot at iPhone 12 viewport × 5 routes | No URL-bar overlap; sticky topbar works |
| F-CRIT-03 (clinical checklist) | Manual SOP walkthrough with medical director on 3 historical cases | All 6 items answered correctly |
| F-HIGH-22 (doctor identity) | Unit: transition to `medically_approved` without `approvedByDoctorId` | Validation rejects; requires doctor role |
| F-MED-17 (PII redaction) | Unit: redact function on 5 historical audit logs | `medicalNote`/`privacyNote`/`nationalIdNumber` absent from output |
| F-CRIT-05 (server RBAC) | E2E with `sales_online` mock: try status transition | API returns 403; audit log entry written |
| F-HIGH-02 (menu dedup) | Playwright per-role per-viewport sidebar snapshot | Desktop + mobile show identical menu |

### 5.3 Accessibility testing

- **axe-core** scan on every protected route after each phase — 0 critical issues required
- **Manual keyboard sweep:** Tab order, focus visibility, `<Modal>` focus trap, `<Tabs>` arrow-key navigation, ESC closes, focus returns to trigger
- **Screen-reader pass** (NVDA or VoiceOver) on: dashboard, case detail, customer form, payment confirm, notification bell
- **Color contrast** verification: every status tone ≥ 4.5:1 against cream background (DESIGN_DIRECTION §17.3)
- **`prefers-reduced-motion`** honored: all `animate-*` degrade to instant

### 5.4 Mobile-device matrix (M5: no horizontal scroll at 360 px)

| Device | OS | Browser | Viewport |
|--------|----|---------|----------|
| iPhone SE | iOS 17 | Safari | 360 × 667 |
| iPhone 12 | iOS 17 | Safari | 390 × 844 |
| Pixel 7 | Android 14 | Chrome | 412 × 915 |
| iPad Mini | iOS 17 | Safari | 768 × 1024 |
| Desktop | — | Chrome | 1280 × 800 |

Smoke test on real iPhone 12 + iPad Mini before Phase D sign-off.

---

## 6. Regression Checklist

Per-route regression sweep at the end of Phase D. Each item is verified by qa-architect with a passing test ID.

### 6.1 Per-route visual regression (Playwright snapshots)

For each of the 21 protected routes × 3 viewports (mobile 360, tablet 768, desktop 1280), a baseline screenshot is captured at the start of Phase A and diffed at the end of Phase D. **Any unintended visual diff blocks release.**

Affected routes:
1. `/dashboard`
2. `/customers`
3. `/customers/new`
4. `/customers/[id]`
5. `/cases`
6. `/cases/new`
7. `/cases/[id]` × 8 tabs
8. `/payments`
9. `/payments/new`
10. `/calendar`
11. `/tasks`
12. `/followups`
13. `/reports`
14. `/notifications`
15. `/audit-logs`
16. `/settings/users`
17. `/settings/roles`
18. `/settings/services`
19. `/settings/treatment-locations`
20. `/login`
21. Root redirect `/`

### 6.2 Per-role sidebar visibility regression

From `SITEMAP.md` §5.3: 12 roles × 14 sidebar items = 168-cell matrix. All cells must match baseline after F-HIGH-02.

### 6.3 Permission regression (12 roles × 35 permissions)

From `SITEMAP.md` §6.1: 12 × 35 = 420-cell matrix. Every negative test must still fail (denied) and every positive test must still pass.

### 6.4 Functional regression — must-pass list

- [ ] Customer form captures all 3 CCCD fields and persists (F-CRIT-02)
- [ ] Case status `hospital_confirmed` cannot transition to `scheduled` via UI or API (F-CRIT-04)
- [ ] Case status API enforces `CASE_STATUS_CHANGE_ROLES` server-side (F-CRIT-05)
- [ ] Accountant cannot confirm own payment (server-side check) (F-CRIT-06)
- [ ] Dashboard shows `lab_overdue_count` and links to filtered case list (F-CRIT-07)
- [ ] Case detail Info tab shows next-owner banner (F-CRIT-09)
- [ ] Case with `allPassed=false` cannot transition to `procedure_completed` (F-CRIT-10)
- [ ] `medical_alert` cannot revert to `procedure_completed` (F-HIGH-19)
- [ ] Payment concurrent confirms produce deterministic final state (F-CRIT-08)
- [ ] Audit log diff does not contain `medicalNote`/`privacyNote`/`nationalIdNumber` (F-MED-17)
- [ ] Image upload with `public_marketing` visibility fails when consent not granted (F-HIGH-25)
- [ ] Modal focus trap verified; ESC closes; focus returns to trigger (F-HIGH-12)
- [ ] Tabs arrow-key navigation, Home/End, ARIA roles (F-HIGH-11)
- [ ] Hospital tab visible only to coordinator/cso/admin (F-MED-15)
- [ ] Reports date filter refetches; "Đang lọc…" pill visible during fetch (F-HIGH-18)
- [ ] Topbar profile button shows "Đang phát triển" toast (F-HIGH-01)
- [ ] Notification click handler has error fallback (F-HIGH-10)
- [ ] Case status filter is chips on desktop, `<Select>` on mobile (F-MED-06)
- [ ] Mobile Safari renders dashboard without URL-bar overlap (F-CRIT-01)
- [ ] Notification deep-link lands on correct tab (SITEMAP §11)

### 6.5 Build & lint regression

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm run lint` → 0 warnings
- [ ] `npm run build` → 34 routes, 0 errors
- [ ] Bundle size delta ≤ 5% (no new primitives; expect <1%)

### 6.6 Documentation regression

- [ ] `CLAUDE.md` updated with Phase 6 + 7 status table
- [ ] `docs/ux-redesign/SITEMAP.md` cross-checked with actual routes
- [ ] Each new component prop documented in JSDoc

---

## 7. Rollback Plan

### 7.1 Branch strategy

| Branch | Purpose | Lifecycle |
|--------|---------|-----------|
| `main` | Stable; Phase 5 baseline | Frozen during Phase 6 |
| `phase-6/ui-foundation` | Phase A work | Merged after Phase A gate |
| `phase-6/sprint-6.1` through `phase-6/sprint-6.4` | Each B-sprint | Merged in order after DoD |
| `phase-7/sprint-7.1` through `phase-7/sprint-7.5` | Each C-sprint | Merged in order after DoD |
| `release/v6.0.0` | Tagged at Phase D gate | Frozen |

PRs are merged in sprint order. Rollback is per-sprint, not per-PR.

### 7.2 Feature flags for high-risk items

(See §9 for full feature-flag list.)

The 11 high-risk items from `UX_DECISION_DOCUMENT.md` §11 ship behind feature flags. Each flag has a paired senior reviewer sign-off before being turned on in production:

- F-CRIT-10 (checklist gate) — `NEXT_PUBLIC_FEATURE_CHECKLIST_GATE`
- F-HIGH-25, F-HIGH-26 (consent gates) — `NEXT_PUBLIC_FEATURE_CONSENT_GATE`
- F-CRIT-08 (payment transaction) — `NEXT_PUBLIC_FEATURE_PAYMENT_TX`
- F-CRIT-05 (server-side RBAC) — `NEXT_PUBLIC_FEATURE_SERVER_RBAC`
- F-HIGH-02 (shared menu) — `NEXT_PUBLIC_FEATURE_SHARED_MENU`
- F-CRIT-01 (AppShell min-h-screen) — `NEXT_PUBLIC_FEATURE_MINH_SCREEN`
- F-CRIT-03 (clinical checklist items) — `NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST`

### 7.3 Rollback procedure

**Trigger conditions:**
- Critical bug introduced (P0 from incident triage)
- axe-core critical issue found post-merge
- More than 3 visual regression failures in same sprint
- Permission regression discovered in any role

**Rollback steps:**

1. **Identify scope** — determine whether the issue is in Phase A (foundation), B (safety), or C (polish).
2. **Revert merge** — `git revert -m 1 <merge-sha>` for the affected sprint branch. Tag the revert.
3. **Verify baseline** — re-run Phase D regression suite against `main`. All green required.
4. **Communicate** — `release-manager` posts incident note; affected users notified (per role).
5. **Post-mortem** — within 48h, document root cause and update regression checklist.

**Rollback targets:**

- Phase A rollback → revert to Phase 5 baseline (last stable `main` before Phase A)
- Phase B rollback → revert to Phase A merged; Phase B sprints revert one at a time
- Phase C rollback → revert to Phase B merged; Phase C sprints are independent

**Data migrations** (must be reversible):

| Migration | Reversibility | Strategy |
|-----------|---------------|----------|
| Add `CaseRecord.approvedByDoctorId`, `medicalApprovedAt` | **Backward-compatible** | Optional fields; no backfill needed |
| Add `medical_alert_resolved` status | **Backward-compatible** | New status; existing `medical_alert` cases stay |
| Add `attachments:medical_upload` permission | **Backward-compatible** | New sub-permission; default to false for existing roles |
| Add `Consent.documentStoragePath` | **Backward-compatible** | Optional field; only required for new grants |

**No data is ever destroyed.** All migrations are additive only. `totalBillAfterDiscount` historical field is never mutated — `*Latest` suffix is added for new recomputed values.

### 7.4 Rollback drill

Before Phase D, conduct a 2-hour rollback drill:
1. Tag a release candidate `release/v6.0.0-rc1`
2. Revert one Phase B sprint to `main` in a sandbox
3. Verify regression suite + manual smoke
4. Document the drill outcome in the Phase D gate

---

## 8. Deployment Strategy

### 8.1 Environments

| Environment | URL pattern | Purpose | Data |
|-------------|------------|---------|------|
| Local (dev) | `localhost:3000` | Day-to-day development | Mock store |
| Preview (Vercel) | `swan-crm-<branch>.vercel.app` | PR preview | Mock store |
| Staging | `staging.swan-crm.vercel.app` | Pre-prod; CEO/medical director review | Staging Firebase project |
| Production | `swan-crm.vercel.app` | Live | Production Firebase |

### 8.2 Deployment phases

| Phase | Target | Promotion criteria | Owner |
|-------|--------|--------------------|-------|
| Phase A.1 | Local | tsc/lint/build green; primitives unit-tested | tech-lead |
| Phase A.2 | Preview | Visual regression vs baseline = 0 | ui-designer + tech-lead |
| Phase B.1 (Quick Win Blitz) | Staging | 13 quick wins green; CEO + accountant sign-off | release-manager |
| Phase B.2 (Clinical Gates) | Staging | Medical director sign-off; 1-week pilot with 3 cso users | release-manager + medical-workflow-expert |
| Phase B.3 (AppShell + Critical UX) | Staging | Visual regression green on 5 routes × 3 viewports | ui-designer + qa-architect |
| Phase B.4 (Revenue Integrity) | Staging | Accountant sign-off; mock-store re-seed verification | tech-lead + rbac-expert |
| Phase C.1 (A11y Foundation) | Staging | axe-core 0 critical; modal focus trap verified | qa-architect |
| Phase C.2–C.5 | Staging | Per-sprint QA gate | per-sprint owner |
| Phase D (Rollout & QA Gate) | Production | Full regression suite + sign-offs | release-manager |

### 8.3 Production rollout cadence

- **Phase A:** deploy after merge — low risk, additive only
- **Phase B:** deploy per-sprint after sign-off — medium risk, behind feature flags
- **Phase C:** deploy per-sprint — low-to-medium risk, mostly UI polish
- **Final tag:** `release/v6.0.0` at end of Phase D; production deploy

### 8.4 Monitoring & observability

| Signal | Tool | Alert threshold |
|--------|------|-----------------|
| Page errors (JS exceptions) | Vercel Analytics | >1% error rate |
| API route 4xx/5xx | Vercel Analytics | >2% on any single route |
| Lighthouse performance score | Vercel Speed Insights | < 80 on any protected route |
| Audit log growth | Firebase console | > 200 entries/day (sanity check) |
| Firestore read counts | Firebase console | > 50k reads/day (cost guard) |
| Failed payment confirms | Custom log | > 0 over 1-hour window (data integrity alarm) |

### 8.5 Pre-production checklist

- [ ] `npm run build` → 0 errors
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm run lint` → 0 warnings
- [ ] All feature flags set per `.env.production`
- [ ] Firestore rules deployed (`firestore.rules` + `firestore.indexes.json`)
- [ ] Storage rules deployed (`storage.rules`)
- [ ] All 4 sign-offs collected (CEO, medical director, accountant lead, data-privacy lead)

---

## 9. Feature Flags

Feature flags use the existing pattern (`NEXT_PUBLIC_*` env vars read at build/runtime). Each flag has:
- Default in dev: ON (except where safety requires staged rollout)
- Default in production: OFF until sign-off, then ON per sprint

### 9.1 Feature flag catalog

| Flag | Default (dev/prod) | Sprint | Owner | Rollback action |
|------|--------------------|--------|-------|-----------------|
| `NEXT_PUBLIC_FEATURE_CHECKLIST_GATE` | ON / OFF | B.2 | medical-workflow-expert | Set OFF → checklist becomes decorative again |
| `NEXT_PUBLIC_FEATURE_CONSENT_GATE` | ON / OFF | C.4 | data-privacy-expert | Set OFF → uploads bypass consent (rollback to insecure baseline) |
| `NEXT_PUBLIC_FEATURE_PAYMENT_TX` | ON / OFF | B.4 | rbac-expert | Set OFF → revert to non-transactional confirms (last-known-good state) |
| `NEXT_PUBLIC_FEATURE_SERVER_RBAC` | ON / OFF | B.1 | rbac-expert | Set OFF → status API falls back to `cases:write` only |
| `NEXT_PUBLIC_FEATURE_SHARED_MENU` | ON / OFF | A.2 | tech-lead | Set OFF → sidebar.tsx uses inline arrays (legacy) |
| `NEXT_PUBLIC_FEATURE_MINH_SCREEN` | ON / OFF | B.3 | ui-designer | Set OFF → AppShell reverts to `h-screen` |
| `NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST` | ON / OFF | B.2 | medical-workflow-expert | Set OFF → only original checklist items render |
| `NEXT_PUBLIC_FEATURE_URL_TABS` | ON / OFF | C.5 | tech-lead | Set OFF → tabs revert to local `useState` |
| `NEXT_PUBLIC_FEATURE_DASHBOARD_QUEUE` | ON / OFF | B.3 | ux-designer | Set OFF → dashboard reverts to 4 StatCards + RecentActivity |
| `NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE` | ON / OFF | B.4 | tech-lead | Set OFF → add/remove service does not trigger recompute |

### 9.2 Flag rollout sequence

Each flag follows: dev (1 day) → staging (3 days with sign-off) → prod (gradual rollout: 10% → 50% → 100% over 24h via Vercel Edge Config or similar).

For high-risk flags (CHECKLIST_GATE, CONSENT_GATE, PAYMENT_TX, SERVER_RBAC): grad rollout is **mandatory**. For low-risk flags (URL_TABS, DASHBOARD_QUEUE): instant cutover acceptable after staging sign-off.

### 9.3 Flag lifecycle

- Flag removed when its feature has been stable for 2+ sprints with zero rollbacks
- Removal is a refactor PR — branches off `main`, removes code + flag reads, ships in next sprint

---

## 10. QA Plan

The QA plan is structured as a **gate per phase**, with explicit pass criteria and sign-off owners. No phase proceeds to the next without all gates green.

### 10.1 Phase gates

| Gate | Trigger | Pass criteria | Sign-off owner | Output |
|------|---------|---------------|----------------|--------|
| A-Gate | End of Phase A | tsc/lint/build clean; new primitives have unit tests; useVisibleMenu dedup verified across 12 role mocks | tech-lead + ui-designer | Tag `phase-a-done` |
| B.1-Gate | End of Sprint 6.1 | 13 quick-win findings closed in `UX_AUDIT_REPORT.md`; regression suite green | release-manager | Tag `phase-b1-done` |
| B.2-Gate | End of Sprint 6.2 | Checklist gate passes 3-case pilot; medical director sign-off on 6-item checklist | medical-workflow-expert + tech-lead | Tag `phase-b2-done` |
| B.3-Gate | End of Sprint 6.3 | Mobile Safari (iPhone 12) renders dashboard without URL-bar overlap; visual regression green on 5 routes × 3 viewports | ui-designer + qa-architect | Tag `phase-b3-done` |
| B.4-Gate | End of Sprint 6.4 | 5 concurrent payment confirms produce deterministic state; mock-store re-seed verification; bill recompute never mutates historical field | rbac-expert + tech-lead | Tag `phase-b4-done` |
| C-Gate | End of Phase C | axe-core 0 critical on all 21 routes; all 11 high-risk items pass paired verification; 12 roles × 35 permissions matrix verified | qa-architect + release-manager | Tag `phase-c-done` |
| D-Gate | End of Phase D | Full regression suite (§6); 4 sign-offs collected; documentation updated | release-manager + product-owner | Tag `release/v6.0.0` |

### 10.2 Test scenarios per high-risk finding (per `UX_DECISION_DOCUMENT.md` §11)

For each of the 11 high-risk items, the QA plan requires:

| ID | Title | Scenario | Pass criteria | Owner |
|----|-------|----------|---------------|-------|
| F-CRIT-08 | Payment race condition | Unit: 5 concurrent confirms via `Promise.all` | Final `amountPaid` == sum of confirmed; no double-count | tech-lead |
| F-CRIT-10 | Checklist gate | E2E: case with `allPassed=false` blocks `procedure_completed` | API 403; UI banner visible | qa-architect |
| F-HIGH-28 | BillSummary recompute | Unit: add then remove service; assert `*Latest` updated, original untouched | DB diff confirms | tech-lead |
| F-HIGH-25 | Server-side consent upload | E2E: upload `public_marketing` with `marketing_usage=pending` | API 403; audit log entry | data-privacy-expert |
| F-HIGH-26 | Visibility change gate | E2E: change visibility to `public_marketing` with `marketing_usage=denied` | Modal refuses; no DB write | data-privacy-expert |
| F-CRIT-01 | AppShell min-h-screen | Playwright on iPhone 12 × 5 routes | No URL-bar overlap | qa-architect |
| F-CRIT-03 | Clinical checklist items | Manual walkthrough with medical director on 3 historical cases | All 6 items answered correctly | medical-workflow-expert |
| F-HIGH-22 | Doctor identity on approval | Unit: transition to `medically_approved` without `approvedByDoctorId` | Validation rejects | tech-lead |
| F-MED-17 | Audit PII redaction | Unit: redact function on 5 historical audit logs | `medicalNote`/`privacyNote`/`nationalIdNumber` absent | data-privacy-expert |
| F-CRIT-05 | Server RBAC | E2E with `sales_online`: try status transition | API 403; audit log entry | rbac-expert |
| F-HIGH-02 | Shared menu dedup | Playwright per-role × per-viewport sidebar snapshot | Desktop + mobile show identical menu | qa-architect |

### 10.3 Per-role acceptance criteria (12 roles × 21 routes)

For each role, the acceptance test covers the **primary routes** (SITEMAP §5.1) with at least one happy path + one denial scenario.

| Role | Primary routes | Key tests |
|------|----------------|-----------|
| admin | All 21 | All role-mocks render; all 35 permissions granted |
| ceo | Dashboard, Reports, Customers (read), Cases (read), Audit-logs | Revenue tooltip visible; audit PII redacted |
| cso | Dashboard, Cases, Customers, Calendar, Payments, Reports, Hospital tab | Hospital tab visible; payment confirm forbidden on own payments |
| master_sales | Customers, Cases, Payments, Calendar | Case create works; CCCD fields visible |
| sales_online/offline | Customers, Cases, Calendar | CCCD fields visible; status transition blocked (F-CRIT-05) |
| accountant | Payments, Reports | Cannot confirm own payment; payment list shows display names |
| doctor | Cases, Calendar, Followups | Checklist gate blocks bad transitions; medical_alert_resolved terminal |
| nurse | Cases (read), Calendar, Followups, Tasks | Cannot cancel case (F-MED-14); medical image upload works |
| coordinator | Cases, Calendar, Tasks, Followups, Customers | Hospital tab visible; case assign works |
| cskh_postop | Followups, Tasks | Followup timeline semantic colors; auto-escalate works |
| media | Cases (read, attachments only) | Attachment upload visibility gate works (F-HIGH-25) |

### 10.4 Mobile acceptance criteria (5 devices)

For each device in §5.4:
- [ ] No horizontal scroll at 360 px
- [ ] Touch targets ≥ 44 × 44 px
- [ ] Status filter renders as `<Select>` on `< md`
- [ ] Case detail tabs render icon-only on `< sm`
- [ ] Modal renders as full-screen sheet on `< sm`
- [ ] Action bar is sticky bottom on detail pages
- [ ] Notification bell expands inline (not popover)
- [ ] Search input always visible on list pages

### 10.5 Accessibility acceptance criteria (WCAG 2.1 AA)

- [ ] axe-core: 0 critical issues on every protected route
- [ ] Keyboard sweep: Tab order, focus visibility, modal trap, ESC close, focus return
- [ ] Screen reader pass (NVDA + VoiceOver): dashboard, case detail, payment confirm
- [ ] Color contrast: every status tone ≥ 4.5:1 against cream
- [ ] `prefers-reduced-motion`: all animations degrade to instant
- [ ] Text resizes to 200% without breaking layout

### 10.6 Release gate (Phase D)

All of the following must be true before `release/v6.0.0` is tagged:

- [ ] All 22 Phase 6 Must-Have findings closed in `UX_AUDIT_REPORT.md`
- [ ] All 27 Phase 7 Should-Have findings closed
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm run lint` → 0 warnings
- [ ] `npm run build` → 34 routes, 0 errors
- [ ] All 7 A–Gates passed
- [ ] All 11 high-risk findings have paired verification test passing
- [ ] axe-core 0 critical on all 21 routes
- [ ] Visual regression baseline = 0 on all 21 routes × 3 viewports
- [ ] 12 roles × 35 permissions matrix verified
- [ ] Mobile acceptance on 5 devices passed
- [ ] Rollback drill completed
- [ ] 4 sign-offs collected:
  - [ ] CEO (F-CRIT-06 accountant SoD + F-HIGH-29 revenue tooltip)
  - [ ] Medical director (F-CRIT-03 clinical checklist + F-CRIT-10 gate)
  - [ ] Accountant lead (F-CRIT-08 transactional confirms)
  - [ ] Data-privacy lead (F-MED-17 PII redaction)
- [ ] Documentation:
  - [ ] `CLAUDE.md` updated
  - [ ] 2 × Loom videos recorded
  - [ ] 2 × SOPs published
- [ ] All feature flags: documented, sign-off chain established, rollback path verified

---

## Critical Files (representative)

The refactor touches a wide surface, but the following files are the **load-bearing** ones. Patterns repeat across the codebase — fix these, then propagate.

### Components
- [src/components/ui/tabs.tsx](../../src/components/ui/tabs.tsx) — add ARIA + arrow-key + URL-sync
- [src/components/ui/modal.tsx](../../src/components/ui/modal.tsx) — focus trap + a11y + sheet variant
- [src/components/ui/confirm-dialog.tsx](../../src/components/ui/confirm-dialog.tsx) — danger/warning/info variants
- [src/components/ui/textarea.tsx](../../src/components/ui/textarea.tsx) — shared adoption
- `src/components/ui/currency-input.tsx` — **new** (F-HIGH-08)
- `src/components/ui/close-icon-button.tsx` — **new** (F-HIGH-15)

### Layout
- [src/components/layout/sidebar.tsx](../../src/components/layout/sidebar.tsx) — use `useVisibleMenu`
- [src/components/layout/mobile-nav.tsx](../../src/components/layout/mobile-nav.tsx) — use `useVisibleMenu`
- [src/components/layout/topbar.tsx](../../src/components/layout/topbar.tsx) — profile toast, notification inline on mobile, deep-link handler
- [src/app/(protected)/layout.tsx](../../src/app/(protected)/layout.tsx) — `min-h-screen`

### Config
- `src/config/sidebar-menu.ts` — **new** (F-HIGH-02)
- `src/lib/hooks/useVisibleMenu.ts` — **new** (F-HIGH-02)
- `src/lib/notifications/routing.ts` — **new** (SITEMAP §11.5)

### High-traffic routes
- [src/app/(protected)/dashboard/page.tsx](../../src/app/(protected)/dashboard/page.tsx) — 8 ranked cards
- [src/components/dashboard/stat-cards.tsx](../../src/components/dashboard/stat-cards.tsx) — clickable + tooltips
- [src/app/(protected)/cases/[id]/page.tsx](../../src/app/(protected)/cases/[id]/page.tsx) — 8 tabs URL-synced, banners, gate
- [src/app/(protected)/customers/[id]/page.tsx](../../src/app/(protected)/customers/[id]/page.tsx) — 4 tabs URL-synced
- [src/app/(protected)/customers/page.tsx](../../src/app/(protected)/customers/page.tsx) — CCCD rendering

### Domain logic
- [src/lib/firestore/payments.ts](../../src/lib/firestore/payments.ts) — transactional confirm (F-CRIT-08)
- [src/lib/firestore/cases.ts](../../src/lib/firestore/cases.ts) — bill recompute (F-HIGH-28)
- [src/lib/firestore/attachments.ts](../../src/lib/firestore/attachments.ts) — consent gate (F-HIGH-25/26)
- [src/lib/firestore/audit.ts](../../src/lib/firestore/audit.ts) — PII redaction (F-MED-17)
- [src/lib/notifications/trigger.ts](../../src/lib/notifications/trigger.ts) — complaint recipients (F-HIGH-21)
- [src/constants/case-status.ts](../../src/constants/case-status.ts) — transitions (F-CRIT-04, F-HIGH-19)
- [src/constants/permissions.ts](../../src/constants/permissions.ts) — RBAC (F-CRIT-05/06, F-MED-14/18)

### Types (additions only)
- [src/lib/types/case.ts](../../src/lib/types/case.ts) — `approvedByDoctorId`, `medicalApprovedAt`, `medical_alert_resolved`
- [src/lib/types/consent.ts](../../src/lib/types/consent.ts) — `documentStoragePath`
- [src/lib/types/notification.ts](../../src/lib/types/notification.ts) — `targetTab`, `targetType`

---

## Existing Utilities to Reuse

The refactor **extends existing primitives** rather than building new ones. The following are reused:

| Utility | Path | Purpose |
|---------|------|---------|
| `cn()` | [src/lib/utils/cn.ts](../../src/lib/utils/cn.ts) | Tailwind class merge |
| `formatCompact`, `formatVNDCompact`, `getMonthKey`, `getMonthLabel`, `formatPercent` | [src/lib/utils/format.ts](../../src/lib/utils/format.ts) | Currency/date formatting (extend for `tooltipFormatVND`) |
| `tooltipFormatVND`, `tooltipFormatCount` | [src/components/reports/chart-theme.ts](../../src/components/reports/chart-theme.ts) | Recharts tooltip helpers — adopt for stat cards |
| `CASE_STATUS_HEX`, `PAYMENT_METHOD_HEX`, `CUSTOMER_SOURCE_HEX`, `PRIVACY_LEVEL_HEX` | [src/constants/case-status.ts](../../src/constants/case-status.ts), [src/constants/payment-methods.ts](../../src/constants/payment-methods.ts), [src/constants/customer-meta.ts](../../src/constants/customer-meta.ts) | Status colors — reuse in dashboards |
| `PIPELINE_STAGES`, `getPipelineStage()` | [src/constants/case-status.ts](../../src/constants/case-status.ts) | Pipeline funnel — extend for dashboard queue |
| `useCurrentUser()` | [src/lib/hooks/useCurrentUser.ts](../../src/lib/hooks/useCurrentUser.ts) | Auth state — used by `useVisibleMenu` |
| `hasPermission()` | [src/lib/auth/rb.ts](../../src/lib/auth/rb.ts) | RBAC check — used by `useVisibleMenu` |
| `writeAuditLog()` | [src/lib/firestore/audit.ts](../../src/lib/firestore/audit.ts) | Audit logging — used by every status transition |
| `getPipelineStage()` | [src/constants/case-status.ts](../../src/constants/case-status.ts) | Next-action derivation — used by next-owner banner |
| `<StatCardsSkeleton>`, `<ChartSkeleton>` | [src/components/reports/loading-skeleton.tsx](../../src/components/reports/loading-skeleton.tsx) | Loading skeletons — reuse on dashboard |

---

## Verification

### End-to-end verification (manual smoke + automated)

1. **Build + lint baseline:**
   ```bash
   npx tsc --noEmit
   npm run lint
   npm run build
   ```
   Expected: 0 errors, 0 warnings, 34 routes built.

2. **Unit tests:**
   ```bash
   npm run test
   ```
   Expected: all green; high-risk item tests in §10.2 pass.

3. **Playwright e2e:**
   ```bash
   npx playwright test
   ```
   Expected: 21 routes × 12 role-mocks pass; visual regression = 0; mobile matrix green.

4. **Accessibility:**
   ```bash
   npx playwright test --grep @a11y
   ```
   Expected: axe-core 0 critical; manual keyboard sweep passes.

5. **Manual device smoke (real devices):**
   - iPhone 12 + Safari → dashboard, case detail, customer form, payment create — no horizontal scroll, no URL-bar overlap
   - iPad Mini → case detail tabs collapse to icon-only, sidebar collapses
   - Pixel 7 → notification bell expands inline
   - Desktop Chrome → sidebar visible, sticky topbar works

6. **Sign-off chain:**
   - CEO demo: revenue tooltip (F-HIGH-29), pipeline rename (F-HIGH-32), accountant SoD (F-CRIT-06)
   - Medical director demo: clinical checklist (F-CRIT-03), gate behavior (F-CRIT-10), hospital tab (F-MED-15)
   - Accountant demo: cannot confirm own payment (F-CRIT-06), display name resolution (F-HIGH-17)
   - Data-privacy demo: audit log PII redaction (F-MED-17), consent gates (F-HIGH-25/26)

7. **Rollback drill:**
   - Tag `release/v6.0.0-rc1`
   - Revert one Phase B sprint in sandbox
   - Verify regression suite + manual smoke
   - Document outcome

8. **Production deploy:**
   - Tag `release/v6.0.0` after all gates green
   - Vercel production deploy with all feature flags ON (except those marked staged rollout)
   - Monitor Vercel Analytics + Firebase console for 24h
   - Phase 8+ backlog grooming session with product-owner

---

*End of UI Refactor Plan.*