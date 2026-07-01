# CRM SWAN

Hệ thống quản lý khách hàng và hồ sơ phẫu thuật thẩm mỹ cho Swan Clinic.

**Current status:** Phase 1–5 ✅ + Phase 6 (UX Redesign — Sprints 6.1–6.4) ✅. Full project scaffold, authentication, role-based access control, customers (với dialog CRUD + delete approval), cases, payments, services, tasks, calendar, checklist, status workflow, attachments, consents, post-op follow-ups, notifications, audit logs, **reports page (3 tabs với charts)**, premium Apple/Stripe-style theme, server-side RBAC, payment SoD, clinical checklist gate, revenue tooltip, refund chart, mobile visual regression harness, **683 vitest tests + 28 Playwright snapshots**, **6 feature flags** (all default OFF in prod).

> Phase 7 (Sprint 7.1–7.5) sắp tới: UI library refactor (`<CurrencyInput>`, shared Tabs + URL-sync), consent gate, Firebase security rules deployment, Vercel deployment. Xem [`docs/ux-redesign/SPRINT_7_EXECUTION_PLAN.md`](docs/ux-redesign/SPRINT_7_EXECUTION_PLAN.md).

## Tech Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** (Swan Clinic branding + premium theme tokens)
- **Firebase** (Auth + Firestore + Storage)
- **Firebase Admin SDK** (server-side privileged operations)
- **React Hook Form** + **Zod** validation
- **Lucide React** icons
- **Recharts** cho reports (Phase 5)
- **Vitest** + **@testing-library/react** cho unit/integration tests (683 tests, Phase 6)
- **Playwright** cho mobile visual regression (28 snapshots × 5 viewports, Phase 6.4)

## Brand Colors

- **Swan Aqua** (primary): `#00ADBE`
- **Champagne Gold** (accent): `#C9A96E`
- **Cream** (background): `#FFF9F0`

## Premium Theme

UI sử dụng design system Apple/Stripe-style với:
- Subtle gradients (`from-swan-500 to-swan-600`)
- Glass morphism (`backdrop-blur-xl` + semi-transparent)
- Soft shadows (`shadow-soft` / `shadow-medium` / `shadow-elevated`)
- Smooth animations (`animate-slide-up` / `animate-fade-in` / `animate-scale-in`)
- Toast notifications (success/error/info)

## Cài đặt

### 1. Cài dependencies

```bash
npm install
```

### 2. Cấu hình Firebase (optional — chỉ cần khi deploy production)

Copy `.env.local.example` thành `.env.local` và điền thông tin:

```bash
cp .env.local.example .env.local
```

Các biến cần thiết:
- `NEXT_PUBLIC_FIREBASE_*` — Firebase Client SDK config (từ Firebase Console)
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — Firebase Admin SDK service account

### 3. Chạy development server

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

### 4. Dev Mode (chạy hoàn toàn bằng mock data, không cần Firebase)

**Đây là cách khuyến nghị để phát triển và test trước khi deploy.**

Set `NEXT_PUBLIC_DEV_MODE=true` trong `.env.local` (mặc định đã bật trong `.env.local.example`).

Khi dev mode được bật, app chạy **hoàn toàn bằng mock data in-memory**:

- ✅ **Auth**: dùng mock users — chuyển role ngay trên Topbar (12 roles có sẵn)
- ✅ **User management**: đọc / tạo / sửa / kích hoạt / ngừng hoạt động — không cần Firebase Admin SDK
- ✅ **Firestore calls**: tất cả CRUD (`getDocument`, `setDocument`, `updateDocument`, `deleteDocument`, `getAllDocuments`) tự động rẽ vào mock store ở server
- ✅ **API routes**: bypass Admin SDK, thao tác trực tiếp trên mock store
- ✅ **Seed data**: 12 users (mỗi role 1) + 20 customers + 20 cases + 21 case-services + **23 payments** + **26 followups** + 7 tasks + 7 appointments + 3 hospital coordinations + 5 staff assignments + 4 locations + 17 services + 8 attachments + 10 consents + 10 notifications + **30 audit logs**

**Không cần** bất kỳ biến môi trường Firebase nào. Dữ liệu reset khi restart server.

**Cách hoạt động:**

```
Client (browser)                    Server (Node.js)
──────────────────                  ───────────────────
UsersTable                          GET    /api/users        → mock store
  → fetch('/api/users') ───HTTP───►  POST   /api/users/create → mock store
                                    PATCH  /api/users/[uid]  → mock store
CreateUserDialog
  → fetch('/api/users/create')
                                    src/lib/mock/store.ts (in-memory Map)
```

Khi bạn thêm Firebase config thật vào `.env.local`, app tự động chuyển sang dùng Firebase thật — không cần đổi code.

### 5. Truy cập dev mode

Bypass login bằng cách truy cập trực tiếp:
- [http://localhost:3000/dashboard](http://localhost:3000/dashboard) — Dashboard với real data
- [http://localhost:3000/customers](http://localhost:3000/customers) — Khách hàng
- [http://localhost:3000/cases](http://localhost:3000/cases) — Hồ sơ CASE
- [http://localhost:3000/calendar](http://localhost:3000/calendar) — Lịch hẹn
- [http://localhost:3000/tasks](http://localhost:3000/tasks) — Công việc
- [http://localhost:3000/payments](http://localhost:3000/payments) — Thanh toán
- [http://localhost:3000/followups](http://localhost:3000/followups) — Theo dõi sau PT
- [http://localhost:3000/reports](http://localhost:3000/reports) — Báo cáo (doanh thu / pipeline / khách hàng)
- [http://localhost:3000/media-library](http://localhost:3000/media-library) — Thư viện tài liệu (ảnh, PDF)
- [http://localhost:3000/notifications](http://localhost:3000/notifications) — Thông báo
- [http://localhost:3000/audit-logs](http://localhost:3000/audit-logs) — Nhật ký hoạt động
- [http://localhost:3000/settings/users](http://localhost:3000/settings/users) — Quản lý người dùng (admin)
- [http://localhost:3000/settings/services](http://localhost:3000/settings/services) — Dịch vụ
- [http://localhost:3000/settings/treatment-locations](http://localhost:3000/settings/treatment-locations) — Điểm điều trị

## Scripts

```bash
npm run dev          # Dev server
npm run build        # Production build
npm run start        # Run production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check (npx tsc --noEmit)
npm run lint:fix     # ESLint auto-fix
npm run test         # Vitest (unit + integration, 683 tests)
npm run test:watch   # Vitest watch mode
npm run test:cov     # Vitest with v8 coverage
npm run test:ui      # Vitest UI
npx playwright test  # Mobile visual regression (28 snapshots, requires `npm run dev`)
```

## Cấu trúc dự án

```
src/
├── app/                              # Next.js App Router
│   ├── (auth)/login/                 # Public: login page
│   ├── (protected)/                  # Protected route group (AuthGuard + AppShell)
│   │   ├── dashboard/                # Real-time stats + recent activity
│   │   ├── customers/                # List (dialog CRUD) / New / Detail (delete approval)
│   │   ├── cases/                    # List / New / Detail (checklist + status workflow)
│   │   ├── payments/                 # List / New
│   │   ├── calendar/                 # Week/month view + appointment modal
│   │   ├── tasks/                    # List + create form
│   │   ├── followups/                # Post-op follow-up (today / overdue / upcoming)
│   │   ├── reports/                  # Reports page — 3 tabs (Revenue/Pipeline/Customer) + filter (Phase 5)
│   │   ├── media-library/            # Attachments grid + upload
│   │   ├── settings/                 # users / roles / services / treatment-locations
│   │   ├── notifications/            # In-app notification center
│   │   └── audit-logs/               # Audit trail with filters + diff view
│   ├── api/                          # REST API (users, customers, cases, payments, attachments, consents, notifications, followups, audit-logs)
│   ├── layout.tsx                    # Root layout (Inter font, Vietnamese)
│   ├── providers.tsx                 # AuthProvider + ToastProvider
│   ├── page.tsx                      # Root redirect
│   └── globals.css                   # Premium theme tokens + glass utilities
├── components/
│   ├── ui/                           # 17 premium UI components (Button, Modal, Toast, Tooltip, Tabs, ...)
│   ├── layout/                       # Sidebar (glass), Topbar (glass), MobileNav, AppShell
│   ├── auth/                         # LoginForm
│   ├── dashboard/                    # StatCards (real data + revenue tooltip), RecentActivity
│   ├── users/                        # UsersTable, CreateUserDialog, EditUserDialog
│   ├── customers/                    # CustomerList (actions column), CustomerForm
│   ├── cases/                        # CaseList, CaseForm, StatusBadge, StatusWorkflow, BillSummary
│   ├── checklist/                    # ChecklistPanel
│   ├── payments/                     # PaymentList, PaymentForm, ConfirmDialog
│   ├── locations/                    # LocationListTable, LocationForm
│   ├── services/                     # ServiceListTable, ServiceForm
│   ├── tasks/                        # TaskList, TaskForm
│   ├── followups/                    # FollowupList, FollowupForm
│   ├── attachments/                  # AttachmentUploadDialog, AttachmentList
│   ├── consents/                     # ConsentPanel (create + status transitions)
│   └── reports/                      # Reports page components — 3 tab wrappers + 8 charts + skeleton/filters (Phase 5)
├── lib/
│   ├── firebase/                     # Client + Admin SDK + Storage helpers
│   ├── auth/                         # AuthProvider, RBAC, mock users
│   ├── firestore/                    # 15 domain modules (users, customers, cases, attachments, consents, notifications, followups, audit, ...)
│   ├── types/                        # 15 type modules (User, Customer, Case, Payment, Task, Appointment, Attachment, Consent, Followup, Notification, Audit, ...)
│   ├── hooks/                        # useCurrentUser
│   ├── validators/                   # case, customer, payment, task, treatment-location, staff-assignment, attachment, consent
│   ├── notifications/                # in-app, telegram, templates
│   ├── checklist/                    # evaluatePreHospitalChecklist, evaluatePreProcedureChecklist
│   ├── tasks/                        # auto-tasks (triggerAutoTasks)
│   ├── mock/store.ts                 # In-memory mock data + 16 seed functions
│   └── utils/                        # cn, format (formatCompact, formatVNDCompact, getMonthKey, formatPercent), validation
├── config/
│   ├── firebase.ts                   # Config, isDevMode, hasFirebaseConfig
│   ├── roles.ts                      # ROLE_LABELS, ROLE_PERMISSIONS
│   └── constants.ts                  # APP_NAME, PAGE_TITLES
└── constants/
    ├── case-status.ts                # Status labels, colors, transitions, post-op statuses, CASE_STATUS_HEX, PIPELINE_STAGES
    ├── permissions.ts                # Permission constants (SENSITIVE_FIELD, MEDICAL_NOTE, DELETE_APPROVE, ...)
    ├── service-categories.ts         # Service category labels
    ├── payment-methods.ts            # PAYMENT_METHOD_LABELS + HEX (Phase 5)
    └── customer-meta.ts              # CUSTOMER_SOURCE + PRIVACY_LEVEL labels + hex (Phase 5)

tests/                                  # Playwright E2E + visual regression (Phase 6.4)
├── visual-helpers.ts                  # Pure helpers (route matrix, baseline filename, settle)
└── visual-regression.spec.ts          # 25 visual snapshot tests + 3 diagnostic tests

playwright.config.ts                   # 5-viewport matrix (iPhone SE 360 / iPhone 12 390 / Pixel 7 412 / iPad Mini 768 / Desktop 1280)
docs/ux-redesign/                      # Phase 6 + 7 sprint + story docs
├── SPRINT_6_{1,2,3,4}_EXECUTION_PLAN.md
├── SPRINT_6_{1,2,3,4}_COMPLETION_REPORT.md
├── SPRINT_7_EXECUTION_PLAN.md
├── STORY_*_IMPLEMENTATION_REPORT.md   # 59 files
├── STORY_*_MIGRATION_NOTES.md
└── visual-baselines/                  # 25 PNG baselines (capture pending)
```

## Roles & Permissions

12 roles:
- `admin`, `ceo`, `cso` — quản lý cấp cao
- `master_sales`, `sales_online`, `sales_offline` — kinh doanh
- `accountant` — kế toán
- `doctor`, `nurse` — y tế
- `coordinator` — điều phối viên
- `cskh_postop` — CSKH sau phẫu thuật
- `media` — media

### Special Permissions

- **SENSITIVE_FIELD_ACCESS_ROLES**: Ai được xem address, CCCD, ghi chú y tế/riêng tư → `admin, ceo, cso, master_sales, sales_online, sales_offline, coordinator, doctor, nurse`
- **DELETE_APPROVE_ROLES**: Ai được phê duyệt xóa khách hàng → `admin, ceo, cso, master_sales`
- **CASE_STATUS_CHANGE_ROLES**: Ai được chuyển trạng thái CASE → `admin, cso, master_sales, coordinator, doctor, nurse, cskh_postop`
- **PAYMENT_CONFIRM_ROLES**: Ai được xác nhận thanh toán → `admin, accountant`

Permission matrix defined in `src/config/roles.ts` and `src/constants/permissions.ts`. Sidebar menu items are filtered by role.

### Feature Flags (Phase 6+, all default OFF in production)

Tất cả 6 flags hiện có default `false` ở production — chỉ bật sau khi có sign-off đầy đủ (CEO + accountant-lead + medical director + product-owner). Khi dev (`NEXT_PUBLIC_DEV_MODE=true`), một số flag sẽ được bật trong code path.

| Flag | Story | Promotion gate |
|:-----|:------|:---------------|
| `NEXT_PUBLIC_FEATURE_SHARED_MENU` | A.5 (6.1) | Triple sign-off |
| `NEXT_PUBLIC_FEATURE_SERVER_RBAC` | B.1.3 (6.1) | Triple sign-off |
| `NEXT_PUBLIC_FEATURE_PAYMENT_SOD` | B.3.1 (6.1) | CEO + accountant-lead + PO |
| `NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST` | B.2.1 (6.2) | Medical director + CEO + PO |
| `NEXT_PUBLIC_FEATURE_CHECKLIST_GATE` | B.2.1 (6.2) | Medical director + CEO + PO |
| `NEXT_PUBLIC_FEATURE_MINH_SCREEN` | 6.3 | C-3 visual baseline (Sprint 7.1) |

**Sprint 7 sẽ thêm:** `NEXT_PUBLIC_FEATURE_URL_TABS` (7.2) + `NEXT_PUBLIC_FEATURE_CONSENT_GATE` (7.4).

## Customer Flow

### CRUD Operations

- **List page** (`/customers`):
  - DataTable với search, pagination (10/page)
  - Cột: Mã KH, Họ tên, SĐT, Nguồn, Mức riêng tư, **Nhân viên tạo** (mới), Ngày tạo
  - Actions dropdown: Chỉnh sửa, Yêu cầu xóa / Phê duyệt xóa / Từ chối xóa
  - Nút "Thêm khách hàng" → mở Create Dialog
- **Detail page** (`/customers/[id]`):
  - Glass header với customer info, badge "NV tạo", banner cảnh báo nếu đang chờ xóa
  - 3 tabs: Thông tin / Lịch sử ca / Timeline
  - Edit button (chỉ người tạo hoặc admin/CEO/CS/trưởng KD)
  - Nút "Yêu cầu xóa" (KD) hoặc "Phê duyệt xóa" + "Từ chối" (CS/CEO/trưởng KD)
- **Phone uniqueness**: Hệ thống check trùng SĐT trước khi tạo/cập nhật, throw error nếu trùng

### Delete Approval Workflow

1. KD (online/offline) nhấn "Yêu cầu xóa" → nhập lý do → gửi request
2. Khách hàng hiện badge "Chờ xóa" trên danh sách
3. CS/CEO/Trưởng KD (`DELETE_APPROVE_ROLES`) thấy dropdown "Phê duyệt xóa" và "Từ chối xóa"
4. Approve = hard delete (xóa vĩnh viễn). Reject = reset flags

## Phase Progress

### ✅ Phase 1 — Foundation
- Next.js setup, Tailwind, Firebase client/admin
- Authentication (Firebase Auth + dev mode bypass)
- Role-based access control (12 roles, permission matrix)
- Layout (sidebar, topbar, mobile drawer)
- Login page, AuthGuard, protected routes
- Dashboard skeleton, user management
- API routes cho user CRUD
- 13 placeholder pages

### ✅ Phase 2 — Customer & Sales Pipeline
- Customers — full CRUD với dialog (create + edit), search, pagination
- Cases — list/create/status badge/bill summary
- Services — CRUD với dialog
- Payments — list/form/confirm dialog
- Staff assignment — types + CRUD
- Customer delete approval workflow
- Phone uniqueness check
- "Nhân viên tạo" tracking & display
- sales_online/offline xem được sensitive fields

### ✅ Phase 3 — Premium Theme & Calendar
- Treatment Locations settings page
- Calendar page (week/month view, appointment modal)
- Tasks module (list + form + auto-tasks)
- Checklist (pre-hospital & pre-procedure)
- Status workflow UI (safe vs caution transitions)
- Mock seeds cho tasks, appointments, hospital coordinations
- Premium Apple/Stripe theme:
  - Subtle gradients, glass morphism, soft shadows
  - Smooth animations (slide-up, fade-in, scale-in)
  - Toast notifications
  - DropdownMenu, Tabs, Textarea shared components
  - Refined UI primitives (Button, Card, Badge, Input, Select, Modal, DataTable)

### ✅ Phase 4 — Attachments, Consents & Notifications
- **Attachments**: drag-and-drop upload, visibility (internal / case_team / customer), per-case list, mock storage fallback
- **Consents**: 4 loại (treatment, image_storage, marketing_usage, hospital_sharing), status workflow pending → granted/denied/revoked
- **Post-op Follow-up**: auto-create D1/D3/D7/D14/D30/D90 khi case chuyển sang `procedure_completed`, 3 sections (today / overdue / upcoming)
- **Notifications**: 14 event types (new_case, payment_pending, procedure_completed, postop_followup_due, complaint, ...), in-app center với mark-as-read + read-all
- **Audit logs**: 18 AuditAction types, filter theo entity/action/actor, expandable JSON diff cho state changes
- Seed data: 8 attachments + 10 consents + 6 followups (D1-D90 cho case #5) + 10 notifications + 14 audit logs

### ✅ Phase 5 — Reports + Seed Expansion
- **Reports page** (`/reports`) — 3 tabs với charts (Recharts) + filter khoảng thời gian (3/6/12 tháng / Tất cả)
  - **Tab Doanh thu**: 4 stat cards (tổng / đã xác nhận / chờ / trung bình ca) + Line chart xu hướng doanh thu theo tháng (confirmed + pending) + Pie chart phương thức thanh toán (5 loại)
  - **Tab Luồng CASE**: Custom pipeline funnel 5 giai đoạn (Khởi tạo → Xác nhận → Xếp lịch → Thực hiện → Hậu phẫu) + Horizontal bar chart trạng thái case + Vertical bar chart theo dịch vụ
  - **Tab Khách hàng**: Pie chart nguồn khách (7 nguồn) + Pie chart mức bảo mật (3 levels) + Bar chart khách mới theo tháng
- **Shared utilities**: `formatCompact`, `formatVNDCompact`, `getMonthKey`, `getMonthLabel`, `formatPercent` extracted to `src/lib/utils/format.ts`
- **Chart constants**: `CASE_STATUS_HEX`, `PAYMENT_METHOD_HEX`, `CUSTOMER_SOURCE_HEX`, `PRIVACY_LEVEL_HEX`, `PIPELINE_STAGES` + `getPipelineStage()`
- **Seed data expansion**:
  - Payments: 6 → 23 (phân bổ 6 tháng, 5 phương thức, confirmed/pending/refund)
  - Followups: 6 → 26 (4 cases có followup trail D1→D90)
  - Audit logs: 14 → 30 (spread Jan–Jun 2026, 6+ actor roles)
- Loading skeletons (ChartSkeleton + StatCardsSkeleton) match design system

### 🔜 Phase 5 (còn lại) — Deployment
- **Firebase config files**: `firebase.json`, `.firebaserc`, `firestore.indexes.json`, `storage.rules` (chưa có)
- **Vercel deployment**: `vercel.json`, security headers, deployment docs (chưa có)
- `firestore.rules` đã có sẵn (316 dòng, RBAC đầy đủ + field-level security) — chỉ cần file config để deploy
- **Đã được roll vào Sprint 7.4 (C-4) và 7.5 (C-5)** — xem Phase 7 bên dưới.

### ✅ Phase 6 — UX Redesign + Revenue Integrity (Sprints 6.1–6.4)

**20 stories × 4 sprints** — closed 9 anti-patterns (A1/A2/A6/A8/A9/A10/A11/A12/A22), shipped 6 feature flags (all default OFF in prod), established premium design system với glass morphism, gradient backgrounds, full a11y primitives. Test coverage: **0 → 683 vitest** + **0 → 28 Playwright**.

#### Sprint 6.1 — Foundation (5 stories)
- **A.5** Shared sidebar menu config (12 roles render identical sidebar) — flag `SHARED_MENU`
- **B.1.1** CCCD fields visibility — added `sales_online/offline` to `SENSITIVE_FIELD_ACCESS_ROLES`
- **B.1.2** `hospital_confirmed → scheduled` blocked transition
- **B.1.3** Server-side role enforcement for case status — flag `SERVER_RBAC`
- **B.3.1** Payment separation of duties (caller cannot confirm own payment) — flag `PAYMENT_SOD`
- **B.1.4** Dashboard `lab_overdue_count` clickable card

#### Sprint 6.2 — Clinical Safety (4 stories)
- **B.1.5** Auto-escalate overdue followup (24h → `postop_followup_overdue`)
- **B.2.1** Clinical checklist gate (pre-hospital + pre-procedure, blocks status transitions when incomplete) — flags `CLINICAL_CHECKLIST` + `CHECKLIST_GATE`
- **B.2.2** `medical_alert_resolved` terminal status
- **B.2.3** Audit PII redaction (no CCCD/phone in audit JSON)
- **B.2.4** `procedure_completed` 2nd-confirm with date picker

#### Sprint 6.3 — Premium Polish (6 stories)
- **A.1** Tabs ARIA + arrow-key navigation
- **A.2** Modal focus trap + `aria-labelledby`
- **A.3** CloseIconButton (a11y label `Đóng`)
- **A.6** ConfirmDialog `animate-scale-in` icon
- **B.4.1–B.4.6** AppShell `min-h-screen`, next-owner banner, payment display names, topbar profile toast, native confirm→ConfirmDialog, status filter responsive
- **MINH_SCREEN** flag (default OFF, pending visual baseline)

#### Sprint 6.4 — Revenue Integrity (5 stories)
- **B.3.2** Revenue tooltip on dashboard StatCard — Info icon + Vietnamese copy, keyboard accessible, WCAG AAA contrast
- **B.3.4** Refund line + annotation on revenue chart — 2 series (confirmed + refund, dashed red `#EF4444`), responsive annotation `Đã xác nhận − Hoàn tiền`
- **RR-4** Suspense fallback for `lab_overdue_count` — bad data → card shows `0` + `dashboard_render_fallback` audit log (no white-screen)
- **R-A1** Last A9 close: `window.alert` → `<Toast error>` (B.2.1 L2 pre-flight)
- **C-3** Mobile visual regression harness — Playwright + 28 tests across 5 viewports

#### Phase 6 Test Pyramid

| Layer | Count | Tool |
|:------|------:|:-----|
| TypeScript | 0 errors | `tsc --noEmit` |
| ESLint | 0 warnings | `next lint` |
| Vitest unit + integration | 683 passing (35 files) | `@testing-library/react` |
| Playwright visual | 28 listed (25 snapshots + 3 diagnostic) | `@playwright/test` |
| Anti-pattern grep | 0 violations (A1/A2/A7/A8/A9/A10/A14/A23/A26) | shell greps |
| Build | 34 routes, ~87.4 kB shared JS | `next build` |

### 🔜 Phase 7 — UI Library Refactor + Consent Gate + Production Hardening (Sprint 7.1–7.5)

**25 stories × 5 sub-sprints** — capacity ~119h vs ~400h buffer (~297h buffer for sign-offs + visual baseline + production deployment). Xem [`docs/ux-redesign/SPRINT_7_EXECUTION_PLAN.md`](docs/ux-redesign/SPRINT_7_EXECUTION_PLAN.md).

| Sub-sprint | Theme | Stories | Risk | New flags |
|:-----------|:------|--------:|:----:|:---------:|
| **7.1** | A11y Foundation + Tech Debt | 7 | 🟢 | — |
| **7.2** | UI Library Refactor | 4 | 🟡 | `URL_TABS` |
| **7.3** | Forms + Inputs | 5 | 🟡 | — |
| **7.4** | Consent + Privacy + Security | 6 | 🔴 | `CONSENT_GATE` |
| **7.5** | Notifications + Polish + Release | 13 | 🟡 | — |

**Highlight stories:**
- **C.2.1** `<CurrencyInput>` component (A10 anti-pattern closure)
- **C.2.2** Shared Tabs + URL-sync (`?tab=`) — enables notification deep-links
- **C.4.1 + C.4.2** Server-side + frontend consent gate on `public_marketing` uploads
- **C-4** Firebase security rules deployment (`firebase.json` + `storage.rules` + `indexes.json`)
- **C-5** Vercel deployment config (`vercel.json` + security headers)
- **PH-10** `release/v7.0.0` tag + release notes (final Phase C close)

**Target test count:** ~683 → **~890 tests** across ~45 files (+207 estimated).

## Tech Highlights

### Premium Theme System (`tailwind.config.ts` + `globals.css`)

- **Shadows:** `shadow-soft` (1px/12px) → `shadow-medium` (2px/24px) → `shadow-elevated` (4px/40px) → `shadow-glow-swan` (ring)
- **Animations:** `fade-in` (200ms), `slide-up` (240ms), `scale-in` (200ms), `shrink` (3.5s progress bar)
- **Gradients:** `bg-gradient-swan`, `bg-gradient-champagne`, `bg-gradient-page`
- **Body:** `bg-gradient-to-br from-cream via-white to-swan-50/30` (fixed)
- **Glass utility:** `backdrop-blur-xl` + `bg-white/80` + `border-white/40`

### Customer List with Actions

`customer-list.tsx` features:
- Refresh prop (auto reload after create/edit/delete)
- Actions column (DropdownMenu) with 3 states:
  - Normal: Edit + "Yêu cầu xóa"
  - Pending deletion: "Đang chờ phê duyệt" (disabled) or "Phê duyệt xóa" + "Từ chối xóa"
  - Has creator display name (resolved from user list)
- Toast notifications for all operations
- Confirm dialogs for request/approve/reject

### Toast System

`src/components/ui/toast.tsx`:
- Lightweight custom toast (no external lib)
- Bottom-right position, auto-dismiss 3.5s
- Variants: success (emerald), error (red), info (swan)
- Slide-up entrance, progress bar animation
- `useToast()` hook for anywhere in app

## Notes

- **Mock store resets** khi restart dev server — không persistent
- **NEXT_PUBLIC_DEV_MODE** phải = `"true"` (string) trong `.env.local`
- **Phone uniqueness** được enforce cả ở create và update
- **Delete approval** — xem `DELETE_APPROVE_ROLES` để biết ai có quyền phê duyệt
- **Sales permissions** — `sales_online`/`sales_offline` xem được address, ghi chú y tế, ghi chú riêng tư
- **Created by tracking** — mỗi customer có `createdBy` (user ID), hiển thị tên ở list + detail
- **Attachments** — upload dialog với drag-and-drop, mock storage trong dev mode, 3 visibility levels
- **Consents** — 4 loại (treatment, image_storage, marketing_usage, hospital_sharing), workflow pending → granted/denied/revoked
- **Follow-ups** — auto-create D1/D3/D7/D14/D30/D90 khi case chuyển sang `procedure_completed`
- **Audit logging** — 18 action types, ghi tự động ở attachment upload/delete, consent status change
- **Reports page** — `/reports` với 3 tabs (Revenue/Pipeline/Customer), filter theo khoảng thời gian, dùng Recharts. Tất cả charts nhận hex colors từ `chart-theme.ts` (không phải Tailwind classes).
- **Seed data coverage** — payments (23) spread 6 tháng, followups (26) cho 4 cases, audit logs (30) spread Jan–Jun 2026
- **Feature flags** — 6 flags default OFF in prod (xem bảng phía trên). Sprint 7 sẽ thêm `URL_TABS` + `CONSENT_GATE`. Khi modify behavior mới liên quan RBAC/SoD/consent, cân nhắc gate.
- **Tooltip primitive** — dùng `<Tooltip>` từ `@/components/ui/tooltip.tsx` (Sprint 6.4). Đừng tự build bằng CSS `hover:`.
- **Toast thay `window.alert/confirm`** — A9 anti-pattern đã đóng. Mọi error/confirm UI phải dùng `useToast()` hoặc `<ConfirmDialog>`.
- **Revenue tooltip** — Dashboard StatCard "Doanh thu tháng" có Info icon (Vietnamese copy `Chỉ tính thanh toán đã xác nhận, không bao gồm đang chờ hoặc hoàn tiền`).
- **Refund chart** — Reports Revenue tab có 2 series: confirmed (swan aqua) + refund (red `#EF4444`, dashed). Annotation `Đã xác nhận − Hoàn tiền` ở desktop, mobile variant `< 640px`.
- **Visual regression** — `npx playwright test` chạy 25 PNG snapshots × 5 viewports (iPhone SE 360 / iPhone 12 390 / Pixel 7 412 / iPad Mini 768 / Desktop 1280). PNG capture + tag `visual-baseline-v6.4` pending (operator action).
- **Anti-pattern gate** — Sprint 7.1 sẽ có `scripts/check-anti-patterns.sh` (A2/A8/A9/A22/A26 greps). Hiện tại chạy thủ công.

Xem `CLAUDE.md` để biết thêm về conventions, project structure, Phase 6 + 7 progress, và bug fixes.
