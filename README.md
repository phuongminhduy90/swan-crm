# CRM SWAN

Hệ thống quản lý khách hàng và hồ sơ phẫu thuật thẩm mỹ cho Swan Clinic.

**Current status:** Phase 1–4 đã hoàn thành + Phase 5 (Reports + Seed expansion). Full project scaffold, authentication, role-based access control, customers (với dialog CRUD + delete approval), cases, payments, services, tasks, calendar, checklist, status workflow, attachments, consents, post-op follow-ups, notifications, audit logs, **reports page (3 tabs với charts)**, và premium Apple/Stripe-style theme.

> Phase 5 còn lại (chưa làm): Firebase security rules (`firebase.json`, `storage.rules`, `firestore.indexes.json`) + Vercel deployment config.

## Tech Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** (Swan Clinic branding + premium theme tokens)
- **Firebase** (Auth + Firestore + Storage)
- **Firebase Admin SDK** (server-side privileged operations)
- **React Hook Form** + **Zod** validation
- **Lucide React** icons
- **Recharts** cho reports (Phase 5)

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
│   ├── ui/                           # 16 premium UI components (Button, Modal, Toast, ...)
│   ├── layout/                       # Sidebar (glass), Topbar (glass), MobileNav, AppShell
│   ├── auth/                         # LoginForm
│   ├── dashboard/                    # StatCards (real data), RecentActivity (real data)
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

Xem `CLAUDE.md` để biết thêm về conventions, project structure, và bug fixes.
