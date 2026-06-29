# Swan Case CRM Context

SWAN CASE CRM is an internal medical operation CRM for Swan Clinic.

Core purpose:
- Manage customer records.
- Manage service cases/bills.
- Coordinate payments, hospital execution, staff assignments, appointments, documents, images, consent, post-op follow-up, notifications, reports, and audit logs.
- Replace fragmented group-chat operations with CRM as the source of truth.

Tech stack:
- Next.js App Router
- TypeScript strict mode
- Tailwind CSS
- React Hook Form
- Zod
- Firebase Auth
- Firestore
- Firebase Storage
- Firebase Cloud Functions
- Vercel

Critical modules:
- Auth & RBAC
- Customers
- Cases/Bills
- Case Services
- Payments
- Treatment Locations
- Hospital Coordination
- Staff Assignment
- Calendar/Appointments
- Checklist
- Attachments
- Consent
- Post-op Follow-up D1/D3/D7/D14/D30/D90
- Tasks
- Notifications
- Telegram adapter
- Dashboard
- Reports
- Audit Logs
- Settings

Non-negotiable principles:
- CRM is the source of truth. Chat is notification only.
- Do not expose sensitive patient data to unauthorized roles.
- Do not send CCCD, medical notes, private images, or confidential internal notes through Telegram/Zalo.
- All sensitive changes require audit logs.
- Payment revenue only counts confirmed payments.
- Images are private by default.
- Media can only access media-approved images with consent.
- Firestore and Storage rules must never be public.
