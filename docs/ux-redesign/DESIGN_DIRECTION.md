# Swan Case CRM — Design Direction

- **Date:** 2026-06-29
- **Phase:** 6 (Safety & Integrity) + 7 (Consistency & Polish)
- **Sources:** [`UX_AUDIT_REPORT.md`](../../UX_AUDIT_REPORT.md), [`UX_DECISION_DOCUMENT.md`](UX_DECISION_DOCUMENT.md), [`CLAUDE.md`](../../CLAUDE.md), `.claude/context/SWAN_CONTEXT.md`
- **Owners:** `ux-designer`, `ui-designer`, `medical-workflow-expert`, `product-owner`
- **Scope:** 49 approved changes (22 Must + 27 Should). 11 items explicitly rejected, 19 deferred to Phase 8/9+.

This document is the bridge between *what* is changing (audit + decision doc) and *how* it should look, feel, and behave. It is opinionated, anchored to approved finding IDs, and refuses to reopen settled questions. **It introduces no new features.**

---

## 1. Design Philosophy

> **Purpose:** State what we believe, in priority order, so every later decision has a tiebreaker.

We design in this order of priority. If two principles conflict, the higher one wins. This is non-negotiable.

| # | Principle | Source |
|---|-----------|--------|
| 1 | **Patient safety outranks everything.** A pretty filter chip does not protect a patient from a mis-attributed surgery. | P1, P8 |
| 2 | **Revenue numbers must be unambiguous.** Every figure is either explicitly "đã xác nhận" or explicitly "chưa xác nhận". Never both. | P2 |
| 3 | **One source of truth, no fallback defaults.** No `caseId='general'`. No raw user IDs. No skipped doctor review. Defaults that hide missing data are bugs, not features. | P3 |
| 4 | **Every status change writes an audit trail.** Sensitive transitions are server-enforced, role-gated, and produce a structured log. | P4, P5 |
| 5 | **Mobile-first operation, desktop confirmation.** Staff work in operating rooms and on the floor on phones. Phones must work alone. | P6 |
| 6 | **One click for the next action.** Every screen answers "What does the user need to do next?" in a single click. | P7 |
| 7 | **Consent is binary, not progressive.** `marketing_usage` is `granted` or it does not exist. | P9 |
| 8 | **Refuse scope creep.** If a feature does not answer one of the 10 core case questions, it does not ship in Phase 6/7. | P10 |

**Tied to approved changes:** Foundation for every section below. Particularly load-bearing for §4 (Information Hierarchy), §9 (Case Module), §10 (Payment Module), and §18 (Anti-patterns).

---

## 2. UX Principles

> **Purpose:** Operational rules that govern interaction design.

| # | Principle | Why |
|---|-----------|-----|
| **U1** | **One-click next action.** Every screen surfaces the next action as a primary button. The next owner is computed and shown, not buried. | F-CRIT-09 |
| **U2** | **No silent defaults.** Missing required data must be visible, not hidden behind a fallback. Forms reject; lists do not invent. | P3, F-MED-02 |
| **U3** | **Server-enforced authorization.** UI hiding is not authorization. RBAC rules ship in `route.ts`, not just in components. | P5, F-CRIT-05, F-CRIT-06 |
| **U4** | **Search-first on lists above 20 items.** All list pages expose a debounced search input by default. | F-HIGH-30 (pattern), F-MED-24 |
| **U5** | **No dead links.** Every button either works, shows a `Đang phát triển` toast, or is removed. | F-HIGH-01 |
| **U6** | **Confirmation before irreversibility.** Delete, status transition to terminal, payment confirm, and consent revoke all require a typed confirm. Native `confirm()` is banned. | F-MED-01 |
| **U7** | **Errors are actionable.** A failed mutation must say what to do next, not just "Có lỗi xảy ra". | (UX baseline) |
| **U8** | **Empty states are invitations.** A blank list shows a CTA, not just whitespace. | F-HIGH-06 (pattern) |

**Tied to approved changes:** F-CRIT-05, F-CRIT-06, F-CRIT-09, F-HIGH-01, F-MED-01, F-MED-02, F-MED-24.

---

## 3. Visual Principles

> **Purpose:** Carry the existing premium theme forward with explicit Phase 6/7 constraints.

The premium theme — gradient (`bg-gradient-swan`, `bg-gradient-champagne`, `bg-gradient-page`), glass morphism, soft shadows (`shadow-soft / medium / elevated / glow-swan`), subtle animation (`animate-fade-in / slide-up / scale-in`) — **is not changing**. Phase 6/7 adds rules *on top of* the theme.

| # | Principle | Why |
|---|-----------|-----|
| **V1** | **Status color is the only signal that should change silently.** Animation is for entry/exit, not for attention. | P1, F-CRIT-10 |
| **V2** | **No decorative color.** Every colored element must communicate a state, an action, or a brand touch. | F-HIGH-29, F-HIGH-32 |
| **V3** | **Density-first on mobile.** Mobile screens fit more in less space than desktop. Whitespace is for grouping, not for filling. | P6, F-CRIT-01 |
| **V4** | **One icon set, one stroke width.** Lucide only. Stroke width 1.5 for inline, 2 for buttons. | (UI baseline) |
| **V5** | **Number formatting is consistent.** Currency uses VND with thousands separator. Dates use `dd/MM/yyyy`. Time uses 24h. | (UI baseline) |
| **V6** | **No invented gradients for new statuses.** Reuse the 5 status tones in §15. | §15 |
| **V7** | **Animation respects `prefers-reduced-motion`.** All `animate-*` classes degrade to instant on systems that opt out. | §17 |

**Tied to approved changes:** F-CRIT-01, F-HIGH-29, F-HIGH-32, F-HIGH-33. Reused theme tokens: `shadow-*`, `animate-*`, `bg-gradient-*`, `.glass`, `.premium-card`.

---

## 4. Information Hierarchy

> **Purpose:** Define what wins the user's attention when multiple things compete on one screen.

The 10 core case questions give us the natural ordering. We rank them by **frequency × consequence of being wrong**.

| Rank | Signal | Always above the fold? | Why |
|-----:|--------|:---------------------:|-----|
| 1 | **Patient safety status** (lab overdue, medical alert, D1 followup missed) | ✅ | P1, F-CRIT-07, F-HIGH-20 |
| 2 | **Next owner / blocked transition** | ✅ | F-CRIT-09 |
| 3 | **Outstanding balance** (billed − confirmed payments) | ✅ | F-HIGH-28, F-HIGH-29 |
| 4 | **Identity** (customer name, phone, case code) | ✅ | Core Q1 |
| 5 | **Service + location + date** | ✅ | Core Q2, Q6, Q7, Q8 |
| 6 | **Post-op status** (D1/D3/D7/D14/D30/D90 trail) | ✅ on case detail only | F-HIGH-30 |
| 7 | **Audit / consent status** | only when relevant | F-HIGH-25, F-HIGH-26 |
| 8 | **Visual polish** (animations, gradients, hero images) | never above a safety signal | P1 |

**Rule of thumb:** If a clinician would cancel a meeting for this signal, it is rank 1–3. If a sales lead would, it is rank 4–5. If only a designer would, it is rank 8.

**Tied to approved changes:** F-CRIT-07, F-CRIT-09, F-HIGH-20, F-HIGH-28, F-HIGH-29, F-HIGH-30, F-MED-25 (deferred but direction noted).

---

## 5. Navigation Principles

> **Purpose:** Define how the user moves through the app.

| # | Principle | Why |
|---|-----------|-----|
| **N1** | **One shared menu config.** Sidebar and MobileNav consume the same `useVisibleMenu(role)` hook. No duplication. | F-HIGH-02 |
| **N2** | **The dashboard is the home, not the menu.** Returning users should land on their queue, not on a generic welcome. | §7 |
| **N3** | **Search beats menu for power users.** Topbar search is a global case/customer shortcut. | F-MED-24 (pattern) |
| **N4** | **Notifications deep-link, never 404.** A clicked notification opens the case detail tab it relates to. | F-HIGH-10 |
| **N5** | **No more than 2 levels deep from dashboard.** Dashboard → Module → Detail. If something needs 3 clicks, redesign the path. | (UX baseline) |
| **N6** | **Breadcrumbs on detail pages only.** List pages do not need them. | (UX baseline) |
| **N7** | **Active route is always visibly active.** In sidebar (accent border) and mobile bottom nav (filled icon). | (UI baseline) |

**Tied to approved changes:** F-HIGH-02, F-HIGH-10, F-MED-24 (pattern only — search is a Phase 7/8 build).

---

## 6. Mobile-first Strategy

> **Purpose:** Mobile is not "desktop that fits". Mobile is the primary surface for clinical and floor staff.

| # | Rule | Implementation |
|---|------|----------------|
| **M1** | **No `h-screen` on the AppShell.** Use `min-h-screen` so the iOS Safari URL bar does not trap focus. | F-CRIT-01 |
| **M2** | **Touch targets ≥ 44×44 px.** Every button, link, checkbox, and chip is finger-friendly. | (UX baseline) |
| **M3** | **Case-detail tabs collapse to icon-only on `< sm`.** Text labels appear on `sm:` and up. | F-MED-13 |
| **M4** | **Filter chips collapse to `<Select>` on `< md`.** Status filter and similar multi-chip rows. | F-MED-06 |
| **M5** | **No horizontal scroll at 360 px.** This is the smallest viewport we design for. | (UX baseline) |
| **M6** | **Sticky action bar on detail pages.** Primary action (transition, confirm, save) is always reachable without scrolling on mobile. | (UX baseline) |
| **M7** | **Modals become full-screen sheets on `< sm`.** Multi-step modals (e.g. customer create) live in a sheet, not a centered card. | F-CRIT-01 (related) |
| **M8** | **Forms are single-column on mobile.** Two-column layouts collapse to single column under `md`. | (UX baseline) |
| **M9** | **Search is always visible on list pages on mobile.** No hidden "search" button behind an icon. | F-MED-24 (pattern) |
| **M10** | **Notification bell expands inline on mobile** instead of opening a popover that the finger might miss. | F-HIGH-03 |

**Tied to approved changes:** F-CRIT-01, F-MED-06, F-MED-13, F-HIGH-03.

---

## 7. Dashboard Redesign Direction

> **Purpose:** The dashboard is a **queue of action surfaces**, not a stat wall. Every card has a click path that filters a list.

### 7.1 What the dashboard must show (in this exact order)

| Position | Card | Click target | Source |
|---------:|------|--------------|--------|
| 1 | **Lab quá hạn** (red, count) | Filtered case list: status `hospital_confirmed` AND `expectedLabDate < today` | F-CRIT-07 |
| 2 | **Cần xác nhận thanh toán** (amber) | Filtered payment list: status `pending` | (Q4) |
| 3 | **Cảnh báo y khoa** (red) | Filtered case list: status `medical_alert` | F-CRIT-09, P1 |
| 4 | **Followup D1 hôm nay** (amber) | Followup dashboard: due today, status pending | F-HIGH-30 |
| 5 | **Doanh thu tháng này (đã xác nhận)** (aqua) | Reports → Revenue tab, this month | F-HIGH-29 |
| 6 | **Ca đang xử lý** (info) | Case list: not in terminal status | (Q9) |
| 7 | **Khách mới tháng này** (neutral) | Customer list: created this month | (Q1) |
| 8 | **Sức khỏe hậu phẫu (D1)** (ring-stat, green/red) | Followup dashboard, last 30 days | F-HIGH-30 |

### 7.2 Rules

- **Ranks 1–4 are action queues.** They are always visible on mobile without scrolling.
- **Ranks 5–8 are context.** They are stat-only and link out for detail.
- **Tooltips are mandatory on every aggregate card.** "Đã xác nhận" vs "chưa xác nhận" must be unambiguous.
- **The "next owner" computation** on case detail also appears as a banner on the dashboard for the current user, filtered by role.
- **No decorative stats.** Every card has a click target or it is removed.

### 7.3 What the dashboard does **not** do

- No role-specific widget set (deferred to Phase 9 per `F-MED-26`).
- No "operational risk" page (deferred to Phase 9 per `F-HIGH-31`).
- No chart hero. Charts live in `/reports`, not on the dashboard.
- No infinite-scroll feed. The queue is finite and rank-ordered.

**Tied to approved changes:** F-CRIT-07, F-CRIT-09, F-HIGH-29, F-HIGH-30. Deferred (do not build): F-MED-26, F-HIGH-31.

---

## 8. Customer Module Direction

> **Purpose:** Customer is the entity that every other module references. Capture must be complete; display must answer "who is this?" in one glance.

### 8.1 Customer list (`/customers`)

| Element | Rule |
|---------|------|
| Columns | Họ tên · SĐT · Nguồn · Số ca · Còn nợ · Nhân viên tạo · Thao tác |
| Search | Phone + name debounced; "Tìm theo SĐT hoặc tên" |
| Empty state | "Chưa có khách hàng" + button "Tạo khách hàng đầu tiên" |
| Outstanding balance badge | Phase 8+ (F-MED-25). Direction: green if 0, amber if partial, red if overdue 30d+ |
| Row density | Compact on mobile, comfortable on desktop |

### 8.2 Customer form (create + edit)

- Modal stays (F-MED-03 deferred). 22 fields are acceptable because **desktop power users are the primary form**.
- **Mobile users** get a full-screen sheet (M7) with single-column layout and section-by-section progression.
- Sections, in order:
  1. **Thông tin cơ bản** — Họ tên, SĐT, Ngày sinh, Giới tính
  2. **Nguồn & phân loại** — Nguồn khách, Mức bảo mật, Ghi chú chung
  3. **Giấy tờ tùy thân (CCCD)** — Số CCCD, Ngày cấp, Nơi cấp ← **F-CRIT-02, must ship Phase 6**
  4. **Địa chỉ & y tế** — Địa chỉ, Ghi chú y tế, Ghi chú riêng tư
- Sensitive fields (CCCD, y tế, riêng tư) follow RBAC visibility (`SENSITIVE_FIELD_ACCESS_ROLES`, `MEDICAL_NOTE_ACCESS_ROLES`).
- Phone uniqueness is checked on blur, not on submit.

### 8.3 Customer detail (`/customers/[id]`)

- Tabs: **Thông tin · Lịch sử ca · Timeline · Tài liệu**
- Delete flow: KD gửi "Yêu cầu xóa" → CS/CEO/Trưởng KD phê duyệt (`DELETE_APPROVE_ROLES`).
- **Timeline tab** is currently placeholder ("đang phát triển") — kept visible for navigation consistency, marked `F-MED-08` deferred.

**Tied to approved changes:** F-CRIT-02, F-HIGH-17 (display name pattern), F-MED-03, F-MED-08, F-MED-16 (cascade audit), F-MED-25, F-MED-17 (PII redaction in audit). Media Library: removed entirely (F-HIGH-35).

---

## 9. Case Module Direction

> **Purpose:** The case is the heart of the CRM. Every clinical and financial decision flows through it. Safety gates are the spine; UI is the connective tissue.

### 9.1 Case detail tabs (in this order)

1. **Thông tin** (Info) — Bill summary, next-owner banner, status workflow, checklist, staff assignment
2. **Ca phẫu thuật** (Procedure) — Procedure details, dates, location, pre-procedure checklist
3. **Thanh toán** (Payments) — Bill breakdown, payment list, refund history
4. **Checklist** — Pre-hospital + pre-procedure with progress bar (semantic colors, F-HIGH-16)
5. **Đồng thuận** (Consent) — 4 consent types, status workflow, signed-document requirement
6. **Bệnh viện** (Hospital) — coordinator/cso/admin only (F-MED-15, Phase 7)
7. **Hậu phẫu** (Post-op) — Followup D1–D90 trail
8. **Tài liệu** (Attachments) — drag-and-drop upload, visibility control, consent gate

> **On `< sm`:** Tabs collapse to icon-only with a `More` overflow menu for tabs 5–8 (F-MED-13).

### 9.2 The Info tab — required elements, in this exact order

1. **Next-owner banner** (red if blocked, amber if awaiting action, aqua if next step is yours) ← F-CRIT-09
2. **Medical alert banner** (red, persistent) if status = `medical_alert` ← P1
3. **Status badge + transition buttons** (`StatusWorkflow`) ← F-CRIT-04, F-CRIT-10
4. **Pre-procedure checklist** (collapsible, blocks transitions when `allPassed = false`) ← F-CRIT-10
5. **Bill summary** with recompute indicator when services change post-create ← F-HIGH-28
6. **Staff assignment** with role labels: `[Bác sĩ] Nguyễn Văn A` ← F-MED-21
7. **Case details** (service, location, expected dates, actual dates)

### 9.3 Clinical safety UX rules

| Rule | Source |
|------|--------|
| `procedure_completed` requires a second-confirm dialog showing side-effect count + checklist state | F-CRIT-03 |
| `medical_alert` cannot revert to `procedure_completed`; must go to `medical_alert_resolved` | F-HIGH-19 |
| `hospital_confirmed` cannot transition to `scheduled` (must go through doctor+lab) | F-CRIT-04 |
| Pre-procedure checklist must be `allPassed = true` to transition to `checked_in / in_procedure / medically_approved` | F-CRIT-10 |
| `medically_approved` requires doctor identity recorded (`approvedByDoctorId`, `medicalApprovedAt`) | F-HIGH-22 |
| `actualProcedureDate` is required on `procedure_completed` and is the source of truth for D1–D90 | F-HIGH-23 |
| `expectedLabDate ≤ expectedProcedureDate` enforced at submit | F-HIGH-24 |

### 9.4 Case list (`/cases`)

- Status filter: chips on `md+`, `<Select>` on `< md` (F-MED-06)
- Columns: Mã ca · Khách hàng · Dịch vụ · Trạng thái · Cập nhật · Nơi thực hiện · Thao tác
- "Nơi thực hiện" does not truncate (F-MED-22 deferred but direction noted)
- No payment-status badge in this iteration (F-MED-25 deferred)

**Tied to approved changes:** F-CRIT-03, F-CRIT-04, F-CRIT-09, F-CRIT-10, F-HIGH-04, F-HIGH-16, F-HIGH-19, F-HIGH-22, F-HIGH-23, F-HIGH-24, F-MED-06, F-MED-13, F-MED-15, F-MED-21, F-MED-19. Deferred (do not build): F-MED-08, F-MED-25, F-HIGH-14, F-HIGH-31.

---

## 10. Payment Module Direction

> **Purpose:** Payments are reversible and audited. Every transaction must answer "who entered, who confirmed, when, against what case, against what service?" without ambiguity.

### 10.1 Payment list (`/payments`)

| Element | Rule |
|---------|------|
| Columns | Mã phiếu · Ca · Khách hàng · Số tiền · Phương thức · Trạng thái · Người nhập · Người xác nhận · Ngày |
| "Người nhập" / "Người xác nhận" | Resolved to `displayName` via `getAllUsers()` map (F-HIGH-17) |
| Search | Phase 8+ (F-MED-24). Direction: phone, name, case code |
| Status badge | `pending` = amber, `confirmed` = green, `refunded` = red, `cancelled` = gray |
| Filters | Trạng thái (chips) · Phương thức · Từ ngày – Đến ngày · reset button |

### 10.2 Payment creation / confirmation

- **SoD enforced server-side.** Accountant cannot confirm their own payment (F-CRIT-06). Sales/accountant roles cannot create + confirm same payment.
- **Confirm dialog** shows: case, service, amount, method, created by, last updated. Requires a single-click confirm.
- **Refund** is a separate transaction; never an edit of the original payment. Refund line is rendered in red on revenue chart (F-HIGH-33).
- **Race condition guard** (F-CRIT-08): `confirmPayment` + `recalculateCasePayment` wrapped in a Firestore transaction with `amountPaid ≥ refundTotal` defensive check.

### 10.3 Bill summary (in case detail)

- Shows: `Tổng dịch vụ − Giảm giá = Tổng bill`, `Đã thanh toán (confirmed)`, `Còn lại`
- When services are added/removed after case create, bill recomputes and a small "Cập nhật `<date>` bởi `<action>`" indicator appears (F-HIGH-28)
- Never mutates historical `totalBillAfterDiscount` — adds a `*Latest` field for the recomputed value

### 10.4 Revenue / reports integration

- Dashboard "Doanh thu tháng này" stat shows **confirmed only** (F-HIGH-29) with a mandatory tooltip
- Pipeline chart metric renamed to "Bill / Doanh thu tiềm năng" (F-HIGH-32) — pipeline is forecast, not cash
- Revenue chart annotation "Đã xác nhận − Hoàn tiền" with refund line in red (F-HIGH-33)

**Tied to approved changes:** F-CRIT-06, F-CRIT-08, F-HIGH-17, F-HIGH-28, F-HIGH-29, F-HIGH-32, F-HIGH-33, F-MED-17 (PII redaction in audit), F-MED-24. Deferred: F-MED-24, F-HIGH-34 (CSV export).

---

## 11. Calendar Direction

> **Purpose:** Calendar is a coordination surface. The case is the truth; the calendar is the visible side of it.

### 11.1 Calendar grid

- Week view (default) and month view toggle
- Owner initials in the corner of each appointment card (F-LOW-04 deferred but direction noted)
- No "general" fallback events. Every appointment requires a `caseId` (F-MED-02)
- Tapping an event opens a side panel with case link, customer phone (call button), and assigned staff

### 11.2 Create appointment modal

- Case selection becomes a **search-and-select dropdown** matching case code, customer name, and phone (F-MED-11)
- Notes use the shared `<Textarea>` component (F-MED-02)
- Required fields: caseId, type, start, end, location
- Optional: assigned staff, pre-procedure checklist auto-check trigger

### 11.3 Calendar → Case detail

- Clicking an event opens the case detail **Procedure tab** in a new tab, with the appointment highlighted
- "Xem ca" button on the side panel navigates the same path

**Tied to approved changes:** F-MED-02, F-MED-11. Deferred: F-LOW-04 (owner initials).

---

## 12. Reports Direction

> **Purpose:** Every number is labeled. Pipeline is forecast, not cash. Refunds are visible. Filters refetch.

### 12.1 The "every number is labeled" rule

- Every aggregate on a chart or stat card has a tooltip stating: scope (confirmed/pending), currency unit (VND), time window, and source entity.
- "Doanh thu" alone is banned. Use "Doanh thu (đã xác nhận)" or "Bill (tiềm năng)".
- Refund is its own line, in red, never merged into "confirmed" (F-HIGH-33).

### 12.2 Tab-by-tab

| Tab | Primary change | Source |
|-----|----------------|--------|
| **Revenue** | Annotation on trend chart; refund line in red; tooltip on dashboard stat | F-HIGH-29, F-HIGH-33 |
| **Pipeline** | Rename "Bill / Doanh thu tiềm năng" to disambiguate from cash | F-HIGH-32 |
| **Customer** | New customers per month (existing); no change other than a11y polish | (Phase 7) |

### 12.3 Filter behavior

- Date range change **refetches** with a "Đang lọc…" pill (F-HIGH-18)
- "Tất cả" / "3 tháng" / "6 tháng" / "12 tháng" pills stay (custom range deferred per F-LOW-03)
- CSV export deferred (F-HIGH-34) — permission `reports:export` exists; UI ships when first analyst requests

### 12.4 What reports does **not** do

- No real-time push (reports are point-in-time, not live)
- No cohort analysis (Phase 9+)
- No cross-clinic rollup (single-clinic system)
- No scheduled email export (Phase 9+)

**Tied to approved changes:** F-HIGH-18, F-HIGH-32, F-HIGH-33. Deferred: F-HIGH-34, F-LOW-03.

---

## 13. Design System Direction

> **Purpose:** The design system is the premium theme plus a small number of tightly-scoped additions for Phase 6/7. We extend, we do not fork.

### 13.1 Token discipline

- **No new color tokens.** All status communication reuses the 5 tones in §15.
- **Brand colors are fixed.** Swan Aqua `#00ADBE`, Champagne Gold `#C9A96E`, Cream `#FFF9F0`. Do not introduce a fourth brand color.
- **Shadows are tiered.** `shadow-soft` (cards), `shadow-medium` (elevated cards), `shadow-elevated` (modals), `shadow-glow-swan` (primary CTAs, sparingly).
- **Typography stays Inter.** Vietnamese diacritics render correctly. Sizes follow a 4 px scale: 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36.

### 13.2 New tokens (additions, not inventions)

| Token | Use | Source |
|-------|-----|--------|
| `medical_alert_resolved` status | Replaces the current ambiguity of `medical_alert → completed` | F-HIGH-19 |
| `attachments:medical_upload` permission | Restricts medical image types to nurse/doctor | F-MED-18 |
| `caseRecord.approvedByDoctorId`, `caseRecord.medicalApprovedAt` | Doctor identity on `medically_approved` | F-HIGH-22 |
| `consent.documentStoragePath` | Required to transition consent to `granted` | F-HIGH-27 |

### 13.3 The system does not grow in Phase 6/7

- No new typography weights
- No new spacing tokens
- No new icon set
- No new component categories (the 20 existing UI primitives stay)

**Tied to approved changes:** F-HIGH-19, F-HIGH-22, F-HIGH-27, F-MED-18. Out of scope: any new brand color, any new component primitive.

---

## 14. Component Standardization Plan

> **Purpose:** Phase 6/7 touches 5 components. We standardize them in this order.

| # | Component | Changes | Phase | Source |
|---|-----------|---------|------:|--------|
| 1 | **`<Tabs>`** | Adopt across case detail (F-HIGH-04); add ARIA roles, arrow-key nav, Home/End (F-HIGH-11) | 7 | F-HIGH-04, F-HIGH-11 |
| 2 | **`<Modal>`** | Add focus trap, focus return, `aria-labelledby` (F-HIGH-12); close button uses `<CloseIconButton>` with `ariaLabel="Đóng"` (F-HIGH-15); becomes full-screen sheet on `< sm` (M7) | 6 + 7 | F-HIGH-12, F-HIGH-15 |
| 3 | **`<ConfirmDialog>`** | Ban native `confirm()` (F-MED-01); variants: `info` / `warning` / `danger` (request-delete = `info`, F-HIGH-13) | 6 + 7 | F-MED-01, F-HIGH-13 |
| 4 | **`<CurrencyInput>`** | VND formatting (thousand separator), wired into case form discount / amountPaid / service prices | 7 | F-HIGH-08 |
| 5 | **`<DataTable>`** | Generic, used everywhere; compact density on mobile, comfortable on desktop; sticky header on scroll | (existing, pattern lock) | (UI baseline) |
| 6 | **`<Textarea>`** | Shared, used in calendar create (F-MED-02) | 6 | F-MED-02 |
| 7 | **`<CloseIconButton>`** | New internal helper for Modal close, drawer close, sheet dismiss. `ariaLabel="Đóng"` | 6 | F-HIGH-15 |

### 14.1 Adoption rule

- A new page or modal **must** use these primitives. No hand-rolled tabs, modals, or textareas.
- The case detail page is the canary. If it ships without hand-rolled tabs, the rollout is healthy.

### 14.2 Variants per component

| Component | Variants |
|-----------|----------|
| `<Button>` | `primary` · `secondary` · `ghost` · `danger` · `gold` |
| `<Badge>` | `success` · `warning` · `danger` · `info` · `neutral` · `gold` |
| `<Card>` | `default` · `glass` · `elevated` · `compact` |
| `<Tabs>` | `pill` · `underline` |
| `<Modal>` | `default` · `sheet` (mobile) · `fullscreen` |
| `<ConfirmDialog>` | `info` · `warning` · `danger` |
| `<Input>` | `default` · `error` · `disabled` |
| `<DataTable>` | `comfortable` · `compact` |

**Tied to approved changes:** F-HIGH-04, F-HIGH-08, F-HIGH-11, F-HIGH-12, F-HIGH-15, F-MED-01, F-MED-02, F-MED-13.

---

## 15. Color & Status System

> **Purpose:** Color communicates state. We standardize what each tone means and where it is allowed to appear.

### 15.1 Brand colors (fixed)

| Token | Hex | Use |
|-------|-----|-----|
| `swan-500` | `#00ADBE` | Primary actions, links, brand accents |
| `gold-500` | `#C9A96E` | Gold-tier actions, premium highlights |
| `cream-50` | `#FFF9F0` | Page background base |

### 15.2 The 5 status tones

| Tone | Visual | Meaning | Example usage |
|------|--------|---------|---------------|
| **Success** | Green | State achieved, no risk | Payment `confirmed`, Followup `done`, Case `procedure_completed` |
| **Warning** | Amber | Action needed, no immediate risk | Payment `pending`, Followup `due today`, Bill overdue ≤7d |
| **Danger** | Red | Immediate action, clinical or financial | `medical_alert`, lab overdue, payment SoD break, audit PII leak |
| **Info** | Aqua | Neutral state, brand-aligned | Case `scheduled`, Case `in_procedure`, button focus ring |
| **Neutral** | Gray | Inactive, historical, terminal | Cancelled cases, soft body copy, table borders |

### 15.3 Status color usage rules

| Rule | Why |
|------|-----|
| **Status color appears on badges, banners, and dots only.** Never on a button label, never on a card border (use shadow). | V2 |
| **Critical status (lab overdue, medical alert) renders a banner, not just a badge.** Banner is sticky at the top of the relevant view. | P1 |
| **Color is never the only signal.** Pair every color cue with an icon or text label. | §17 |
| **Revenue "refund" is always red.** Not orange, not pink. | F-HIGH-33 |
| **Brand colors do not communicate state.** Gold is for premium tiers only. | V2 |

### 15.4 New status (Phase 6)

| Status | Tone | Notes |
|--------|------|-------|
| `medical_alert_resolved` | Success | Terminal. Replaces the audit-trail-breaking `medical_alert → completed` path. F-HIGH-19 |

**Tied to approved changes:** F-HIGH-19, F-HIGH-29, F-HIGH-32, F-HIGH-33, V2, P1.

---

## 16. Responsive Strategy

> **Purpose:** Define breakpoints, density rules, and the "no horizontal scroll" floor.

### 16.1 Breakpoints (Tailwind defaults)

| Token | Min width | Devices |
|-------|----------:|---------|
| `sm` | 640 px | Large phones (landscape) |
| `md` | 768 px | Tablets |
| `lg` | 1024 px | Small laptops |
| `xl` | 1280 px | Desktops |
| `2xl` | 1536 px | Large desktops |

**Design floor:** 360 px (iPhone SE). **No horizontal scroll at 360 px.**

### 16.2 Density rules

| Viewport | Row height | Card padding | Font scale |
|----------|-----------:|-------------:|-----------:|
| `< sm` (360 px) | 40 px | 12 px | base |
| `sm`–`md` | 44 px | 14 px | base |
| `md`+ | 48 px | 16 px | base |
| `lg`+ | 52 px | 20 px | base |

### 16.3 Element rules

| Element | Mobile (`< md`) | Desktop (`md+`) |
|---------|-----------------|-----------------|
| Tabs (case detail) | Icon-only + overflow menu (F-MED-13) | Text labels |
| Status filter | `<Select>` (F-MED-06) | Chips |
| Modal | Full-screen sheet (M7) | Centered card |
| DataTable | Stacked cards or compact rows | Full table |
| Action bar | Sticky bottom | Inline at top of form |
| Sidebar | Hidden (MobileNav) | Visible glass sidebar |
| Topbar profile | Avatar only, opens bottom sheet | Avatar + name + dropdown |

### 16.4 The "no horizontal scroll" floor

- 360 px must render: case detail tabs, customer form, case list, payment list, followup dashboard, calendar week view, report stat cards, dashboard queue.
- If a new component cannot render at 360 px, the component is wrong, not the breakpoint.

**Tied to approved changes:** F-CRIT-01, F-MED-06, F-MED-13, F-HIGH-03, F-MED-22.

---

## 17. Accessibility Guidelines

> **Purpose:** A11y is not a feature; it is the floor. Every Phase 6/7 component meets WCAG 2.1 AA.

### 17.1 Keyboard

| Rule | Source |
|------|--------|
| Every interactive element is reachable with `Tab` | (baseline) |
| Focus is visible (ring-4 aqua, never removed) | V1 |
| `<Modal>` traps focus inside and returns it to the trigger on close | F-HIGH-12 |
| `<Tabs>` supports `←` / `→` / `Home` / `End` | F-HIGH-11 |
| `<Modal>` close button is keyboard-accessible with `ariaLabel="Đóng"` | F-HIGH-15 |
| Skip-link to main content on every protected route | (baseline) |

### 17.2 Screen reader

- Every status badge has a text label, never color alone (F-HIGH-29 tooltip is also screen-reader-readable)
- Every icon-only button has `ariaLabel` in Vietnamese (e.g. `ariaLabel="Xem chi tiết ca"`)
- Audit log diffs use a screen-reader-friendly structure (`<dl>` with `dt`/`dd`)
- Notification bell announces new items via `aria-live="polite"`

### 17.3 Visual

- **Contrast ratio ≥ 4.5:1** for body text, ≥ 3:1 for large text and UI components (WCAG AA)
- The 5 status tones all meet AA against the cream background
- **No color-only signals.** Pair every color cue with an icon or text (e.g. `medical_alert` badge: red + warning icon + text "Cảnh báo y khoa")
- Focus rings stay visible; we never set `outline: none` without a replacement
- Text resizes to 200% without breaking layout

### 17.4 Motion

- All `animate-*` classes respect `prefers-reduced-motion: reduce` and degrade to instant
- No auto-playing video or audio
- No motion that conveys essential information (V1)

### 17.5 Forms

- Every input has a visible label, not just a placeholder
- Error messages are programmatically associated with their input (`aria-describedby`)
- Required fields are marked with `aria-required="true"` and a visible `*`
- Form submission errors are announced via `aria-live="assertive"`

**Tied to approved changes:** F-HIGH-11, F-HIGH-12, F-HIGH-15, V7, F-HIGH-29 (tooltip).

---

## 18. Anti-patterns to avoid

> **Purpose:** The audit caught these. We will not reintroduce them. Each anti-pattern is mapped to a finding ID so the rationale is traceable.

| # | Anti-pattern | Why we reject | Source |
|---|--------------|---------------|--------|
| **A1** | **Silent fallback defaults** — `caseId = 'general'`, `userId = 'unknown'`, `status = 'pending'` to avoid an error. | Defaults that hide missing data are bugs. Every required field must be explicit. | F-MED-02, P3 |
| **A2** | **Raw user / entity IDs in user-facing copy** — "Người nhập: user-001". | IDs are for machines. Show display names. | F-HIGH-17, F-CRIT-02 (CCCD) |
| **A3** | **Ambiguous aggregates** — "Doanh thu tháng này" without a tooltip. | Every number is labeled or it is removed. | F-HIGH-29, P2 |
| **A4** | **Conflated forecast and cash** — pipeline chart showing "doanh thu" when it shows "bill". | Pipeline is forecast, not cash. | F-HIGH-32, F-HIGH-33 |
| **A5** | **Decorative-only status indicators** — a progress bar that does not block, a badge that does not change color. | Status indicators are signals, not decoration. | F-CRIT-10, V1 |
| **A6** | **Hidden-only permissions** — Hiding a button instead of server-enforcing the role. | UI hiding is not authorization. | P5, F-CRIT-05, F-CRIT-06 |
| **A7** | **Hand-rolled tabs / modals** — every page rolls its own because the shared one is "not quite right". | Either the shared component is improved or we do not ship the page. | F-HIGH-04, F-HIGH-11, F-HIGH-12 |
| **A8** | **Dead links** — buttons that do nothing, with no toast or removal. | A dead button is worse than no button. | F-HIGH-01 |
| **A9** | **Native `confirm()` and `alert()`** — for delete, status transition, payment confirm. | Native dialogs are not styled, not accessible, not Vietnamese. | F-MED-01 |
| **A10** | **Raw numeric inputs for currency** — no VND format, no thousand separator. | Sales people paste wrong numbers. | F-HIGH-08 |
| **A11** | **PII in audit log diffs** — `medicalNote`, `privacyNote`, `nationalIdNumber` in before/after. | Privacy is binary. | F-MED-17, P9 |
| **A12** | **Skipped clinical gates** — `hospital_confirmed → scheduled` without doctor review or lab. | Direct patient-safety risk. | F-CRIT-04, F-CRIT-10, P1 |
| **A13** | **Permissive status transitions** — `medical_alert → procedure_completed` to clear the badge. | Audit trail conceals adverse events. | F-HIGH-19, P4 |
| **A14** | **Consent treated as progressive** — `image_storage: granted` does not imply `marketing_usage: granted`. | Consent is binary. | P9, F-HIGH-25, F-HIGH-26 |
| **A15** | **"Tasks" page kept on life-support** when actual usage is low. | Refuse life-support. Audit usage, then remove or invest. | F-LOW-05 |
| **A16** | **"Media Library" page resurrected** as a gallery. | Answers no core question. Attachments live on case detail. | F-HIGH-35 |
| **A17** | **Role-specific dashboard widgets** as a "personalization" feature. | Generic dashboard + audit-logs + notifications covers 80% at 20% effort. | F-MED-26 |
| **A18** | **Operational-risk page** built before stability. | Phase 9. The dashboard queue covers the gap. | F-HIGH-31 |
| **A19** | **CSV export** as a "table-stakes" report feature. | Permission exists. UI ships when first analyst requests. | F-HIGH-34 |
| **A20** | **Custom date range** in reports as a default. | Four pills cover observed usage. | F-LOW-03 |
| **A21** | **Logout confirmation** as a safety net. | `useBeforeUnload` covers browser-close. Data-loss risk is low. | F-MED-12 |
| **A22** | **Modal for a 22-field customer form** on mobile. | Sheet on mobile, modal on desktop. | F-MED-03, M7 |
| **A23** | **Customer deletion without per-record audit.** | Cascade must log. | F-MED-16, P4 |
| **A24** | **Same role creating and confirming payments** (full SoD break). | Direct fraud risk. | F-CRIT-06, P5 |
| **A25** | **Timeline tab** shipped as a placeholder. | If we cannot build it, hide it. | F-MED-08 |

### 18.1 How to use this list

- When designing a new screen, scan §18 first. If your pattern matches an A-numbered anti-pattern, stop and redesign.
- When reviewing a PR, §18 is the minimum bar. A PR that introduces any of A1–A25 is rejected.
- When re-opening a deferred finding, the corresponding A-number is the rationale. Override it only via the Decision Log in `UX_DECISION_DOCUMENT.md` §18.

---

## Appendix A — Finding-to-section cross-reference

Every approved finding with UX impact maps to one or more sections of this document. This is the audit trail.

| Finding | Section(s) |
|---------|-----------|
| F-CRIT-01 | §6 (M1, M7), §16 |
| F-CRIT-02 | §8 |
| F-CRIT-03 | §9 (Clinical safety UX) |
| F-CRIT-04 | §9, §18 (A12) |
| F-CRIT-05 | §9, §18 (A6) |
| F-CRIT-06 | §10, §18 (A6, A24) |
| F-CRIT-07 | §7 |
| F-CRIT-08 | §10 |
| F-CRIT-09 | §7, §9 |
| F-CRIT-10 | §9, §18 (A5, A12) |
| F-HIGH-01 | §2 (U5), §5 (N4), §18 (A8) |
| F-HIGH-02 | §5 (N1) |
| F-HIGH-03 | §6 (M10) |
| F-HIGH-04 | §9, §14, §18 (A7) |
| F-HIGH-08 | §10, §14, §18 (A10) |
| F-HIGH-10 | §5 (N4) |
| F-HIGH-11 | §14, §17 |
| F-HIGH-12 | §14, §17 |
| F-HIGH-13 | §14 |
| F-HIGH-15 | §14, §17 |
| F-HIGH-16 | §9 |
| F-HIGH-17 | §10, §18 (A2) |
| F-HIGH-18 | §12 |
| F-HIGH-19 | §9, §15, §18 (A13) |
| F-HIGH-20 | §7, §9 |
| F-HIGH-22 | §9, §13 |
| F-HIGH-23 | §9 |
| F-HIGH-24 | §9 |
| F-HIGH-25 | §9, §18 (A14) |
| F-HIGH-26 | §9, §18 (A14) |
| F-HIGH-27 | §13 |
| F-HIGH-28 | §9, §10 |
| F-HIGH-29 | §7, §10, §15, §18 (A3) |
| F-HIGH-30 | §7 |
| F-HIGH-32 | §10, §12, §15, §18 (A4) |
| F-HIGH-33 | §10, §12, §15, §18 (A4) |
| F-MED-01 | §14, §18 (A9) |
| F-MED-02 | §11, §14, §18 (A1) |
| F-MED-06 | §6, §16 |
| F-MED-08 | §18 (A25) |
| F-MED-13 | §6, §9, §16 |
| F-MED-15 | §9 |
| F-MED-16 | §18 (A23) |
| F-MED-17 | §10, §18 (A11) |
| F-MED-19 | §9 |
| F-MED-21 | §9 |
| F-MED-25 | §8 (deferred, direction noted) |

---

## Appendix B — Out-of-scope reminders

The following are explicitly **not** in this design direction. They were rejected in `UX_DECISION_DOCUMENT.md` §5 and §6. Mentioned here only to prevent silent reintroduction.

- **Media Library page** (`F-HIGH-35`) — removed. Attachments live on case detail only.
- **Role-specific dashboard widgets** (`F-MED-26`) — deferred to Phase 9.
- **Operational-risk page** (`F-HIGH-31`) — deferred to Phase 9.
- **CSV export** (`F-HIGH-34`) — permission exists, UI deferred.
- **Custom date range in reports** (`F-LOW-03`) — Phase 9+.
- **Clinic hours / service-price settings** (`F-LOW-02`) — Phase 9+, only when first requested.
- **Tasks page removal** (`F-LOW-05`) — conditional, pending 2-week usage audit.
- **Logout confirmation** (`F-MED-12`) — rejected.
- **Customer modal → dedicated routes** (`F-MED-03`) — modal stays; sheet on mobile.

---

## Appendix C — Acceptance criteria for "design direction is followed"

A new screen, modal, or component PR is **design-direction-compliant** when:

- [ ] No §18 anti-pattern is introduced (A1–A25 scan)
- [ ] No hand-rolled tab / modal / textarea (use §14 primitives)
- [ ] Status color follows §15 (success / warning / danger / info / neutral)
- [ ] Renders correctly at 360 px (no horizontal scroll)
- [ ] Every interactive element is keyboard-reachable with visible focus
- [ ] Every status indicator pairs color with an icon or text
- [ ] Every aggregate number has a tooltip or label
- [ ] Every status transition writes an audit log
- [ ] Every required field rejects silently-missing data
- [ ] No new color token, no new component primitive, no new permission
- [ ] Sensitive fields (CCCD, y tế, riêng tư) follow RBAC visibility
- [ ] The "next action" is one click away

If any checkbox is unchecked, the PR is not design-direction-compliant.

---

*End of Design Direction.*
