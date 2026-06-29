# Swan Case CRM — Information Architecture

- **Date:** 2026-06-29
- **Project context:** [`CLAUDE.md`](../../CLAUDE.md)
- **Related docs:** [`SITEMAP.md`](SITEMAP.md) · [`UX_DECISION_DOCUMENT.md`](UX_DECISION_DOCUMENT.md) · [`DESIGN_DIRECTION.md`](DESIGN_DIRECTION.md)
- **Owners:** `information-architect`, `ux-designer`, `product-owner`
- **Scope:** Content inventory, navigation hierarchy, tab architecture, search/filter patterns, cross-module linking, URL structure, empty states

This document defines **what lives where** and **how users discover content**. It pairs with [`SITEMAP.md`](SITEMAP.md) for navigation and routing details.

---

## 1. Content Inventory

Every screen, its purpose, primary entities, and key actions.

### 1.1 Dashboard

| Screen | URL | Purpose | Primary entities | Key actions |
|--------|-----|---------|------------------|-------------|
| Dashboard | `/dashboard` | Entry point; action queues + context stats | Cases (overdue, alerts), Payments (pending), Followups (D1 today), Customers (new), Revenue (this month) | Click action queue → filtered list (F-CRIT-07, F-CRIT-09) |

### 1.2 Customer module

| Screen | URL | Purpose | Primary entities | Key actions |
|--------|-----|---------|------------------|-------------|
| Customer list | `/customers` | Search/filter/sort all customers | Customer (summary fields) | Create, search by name/phone, view detail |
| Customer create | `/customers/new` | Capture new customer | Customer (22 fields across 4 sections) | Submit form (phone uniqueness checked on blur) |
| Customer detail | `/customers/[id]` | Full customer profile | Customer, Case[], Followup[], Attachment[] | Edit, view cases, view followups, request deletion |

### 1.3 Case module (the clinical heart)

| Screen | URL | Purpose | Primary entities | Key actions |
|--------|-----|---------|------------------|-------------|
| Case list | `/cases` | View all cases, filter by status | Case (summary fields) | Create, filter by status, sort by date |
| Case create | `/cases/new` | Create new case with services, discount, location | Case, CaseService[], Customer (search-and-select) | Submit form (Zod validated) |
| Case detail | `/cases/[id]` | Full case lifecycle (8 tabs) | Case, CaseService[], Payment[], Consent[], Attachment[], Followup[], StaffAssignment[] | Change status, manage checklist, view/edit tab-specific content |

### 1.4 Payment module

| Screen | URL | Purpose | Primary entities | Key actions |
|--------|-----|---------|------------------|-------------|
| Payment list | `/payments` | View all payments, filter by status/method/date | Payment (summary fields) | Create, filter, confirm |
| Payment create | `/payments/new` | Record a new payment | Payment (VND-formatted input) | Submit (linked to caseId + customerId) |

### 1.5 Calendar

| Screen | URL | Purpose | Primary entities | Key actions |
|--------|-----|---------|------------------|-------------|
| Calendar | `/calendar` | Week/month view of appointments | Appointment, Case (linked), Customer (linked) | Create appointment, view case link, call customer |

### 1.6 Tasks

| Screen | URL | Purpose | Primary entities | Key actions |
|--------|-----|---------|------------------|-------------|
| Task list | `/tasks` | View/manage tasks | Task | Create task (pending F-LOW-05 audit) |

### 1.7 Follow-ups

| Screen | URL | Purpose | Primary entities | Key actions |
|--------|-----|---------|------------------|-------------|
| Follow-up dashboard | `/followups` | Post-op follow-up management | Followup (D1/D3/D7/D14/D30/D90) | View overdue/today/upcoming, mark complete, escalate |
| Follow-up create | `/followups/new` | (not yet implemented) | Followup | — |

### 1.8 Reports

| Screen | URL | Purpose | Primary entities | Key actions |
|--------|-----|---------|------------------|-------------|
| Reports | `/reports` | Analytics & insights (3 tabs) | Payment[], Case[], Customer[] | Switch tabs, filter by date range |

| Tab | URL params | Content |
|-----|-----------|---------|
| Revenue | `?tab=revenue` | Revenue trend (Line), Payment method (Pie), 4 stat cards |
| Pipeline | `?tab=pipeline` | 5-stage funnel, Status bar chart, Category bar chart |
| Customer | `?tab=customer` | Source (Pie), Privacy level (Pie), New customers (Bar) |

### 1.9 Notifications

| Screen | URL | Purpose | Primary entities | Key actions |
|--------|-----|---------|------------------|-------------|
| Notification center | `/notifications` | Full notification history | Notification (14 event types) | View, mark read, filter by read/unread |

### 1.10 Audit logs

| Screen | URL | Purpose | Primary entities | Key actions |
|--------|-----|---------|------------------|-------------|
| Audit logs | `/audit-logs` | Regulatory compliance, investigation | AuditLog (30+ entries) | Filter by entity/action/actor, expand JSON diff |

### 1.11 Settings

| Screen | URL | Purpose | Primary entities | Key actions |
|--------|-----|---------|------------------|-------------|
| Users | `/settings/users` | User CRUD, toggle active/inactive | User | Create, edit, deactivate |
| Roles | `/settings/roles` | View 12 roles + permission matrix | Role (read-only) | Display only |
| Services | `/settings/services` | Service catalog (prices, categories) | Service | Create, edit, delete |
| Treatment locations | `/settings/treatment-locations` | Hospital/clinic locations | TreatmentLocation | Create, edit, delete |

### 1.12 Removed (dormant code)

| Screen | URL | Status | Notes |
|--------|-----|--------|-------|
| ~~Media Library~~ | `/media-library` | **Removed (F-HIGH-35)** | Code path exists in `src/app/(protected)/media-library/page.tsx` but not linked from sidebar. Attachments live on case detail (tab 8). |

---

## 2. Navigation Hierarchy

Three levels from global navigation to detail content.

### 2.1 Level 1 — Global navigation (sidebar + topbar)

The sidebar is the primary navigation surface. Every protected page is reachable from the sidebar. The topbar provides cross-cutting functions (notifications, search, user menu).

| Level 1 | Items | Source |
|---------|-------|--------|
| Sidebar main | 8 items (Dashboard → Reports) | `MENU_ITEMS` in sidebar.tsx |
| Sidebar settings group | 4 items (Users, Roles, Services, Treatment locations) | `SETTINGS_SUB_ITEMS` in sidebar.tsx |
| Sidebar bottom | 2 items (Notifications, Audit logs) | `BOTTOM_ITEMS` in sidebar.tsx |
| Topbar right | 3 items (Notification bell, Dev switcher, User menu) | topbar.tsx |

### 2.2 Level 2 — Module pages (list + create)

Each module has at least one list page and optionally a create page.

| Level 2 | Pages | Interaction pattern |
|---------|-------|---------------------|
| Customer module | List (`/customers`) + Create (`/customers/new`) | List is primary; Create is a new route |
| Case module | List (`/cases`) + Create (`/cases/new`) | List is primary; Create is a new route |
| Payment module | List (`/payments`) + Create (`/payments/new`) | List is primary; Create is a new route |
| Calendar | Single page (`/calendar`) | Week/month view toggle; create is a modal |
| Tasks | Single page (`/tasks`) | Inline create form |
| Follow-ups | Single page (`/followups`) | Inline sections |
| Reports | Single page (`/reports`) | Tabbed (Revenue/Pipeline/Customer) |
| Notifications | Single page (`/notifications`) | Tabbed (All/Unread/Read) |
| Audit logs | Single page (`/audit-logs`) | Filterable list |
| Settings | 4 sub-pages (each has its own route) | Dialog-based create/edit |

### 2.3 Level 3 — Detail pages (tabs)

Detail pages use tabs to organize related content. Tabs are local `useState` today; proposed to become URL-synced via `?tab=`.

| Detail | Tabs | Depth |
|--------|------|-------|
| `/customers/[id]` | Thông tin · Lịch sử ca · Timeline · Tài liệu | 3 levels deep from dashboard |
| `/cases/[id]` | Thông tin · Ca phẫu thuật · Thanh toán · Checklist · Đồng thuận · Bệnh viện · Hậu phẫu · Tài liệu | 3 levels deep from dashboard |

### 2.4 Max depth constraint (N5)

**2 clicks maximum from dashboard to any detail.** Exception: create pages are 2 clicks from dashboard via module list CTA.

```
/dashboard → /cases → /cases/[id]            (2 clicks to detail, 3 clicks from root)
/dashboard → /cases/new                       (2 clicks, no detail needed)
/dashboard → /customers/[id]?tab=cases        (2 clicks if notification deep-links directly)
```

---

## 3. Tab Architecture

### 3.1 Case detail — 8 tabs (per DESIGN_DIRECTION §9.1)

| # | Key | Vietnamese | Content blocks | Phase | Role access |
|---|-----|-----------|----------------|------:|-------------|
| 1 | `info` | Thông tin | Next-owner banner, Medical alert banner, Status badge + transition buttons, Pre-procedure checklist, Bill summary, Staff assignment, Case details | — | All case-accessible roles |
| 2 | `procedure` | Ca phẫu thuật | Procedure details, dates (expected + actual), Location, Pre-procedure clinical checklist | — | Same |
| 3 | `payments` | Thanh toán | Bill breakdown, Payment list, Refund history, Create payment CTA | — | `payments:read` roles |
| 4 | `checklist` | Checklist | Pre-hospital checklist, Pre-procedure checklist, Semantic color progress bars | 7 | All case-accessible roles |
| 5 | `consent` | Đồng thuận | 4 consent types, Status workflow (pending → granted/denied/revoked), Signed document requirement | 7 | `consents:read` roles |
| 6 | `hospital` | Bệnh viện | Hospital coordination toggles, Coordinator assignment | 7 | coordinator/cso/admin only |
| 7 | `postop` | Hậu phẫu | D1/D3/D7/D14/D30/D90 followup trail, Completion rate ring-stat | — | `followups:read` roles |
| 8 | `attachments` | Tài liệu | Drag-and-drop upload, Visibility control (internal/case_team/customer/public_marketing), Consent gate, Per-type filter | — | `attachments:read` roles |

**Mobile (F-MED-13):** On `< sm`, tabs 1–4 show as icon-only (always visible). Tabs 5–8 collapse into a "More" overflow menu.

### 3.2 Customer detail — 4 tabs

| # | Key | Vietnamese | Content blocks |
|---|-----|-----------|----------------|
| 1 | `info` | Thông tin | Customer form (read-only with edit CTA), Sensitive fields (RBAC-gated), CCCD fields, Privacy level badge |
| 2 | `cases` | Lịch sử ca | Case history table (linked to `/cases/[id]`), Bill summary per case |
| 3 | `followups` | Theo dõi sau PT | Followup trail (linked to `/cases/[id]?tab=postop`), D1 completion status |
| 4 | `consent` | Đồng thuận | Consent records for this customer across all cases |
| 5 | `timeline` | Timeline | **Placeholder** ("Đang phát triển") — deferred per F-MED-08 |

### 3.3 Reports — 3 tabs

| # | Key | Vietnamese | Charts |
|---|-----|-----------|--------|
| 1 | `revenue` | Doanh thu | Revenue trend (Line), Payment method (Pie), 4 stat cards (confirmed total, pending total, average per case) |
| 2 | `pipeline` | Pipeline | 5-stage funnel, Status bar chart, Category bar chart |
| 3 | `customer` | Khách hàng | Source (Pie), Privacy level (Pie), New customers per month (Bar) |

### 3.4 Settings — no tabs (sub-pages)

Each settings page is a standalone route:
- `/settings/users` — UsersTable + CreateUserDialog + EditUserDialog
- `/settings/roles` — RolesTable (read-only)
- `/settings/services` — ServiceListTable + ServiceForm
- `/settings/treatment-locations` — LocationListTable + LocationForm

---

## 4. Search & Filter Strategy

### 4.1 Per-module search capabilities

| Module | Search input | Debounced? | Filters | Current phase |
|--------|-------------|:----------:|---------|:------------:|
| `/customers` | Name + phone (`SearchInput`) | Yes (300ms) | — | Phase 2 |
| `/cases` | Case code + customer name | Yes | Status (chips/Select) | Phase 3 |
| `/payments` | (none — F-MED-24 deferred) | — | Status, method, date range | Phase 5 |
| `/calendar` | (none) | — | Week/month toggle | Phase 3 |
| `/followups` | (none) | — | Day (D1–D90), status, overdue | Phase 4 |
| `/reports` | — | — | Date range pills (3/6/12/all months) | Phase 5 |
| `/notifications` | (none) | — | Read/unread toggle | Phase 4 |
| `/audit-logs` | — | — | Entity type, action, actor | Phase 4 |
| `/settings/users` | Name + email | Yes | — | Phase 1 |

### 4.2 Filter UI patterns

| Viewport | Pattern | Example |
|----------|---------|---------|
| `md+` (desktop) | Chip-based multi-select | Case status filter chips: `Draft`, `Scheduled`, etc. |
| `< md` (mobile) | `<Select>` dropdown | Case status: single Select |
| `md+` (desktop) | Pill buttons | Report date range: `3 tháng` / `6 tháng` / `12 tháng` / `Tất cả` |
| Both | Search input (top of list) | Debounced `<SearchInput>` with clear button |

### 4.3 Search UX rules (from DESIGN_DIRECTION §5)

- **U4: Search-first on lists above 20 items.** All list pages expose a debounced search input by default.
- **M9: Search is always visible on list pages on mobile.** No hidden "search" button behind an icon.
- **F-MED-06: Status filter chips on desktop, `<Select>` on mobile.** No horizontal overflow of chips.
- **F-HIGH-18: Reports date filter refetches.** Active filter pills with X icons + "Xóa tất cả bộ lọc" button.

---

## 5. Cross-Module Linking

### 5.1 Complete link inventory

Every `→` link between modules in the application, organized by source screen.

| Source | Link text / element | Target | Condition |
|--------|---------------------|--------|-----------|
| **Dashboard** | Stat card: "Ca đang xử lý" | `/cases` | Click card (Phase 6) |
| **Dashboard** | "Báo cáo nhanh" card | `/cases?status=...` | Click card |
| **Dashboard** | "Hoạt động gần đây" row | `/cases/[id]` | Click case row |
| **Dashboard** | "Hoạt động gần đây" row | `/customers/[id]` | Click customer row |
| **Customer list** | Customer row | `/customers/[id]` | Click row |
| **Customer list** | "Tạo khách hàng" button | `/customers/new` | Click button |
| **Customer detail** | "Lịch sử ca" tab | `/cases/[id]` | Click case row |
| **Customer detail** | "Theo dõi sau PT" tab | `/cases/[id]?tab=postop` | Click followup row |
| **Customer detail** | "Sửa thông tin" | (modal) | Click button |
| **Case list** | Case row | `/cases/[id]` | Click row |
| **Case list** | "Tạo ca mới" button | `/cases/new` | Click button |
| **Case detail** | Customer name in header | `/customers/[customerId]` | Click name |
| **Case detail** | "Thanh toán" tab | (in-tab) | Click tab |
| **Case detail** | "Tạo thanh toán" button | `/payments/new?caseId=...` | Click button |
| **Case detail** | Staff assignment → user | `/settings/users` (if admin) | Click staff name |
| **Payment list** | Case code column | `/cases/[caseId]` | Click case |
| **Payment list** | Customer name column | `/customers/[customerId]` | Click customer |
| **Payment create** | Case search-and-select | `/cases/[id]` | Select case |
| **Calendar** | Event card | `/cases/[caseId]?tab=procedure` | Click event |
| **Calendar** | Side panel "Xem ca" button | `/cases/[caseId]` | Click button |
| **Calendar** | Side panel customer phone | `tel:+...` | Click call button |
| **Followups** | Followup row | `/cases/[caseId]?tab=postop` | Click followup |
| **Reports** | Revenue trend chart | `/payments` | Click chart point |
| **Reports** | Pipeline funnel stage | `/cases?status=...` | Click funnel segment |
| **Notifications** | Notification row | `/cases/[id]?tab=...` | Click notification (proposed) |
| **Notifications** | Notification row | `/customers/[id]` | Click notification (if caseId absent) |
| **Topbar bell** | Notification in dropdown | `/cases/[id]?tab=...` | Click notification (proposed) |
| **Topbar bell** | "Xem tất cả thông báo" | `/notifications` | Click link |
| **Topbar** | Swan logo | `/dashboard` | Click logo |
| **Sidebar** | Any menu item | `/module` | Click item |
| **Sidebar** | Settings sub-item | `/settings/sub` | Click item |
| **Any page** | Back link / breadcrumb | Parent list page | Click back |

### 5.2 Cross-reference patterns

| Pattern | Example | Notes |
|---------|---------|-------|
| Entity → parent entity | Case detail → Customer header | Click customer name |
| Entity → children | Customer detail → Case list | "Lịch sử ca" tab |
| Entity → related | Case detail → Payment list | "Thanh toán" tab |
| Notification → entity | Notification → Case detail | `router.push('/cases/[id]')` |
| Dashboard → filtered list | Stat card → Case list with status filter | Proposed (Phase 6) |
| Report chart → data source | Revenue trend → Payment list | Click chart point (Phase 8) |
| Audit log → entity | Audit log entry → Case or Customer | Entity link in log |

---

## 6. URL Structure

### 6.1 URL taxonomy

```
/module                    → List page
/module/new                → Create page
/module/[id]               → Detail page (default tab)
/module/[id]?tab=X         → Detail page with specific tab
/module?status=X           → List with filter
/module?search=X           → List with search (not yet implemented)
/module?created_this_month=true → List with time filter (proposed)
```

### 6.2 Query parameters reference

| Parameter | Type | Used on | Example | Phase |
|-----------|------|---------|---------|------:|
| `tab` | `string` | `/cases/[id]`, `/customers/[id]`, `/reports` | `?tab=payments` | 7 (proposed) |
| `status` | `string` | `/cases` | `?status=medical_alert` | 6 (proposed) |
| `day` | `string` | `/followups` | `?day=D1` | 6 (proposed) |
| `lab_overdue` | `boolean` | `/cases` | `?lab_overdue=true` | 6 (proposed) |
| `range` | `string` | `/reports`, `/followups` | `?range=this_month` | 5 (reports), 6 (proposed followups) |
| `service` | `string` | `/reports` | `?service=nose` | 8 (proposed) |
| `caseId` | `string` | `/payments/new` | `?caseId=abc123` | Phase 2 |

### 6.3 URL encoding rules

- Query parameters use snake_case (`created_this_month`, `lab_overdue`)
- Tab values use kebab-case (`post-op` → `postop`, `treatment-location` → `treatment-location`)
- Status values match `CaseStatus` union exactly (e.g., `waiting_payment_confirmation`)
- Vietnamese characters are URL-encoded automatically by Next.js `router.push()`
- Hash fragments (`#section`) are NOT used; query params for all state

---

## 7. Empty States & Error States

### 7.1 Empty states per page

| Page | Empty state message | CTA | Priority |
|------|---------------------|-----|----------|
| `/customers` | "Chưa có khách hàng" | "Tạo khách hàng đầu tiên" (→ `/customers/new`) | Medium |
| `/cases` | "Chưa có CASE" | "Tạo CASE đầu tiên" (→ `/cases/new`) | Medium |
| `/payments` | "Chưa có phiếu thanh toán" | "Tạo phiếu thanh toán" (→ `/payments/new`) | Medium |
| `/calendar` | "Không có lịch hẹn trong tuần này" | "Tạo lịch hẹn" (→ modal) | Low |
| `/tasks` | "Chưa có công việc" | "Tạo công việc" (→ inline form) | Low |
| `/followups` | "Không có lịch theo dõi" | — (auto-created on case completion) | Medium |
| `/reports` | "Chưa đủ dữ liệu để hiển thị báo cáo" | — (no CTA) | Low |
| `/notifications` | "Không có thông báo" | — (no CTA) | Low |
| `/audit-logs` | "Chưa có nhật ký" | — (no CTA) | Low |
| `/settings/users` | "Chưa có người dùng" | "Tạo người dùng" (→ modal) | High |
| `/settings/services` | "Chưa có dịch vụ" | "Thêm dịch vụ" (→ modal) | High |
| `/settings/treatment-locations` | "Chưa có nơi thực hiện" | "Thêm nơi thực hiện" (→ modal) | High |

### 7.2 Error states per page

| Page | Error state | User action |
|------|-------------|-------------|
| Any list page | "Không thể tải dữ liệu" + retry button | Click retry |
| Detail page (404) | "Không tìm thấy [khách hàng/CA/thanh toán]" + back button | Click back |
| Detail page (loading) | Skeleton components (matching page structure) | Wait |
| Create form (validation) | Inline errors under each field + toast | Fix fields and resubmit |
| API failure (network) | Toast: "Có lỗi xảy ra. Vui lòng thử lại." | Retry |
| Permission denied | Redirect to `/dashboard` with toast: "Bạn không có quyền truy cập" | — |
| Deep-link (invalid tab) | Fall back to default tab (`info`) | — |

### 7.3 Loading states

| Page | Loading state |
|------|---------------|
| Any list page | Skeleton rows matching DataTable layout |
| Detail page | Skeleton matching header + tab bar + first tab content |
| Dashboard | Skeleton stat cards + skeleton chart cards (F-MED-07 deferred) |
| Reports | ChartSkeleton + StatCardsSkeleton |
| Calendar | Skeleton week grid |

---

## Appendix A — Sources Cross-Reference

| IA concept | Source file | Current state |
|-----------|-------------|---------------|
| Case detail tabs (8) | `src/app/(protected)/cases/[id]/page.tsx` | Local `useState`, not URL-synced |
| Customer detail tabs (5) | `src/app/(protected)/customers/[id]/page.tsx` | Local `useState`, not URL-synced |
| Sidebar items (9+4+2) | `src/components/layout/sidebar.tsx` | Duplicated in mobile-nav.tsx |
| Topbar notification bell | `src/components/layout/topbar.tsx` | Polls every 60s, dropdown with 10 items |
| Dashboard stat cards | `src/components/dashboard/stat-cards.tsx` | Display-only, not clickable |
| Report tabs (3) | `src/app/(protected)/reports/page.tsx` | Uses shared `<Tabs>` component |
| Search input | `src/components/ui/search-input.tsx` | Debounced, clear button |
| Empty states | Various page components | Inconsistent (some have CTAs, some don't) |
| Loading skeletons | `src/components/reports/loading-skeleton.tsx` | Only in reports; other pages inline |
| Page titles | `src/config/constants.ts` (`PAGE_TITLES`) | Missing titles for create/detail routes |

---

*End of Information Architecture.*
