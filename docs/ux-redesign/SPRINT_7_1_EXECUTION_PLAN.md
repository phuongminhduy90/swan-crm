# Sprint 7.1 — Execution Plan: A11y Foundation + Tech Debt Cleanup

> **Sub-sprint of:** [Sprint 7 — Phase C: UI Library, Forms, Consent & Notifications](../ux-redesign/SPRINT_7_EXECUTION_PLAN.md)
> **Sprint window:** 5 dev-days (~80h capacity, 2–3 FEs)
> **Committed scope:** ~17h code/docs against 80h (~63h buffer for sign-off coordination + bug-fix reserve)
> **Theme:** Close remaining WCAG 2.1 AA gaps on shared primitives, land Conventional Commits + Toast API extension + anti-pattern pre-commit guard, expand mock seed for refund-chart coverage
> **Branch:** `main` (stacked commits, no long-lived branch)
> **Risk profile:** 🟢 — all stories are 🟢 or low-🟡; no new feature flags; no production-impacting changes
> **Backlog source:** [`IMPLEMENTATION_BACKLOG.md`](../ux-redesign/IMPLEMENTATION_BACKLOG.md) View 2 — Sprint 7.1 rows + Phase 6 carry-over (TD-1, TD-2, TD-4, TD-6)
> **Inputs synthesized from:**
> - [`SPRINT_7_EXECUTION_PLAN.md`](../ux-redesign/SPRINT_7_EXECUTION_PLAN.md) §4.1 (7.1 commitment)
> - [`SPRINT_6_3_COMPLETION_REPORT.md`](../ux-redesign/SPRINT_6_3_COMPLETION_REPORT.md) — Modal/CloseIconButton/Tabs/Toast baseline
> - [`SPRINT_6_4_COMPLETION_REPORT.md`](../ux-redesign/SPRINT_6_4_COMPLETION_REPORT.md) §10 (tech debt carry-over)
> - `tech-lead` skill — DoD enforcement, task breakdown
> - `ux-designer` skill — mobile-first tab redesign, cognitive load reduction
> - `qa-architect` skill — 10-layer pyramid, anti-pattern gate, axe-core verification
> - **Prior sprint context:** Sprint 6.4 §10 (RR-8, R-A1, TD-4, TD-6 carry-overs)

---

## 0. Executive Summary

Sprint 7.1 is the **foundation sprint** for Phase C. It combines 3 small a11y stories (C.1.1, C.1.2, C.1.3) that close the last WCAG 2.1 AA gaps on the shared Modal/Tabs primitives, with 4 tech-debt items (TD-1, TD-2, TD-4, TD-6) that lock in process hygiene before Sprint 7.4–7.5 ship higher-risk privacy/revenue changes.

**Key constraints driving scope:**
- Sprint 7.2 (CurrencyInput, URL-sync tabs) depends on **C.1.2 + C.1.3** landing — those unblock shared `<Tabs>` adoption on case detail.
- Sprint 7.5 (notification deep-links via `?tab=`) depends on **TD-2** (Toast action prop) — toasts surface C.5.2 routing errors.
- All Phase 7 quality gates (anti-pattern grep, conventional commits) lean on **TD-6** + **TD-1** landing in 7.1 — these are hygiene, not feature work.
- **No feature flag is added in 7.1.** All changes are additive copy/structure/process — flag promotion stays exclusive to Sprint 7.4 (consent gate) and 7.2 (URL tabs).

**What this sprint deliberately does NOT do:**
- Does not introduce `<CurrencyInput>` (Sprint 7.2 / C.2.1)
- Does not wire URL-synced tabs (Sprint 7.2 / C.2.2 — depends on C.1.2 + C.1.3)
- Does not promote any of the 6 existing feature flags (C-1, C-2, C-3 sign-off coordination is the gate, separate from code work)
- Does not touch Firebase security rules (Sprint 7.4 / C-4)
- Does not touch notification deep-links (Sprint 7.5 / C.5.2 — depends on TD-2)

---

## 1. Stories Included

Sprint 7.1 ships **7 items** (3 stories + 4 tech debt) against ~17h committed code/docs.

| # | Story ID | Title | Owner | Est | Risk | Flag | Backlog ID |
|:--|:---------|:------|:------|----:|:----:|:-----|:-----------|
| 1 | **C.1.1** | Modal close button label (per-context `CloseIconButton` override) | FE-1 | 2h | 🟢 | — | WCAG 2.4.6 |
| 2 | **C.1.2** | Case detail tabs: icon-only on mobile (`<Tabs>` `iconOnly` prop + useMediaQuery) | FE-2 | 4h | 🟡 | — | F-HIGH-08 |
| 3 | **C.1.3** | Tabs ARIA on every consumer (`role="tabpanel"` + `aria-labelledby` audit + fixes) | FE-2 | 3h | 🟡 | — | WCAG 1.3.1 / 4.1.2 |
| 4 | **TD-1** | Conventional Commits (`.husky/commit-msg` hook + `CONTRIBUTING.md`) | tech-lead | 1h | 🟢 | — | RR-8 |
| 5 | **TD-2** | Toast API extension (`duration`, `action`, `description` props) | FE-1 | 2h | 🟢 | — | R-A1 follow-up |
| 6 | **TD-4** | Mock seed expansion (2 more refund payments + case diversity) | FE-3 | 1h | 🟢 | — | TD-4 |
| 7 | **TD-6** | Anti-pattern pre-commit hook (`scripts/check-anti-patterns.sh`) | tech-lead | 1h | 🟢 | — | TD-6 |

**Committed subtotal:** 14h code + 3h docs = **17h** against 80h capacity (~21% utilization; ~63h reserve for C-1/C-2/C-3 sign-off coordination, bug-fix reserve, and visual baseline capture).

### 1.1 Story-level acceptance criteria

| Story | Acceptance criteria |
|:------|:--------------------|
| **C.1.1** | (1) Every `<Modal>` consumer passes a context-specific `ariaLabel` to `CloseIconButton` (e.g. "Đóng hộp thoại", "Đóng chỉnh sửa khách hàng"). (2) `<ConfirmDialog>` close button receives a clear Vietnamese label. (3) At least one screen reader announce test passes (axe-core + NVDA/VoiceOver smoke). (4) No regression on existing close button visual treatment. |
| **C.1.2** | (1) Case detail tabs render icon-only at viewport `< sm` (≤ 640 px). (2) Tab labels show as `<title>` tooltips on hover/focus when icon-only. (3) Tab icons are wired to existing labels (info, services, payments, staff, attachments, consents, timeline) — pick Lucide icons consistent with the rest of the case detail header. (4) At `≥ sm`, tabs render icon + label (current behavior). (5) `<Tabs>` primitive gains an `iconOnly?: 'auto' \| 'always' \| 'never'` prop with `'auto'` default. (6) `useMediaQuery` (already shipped in Sprint 6.3) reused, no new hook. (7) Mobile visual regression baseline (C-3, see §3.2) is captured BEFORE C.1.2 touches the tabs. |
| **C.1.3** | (1) Every consumer of `<Tabs>` has a `role="tabpanel"` element with matching `id` + `aria-labelledby` for the active tab. (2) Identified non-conforming consumers: case detail page, payments page (currently hand-rolled tabs, migrate to shared `<Tabs>`), customers detail page (uses shared `<Tabs>`, add panel wiring), notifications page (uses shared `<Tabs>`, add panel wiring), reports page (uses shared `<Tabs>`, add panel wiring). (3) axe-core scan on each consumer page reports 0 critical. (4) Keyboard navigation (ArrowLeft/Right/Home/End) verified by Vitest + RTL. (5) `idPrefix` is stable across re-renders. |
| **TD-1** | (1) `.husky/commit-msg` hook validates commit subject matches `^(feat|fix|refactor|chore|docs|test|perf|build|ci)(\([a-z0-9-]+\))?!?: .+`. (2) `CONTRIBUTING.md` documents the convention with examples. (3) Hook runs on every commit (not just push). (4) `package.json` gains `prepare` script that runs `husky install`. (5) Existing recent commits NOT rewritten (legacy `update` labels preserved per Sprint 6.4 carry-over note). (6) Hook can be bypassed with `--no-verify` for hotfixes (documented). |
| **TD-2** | (1) `useToast()` API gains `{ title?, description?, type?, duration?, action? }` signature. (2) `title` defaults to existing message; `description` renders below title in muted text. (3) `duration` in ms; defaults to `3500`; `0` = sticky (no auto-dismiss). (4) `action` is `{ label: string, onClick: () => void }` — renders as a button on the right of the toast. (5) Backward-compatible: `toast('Lưu thành công')` still works. (6) Old API signature still callable. (7) Toast provider counts `action` clicks in audit log when action label starts with `[audit]` (optional convenience). |
| **TD-4** | (1) Mock store gains 2 more `paymentType: 'refund'` payments in different months to make the refund chart non-degenerate. (2) Total refund payments: 1 → 3+ (target ≥ 3). (3) Add 1 case in `cancelled` status to diversify case-status distribution (currently no cancelled cases). (4) `seed-mvp` script re-run produces identical output (deterministic). (5) Visual smoke on Reports → Revenue tab shows refund segment in pie chart ≥ 1%. |
| **TD-6** | (1) `scripts/check-anti-patterns.sh` runs the cumulative A1/A2/A7/A8/A9/A10/A14/A22/A23/A26 grep set (see Sprint 7 plan §8.4). (2) Exits non-zero on any match outside `__tests__/`. (3) Wired via `.husky/pre-commit` so it runs before every commit. (4) Output names each violated anti-pattern by ID + file:line. (5) Documentation in `CONTRIBUTING.md` explains how to bypass with `--no-verify`. (6) Verification: `git commit` on a deliberately-broken file fails the hook. |

### 1.2 Out of scope (explicit deferrals)

| Item | Reason | Deferred to |
|:-----|:-------|:-------------|
| `<CurrencyInput>` component | Needs shared `<Tabs>` adoption first | Sprint 7.2 / C.2.1 |
| URL-synced tabs (`?tab=`) | Depends on C.1.2 + C.1.3 landing | Sprint 7.2 / C.2.2 |
| Reports date filter refetch | Independent of 7.1 | Sprint 7.2 / C.2.3 |
| Doctor identity fields on case | Form-level work | Sprint 7.3 / C.3.1 |
| Consent gate on image upload | Highest-risk in Phase C | Sprint 7.4 / C.4.1 |
| Notification bell inline on mobile | Depends on URL tabs + Toast API | Sprint 7.5 / C.5.1 |

---

## 2. Dependencies

### 2.1 Story-level dependency graph

```
TD-1 (Conventional Commits hook) ──► TD-6 (anti-pattern pre-commit hook)
   │                                    │
   │                                    └─► every subsequent commit in Sprint 7.1–7.5
   │
   └─► all future commits land in Conventional Commits format

C.1.1 (Modal close label) ── no dependency (ships independently)

C.1.2 (Tabs icon-only) ──► C.1.3 (Tabs ARIA on every consumer)
   │                            │
   │                            ├─► Sprint 7.2 / C.2.2 (URL-synced tabs adoption)
   │                            └─► Sprint 7.5 / C.5.2 (notification deep-links)
   │
   └─► Sprint 7.2 / C.2.2 (shared Tabs adoption on case detail)

TD-2 (Toast API) ──► Sprint 7.5 / C.5.2 (notification click + toast error)
                └─► Sprint 7.4 / C.4.2 (frontend consent visibility guard toast)

TD-4 (Mock seed expansion) ──► Sprint 7.2 / C.2.3 (reports filter refetch validates new seeds)

C-1 (B.2.1 medical director dry-run)  ──► parallel coordination track
C-2 (B.3.1 production sign-off)       ──► parallel coordination track
C-3 (mobile visual regression baseline) ──► MUST land BEFORE C.1.2 touches case detail tabs
```

### 2.2 Cross-sprint dependencies (incoming)

| Dependency | From | Impact if missed |
|:-----------|:-----|:-----------------|
| `<Tabs>` primitive (Sprint 6.3) | Sprint 6.3 B.4.6 | C.1.2 + C.1.3 have nothing to extend |
| `CloseIconButton` primitive (Sprint 6.1) | Sprint 6.1 A.3 | C.1.1 has nothing to wrap |
| `useMediaQuery` hook (Sprint 6.3) | Sprint 6.3 B.4.6 | C.1.2 must re-implement viewport detection |
| `useToast` provider (Sprint 6.4 R-A1) | Sprint 6.4 | TD-2 has nothing to extend |
| `seed-mvp` script | Sprint 5 | TD-4 has deterministic seed to extend |
| 6 feature flags currently in `.env.local` | Sprint 6.1–6.4 | None directly (7.1 adds no flag) |
| C-3 baseline PNG capture | Sprint 6.4 promise | C.1.2 must wait for baseline OR snapshot isolated tab bar in its own capture |

### 2.3 Cross-sprint dependencies (outgoing — what 7.1 unblocks)

| Downstream consumer | Story | Sprint | What 7.1 unblocks |
|:--------------------|:------|:-------|:------------------|
| Shared `<Tabs>` adoption on case detail | C.2.2 | 7.2 | C.1.2 adds `iconOnly`; C.1.3 wires ARIA — both required before URL-sync |
| Notification deep-link routing | C.5.2 | 7.5 | TD-2 Toast action prop powers "Xem case" CTA in notification toast |
| Frontend consent visibility guard | C.4.2 | 7.4 | TD-2 Toast action prop drives "Thu hồi quyền" CTA in guard modal |
| Reports filter refetch test data | C.2.3 | 7.2 | TD-4 adds the 2 refund payments that make the refund chart meaningful |
| Conventional Commits format | All | 7.2–7.5 | TD-1 enforces format from Sprint 7.1 close onward |
| Cumulative anti-pattern gate | All | 7.2–7.5 | TD-6 runs on every commit from Sprint 7.1 close onward |
| B.2.1 production flag promotion | C-1 | 7.1 | C-1 dry-run (parallel track) gates flag flip — independent of code |
| B.3.1 production flag promotion | C-2 | 7.1 | C-2 sign-off (parallel track) gates flag flip — independent of code |
| MINH_SCREEN production flag promotion | C-3 | 7.1 | C-3 baseline (parallel track) gates flag flip — independent of code |

---

## 3. Order of Implementation

### 3.1 Recommended sequencing (by dependency × risk × parallelism)

| Day | Owner | Track A: Process hygiene | Track B: Tabs/Modal a11y | Track C: Toast + Mock data |
|:----|:------|:-------------------------|:--------------------------|:----------------------------|
| **Day 1** | tech-lead | **TD-1** Conventional Commits hook + `CONTRIBUTING.md` (1h) | — | — |
| **Day 1** | tech-lead | **TD-6** Anti-pattern pre-commit hook (1h) — depends on TD-1 done | — | — |
| **Day 1** | qa-architect + ui-designer | — | **C-3** Playwright baseline capture (parallel coord, 4h) | — |
| **Day 1** | release-manager | — | **C-1** B.2.1 medical director dry-run scheduling (parallel coord) | — |
| **Day 1** | FE-1 | — | — | **TD-2** Toast API extension (2h) |
| **Day 2** | FE-2 | — | **C.1.3** Tabs ARIA on every consumer (3h) — start FIRST so shared `<Tabs>` consumers are ARIA-correct before C.1.2 lands | — |
| **Day 2** | FE-1 | — | **C.1.1** Modal close button label per-context override (2h) | — |
| **Day 2** | FE-3 | — | — | **TD-4** Mock seed expansion (1h) |
| **Day 3** | FE-2 | — | **C.1.2** Case detail tabs icon-only on mobile (4h) — REQUIRES C.1.3 done + C-3 baseline captured | — |
| **Day 3** | FE-1 | — | — | (buffer / C.1.1 fixes / cross-review) |
| **Day 4** | All | — | Cross-review (paired: FE-1 ↔ FE-2 on tabs/Modal changes) | — |
| **Day 4** | All | — | axe-core scan on each touched route | — |
| **Day 4** | qa-architect | — | Anti-pattern gate verification (TD-6 actual test) | — |
| **Day 5** | FE-1 / FE-2 | — | Bug fixes from review (≤ 4h reserve) | — |
| **Day 5** | tech-lead | — | Build/lint/test gates + completion report | — |

**Rationale for the parallel track split:**
- **Track A (process)** runs first because every subsequent commit depends on TD-1 + TD-6 being live.
- **Track B (a11y)** runs second because C.1.3 must precede C.1.2 (panels wired first, then mobile variant).
- **Track C (toast + seed)** is independent of B and can run on Day 1–2 in parallel.
- **C-1, C-2, C-3 coordination** runs in parallel and gates flag promotion (not code merge).

### 3.2 Critical sequencing rules

1. **C.1.2 MUST land AFTER C-3 baseline.** Sprint 6.4 promised a Playwright baseline capture that was deferred. C-3 must run before any tab visual change. If C-3 is blocked (Playwright install / emulator), C.1.2 must wait — or capture a tab-bar-isolated snapshot in its own commit so the diff is reviewable.
2. **C.1.3 MUST land BEFORE C.1.2.** The ARIA wiring on existing consumers must be correct before adding the `iconOnly` prop — otherwise the new prop ships against broken panels.
3. **TD-6 MUST land AFTER TD-1.** The pre-commit hook composes both `commit-msg` (conventional format) and `pre-commit` (anti-pattern grep). Wiring them out of order creates inconsistent commits.
4. **TD-2 should land BEFORE Day 4 cross-review.** C.1.1 + C.1.3 will need Toast error surfaces (panel-switch errors, modal close errors). TD-2 must be live so consumers can adopt `description` + `action` props in the same sprint.

### 3.3 What can run in parallel

| Pair | Why safe |
|:-----|:---------|
| TD-1 + TD-2 | Different files, no shared dependencies |
| TD-4 + C.1.1 | Mock store vs Modal — orthogonal |
| C.1.1 + C.1.3 | Different components — Modal vs Tabs |
| TD-6 + C.1.2 | Process vs UI — orthogonal |
| C-1 + C-2 + C-3 coordination | All calendar-bound, no code dependency |

### 3.4 What must serialize

| Sequence | Why |
|:---------|:----|
| TD-1 → TD-6 | Pre-commit hook reads commit-msg state |
| C.1.3 → C.1.2 | ARIA-correct panels must exist before adding icon variant |
| C-3 baseline → C.1.2 | Visual regression baseline must precede visual change |
| All code → axe-core verification + paired review | Release gate |

---

## 4. Files Affected

### 4.1 Source files — modified

| Path | Story | Change type | LOC Δ (approx) |
|:-----|:------|:-----------|---------------:|
| `src/components/ui/modal.tsx` | C.1.1 | mod — accept `closeLabel?: string` prop, pass to `CloseIconButton` | +6 |
| `src/components/ui/confirm-dialog.tsx` | C.1.1 | mod — accept `closeLabel?: string` prop | +6 |
| `src/components/ui/tabs.tsx` | C.1.2 | mod — add `iconOnly?: 'auto' \| 'always' \| 'never'` prop + render label conditionally | +35 |
| `src/components/ui/toast.tsx` | TD-2 | mod — extend Toast API to `{ title, description, type, duration, action }`; backward-compat path for `string` signature | +60 |
| `src/app/(protected)/cases/[id]/page.tsx` | C.1.2, C.1.3 | mod — replace hand-rolled tabs with `<Tabs iconOnly="auto">` + wire `role="tabpanel"` + `aria-labelledby` on each panel section | +25 / −18 |
| `src/app/(protected)/payments/page.tsx` | C.1.3 | mod — migrate hand-rolled tabs to `<Tabs>` + wire tabpanel | +12 / −18 |
| `src/app/(protected)/customers/[id]/page.tsx` | C.1.3 | mod — add `role="tabpanel"` + `aria-labelledby` to each panel section | +14 |
| `src/app/(protected)/notifications/page.tsx` | C.1.3 | mod — add `role="tabpanel"` + `aria-labelledby` + `panelIds` prop | +10 |
| `src/app/(protected)/reports/page.tsx` | C.1.3 | mod — add `role="tabpanel"` + `aria-labelledby` + `panelIds` prop | +12 |
| `src/lib/mock/store.ts` | TD-4 | mod — add 2 refund payments + 1 cancelled case | +18 |
| `package.json` | TD-1 | mod — add `prepare: "husky install"` script | +1 |
| `.env.local` (optional) | — | No change in 7.1 (no new flag) | 0 |

### 4.2 Source files — new

| Path | Story | Purpose | LOC (approx) |
|:-----|:------|:--------|-------------:|
| `.husky/commit-msg` | TD-1 | Conventional Commits subject validator (bash) | +20 |
| `.husky/pre-commit` | TD-6 | Invokes `scripts/check-anti-patterns.sh` | +5 |
| `scripts/check-anti-patterns.sh` | TD-6 | Cumulative anti-pattern grep (executable) | +80 |
| `CONTRIBUTING.md` | TD-1 | Commit convention + hook bypass docs | +90 |
| `src/components/ui/__tests__/tabs-icon-only.test.tsx` | C.1.2 | `iconOnly` prop rendering tests | +120 |
| `src/components/ui/__tests__/tabs-aria-consumers.test.tsx` | C.1.3 | ARIA wiring audit + per-consumer tests | +150 |
| `src/components/ui/__tests__/toast-api-extension.test.tsx` | TD-2 | New prop surface + backward-compat tests | +180 |
| `src/components/ui/__tests__/close-icon-button-label.test.tsx` | C.1.1 | Per-context label override tests | +80 |
| `docs/ux-redesign/STORY_C_1_1_IMPLEMENTATION_REPORT.md` | C.1.1 | Story report | +120 |
| `docs/ux-redesign/STORY_C_1_1_MIGRATION_NOTES.md` | C.1.1 | Migration notes | +60 |
| `docs/ux-redesign/STORY_C_1_2_IMPLEMENTATION_REPORT.md` | C.1.2 | Story report | +120 |
| `docs/ux-redesign/STORY_C_1_2_MIGRATION_NOTES.md` | C.1.2 | Migration notes | +60 |
| `docs/ux-redesign/STORY_C_1_3_IMPLEMENTATION_REPORT.md` | C.1.3 | Story report | +120 |
| `docs/ux-redesign/STORY_C_1_3_MIGRATION_NOTES.md` | C.1.3 | Migration notes | +60 |
| `docs/ux-redesign/STORY_TD_1_IMPLEMENTATION_REPORT.md` | TD-1 | Story report | +90 |
| `docs/ux-redesign/STORY_TD_2_IMPLEMENTATION_REPORT.md` | TD-2 | Story report | +110 |
| `docs/ux-redesign/STORY_TD_4_IMPLEMENTATION_REPORT.md` | TD-4 | Story report | +70 |
| `docs/ux-redesign/STORY_TD_6_IMPLEMENTATION_REPORT.md` | TD-6 | Story report | +90 |
| `docs/ux-redesign/SPRINT_7_1_COMPLETION_REPORT.md` | hygiene | Sprint close-out | +200 |

### 4.3 Files that must NOT change in 7.1 (to limit blast radius)

- `src/components/ui/close-icon-button.tsx` — already correct; C.1.1 only changes its consumers' label strings
- `src/components/layout/app-shell.tsx` — already `min-h-screen` (B.4.1)
- `src/components/layout/topbar.tsx` — toast already wired (B.4.4)
- `src/lib/firebase/*.ts` — no Firebase changes in 7.1
- `src/lib/firestore/*.ts` — no data-layer changes in 7.1
- All `src/app/api/**` routes — no API changes in 7.1
- `firestore.rules` / `storage.rules` / `firebase.json` — deferred to Sprint 7.4 / C-4

### 4.4 Data model impact

**None.** Sprint 7.1 ships zero schema changes. The only data-side edit is mock-store seed expansion (TD-4), which is dev-mode only.

### 4.5 Permission impact

**None.** No new roles, no new permissions, no RBAC matrix changes. TD-2 Toast API is consumed by existing permission-gated code paths without expanding them.

### 4.6 Audit log impact

**None directly.** TD-2 introduces an optional `action` prop that may trigger audit log writes for CTA actions — but this is opt-in (consumer-driven) and does not change existing audit surfaces. The Toast API itself does not write audit entries; consumers may wrap action callbacks with `writeAuditLog()` if desired.

---

## 5. Test Strategy

### 5.1 Test pyramid for Sprint 7.1

Following the qa-architect 10-layer pyramid; Sprint 7.1 exercises layers 1, 2, 3, 4, 6, 9, 10 (no perf / security-layer this sprint).

| Layer | Scope | Sprint 7.1 coverage |
|:------|:------|:--------------------|
| **1. Functional** | Happy paths | C.1.1 label override works · C.1.2 icon-only renders at `< sm` · C.1.3 panel relationships correct · TD-2 new props work |
| **2. Validation** | Boundary + negative | TD-1 commit subject rejected if format wrong · TD-6 grep fails on A1/A2/A8/A9/A10 violation · TD-4 seed output deterministic |
| **3. Workflow** | Multi-step user journey | C.1.2 keyboard navigation (Arrow/Left/Right/Home/End) works in icon-only mode · C.1.3 tab + panel cycle works |
| **4. Permission** | Role abuse | None — no permission changes |
| **5. Security** | OWASP top 10 | None |
| **6. Integration** | Module interaction | C.1.1 Modal + CloseIconButton + ConfirmDialog label propagation · C.1.2 Tabs + useMediaQuery + case detail page · C.1.3 Tabs + 5 page consumers · TD-2 Toast provider + new prop consumers |
| **7. Performance** | Latency / bundle | Bundle delta check: shared JS must stay ≤ 87.4 kB + 5% (≤ 91.7 kB) |
| **8. Data integrity** | Firestore correctness | TD-4 seed expansion produces identical output on re-run |
| **9. Mobile/responsive** | 360 / 390 / 768 / 1280 | C.1.2 verified at 360 + 390 + 768 (icon-only) and 1280 (icon+label); cross-check with C-3 Playwright baseline |
| **10. Regression** | Cross-sprint | All Sprint 6.x tests still pass · all anti-pattern grep checks still clean |

### 5.2 Critical test scenarios (per story)

#### C.1.1 — Modal close button label

| Scenario | Expected | Layer |
|:---------|:---------|:------|
| `<Modal closeLabel="Đóng chỉnh sửa khách hàng">` renders CloseIconButton with `aria-label="Đóng chỉnh sửa khách hàng"` | Pass | Functional |
| `<ConfirmDialog closeLabel="Đóng xác nhận xóa">` renders CloseIconButton with that label | Pass | Functional |
| Default fallback when `closeLabel` omitted | Default to "Đóng" (current behavior) | Boundary |
| Screen-reader announce test (axe-core) on every `<Modal>` consumer | 0 critical | Integration |
| Backward-compat: existing `<Modal>` consumers without `closeLabel` prop still work | Pass | Regression |

#### C.1.2 — Case detail tabs icon-only on mobile

| Scenario | Expected | Layer |
|:---------|:---------|:------|
| At viewport 360 px, case detail tabs render with icon only (label hidden) | Pass | Mobile/responsive |
| At viewport 1280 px, case detail tabs render with icon + label (current behavior) | Pass | Mobile/responsive |
| `<Tabs iconOnly="always">` always renders icon-only | Pass | Functional |
| `<Tabs iconOnly="never">` always renders icon + label | Pass | Functional |
| Keyboard nav (ArrowLeft/Right) works in icon-only mode | Pass | Workflow |
| Tooltip on hover/focus shows label when icon-only | Pass | A11y |
| axe-core: 0 critical on `/cases/[id]` at 360 px viewport | Pass | A11y |
| Playwright visual regression: tab bar matches C-3 baseline at 1280 px (no change) | Pass | Regression |
| Playwright visual regression: tab bar matches icon-only expectation at 360 px | Pass | Mobile/responsive |

#### C.1.3 — Tabs ARIA on every consumer

| Scenario | Expected | Layer |
|:---------|:---------|:------|
| Case detail page: each panel has `role="tabpanel"` + `id={prefix}-panel-{tabId}` + `aria-labelledby={prefix}-tab-{tabId}` | Pass | A11y |
| Payments page (after migration): same wiring | Pass | A11y |
| Customers detail page: same wiring added to existing shared `<Tabs>` | Pass | A11y |
| Notifications page: same wiring added | Pass | A11y |
| Reports page: same wiring added | Pass | A11y |
| Tab + ArrowRight moves focus AND selection | Pass | Workflow |
| Tab + Shift+ArrowRight wraps to last | Pass | Workflow |
| axe-core: 0 critical on each consumer page | Pass | A11y |
| `idPrefix` stable across re-renders (no hydration mismatch) | Pass | Integration |
| `panelIds` opt-out works for tabs without panels | Pass | Boundary |

#### TD-1 — Conventional Commits

| Scenario | Expected | Layer |
|:---------|:---------|:------|
| Commit subject `feat(case-detail): add icon-only tabs` → hook accepts | Pass | Functional |
| Commit subject `update tabs` → hook rejects with helpful message | Pass | Validation |
| Commit subject with breaking change `feat(api)!: change response shape` → hook accepts | Pass | Boundary |
| `--no-verify` bypasses hook (hotfix path) | Pass | Workflow |
| Hook fires on `git commit` (not `git commit -m` alone) | Pass | Workflow |
| Hook does NOT fire on `git commit --amend` if user opts out | Pass | Boundary |

#### TD-2 — Toast API extension

| Scenario | Expected | Layer |
|:---------|:---------|:------|
| `toast('Lưu thành công')` still works (backward-compat) | Pass | Regression |
| `toast({ title: 'Lỗi', description: 'Vui lòng thử lại' })` renders two-line toast | Pass | Functional |
| `toast({ ..., duration: 0 })` renders sticky toast (no auto-dismiss) | Pass | Functional |
| `toast({ ..., duration: 1000 })` auto-dismisses at 1000 ms | Pass | Boundary |
| `toast({ ..., action: { label: 'Xem', onClick } })` renders CTA button | Pass | Functional |
| Action button click fires `onClick` callback | Pass | Integration |
| `useToast` hook still throws if used outside provider | Pass | Regression |

#### TD-4 — Mock seed expansion

| Scenario | Expected | Layer |
|:---------|:---------|:------|
| `seed-mvp` script produces identical output on re-run (deterministic) | Pass | Data integrity |
| Refund payments: 1 → 3+ after expansion | Pass | Functional |
| Reports → Revenue tab pie chart shows refund segment ≥ 1% | Pass | Integration |
| Cancelled case added without breaking existing case queries | Pass | Boundary |
| Mock store contains ≥ 24 cases (was 23 + 1 new) | Pass | Boundary |

#### TD-6 — Anti-pattern pre-commit hook

| Scenario | Expected | Layer |
|:---------|:---------|:------|
| `git commit` with `window.alert(` in `src/` → hook rejects with A9 violation message | Pass | Validation |
| `git commit` with `user-123` raw ID in `src/components/` → hook rejects with A2 message | Pass | Validation |
| `git commit` with `href="#"` → hook rejects with A8 message | Pass | Validation |
| `git commit` with `<Input type="number">` in `src/components/cases/` → hook rejects with A10 message | Pass | Validation |
| `git commit` with `caseId='general'` → hook rejects with A1 message | Pass | Validation |
| `git commit` with no anti-patterns → hook accepts | Pass | Functional |
| `--no-verify` bypasses hook | Pass | Workflow |
| Hook output names pattern ID + file:line for each violation | Pass | UX |
| `__tests__/` matches excluded from grep | Pass | Boundary |
| `CONTRIBUTING.md` documents bypass + rationale | Pass | Documentation |

### 5.3 Test data requirements

- 12 mock users (already seeded in Sprint 5) for permission test coverage
- 23 cases + 1 new cancelled case (TD-4) for state coverage
- 23 payments + 2 new refund payments (TD-4) for chart coverage
- Refund pie chart segment visual smoke (Reports → Revenue)
- Tabs consumers in 5 pages (cases, payments, customers, notifications, reports)

### 5.4 Test count target

Sprint 6.4 baseline: 683 tests across 35 files. Sprint 7.1 target: **+30 to +45 tests** (conservative — heavy on anti-pattern gate, lighter on broad unit tests since most changes are visual/A11y/process).

| Story | New tests target | File |
|:------|-----------------:|:----|
| C.1.1 | 5–8 | `close-icon-button-label.test.tsx` |
| C.1.2 | 8–12 | `tabs-icon-only.test.tsx` |
| C.1.3 | 10–15 | `tabs-aria-consumers.test.tsx` |
| TD-1 | 3–5 (bash tests + commit-msg integration) | `commit-msg.test.sh` |
| TD-2 | 8–12 | `toast-api-extension.test.tsx` |
| TD-4 | 2–3 (deterministic + chart smoke) | `seed-mvp-determinism.test.ts` |
| TD-6 | 4–6 (bash tests) | `check-anti-patterns.test.sh` |
| **Total** | **~40–60 new** | ~5 new files |

### 5.5 Verification command set (post-sprint)

```bash
# Build + quality gates
npx tsc --noEmit                                    # → 0 errors
npx tsc -p tsconfig.test.json --noEmit              # → 0 errors
npm run lint                                        # → 0 warnings
npm run build                                       # → 34 routes, 0 errors, ≤ 91.7 kB shared JS
npx vitest run                                      # → ≥ 720 tests passing

# A11y verification
npx playwright test tests/a11y/                    # → 0 critical on 5 Tab consumers + Modal consumers
                                                   # (or axe-core programmatic call inside vitest)

# Anti-pattern grep gate (cumulative, also enforced by TD-6 hook)
grep -rE "window\.(confirm|alert)" src/ | grep -v __tests__/   # → 0
grep -rE "user-\d{3}" src/components                            # → 0
grep -rE 'href=["\047]#["\047]' src/components/                # → 0
grep -rE "<Input.*type=['\"]number['\"]" src/components/cases/  # → 0

# New TD-6 hook smoke
bash scripts/check-anti-patterns.sh                             # → exit 0 on clean tree

# TD-1 hook smoke
echo "bad commit" | bash .husky/commit-msg                      # → rejects
echo "feat(scope): good commit" | bash .husky/commit-msg         # → accepts

# TD-4 deterministic seed
npm run seed:mvp:dry-run > /tmp/seed-1.txt
npm run seed:mvp:dry-run > /tmp/seed-2.txt
diff /tmp/seed-1.txt /tmp/seed-2.txt                             # → identical

# Documentation gate
ls docs/ux-redesign/STORY_C_1_{1,2,3}_IMPLEMENTATION_REPORT.md
ls docs/ux-redesign/STORY_TD_{1,2,4,6}_IMPLEMENTATION_REPORT.md
ls docs/ux-redesign/SPRINT_7_1_COMPLETION_REPORT.md
```

### 5.6 Risk-based test emphasis

| Risk | Test emphasis |
|:-----|:--------------|
| A11y regression breaks WCAG 2.1 AA | axe-core programmatic on every Tab + Modal consumer; keyboard nav RTL |
| Hook blocks legitimate commits (false positives) | TD-6 hook smoke against a deliberately-clean tree |
| TD-2 backward-compat break | `toast('msg')` legacy calls still pass; grep for new vs old call sites |
| C.1.2 visual regression at desktop (1280 px) | Playwright C-3 baseline diff MUST be zero |
| TD-4 seed breaks existing Reports chart | Visual smoke on Reports → Revenue tab + 23+23 case/payment counts |

---

## 6. Rollback Strategy

Sprint 7.1 is **lowest-risk** in the entire Phase C series. Every change is additive or process-level. Rollback strategy varies per story.

### 6.1 Per-story rollback

| Story | Rollback mechanism | Blast radius | RTO |
|:------|:-------------------|:-------------|:----|
| **C.1.1** | Revert commit(s); `closeLabel` is optional with default fallback to "Đóng". Existing consumers unaffected. | 0 (additive) | < 1 min |
| **C.1.2** | Revert commit(s); `iconOnly` defaults to `'never'` (= current behavior). Consumers using `<Tabs>` without `iconOnly` prop see no change. | 0 (additive) | < 1 min |
| **C.1.3** | Revert commit(s); `role="tabpanel"` removal has no functional impact — purely ARIA semantics. Screen readers lose tab relationship announcement but app remains usable. | Low (a11y degradation only) | < 5 min |
| **TD-1** | `git rm .husky/commit-msg` + revert `package.json` `prepare` script. Hook bypass `--no-verify` available even with hook installed. | Process-only | < 1 min |
| **TD-2** | Revert commit(s); Toast provider keeps old single-arg signature working. New `{ title, description, action, duration }` callers revert to legacy. | 0 (backward-compat) | < 5 min |
| **TD-4** | Revert commit(s); `seed-mvp` script regenerates prior state. No production data affected. | 0 (mock only) | < 1 min |
| **TD-6** | `git rm .husky/pre-commit` + `git rm scripts/check-anti-patterns.sh`. Manual grep gates still available in CI. | Process-only | < 1 min |

### 6.2 Sprint-level rollback

If a critical regression slips into Sprint 7.1:

1. **Identify offending commit** via `git bisect` against `vitest run` + axe-core suite
2. **Revert commit(s)** with `git revert <sha>` (preserves history)
3. **Re-run verification command set** (§5.5)
4. **Document in migration notes** why the revert happened; file as Sprint 7.1.1 follow-up

### 6.3 What CANNOT be rolled back

- `CONTRIBUTING.md` content — once committed, history persists. Revert if explicitly wrong, but not for casual rollback.
- Sprint 7.1 commits that bump shared JS bundle past the 91.7 kB cap — these should be caught pre-merge and not reach `main`.

### 6.4 Hotfix protocol (if 7.1 breaks Sprint 6.x)

- Open a `hotfix/7.1.x` branch from the last `main` commit BEFORE the breaking change.
- Cherry-pick only the offending commit's revert + minimal fix.
- Run full verification command set (§5.5) before merge.
- Tag as `hotfix/7.1.x` for traceability.

---

## 7. Definition of Done

### 7.1 Per-story DoD

For each of the 7 stories in Sprint 7.1, the following must be true:

- [ ] **Acceptance criteria met** — every checkbox in §1.1 is checked
- [ ] **Validation implemented** — TD-1 + TD-6 reject malformed input with helpful error
- [ ] **Loading, error, empty states** — N/A for hygiene/process stories; covered for C.1.x
- [ ] **RBAC enforced** — no permission expansion or contraction
- [ ] **Audit log** — N/A (no sensitive actions in 7.1)
- [ ] **Firestore real data** — N/A for 7.1 (TD-4 is mock-only)
- [ ] **Firebase errors handled** — N/A
- [ ] **Mobile responsive** — C.1.2 verified at 360 / 390 / 768 / 1280
- [ ] **Vietnamese copy** — every new user-facing string reviewed (C.1.1 labels, TD-2 description)
- [ ] **Premium theme preserved** — no new color tokens, no spacing drift
- [ ] **A11y** — axe-core 0 critical on every Modal + Tabs consumer; ARIA wiring verified
- [ ] **Unit + integration tests written** — §5.2 scenarios covered
- [ ] **`tsc --noEmit` → 0 errors**
- [ ] **`npm run lint` → 0 warnings**
- [ ] **`npm run build` → 34 routes, 0 errors, ≤ 91.7 kB shared JS**
- [ ] **Anti-pattern grep clean** — A1/A2/A7/A8/A9/A10/A22/A26 greps pass
- [ ] **Paired review approved** — for C.1.x (🟡); waived for TD-x (🟢)
- [ ] **Implementation report + migration notes written**

### 7.2 Sub-sprint DoD (Sprint 7.1 "Done" when)

- [ ] All 7 stories pass per-story DoD
- [ ] Build & quality gates green (see §7.3)
- [ ] Anti-pattern gate clean (A1/A2/A7/A8/A9/A10/A22/A26)
- [ ] Cross-sprint regression: all Phase 6.x tests still pass
- [ ] Feature flag inventory unchanged (still 6 flags, all default OFF in prod)
- [ ] Documentation complete (7 story reports + 7 migration notes + 1 sprint completion report)
- [ ] Sign-off chain populated (see §7.5)
- [ ] Bundle delta verified ≤ 5% from Sprint 6.4 baseline (≤ 91.7 kB)
- [ ] `tsc --noEmit`, `lint`, `build`, `vitest run` all green

### 7.3 Build & quality gates

| Gate | Command | Target |
|:-----|:--------|:-------|
| TypeScript | `npx tsc --noEmit` | 0 errors |
| TypeScript (tests) | `npx tsc -p tsconfig.test.json --noEmit` | 0 errors |
| ESLint | `npm run lint` | 0 warnings |
| Production build | `npm run build` | 34 routes, 0 errors, ≤ 91.7 kB shared JS (+5% from Sprint 6.4) |
| Unit + a11y tests | `npx vitest run` | ≥ 720 tests passing (target +37 from 683 baseline) |
| Axe-core | Programmatic on 5 Tab consumers + 8 Modal consumers | 0 critical |
| Bundle delta | First Load JS shared | ≤ 5% increase from Sprint 6.4 |
| Anti-pattern grep | See §5.5 | 0 violations |
| TD-6 hook smoke | `bash scripts/check-anti-patterns.sh` on clean tree | Exit 0 |
| TD-1 hook smoke | `echo "feat: ok" \| bash .husky/commit-msg` | Exit 0 |

### 7.4 Anti-pattern gate (cumulative — TD-6 enforces)

| # | Anti-pattern | Check | Sprint 7.1 status |
|:--|:-------------|:------|:------------------|
| A1 | Silent fallback defaults | Grep `caseId\s*=\s*['"]general['"]` | Closed (still C.5.6 in 7.5) |
| A2 | Raw IDs in UI | Grep `user-\d{3}` in `src/components` | Closed (6.3) |
| A7 | Hand-rolled tabs | Grep `useState<.*Tab.*>` in `src/app` | C.1.3 closes 4 of 5; case detail + payments migrate |
| A8 | Dead links | No `href="#"` with placeholder | Closed (6.3) |
| A9 | Native `confirm`/`alert` | Grep `window.(confirm\|alert)` | Closed (6.4); C.5.8 verification |
| A10 | Raw numeric currency inputs | Use `<CurrencyInput>` | C.2.1 (7.2) |
| A14 | Consent as progressive | Binary enforced | C.4.1 + C.4.2 (7.4) |
| A22 | Suspense fallback | Programmatic | Closed (6.4) |
| A23 | Deletion without per-record audit | Cascade audit | C.4.4 (7.4) |
| A26 | Visual baseline source drift | `git diff` from baseline | Playwright harness in 6.4 |

**Sprint 7.1 specific anti-pattern movement:**
- **A7 partial closure** — payments page (hand-rolled) → shared `<Tabs>` (C.1.3). Case detail migration to shared `<Tabs>` also closes A7 for that route. Remaining hand-rolled tab patterns after 7.1: none expected.

### 7.5 Sign-off chain (Sprint 7.1)

| Gate | Sign-off by | Scope | Required? |
|:-----|:------------|:------|:---------:|
| Build / lint / tests | tech-lead | All code quality | ✅ |
| Anti-pattern grep gate | qa-architect | A1/A2/A7/A8/A9/A10/A22/A26 | ✅ |
| Test pyramid density | qa-architect | ≥ 5 tests/KLOC | ✅ |
| WCAG 2.1 AA compliance | qa-architect (axe-core) | 0 critical on touched routes | ✅ |
| Vietnamese copy tone | ux-designer | All new user-facing strings (C.1.1, TD-2) | ✅ |
| Mobile visual regression | qa-architect + ui-designer | C-3 baseline diff (C.1.2 only) | ✅ |
| TD-1 + TD-6 hook behavior | tech-lead | Bash hook smoke + bypass docs | ✅ |
| Final go/no-go | tech-lead + product-owner | Sprint 7.1 close | ✅ |

**Coordination-only sign-offs (not code-blocking):**
- C-1 (medical director) → B.2.1 flag promotion gate (parallel track)
- C-2 (CEO + accountant-lead + PO) → B.3.1 flag promotion gate (parallel track)
- C-3 (qa-architect + ui-designer) → MINH_SCREEN flag promotion gate (parallel track)

### 7.6 Non-goals for Sprint 7.1 (explicit)

- No new feature flag (count stays at 6)
- No schema changes (data model frozen)
- No API route changes
- No Firebase security rules deployment (Sprint 7.4 / C-4)
- No Vercel deployment config (Sprint 7.5 / C-5)
- No notification bell work (Sprint 7.5 / C.5.1)
- No URL-synced tabs (Sprint 7.2 / C.2.2)
- No `<CurrencyInput>` (Sprint 7.2 / C.2.1)

---

## 8. Recommended Commit Sequence

Following the Sprint 6.3 + 6.4 commit pattern (one story → one feature commit + one test commit + docs commits). Sprint 7.1 commits land in this order on `main`:

```
1.  chore(husky): add .husky/commit-msg + prepare script (TD-1 infra)        ── Day 1
2.  chore(husky): add scripts/check-anti-patterns.sh + pre-commit hook (TD-6) ── Day 1
3.  docs(contributing): add CONTRIBUTING.md with commit convention + bypass   ── Day 1
4.  feat(toast): extend API with { title, description, action, duration }    ── Day 1
5.  test(toast): add API extension + backward-compat tests                     ── Day 1
6.  docs(story): STORY_TD_2 implementation report + migration notes            ── Day 1
7.  feat(close-icon-button): accept closeLabel prop for per-context override   ── Day 2 (parallel)
8.  feat(modal): accept closeLabel prop, pass to CloseIconButton (C.1.1)        ── Day 2
9.  test(close-icon-button): add per-context label tests (C.1.1)               ── Day 2
10. docs(story): STORY_C_1_1 implementation report + migration notes            ── Day 2
11. test(mock-seed): add 2 refund payments + 1 cancelled case (TD-4)            ── Day 2
12. docs(story): STORY_TD_4 implementation report + migration notes            ── Day 2
13. feat(tabs): add iconOnly prop to Tabs primitive (C.1.2 infra)              ── Day 2
14. refactor(case-detail): migrate hand-rolled tabs to <Tabs> + ARIA (C.1.3)    ── Day 2
15. refactor(payments): migrate hand-rolled tabs to <Tabs> + ARIA (C.1.3)       ── Day 2
16. refactor(customers-detail): wire role=tabpanel + aria-labelledby (C.1.3)   ── Day 2
17. refactor(notifications): wire role=tabpanel + aria-labelledby (C.1.3)      ── Day 2
18. refactor(reports): wire role=tabpanel + aria-labelledby (C.1.3)            ── Day 2
19. test(tabs): add iconOnly + ARIA consumer tests (C.1.2 + C.1.3)              ── Day 2–3
20. feat(case-detail): use iconOnly='auto' on tabs (C.1.2)                      ── Day 3 (post C-3 baseline)
21. docs(story): STORY_C_1_3 implementation report + migration notes            ── Day 3
22. docs(story): STORY_C_1_2 implementation report + migration notes            ── Day 3
23. docs(story): STORY_TD_1 + STORY_TD_6 implementation reports + migration    ── Day 3
24. test(playwright): capture tab-bar baseline for C.1.2 (if C-3 deferred)      ── Day 3
25. docs(sprint): SPRINT_7_1_COMPLETION_REPORT.md                               ── Day 5
```

### 8.1 Commit-type distribution (Conventional Commits enforced by TD-1)

| Type | Count | Stories |
|:-----|------:|:--------|
| `feat` | 4 | TD-2, C.1.1, C.1.2 (`iconOnly` prop), C.1.2 (case detail adoption) |
| `fix` | 0 | — |
| `refactor` | 5 | C.1.3 (case detail, payments, customers, notifications, reports migrations) |
| `chore` | 2 | TD-1 (husky), TD-6 (pre-commit) |
| `test` | 5 | TD-2, C.1.1, C.1.3, TD-4, C.1.2 |
| `docs` | 9 | 7 story reports + 7 migration notes + 1 sprint completion report |
| `style` | 0 | — |
| `perf` | 0 | — |
| `build` | 0 | — |
| `ci` | 0 | — |

**Total commits:** ~25 (matches Sprint 6.3's ~22 commits — slight increase due to 7 stories vs 6).

### 8.2 Commit grouping rules

- **One feature commit + one test commit per story** (except TD-4 + TD-6 which are single commits)
- **Docs commits batched** at end of day, not per-commit (keeps git log scannable)
- **No squash** — every commit independently revertable per Sprint 6.3 §8.2 rule
- **Scope tags** in parentheses match directory or feature area (`toast`, `tabs`, `modal`, `case-detail`, `payments`, etc.)

### 8.3 Pre-commit guardrails (TD-1 + TD-6 enforced)

After TD-1 + TD-6 land on Day 1, every subsequent commit:

1. Triggers `.husky/pre-commit` → `scripts/check-anti-patterns.sh`
2. Triggers `.husky/commit-msg` → validates Conventional Commits format

Any commit that fails either hook is rejected with a clear error message pointing to:
- Pattern ID + file:line (TD-6)
- Format example (TD-1)

---

## Appendix A — Sprint 7.1 at a Glance

| Dimension | Value |
|:----------|:------|
| Stories | 3 (a11y) + 4 (tech debt) = **7** |
| Committed hours | ~17h (14h code + 3h docs) |
| Capacity | ~80h |
| Buffer | ~63h (sign-off coord + bug-fix reserve + C-3 baseline) |
| New flags | **0** (cumulative still 6) |
| New files | ~19 (5 source + 5 tests + 8 docs + 1 script) |
| Modified files | ~12 |
| Schema changes | **0** |
| Permission changes | **0** |
| Audit log changes | **0** (TD-2 enables optional consumer-driven writes) |
| Bundle target | ≤ 91.7 kB shared JS (+5% from 87.4 kB baseline) |
| Test target | ≥ 720 tests passing (target +37 from 683 baseline) |
| Risk profile | 🟢 |
| Branch | `main` (stacked, no long-lived branch) |
| Pre-requisites | C-3 baseline (Playwright) before C.1.2 lands |

## Appendix B — File-by-File Change Inventory

### B.1 New files (19)

```
.husky/commit-msg                                  TD-1
.husky/pre-commit                                  TD-6
scripts/check-anti-patterns.sh                     TD-6
CONTRIBUTING.md                                    TD-1
src/components/ui/__tests__/close-icon-button-label.test.tsx    C.1.1
src/components/ui/__tests__/tabs-icon-only.test.tsx             C.1.2
src/components/ui/__tests__/tabs-aria-consumers.test.tsx        C.1.3
src/components/ui/__tests__/toast-api-extension.test.tsx        TD-2
src/lib/mock/__tests__/seed-mvp-determinism.test.ts             TD-4
scripts/__tests__/check-anti-patterns.test.sh                    TD-6
scripts/__tests__/commit-msg.test.sh                             TD-1
docs/ux-redesign/STORY_C_1_1_IMPLEMENTATION_REPORT.md           C.1.1
docs/ux-redesign/STORY_C_1_1_MIGRATION_NOTES.md                 C.1.1
docs/ux-redesign/STORY_C_1_2_IMPLEMENTATION_REPORT.md           C.1.2
docs/ux-redesign/STORY_C_1_2_MIGRATION_NOTES.md                 C.1.2
docs/ux-redesign/STORY_C_1_3_IMPLEMENTATION_REPORT.md           C.1.3
docs/ux-redesign/STORY_C_1_3_MIGRATION_NOTES.md                 C.1.3
docs/ux-redesign/STORY_TD_{1,2,4,6}_IMPLEMENTATION_REPORT.md    TD-1,2,4,6
docs/ux-redesign/STORY_TD_{1,2,4,6}_MIGRATION_NOTES.md          TD-1,2,4,6
docs/ux-redesign/SPRINT_7_1_COMPLETION_REPORT.md                hygiene
```

### B.2 Modified files (12)

```
src/components/ui/modal.tsx                       C.1.1
src/components/ui/confirm-dialog.tsx              C.1.1
src/components/ui/tabs.tsx                        C.1.2
src/components/ui/toast.tsx                       TD-2
src/app/(protected)/cases/[id]/page.tsx           C.1.2 + C.1.3
src/app/(protected)/payments/page.tsx             C.1.3
src/app/(protected)/customers/[id]/page.tsx       C.1.3
src/app/(protected)/notifications/page.tsx        C.1.3
src/app/(protected)/reports/page.tsx              C.1.3
src/lib/mock/store.ts                             TD-4
package.json                                      TD-1
README.md                                         TD-1 (link to CONTRIBUTING)
```

## Appendix C — Verification Command Set (copy-paste)

```bash
# Build & quality (run after each PR)
npx tsc --noEmit
npx tsc -p tsconfig.test.json --noEmit
npm run lint
npm run build
npx vitest run

# Anti-pattern gate (cumulative + TD-6 enforced)
bash scripts/check-anti-patterns.sh

# TD-1 hook smoke
echo "feat(scope): ok" | bash .husky/commit-msg      # → exit 0
echo "bad commit" | bash .husky/commit-msg           # → exit 1 + error

# TD-4 deterministic seed
npm run seed:mvp:dry-run > /tmp/seed-1.txt
npm run seed:mvp:dry-run > /tmp/seed-2.txt
diff /tmp/seed-1.txt /tmp/seed-2.txt                 # → no diff

# A11y verification (programmatic)
npx vitest run src/components/ui/__tests__/tabs-aria-consumers.test.tsx
npx vitest run src/components/ui/__tests__/tabs-icon-only.test.tsx
npx vitest run src/components/ui/__tests__/close-icon-button-label.test.tsx

# Visual regression (C.1.2 specific)
npx playwright test tests/visual-regression.spec.ts --grep "case-detail"

# Documentation gate
ls docs/ux-redesign/STORY_C_1_{1,2,3}_*.md           # → 6 files
ls docs/ux-redesign/STORY_TD_{1,2,4,6}_*.md          # → 8 files
ls docs/ux-redesign/SPRINT_7_1_*.md                  # → 2 files
```

## Appendix D — Carry-over Status After Sprint 7.1

| Carry-over item | From | Sprint 7.1 status | Final state |
|:----------------|:-----|:------------------|:------------|
| R-1 / O-5 (B.2.1 medical director dry-run) | 6.2–6.4 | **C-1 coordination runs parallel** | ⏳ Blocked on calendar slot |
| R-2 (B.2.1 misconfiguration) | 6.2–6.4 | Flag stays OFF until C-1 sign-off | ⏳ Blocked on C-1 |
| R-7 / O-6 (B.3.1 production sign-off) | 6.2–6.4 | **C-2 coordination runs parallel** | ⏳ Blocked on calendar slot |
| R-8 (RR-8 Conventional Commits) | 6.2–6.4 | ✅ **Closed by TD-1** | ✅ |
| R-12 / R-13 (B.2.1 race + stale flag) | 6.2–6.4 | Unchanged; deferred to 7.3 / TD-5 | ⏳ Sprint 7.3 |
| R-14 (`getAllUsers()` whole-collection read) | 6.2–6.4 | Unchanged; deferred to 7.5 / TD-7 | ⏳ Sprint 7.5 |
| TD-2 (Toast API extension) | 6.4 R-A1 | ✅ **Closed by TD-2** | ✅ |
| TD-4 (Mock seed expansion) | 6.4 TD-4 | ✅ **Closed by TD-4** | ✅ |
| TD-6 (Anti-pattern pre-commit hook) | 6.4 TD-6 | ✅ **Closed by TD-6** | ✅ |
| C-1 (B.2.1 medical director dry-run) | 6.2–6.4 | ⏳ Coord item — Sprint 7.1 Week 1 | ⏳ Calendar-bound |
| C-2 (B.3.1 production sign-off) | 6.2–6.4 | ⏳ Coord item — Sprint 7.1 Week 1 | ⏳ Calendar-bound |
| C-3 (mobile visual regression baseline) | 6.3–6.4 | ⏳ Coord item — Sprint 7.1 Week 1 (MUST precede C.1.2) | ⏳ Calendar-bound |

## Appendix E — Key Architectural Decisions for Sprint 7.1

| # | Decision | Rationale |
|:--|:---------|:----------|
| **D7.1-1** | TD-2 Toast API uses overloaded signature (`string` legacy + `{ title, description, action, duration }` new) | Backward-compatible with 20+ existing call sites — no big-bang migration |
| **D7.1-2** | `iconOnly` default is `'auto'` on shared `<Tabs>` | Default behavior matches Sprint 7.1 commitment (icon-only on mobile, icon+label on desktop); consumers can override |
| **D7.1-3** | Conventional Commits format is `feat|fix|refactor|chore|docs|test|perf|build|ci(scope)!?: subject` | Mirrors Angular convention; matches existing open-source tooling |
| **D7.1-4** | TD-6 hook greps the FULL anti-pattern set (A1/A2/A7/A8/A9/A10/A14/A22/A23/A26), not just A2/A8/A9 from Sprint 6.4 | Cumulative gate prevents regression on A-class patterns closed in later sprints |
| **D7.1-5** | TD-1 + TD-6 hooks ship together on Day 1 | Hooks are useless without enforcement; landing them atomically ensures every subsequent sprint-7.x commit is conformant |
| **D7.1-6** | C.1.3 migrates hand-rolled tabs in case detail + payments (closes A7) | Removes duplicate tab implementations; unifies ARIA wiring |
| **D7.1-7** | C-3 baseline capture (Playwright) is a hard prerequisite for C.1.2 | Visual regression detection prevents icon-only variant from regressing desktop layout |
| **D7.1-8** | C.1.1 uses optional `closeLabel` prop with default fallback | Zero blast radius on existing consumers; per-context labels are additive |
| **D7.1-9** | No new feature flag in 7.1 | All changes are additive copy/structure/process; flag promotion stays exclusive to 7.2 (URL tabs) and 7.4 (consent gate) |

---

*End of Sprint 7.1 Execution Plan.*