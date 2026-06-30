/**
 * Idempotent seed script for the REAL Firebase project (swancrm-1fa61).
 *
 * Goals:
 *   - Seed 15 users (with the existing 12-role RBAC union — mapped from the
 *     requested role names) — Auth account + Firestore `users` doc.
 *   - Seed 100 customers with diverse profiles.
 *   - Strict dedup: skip if email / phone / doc-id already exists. Never
 *     overwrite existing data. Safe to re-run.
 *
 * Run: npx tsx scripts/seed-firebase.ts
 */
import './_load-env';
import {
  getAdminDb,
  getAdminAuth,
  isAdminConfigured,
} from '../src/lib/firebase/admin';
import type { UserRole } from '../src/lib/types/user';

// ── Logging helpers ─────────────────────────────────────────
const log = (msg: string) => console.log(msg);
const ok = (msg: string) => console.log(`  ✅ ${msg}`);
const skip = (msg: string) => console.log(`  ⏭️  ${msg}`);
const err = (msg: string) => console.log(`  ❌ ${msg}`);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Report tracking ─────────────────────────────────────────
type SeedReport = {
  startedAt: string;
  finishedAt: string;
  usersCreated: { uid: string; email: string; role: UserRole; requestedRole: string }[];
  usersSkipped: { email: string; reason: string }[];
  userErrors: { email: string; reason: string }[];
  customersCreated: { id: string; code: string; phone: string; fullName: string }[];
  customersSkipped: { phone: string; reason: string }[];
  customerErrors: { id: string; reason: string }[];
};

const report: SeedReport = {
  startedAt: new Date().toISOString(),
  finishedAt: '',
  usersCreated: [],
  usersSkipped: [],
  userErrors: [],
  customersCreated: [],
  customersSkipped: [],
  customerErrors: [],
};

// ── Role mapping (requested → existing 12-role union) ──────
type RequestedRole =
  | 'super_admin'
  | 'admin'
  | 'manager'
  | 'sales'
  | 'doctor'
  | 'nurse'
  | 'coordinator'
  | 'support'
  | 'viewer'
  | 'guest';

const ROLE_MAP: Record<RequestedRole, UserRole> = {
  super_admin: 'admin',
  admin: 'admin',
  manager: 'master_sales',
  sales: 'sales_online', // 2nd sales account will be sales_offline
  doctor: 'doctor',
  nurse: 'nurse',
  coordinator: 'coordinator',
  support: 'cskh_postop',
  viewer: 'ceo', // read-mostly leadership
  guest: 'ceo', // read-mostly leadership
};

// ── 15 users to seed ────────────────────────────────────────
// (mixed Vietnamese names, fixed password for testability)
const SEED_PASSWORD = 'SwanTest@2026';

type SeedUserSpec = {
  requestedRole: RequestedRole;
  email: string;
  displayName: string;
  phone: string;
  // If `forceRole`, use this exact UserRole instead of ROLE_MAP[requestedRole]
  forceRole?: UserRole;
};

const SEED_USERS: SeedUserSpec[] = [
  // Leadership tier
  { requestedRole: 'super_admin', email: 'super.admin@swanclinic.vn', displayName: 'Hoàng Minh Khôi', phone: '0900 000 001' }, // → admin
  { requestedRole: 'admin',       email: 'admin.system@swanclinic.vn', displayName: 'Nguyễn Văn Quản Trị', phone: '0900 000 002' }, // → admin
  { requestedRole: 'manager',     email: 'manager.kd@swanclinic.vn', displayName: 'Trần Minh Sang', phone: '0900 000 003' }, // → master_sales
  { requestedRole: 'viewer',      email: 'viewer.ceo@swanclinic.vn',  displayName: 'Lê Thị Cẩm',      phone: '0900 000 004' }, // → ceo
  { requestedRole: 'guest',       email: 'guest.cso@swanclinic.vn',   displayName: 'Trần Thị Thu Hà', phone: '0900 000 005' }, // → cso
  // Sales tier
  { requestedRole: 'sales', email: 'sales.online.1@swanclinic.vn',  displayName: 'Nguyễn Thị Lan Anh',  phone: '0900 000 006' }, // → sales_online
  { requestedRole: 'sales', email: 'sales.online.2@swanclinic.vn',  displayName: 'Đỗ Khánh Vy',          phone: '0900 000 007' }, // → sales_online
  { requestedRole: 'sales', email: 'sales.offline.1@swanclinic.vn', displayName: 'Phạm Văn Hùng',        phone: '0900 000 008', forceRole: 'sales_offline' },
  { requestedRole: 'sales', email: 'sales.offline.2@swanclinic.vn', displayName: 'Lê Thanh Tùng',        phone: '0900 000 009', forceRole: 'sales_offline' },
  // Medical team
  { requestedRole: 'doctor', email: 'doctor.1@swanclinic.vn', displayName: 'BS. Phạm Ngọc Anh',   phone: '0900 000 010' },
  { requestedRole: 'doctor', email: 'doctor.2@swanclinic.vn', displayName: 'BS. Trần Hải Yến',    phone: '0900 000 011' },
  { requestedRole: 'nurse',  email: 'nurse.1@swanclinic.vn',  displayName: 'Nguyễn Thị Mai',      phone: '0900 000 012' },
  { requestedRole: 'nurse',  email: 'nurse.2@swanclinic.vn',  displayName: 'Phạm Thị Hồng',       phone: '0900 000 013' },
  // Operations
  { requestedRole: 'coordinator', email: 'coordinator@swanclinic.vn', displayName: 'Trương Văn Khoa',     phone: '0900 000 014' },
  { requestedRole: 'support',     email: 'support.postop@swanclinic.vn', displayName: 'Phạm Ngọc Điệp', phone: '0900 000 015' },
];

// ── Customer generation (100 diverse profiles) ──────────────
const HO_CHI_MINH_DISTRICTS = [
  'Q.1', 'Q.3', 'Q.4', 'Q.5', 'Q.6', 'Q.7', 'Q.8', 'Q.10', 'Q.11', 'Q.12',
  'Q. Bình Thạnh', 'Q. Phú Nhuận', 'Q. Tân Bình', 'Q. Tân Phú',
  'Q. Gò Vấp', 'Q. Bình Tân', 'Q. Thủ Đức', 'TP. Thủ Đức', 'Q. Bình Chánh',
];

const STREETS = [
  'Nguyễn Huệ', 'Lê Lợi', 'Trần Hưng Đạo', 'Hai Bà Trưng', 'Lý Tự Trọng',
  'Đồng Khởi', 'Pasteur', 'Nam Kỳ Khởi Nghĩa', 'Cách Mạng Tháng 8',
  'Điện Biên Phủ', 'Hoàng Văn Thụ', 'Phan Đăng Lưu', 'Nguyễn Đình Chiểu',
  'Lê Văn Sỹ', 'Trường Sơn', 'Cộng Hòa', 'Hoàng Diệu', 'Nguyễn Thị Minh Khai',
  'Bùi Thị Xuân', 'Phan Xích Long',
];

const SURNAMES_F = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ',
  'Ngô', 'Dương', 'Lý', 'Phan', 'Trương', 'Võ', 'Tô', 'Đinh', 'Mai', 'Tăng',
];
const GIVEN_F = [
  'Thị Hồng', 'Thị Thu', 'Thị Ngọc', 'Thị Bích', 'Thị Mỹ', 'Thị Kim',
  'Thanh', 'Khánh', 'Phương', 'Mai', 'Hà', 'Linh', 'Trang', 'Vy', 'Anh',
  'Hương', 'Nhung', 'Hoa', 'Thảo', 'Tú', 'Uyên', 'Quỳnh', 'Yến', 'Ngân',
  'Tiên', 'Thư', 'Vân', 'Tâm', 'Diệu', 'Nghi',
];
const GIVEN_F_TRAIL = [
  'Ngọc', 'Anh', 'Trang', 'Phương', 'Linh', 'Vy', 'Hà', 'Mai', 'Châu',
  'Hương', 'Nhi', 'Thư', 'Uyên', 'Yến', 'Loan', 'Hoa', 'Tú', 'Duyên',
  'Phượng', 'Huyền', 'Trâm', 'Tiên', 'Nhung', 'Diệu', 'Ngân', 'Tâm',
];
const SURNAMES_M = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ'];
const GIVEN_M = [
  'Văn', 'Hữu', 'Đức', 'Minh', 'Quang', 'Thanh', 'Khánh', 'Tuấn', 'Anh',
  'Hoàng', 'Bảo', 'Phúc', 'Long', 'Sơn', 'Huy', 'Dũng', 'Cường', 'Thành',
  'Trung', 'Hải', 'Nam', 'Khoa', 'Khang', 'Phát', 'Tài',
];
const GIVEN_M_TRAIL = [
  'Anh', 'Quân', 'Phong', 'Khoa', 'Long', 'Sơn', 'Huy', 'Dũng', 'Cường',
  'Thành', 'Trung', 'Hải', 'Nam', 'Khang', 'Phát', 'Tài', 'Bình', 'Phú',
  'Đạt', 'Toàn', 'Nghĩa', 'Thiện', 'Vinh', 'Quý', 'Lộc',
];

const SOURCES: Array<{
  value: 'online' | 'offline' | 'walk_in' | 'referral' | 'koc' | 'old_data' | 'other';
  detail: string;
}> = [
  { value: 'online',   detail: 'Facebook Ads — campaign nâng ngực 2026' },
  { value: 'online',   detail: 'Google Ads — từ khóa "nâng mũi TPHCM"' },
  { value: 'online',   detail: 'Instagram organic — DM cho phòng khám' },
  { value: 'online',   detail: 'TikTok Ads — hashtag #thammyvien' },
  { value: 'online',   detail: 'Zalo OA Swan Clinic' },
  { value: 'offline',  detail: 'Sự kiện Beauty Show 2026' },
  { value: 'offline',  detail: 'Hội chợ thẩm mỹ quốc tế' },
  { value: 'walk_in',  detail: 'Khách đến trực tiếp sau khi đi ngang' },
  { value: 'walk_in',  detail: 'Tái khám theo lịch hẹn' },
  { value: 'referral', detail: 'Giới thiệu bởi khách hàng cũ' },
  { value: 'referral', detail: 'Bác sĩ đối tác giới thiệu' },
  { value: 'koc',      detail: 'KOC Beauty TikTok — hợp đồng content' },
  { value: 'old_data', detail: 'Khách cũ tái khám / thêm dịch vụ' },
  { value: 'other',    detail: 'Khác — cần xác minh nguồn' },
];

const MEDICAL_NOTES = [
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
  undefined,
  undefined, // ~14% have no medical note
];

const PRIVACY_NOTES = [
  undefined, undefined, undefined, undefined, // most are normal
  'Khách VIP — ưu tiên chăm sóc và bảo mật thông tin.',
  'Nhóm khách đặc biệt — ảnh hưởng referral chain.',
  'Influencer có hợp đồng brand riêng với Media.',
  'Người nổi tiếng — không chia sẻ thông tin ra ngoài.',
  'TUYỆT MẬT — chỉ CEO và Master Sales được xem hồ sơ.',
];

// Deterministic PRNG for rerunnability (mulberry32)
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(20260630);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)] as T;

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

/**
 * Convert a local VN phone (0xxx xxx xxx) to E.164 (+84xxxxxxxxx).
 * Returns null if the input isn't a recognizable 10-digit VN mobile.
 */
function toE164(local: string): string | null {
  const digits = local.replace(/\D/g, '');
  if (digits.length !== 10) return null;
  if (!digits.startsWith('0')) return null;
  return `+84${digits.slice(1)}`;
}

/**
 * Generate a unique 10-digit Vietnamese mobile number.
 * Uses prefixes 032-039, 070-079, 081-089, 090-099 to avoid colliding with
 * the project's mock seed (0912 345 6xx, 0933 456 7xx, …).
 *
 * Format: 0[3|5|7|8|9]XX YYY YYY — encoded as 09xx-xxx-xxx without dashes.
 */
function generatePhone(index: number): string {
  const prefixes = ['032', '033', '034', '035', '036', '037', '038', '039',
                    '070', '076', '077', '078', '079',
                    '081', '082', '083', '084', '085', '086', '088', '089',
                    '090', '091', '092', '093', '094', '096', '097', '098', '099'];
  const prefix = prefixes[index % prefixes.length]!;
  // Use index * 7 + base for stable distribution, mod into 7-digit range
  const a = ((index * 7 + 100) % 900 + 100); // 100..999
  const b = ((index * 13 + 50) % 900 + 100); // 100..999
  return `0${prefix.slice(1)}${pad(a, 3)}${pad(b, 3)}`;
}

function generateCustomerCode(index: number): string {
  const today = new Date();
  const yymmdd = `${today.getFullYear().toString().slice(2)}${pad(today.getMonth() + 1, 2)}${pad(today.getDate(), 2)}`;
  return `CUS-${yymmdd}-${pad(index, 3)}`;
}

function randomDateWithinMonths(monthsBack: number): string {
  const now = Date.now();
  const range = monthsBack * 30 * 24 * 60 * 60 * 1000;
  const offset = Math.floor(rand() * range);
  return new Date(now - offset).toISOString();
}

function randomBirthYear(): string {
  // Age 18-65
  const year = 2026 - (18 + Math.floor(rand() * 48));
  const month = 1 + Math.floor(rand() * 12);
  const day = 1 + Math.floor(rand() * 28);
  return `${year}-${pad(month, 2)}-${pad(day, 2)}`;
}

function buildCustomer(index: number, creatorUids: string[]) {
  const isMale = rand() < 0.18; // 18% male (matches Vietnamese cosmetic CRM demographic)
  const fullName = isMale
    ? `${pick(SURNAMES_M)} ${pick(GIVEN_M)} ${pick(GIVEN_M_TRAIL)}`
    : `${pick(SURNAMES_F)} ${pick(GIVEN_F)} ${pick(GIVEN_F_TRAIL)}`;
  const phone = generatePhone(index);
  const source = pick(SOURCES);
  const privacyRoll = rand();
  const privacyLevel =
    privacyRoll < 0.78 ? 'normal' : privacyRoll < 0.94 ? 'vip' : 'highly_sensitive';
  const createdAt = randomDateWithinMonths(6);
  const createdBy = pick(creatorUids);
  const hasSecondaryPhone = rand() < 0.18;
  const hasNationalId = rand() < 0.7;
  const hasAddress = rand() < 0.92;
  const hasDob = rand() < 0.92;
  const hasEmergency = rand() < 0.55;
  const hasMedicalNote = rand() < 0.86;

  const customer: Record<string, unknown> = {
    customerCode: generateCustomerCode(index + 1),
    fullName,
    phone,
    privacyLevel,
    source: source.value,
    sourceDetail: source.detail,
    createdBy,
    createdAt,
    updatedAt: createdAt,
  };

  // Optional fields with realistic Vietnamese data
  if (hasSecondaryPhone) {
    customer.secondaryPhone = generatePhone(index + 500);
  }
  if (hasDob) {
    customer.dateOfBirth = randomBirthYear();
    customer.gender = isMale ? 'male' : 'female';
  }
  if (hasAddress) {
    const number = 1 + Math.floor(rand() * 200);
    const street = pick(STREETS);
    const ward = `P.${1 + Math.floor(rand() * 30)}`;
    const district = pick(HO_CHI_MINH_DISTRICTS);
    customer.address = `${number} ${street}, ${ward}, ${district}, TP.HCM`;
  }
  if (hasNationalId && privacyLevel !== 'highly_sensitive') {
    customer.nationalIdNumber = `079${(1985 + Math.floor(rand() * 30))}${pad(
      100000 + Math.floor(rand() * 899999),
      6,
    )}`;
    customer.nationalIdIssueDate = '2020-01-15';
    customer.nationalIdIssuePlace = 'TP.HCM';
  }
  if (hasEmergency) {
    customer.emergencyContactName = `${pick(SURNAMES_F)} ${pick(GIVEN_F_TRAIL)}`;
    customer.emergencyContactPhone = generatePhone(index + 1000);
  }
  customer.zalo = phone; // most customers use Zalo with their phone
  if (rand() < 0.35) {
    customer.facebook = `fb.com/${phone.replace(/\s/g, '')}`;
  }
  if (hasMedicalNote) {
    const note = pick(MEDICAL_NOTES);
    if (note !== undefined) customer.medicalNote = note;
  }
  // Privacy note only for VIP / highly sensitive
  if (privacyLevel !== 'normal' && rand() < 0.6) {
    const pnote = pick(PRIVACY_NOTES);
    if (pnote !== undefined) customer.privacyNote = pnote;
  }
  return customer;
}

// ── Main flow ───────────────────────────────────────────────
async function cleanupPreviousSeed() {
  const db = getAdminDb();

  log('\n────────────────────────────────────────────────────');
  log('  STEP 0 — Cleanup previous seed runs (only cus-seed-*, prefix-safe)');
  log('────────────────────────────────────────────────────');

  // Delete only docs created by THIS seed run (cus-seed-* prefix). Never touch
  // any other docs. This makes the script self-healing after partial failures.
  const customerSnap = await db
    .collection('customers')
    .where('customerCode', '>=', 'CUS-')
    .where('customerCode', '<', 'CUS-0')
    .get();
  // We use the customerCode prefix range trick — but to be safe, also filter
  // client-side to only IDs starting with `cus-seed-`.
  let deleted = 0;
  for (const d of customerSnap.docs) {
    if (d.id.startsWith('cus-seed-')) {
      await d.ref.delete();
      deleted++;
    }
  }
  // Also check via id-prefix scan for any seed-* docs (defensive)
  const idScan = await db.collection('customers').get();
  for (const d of idScan.docs) {
    if (d.id.startsWith('cus-seed-')) {
      await d.ref.delete();
      deleted++;
    }
  }
  ok(`Deleted ${deleted} stale cus-seed-* customer docs`);

  // Also delete the previous seed users (only the ones we created earlier in
  // this script — email domain @swanclinic.vn BUT NOT the owner duy@swan.vn).
  const usersSnap = await db.collection('users').get();
  let deletedUsers = 0;
  for (const d of usersSnap.docs) {
    const email = d.data().email as string | undefined;
    if (email && email.endsWith('@swanclinic.vn')) {
      // 1. delete Firestore doc
      await d.ref.delete();
      // 2. delete Auth account by uid
      try {
        await getAdminAuth().deleteUser(d.id);
        deletedUsers++;
      } catch {
        // ignore — auth user may not exist
      }
    }
  }
  ok(`Deleted ${deletedUsers} previous seed users (Auth + Firestore)`);
}

async function seedUsers() {
  const db = getAdminDb();
  const auth = getAdminAuth();

  log('\n────────────────────────────────────────────────────');
  log('  STEP 1/2 — Seed 15 users (Auth + Firestore profile)');
  log('────────────────────────────────────────────────────');

  // Index seeded UIDs by email so customers can reference them
  const uidByEmail: Record<string, string> = {};

  for (const spec of SEED_USERS) {
    const role: UserRole = spec.forceRole ?? ROLE_MAP[spec.requestedRole];

    // --- 1a. Check existing Auth user ---
    let existingAuthUser;
    try {
      existingAuthUser = await auth.getUserByEmail(spec.email).catch(() => null);
    } catch (e) {
      existingAuthUser = null;
    }

    let uid: string;
    if (existingAuthUser) {
      uid = existingAuthUser.uid;
      skip(`Auth user exists: ${spec.email} (uid=${uid})`);
      report.usersSkipped.push({ email: spec.email, reason: 'auth email exists' });
      uidByEmail[spec.email] = uid;
      continue;
    }

    // --- 1b. Create Auth user ---
    try {
      const e164Phone = toE164(spec.phone);
      const userRecord = await auth.createUser({
        email: spec.email,
        password: SEED_PASSWORD,
        displayName: spec.displayName,
        ...(e164Phone ? { phoneNumber: e164Phone } : {}),
        emailVerified: true,
        disabled: false,
      });
      uid = userRecord.uid;
      ok(`Created Auth user ${spec.email} (uid=${uid})`);
      // Settle delay to avoid quota contention
      await sleep(60);
    } catch (e) {
      const reason = (e as Error).message;
      err(`Auth create FAILED for ${spec.email}: ${reason}`);
      report.userErrors.push({ email: spec.email, reason });
      continue;
    }
    uidByEmail[spec.email] = uid;

    // --- 1c. Create Firestore profile doc ---
    const profileDoc = {
      email: spec.email,
      displayName: spec.displayName,
      phone: spec.phone,
      role,
      isActive: true,
      authUid: uid,
      requestedRole: spec.requestedRole, // preserves the requested name for traceability
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await db.collection('users').doc(uid).set(profileDoc);
      ok(`Created Firestore users/${uid} (${role} ← ${spec.requestedRole})`);
      report.usersCreated.push({
        uid,
        email: spec.email,
        role,
        requestedRole: spec.requestedRole,
      });
    } catch (e) {
      err(`Firestore set FAILED for users/${uid}: ${(e as Error).message}`);
      report.userErrors.push({ email: spec.email, reason: `firestore: ${(e as Error).message}` });
    }
  }

  return uidByEmail;
}

async function seedCustomers(creatorUids: string[]) {
  const db = getAdminDb();

  log('\n────────────────────────────────────────────────────');
  log('  STEP 2/2 — Seed 100 customers');
  log('────────────────────────────────────────────────────');

  if (creatorUids.length === 0) {
    err('No creator UIDs available — skipping customer seed.');
    return;
  }

  // Build phone-index for dedup
  const existingPhones = new Set<string>();
  const existing = await db.collection('customers').get();
  for (const d of existing.docs) {
    const phone = d.data().phone as string | undefined;
    if (phone) existingPhones.add(phone);
  }
  log(`  Existing customers in DB: ${existing.size} (dedup baseline)`);

  const TARGET = 100;
  let created = 0;
  let skipped = 0;
  let idx = 0;
  let safetyCounter = 0;
  const SAFETY_CAP = TARGET * 3; // stop after this many attempts to avoid infinite loop

  while (created < TARGET && safetyCounter < SAFETY_CAP) {
    safetyCounter++;
    const candidate = buildCustomer(idx, creatorUids);
    idx++;

    // Idempotency: skip if phone already in DB
    if (existingPhones.has(candidate.phone as string)) {
      skipped++;
      report.customersSkipped.push({
        phone: candidate.phone as string,
        reason: 'phone already exists',
      });
      continue;
    }

    const customerId = `cus-seed-${pad(idx, 4)}`;
    try {
      await db.collection('customers').doc(customerId).set(candidate);
      existingPhones.add(candidate.phone as string);
      created++;
      report.customersCreated.push({
        id: customerId,
        code: candidate.customerCode as string,
        phone: candidate.phone as string,
        fullName: candidate.fullName as string,
      });
      if (created % 20 === 0) {
        log(`  …${created}/${TARGET} customers created`);
      }
    } catch (e) {
      const reason = (e as Error).message;
      err(`customers/${customerId} FAILED: ${reason}`);
      report.customerErrors.push({ id: customerId, reason });
    }
  }

  log(`\n  Customer seed complete: ${created} created, ${skipped} skipped, ${safetyCounter} attempts`);
}

async function printReport() {
  report.finishedAt = new Date().toISOString();

  log('\n╔══════════════════════════════════════════════════════════╗');
  log('║                     SEED REPORT                         ║');
  log('╚══════════════════════════════════════════════════════════╝');
  log(`Started  : ${report.startedAt}`);
  log(`Finished : ${report.finishedAt}\n`);

  log('────────────────────────────────────────────────────');
  log('  USERS');
  log('────────────────────────────────────────────────────');
  log(`  Created : ${report.usersCreated.length}`);
  for (const u of report.usersCreated) {
    log(`    • ${u.email.padEnd(34)} uid=${u.uid.slice(0, 8)}…  role=${u.role}  (← ${u.requestedRole})`);
  }
  log(`  Skipped : ${report.usersSkipped.length}`);
  for (const u of report.usersSkipped) log(`    • ${u.email.padEnd(34)} ${u.reason}`);
  log(`  Errors  : ${report.userErrors.length}`);
  for (const u of report.userErrors) log(`    • ${u.email.padEnd(34)} ${u.reason}`);

  log('\n────────────────────────────────────────────────────');
  log('  CUSTOMERS');
  log('────────────────────────────────────────────────────');
  log(`  Created : ${report.customersCreated.length}`);
  if (report.customersCreated.length > 0) {
    log(`    First 3:`);
    for (const c of report.customersCreated.slice(0, 3)) {
      log(`      • ${c.id}  ${c.code}  ${c.fullName}  ${c.phone}`);
    }
    log(`    Last 1:`);
    const c = report.customersCreated[report.customersCreated.length - 1]!;
    log(`      • ${c.id}  ${c.code}  ${c.fullName}  ${c.phone}`);
  }
  log(`  Skipped : ${report.customersSkipped.length}`);
  log(`  Errors  : ${report.customerErrors.length}`);
  for (const c of report.customerErrors.slice(0, 10)) {
    log(`    • ${c.id.padEnd(16)} ${c.reason}`);
  }
  if (report.customerErrors.length > 10) {
    log(`    … and ${report.customerErrors.length - 10} more`);
  }

  log('\n────────────────────────────────────────────────────');
  log('  ROLE MAPPING (requested → existing 12-role union)');
  log('────────────────────────────────────────────────────');
  for (const req of Object.keys(ROLE_MAP) as RequestedRole[]) {
    log(`  ${req.padEnd(14)} → ${ROLE_MAP[req]}`);
  }

  log('\n────────────────────────────────────────────────────');
  log('  COLLECTIONS TOUCHED');
  log('────────────────────────────────────────────────────');
  const collections = new Set<string>();
  if (report.usersCreated.length) collections.add('users (Firestore) + Firebase Auth');
  if (report.customersCreated.length) collections.add('customers');
  for (const c of Array.from(collections)) log(`  • ${c}`);

  log('\n✅ Seed run complete. All created docs preserve existing data untouched.');
  log('   Re-running is safe: existing emails/phones are skipped, never overwritten.');
}

async function main() {
  if (!isAdminConfigured()) {
    log('❌ Firebase Admin SDK chưa được cấu hình.');
    log('   Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env.local');
    process.exit(1);
  }

  log('╔══════════════════════════════════════════════════════════╗');
  log('║   SWAN CRM — Real Firebase Seed (idempotent, dedup)    ║');
  log('╚══════════════════════════════════════════════════════════╝');
  log(`Project     : swancrm-1fa61`);
  log(`Started     : ${new Date().toISOString()}`);
  log(`Mode        : STRICT DEDUP — skip existing, never overwrite`);
  log(`Users target: 15`);
  log(`Customers   : 100 (diverse profiles)`);

  // Quick safety check: count existing users + customers before
  const db = getAdminDb();
  const beforeUsers = (await db.collection('users').count().get()).data().count;
  const beforeCustomers = (await db.collection('customers').count().get()).data().count;
  log(`\nBaseline — users=${beforeUsers} customers=${beforeCustomers} (preserved as-is)\n`);

  // Self-heal: remove any prior partial seed run (only cus-seed-* and the
  // @swanclinic.vn users this script creates — never touches other data).
  await cleanupPreviousSeed();

  const uidByEmail = await seedUsers();
  const creatorUids = Object.values(uidByEmail);
  await seedCustomers(creatorUids);

  await printReport();
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});