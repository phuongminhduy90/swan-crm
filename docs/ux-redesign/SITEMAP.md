# Swan Case CRM — Sitemap

- **Date:** 2026-06-29
- **Project context:** [`CLAUDE.md`](../../CLAUDE.md) · [`.claude/context/SWAN_CONTEXT.md`](../../.claude/context/SWAN_CONTEXT.md)
- **Related docs:** [`UX_DECISION_DOCUMENT.md`](UX_DECISION_DOCUMENT.md) · [`DESIGN_DIRECTION.md`](DESIGN_DIRECTION.md) · [`INFORMATION_ARCHITECTURE.md`](INFORMATION_ARCHITECTURE.md)
- **Owners:** `information-architect`, `ux-designer`, `medical-workflow-expert`
- **Scope:** Every page route in `src/app/(protected)/`, every menu item, every role, every notification deep-link

This document is the **single source of truth** for navigation and routing. It covers 11 areas: application sitemap, information architecture, desktop/mobile navigation flows, route ownership, permission matrix, recommended sidebar structure, dashboard entry points, case workflow map, entity relationships, and notification deep-link strategy.

**Non-goals:** No new features. No source code changes. No reopening of rejected findings from `UX_DECISION_DOCUMENT.md` §5.

---

## 1. Application Sitemap

Full tree of all 21 protected pages, 6 settings sub-pages, public auth routes, and major API surfaces. Vietnamese labels in parentheses.

```
swan-crm/
│
├── (public)                              # Public, no auth required
│   ├── /login                            # "Đăng nhập" — Firebase Auth form (dev: bypassed)
│   └── /                                 # Root redirect → /dashboard (or /login)
│
├── (protected)/                          # Auth-gated, wrapped by AppShell (Sidebar + Topbar + main)
│   │
│   ├── /dashboard                        # "Bảng điều khiển" — stat cards + Báo cáo nhanh + Hoạt động gần đây
│   │                                     # Permission: dashboard:read
│   │                                     # Primary entry point for all roles
│   │
│   ├── /customers/                       # "Khách hàng" module
│   │   ├── /customers                    # List — DataTable, search, create button
│   │   ├── /customers/new                # Create — modal (desktop) / full-screen sheet (mobile)
│   │   └── /customers/[id]               # Detail — 4 tabs: Thông tin · Lịch sử ca · Timeline · Tài liệu
│   │                                     # Permission: customers:read
│   │
│   ├── /cases/                           # "Hồ sơ CASE" module (clinical heart)
│   │   ├── /cases                        # List — DataTable, status filter (chips/select)
│   │   ├── /cases/new                    # Create — multi-section form
│   │   └── /cases/[id]                   # Detail — 8 tabs (see §9 below)
│   │                                     # Permission: cases:read
│   │
│   ├── /payments/                        # "Thanh toán" module
│   │   ├── /payments                     # List — DataTable, status/method/date filters
│   │   └── /payments/new                 # Create — form with caseId selector
│   │                                     # Permission: payments:read
│   │
│   ├── /calendar/                        # "Lịch hẹn" — week/month view of appointments
│   │                                     # Permission: calendar:read
│   │
│   ├── /tasks/                           # "Công việc" — task list
│   │                                     # Permission: tasks:read (F-LOW-05 pending audit)
│   │
│   ├── /followups/                       # "Theo dõi sau PT" — D1/D3/D7/D14/D30/D90 dashboard
│   │                                     # Permission: followups:read
│   │
│   ├── /reports/                         # "Báo cáo" — 3 tabs: Revenue · Pipeline · Customer
│   │                                     # Permission: reports:read
│   │
│   ├── /notifications/                   # "Thông báo" — full notification center
│   │                                     # Permission: notifications:read
│   │
│   ├── /audit-logs/                      # "Nhật ký" — audit trail with diff viewer
│   │                                     # Permission: audit:read
│   │
│   └── /settings/                        # "Cài đặt" — admin sub-routes (sidebar group)
│       ├── /settings/users               # User CRUD
│       ├── /settings/roles               # Role/permission matrix
│       ├── /settings/services            # Service catalog
│       └── /settings/treatment-locations # Treatment locations
│                                       # Permissions: users:read / roles:read / settings:read
│
├── (REMOVED) /media-library              # F-HIGH-35: removed from sidebar. Attachments
│                                         # live on case detail (tab 8). Code path dormant.
│
└── api/                                  # REST API surfaces (partial list)
    ├── /api/users/                       # GET / POST / PATCH
    ├── /api/customers/                   # CRUD + phone-uniqueness check
    ├── /api/cases/                       # CRUD + /api/cases/[id]/status (role-gated)
    ├── /api/payments/                    # CRUD + /api/payments/[id]/confirm
    ├── /api/attachments/                 # Upload + visibility change (consent-gated)
    ├── /api/consents/                    # CRUD + status transitions
    ├── /api/notifications/               # GET / PATCH (mark read)
    ├── /api/followups/                   # CRUD + auto-create on procedure_completed
    └── /api/audit-logs/                  # GET (filtered query)
```

### 1.1 URL taxonomy

| Pattern | Example | Purpose |
|---------|---------|---------|
| `/module` | `/cases` | List page |
| `/module/new` | `/cases/new` | Create page (always a separate route for create) |
| `/module/[id]` | `/cases/abc123` | Detail page |
| `/module/[id]?tab=` | `/cases/abc123?tab=payments` | Detail with specific tab (proposed, F-HIGH-10) |
| `/module?status=` | `/cases?status=medical_alert` | Filtered list (proposed for dashboard links) |
| `/settings/sub` | `/settings/users` | Settings sub-page (no create route — uses dialog) |

---

## 2. Information Architecture

### 2.1 The 10 core case questions (from `SWAN_CONTEXT.md`)

Every screen should answer at least one of these. If it doesn't, the screen is scope creep (per P10).

| # | Question | Primary screen |
|---|----------|----------------|
| Q1 | Who is this customer? | `/customers/[id]` (Thông tin tab) |
| Q2 | What service are they getting? | `/cases/[id]` (Thông tin tab) |
| Q3 | What's the current status? | `/cases/[id]` (status badge) + `/cases?status=...` (filtered list) |
| Q4 | How much has been paid vs owed? | `/cases/[id]` (Thanh toán tab) + Bill summary |
| Q5 | What documents / consent exist? | `/cases/[id]` (Đồng thuận / Tài liệu tabs) |
| Q6 | Where is the procedure happening? | `/cases/[id]` (Thông tin tab — treatment location) |
| Q7 | When is the procedure? | `/calendar` + case detail dates |
| Q8 | Who is the medical staff? | `/cases/[id]` (Thông tin tab — StaffAssignment) |
| Q9 | What needs to happen next? | `/dashboard` (action queue) + `/cases/[id]` (next-owner banner) |
| Q10 | What's the post-op status? | `/followups` + case detail (Hậu phẫu tab) |

### 2.2 Entity hierarchy

```
Customer (1) ─────────────── (N) Case (1) ───────────── (N) CaseService
  │                                │
  │ id (customerCode)              │ id (caseCode)
  │ fullName, phone                │ status (28-state pipeline)
  │ CCCD (sensitive)               │ totalBillAfterDiscount, amountPaid
  │ privacyLevel                   │ expectedLabDate, expectedProcedureDate
  │ deletionRequested*             │ actualProcedureDate
  │                                │
  │                                ├── (N) Payment
  │                                │     status: pending|confirmed|rejected
  │                                │     paymentType: deposit|partial|full|refund
  │                                │
  │                                ├── (N) Followup (auto-created on procedure_completed)
  │                                │     D1, D3, D7, D14, D30, D90
  │                                │
  │                                ├── (N) Consent (4 types)
  │                                │     treatment, image_storage, marketing_usage, hospital_sharing
  │                                │
  │                                ├── (N) Attachment
  │                                │     visibility: internal|case_team|customer|public_marketing
  │                                │
  │                                └── (N) Appointment (Calendar)
  │
  └── (cross-reference)
       CustomerDetail "Lịch sử ca" tab → Case
       CaseDetail header → Customer
       Notification.caseId → Case
       Notification.customerId → Customer
```

### 2.3 Three-tier content model

| Tier | Examples | Visibility |
|------|----------|-----------|
| **Public (operational)** | Customer name, phone, case code, status | All roles with module access |
| **Field-restricted (sensitive)** | CCCD, address, medical/privacy notes | `SENSITIVE_FIELD_ACCESS_ROLES` / `MEDICAL_NOTE_ACCESS_ROLES` |
| **Financial** | Bill amounts, payments, refunds | `PAYMENT_DATA_ACCESS_ROLES` (admin/ceo/cso/master_sales/accountant) |

---

## 3. Desktop Navigation Flow

### 3.1 The 2-click rule (N5)

Dashboard is home. Maximum path depth is 2 clicks from dashboard to any detail.

```
/dashboard (1 click) → /cases (2 clicks) → /cases/[id] (3 clicks from root)
                                    ↓
                              /cases/[id]?tab=payments (3 clicks, lands on right tab)
```

**Exception:** New pages (`/cases/new`, `/customers/new`, `/payments/new`) are 2 clicks from dashboard via the module list's primary CTA.

### 3.2 Desktop layout

```
┌──────────────────────────────────────────────────────────┐
│ Topbar [Swan logo] [Page Title]      [Dev Switcher] [🔔] [👤] │
├────────────┬─────────────────────────────────────────────┤
│ Sidebar    │                                              │
│            │  Main content area                           │
│ ▸ Dashboard│  (scrollable)                                │
│ ▸ Khách hàng│                                             │
│ ▸ Hồ sơ CA│                                              │
│ ▸ Thanh toán│                                             │
│ ▸ Lịch hẹn │                                              │
│ ▸ Công việc│                                              │
│ ▸ Theo dõi │                                              │
│ ▸ Báo cáo  │                                              │
│            │                                              │
│ ────────── │                                              │
│ Cài đặt ▾  │                                              │
│  · Users   │                                              │
│  · Roles   │                                              │
│  · Services│                                              │
│  · Nơi PT   │                                              │
│ ────────── │                                              │
│ ▸ Thông báo│                                              │
│ ▸ Nhật ký  │                                              │
│            │                                              │
│ [Avatar]   │                                              │
└────────────┴─────────────────────────────────────────────┘
```

### 3.3 Topbar global actions

| Element | Action | Route | Permission |
|---------|--------|-------|------------|
| Swan logo | Home | `/dashboard` | any authenticated |
| Page title | (display) | — | — |
| Dev role switcher | Switch mock user | (no nav) | `isDevMode` only |
| Notification bell | Open dropdown | `/notifications` | `notifications:read` |
| User avatar | Open menu | (no nav) | any authenticated |
| User menu → Profile | (toast "Đang phát triển") | — | F-HIGH-01 |
| User menu → Đăng xuất | Sign out | `/login` | any |

### 3.4 Topbar notification bell → entity deep-link

```
Notification bell (click)
   ↓
Open dropdown (10 latest, polled every 60s)
   ↓
Click notification
   ↓
topbar.handleNotificationClick(n)
   ↓
if (n.caseId)     router.push(`/cases/${n.caseId}`)             [default tab: info]
else if (n.customerId) router.push(`/customers/${n.customerId}`) [default tab: info]
   ↓
PATCH /api/notifications/[id]/read (mark as read)
```

**Limitation (current):** No `?tab=` param. All events land on default tab. See §11 for proposed fix.

### 3.5 Sidebar interaction

- **Active state:** accent left border (aqua) on the current module. Text + icon both highlighted.
- **Collapse:** sidebar collapses to icon-only (60px wide) via chevron toggle. State is per-session, not persisted.
- **Settings group:** expanded by default if user has any `settings:*` permission.
- **Bottom items:** Notifications and Audit logs are always rendered if the user has the corresponding read permission.

---

## 4. Mobile Navigation Flow

### 4.1 Mobile layout (lg:hidden, < 1024px)

```
┌──────────────────────────────────────────┐
│ [☰] Swan logo            [🔔] [👤]       │ ← Topbar (sticky, h-16)
├──────────────────────────────────────────┤
│                                          │
│  Main content (full width)               │
│  (scrollable, padding-bottom for FAB)    │
│                                          │
│                                          │
└──────────────────────────────────────────┘

Drawer (slides in from left when ☰ tapped):
┌─────────────────────┐
│ [Swan logo]    [✕]  │
├─────────────────────┤
│ ▸ Dashboard         │
│ ▸ Khách hàng        │
│ ▸ Hồ sơ CASE        │
│ ▸ Thanh toán        │
│ ▸ Lịch hẹn          │
│ ▸ Công việc         │
│ ▸ Theo dõi sau PT   │
│ ▸ Báo cáo           │
│ ─────────────────── │
│ Cài đặt ▾           │
│  · Users            │
│  · Roles            │
│  · Services         │
│  · Nơi PT            │
│ ─────────────────── │
│ ▸ Thông báo         │
│ ▸ Nhật ký           │
├─────────────────────┤
│ [Avatar] [Name]      │
└─────────────────────┘
```

### 4.2 Mobile rules (M1–M10 from DESIGN_DIRECTION.md §6)

| Rule | Implementation |
|------|----------------|
| M1: No `h-screen` on AppShell | `min-h-screen` pattern (F-CRIT-01) |
| M2: Touch targets ≥ 44×44px | All buttons, chips, list rows |
| M3: Tabs collapse to icon-only on `< sm` | Case detail tabs use Lucide icons + "More" overflow for tabs 5–8 (F-MED-13) |
| M4: Filter chips → Select on `< md` | Case list status filter (F-MED-06) |
| M5: No horizontal scroll at 360px | Hard constraint (F-CRIT-01) |
| M6: Sticky action bar on detail pages | Primary action (transition, confirm) always reachable |
| M7: Modals → full-screen sheets on `< sm` | Customer create, case create (F-MED-03 follow-up) |
| M8: Single-column forms on mobile | All multi-column forms collapse under `md` |
| M9: Search always visible on list pages | No "search" icon button behind a hamburger |
| M10: Notification bell expands inline | Instead of popover (F-HIGH-03) |

### 4.3 Mobile notification flow

```
Topbar bell (tap on mobile)
   ↓
Inline expansion below topbar (not a popover)
   ↓
Scrollable list (paginates by "Xem thêm")
   ↓
Tap notification → same deep-link as desktop
   ↓
Drawer auto-closes (if open), notification marked read
```

### 4.4 Touch-friendly patterns

| Element | Mobile behavior | Desktop behavior |
|---------|-----------------|------------------|
| Topbar profile | Avatar only → bottom sheet | Avatar + name + dropdown |
| Status filter (case list) | `<Select>` | Chips |
| Tabs (case detail) | Icon-only + "More" | Text labels |
| Action bar | Sticky bottom | Inline at form top |
| Sidebar | Hidden, MobileNav drawer | Visible, collapsible |
| DataTable | Stacked cards or compact rows | Full table |
| Modal | Full-screen sheet | Centered card |

---

## 5. Route Ownership by Role

Each of the 12 roles has a **primary** set of routes (where they spend 80% of their time) and **secondary** routes (read-only or occasional access).

### 5.1 Primary vs secondary

| Role | Primary routes (daily) | Secondary routes (occasional) | Does NOT access |
|------|------------------------|------------------------------|-----------------|
| **admin** | All 21 routes | — | — |
| **ceo** | `/dashboard`, `/reports`, `/customers` (read), `/cases` (read), `/audit-logs` | `/payments`, `/notifications` | `/settings/*` (write), `/calendar` (limited) |
| **cso** | `/dashboard`, `/cases`, `/customers`, `/calendar`, `/payments` (approve), `/reports` | `/settings/*`, `/audit-logs`, `/notifications` | — |
| **master_sales** | `/customers`, `/cases`, `/payments`, `/calendar` | `/dashboard`, `/reports`, `/notifications` | `/settings/*`, `/audit-logs` |
| **sales_online** | `/customers`, `/cases`, `/calendar` | `/dashboard`, `/payments` (create only) | `/settings/*`, `/audit-logs`, `/reports` |
| **sales_offline** | `/customers`, `/cases`, `/calendar` | `/dashboard`, `/payments` (create only) | `/settings/*`, `/audit-logs`, `/reports` |
| **accountant** | `/payments`, `/reports` | `/dashboard`, `/cases` (read), `/customers` (read) | `/settings/*`, `/calendar`, `/tasks`, `/followups` |
| **doctor** | `/cases`, `/calendar`, `/followups` | `/dashboard`, `/customers` (read) | `/payments`, `/settings/*`, `/audit-logs`, `/reports` |
| **nurse** | `/cases` (read), `/calendar`, `/followups`, `/tasks` | `/dashboard` | `/payments`, `/customers` (write), `/settings/*`, `/reports` |
| **coordinator** | `/cases`, `/calendar`, `/tasks`, `/followups` | `/customers`, `/dashboard` | `/payments`, `/settings/*`, `/reports`, `/audit-logs` |
| **cskh_postop** | `/followups`, `/tasks` | `/dashboard`, `/cases` (read), `/notifications` | `/payments`, `/customers` (write), `/settings/*`, `/reports`, `/calendar` |
| **media** | `/cases` (read, attachments only) | `/dashboard`, `/notifications` | `/customers` (no), `/payments`, `/settings/*`, `/calendar`, `/tasks`, `/followups` |

### 5.2 Route visit frequency (rough, from role interviews and mock data distribution)

| Route | High-frequency roles | Medium-frequency | Low-frequency |
|-------|----------------------|------------------|---------------|
| `/dashboard` | all 12 | — | — |
| `/customers` | sales, cso, master_sales, ceo, admin | coordinator, doctor (read) | accountant, nurse, media |
| `/cases` | cso, master_sales, doctor, nurse, coordinator, sales | ceo, accountant, admin | media, cskh_postop |
| `/payments` | accountant, cso, master_sales, sales | ceo, admin | doctor, nurse, media |
| `/calendar` | coordinator, cso, sales, doctor, nurse | master_sales | accountant, media |
| `/tasks` | coordinator, nurse, cskh_postop | cso | accountant, ceo, media |
| `/followups` | cskh_postop, nurse, doctor | cso, coordinator | sales, ceo |
| `/reports` | ceo, cso, accountant | admin | all others |
| `/notifications` | all 12 | — | — |
| `/audit-logs` | ceo, cso, admin | — | all others |
| `/settings/*` | admin | cso (read), ceo (read) | all others |

### 5.3 Sidebar visibility per role (current)

| Menu item | admin | ceo | cso | master_sales | sales_online | sales_offline | accountant | doctor | nurse | coordinator | cskh_postop | media |
|-----------|:-----:|:---:|:---:|:------------:|:------------:|:-------------:|:----------:|:------:|:-----:|:-----------:|:----------:|:-----:|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Khách hàng | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Hồ sơ CASE | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Thanh toán | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Lịch hẹn | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Công việc | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Theo dõi sau PT | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| ~~Media Library~~ | — | — | — | — | — | — | — | — | — | — | — | — |
| Báo cáo | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Cài đặt (group) | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Thông báo | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Nhật ký | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 6. Permission Matrix

### 6.1 Route-level (35 permissions × 12 roles)

| Permission | admin | ceo | cso | master_sales | sales_online | sales_offline | accountant | doctor | nurse | coordinator | cskh_postop | media |
|------------|:-----:|:---:|:---:|:------------:|:------------:|:-------------:|:----------:|:------:|:-----:|:-----------:|:----------:|:-----:|
| dashboard:read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| customers:read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| customers:write | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| customers:delete | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| cases:read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| cases:write | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| cases:assign | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| payments:read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| payments:write | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| payments:approve | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| calendar:read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| calendar:write | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| tasks:read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| tasks:write | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| tasks:assign | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| followups:read | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| followups:write | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| media:read | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| media:write | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| reports:read | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| reports:export | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| notifications:read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| notifications:write | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| audit:read | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| audit:write | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| users:read | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| users:write | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| roles:read | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| roles:write | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| settings:read | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| settings:write | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| attachments:read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| attachments:write | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| consents:read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| consents:write | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |

### 6.2 Field-level access (from `src/constants/permissions.ts`)

These are NOT route-level. They control which fields render on existing pages.

| Constant | Roles | Fields protected |
|----------|-------|------------------|
| `SENSITIVE_FIELD_ACCESS_ROLES` | admin, ceo, cso, master_sales, sales_online, sales_offline, coordinator, doctor | `nationalIdNumber`, `nationalIdIssueDate`, `nationalIdIssuePlace`, `address` |
| `MEDICAL_NOTE_ACCESS_ROLES` | admin, ceo, cso, master_sales, sales_online, sales_offline, doctor, nurse, coordinator | `medicalNote`, `privacyNote` |
| `PAYMENT_DATA_ACCESS_ROLES` | admin, ceo, cso, master_sales, accountant | All bill + payment fields |
| `MEDIA_APPROVED_ACCESS_ROLES` | admin, ceo, cso, media | `public_marketing` attachments |
| `CHANGE_VISIBILITY_ROLES` | admin, cso | Attachment visibility change (consent-gated) |
| `PAYMENT_CONFIRM_ROLES` | admin, accountant | Payment confirm action (F-CRIT-06: accountant must not confirm own) |
| `PAYMENT_CREATE_ROLES` | admin, cso, master_sales, sales_online, sales_offline, accountant | Payment create |
| `CASE_STATUS_CHANGE_ROLES` | admin, cso, master_sales, coordinator, doctor, nurse, cskh_postop | Case status transition (server-enforced, F-CRIT-05) |
| `CASE_CANCEL_ROLES` | admin, ceo, cso, master_sales | Case cancel / postpone (excludes nurse, cskh_postop) |
| `CASE_MEDICAL_DECISION_ROLES` | admin, cso, doctor | `medically_approved`, `medical_alert`, `medical_alert_resolved` |
| `CASE_POSTOP_STATUS_ROLES` | admin, cso, doctor, nurse, cskh_postop, coordinator | `post_op_d1`–`post_op_d90` |
| `DELETE_APPROVE_ROLES` | admin, cso, ceo | Customer deletion approval (master_sales explicitly excluded) |

---

## 7. Recommended Sidebar Structure

### 7.1 The problem (F-HIGH-02)

Currently, `MENU_ITEMS`, `SETTINGS_SUB_ITEMS`, and `BOTTOM_ITEMS` are **duplicated** between `src/components/layout/sidebar.tsx` (desktop) and `src/components/layout/mobile-nav.tsx` (drawer). The duplication has already drifted — mobile-nav types `permission` as `string` and uses `as never` casts.

### 7.2 Proposed structure

Create **one source of truth**: `src/config/sidebar-menu.ts` plus a `useVisibleMenu` hook.

```ts
// src/config/sidebar-menu.ts
import { Home, Users, Briefcase, CreditCard, Calendar, CheckSquare,
         HeartPulse, BarChart3, Settings, UserCog, ShieldCheck,
         Stethoscope, Building2, Bell, ScrollText } from 'lucide-react';
import type { Permission } from '@/config/roles';

export interface MenuItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
  description?: string;
}

export const MENU_ITEMS: MenuItem[] = [
  { key: 'dashboard',  label: 'Bảng điều khiển', href: '/dashboard',  icon: Home,         permission: 'dashboard:read' },
  { key: 'customers',  label: 'Khách hàng',      href: '/customers',  icon: Users,        permission: 'customers:read' },
  { key: 'cases',      label: 'Hồ sơ CASE',      href: '/cases',      icon: Briefcase,    permission: 'cases:read' },
  { key: 'payments',   label: 'Thanh toán',      href: '/payments',   icon: CreditCard,   permission: 'payments:read' },
  { key: 'calendar',   label: 'Lịch hẹn',        href: '/calendar',   icon: Calendar,     permission: 'calendar:read' },
  { key: 'tasks',      label: 'Công việc',       href: '/tasks',      icon: CheckSquare,  permission: 'tasks:read' },
  { key: 'followups',  label: 'Theo dõi sau PT', href: '/followups',  icon: HeartPulse,   permission: 'followups:read' },
  { key: 'reports',    label: 'Báo cáo',         href: '/reports',    icon: BarChart3,    permission: 'reports:read' },
];

export const SETTINGS_SUB_ITEMS: MenuItem[] = [
  { key: 'users',                label: 'Người dùng',         href: '/settings/users',                icon: UserCog,     permission: 'users:read' },
  { key: 'roles',                label: 'Vai trò',            href: '/settings/roles',                icon: ShieldCheck, permission: 'roles:read' },
  { key: 'services',             label: 'Dịch vụ',            href: '/settings/services',             icon: Stethoscope, permission: 'settings:read' },
  { key: 'treatment-locations',  label: 'Nơi thực hiện',      href: '/settings/treatment-locations',  icon: Building2,   permission: 'settings:read' },
];

export const BOTTOM_ITEMS: MenuItem[] = [
  { key: 'notifications', label: 'Thông báo', href: '/notifications', icon: Bell,       permission: 'notifications:read' },
  { key: 'audit-logs',    label: 'Nhật ký',   href: '/audit-logs',    icon: ScrollText, permission: 'audit:read' },
];

export const SETTINGS_GROUP_PERMISSION: Permission = 'settings:read';
```

```ts
// src/lib/hooks/useVisibleMenu.ts
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { hasPermission } from '@/lib/auth/rb';
import { MENU_ITEMS, SETTINGS_SUB_ITEMS, BOTTOM_ITEMS, SETTINGS_GROUP_PERMISSION } from '@/config/sidebar-menu';

export function useVisibleMenu() {
  const { user } = useCurrentUser();
  const role = user?.role;

  const main = MENU_ITEMS.filter((m) => role && hasPermission(role, m.permission));
  const settings = SETTINGS_SUB_ITEMS.filter((m) => role && hasPermission(role, m.permission));
  const showSettingsGroup = role && (
    hasPermission(role, SETTINGS_GROUP_PERMISSION) ||
    hasPermission(role, 'users:read')
  );
  const bottom = BOTTOM_ITEMS.filter((m) => role && hasPermission(role, m.permission));

  return { main, settings, bottom, showSettingsGroup };
}
```

### 7.3 What changes for each component

| File | Before | After |
|------|--------|-------|
| `src/components/layout/sidebar.tsx` | Inline `MENU_ITEMS`, `SETTINGS_SUB_ITEMS`, `BOTTOM_ITEMS` | `const { main, settings, bottom, showSettingsGroup } = useVisibleMenu();` |
| `src/components/layout/mobile-nav.tsx` | Duplicated arrays + `as never` casts | Same hook call |
| `src/config/sidebar-menu.ts` | (doesn't exist) | New — single source of truth |

### 7.4 Sidebar ordering rationale

1. **Dashboard first** (N2) — home base.
2. **Customer → Case → Payment** in the natural data-flow order (Q1→Q4 in §2.1).
3. **Calendar** next — coordination surface.
4. **Tasks + Followups** — work execution.
5. **Reports** last in main — most analytical, least frequent for most roles.
6. **Settings** as expandable group — admin only.
7. **Notifications + Audit logs** at the bottom — cross-cutting, used by all roles but not navigation primary.

### 7.5 Active state logic

```ts
const isActive = (item: MenuItem) =>
  pathname === item.href || pathname.startsWith(item.href + '/');
```

- `/cases` → "Hồ sơ CASE" active
- `/cases/abc123` → "Hồ sơ CASE" active
- `/cases/abc123?tab=payments` → "Hồ sơ CASE" active (query params don't affect)
- `/settings/users` → "Cài đặt" group expanded, "Người dùng" highlighted

---

## 8. Dashboard Entry Points

### 8.1 Current dashboard (Phase 5)

```
┌─────────────────────────────────────────────────────────┐
│ Dashboard                                                │
├─────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │ Khách   │ │ CASE    │ │ Doanh   │ │ Lịch hẹn│        │  StatCards
│ │ hàng    │ │ đang xử │ │ thu     │ │ hôm nay │        │  (display-only,
│ │         │ │ lý      │ │ tháng   │ │         │        │   NOT clickable)
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
│                                                          │
│ ┌──────────────────────────┐ ┌────────────────────────┐ │
│ │ Báo cáo nhanh             │ │ Hoạt động gần đây     │ │
│ │ · CASE mới           →   │ │ · 10 latest items     │ │
│ │ · Chờ thanh toán     →   │ │   (cases + customers) │ │
│ │ · Chờ bệnh viện     →   │ │   each row → detail   │ │
│ │ · Đang theo dõi      →   │ │                       │ │
│ │ [Xem tất cả CASE →]      │ │                       │ │
│ └──────────────────────────┘ └────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Limitations:** StatCards are decorative (no `<Link>`), "Báo cáo nhanh" cards all link to unfiltered `/cases`, no role-specific queues.

### 8.2 Recommended dashboard (Phase 6/7, per DESIGN_DIRECTION.md §7)

8 ranked action queues, all clickable. Ranks 1–4 are action queues (mobile-visible without scroll). Ranks 5–8 are stat context.

| Rank | Card | Tone | Click target | Filter | Source |
|-----:|------|------|--------------|--------|--------|
| 1 | Lab quá hạn | Danger | `/cases?status=hospital_confirmed&lab_overdue=true` | Case list filtered to lab-overdue | F-CRIT-07 |
| 2 | Cần xác nhận thanh toán | Warning | `/payments?status=pending` | Payment list filtered | (Q4) |
| 3 | Cảnh báo y khoa | Danger | `/cases?status=medical_alert` | Case list filtered | F-CRIT-09 |
| 4 | Followup D1 hôm nay | Warning | `/followups?day=D1&status=pending` | Followup dashboard filtered | F-HIGH-30 |
| 5 | Doanh thu tháng này (đã xác nhận) | Info | `/reports?tab=revenue&range=this_month` | Reports with this-month range | F-HIGH-29 |
| 6 | Ca đang xử lý | Info | `/cases?status=in_procedure,checked_in,scheduled` | Active cases (not terminal) | (Q9) |
| 7 | Khách mới tháng này | Neutral | `/customers?created_this_month=true` | New customers this month | (Q1) |
| 8 | Sức khỏe hậu phẫu (D1) | Ring-stat | `/followups?range=30d` | 30-day D1 completion rate | F-HIGH-30 |

**Rules:**
- Ranks 1–4 are always visible on mobile without scrolling
- Every card has a tooltip on the number
- Every card has a click target — no decorative stats
- "Next-owner" banner appears on the dashboard for the current user, filtered by role

### 8.3 Dashboard → Module click matrix

| Card | Default route | With role-aware variant |
|------|---------------|-------------------------|
| Lab quá hạn | `/cases?status=hospital_confirmed&lab_overdue=true` | (same) |
| Cần xác nhận thanh toán | `/payments?status=pending` | If user is `accountant`, pre-select "Chờ xác nhận" filter |
| Cảnh báo y khoa | `/cases?status=medical_alert` | (same) |
| Followup D1 hôm nay | `/followups?day=D1&status=pending` | (same) |
| Doanh thu tháng này | `/reports?tab=revenue&range=this_month` | (same) |
| Ca đang xử lý | `/cases?status=in_procedure` | If user is `doctor`, pre-filter to assigned cases |
| Khách mới tháng này | `/customers?created_this_month=true` | If user is `sales_online/offline`, pre-filter to own customers |
| Sức khỏe hậu phẫu | `/followups?range=30d` | (same) |

---

## 9. Case Workflow Navigation Map

The 28-status pipeline is the spine of the case module. Each status has: (a) the primary case detail tab, (b) the next action, (c) the next owner, (d) the notification that fires on entry.

### 9.1 The 5 pipeline stages (per `getPipelineStage()`)

```
draft → confirmed → scheduled → in_procedure → post_op → (terminal)
                                                         → completed | cancelled
```

### 9.2 Status-by-status navigation map

| Status | Stage | Primary tab | Next action | Next owner | Notification fires |
|--------|-------|-------------|-------------|------------|--------------------|
| `draft` | draft | Thông tin | Fill customer info | sales | — |
| `waiting_customer_info` | draft | Thông tin | Collect customer details | sales | — |
| `waiting_payment_confirmation` | confirmed | Thanh toán | Confirm deposit | cso / accountant | `payment_pending` |
| `payment_confirmed` | confirmed | Thông tin | Assign treatment location | coordinator | `new_case_created` |
| `waiting_location_assignment` | confirmed | Thông tin | Choose hospital | coordinator | `hospital_coordination_required` |
| `waiting_hospital_confirmation` | confirmed | Thông tin | Hospital confirms slot | coordinator | `hospital_coordination_required` |
| `hospital_confirmed` | confirmed | Thông tin | Doctor review + lab order | doctor | `hospital_confirmed` |
| `waiting_doctor_review` | confirmed | Thông tin | Doctor approves | doctor | — |
| `waiting_lab_test` | confirmed | Thông tin | Lab result comes in | doctor / nurse | `lab_test_due` |
| `lab_test_done` | confirmed | Thông tin | Medically approved | doctor | — |
| `medically_approved` | confirmed | Thông tin | Schedule procedure date | coordinator | — |
| `scheduled` | scheduled | Thông tin | Send reminder | coordinator | `procedure_scheduled` |
| `reminder_sent` | scheduled | Thông tin | Customer checks in | cskh_postop | `procedure_scheduled` |
| `checked_in` | scheduled | Thông tin | Begin procedure | doctor / nurse | `customer_checked_in` |
| `in_procedure` | in_procedure | Ca phẫu thuật | Complete procedure | doctor | — |
| `procedure_completed` | in_procedure | Hậu phẫu | Auto-create D1 followup | cskh_postop | `procedure_completed` |
| `waiting_images_upload` | in_procedure | Tài liệu | Upload before/after | media / nurse | `images_missing` |
| `post_op_d1` | post_op | Hậu phẫu | Followup D1 call | cskh_postop | `postop_followup_due` |
| `post_op_d3` | post_op | Hậu phẫu | Followup D3 call | cskh_postop | `postop_followup_due` |
| `post_op_d7` | post_op | Hậu phẫu | Followup D7 call | cskh_postop | `postop_followup_due` |
| `post_op_d14` | post_op | Hậu phẫu | Followup D14 call | cskh_postop | `postop_followup_due` |
| `post_op_d30` | post_op | Hậu phẫu | Followup D30 call | cskh_postop | `postop_followup_due` |
| `post_op_d90` | post_op | Hậu phẫu | Followup D90 call | cskh_postop | `postop_followup_due` |
| `complaint` | (adverse) | Thông tin | Resolve complaint | cso | `complaint` |
| `medical_alert` | (adverse) | Thông tin | Doctor intervention | doctor | `medical_alert` |
| `medical_alert_resolved` | (adverse, terminal) | Thông tin | Audit log only | — | — (F-HIGH-19, new) |
| `postponed` | (paused) | Thông tin | Reschedule | cso / coordinator | — |
| `completed` | (terminal) | Thông tin | (read-only) | — | — |
| `cancelled` | (terminal) | Thông tin | (read-only) | — | — |

### 9.3 Status → tab mapping (for deep-link from notifications)

| Status | Tab to land on |
|--------|----------------|
| draft, waiting_*, payment_*, hospital_*, lab_*, medically_approved, scheduled, checked_in, complaint, medical_alert, medical_alert_resolved, postponed, completed, cancelled | Thông tin (tab 1) |
| in_procedure | Ca phẫu thuật (tab 2) |
| procedure_completed, waiting_images_upload | Tài liệu (tab 8) for images, else Hậu phẫu (tab 7) |
| post_op_d1, post_op_d3, post_op_d7, post_op_d14, post_op_d30, post_op_d90 | Hậu phẫu (tab 7) |

### 9.4 The case detail tab order (8 tabs, per DESIGN_DIRECTION.md §9.1)

| # | Tab | Vietnamese | Content | Phase |
|---|-----|-----------|---------|------:|
| 1 | `info` | Thông tin | Bill summary, next-owner, status workflow, checklist, staff | — |
| 2 | `procedure` | Ca phẫu thuật | Procedure details, dates, location, pre-procedure checklist | — |
| 3 | `payments` | Thanh toán | Bill breakdown, payment list, refund history | — |
| 4 | `checklist` | Checklist | Pre-hospital + pre-procedure, semantic colors (F-HIGH-16) | 7 |
| 5 | `consent` | Đồng thuận | 4 consent types, status workflow | 7 |
| 6 | `hospital` | Bệnh viện | Hospital coordination (coordinator/cso/admin only, F-MED-15) | 7 |
| 7 | `postop` | Hậu phẫu | D1–D90 followup trail | — |
| 8 | `attachments` | Tài liệu | Drag-and-drop upload, visibility, consent gate | — |

**On `< sm`:** tabs collapse to icon-only with a "More" overflow menu for tabs 5–8 (F-MED-13).

### 9.5 Next-owner computation (F-CRIT-09)

```ts
function getNextOwner(currentStatus: CaseStatus, role: Role): { owner: Role; action: string } {
  // derived from CASE_STATUS_TRANSITIONS + role mapping table
  // banner shown at top of Info tab
}
```

The banner is also surfaced on the dashboard for the current user, filtered by role.

---

## 10. Customer → Case → Payment Relationships

### 10.1 Entity relationship diagram

```
┌─────────────┐       1     N     ┌──────────────┐      1     N     ┌──────────────┐
│  Customer   │──────────────────>│     Case     │─────────────────>│ CaseService  │
│             │                   │              │                  │ (line items) │
│ id          │                   │ id           │                  │              │
│ customerCode│                   │ caseCode     │                  │ serviceName  │
│ fullName    │                   │ customerId ──┘                  │ finalPrice   │
│ phone       │                   │ status                          │ quantity     │
│ privacyLevel│                   │ totalBillAfterDiscount          └──────────────┘
│ CCCD (sens) │                   │ amountPaid
│             │                   │ expectedLabDate
│ deletionReq │                   │ actualProcedureDate
└──────┬──────┘                   └──────┬───────┘
       │                                 │
       │                                 │ 1
       │                                 │
       │                                 │ N
       │                                 ├──────────────┐
       │                                 │              │
       │                                 ▼              ▼
       │                          ┌──────────────┐  ┌──────────────┐
       │                          │   Payment    │  │   Followup   │
       │                          │              │  │              │
       │                          │ caseId       │  │ caseId       │
       │                          │ customerId ──┘  │ customerId ──┘
       │                          │ status         │ followupDay
       │                          │ amount         │   (D1|D3|D7|D14|D30|D90)
       │                          │ method         │ status
       │                          │ paymentType    │ painLevel
       │                          │ createdBy      │ imageUploaded
       │                          │ confirmedBy    │ nextAction
       │                          └──────────────┘  └──────────────┘
       │
       │                                 N
       │                                 │
       │                                 ▼
       │                          ┌──────────────┐
       │                          │   Consent    │
       │                          │              │
       │                          │ customerId   │
       │                          │ caseId       │
       │                          │ consentType  │
       │                          │   (4 types)  │
       │                          │ status       │
       │                          │ signedBy     │
       │                          │ documentUrl  │
       │                          └──────────────┘
       │
       │                                 N
       │                                 │
       │                                 ▼
       │                          ┌──────────────┐
       │                          │ Attachment   │
       │                          │              │
       │                          │ caseId       │
       │                          │ customerId   │
       │                          │ type         │
       │                          │ visibility   │
       │                          │ storagePath  │
       │                          └──────────────┘
       │
       │                                 N
       │                                 │
       │                                 ▼
       │                          ┌──────────────┐
       │                          │ Notification │
       │                          │              │
       │                          │ customerId ──┘
       │                          │ caseId
       │                          │ eventType
       │                          │ readBy[]
       │                          └──────────────┘
       └──────────────────────────────────────> Cross-references in UI:
                                              - Customer detail "Lịch sử ca" → Case
                                              - Case header → Customer
                                              - Notification click → Case or Customer
```

### 10.2 Cross-reference navigation patterns

| From | To | Trigger | Implementation |
|------|----|---------|----------------|
| `/dashboard` "Báo cáo nhanh" | `/cases?status=...` | Click card | `<Link>` with query param |
| `/dashboard` "Hoạt động gần đây" | `/cases/[id]` or `/customers/[id]` | Click row | `<Link>` |
| `/customers` (list) | `/customers/[id]` | Click row | `<Link>` |
| `/customers` (list) | `/customers/new` | Click "Tạo khách hàng" | `<Link>` |
| `/customers/[id]` "Lịch sử ca" tab | `/cases/[id]` | Click case row | `<Link>` |
| `/customers/[id]` "Theo dõi sau PT" tab | `/cases/[id]` (via followup) | Click followup | `<Link>` |
| `/cases` (list) | `/cases/[id]` | Click row | `<Link>` |
| `/cases` (list) | `/cases/new` | Click "Tạo ca mới" | `<Link>` |
| `/cases/[id]` header | `/customers/[customerId]` | Click customer name | `<Link>` |
| `/cases/[id]` "Thanh toán" tab | `/payments/new?caseId=...` | Click "Tạo thanh toán" | `<Link>` with query |
| `/payments` (list) | `/payments/new` | Click "Tạo thanh toán" | `<Link>` |
| `/payments` (list) | `/cases/[caseId]` | Click "Mã ca" | `<Link>` (nested: click row → case) |
| `/calendar` event | `/cases/[caseId]?tab=procedure` | Click event | `<Link>` with `?tab=` |
| `/followups` row | `/cases/[caseId]?tab=postop` | Click followup | `<Link>` with `?tab=` |
| `/notifications` (page or bell) | `/cases/[id]?tab=...` | Click notification | `router.push()` with `?tab=` (proposed) |
| Topbar notification bell | `/cases/[id]?tab=...` | Click notification | `router.push()` (proposed fix) |
| Settings sub-page (sidebar) | `/settings/users` etc. | Click item | `<Link>` |
| Topbar avatar → Profile | (toast "Đang phát triển") | Click | F-HIGH-01 placeholder |
| Topbar avatar → Đăng xuất | `/login` | Click | `signOut()` + `router.push('/login')` |

### 10.3 Foreign key chain (referential integrity)

```
Customer.id ←─ Case.customerId
Customer.id ←─ Payment.customerId  (denormalized for fast lookup)
Customer.id ←─ Followup.customerId
Customer.id ←─ Consent.customerId
Customer.id ←─ Attachment.customerId
Customer.id ←─ Notification.customerId
Customer.id ←─ Appointment.customerId

Case.id ←─ Payment.caseId
Case.id ←─ Followup.caseId
Case.id ←─ Consent.caseId
Case.id ←─ Attachment.caseId
Case.id ←─ Notification.caseId
Case.id ←─ Appointment.caseId
```

**Soft-delete cascade** (F-MED-16 approved for Phase 7): When a customer deletion is approved, all dependent records (cases, payments, followups, attachments) are soft-deleted (`active: false`) and each cascade writes a separate audit log entry.

---

## 11. Deep-link Strategy from Notifications

### 11.1 Current behavior (problem statement)

```ts
// topbar.tsx, line 137-142
const handleNotificationClick = (n: Notification) => {
  if (n.caseId) router.push(`/cases/${n.caseId}`);
  else if (n.customerId) router.push(`/customers/${n.customerId}`);
  markAsRead(n.id);
};
```

**Limitations:**
1. No `?tab=` param — all events land on default "Thông tin" tab.
2. `payment_pending` lands on case "Thông tin" — user has to manually click "Thanh toán" to find the relevant context.
3. `images_missing` lands on case "Thông tin" — but the user wants to upload images (tab 8).
4. `medical_alert` lands on case "Thông tin" — correct, but there's no tab badge indicator.

### 11.2 Proposed scheme (Phase 7, F-HIGH-10 follow-up)

Add a `tab` field to the `Notification` type and a `getNotificationTarget(n)` helper that returns `{ href, tab? }`.

#### 11.2.1 Notification event → target mapping

| Event type | Target | Tab | Why |
|------------|--------|-----|-----|
| `new_case_created` | `/cases/[id]` | `info` | General case awareness |
| `payment_pending` | `/cases/[id]` | `payments` | User needs to see/confirm payment |
| `payment_confirmed` | `/cases/[id]` | `payments` | Receipt confirmation |
| `payment_rejected` | `/cases/[id]` | `payments` | Reason for rejection |
| `hospital_coordination_required` | `/cases/[id]` | `info` | (Phase 7) Will be `hospital` once tab ships |
| `hospital_confirmed` | `/cases/[id]` | `info` | Slot confirmed |
| `lab_test_due` | `/cases/[id]` | `info` | Lab pending |
| `procedure_scheduled` | `/cases/[id]` | `info` | Date confirmed |
| `customer_checked_in` | `/cases/[id]` | `info` | Customer arrived |
| `procedure_completed` | `/cases/[id]` | `postop` | Now in post-op followup mode |
| `images_missing` | `/cases/[id]` | `attachments` | Upload images |
| `postop_followup_due` | `/cases/[id]` | `postop` | D1/D3/... due |
| `complaint` | `/cases/[id]` | `info` | Safety banner on Info tab |
| `medical_alert` | `/cases/[id]` | `info` | Safety banner on Info tab |

#### 11.2.2 Notification-only events (no caseId)

| Event | Target | Notes |
|-------|--------|-------|
| `new_case_created` (without caseId) | `/customers/[id]` | Customer-only awareness |
| (any event with only `customerId`) | `/customers/[id]` | Generic customer route |

### 11.3 Type change (proposed)

```ts
// src/lib/types/notification.ts (additions)
export type CaseTab =
  | 'info' | 'procedure' | 'payments' | 'checklist'
  | 'consent' | 'hospital' | 'postop' | 'attachments';

export interface Notification {
  // ... existing fields ...
  targetTab?: CaseTab;  // optional hint for deep-link target
  targetType?: 'case' | 'customer' | 'report' | 'followup';  // explicit
}
```

### 11.4 Template changes (proposed)

Each `buildXxxNotification` in `lib/notifications/templates.ts` should accept the target hint:

```ts
// example
buildNewCaseNotification({
  caseCode, customer, payments, location, staffNames,
  targetTab: 'info',  // explicit
});
```

### 11.5 Click handler (proposed)

```ts
// src/lib/notifications/routing.ts
import type { Notification, CaseTab } from '@/lib/types/notification';

export function getNotificationTarget(n: Notification): { href: string } {
  const caseTab = n.targetTab;
  if (n.caseId) {
    return caseTab
      ? { href: `/cases/${n.caseId}?tab=${caseTab}` }
      : { href: `/cases/${n.caseId}` };
  }
  if (n.customerId) {
    return { href: `/customers/${n.customerId}` };
  }
  return { href: '/notifications' };  // safe fallback
}
```

```ts
// topbar.tsx + notifications/page.tsx (unified)
const handleClick = (n: Notification) => {
  const { href } = getNotificationTarget(n);
  router.push(href);
  markAsRead(n.id);
};
```

### 11.6 Page change (proposed)

Case detail and customer detail must support `?tab=` query param. Today tabs are local `useState` — they need to become URL-synced:

```ts
// src/app/(protected)/cases/[id]/page.tsx
const router = useRouter();
const searchParams = useSearchParams();
const activeTab = (searchParams.get('tab') as CaseTab) || 'info';
const setActiveTab = (tab: CaseTab) => router.replace(`?tab=${tab}`, { scroll: false });
```

### 11.7 Deep-link validation rules

| Rule | Why |
|------|-----|
| If `targetTab` references a tab that doesn't exist for the role, fall back to `info` | F-MED-15: Hospital tab is coordinator/cso/admin only |
| If `targetTab` references a tab the role doesn't have permission to read, fall back to `info` | Permission gate |
| If `caseId` no longer exists (deleted), route to `/notifications` with a toast | F-HIGH-10 error path |
| If both `caseId` and `customerId` exist, prefer `caseId` | Already current behavior |
| Never deep-link to a tab without first verifying the tab is rendered for the role | Defense in depth |

### 11.8 Other deep-link sources

| Source | Pattern | Notes |
|--------|---------|-------|
| Email/Telegram notifications (Phase 9) | `https://<host>/cases/[id]?tab=...` | Same scheme applies; URL is shareable |
| Audit log entries | `/audit-logs?entity=case&id=...` | Phase 8 |
| Customer deletion banner | `/customers/[id]?action=approve` | Phase 8 |
| Report drill-down | `/reports?tab=revenue&range=this_month&service=...` | Phase 8 |

---

## Appendix A — Sources Cross-Reference

| Finding | Section(s) | Doc |
|---------|-----------|------|
| F-CRIT-01 | §4 (M1) | DESIGN_DIRECTION §6 |
| F-CRIT-02 | §10 (Customer form) | UX_DECISION §4.3 |
| F-CRIT-05 | §5, §6 | UX_DECISION §4.1 |
| F-CRIT-06 | §6 (PAYMENT_CONFIRM_ROLES) | UX_DECISION §4.2 |
| F-CRIT-07 | §8 (Dashboard rank 1) | UX_DECISION §4.1 |
| F-CRIT-09 | §8, §9 (next-owner) | UX_DECISION §4.1 |
| F-CRIT-10 | §9 (checklist gate) | UX_DECISION §4.1 |
| F-HIGH-02 | §7 (shared menu) | UX_DECISION §4.4 |
| F-HIGH-03 | §4 (M10) | UX_DECISION §4.5 |
| F-HIGH-10 | §11 (notification deep-link) | UX_DECISION §4.5 |
| F-HIGH-15 | §4 (CloseIconButton) | UX_DECISION §4.4 |
| F-HIGH-22 | §9 (doctor identity) | UX_DECISION §4.5 |
| F-HIGH-28 | §10 (Bill recompute) | UX_DECISION §4.2 |
| F-HIGH-29 | §8 (Dashboard rank 5) | UX_DECISION §4.2 |
| F-HIGH-30 | §8 (Dashboard rank 4+8) | UX_DECISION §4.5 |
| F-MED-06 | §4 (M4) | UX_DECISION §4.6 |
| F-MED-13 | §4, §9 (M3) | UX_DECISION §4.6 |
| F-MED-15 | §9 (Hospital tab) | UX_DECISION §4.1 |
| F-MED-16 | §10 (cascade audit) | UX_DECISION §4.7 |
| F-HIGH-35 | §1 (Media Library removed) | UX_DECISION §5 |

---

## Appendix B — Open Questions for Stakeholder Review

| # | Question | Default if no answer |
|---|----------|----------------------|
| Q1 | Should `useVisibleMenu` be a separate hook in `src/lib/hooks/`, or live in `src/config/sidebar-menu.ts` as a regular function? | Hook in `src/lib/hooks/useVisibleMenu.ts` (consistent with `useCurrentUser`) |
| Q2 | Should the dashboard be a separate route (`/dashboard/queue` for action queues) or stay on `/dashboard` with tabbed sections? | Stay on `/dashboard` with 8 ranked cards (per DESIGN_DIRECTION §7) |
| Q3 | When a notification has both `caseId` and `customerId`, do we still prefer `caseId`? | Yes, but consider letting templates override via `targetType` |
| Q4 | Should notification bell show a count badge on mobile, or always expand inline? | Badge + expand on tap (F-HIGH-03 Phase 7) |
| Q5 | Should `?tab=` use a hash fragment (`#payments`) or query param (`?tab=payments`)? | Query param — server-renderable, shareable |

---

*End of Sitemap.*
