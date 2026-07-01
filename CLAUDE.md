# CRM SWAN — CLAUDE.md

Project context, conventions, and phase progress for AI agents working on this codebase.

---

## Project Overview

Hệ thống quản lý khách hàng và hồ sơ phẫu thuật thẩm mỹ cho Swan Clinic.

- **Stack:** Next.js 14 (App Router) + TypeScript, Tailwind, Firebase (Auth + Firestore + Storage), Firebase Admin SDK, React Hook Form + Zod, Lucide
- **Language:** Vietnamese (toàn bộ UI, comments, error messages)
- **Branding:** Swan Aqua `#00ADBE`, Champagne Gold `#C9A96E`, Cream `#FFF9F0`
- **Code paths:** Unix-style with forward slashes (Windows host, Git Bash shell)
- **Theme:** Premium Apple/Stripe-style — subtle gradients, glass morphism, smooth animations, shadow-soft/medium/elevated

---

## Phase Progress

| Phase | Status | Scope |
|-------|--------|-------|
| Phase 1 | ✅ Completed | Scaffold, Auth, RBAC, Layout, Dashboard skeleton, User CRUD |
| Phase 2 | ✅ Completed | Customers (dialog CRUD + delete approval), Cases, Services, Payments, Staff assignment |
| Phase 3 | ✅ Completed | Treatment locations, Calendar, Tasks, Checklist, Status workflow, Premium theme |
| Phase 4 | ✅ Completed | Attachments, Consent, Post-op follow-up, Notifications, Audit logs |
| Phase 5 | ✅ Completed | **Reports** (3 tabs: Revenue / Pipeline / Customer), **Seed data expansion** (payments 23, followups 26, audit logs 30) |
| **Phase 6** (Sprints 6.1–6.4) | ✅ Completed | **UX redesign** — premium primitives (Tooltip, CloseIconButton), server-side RBAC, payment SoD, clinical checklist gate, B.2.1 medical safety, revenue tooltip, refund chart, mobile visual regression harness |
| **Phase 7** (Sprint 7.1–7.5) | 🔜 Planned | **UI library refactor + Consent gate + Production hardening** — 25 stories, 8 feature flags, Firebase security rules deployment, Vercel deployment. See [`docs/ux-redesign/SPRINT_7_EXECUTION_PLAN.md`](docs/ux-redesign/SPRINT_7_EXECUTION_PLAN.md) |
| Phase 5 (remaining) | 🔜 Pending | Security rules (firebase.json + storage.rules + indexes), Vercel deployment (rolled into Sprint 7.4 / 7.5) |

---

## Verified Clean (latest)

- `npx tsc --noEmit` → 0 errors
- `npm run lint` → 0 warnings
- `npm run build` → 34 routes, 0 errors
- `npx vitest run` → **683 passed** (35 test files, post-Sprint 6.4)
- `npx playwright test --list` → **28 tests** (25 visual + 3 diagnostic, post-Sprint 6.4)
- Shared JS bundle → ~87.4 kB (no bloat across Sprints 6.1–6.4)
- Anti-pattern grep gate (A2 / A4 / A8 / A9 / A11 / A26) → 0 violations

---

## Phase 1 — Completed ✅

### Phase 1 Checklist

- [x] Next.js setup (App Router + TypeScript)
- [x] Tailwind với Swan branding (Aqua, Gold, Cream)
- [x] Firebase client + admin setup (`@/lib/firebase/client.ts`, `admin.ts`, `auth.ts`, `firestore.ts`, `storage.ts`)
- [x] Authentication — Firebase Auth + dev mode bypass (`@/lib/auth/AuthProvider.tsx`, `mock-users.ts`)
- [x] Role-based access control — 12 roles + permission matrix (`@/config/roles.ts`, `@/lib/auth/rb.ts`)
- [x] Layout — Sidebar, Topbar, MobileNav, AppShell (`@/components/layout/`)
- [x] Login page (Vietnamese, RHF + Zod)
- [x] Protected routes — AuthGuard qua AuthProvider + `(protected)/layout.tsx`
- [x] Dashboard skeleton — 4 stat cards + activity panel
- [x] User management — list/create/edit/toggle-active (`@/components/users/`)
- [x] API routes cho user CRUD (`GET/POST/PATCH /api/users`)
- [x] Mock data store với seed data (`@/lib/mock/store.ts`)

---

## Phase 2 — Completed ✅

### Phase 2 Features

- [x] Customers — CRUD với dialog (list page + detail page), search, pagination, createdBy tracking
- [x] Cases — list/create/status badge/bill summary
- [x] Services — CRUD (dialog-based, settings page)
- [x] Payments — list/form/confirm dialog
- [x] Staff assignment — types + CRUD

### Customer Flow (Phase 2)

- **List page** (`/customers`): DataTable với search, actions dropdown (sửa/yêu cầu xóa), cột nhân viên tạo
- **Detail page** (`/customers/[id]`): Glass header, tabs (Thông tin / Lịch sử ca / Timeline), edit dialog, delete approval flow
- **Create dialog**: Từ list page, mở Modal với CustomerForm
- **Edit dialog**: Chỉ người tạo (hoặc admin/CEO/CS/trưởng KD) mới có quyền sửa
- **Delete approval**: KD chỉ có thể gửi yêu cầu xóa → CS/CEO/Trưởng KD phê duyệt
- **Phone uniqueness**: Hệ thống kiểm tra trùng SĐT trước khi tạo/cập nhật

### Critical files (Phase 2)

- `src/app/(protected)/customers/page.tsx` — list page với create/edit dialogs
- `src/app/(protected)/customers/[id]/page.tsx` — detail page với delete approval
- `src/components/customers/customer-list.tsx` — list table + actions column
- `src/components/customers/customer-form.tsx` — shared form (create + edit)
- `src/lib/firestore/customers.ts` — CRUD + soft-delete + phone uniqueness
- `src/lib/types/customer.ts` — Customer type với deletion workflow fields

---

## Phase 3 — Completed ✅

### Phase 3 Features

- [x] Treatment Locations settings page — wired `LocationListTable` + `LocationForm` (`/settings/treatment-locations`)
- [x] Calendar page — week/month view, navigation, create appointment modal (`/calendar`)
- [x] ChecklistPanel — renders pre-hospital & pre-procedure checklists, progress bar
- [x] StatusWorkflow — current state badge + transition buttons (safe vs caution), confirm dialog
- [x] Integrated into Case Detail — checklist + status workflow in "Thông tin" tab
- [x] Task validator extracted (`src/lib/validators/task.ts`)
- [x] Mock seeds — tasks (7), appointments (7), hospital coordinations (3)
- [x] ConfirmDialog.description widened to `ReactNode`

---

## Phase 4 — Completed ✅

### Phase 4 Features

- [x] **Attachments** — drag-and-drop upload dialog, visibility levels (internal / case_team / customer), per-case list with delete, mock storage fallback (`src/components/attachments/`)
- [x] **Consents** — 4 types (treatment, image_storage, marketing_usage, hospital_sharing), status workflow pending → granted/denied/revoked, create modal (`src/components/consents/consent-panel.tsx`)
- [x] **Post-op Follow-up** — auto-create D1/D3/D7/D14/D30/D90 when case → `procedure_completed`, 3 sections (today / overdue / upcoming) + stat cards (`src/components/followups/`)
- [x] **Notifications** — 14 event types (new_case, payment_pending, procedure_completed, postop_followup_due, complaint, ...), in-app center with mark-as-read + read-all (`src/app/(protected)/notifications/`)
- [x] **Audit logs** — 18 AuditAction types, filter by entity/action/actor, expandable JSON diff (`src/app/(protected)/audit-logs/`)

### Critical files (Phase 4)

- `src/components/attachments/attachment-upload-dialog.tsx` — drag-and-drop upload + audit log
- `src/components/attachments/attachment-list.tsx` — per-case list + visibility control
- `src/components/consents/consent-panel.tsx` — consent CRUD + status transitions
- `src/app/(protected)/media-library/page.tsx` — attachments grid (type/visibility/search filters)
- `src/app/(protected)/followups/page.tsx` — follow-up dashboard (today/overdue/upcoming)
- `src/app/(protected)/notifications/page.tsx` — notification center (14 event types)
- `src/app/(protected)/audit-logs/page.tsx` — audit trail with diff view
- `src/lib/firestore/attachments.ts` — attachment CRUD + visibility
- `src/lib/firestore/consents.ts` — consent CRUD + status update
- `src/lib/firestore/followups.ts` — followup CRUD + auto-create (D1-D90)
- `src/lib/firestore/notifications.ts` — notification CRUD + mark read
- `src/lib/firestore/audit.ts` — writeAuditLog + query helpers
- `src/lib/types/attachment.ts` — Attachment, AttachmentType, AttachmentVisibility
- `src/lib/types/consent.ts` — Consent, ConsentType, ConsentStatus
- `src/lib/types/followup.ts` — Followup, FollowupStatus
- `src/lib/types/notification.ts` — Notification, NotificationEventType
- `src/lib/types/audit.ts` — AuditLog, AuditAction (18 types), AuditEntityType

### Phase 4 Seed Data

- 8 attachments (ID front/back, payment proof, before/after, postop D1/D3, medical doc)
- 10 consents (treatment, image_storage, marketing_usage, hospital_sharing — mixed statuses)
- 6 followups (D1/D3/D7/D14/D30/D90 for case #5)
- 10 notifications (all event types covered)
- 14 audit logs (customer_created/updated, case_created/status_changed, attachment, payment, consent, task, staff_assignment)

---

## Phase 5 — Reports + Seed Expansion (Completed ✅)

### Phase 5 Features

- [x] **Reports page** (`/reports`) — 3 tabs với charts (Recharts) + filter theo khoảng thời gian
- [x] **Revenue tab** — 4 stat cards (tổng / đã xác nhận / chờ / trung bình ca) + Line chart xu hướng tháng (confirmed + pending) + Pie chart phương thức thanh toán
- [x] **Pipeline tab** — Custom funnel 5 giai đoạn (Khởi tạo → Xác nhận → Xếp lịch → Thực hiện → Hậu phẫu) + Horizontal bar chart trạng thái + Vertical bar chart theo dịch vụ
- [x] **Customer tab** — Pie chart nguồn khách (7) + Pie chart mức bảo mật (3) + Bar chart khách mới theo tháng
- [x] **Date range filter** — 3 / 6 / 12 tháng / Tất cả (pill buttons)
- [x] **Loading skeletons** — StatCards + Chart skeletons match design system
- [x] **Shared utilities extracted** — `formatCompact`, `formatVNDCompact`, `getMonthKey`, `getMonthLabel`, `formatPercent` từ `stat-cards.tsx` → `src/lib/utils/format.ts`
- [x] **Constants cho charts** — `CASE_STATUS_HEX`, `PAYMENT_METHOD_HEX`, `CUSTOMER_SOURCE_HEX`, `PRIVACY_LEVEL_HEX`, `PIPELINE_STAGES`, `getPipelineStage()`
- [x] **Seed data expansion** — payments 6→23, followups 6→26, audit logs 14→30 (phân bổ 6 tháng)

### Critical files (Phase 5)

**Reports page & components**
- `src/app/(protected)/reports/page.tsx` — page chính với Tabs + ReportFilters + 3 wrappers
- `src/components/reports/revenue-report.tsx` — Revenue tab wrapper
- `src/components/reports/pipeline-report.tsx` — Pipeline tab wrapper
- `src/components/reports/customer-report.tsx` — Customer tab wrapper
- `src/components/reports/revenue-trend-chart.tsx` — Line chart doanh thu theo tháng
- `src/components/reports/payment-method-chart.tsx` — Pie chart phương thức thanh toán
- `src/components/reports/status-bar-chart.tsx` — Horizontal bar chart trạng thái case
- `src/components/reports/category-bar-chart.tsx` — Vertical bar chart theo dịch vụ
- `src/components/reports/pipeline-funnel.tsx` — Custom SVG funnel 5 giai đoạn
- `src/components/reports/source-pie-chart.tsx` — Pie chart nguồn khách
- `src/components/reports/privacy-pie-chart.tsx` — Pie chart privacy level
- `src/components/reports/new-customers-chart.tsx` — Bar chart khách mới theo tháng
- `src/components/reports/stat-summary.tsx` — 4 stat cards cho revenue tab
- `src/components/reports/chart-card.tsx` — Wrapper Card với title + icon
- `src/components/reports/chart-theme.ts` — Brand colors + Recharts style helpers (AXIS_STYLE, TOOLTIP_STYLE, GRID_STYLE, tooltipFormatVND/Count)
- `src/components/reports/loading-skeleton.tsx` — ChartSkeleton + StatCardsSkeleton
- `src/components/reports/report-filters.tsx` — Date range pill buttons

**New constants**
- `src/constants/payment-methods.ts` — PAYMENT_METHOD_LABELS, PAYMENT_METHOD_HEX
- `src/constants/customer-meta.ts` — CUSTOMER_SOURCE_LABELS, PRIVACY_LEVEL_LABELS, hex colors
- `src/constants/case-status.ts` — thêm CASE_STATUS_HEX, PIPELINE_STAGES, getPipelineStage()

**Modified files**
- `src/lib/utils/format.ts` — thêm formatCompact, formatVNDCompact, getMonthKey, getMonthLabel, formatPercent
- `src/components/dashboard/stat-cards.tsx` — dùng formatCompact từ shared utils
- `src/lib/mock/store.ts` — seed data mở rộng (payments, followups, audit logs)

### Phase 5 Seed Data (Expanded)

| Entity | Before | After | Note |
|--------|--------|-------|------|
| Payments | 6 | 23 | Phân bổ 6 tháng, 5 phương thức, có pending/refund |
| Followups | 6 | 26 | 4 cases có followup trail (case 5/6/11/17/19) |
| Audit logs | 14 | 30 | Spread Jan–Jun 2026, 6+ actor roles, 10+ action types |

### Chart Library

`recharts@3.9.0` đã có sẵn trong `package.json`. Phase 5 là lần đầu sử dụng. Khi build Recharts components, dùng helper `tooltipFormatVND` / `tooltipFormatCount` từ `chart-theme.ts` để tránh type error của Recharts v3.

### Phase 5 Pending (chưa làm)

- **Firebase security rules** — `firestore.rules` đã có (316 dòng, RBAC đầy đủ) nhưng **thiếu** `firebase.json`, `firestore.indexes.json`, `storage.rules` để deploy → **rolled into Sprint 7.4 (C-4)**
- **Vercel deployment** — chưa có `vercel.json`, security headers, deployment docs → **rolled into Sprint 7.5 (C-5)**

---

## Phase 6 — UX Redesign + Revenue Integrity (Sprints 6.1–6.4, Completed ✅)

### Phase 6 Sub-Sprint Summary

| Sprint | Theme | Status | Stories |
|:-------|:------|:-------|--------:|
| **6.1** | Foundation — shared menu, server RBAC, payment SoD, dashboard `lab_overdue_count` | ✅ | 5 |
| **6.2** | Clinical checklist gate + B.1.5 auto-escalate + audit PII redaction + `procedure_completed` 2nd confirm | ✅ | 4 |
| **6.3** | Premium polish — Tabs ARIA, Modal focus trap, CloseIconButton, AppShell flag, B.4.* fixes, MINH_SCREEN flag | ✅ | 6 |
| **6.4** | Revenue integrity — tooltip (B.3.2), refund chart (B.3.4), Suspense fallback (RR-4), alert→toast (R-A1), visual baseline (C-3) | ✅ | 5 |
| **Total** | — | — | **20** |

### Critical files added in Phase 6

- `src/components/ui/tooltip.tsx` — Radix-free Tooltip primitive (hover/focus/Escape/click-outside, 17 tests)
- `playwright.config.ts` + `tests/visual-helpers.ts` + `tests/visual-regression.spec.ts` — Layer 9 mobile visual regression (25 snapshots × 5 viewports)
- `docs/ux-redesign/visual-baselines/MANIFEST.md` — baseline PNG index (capture pending, harness ready)
- `src/lib/types/audit.ts` — added `dashboard_render_fallback` action + `dashboard` entity
- `src/components/reports/chart-theme.ts` — added `REFUND_SERIES` constant
- `src/components/dashboard/stat-cards.tsx` — `REVENUE_TOOLTIP_COPY` + `safeCountLabOverdueCases` fallback
- `docs/ux-redesign/SPRINT_6_{1,2,3,4}_*.md` — per-sprint execution + completion reports
- `docs/ux-redesign/STORY_*_IMPLEMENTATION_REPORT.md` + `STORY_*_MIGRATION_NOTES.md` — per-story docs (59 files)

### Phase 6 Test Coverage

| Layer | Before (Phase 5) | After (Sprint 6.4) | Δ |
|:------|----------------:|-------------------:|---:|
| Vitest | 0 | 683 (35 files) | +683 |
| Playwright visual | 0 | 28 tests | +28 |
| Anti-pattern grep gate | n/a | A1/A2/A7/A8/A9/A10/A14/A23/A26 | All clean |

### Feature Flags (Sprint 6.1+, all default OFF in production)

| Flag | Story | Promotion gate |
|:-----|:------|:---------------|
| `NEXT_PUBLIC_FEATURE_SHARED_MENU` | A.5 | Triple sign-off |
| `NEXT_PUBLIC_FEATURE_SERVER_RBAC` | B.1.3 | Triple sign-off |
| `NEXT_PUBLIC_FEATURE_PAYMENT_SOD` | B.3.1 | CEO + accountant-lead + PO |
| `NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST` | B.2.1 | Medical director + CEO + PO |
| `NEXT_PUBLIC_FEATURE_CHECKLIST_GATE` | B.2.1 | Medical director + CEO + PO |
| `NEXT_PUBLIC_FEATURE_MINH_SCREEN` | 6.3 | C-3 visual baseline (Sprint 7.1) |

Sprint 7 sẽ thêm 2 flags: `NEXT_PUBLIC_FEATURE_URL_TABS` (7.2) và `NEXT_PUBLIC_FEATURE_CONSENT_GATE` (7.4).

### Anti-Patterns Closed

- **A2** — Raw `user-XXX` IDs in UI (Sprint 6.3)
- **A8** — Dead `href="#"` (Sprint 6.3)
- **A9** — Native `window.confirm`/`alert` (Sprint 6.3 + 6.4 R-A1 — fully closed)
- **A22** — RR-4 Suspense fallback for `lab_overdue_count` (Sprint 6.4)

### Carry-over to Sprint 7 (Phase 7)

- **TD-1** — Conventional Commits (`.husky/commit-msg` + `CONTRIBUTING.md`)
- **TD-2** — Toast API extension (`{ title, description, action, duration }`)
- **TD-3** — Transactional payment confirm (F-CRIT-08) — deferred to Phase 8
- **TD-5** — B.2.1 Firestore transaction hardening (race condition)
- **TD-6** — Anti-pattern pre-commit hook
- **TD-7** — `getAllUsers()` per-recipient lookup optimization

### Phase 6 Documentation

All sprint + story docs in [`docs/ux-redesign/`](docs/ux-redesign/):
- `SPRINT_6_{1,2,3,4}_EXECUTION_PLAN.md` — pre-sprint plans
- `SPRINT_6_{1,2,3,4}_COMPLETION_REPORT.md` — post-sprint reports
- `STORY_*_IMPLEMENTATION_REPORT.md` + `STORY_*_MIGRATION_NOTES.md` — per-story (59 files)
- `SPRINT_7_EXECUTION_PLAN.md` — Phase 7 plan

---

## Premium Theme (Applied globally)

### Design System

- **Shadows:** `shadow-soft`, `shadow-medium`, `shadow-elevated`, `shadow-glow-swan`
- **Animations:** `animate-fade-in`, `animate-slide-up`, `animate-slide-down`, `animate-scale-in`, `animate-shrink`
- **Gradients:** `bg-gradient-swan`, `bg-gradient-champagne`, `bg-gradient-page`
- **Utilities:** `.glass` (glass morphism), `.premium-card`, `.premium-input`

### UI Primitives (upgraded)

- **Button:** Gradient primary + hover lift + softer focus rings
- **Card:** `rounded-2xl` + `shadow-soft` + optional `hover` prop
- **Badge:** Softer tints, gradient for info/gold variants
- **Input/Select:** `rounded-xl`, softer borders, `ring-4` focus
- **Textarea:** Shared component (extracted from customer-form)
- **Modal:** `backdrop-blur-md` + `animate-slide-up`
- **DataTable:** `rounded-2xl` + refined header/hover
- **Toast:** Success/error/info, slide-up animation, auto-dismiss with progress bar
- **DropdownMenu:** Popover-based, click-outside close
- **Tabs:** Pill + underline variants, animated indicator
- **ConfirmDialog:** `animate-scale-in` icon

### Layout (premium)

- **Sidebar:** `bg-white/80 backdrop-blur-xl` (glass), accent left border on active item
- **Topbar:** `sticky top-0 backdrop-blur-xl` (glass), polished dropdown menu
- **Body:** Gradient background (`cream → white → swan-50`)

---

## Bug Fixes (latest)

### Phase 1–5 Review Fixes (2026-06-29)

- **Dead code removed**: `handleStatusChange()` in `cases/[id]/page.tsx` was unused — `StatusWorkflow` `onTransition` already handled status changes. Removed.
- **POST_OP_STATUSES typo fixed**: `'post_op_followup'` không tồn tại trong CaseStatus union. Trigger followup creation chỉ khi `newStatus === 'procedure_completed'`, và dùng `actualProcedureDate` thay vì `new Date()`.
- **GRID_STYLE.vertical removed**: `vertical: false` trong `chart-theme.ts` bị spread vào `CartesianGrid`, ẩn grid lines dọc ở tất cả charts. Xóa prop này — mỗi chart tự quản lý.
- **PipelineFunnel layout fixed**: Thêm `max-w-[480px] w-full` vào row + `flex-1` vào bar wrapper để `width: N%` reference đúng bounded container.
- **Revenue total stat fixed**: `total = confirmed + pending` → `total = confirmed`. "Tổng doanh thu" chỉ nên tính thanh toán đã xác nhận.

- **Before:** StatCards showed hardcoded `"—"`, RecentActivity was always empty
- **After:** StatCards fetch real data (customers count, active cases, revenue this month, today's appointments). RecentActivity shows latest 10 activities with case status badges + customer links. Dashboard also has 4 quick stat boxes.

### Sales Online/Offline Permissions

- **Before:** `sales_online` and `sales_offline` couldn't view medical notes, privacy notes, or address
- **After:** Both roles added to `SENSITIVE_FIELD_ACCESS_ROLES` and `MEDICAL_NOTE_ACCESS_ROLES`

### Customer createdBy

- **Before:** No "Nhân viên tạo" column in customer list
- **After:** Shows creator name (resolved from user ID) in both list table and detail header

### Delete Approval Workflow

- **Before:** Anyone with `customers:write` could hard-delete customers directly
- **After:** Two-step flow:
  1. KD (online/offline) sends "Yêu cầu xóa" with reason
  2. CS/CEO/Trưởng KD (`DELETE_APPROVE_ROLES`) sees badge "Chờ xóa", can approve or reject
- Banner on detail page shows pending deletion with approve/reject buttons

### Phone Uniqueness

- **Before:** Duplicate phone allowed silently, causing data confusion
- **After:** `createCustomer` and `updateCustomer` check phone uniqueness via `checkPhoneExists()` and throw error if duplicate found

---

## Project Structure

```
src/
├── app/                                 # Next.js App Router
│   ├── (auth)/login/                    # Public login page
│   ├── (protected)/                     # Protected routes
│   │   ├── dashboard/                   # Real-time stats + activity
│   │   ├── customers/                   # List (dialog CRUD) / New / Detail (delete approval)
│   │   ├── cases/                       # List / New / Detail (checklist + status workflow)
│   │   ├── payments/                    # List / New
│   │   ├── calendar/                    # Week/month view + appointment modal
│   │   ├── tasks/                       # List + create form
│   │   ├── followups/                   # Post-op follow-up dashboard
│   │   ├── media-library/               # Attachments grid + upload
│   │   ├── reports/                     # Reports page — 3 tabs (Revenue/Pipeline/Customer) (Phase 5)
│   │   ├── settings/                    # users / roles / services / treatment-locations
│   │   ├── notifications/               # In-app notification center
│   │   └── audit-logs/                  # Audit trail with filters + diff view
│   ├── api/                              # REST API (users, customers, cases, payments, attachments, consents, notifications, followups, audit-logs)
│   ├── layout.tsx                       # Root layout (Inter font, Vietnamese)
│   ├── providers.tsx                    # AuthProvider + ToastProvider
│   └── page.tsx                         # Root redirect
│
├── components/
│   ├── ui/                              # Premium UI library (20 components)
│   │   ├── button.tsx                   # Gradient primary, hover lift
│   │   ├── card.tsx                     # rounded-2xl, shadow-soft, hover prop
│   │   ├── badge.tsx                    # Softer tints, gradient info/gold
│   │   ├── input.tsx                    # rounded-xl, ring-4 focus
│   │   ├── select.tsx                   # Custom chevron, matching input style
│   │   ├── textarea.tsx                 # Shared, matching input style
│   │   ├── modal.tsx                    # backdrop-blur, slide-up animation
│   │   ├── confirm-dialog.tsx           # scale-in icon, ReactNode description
│   │   ├── data-table.tsx              # Generic, rounded-2xl, skeleton loading
│   │   ├── search-input.tsx             # Debounced, clear button
│   │   ├── toast.tsx                    # Success/error/info, auto-dismiss, progress bar
│   │   ├── tabs.tsx                     # Pill + underline variants
│   │   ├── dropdown-menu.tsx            # Popover, click-outside, ESC
│   │   ├── skeleton.tsx
│   │   ├── avatar.tsx                   # Gradient bg, initials fallback
│   │   └── swan-logo.tsx               # Custom SVG swan
│   ├── layout/                          # Sidebar (glass), Topbar (glass), MobileNav, AppShell
│   ├── auth/                            # LoginForm
│   ├── dashboard/                       # StatCards (real data), RecentActivity (real data)
│   ├── users/                           # UsersTable, CreateUserDialog, EditUserDialog
│   ├── customers/                       # CustomerList (actions column), CustomerForm (shared Textarea)
│   ├── cases/                           # CaseList, CaseForm, StatusBadge, BillSummary, StatusWorkflow
│   ├── checklist/                       # ChecklistPanel
│   ├── payments/                        # PaymentList, PaymentForm, ConfirmDialog
│   ├── locations/                       # LocationListTable, LocationForm
│   ├── services/                        # ServiceListTable, ServiceForm
│   ├── tasks/                           # TaskList, TaskForm
│   ├── followups/                       # FollowupList, FollowupForm
│   ├── attachments/                     # AttachmentUploadDialog, AttachmentList
│   ├── consents/                        # ConsentPanel (create + status transitions)
│   └── reports/                         # Reports page components (Phase 5)
│       ├── revenue-report.tsx           # Revenue tab wrapper
│       ├── pipeline-report.tsx          # Pipeline tab wrapper
│       ├── customer-report.tsx          # Customer tab wrapper
│       ├── revenue-trend-chart.tsx      # Line chart
│       ├── payment-method-chart.tsx     # Pie chart
│       ├── status-bar-chart.tsx         # Horizontal bar chart
│       ├── category-bar-chart.tsx       # Vertical bar chart
│       ├── pipeline-funnel.tsx          # Custom SVG funnel
│       ├── source-pie-chart.tsx         # Pie chart
│       ├── privacy-pie-chart.tsx        # Pie chart
│       ├── new-customers-chart.tsx      # Bar chart
│       ├── stat-summary.tsx             # 4 stat cards
│       ├── chart-card.tsx               # Reusable Card wrapper
│       ├── chart-theme.ts               # Recharts style helpers
│       ├── loading-skeleton.tsx         # ChartSkeleton, StatCardsSkeleton
│       └── report-filters.tsx           # Date range filter pills
│
├── lib/
│   ├── firebase/                        # client.ts, admin.ts, auth.ts, firestore.ts, storage.ts
│   ├── auth/                            # AuthProvider, mock-users, rb
│   ├── firestore/                       # 15 domain modules (users, customers, cases, payments, attachments, consents, notifications, followups, audit, ...)
│   ├── types/                           # 15 type modules (User, Customer, Case, Payment, Task, Appointment, Attachment, Consent, Followup, Notification, Audit, ...)
│   ├── hooks/                           # useCurrentUser
│   ├── validators/                      # case, customer, payment, task, treatment-location, staff-assignment, attachment, consent
│   ├── notifications/                   # in-app, telegram, templates
│   ├── checklist/                       # evaluatePreHospitalChecklist, evaluatePreProcedureChecklist
│   ├── tasks/                           # auto-tasks (triggerAutoTasks)
│   ├── mock/store.ts                    # In-memory mock data + 16 seed functions
│   └── utils/                           # cn, format (formatCompact, formatVNDCompact, getMonthKey, formatPercent), validation
│
├── config/
│   ├── firebase.ts                      # Config, isDevMode, hasFirebaseConfig
│   ├── roles.ts                         # ROLE_LABELS, ROLE_COLORS, ROLE_PERMISSIONS
│   └── constants.ts                     # APP_NAME, PAGE_TITLES
│
└── constants/
    ├── case-status.ts                   # Status labels, colors, transitions, post-op statuses, CASE_STATUS_HEX, PIPELINE_STAGES
    ├── permissions.ts                   # SENSITIVE_FIELD_ACCESS, MEDICAL_NOTE_ACCESS, DELETE_APPROVE_ROLES
    ├── service-categories.ts            # Service category labels
    ├── payment-methods.ts               # PAYMENT_METHOD_LABELS, PAYMENT_METHOD_HEX (Phase 5)
    └── customer-meta.ts                 # CUSTOMER_SOURCE, PRIVACY_LEVEL labels + hex (Phase 5)
```

---

## Conventions

### Vietnamese UI

Tất cả text trong UI là tiếng Việt:
- Labels: `Họ và tên`, `Email`, `Vai trò`, `Trạng thái`
- Buttons: `Tạo người dùng`, `Lưu thay đổi`, `Hủy`, `Yêu cầu xóa`, `Phê duyệt xóa`
- Error messages: `Email không hợp lệ`, `Số điện thoại đã tồn tại`
- Status: `Hoạt động`, `Ngừng hoạt động`, `Chờ xóa`

### Roles (12 total)

`admin`, `ceo`, `cso`, `master_sales`, `sales_online`, `sales_offline`, `accountant`, `doctor`, `nurse`, `coordinator`, `cskh_postop`, `media`

### Permission keys

Format `<resource>:<action>`. Examples: `users:read`, `cases:write`, `payments:approve`, `dashboard:read`. Xem `@/config/roles.ts` và `@/constants/permissions.ts` để biết matrix đầy đủ.

### Key permission constants

- `SENSITIVE_FIELD_ACCESS_ROLES`: Who can view address, CCCD — includes `sales_online`, `sales_offline`
- `MEDICAL_NOTE_ACCESS_ROLES`: Who can view medical/privacy notes — includes `sales_online`, `sales_offline`
- `DELETE_APPROVE_ROLES`: Who can approve customer deletion — `admin`, `ceo`, `cso`, `master_sales`
- `CASE_STATUS_CHANGE_ROLES`: Who can change case status — admin, cso, master_sales, coordinator, doctor, nurse, cskh_postop
- `PAYMENT_CREATE_ROLES`: Who can create payments — admin, cso, master_sales, sales_online, sales_offline, accountant
- `PAYMENT_CONFIRM_ROLES`: Who can confirm payments — admin, accountant

### File naming

- Components: PascalCase (`UsersTable.tsx`, `EditUserDialog.tsx`)
- Utilities / libs: kebab-case (`useCurrentUser.ts`)
- Type files: kebab-case trong `lib/types/`

### Import paths

Always `@/...` alias, never relative `../../../`.

### API pattern

- Mỗi route handler gọi domain helpers trong `@/lib/firestore/<entity>.ts`
- Domain helpers gọi generic helpers trong `@/lib/firebase/firestore.ts`
- Generic helpers auto-route giữa Firebase thật và mock store

### Audit logging

Use `writeAuditLog()` from `@/lib/firestore/audit` for all user actions. AuditAction type in `@/lib/types/audit.ts`.

---

## Dev Mode (no Firebase needed)

`.env.local` with `NEXT_PUBLIC_DEV_MODE=true` → app chạy hoàn toàn bằng mock data:

```
Client (browser)                    Server (Node.js)
─────────────────                   ──────────────────
UsersTable                          GET    /api/users         → mock store
  → fetch('/api/users')  ──HTTP──►  POST   /api/users/create  → mock store
                                    PATCH  /api/users/[uid]   → mock store
CreateUserDialog
  → fetch('/api/users/create')
                                    src/lib/mock/store.ts (in-memory Map)
```

Tất cả firestore helpers tự động rẽ vào mock store khi `isDevMode && !hasFirebaseConfig`. Khi có Firebase config thật, app tự động dùng Firebase — không cần đổi code.

### Login in dev mode

- **Bypass**: truy cập trực tiếp `/dashboard` hoặc bất kỳ route `(protected)` nào — AuthProvider set mock user tự động
- **Form login** (`/login`): sẽ fail nếu không có Firebase config — **đừng submit form**, chỉ dùng để verify UI

---

## Common Pitfalls

- **Dev mode login**: Form login sẽ fail nếu không có Firebase config. Truy cập trực tiếp protected routes để bypass.
- **Mock store resets** khi restart dev server — không persistent.
- **NEXT_PUBLIC_DEV_MODE** phải = `"true"` (string) trong `.env.local`, không phải boolean.
- **Phone uniqueness**: `createCustomer` và `updateCustomer` sẽ throw error nếu SĐT trùng. Frontend hiện lỗi qua toast.
- **Customer deletion**: KD chỉ gửi yêu cầu. CS/CEO/Trưởng KD mới phê duyệt được. Xem `DELETE_APPROVE_ROLES`.
- **Sales permissions**: `sales_online` và `sales_offline` có thể xem địa chỉ, ghi chú y tế, ghi chú riêng tư — được set trong `@/constants/permissions.ts`.
- **AuditAction**: Nếu cần action mới, phải add vào union type trong `@/lib/types/audit.ts`. Hiện đã có 18+ action types (Sprint 6.4 thêm `dashboard_render_fallback`) — xem `@/lib/types/audit.ts`.
- **Tooltip primitive**: Dùng `<Tooltip>` từ `@/components/ui/tooltip.tsx` (Sprint 6.4 — Radix-free, hover/focus/Escape/click-outside). **Đừng** tự build tooltip bằng CSS `hover:` — sẽ không accessible.
- **Toast thay `window.alert/confirm`**: Anti-pattern A9 đã đóng ở Sprint 6.3 + 6.4. Mọi error/confirm UI phải dùng `useToast()` hoặc `<ConfirmDialog>`. Sprint 7.x sẽ mở rộng API: `pushToast({ title, description, action, duration })`.
- **Feature flags**: 6 flags hiện có (default OFF in prod) — xem bảng trong Phase 6 section. Khi thêm behavior mới, cân nhắc flag nếu liên quan RBAC/SoD/consent. Sprint 7 sẽ thêm `URL_TABS` (7.2) + `CONSENT_GATE` (7.4).
- **Anti-pattern grep gate**: Trước khi commit, chạy: `grep -rE "window\.(confirm|alert)" src/ | grep -v __tests__/` (A9), `grep -rE "user-\d{3}" src/components` (A2), `grep -rE 'href=["\047]#["\047]' src/components/` (A8). Sprint 7.1 sẽ có hook `scripts/check-anti-patterns.sh` tự động.
- **Conventional Commits**: Sprint 6.4 vẫn dùng `update` legacy label (carry-over). Sprint 7.1 sẽ thêm `.husky/commit-msg` enforce `feat:` / `fix:` / `refactor:` / `chore:` / `docs:` / `test:`.
- **Notification events**: Nếu cần event type mới, add vào `NotificationEventType` union trong `@/lib/types/notification.ts` và labels/icons trong `@/lib/notifications/templates.ts` và `@/app/(protected)/notifications/page.tsx`. Hiện có 14 event types.
- **Attachment upload**: `attachment-upload-dialog` tự ghi audit log khi upload. Trong dev mode, file lưu mock URL — không cần Firebase Storage thật.
- **Consent workflow**: 4 types (treatment, image_storage, marketing_usage, hospital_sharing). Status workflow: pending → granted/denied/revoked. Mọi thay đổi status đều ghi audit log.
- **Follow-up auto-create**: `createPostOpFollowups(caseId)` tạo D1/D3/D7/D14/D30/D90 tự động. Trigger khi case chuyển sang `procedure_completed`.
- **Reports charts (Recharts v3)**: Tooltip `formatter` callback types rất lỏng (`ValueType | undefined`). Dùng helper `tooltipFormatVND` / `tooltipFormatCount` từ `@/components/reports/chart-theme.ts` thay vì inline arrow function với type `number` — sẽ bị TS error.
- **`getMonthLabel(input)`**: Chấp nhận cả `Date` lẫn `number` (month index 0-11). Phase 5 dùng cả 2 dạng tùy context.
- **Chart colors**: Recharts không nhận Tailwind classes (vd `bg-swan-500`). Phải dùng hex từ `CASE_STATUS_HEX` / `PAYMENT_METHOD_HEX` / `CUSTOMER_SOURCE_HEX` / `PRIVACY_LEVEL_HEX`.
