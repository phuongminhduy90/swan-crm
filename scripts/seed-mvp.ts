/**
 * Swan CRM — Real-Firebase MVP Mock Seed (idempotent, batch-tagged).
 *
 * Goals:
 *   - Seed ~1,150 mock docs across 16 Firestore collections covering the full
 *     MVP customer journey: users, customers, cases, caseServices, payments,
 *     staffAssignments, tasks, appointments, hospitalCoordinations,
 *     followups, attachments, consents, notifications, auditLogs,
 *     treatmentLocations, services.
 *   - Strict prefix isolation: every doc id starts with `mvp-mock-` so we
 *     NEVER touch the existing `cus-seed-*` customers and the prior
 *     `*@swanclinic.vn` users from the previous seed run.
 *   - Every doc carries `seedBatchId: 'mvp_full_mock_seed_001'` for
 *     idempotent rerun + targeted cleanup.
 *   - No Firebase Auth users — just Firestore `users/*` docs (per
 *     user-confirmed decision).
 *
 * Modes (argv):
 *   npm run seed:mvp              → auto-cleanup + seed (default)
 *   npm run seed:mvp:dry-run      → generate + validate + sample-print, no commit
 *   npm run seed:mvp:cleanup -- --yes → delete every mvp-mock-* doc by seedBatchId
 *
 * Run via tsx:
 *   npx tsx scripts/seed-mvp.ts            # seed
 *   npx tsx scripts/seed-mvp.ts --dry-run  # validate
 *   npx tsx scripts/seed-mvp.ts --cleanup  # cleanup (needs --yes)
 */
import './_load-env';
import { existsSync, readFileSync, writeFileSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  getAdminDb,
  isAdminConfigured,
} from '../src/lib/firebase/admin';
import type {
  UserRole,
  User,
  Customer,
  TreatmentLocation,
  TreatmentLocationType,
  HospitalCoordination,
  Service,
  ServiceCategory,
  CaseRecord,
  CaseStatus,
  CaseService,
  Payment,
  PaymentMethod,
  PaymentType,
  PaymentRecordStatus,
  Followup,
  FollowupDay,
  FollowupStatus,
  SeverityLevel,
  Consent,
  ConsentType,
  ConsentStatus,
  Appointment,
  AppointmentType,
  AppointmentStatus,
  Attachment,
  AttachmentType,
  AttachmentVisibility,
  Task,
  TaskDepartment,
  TaskPriority,
  TaskStatus,
  Notification,
  NotificationEventType,
  NotificationChannel,
  NotificationStatus,
  AuditLog,
  AuditAction,
  AuditEntityType,
  StaffAssignment,
} from '../src/lib/types';

// ── Constants ────────────────────────────────────────────────
const SEED_BATCH_ID = 'mvp_full_mock_seed_001';
const PROJECT_ID = 'swancrm-1fa61';
const ID_PREFIX = 'mvp-mock-';
const BATCH_LIMIT = 450; // safety margin under Firestore's 500-op/commit cap
const MANIFEST_PATH = resolve(process.cwd(), 'scripts/.seed-mvp-manifest.json');
const LOCK_PATH = resolve(process.cwd(), 'scripts/.seed-mvp.lock');
const NOW = new Date('2026-06-30T08:00:00Z'); // pinned for deterministic PRNG seeding
const NOW_ISO = NOW.toISOString();

// Argv
const ARGV = process.argv.slice(2);
const MODE_CLEANUP = ARGV.includes('--cleanup');
const MODE_DRY_RUN = ARGV.includes('--dry-run');
const MODE_SEED = !MODE_CLEANUP && !MODE_DRY_RUN;
const FORCE_YES = ARGV.includes('--yes') || ARGV.includes('-y');

// ── Logging helpers ──────────────────────────────────────────
const log = (msg: string): void => console.log(msg);
const ok = (msg: string): void => console.log(`  ✅ ${msg}`);
const skip = (msg: string): void => console.log(`  ⏭️  ${msg}`);
const err = (msg: string): void => console.log(`  ❌ ${msg}`);
const head = (msg: string): void => {
  log('');
  log('────────────────────────────────────────────────────');
  log(`  ${msg}`);
  log('────────────────────────────────────────────────────');
};

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ── Id generators ────────────────────────────────────────────
const pad4 = (n: number): string => String(n).padStart(4, '0');
const pad3 = (n: number): string => String(n).padStart(3, '0');
const pad2 = (n: number): string => String(n).padStart(2, '0');

const newUserId = (i: number): string => `${ID_PREFIX}user-${pad3(i)}`;
const newLocationId = (i: number): string => `${ID_PREFIX}loc-${pad3(i)}`;
const newServiceId = (i: number): string => `${ID_PREFIX}svc-${pad3(i)}`;
const newCustomerId = (i: number): string => `${ID_PREFIX}cus-${pad3(i)}`;
const newCaseId = (i: number): string => `${ID_PREFIX}case-${pad3(i)}`;
const newCaseServiceId = (i: number): string => `${ID_PREFIX}csvc-${pad3(i)}`;
const newPaymentId = (i: number): string => `${ID_PREFIX}pay-${pad3(i)}`;
const newStaffAssignmentId = (i: number): string => `${ID_PREFIX}sa-${pad3(i)}`;
const newTaskId = (i: number): string => `${ID_PREFIX}task-${pad3(i)}`;
const newAppointmentId = (i: number): string => `${ID_PREFIX}appt-${pad3(i)}`;
const newCoordinationId = (i: number): string => `${ID_PREFIX}coord-${pad3(i)}`;
const newFollowupId = (i: number): string => `${ID_PREFIX}fup-${pad3(i)}`;
const newAttachmentId = (i: number): string => `${ID_PREFIX}att-${pad3(i)}`;
const newConsentId = (i: number): string => `${ID_PREFIX}consent-${pad3(i)}`;
const newNotificationId = (i: number): string => `${ID_PREFIX}notif-${pad3(i)}`;
const newAuditId = (i: number): string => `${ID_PREFIX}audit-${pad3(i)}`;

// ── PRNG — mulberry32 (deterministic, rerunnable) ────────────
function rng(seedNum: number) {
  let a = seedNum >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260630);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)] as T;
const pickIndex = <T>(arr: readonly T[]): number => Math.floor(rand() * arr.length);
const chance = (p: number): boolean => rand() < p;
const rangeInt = (lo: number, hi: number): number =>
  Math.floor(rand() * (hi - lo + 1)) + lo;

// ── Vietnamese data pools (reuse from scripts/seed-firebase.ts) ────
const HO_CHI_MINH_DISTRICTS = [
  'Q.1', 'Q.3', 'Q.4', 'Q.5', 'Q.6', 'Q.7', 'Q.8', 'Q.10', 'Q.11', 'Q.12',
  'Q. Bình Thạnh', 'Q. Phú Nhuận', 'Q. Tân Bình', 'Q. Tân Phú',
  'Q. Gò Vấp', 'Q. Bình Tân', 'Q. Thủ Đức', 'TP. Thủ Đức', 'Q. Bình Chánh',
] as const;

const STREETS = [
  'Nguyễn Huệ', 'Lê Lợi', 'Trần Hưng Đạo', 'Hai Bà Trưng', 'Lý Tự Trọng',
  'Đồng Khởi', 'Pasteur', 'Nam Kỳ Khởi Nghĩa', 'Cách Mạng Tháng 8',
  'Điện Biên Phủ', 'Hoàng Văn Thụ', 'Phan Đăng Lưu', 'Nguyễn Đình Chiểu',
  'Lê Văn Sỹ', 'Trường Sơn', 'Cộng Hòa', 'Hoàng Diệu', 'Nguyễn Thị Minh Khai',
  'Bùi Thị Xuân', 'Phan Xích Long',
] as const;

const SURNAMES_F = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ',
  'Ngô', 'Dương', 'Lý', 'Phan', 'Trương', 'Võ', 'Tô', 'Đinh', 'Mai', 'Tăng',
] as const;
const GIVEN_F = [
  'Thị Hồng', 'Thị Thu', 'Thị Ngọc', 'Thị Bích', 'Thị Mỹ', 'Thị Kim',
  'Thanh', 'Khánh', 'Phương', 'Mai', 'Hà', 'Linh', 'Trang', 'Vy', 'Anh',
  'Hương', 'Nhung', 'Hoa', 'Thảo', 'Tú', 'Uyên', 'Quỳnh', 'Yến', 'Ngân',
  'Tiên', 'Thư', 'Vân', 'Tâm', 'Diệu', 'Nghi',
] as const;
const GIVEN_F_TRAIL = [
  'Ngọc', 'Anh', 'Trang', 'Phương', 'Linh', 'Vy', 'Hà', 'Mai', 'Châu',
  'Hương', 'Nhi', 'Thư', 'Uyên', 'Yến', 'Loan', 'Hoa', 'Tú', 'Duyên',
  'Phượng', 'Huyền', 'Trâm', 'Tiên', 'Nhung', 'Diệu', 'Ngân', 'Tâm',
] as const;
const SURNAMES_M = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ'] as const;
const GIVEN_M = [
  'Văn', 'Hữu', 'Đức', 'Minh', 'Quang', 'Thanh', 'Khánh', 'Tuấn', 'Anh',
  'Hoàng', 'Bảo', 'Phúc', 'Long', 'Sơn', 'Huy', 'Dũng', 'Cường', 'Thành',
  'Trung', 'Hải', 'Nam', 'Khoa', 'Khang', 'Phát', 'Tài',
] as const;
const GIVEN_M_TRAIL = [
  'Anh', 'Quân', 'Phong', 'Khoa', 'Long', 'Sơn', 'Huy', 'Dũng', 'Cường',
  'Thành', 'Trung', 'Hải', 'Nam', 'Khang', 'Phát', 'Tài', 'Bình', 'Phú',
  'Đạt', 'Toàn', 'Nghĩa', 'Thiện', 'Vinh', 'Quý', 'Lộc',
] as const;

const SOURCES = [
  { value: 'online' as const, detail: 'Facebook Ads — campaign nâng ngực 2026' },
  { value: 'online' as const, detail: 'Google Ads — từ khóa "nâng mũi TPHCM"' },
  { value: 'online' as const, detail: 'Instagram organic — DM cho phòng khám' },
  { value: 'online' as const, detail: 'TikTok Ads — hashtag #thammyvien' },
  { value: 'online' as const, detail: 'Zalo OA Swan Clinic' },
  { value: 'offline' as const, detail: 'Sự kiện Beauty Show 2026' },
  { value: 'offline' as const, detail: 'Hội chợ thẩm mỹ quốc tế' },
  { value: 'walk_in' as const, detail: 'Khách đến trực tiếp sau khi đi ngang' },
  { value: 'walk_in' as const, detail: 'Tái khám theo lịch hẹn' },
  { value: 'referral' as const, detail: 'Giới thiệu bởi khách hàng cũ' },
  { value: 'referral' as const, detail: 'Bác sĩ đối tác giới thiệu' },
  { value: 'koc' as const, detail: 'KOC Beauty TikTok — hợp đồng content' },
  { value: 'old_data' as const, detail: 'Khách cũ tái khám / thêm dịch vụ' },
  { value: 'other' as const, detail: 'Khác — cần xác minh nguồn' },
];

const MEDICAL_NOTES: (string | undefined)[] = [
  'Không có tiền sử dị ứng thuốc. Sức khỏe tổng quát tốt.',
  'Tiền sử cao huyết áp nhẹ. Đang uống thuốc ổn định.',
  'Dị ứng Penicillin — GHI CHÚ QUAN TRỌNG.',
  'Tiểu đường type 2 nhẹ. Đang dùng Metformin.',
  'BMI 26. Bác sĩ khuyến cáo giảm cân trước khi hút mỡ.',
  'Đã có 2 con. Cần xác nhận đã cai sữa.',
  'Tiền sử mổ ruột thừa 2015. Không dị ứng.',
  'Sức khỏe bình thường. Không có tiền sử đặc biệt.',
  'Khách trẻ, cần tư vấn kỹ về độ tuổi phù hợp.',
  'Huyết áp ổn định. Không có bệnh nền.',
  'Khách từ tỉnh đến — cần lên lịch linh hoạt.',
  'Đã làm phẫu thuật thẩm mỹ 1 lần trước đó.',
  undefined, undefined, // ~14% have no medical note
];

const PRIVACY_NOTES: (string | undefined)[] = [
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, // most are normal
  'Khách VIP — ưu tiên chăm sóc và bảo mật thông tin.',
  'Nhóm khách đặc biệt — ảnh hưởng referral chain.',
  'Influencer có hợp đồng brand riêng với Media.',
  'Người nổi tiếng — không chia sẻ thông tin ra ngoài.',
  'TUYỆT MẬT — chỉ Admin/CEO được xem hồ sơ.',
];

// ── Phone generator — disjoint Mobifone prefixes 071-075 ────
const MOCK_PHONE_PREFIXES = ['071', '072', '073', '074', '075'] as const;

function generatePhone(index: number): string {
  const prefix = MOCK_PHONE_PREFIXES[index % MOCK_PHONE_PREFIXES.length]!;
  const a = ((index * 7 + 100) % 900 + 100); // 100..999
  const b = ((index * 13 + 50) % 900 + 100); // 100..999
  return `0${prefix.slice(1)}${pad3(a)}${pad3(b)}`; // e.g. 071XXXYYYZZZ (11 digits)
}

function generateCustomerCode(index: number): string {
  const d = new Date(NOW);
  const yymmdd = `${d.getUTCFullYear().toString().slice(2)}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
  return `CUS-${yymmdd}-${pad3(index)}`;
}

function generateCaseCode(index: number): string {
  const d = new Date(NOW);
  const yymmdd = `${d.getUTCFullYear().toString().slice(2)}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
  return `SW-${yymmdd}-${pad3(index)}`;
}

function randomBirthYear(): string {
  // Age 18..65
  const year = 2026 - (18 + rangeInt(0, 47));
  const month = rangeInt(1, 12);
  const day = rangeInt(1, 28);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function daysAgo(days: number): Date {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function daysAhead(days: number): Date {
  return daysAgo(-days);
}

function daysFrom(base: Date, days: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

// ── Build helpers ────────────────────────────────────────────
function pickPrivacyLevel(): 'normal' | 'vip' | 'highly_sensitive' {
  const r = rand();
  if (r < 0.78) return 'normal';
  if (r < 0.94) return 'vip';
  return 'highly_sensitive';
}

// ── Report accumulator ───────────────────────────────────────
type CountAcc = Record<string, number>;
type SampleAcc = Record<string, string[]>;

const report = {
  generatedCounts: {} as CountAcc,
  writtenCounts: {} as CountAcc,
  sampleIds: {} as SampleAcc,
  errors: [] as { collection: string; id: string; reason: string }[],
  brokenRefs: [] as { collection: string; id: string; field: string; target: string }[],
  startedAt: NOW_ISO,
  finishedAt: '',
  mode: '',
};

function trackCount(stage: 'generated' | 'written', collection: string, n: number): void {
  const target = stage === 'generated' ? report.generatedCounts : report.writtenCounts;
  target[collection] = (target[collection] ?? 0) + n;
}

function pushSample(collection: string, id: string): void {
  const list = report.sampleIds[collection] ?? (report.sampleIds[collection] = []);
  if (list.length < 5) list.push(id);
}

// ── Firestore batch writer with retry ────────────────────────
async function commitBatch(
  collectionName: string,
  docs: ReadonlyArray<{ id: string; data: Record<string, unknown> }>,
): Promise<{ ok: number; failed: number }> {
  if (docs.length === 0) return { ok: 0, failed: 0 };
  const db = getAdminDb();

  // Firestore max 500 ops per commit. Slice into BATCH_LIMIT chunks.
  let totalOk = 0;
  let totalFailed = 0;
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const slice = docs.slice(i, i + BATCH_LIMIT);
    const opCount = slice.length;
    let attempt = 0;
    let committed = false;
    while (attempt < 3 && !committed) {
      attempt++;
      try {
        const batch = db.batch();
        for (const d of slice) {
          batch.set(db.collection(collectionName).doc(d.id), d.data);
        }
        await batch.commit();
        totalOk += opCount;
        committed = true;
      } catch (e) {
        const code = (e as { code?: number }).code;
        const isTransient = code === 4 /* DEADLINE_EXCEEDED */ || code === 14 /* UNAVAILABLE */;
        if (!isTransient || attempt >= 3) {
          err(`${collectionName} batch commit failed: ${(e as Error).message}`);
          for (const d of slice) {
            report.errors.push({ collection: collectionName, id: d.id, reason: (e as Error).message });
            totalFailed++;
          }
          break;
        }
        await sleep(200 * Math.pow(4, attempt - 1)); // 200ms, 800ms, 3200ms
      }
    }
  }
  if (totalOk > 0) ok(`${collectionName}: ${totalOk} written`);
  if (totalFailed > 0) err(`${collectionName}: ${totalFailed} failed`);
  return { ok: totalOk, failed: totalFailed };
}

// ── Dry-run no-op writer ─────────────────────────────────────
async function commitDryRun(
  collectionName: string,
  docs: ReadonlyArray<{ id: string; data: Record<string, unknown> }>,
): Promise<{ ok: number; failed: number }> {
  // In dry-run mode we log only.
  ok(`${collectionName}: ${docs.length} [dry-run, not committed]`);
  return { ok: docs.length, failed: 0 };
}

async function writeCollection(
  collectionName: string,
  docs: ReadonlyArray<{ id: string; data: Record<string, unknown> }>,
): Promise<void> {
  if (MODE_DRY_RUN) {
    await commitDryRun(collectionName, docs);
  } else {
    const res = await commitBatch(collectionName, docs);
    if (res.ok > 0) {
      trackCount('written', collectionName, res.ok);
      for (const d of docs) pushSample(collectionName, d.id);
    }
  }
}

// ── ID Sets for FK validation ────────────────────────────────
const userIds = new Set<string>();
const locationIds = new Set<string>();
const serviceIds = new Set<string>();
const customerIds = new Set<string>();
const caseIds = new Set<string>();
const consentIds = new Set<string>();
const phonesUsed = new Set<string>();

function addToCollection<T>(set: Set<string>, id: string): void {
  set.add(id);
}

// ── Entity generators ────────────────────────────────────────

// 15 users — full 12-role RBAC coverage (sales has 2 each, doctors have 2)
type UserSpec = { role: UserRole; displayName: string; phone: string; email: string };

const USER_SPECS: UserSpec[] = [
  { role: 'admin',        displayName: 'Hoàng Minh Khôi (Mock Admin)',    phone: '0711000001', email: 'mvp.mock.admin@swan-mock.vn' },
  { role: 'ceo',          displayName: 'Lê Thị Cẩm (Mock CEO)',          phone: '0711000002', email: 'mvp.mock.ceo@swan-mock.vn' },
  { role: 'cso',          displayName: 'Trần Thị Thu Hà (Mock CSO)',      phone: '0711000003', email: 'mvp.mock.cso@swan-mock.vn' },
  // sales tier (each duplicated for richer staffAssignments)
  { role: 'master_sales', displayName: 'Trần Minh Sang (Mock Master)',    phone: '0711000004', email: 'mvp.mock.mastersales@swan-mock.vn' },
  { role: 'sales_online', displayName: 'Nguyễn Thị Lan Anh (Mock Online)', phone: '0711000005', email: 'mvp.mock.salesonline1@swan-mock.vn' },
  { role: 'sales_online', displayName: 'Đỗ Khánh Vy (Mock Online 2)',      phone: '0711000006', email: 'mvp.mock.salesonline2@swan-mock.vn' },
  { role: 'sales_offline',displayName: 'Phạm Văn Hùng (Mock Offline)',    phone: '0711000007', email: 'mvp.mock.salesoffline1@swan-mock.vn' },
  { role: 'sales_offline',displayName: 'Lê Thanh Tùng (Mock Offline 2)',  phone: '0711000008', email: 'mvp.mock.salesoffline2@swan-mock.vn' },
  // finance + medical + operations
  { role: 'accountant',   displayName: 'Hồ Thị Lan (Mock Accountant)',    phone: '0711000009', email: 'mvp.mock.accountant@swan-mock.vn' },
  { role: 'doctor',       displayName: 'BS. Phạm Ngọc Anh (Mock Doc 1)',  phone: '0711000010', email: 'mvp.mock.doctor1@swan-mock.vn' },
  { role: 'doctor',       displayName: 'BS. Trần Hải Yến (Mock Doc 2)',   phone: '0711000011', email: 'mvp.mock.doctor2@swan-mock.vn' },
  { role: 'nurse',        displayName: 'Nguyễn Thị Mai (Mock Nurse)',     phone: '0711000012', email: 'mvp.mock.nurse@swan-mock.vn' },
  { role: 'coordinator',  displayName: 'Trương Văn Khoa (Mock Coord)',    phone: '0711000013', email: 'mvp.mock.coordinator@swan-mock.vn' },
  { role: 'cskh_postop',  displayName: 'Phạm Ngọc Điệp (Mock CSKH)',      phone: '0711000014', email: 'mvp.mock.cskh@swan-mock.vn' },
  { role: 'media',        displayName: 'Lý Minh Tú (Mock Media)',         phone: '0711000015', email: 'mvp.mock.media@swan-mock.vn' },
];

// Highly_sensitive createdBy → admin (mvp-mock-user-001)
const ADMIN_USER_ID = newUserId(1);
const CEO_USER_ID = newUserId(2);
const CSO_USER_ID = newUserId(3);
const MASTER_SALES_ID = newUserId(4);
const SALES_ONLINE_IDS = [newUserId(5), newUserId(6)];
const SALES_OFFLINE_IDS = [newUserId(7), newUserId(8)];
const ACCOUNTANT_ID = newUserId(9);
const DOCTOR_IDS = [newUserId(10), newUserId(11)];
const NURSE_ID = newUserId(12);
const COORDINATOR_ID = newUserId(13);
const CSKH_ID = newUserId(14);
const MEDIA_ID = newUserId(15);

function genUsers(): Array<{ id: string; data: Record<string, unknown> }> {
  return USER_SPECS.map((spec, i) => {
    const id = newUserId(i + 1);
    addToCollection(userIds, id);
    const doc: Partial<User> & { seedBatchId: string; mockSeed: boolean } = {
      id,
      email: spec.email,
      displayName: spec.displayName,
      role: spec.role,
      phone: spec.phone,
      isActive: true,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
      seedBatchId: SEED_BATCH_ID,
      mockSeed: true,
    };
    return { id, data: doc as unknown as Record<string, unknown> };
  });
}

// 4 treatment locations — one of each TreatmentLocationType
const LOCATION_SPECS: Array<{
  name: string;
  type: TreatmentLocationType;
  address: string;
  contactPerson: string;
  contactPhone: string;
}> = [
  { name: 'Swan Clinic (Mock)',         type: 'swan',           address: '123 Nguyễn Thị Minh Khai, Q.1, TP.HCM',          contactPerson: 'Lễ tân Swan',       contactPhone: '028 1234 5678' },
  { name: 'Bệnh viện CIH (Mock)',      type: 'cih',            address: '200 Hoàng Văn Thụ, Q. Phú Nhuận, TP.HCM',       contactPerson: 'Phòng phẫu thuật CIH', contactPhone: '028 2345 6789' },
  { name: 'Bệnh viện Medika (Mock)',   type: 'medika',         address: '58 Trần Não, Q.2, TP.HCM',                      contactPerson: 'Phòng phẫu thuật Medika', contactPhone: '028 3456 7890' },
  { name: 'Bệnh viện liên kết (Mock)', type: 'other_hospital', address: '99 Nguyễn Văn Cừ, Q. Long Biên, Hà Nội',         contactPerson: 'Phòng phẫu thuật đối tác', contactPhone: '024 4567 8901' },
];

function genLocations(): Array<{ id: string; data: Record<string, unknown> }> {
  return LOCATION_SPECS.map((spec, i) => {
    const id = newLocationId(i + 1);
    addToCollection(locationIds, id);
    const doc: Partial<TreatmentLocation> & { seedBatchId: string } = {
      id,
      name: spec.name,
      type: spec.type,
      address: spec.address,
      contactPerson: spec.contactPerson,
      contactPhone: spec.contactPhone,
      active: true,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
      seedBatchId: SEED_BATCH_ID,
    };
    return { id, data: doc as unknown as Record<string, unknown> };
  });
}

// 18 services — full category coverage
const SERVICE_CATEGORIES: ServiceCategory[] = ['nose', 'breast', 'body', 'eyes', 'skin', 'injectable', 'other'];
const SERVICE_NAMES: Record<ServiceCategory, string[]> = {
  nose:       ['Nâng mũi cấu trúc', 'Nâng mũi cấu trúc Surgiform', 'Nâng mũi bán cấu trúc', 'Sửa mũi hỏng'],
  breast:     ['Nâng ngực Ergo 2', 'Nâng ngực Mentor', 'Mentor Boost', 'Ergonomix II', 'Thu quầng vú', 'Thu đầu ti'],
  body:       ['Hút mỡ 360', 'Hút mỡ bắp tay', 'Hút mỡ nách', 'Hút mỡ lưng trên', 'Hút mỡ nọng cằm'],
  eyes:       ['Cắt mắt 2 mí', 'Mở góc mắt', 'Lấy bọng mỡ mắt'],
  skin:       ['Trẻ hóa da Laser', 'Peel da sinh học'],
  injectable: ['Botox thon gọn hàm', 'Tiêm căng bóng da', 'Filler mũi'],
  other:      ['Tư vấn tổng quát'],
};
const SERVICE_PRICES: Record<ServiceCategory, [number, number]> = {
  nose:       [25_000_000, 40_000_000],
  breast:     [18_000_000, 75_000_000],
  body:       [12_000_000, 45_000_000],
  eyes:       [8_000_000,  20_000_000],
  skin:       [5_000_000,  15_000_000],
  injectable: [3_000_000,  10_000_000],
  other:      [0,          500_000],
};

function genServices(): Array<{ id: string; data: Record<string, unknown> }> {
  const out: Array<{ id: string; data: Record<string, unknown> }> = [];
  let seq = 1;
  for (const cat of SERVICE_CATEGORIES) {
    const names = SERVICE_NAMES[cat];
    for (const name of names) {
      const [lo, hi] = SERVICE_PRICES[cat];
      const price = lo === hi ? lo : lo + Math.floor(rand() * (hi - lo));
      const id = newServiceId(seq);
      addToCollection(serviceIds, id);
      const doc: Partial<Service> & { seedBatchId: string } = {
        id,
        name,
        category: cat,
        defaultPrice: price,
        active: true,
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO,
        seedBatchId: SEED_BATCH_ID,
      };
      out.push({ id, data: doc as unknown as Record<string, unknown> });
      seq++;
    }
  }
  return out;
}

// 110 customers — diverse demographics; createdBy weighted by privacyLevel
function genCustomers(): Array<{ id: string; data: Record<string, unknown> }> {
  const out: Array<{ id: string; data: Record<string, unknown> }> = [];
  for (let i = 1; i <= 110; i++) {
    const id = newCustomerId(i);
    const privacyLevel = pickPrivacyLevel();
    // Privacy-aware creator weighting:
    //   highly_sensitive → admin only
    //   vip              → management tier
    //   normal           → sales tier (master + online + offline)
    let createdBy: string;
    if (privacyLevel === 'highly_sensitive') {
      createdBy = ADMIN_USER_ID;
    } else if (privacyLevel === 'vip') {
      createdBy = pick([ADMIN_USER_ID, CEO_USER_ID, CSO_USER_ID, MASTER_SALES_ID]);
    } else {
      const r = rand();
      if (r < 0.7) createdBy = MASTER_SALES_ID;
      else createdBy = pick([MASTER_SALES_ID, ...SALES_ONLINE_IDS, ...SALES_OFFLINE_IDS]);
    }
    const isMale = rand() < 0.18;
    const fullName = isMale
      ? `${pick(SURNAMES_M)} ${pick(GIVEN_M)} ${pick(GIVEN_M_TRAIL)}`
      : `${pick(SURNAMES_F)} ${pick(GIVEN_F)} ${pick(GIVEN_F_TRAIL)}`;
    const phone = generatePhone(i);
    phonesUsed.add(phone);
    const source = pick(SOURCES);
    const createdAt = daysAgo(rangeInt(0, 180)).toISOString();

    const customerCode = generateCustomerCode(i);

    const doc: Partial<Customer> & { seedBatchId: string } = {
      id,
      customerCode,
      fullName,
      phone,
      privacyLevel,
      source: source.value,
      sourceDetail: source.detail,
      createdBy,
      createdAt,
      updatedAt: createdAt,
      seedBatchId: SEED_BATCH_ID,
    };

    if (chance(0.18)) {
      const sp = generatePhone(i + 10_000);
      if (!phonesUsed.has(sp)) {
        phonesUsed.add(sp);
        doc.secondaryPhone = sp;
      }
    }
    if (chance(0.92)) {
      doc.dateOfBirth = randomBirthYear();
      doc.gender = isMale ? 'male' : 'female';
    }
    if (chance(0.92)) {
      const number = rangeInt(1, 200);
      const street = pick(STREETS);
      const ward = `P.${rangeInt(1, 30)}`;
      const district = pick(HO_CHI_MINH_DISTRICTS);
      doc.address = `${number} ${street}, ${ward}, ${district}, TP.HCM`;
    }
    if (privacyLevel !== 'highly_sensitive' && chance(0.7)) {
      doc.nationalIdNumber = `07900${pad4(100_000 + i)}`;
      doc.nationalIdIssueDate = '2020-01-15';
      doc.nationalIdIssuePlace = 'TP.HCM';
    }
    if (chance(0.55)) {
      doc.emergencyContactName = `${pick(SURNAMES_F)} ${pick(GIVEN_F_TRAIL)}`;
      const ep = generatePhone(i + 20_000);
      if (!phonesUsed.has(ep)) {
        phonesUsed.add(ep);
        doc.emergencyContactPhone = ep;
      }
    }
    // Zalo explicitly NOT linked to phone — use mock OA pattern
    doc.zalo = `zalo.me/swan-mock-${customerCode}`;
    if (chance(0.35)) {
      doc.facebook = `facebook.com/mock.${customerCode}`;
    }
    if (chance(0.86)) {
      const mn = pick(MEDICAL_NOTES);
      if (mn !== undefined) doc.medicalNote = mn;
    }
    if (privacyLevel !== 'normal' && chance(0.6)) {
      const pn = pick(PRIVACY_NOTES);
      if (pn !== undefined) doc.privacyNote = pn;
    }

    addToCollection(customerIds, id);
    out.push({ id, data: doc as unknown as Record<string, unknown> });
  }
  return out;
}

function pickCreator(): string {
  // Most customers are created by sales tier; VIPs / highly_sensitive by management
  const r = rand();
  if (r < 0.7) return MASTER_SALES_ID;
  return pick([MASTER_SALES_ID, ...SALES_ONLINE_IDS, ...SALES_OFFLINE_IDS]);
}

// (pickCreatorForPrivacy was removed — covered by privacy-aware weighting
// done inside genCustomers itself with `pickPrivacyLevel()` first.)

// 100 cases — distributed across 28 statuses, linked to mock customers & locations
const CASE_STATUS_DIST: Array<{ status: CaseStatus; count: number }> = [
  { status: 'draft', count: 5 },
  { status: 'waiting_customer_info', count: 5 },
  { status: 'waiting_payment_confirmation', count: 5 },
  { status: 'payment_confirmed', count: 10 },
  { status: 'waiting_location_assignment', count: 4 },
  { status: 'waiting_hospital_confirmation', count: 4 },
  { status: 'hospital_confirmed', count: 4 },
  { status: 'waiting_doctor_review', count: 3 },
  { status: 'waiting_lab_test', count: 3 },
  { status: 'lab_test_done', count: 3 },
  { status: 'medically_approved', count: 5 },
  { status: 'scheduled', count: 5 },
  { status: 'reminder_sent', count: 3 },
  { status: 'checked_in', count: 3 },
  { status: 'in_procedure', count: 3 },
  { status: 'procedure_completed', count: 6 },
  { status: 'waiting_images_upload', count: 2 },
  { status: 'post_op_d1', count: 2 },
  { status: 'post_op_d3', count: 2 },
  { status: 'post_op_d7', count: 2 },
  { status: 'post_op_d14', count: 2 },
  { status: 'post_op_d30', count: 2 },
  { status: 'post_op_d90', count: 1 },
  { status: 'completed', count: 6 },
  { status: 'postponed', count: 2 },
  { status: 'cancelled', count: 2 },
  { status: 'complaint', count: 3 },
  { status: 'medical_alert', count: 1 },
  { status: 'medical_alert_resolved', count: 2 },
];
// total = 100

const CASE_SERVICE_GROUP_DIST: ServiceCategory[] = [
  'breast', 'breast', 'breast', 'breast',
  'nose', 'nose', 'nose',
  'body', 'body',
  'eyes',
  'skin',
  'injectable', 'injectable',
];

const STATUS_NEEDS_BILL: Set<CaseStatus> = new Set<CaseStatus>([
  'payment_confirmed', 'waiting_location_assignment', 'waiting_hospital_confirmation',
  'hospital_confirmed', 'waiting_doctor_review', 'waiting_lab_test', 'lab_test_done',
  'medically_approved', 'scheduled', 'reminder_sent', 'checked_in', 'in_procedure',
  'procedure_completed', 'waiting_images_upload',
  'post_op_d1', 'post_op_d3', 'post_op_d7', 'post_op_d14', 'post_op_d30', 'post_op_d90',
  'completed', 'postponed', 'cancelled', 'complaint', 'medical_alert', 'medical_alert_resolved',
]);

const STATUS_NEEDS_PROCEDURE_DATE: Set<CaseStatus> = new Set<CaseStatus>([
  'procedure_completed', 'waiting_images_upload',
  'post_op_d1', 'post_op_d3', 'post_op_d7', 'post_op_d14', 'post_op_d30', 'post_op_d90',
  'completed', 'complaint', 'medical_alert', 'medical_alert_resolved',
]);

interface CaseGen {
  caseId: string;
  customerId: string;
  status: CaseStatus;
  privacyLevel: 'normal' | 'vip' | 'highly_sensitive';
  mainServiceGroup: ServiceCategory;
  totalBillAfterDiscount: number;
  amountPaid: number;
  remainingAmount: number;
  paymentStatus: 'unpaid' | 'deposit' | 'partial' | 'paid' | 'refunded';
  caseDate: string;
  expectedProcedureDate?: string;
  actualProcedureDate?: string;
  treatmentLocationId?: string;
  medicalNote?: string;
  salesNote?: string;
  lastEscalatedAt?: string;
  priority: 'normal' | 'high' | 'urgent';
}

function buildCaseForStatus(
  status: CaseStatus,
  caseIndex: number,
): CaseGen {
  const customerId = pick([...customerIds]);
  const mainServiceGroup = pick(CASE_SERVICE_GROUP_DIST);
  // bill (in VND)
  const [lo, hi] = SERVICE_PRICES[mainServiceGroup];
  const base = lo === hi ? lo : lo + Math.floor(rand() * (hi - lo));
  const discountValue = pick([0, 1_000_000, 2_000_000, 5_000_000]);
  const totalBefore = base + (chance(0.4) ? rangeInt(2_000_000, 12_000_000) : 0); // upsell
  const totalAfter = Math.max(0, totalBefore - discountValue);

  // paymentStatus ↔ case status invariant
  const hasBill = STATUS_NEEDS_BILL.has(status);
  const isPostProcedure = STATUS_NEEDS_PROCEDURE_DATE.has(status);
  let paymentStatus: CaseGen['paymentStatus'];
  let amountPaid: number;
  if (!hasBill) {
    paymentStatus = status === 'draft' ? 'unpaid' : 'unpaid';
    amountPaid = 0;
  } else if (status === 'cancelled') {
    paymentStatus = chance(0.5) ? 'deposit' : 'refunded';
    amountPaid = paymentStatus === 'refunded' ? 0 : Math.floor(totalAfter * 0.2);
  } else if (isPostProcedure || status === 'completed') {
    paymentStatus = 'paid';
    amountPaid = totalAfter;
  } else {
    // mid-funnel: deposit or partial
    paymentStatus = chance(0.4) ? 'deposit' : 'partial';
    amountPaid = Math.floor(totalAfter * (chance(0.5) ? 0.3 : 0.5));
  }
  const remainingAmount = Math.max(0, totalAfter - amountPaid);

  // procedure dates
  let expectedProcedureDate: string | undefined;
  let actualProcedureDate: string | undefined;
  if (hasBill) {
    const caseDaysBack = rangeInt(30, 180);
    const caseDate = daysAgo(caseDaysBack).toISOString();
    if (status !== 'draft' && status !== 'waiting_customer_info' && status !== 'waiting_payment_confirmation') {
      expectedProcedureDate = caseDate;
    }
    if (isPostProcedure) {
      const procDaysBack = rangeInt(1, 80);
      actualProcedureDate = daysAgo(procDaysBack).toISOString();
    }
  }

  // location
  let treatmentLocationId: string | undefined;
  if (STATUS_NEEDS_BILL.has(status) && status !== 'draft' && status !== 'waiting_customer_info') {
    treatmentLocationId = pick([...locationIds]);
  }

  // privacy level inherited (approximated) from the customer distribution
  const pr = rand();
  const privacyLevel = pr < 0.78 ? 'normal' : pr < 0.94 ? 'vip' : 'highly_sensitive';

  const priority: CaseGen['priority'] =
    status === 'medical_alert' || status === 'in_procedure' || status === 'complaint'
      ? 'urgent'
      : status === 'waiting_doctor_review' || status === 'medically_approved' || status === 'scheduled'
        ? 'high'
        : 'normal';

  const lastEscalatedAt =
    (status === 'medical_alert' || status === 'complaint') && chance(0.3)
      ? new Date(NOW.getTime() - 2 * 3600 * 1000).toISOString()
      : undefined;

  const caseDate = (hasBill ? daysAgo(rangeInt(2, 90)) : daysAgo(rangeInt(0, 5))).toISOString();

  return {
    caseId: newCaseId(caseIndex),
    customerId,
    status,
    privacyLevel,
    mainServiceGroup,
    totalBillAfterDiscount: totalAfter,
    amountPaid,
    remainingAmount,
    paymentStatus,
    caseDate,
    expectedProcedureDate,
    actualProcedureDate,
    treatmentLocationId,
    salesNote: `Mock seed — ${status} case`,
    medicalNote: chance(0.4) ? pick(MEDICAL_NOTES.filter((n) => typeof n === 'string') as string[]) : undefined,
    lastEscalatedAt,
    priority,
  };
}

function genCasesAndRelations(): {
  cases: Array<{ id: string; data: Record<string, unknown> }>;
  caseServices: Array<{ id: string; data: Record<string, unknown> }>;
  payments: Array<{ id: string; data: Record<string, unknown> }>;
  staffAssignments: Array<{ id: string; data: Record<string, unknown> }>;
  hospitalCoordinations: Array<{ id: string; data: Record<string, unknown> }>;
} {
  const cases: Array<{ id: string; data: Record<string, unknown> }> = [];
  const caseServices: Array<{ id: string; data: Record<string, unknown> }> = [];
  const payments: Array<{ id: string; data: Record<string, unknown> }> = [];
  const staffAssignments: Array<{ id: string; data: Record<string, unknown> }> = [];
  const hospitalCoordinations: Array<{ id: string; data: Record<string, unknown> }> = [];

  let caseSeq = 1;
  let csvcSeq = 1;
  let paySeq = 1;
  let saSeq = 1;
  let coordSeq = 1;

  // Build a flat list of (status, count) pairs so we iterate exactly 100 cases
  const queue: CaseStatus[] = [];
  for (const bucket of CASE_STATUS_DIST) {
    for (let n = 0; n < bucket.count; n++) queue.push(bucket.status);
  }
  if (queue.length !== 100) {
    err(`CASE_STATUS_DIST sums to ${queue.length}, expected 100`);
  }

  for (const status of queue) {
    const g = buildCaseForStatus(status, caseSeq);
    addToCollection(caseIds, g.caseId);

    const doc: Partial<CaseRecord> & { seedBatchId: string; mockSeed: boolean } = {
      id: g.caseId,
      caseCode: generateCaseCode(caseSeq),
      customerId: g.customerId,
      caseDate: g.caseDate,
      mainServiceGroup: g.mainServiceGroup,
      status: g.status,
      priority: g.priority,
      totalBillBeforeDiscount: g.totalBillAfterDiscount,
      discountType: 'none',
      totalBillAfterDiscount: g.totalBillAfterDiscount,
      amountPaid: g.amountPaid,
      remainingAmount: g.remainingAmount,
      paymentStatus: g.paymentStatus,
      privacyLevel: g.privacyLevel,
      createdBy: pick([MASTER_SALES_ID, ...SALES_ONLINE_IDS, ...SALES_OFFLINE_IDS]),
      createdAt: g.caseDate,
      updatedAt: NOW_ISO,
      active: true,
      seedBatchId: SEED_BATCH_ID,
      mockSeed: true,
    };
    if (g.expectedProcedureDate !== undefined) doc.expectedProcedureDate = g.expectedProcedureDate;
    if (g.actualProcedureDate !== undefined) doc.actualProcedureDate = g.actualProcedureDate;
    if (g.treatmentLocationId !== undefined) {
      doc.treatmentLocationId = g.treatmentLocationId;
      const locType = LOCATION_SPECS.find((_, i) => newLocationId(i + 1) === g.treatmentLocationId);
      if (locType) {
        const mapType: Record<TreatmentLocationType, CaseRecord['treatmentLocationType']> = {
          swan: 'swan',
          cih: 'cih',
          medika: 'medika',
          other_hospital: 'other_hospital',
        };
        doc.treatmentLocationType = mapType[locType.type];
      }
    }
    if (g.salesNote !== undefined) doc.salesNote = g.salesNote;
    if (g.medicalNote !== undefined) doc.medicalNote = g.medicalNote;
    if (g.lastEscalatedAt !== undefined) doc.lastEscalatedAt = g.lastEscalatedAt;
    cases.push({ id: g.caseId, data: doc as unknown as Record<string, unknown> });

    // CaseService(s) — 1 main + 0..2 upsells
    const svcListForCat = SERVICE_NAMES[g.mainServiceGroup];
    const mainServiceName = svcListForCat[0]!;
    const [lo, hi] = SERVICE_PRICES[g.mainServiceGroup];
    const mainPrice = lo === hi ? lo : lo + Math.floor(rand() * (hi - lo));
    const csId1 = newCaseServiceId(csvcSeq++);
    caseServices.push({
      id: csId1,
      data: {
        id: csId1,
        caseId: g.caseId,
        serviceName: mainServiceName,
        serviceCategory: g.mainServiceGroup,
        listedPrice: mainPrice,
        finalPrice: mainPrice,
        quantity: 1,
        isMainService: true,
        isGift: false,
        isUpsell: false,
        createdAt: g.caseDate,
        updatedAt: g.caseDate,
        active: true,
        seedBatchId: SEED_BATCH_ID,
      },
    });
    // Optional upsell
    if (g.totalBillAfterDiscount > mainPrice && chance(0.4)) {
      const upsellCat: ServiceCategory = pick(['eyes', 'skin', 'injectable']);
      const upsellName = pick(SERVICE_NAMES[upsellCat]);
      const [uLo, uHi] = SERVICE_PRICES[upsellCat];
      const upsellPrice = uLo === hi ? uLo : uLo + Math.floor(rand() * (uHi - uLo));
      const csId2 = newCaseServiceId(csvcSeq++);
      caseServices.push({
        id: csId2,
        data: {
          id: csId2,
          caseId: g.caseId,
          serviceName: upsellName,
          serviceCategory: upsellCat,
          listedPrice: upsellPrice,
          finalPrice: upsellPrice,
          quantity: 1,
          isMainService: false,
          isGift: false,
          isUpsell: true,
          createdAt: g.caseDate,
          updatedAt: g.caseDate,
          active: true,
          seedBatchId: SEED_BATCH_ID,
        },
      });
    }

    // Payments — emit per case as per paymentStatus
    if (g.amountPaid > 0) {
      const pId = newPaymentId(paySeq++);
      payments.push({
        id: pId,
        data: {
          id: pId,
          caseId: g.caseId,
          customerId: g.customerId,
          amount: g.amountPaid,
          paymentMethod: pick(['cash', 'bank_transfer', 'card', 'installment', 'other'] as PaymentMethod[]),
          paymentType: g.paymentStatus === 'paid' ? 'full' : (g.paymentStatus === 'deposit' ? 'deposit' : 'partial'),
          receivedBy: pick([MASTER_SALES_ID, ...SALES_ONLINE_IDS, ...SALES_OFFLINE_IDS]),
          paymentDate: g.actualProcedureDate ?? g.caseDate,
          status: 'confirmed' as PaymentRecordStatus,
          confirmedBy: ACCOUNTANT_ID,
          confirmedAt: NOW_ISO,
          createdBy: pick([MASTER_SALES_ID, ...SALES_ONLINE_IDS, ...SALES_OFFLINE_IDS]),
          createdAt: g.caseDate,
          updatedAt: NOW_ISO,
          seedBatchId: SEED_BATCH_ID,
        },
      });
    }
    // Pending payments for some cases
    if (g.paymentStatus === 'deposit' && chance(0.5)) {
      const pId2 = newPaymentId(paySeq++);
      payments.push({
        id: pId2,
        data: {
          id: pId2,
          caseId: g.caseId,
          customerId: g.customerId,
          amount: g.remainingAmount,
          paymentMethod: pick(['bank_transfer', 'installment'] as PaymentMethod[]),
          paymentType: 'partial' as PaymentType,
          paymentDate: NOW_ISO,
          status: 'pending' as PaymentRecordStatus,
          createdBy: pick([MASTER_SALES_ID, ...SALES_ONLINE_IDS, ...SALES_OFFLINE_IDS]),
          createdAt: NOW_ISO,
          updatedAt: NOW_ISO,
          seedBatchId: SEED_BATCH_ID,
        },
      });
    }
    // Refund record for cancelled case
    if (g.paymentStatus === 'refunded' && g.amountPaid > 0) {
      const pId3 = newPaymentId(paySeq++);
      payments.push({
        id: pId3,
        data: {
          id: pId3,
          caseId: g.caseId,
          customerId: g.customerId,
          amount: g.amountPaid,
          paymentMethod: 'bank_transfer' as PaymentMethod,
          paymentType: 'refund' as PaymentType,
          paymentDate: NOW_ISO,
          status: 'confirmed' as PaymentRecordStatus,
          confirmedBy: ACCOUNTANT_ID,
          confirmedAt: NOW_ISO,
          createdBy: ACCOUNTANT_ID,
          createdAt: NOW_ISO,
          updatedAt: NOW_ISO,
          note: 'Hoàn tiền do khách hủy',
          seedBatchId: SEED_BATCH_ID,
        },
      });
    }

    // StaffAssignment — 1 per major case (mid-funnel or past)
    if (STATUS_NEEDS_BILL.has(status)) {
      const saId = newStaffAssignmentId(saSeq++);
      const saDoc: Partial<StaffAssignment> & { seedBatchId: string } = {
        id: saId,
        caseId: g.caseId,
        masterSalesId: MASTER_SALES_ID,
        doctorId: pick(DOCTOR_IDS),
        coordinatorId: COORDINATOR_ID,
        cskhPostopId: CSKH_ID,
        assignedBy: pick([MASTER_SALES_ID, ...SALES_ONLINE_IDS, ...SALES_OFFLINE_IDS]),
        createdAt: g.caseDate,
        updatedAt: NOW_ISO,
        seedBatchId: SEED_BATCH_ID,
      };
      // Sales offline for body cases, online for nose/eyes
      if (g.mainServiceGroup === 'body' || g.mainServiceGroup === 'breast') {
        saDoc.salesOfflineId = pick(SALES_OFFLINE_IDS);
      } else {
        saDoc.salesOnlineId = pick(SALES_ONLINE_IDS);
      }
      if (status === 'scheduled' || status === 'reminder_sent' || status === 'checked_in' || status === 'in_procedure' || isPostProcedureStatus(status)) {
        saDoc.nurseIds = [NURSE_ID];
        saDoc.accountantId = ACCOUNTANT_ID;
      }
      staffAssignments.push({ id: saId, data: saDoc as unknown as Record<string, unknown> });
    }

    // HospitalCoordination — for hospital-confirmed and beyond
    if (
      status === 'hospital_confirmed' ||
      status === 'medically_approved' ||
      status === 'scheduled' ||
      status === 'reminder_sent' ||
      status === 'checked_in' ||
      status === 'in_procedure' ||
      isPostProcedureStatus(status)
    ) {
      const cId = newCoordinationId(coordSeq++);
      hospitalCoordinations.push({
        id: cId,
        data: {
          id: cId,
          caseId: g.caseId,
          treatmentLocationId: g.treatmentLocationId ?? pick([...locationIds]),
          hospitalNotified: true,
          hospitalConfirmed: true,
          operatingRoomConfirmed: status !== 'hospital_confirmed' && status !== 'medically_approved',
          labScheduleConfirmed: chance(0.6),
          doctorScheduleConfirmed: status !== 'hospital_confirmed',
          hospitalNote: `Mock seed coordination`,
          coordinatorId: COORDINATOR_ID,
          notifiedAt: g.caseDate,
          confirmedAt: g.caseDate,
          createdAt: g.caseDate,
          updatedAt: NOW_ISO,
          seedBatchId: SEED_BATCH_ID,
        },
      });
    }

    caseSeq++;
  }

  return { cases, caseServices, payments, staffAssignments, hospitalCoordinations };
}

function isPostProcedureStatus(s: CaseStatus): boolean {
  return [
    'procedure_completed', 'waiting_images_upload',
    'post_op_d1', 'post_op_d3', 'post_op_d7', 'post_op_d14', 'post_op_d30', 'post_op_d90',
    'completed', 'complaint', 'medical_alert', 'medical_alert_resolved',
  ].includes(s);
}

// 40 tasks — assigned to various roles across cases/customers/departments
const TASK_TEMPLATES: Array<{ title: string; department: TaskDepartment; priority: TaskPriority }> = [
  { title: 'Liên hệ khách xác nhận lịch xét nghiệm', department: 'coordination', priority: 'high' },
  { title: 'Chuẩn bị hồ sơ bệnh viện', department: 'coordination', priority: 'high' },
  { title: 'Xác nhận kết quả xét nghiệm', department: 'medical', priority: 'normal' },
  { title: 'Upload ảnh before/after cho khách KOC', department: 'media', priority: 'normal' },
  { title: 'Gọi followup D7/D14/D30', department: 'postop', priority: 'high' },
  { title: 'Tổng hợp báo cáo doanh thu tháng', department: 'accounting', priority: 'normal' },
  { title: 'Hoàn tất ảnh case Mentor Boost', department: 'media', priority: 'low' },
  { title: 'Nhập lead mới từ Facebook Ads', department: 'sales', priority: 'normal' },
  { title: 'Tư vấn gói nâng mũi Surgiform', department: 'sales', priority: 'normal' },
  { title: 'Xử lý khiếu nại khách hàng', department: 'postop', priority: 'urgent' },
  { title: 'Đối soát công nợ cuối ngày', department: 'accounting', priority: 'normal' },
  { title: 'Đặt lịch tái khám cho khách', department: 'nursing', priority: 'high' },
  { title: 'Chụp ảnh before/after case hoàn thành', department: 'media', priority: 'low' },
  { title: 'Kiểm tra hồ sơ bệnh án nhập viện', department: 'medical', priority: 'high' },
];

function genTasks(): Array<{ id: string; data: Record<string, unknown> }> {
  const out: Array<{ id: string; data: Record<string, unknown> }> = [];
  const statusesForTasks: TaskStatus[] = ['todo', 'in_progress', 'done', 'overdue', 'cancelled'];

  for (let i = 1; i <= 40; i++) {
    const tpl = pick(TASK_TEMPLATES);
    const status: TaskStatus = pick(statusesForTasks);
    const id = newTaskId(i);
    const caseId = chance(0.7) ? pick([...caseIds]) : undefined;
    const customerId = chance(0.85) ? (caseId ? pick([...customerIds]) : pick([...customerIds])) : undefined;
    const createdAt = daysAgo(rangeInt(0, 90)).toISOString();
    const completedAt = status === 'done' ? daysAgo(rangeInt(0, 5)).toISOString() : undefined;
    const dueDate = daysAhead(rangeInt(-2, 30)).toISOString();

    const assignedToByDept: Record<TaskDepartment, string> = {
      sales: pick([MASTER_SALES_ID, ...SALES_ONLINE_IDS, ...SALES_OFFLINE_IDS]),
      accounting: ACCOUNTANT_ID,
      medical: pick(DOCTOR_IDS),
      nursing: NURSE_ID,
      coordination: COORDINATOR_ID,
      postop: CSKH_ID,
      media: MEDIA_ID,
      management: pick([ADMIN_USER_ID, CEO_USER_ID, CSO_USER_ID]),
    };

    const doc: Partial<Task> & { seedBatchId: string } = {
      id,
      title: `${tpl.title} (#${i})`,
      ...(caseId !== undefined ? { caseId } : {}),
      ...(customerId !== undefined ? { customerId } : {}),
      assignedTo: assignedToByDept[tpl.department],
      department: tpl.department,
      priority: tpl.priority,
      status,
      createdBy: ADMIN_USER_ID,
      createdAt,
      ...(completedAt !== undefined ? { completedAt } : {}),
      updatedAt: NOW_ISO,
      seedBatchId: SEED_BATCH_ID,
    };
    out.push({ id, data: doc as unknown as Record<string, unknown> });
  }
  return out;
}

// 80 appointments — across 6 types and 5 statuses
const APPT_TYPE_DIST: Array<{ type: AppointmentType; count: number }> = [
  { type: 'consultation', count: 18 },
  { type: 'lab_test', count: 14 },
  { type: 'procedure', count: 12 },
  { type: 'checkup', count: 14 },
  { type: 'postop_followup', count: 18 },
  { type: 'hospital_coordination', count: 4 },
];
// total = 80
const APPT_STATUS_DIST: AppointmentStatus[] = [
  'scheduled', 'scheduled', 'confirmed', 'confirmed', 'completed', 'completed', 'completed', 'cancelled', 'no_show',
];

function genAppointments(): Array<{ id: string; data: Record<string, unknown> }> {
  const out: Array<{ id: string; data: Record<string, unknown> }> = [];
  const queue: AppointmentType[] = [];
  for (const b of APPT_TYPE_DIST) for (let n = 0; n < b.count; n++) queue.push(b.type);
  let seq = 1;
  for (const type of queue) {
    const id = newAppointmentId(seq);
    const caseId = pick([...caseIds]);
    const customerId = pick([...customerIds]);
    const status: AppointmentStatus = pick(APPT_STATUS_DIST);
    const startTime = daysAgo(rangeInt(-10, 60)).toISOString(); // some past, some future
    const assignedStaffIds = ['doctor', 'nurse', 'coord'].includes(type)
      ? [pick(DOCTOR_IDS), NURSE_ID, COORDINATOR_ID]
      : [COORDINATOR_ID];
    const locationId = type === 'lab_test' || type === 'procedure' || type === 'hospital_coordination'
      ? pick([...locationIds])
      : locationIds.values().next().value as string;

    const titleByType: Record<AppointmentType, string> = {
      consultation: 'Tư vấn',
      lab_test: 'Xét nghiệm',
      procedure: 'Phẫu thuật',
      checkup: 'Tái khám',
      postop_followup: 'Followup sau mổ',
      hospital_coordination: 'Phối hợp bệnh viện',
    };

    const doc: Partial<Appointment> & { seedBatchId: string } = {
      id,
      caseId,
      customerId,
      type,
      title: titleByType[type],
      startTime,
      ...(locationId !== undefined ? { locationId } : {}),
      assignedStaffIds,
      status,
      createdBy: COORDINATOR_ID,
      createdAt: daysAgo(rangeInt(30, 90)).toISOString(),
      updatedAt: NOW_ISO,
      seedBatchId: SEED_BATCH_ID,
    };
    out.push({ id, data: doc as unknown as Record<string, unknown> });
    seq++;
  }
  return out;
}

// 50 consents — 4 types × 4 statuses, mixed
const CONSENT_TYPE_DIST: ConsentType[] = [
  'treatment', 'treatment', 'treatment', 'treatment', 'treatment', 'treatment',
  'image_storage', 'image_storage', 'image_storage',
  'marketing_usage', 'marketing_usage',
  'hospital_sharing', 'hospital_sharing',
];
const CONSENT_STATUS_DIST: ConsentStatus[] = [
  'granted', 'granted', 'granted', 'granted', 'granted', 'granted', 'granted', // ~56%
  'pending', 'pending', // ~16%
  'denied', // ~14%
  'revoked', // ~14%
];

function genConsents(): Array<{ id: string; data: Record<string, unknown> }> {
  const out: Array<{ id: string; data: Record<string, unknown> }> = [];
  for (let i = 1; i <= 50; i++) {
    const id = newConsentId(i);
    addToCollection(consentIds, id);
    const type: ConsentType = pick(CONSENT_TYPE_DIST);
    const status: ConsentStatus = pick(CONSENT_STATUS_DIST);
    const customerId = pick([...customerIds]);
    const caseId = chance(0.7) ? pick([...caseIds]) : undefined;
    const signedBy = (status === 'granted' || status === 'denied') ? pick([MASTER_SALES_ID, ...DOCTOR_IDS, COORDINATOR_ID]) : undefined;
    const signedAt = signedBy !== undefined ? daysAgo(rangeInt(0, 90)).toISOString() : undefined;
    const noteByType: Record<ConsentType, string> = {
      treatment: 'Đồng ý điều trị',
      image_storage: 'Đồng ý lưu trữ hình ảnh y tế',
      marketing_usage: 'Đồng ý/không đồng ý sử dụng hình ảnh cho marketing',
      hospital_sharing: 'Đồng ý chia sẻ hồ sơ với bệnh viện',
    };
    const note = status === 'pending' ? undefined : noteByType[type];
    const createdAt = daysAgo(rangeInt(10, 100)).toISOString();

    const doc: Partial<Consent> & { seedBatchId: string } = {
      id,
      customerId,
      ...(caseId !== undefined ? { caseId } : {}),
      consentType: type,
      consentStatus: status,
      ...(signedAt !== undefined ? { signedAt } : {}),
      ...(signedBy !== undefined ? { signedBy } : {}),
      ...(note !== undefined ? { note } : {}),
      createdAt,
      updatedAt: signedAt ?? createdAt,
      seedBatchId: SEED_BATCH_ID,
    };
    out.push({ id, data: doc as unknown as Record<string, unknown> });
  }
  return out;
}

// 110 followups — D1/D3/D7/D14/D30/D90 across post-procedure cases
const FOLLOWUP_DAYS: Array<{ day: FollowupDay; offset: number }> = [
  { day: 'D1',  offset: 1 },
  { day: 'D3',  offset: 3 },
  { day: 'D7',  offset: 7 },
  { day: 'D14', offset: 14 },
  { day: 'D30', offset: 30 },
  { day: 'D90', offset: 90 },
];
const FOLLOWUP_STATUS_DIST: FollowupStatus[] = [
  'completed', 'completed', 'completed', 'completed', 'completed', 'completed',
  'pending', 'pending',
  'contacted', 'contacted',
  'no_response',
  'issue_reported',
];

function genFollowups(): Array<{ id: string; data: Record<string, unknown> }> {
  const out: Array<{ id: string; data: Record<string, unknown> }> = [];
  let seq = 1;
  // Track which cases have already been seeded to followups (avoid duplicates)
  const done = new Set<string>();
  // One sweep over all cases; for each post_procedure status, emit a partial trail
  const postProcCases = isPostProcedureStatusDistribution();
  for (const caseMeta of postProcCases) {
    if (seq > 110) break;
    const procDate = caseMeta.actualProcedureDate ?? caseMeta.caseDate;
    const procDateObj = new Date(procDate);
    const maxDay = pickIndex(FOLLOWUP_DAYS); // 0..5 — randomize how many followups per case
    for (let i = 0; i <= maxDay; i++) {
      if (seq > 110) break;
      const fd = FOLLOWUP_DAYS[i]!;
      const status: FollowupStatus = pick(FOLLOWUP_STATUS_DIST);
      const dueDate = daysFrom(procDateObj, fd.offset);
      // severity levels
      const sev = (rangeInt(0, 5) as SeverityLevel);
      const id = newFollowupId(seq);
      const doc: Partial<Followup> & { seedBatchId: string } = {
        id,
        caseId: caseMeta.caseId,
        customerId: caseMeta.customerId,
        followupDay: fd.day,
        dueDate,
        assignedTo: CSKH_ID,
        status,
        requestedImage: chance(0.6),
        imageUploaded: status === 'completed' ? chance(0.8) : chance(0.2),
        painLevel: sev,
        swellingLevel: sev,
        bruisingLevel: sev,
        customerPhone: pick([...customerIds]).length > 0 ? '0710000001' : undefined,
        createdAt: daysFrom(procDateObj, -1),
        updatedAt: NOW_ISO,
        seedBatchId: SEED_BATCH_ID,
      };
      if (status === 'issue_reported') {
        doc.note = `Khách báo sưng/đau — đã liên hệ BS`;
        doc.nextAction = 'Tái khám sớm';
      } else if (status === 'no_response') {
        doc.note = 'Khách không nghe máy';
      } else if (status === 'completed') {
        doc.customerCondition = status === 'completed' ? 'Ổn định' : undefined;
      }
      out.push({ id, data: doc as unknown as Record<string, unknown> });
      done.add(caseMeta.caseId);
      seq++;
    }
  }
  return out;
}

function isPostProcedureStatusDistribution(): Array<{ caseId: string; customerId: string; actualProcedureDate?: string; caseDate: string }> {
  // We need to align with genCases — use the same distribution
  // but case IDs/customer IDs we already tracked in caseIds + customerIds
  const result: Array<{ caseId: string; customerId: string; actualProcedureDate?: string; caseDate: string }> = [];
  // Generate a NEW queue mirroring CASE_STATUS_DIST but only for post-procedure statuses
  const casesList = [...caseIds];
  const customersList = [...customerIds];
  const postStatuses = CASE_STATUS_DIST.filter((b) =>
    isPostProcedureStatus(b.status),
  );
  for (const bucket of postStatuses) {
    for (let n = 0; n < bucket.count; n++) {
      const caseId = casesList[result.length % casesList.length]!;
      const customerId = customersList[result.length % customersList.length]!;
      const procDate = daysAgo(rangeInt(1, 80));
      result.push({
        caseId,
        customerId,
        actualProcedureDate: procDate.toISOString(),
        caseDate: procDate.toISOString(),
      });
    }
  }
  return result;
}

// 25 attachments — various types & visibilities
const ATT_TYPE_DIST: AttachmentType[] = [
  'national_id_front', 'national_id_back',
  'payment_proof', 'payment_proof',
  'before_image', 'immediately_after_image',
  'postop_d1', 'postop_d3', 'postop_d7', 'postop_d14', 'postop_d30',
  'medical_document', 'consent_form', 'other',
];
const ATT_VIS_DIST: AttachmentVisibility[] = [
  'private', 'private',
  'medical_team', 'medical_team',
  'sales_team',
  'media_approved',
];

function genAttachments(): Array<{ id: string; data: Record<string, unknown> }> {
  const out: Array<{ id: string; data: Record<string, unknown> }> = [];
  for (let i = 1; i <= 25; i++) {
    const id = newAttachmentId(i);
    const caseId = pick([...caseIds]);
    const customerId = pick([...customerIds]);
    const type: AttachmentType = pick(ATT_TYPE_DIST);
    const visibility: AttachmentVisibility = pick(ATT_VIS_DIST);
    const consentId = (type === 'before_image' || type === 'immediately_after_image' || type === 'consent_form')
      ? pick([...consentIds])
      : undefined;
    const extMap: Partial<Record<AttachmentType, string>> = {
      national_id_front: 'jpg', national_id_back: 'jpg',
      payment_proof: 'pdf', before_image: 'jpg', immediately_after_image: 'jpg',
      postop_d1: 'jpg', postop_d3: 'jpg', postop_d7: 'jpg', postop_d14: 'jpg', postop_d30: 'jpg', postop_d90: 'jpg',
      medical_document: 'pdf', consent_form: 'pdf', other: 'bin',
    };
    const ext = extMap[type] ?? 'bin';
    const mimeMap: Partial<Record<AttachmentType, string>> = {
      national_id_front: 'image/jpeg', national_id_back: 'image/jpeg',
      payment_proof: 'application/pdf',
      before_image: 'image/jpeg', immediately_after_image: 'image/jpeg',
      postop_d1: 'image/jpeg', postop_d3: 'image/jpeg', postop_d7: 'image/jpeg', postop_d14: 'image/jpeg', postop_d30: 'image/jpeg', postop_d90: 'image/jpeg',
      medical_document: 'application/pdf', consent_form: 'application/pdf', other: 'application/octet-stream',
    };
    const doc: Partial<Attachment> & { seedBatchId: string } = {
      id,
      caseId,
      customerId,
      type,
      fileName: `${id}.${ext}`,
      fileUrl: `https://mock-cdn.swan.vn/seed/${id}.${ext}`,
      storagePath: `seed/${id}.${ext}`,
      mimeType: mimeMap[type] ?? 'application/octet-stream',
      size: rangeInt(100_000, 5_000_000),
      visibility,
      consentRequired: type === 'before_image' || type === 'immediately_after_image',
      ...(consentId !== undefined ? { consentId } : {}),
      uploadedBy: pick([MASTER_SALES_ID, ...SALES_ONLINE_IDS, ...SALES_OFFLINE_IDS, MEDIA_ID, COORDINATOR_ID]),
      createdAt: daysAgo(rangeInt(0, 60)).toISOString(),
      updatedAt: NOW_ISO,
      seedBatchId: SEED_BATCH_ID,
    };
    out.push({ id, data: doc as unknown as Record<string, unknown> });
  }
  return out;
}

// 70 notifications — across 10 event types, mixed channels/statuses
const NOTIF_EVENT_DIST: NotificationEventType[] = [
  'new_case_created',
  'payment_pending', 'payment_pending', 'payment_confirmed',
  'hospital_coordination_required',
  'lab_test_due',
  'procedure_scheduled', 'procedure_completed',
  'postop_followup_due', 'postop_followup_due',
  'medical_alert',
  'followup_escalation',
];
const NOTIF_STATUS_DIST: NotificationStatus[] = [
  'sent', 'sent', 'sent', 'sent', 'sent', 'sent', 'sent', 'sent', // 57%
  'sent', 'sent', 'sent', 'sent',
  'pending', 'pending', // 14%
  'failed', // 7%
];
const NOTIF_CHANNELS: NotificationChannel[] = ['in_app', 'in_app', 'in_app', 'telegram'];

function genNotifications(): Array<{ id: string; data: Record<string, unknown> }> {
  const out: Array<{ id: string; data: Record<string, unknown> }> = [];
  for (let i = 1; i <= 70; i++) {
    const id = newNotificationId(i);
    const eventType: NotificationEventType = pick(NOTIF_EVENT_DIST);
    const channel: NotificationChannel = pick(NOTIF_CHANNELS);
    const status: NotificationStatus = pick(NOTIF_STATUS_DIST);
    const caseId = chance(0.7) ? pick([...caseIds]) : undefined;
    const customerId = caseId ? pick([...customerIds]) : (chance(0.5) ? pick([...customerIds]) : undefined);
    const recipientUserIds = pickRecipientUsers(eventType);
    const title = eventTitle(eventType);
    const body = eventBody(eventType);
    const createdAt = daysAgo(rangeInt(0, 90)).toISOString();
    const sentAt = status !== 'pending' ? createdAt : undefined;
    const includeReadBy = status === 'sent' && chance(0.5);
    const doc: Partial<Notification> & { seedBatchId: string } = {
      id,
      eventType,
      title,
      body,
      ...(caseId !== undefined ? { caseId } : {}),
      ...(customerId !== undefined ? { customerId } : {}),
      recipientUserIds,
      channel,
      status,
      ...(includeReadBy ? { readBy: [recipientUserIds[0]!] } : {}),
      createdAt,
      ...(sentAt !== undefined ? { sentAt } : {}),
      seedBatchId: SEED_BATCH_ID,
    };
    out.push({ id, data: doc as unknown as Record<string, unknown> });
  }
  return out;
}

function pickRecipientUsers(_eventType: NotificationEventType): string[] {
  // Different events target different roles
  const r = rand();
  if (r < 0.3) return [pick([MASTER_SALES_ID, ADMIN_USER_ID])];
  if (r < 0.55) return [COORDINATOR_ID];
  if (r < 0.7) return [pick(DOCTOR_IDS), COORDINATOR_ID];
  if (r < 0.85) return [ACCOUNTANT_ID];
  return [CSKH_ID, NURSE_ID];
}

function eventTitle(eventType: NotificationEventType): string {
  switch (eventType) {
    case 'new_case_created': return 'Ca mới được tạo';
    case 'payment_pending': return 'Thanh toán chờ xác nhận';
    case 'payment_confirmed': return 'Thanh toán đã xác nhận';
    case 'payment_rejected': return 'Thanh toán bị từ chối';
    case 'hospital_coordination_required': return 'Cần phối hợp bệnh viện';
    case 'hospital_confirmed': return 'Bệnh viện đã xác nhận';
    case 'lab_test_due': return 'Đến hạn xét nghiệm';
    case 'procedure_scheduled': return 'Lịch phẫu thuật đã đặt';
    case 'customer_checked_in': return 'Khách đã check-in';
    case 'procedure_completed': return 'Phẫu thuật hoàn thành';
    case 'images_missing': return 'Thiếu ảnh cho ca';
    case 'postop_followup_due': return 'Followup sau mổ đến hạn';
    case 'complaint': return 'Khiếu nại mới';
    case 'medical_alert': return 'Cảnh báo y tế';
    case 'medical_alert_resolved': return 'Cảnh báo đã xử lý';
    case 'followup_escalation': return 'Followup cần escalate';
  }
}

function eventBody(eventType: NotificationEventType): string {
  return `Mock seed — sự kiện ${eventType}`;
}

// 60 audit logs — across 18 actions, 7 entity types
const AUDIT_ACTION_DIST: AuditAction[] = [
  'customer_created', 'customer_created', 'customer_created', // 3
  'customer_updated', 'customer_updated', // 2
  'case_created', 'case_created', 'case_created', 'case_created', // 4
  'case_status_changed', 'case_status_changed', 'case_status_changed', 'case_status_changed', // 4
  'payment_created', 'payment_created', 'payment_confirmed', 'payment_confirmed', 'payment_confirmed', // 5
  'consent_updated', 'consent_updated', // 2
  'task_completed', 'task_completed', // 2
  'followup_completed', 'followup_completed', 'followup_completed', // 3
  'followup_escalated', // 1
  'attachment_uploaded', 'attachment_visibility_changed', // 2
  'note_added', // 1
  'payment_rejected', // 1
];
const AUDIT_ENTITY_DIST: AuditEntityType[] = [
  'customer', 'case', 'payment', 'consent', 'task', 'followup', 'attachment',
];

function genAuditLogs(): Array<{ id: string; data: Record<string, unknown> }> {
  const out: Array<{ id: string; data: Record<string, unknown> }> = [];
  for (let i = 1; i <= 60; i++) {
    const id = newAuditId(i);
    const action: AuditAction = pick(AUDIT_ACTION_DIST);
    const entityType: AuditEntityType = pick(AUDIT_ENTITY_DIST);
    const entityId = (() => {
      switch (entityType) {
        case 'customer': return pick([...customerIds]);
        case 'case': return pick([...caseIds]);
        case 'payment':
        case 'consent':
        case 'task':
        case 'followup':
        case 'attachment':
        case 'user': return pick([...userIds]);
      }
    })();
    const actorId = pick([ADMIN_USER_ID, MASTER_SALES_ID, ...SALES_ONLINE_IDS, ...SALES_OFFLINE_IDS, ACCOUNTANT_ID, COORDINATOR_ID, CSKH_ID]);
    const actorRole = pick<UserRole>(['admin', 'master_sales', 'sales_online', 'sales_offline', 'accountant', 'coordinator', 'cskh_postop']);
    const actorName = displayNameForRole(actorRole);
    const createdAt = daysAgo(rangeInt(0, 180)).toISOString();

    const doc: Partial<AuditLog> & { seedBatchId: string } = {
      id,
      actorId,
      actorName,
      actorRole,
      action,
      entityType,
      entityId: entityId ?? 'unknown',
      createdAt,
      seedBatchId: SEED_BATCH_ID,
    };
    out.push({ id, data: doc as unknown as Record<string, unknown> });
  }
  return out;
}

function displayNameForRole(role: UserRole): string {
  const spec = USER_SPECS.find((u) => u.role === role);
  return spec?.displayName ?? `Mock ${role}`;
}

// ── Manifest writer ──────────────────────────────────────────
function writeManifest(collections: Record<string, string[]>): void {
  const payload = {
    seedBatchId: SEED_BATCH_ID,
    projectId: PROJECT_ID,
    finishedAt: NOW_ISO,
    collectionCounts: Object.fromEntries(
      Object.entries(collections).map(([k, v]) => [k, v.length]),
    ),
    ids: collections,
  };
  writeFileSync(MANIFEST_PATH, JSON.stringify(payload, null, 2), 'utf8');
  ok(`Manifest written: ${MANIFEST_PATH}`);
}

function readManifest(): Record<string, string[]> | null {
  if (!existsSync(MANIFEST_PATH)) return null;
  try {
    const raw = readFileSync(MANIFEST_PATH, 'utf8');
    const parsed = JSON.parse(raw) as { ids?: Record<string, string[]> };
    return parsed.ids ?? null;
  } catch {
    return null;
  }
}

// ── Lock file ────────────────────────────────────────────────
function acquireLock(): void {
  try {
    const fd = openSync(LOCK_PATH, 'wx');
    closeSync(fd);
  } catch (e) {
    err(`Lock file exists at ${LOCK_PATH} — another seed run may be in progress.`);
    err(`If you're sure no other run is active, delete the file and retry.`);
    process.exit(1);
  }
}

function releaseLock(): void {
  if (existsSync(LOCK_PATH)) {
    try { unlinkSync(LOCK_PATH); } catch { /* swallow */ }
  }
}

// ── Cleanup mode ─────────────────────────────────────────────
async function cleanup(): Promise<void> {
  head('CLEANUP — Removing mvp-mock-* docs');
  log(`seedBatchId: ${SEED_BATCH_ID}`);
  log(`Project    : ${PROJECT_ID}`);

  if (!isAdminConfigured()) {
    err('Firebase Admin SDK chưa được cấy hình. Không thể cleanup.');
    process.exit(1);
  }

  if (!FORCE_YES) {
    log('');
    log('⚠️  CLEANUP sẽ xóa TẤT CẢ documents có mvp-mock-* ID hoặc seedBatchId=' + SEED_BATCH_ID);
    log('   qua 16 collections trong project ' + PROJECT_ID);
    log('   Dữ liệu production (cus-seed-*, swanclinic.vn users) KHÔNG bị động vào.');
    log('');
    const rl = createInterface({ input, output });
    const ans = await rl.question('   Gõ "yes" để tiếp tục: ');
    await rl.close();
    if (ans.trim().toLowerCase() !== 'yes') {
      err('Đã hủy');
      process.exit(0);
    }
  }

  acquireLock();
  try {
    const db = getAdminDb();
    const manifest = readManifest();
    const collections = [
      'auditLogs', 'notifications', 'attachments', 'followups', 'consents',
      'hospitalCoordinations', 'appointments', 'tasks', 'staffAssignments',
      'payments', 'caseServices', 'cases', 'services', 'treatmentLocations',
      'customers', 'users',
    ];

    let totalDeleted = 0;
    for (const col of collections) {
      const ids = manifest?.[col] ?? null;
      let toDelete: string[] = [];
      if (ids && ids.length > 0) {
        toDelete = ids;
      } else {
        const snap = await db.collection(col).where('seedBatchId', '==', SEED_BATCH_ID).get();
        toDelete = snap.docs.map((d) => d.id);
      }
      if (toDelete.length === 0) {
        skip(`${col}: nothing to delete`);
        continue;
      }
      // Batch delete
      for (let i = 0; i < toDelete.length; i += BATCH_LIMIT) {
        const slice = toDelete.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();
        for (const id of slice) batch.delete(db.collection(col).doc(id));
        await batch.commit();
        totalDeleted += slice.length;
      }
      ok(`${col}: deleted ${toDelete.length}`);
    }

    log('');
    ok(`Cleanup complete — ${totalDeleted} docs deleted across ${collections.length} collections.`);
    if (existsSync(MANIFEST_PATH)) {
      try { unlinkSync(MANIFEST_PATH); } catch { /* */ }
      ok('Manifest removed.');
    }
  } finally {
    releaseLock();
  }
}

// ── Generate full dataset (in-memory, no writes) ─────────────
// Returns per-collection doc arrays AND per-collection id arrays.
interface GeneratedDataset {
  docs: Record<string, Array<{ id: string; data: Record<string, unknown> }>>;
  ids: Record<string, string[]>;
  meta: { totalDocs: number; collectionCounts: Record<string, number> };
}

function generateAll(): GeneratedDataset {
  log('  users → locations → services → customers → cases (+ dependents) → ...');
  // Topological order — dependents see populated ID sets.
  const users = genUsers();
  const locations = genLocations();
  const services = genServices();
  const customers = genCustomers();
  const rels = genCasesAndRelations();
  const tasks = genTasks();
  const appointments = genAppointments();
  const consents = genConsents();
  const followups = genFollowups();
  const attachments = genAttachments();
  const notifications = genNotifications();
  const auditLogs = genAuditLogs();

  const docs: Record<string, Array<{ id: string; data: Record<string, unknown> }>> = {
    users,
    treatmentLocations: locations,
    services,
    customers,
    cases: rels.cases,
    caseServices: rels.caseServices,
    payments: rels.payments,
    staffAssignments: rels.staffAssignments,
    hospitalCoordinations: rels.hospitalCoordinations,
    tasks,
    appointments,
    consents,
    followups,
    attachments,
    notifications,
    auditLogs,
  };

  const ids: Record<string, string[]> = {};
  const counts: Record<string, number> = {};
  let total = 0;
  for (const [name, list] of Object.entries(docs)) {
    ids[name] = list.map((d) => d.id);
    counts[name] = list.length;
    total += list.length;
    trackCount('generated', name, list.length);
  }

  return { docs, ids, meta: { totalDocs: total, collectionCounts: counts } };
}

// ── Validate FK references ───────────────────────────────────
// Walks every generated doc and checks references resolve to known IDs.
function validateReferences(docs: Record<string, Array<{ id: string; data: Record<string, unknown> }>>): void {
  log('');
  head('Validating FK references');

  const allUsers = new Set(userIds);
  const allCustomers = new Set(customerIds);
  const allCases = new Set(caseIds);
  const allLocations = new Set(locationIds);
  const allServices = new Set(serviceIds);
  const allConsents = new Set(consentIds);

  // For each collection: which fields MUST reference which ID set, and which are optional.
  const FK_RULES: Record<string, Array<{ field: string; target: Set<string>; optional: boolean }>> = {
    users:                [],
    treatmentLocations:   [],
    services:             [],
    customers:            [{ field: 'createdBy', target: allUsers, optional: false }],
    cases: [
      { field: 'customerId',         target: allCustomers, optional: false },
      { field: 'treatmentLocationId',target: allLocations, optional: true  },
      { field: 'createdBy',          target: allUsers,     optional: false },
    ],
    caseServices: [
      { field: 'caseId',             target: allCases,     optional: false },
    ],
    payments: [
      { field: 'caseId',      target: allCases,     optional: false },
      { field: 'customerId',  target: allCustomers, optional: false },
    ],
    staffAssignments: [
      { field: 'caseId', target: allCases, optional: false },
    ],
    hospitalCoordinations: [
      { field: 'caseId',             target: allCases,     optional: false },
      { field: 'treatmentLocationId',target: allLocations, optional: false },
      { field: 'coordinatorId',      target: allUsers,     optional: false },
    ],
    tasks: [
      { field: 'caseId',     target: allCases,     optional: true  },
      { field: 'customerId', target: allCustomers, optional: true  },
    ],
    appointments: [
      { field: 'caseId',     target: allCases,     optional: false },
      { field: 'customerId', target: allCustomers, optional: false },
      { field: 'locationId', target: allLocations, optional: true  },
    ],
    consents: [
      { field: 'customerId', target: allCustomers, optional: false },
      { field: 'caseId',     target: allCases,     optional: true  },
    ],
    followups: [
      { field: 'caseId',     target: allCases,     optional: false },
      { field: 'customerId', target: allCustomers, optional: false },
    ],
    attachments: [
      { field: 'caseId',     target: allCases,     optional: false },
      { field: 'customerId', target: allCustomers, optional: false },
      { field: 'consentId',  target: allConsents,  optional: true  },
    ],
    notifications: [
      { field: 'caseId',     target: allCases,     optional: true  },
      { field: 'customerId', target: allCustomers, optional: true  },
    ],
    auditLogs: [
      { field: 'actorId', target: allUsers, optional: false },
    ],
  };

  const broken: Array<{ collection: string; id: string; field: string; target: string }> = [];
  let checkedFields = 0;

  for (const [colName, list] of Object.entries(docs)) {
    const rules = FK_RULES[colName];
    if (!rules) continue;
    for (const doc of list) {
      for (const rule of rules) {
        const v = doc.data[rule.field];
        if (v === undefined || v === null) {
          if (!rule.optional) broken.push({ collection: colName, id: doc.id, field: rule.field, target: 'missing' });
          continue;
        }
        if (typeof v === 'string') {
          checkedFields++;
          if (!rule.target.has(v)) {
            broken.push({ collection: colName, id: doc.id, field: rule.field, target: v });
          }
        } else if (Array.isArray(v)) {
          // Check string-array FKs (e.g. assignedStaffIds, recipientUserIds)
          for (const item of v) {
            if (typeof item === 'string') {
              checkedFields++;
              if (!rule.target.has(item)) {
                broken.push({ collection: colName, id: doc.id, field: rule.field, target: item });
              }
            }
          }
        }
      }
    }
  }

  // auditLogs.entityId is special — points into one of several collections
  for (const doc of docs.auditLogs ?? []) {
    const eid = doc.data.entityId as string | undefined;
    const etype = doc.data.entityType as string | undefined;
    if (!eid || !etype) continue;
    checkedFields++;
    const valid =
      (etype === 'customer' && allCustomers.has(eid)) ||
      (etype === 'case' && allCases.has(eid)) ||
      (etype === 'user' && allUsers.has(eid)) ||
      (allCases.has(eid) || allCustomers.has(eid) || allUsers.has(eid)); // task/payment/etc. — IDs reused from cases/customers/users
    if (!valid) broken.push({ collection: 'auditLogs', id: doc.id, field: 'entityId', target: `${etype}=${eid}` });
  }

  if (broken.length === 0) {
    ok(`All FK references resolve. ${checkedFields} fields checked across ${Object.keys(docs).length} collections.`);
  } else {
    for (const b of broken) report.brokenRefs.push(b);
    err(`Found ${broken.length} broken refs out of ${checkedFields} FK fields checked:`);
    for (const b of broken.slice(0, 30)) {
      log(`    ${b.collection}/${b.id} → field '${b.field}' → ${b.target}`);
    }
  }

  // Volume sanity
  log('');
  log(`  Users generated:        ${userIds.size}`);
  log(`  Customers generated:    ${customerIds.size}`);
  log(`  Cases generated:        ${caseIds.size}`);
  log(`  Locations generated:    ${locationIds.size}`);
  log(`  Services generated:     ${serviceIds.size}`);
  log(`  Consents generated:     ${consentIds.size}`);
  log(`  Phones used (dedup):    ${phonesUsed.size}`);
}

// ── Seed (write all generated docs) ──────────────────────────
async function seed(): Promise<void> {
  log('╔══════════════════════════════════════════════════════════╗');
  log('║   SWAN CRM — Real Firebase MVP Mock Seed               ║');
  log('╚══════════════════════════════════════════════════════════╝');
  log(`Project      : ${PROJECT_ID}`);
  log(`Started      : ${NOW_ISO}`);
  log(`Seed batch   : ${SEED_BATCH_ID}`);
  log(`Mode         : ${MODE_SEED ? 'SEED' : MODE_DRY_RUN ? 'DRY-RUN' : 'CLEANUP'}`);
  log('');
  log('  Prefix policy: every new doc id starts with `mvp-mock-`.');
  log('  Prior `cus-seed-*` customers and `*@swanclinic.vn` users are NOT touched.');
  log('');

  if (!isAdminConfigured()) {
    err('Firebase Admin SDK chưa được cấy hình.');
    err('Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env.local');
    process.exit(1);
  }

  // Allow `undefined` values in doc payloads to be silently omitted by Firestore.
  // Without this, any field set to `undefined` (e.g. optional arrays we chose
  // not to populate) makes the whole batch.commit fail with a hard error.
  getAdminDb().settings({ ignoreUndefinedProperties: true });
  ok('Firestore: ignoreUndefinedProperties = true');

  // Always cleanup previous run first if seed mode
  if (MODE_SEED) {
    if (!MODE_DRY_RUN) acquireLock();
    try {
      await cleanupPrevRun();
    } finally {
      if (!MODE_DRY_RUN) releaseLock();
    }
  }

  if (!MODE_DRY_RUN) acquireLock();
  try {
    const { docs, ids, meta } = generateAll();
    validateReferences(docs);

    log('');
    head(`Generated ${meta.totalDocs} docs across ${Object.keys(meta.collectionCounts).length} collections`);
    for (const [col, n] of Object.entries(meta.collectionCounts)) {
      log(`  • ${col.padEnd(26)} ${String(n).padStart(5)}`);
    }

    if (MODE_DRY_RUN) {
      log('');
      ok(`DRY-RUN complete. No documents were written to ${PROJECT_ID}.`);
      log('   Sample IDs (5 per collection):');
      for (const [col, idList] of Object.entries(ids)) {
        log(`     ${col}:`);
        for (const id of idList.slice(0, 5)) log(`       ${id}`);
      }
      return;
    }

    // SEED mode — write each collection in topological order using docs from
    // the single generateAll() call (preserves PRNG determinism).
    log('');
    head('Writing batches (topological order)');
    const writeOrder = [
      'users',
      'treatmentLocations',
      'services',
      'customers',
      'cases',
      'caseServices',
      'payments',
      'staffAssignments',
      'hospitalCoordinations',
      'tasks',
      'appointments',
      'consents',
      'followups',
      'attachments',
      'notifications',
      'auditLogs',
    ] as const;

    for (const col of writeOrder) {
      await writeCollection(col, docs[col] ?? []);
    }

    writeManifest(ids);

    log('');
    head('SEED REPORT');
    log(`Started  : ${report.startedAt}`);
    log(`Finished : ${NOW_ISO}`);
    log('');
    for (const col of writeOrder) {
      const n = (report.writtenCounts[col] ?? 0);
      log(`  ${col.padEnd(28)} ${String(n).padStart(5)} written`);
    }
    const totalWritten = Object.values(report.writtenCounts).reduce((a, b) => a + b, 0);
    log('');
    log(`  TOTAL                     ${String(totalWritten).padStart(5)}`);
    if (report.errors.length > 0) {
      log('');
      err(`${report.errors.length} write errors:`);
      for (const e of report.errors.slice(0, 20)) {
        log(`    ${e.collection}/${e.id} → ${e.reason}`);
      }
    }
    log('');
    ok(`Seed complete. Cleanup via:  npm run seed:mvp:cleanup -- --yes`);
    log(`   Existing production data (cus-seed-* customers, *@swanclinic.vn users) is preserved.`);
  } finally {
    releaseLock();
  }
}

async function cleanupPrevRun(): Promise<void> {
  head('Pre-seed cleanup of prior mvp-mock-* run');
  if (!isAdminConfigured()) return;
  const db = getAdminDb();
  const collections = [
    'auditLogs', 'notifications', 'attachments', 'followups', 'consents',
    'hospitalCoordinations', 'appointments', 'tasks', 'staffAssignments',
    'payments', 'caseServices', 'cases', 'services', 'treatmentLocations',
    'customers', 'users',
  ];
  let totalDeleted = 0;
  for (const col of collections) {
    const snap = await db.collection(col).where('seedBatchId', '==', SEED_BATCH_ID).get();
    if (snap.empty) {
      continue;
    }
    const ids = snap.docs.map((d) => d.id);
    for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
      const slice = ids.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();
      for (const id of slice) batch.delete(db.collection(col).doc(id));
      await batch.commit();
      totalDeleted += slice.length;
    }
  }
  if (totalDeleted > 0) {
    ok(`Pre-seed cleanup removed ${totalDeleted} old mvp-mock-* docs`);
  } else {
    skip(`No prior mvp-mock-* docs to clean up`);
  }
}

// ── Main entry ───────────────────────────────────────────────
async function main(): Promise<void> {
  report.mode = MODE_CLEANUP ? 'cleanup' : MODE_DRY_RUN ? 'dry-run' : 'seed';
  if (MODE_CLEANUP) {
    await cleanup();
  } else {
    await seed();
  }
}

main().catch((e: unknown) => {
  console.error('Fatal error:', e);
  releaseLock();
  process.exit(1);
});
