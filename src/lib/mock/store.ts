import { isDevMode, hasFirebaseConfig } from '@/config/firebase';

export function isMockEnabled(): boolean {
  return isDevMode && !hasFirebaseConfig;
}

// ── In-memory store ────────────────────────────────────────
// Outer key = collection path ("users", "customers", "cases", …)
// Inner key = document ID
type Collection = Map<string, Record<string, unknown>>;
const store = new Map<string, Collection>();

let seeded = false;

export function getCollection(name: string): Collection {
  if (!store.has(name)) store.set(name, new Map());
  return store.get(name)!;
}

// ── Seed data ──────────────────────────────────────────────

export function initSeedData(): void {
  if (seeded) return;
  seeded = true;
  seedUsers();
  seedTreatmentLocations();
  seedServices();
  seedCustomers();
  seedCases();
  seedCaseServices();
  seedPayments();
  seedStaffAssignments();
  seedTasks();
  seedAppointments();
  seedHospitalCoordinations();
  seedFollowups();
  seedAttachments();
  seedConsents();
  seedNotifications();
  seedAuditLogs();
}

function seedUsers(): void {
  const col = getCollection('users');
  const now = new Date();
  const day = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    return d.toISOString();
  };

  const users: Record<string, unknown>[] = [
    { id: 'user-001', email: 'admin@swanclinic.vn', displayName: 'Nguyễn Văn Admin', role: 'admin', phone: '0901 234 001', isActive: true, createdAt: day(60), updatedAt: day(2) },
    { id: 'user-002', email: 'ceo@swanclinic.vn', displayName: 'Lê Thị Cẩm', role: 'ceo', phone: '0901 234 002', isActive: true, createdAt: day(55), updatedAt: day(5) },
    { id: 'user-003', email: 'cso@swanclinic.vn', displayName: 'Trần Thị Thu Hà', role: 'cso', phone: '0901 234 009', isActive: true, createdAt: day(50), updatedAt: day(1) },
    { id: 'user-004', email: 'sales@swanclinic.vn', displayName: 'Trần Minh Sang', role: 'master_sales', phone: '0901 234 003', isActive: true, createdAt: day(45), updatedAt: day(1) },
    { id: 'user-005', email: 'online@swanclinic.vn', displayName: 'Nguyễn Thị Lan Anh', role: 'sales_online', phone: '0901 234 010', isActive: true, createdAt: day(40), updatedAt: day(2) },
    { id: 'user-006', email: 'offline@swanclinic.vn', displayName: 'Phạm Văn Hùng', role: 'sales_offline', phone: '0901 234 011', isActive: true, createdAt: day(35), updatedAt: day(3) },
    { id: 'user-007', email: 'accountant@swanclinic.vn', displayName: 'Hồ Thị Lan', role: 'accountant', phone: '0901 234 005', isActive: true, createdAt: day(35), updatedAt: day(7) },
    { id: 'user-008', email: 'doctor@swanclinic.vn', displayName: 'BS. Phạm Ngọc Anh', role: 'doctor', phone: '0901 234 004', isActive: true, createdAt: day(40), updatedAt: day(3) },
    { id: 'user-009', email: 'nurse@swanclinic.vn', displayName: 'Nguyễn Thị Mai', role: 'nurse', phone: '0901 234 006', isActive: true, createdAt: day(30), updatedAt: day(4) },
    { id: 'user-010', email: 'coordinator@swanclinic.vn', displayName: 'Trương Văn Khoa', role: 'coordinator', phone: '0901 234 007', isActive: true, createdAt: day(25), updatedAt: day(1) },
    { id: 'user-011', email: 'cskh@swanclinic.vn', displayName: 'Phạm Ngọc Điệp', role: 'cskh_postop', phone: '0901 234 008', isActive: true, createdAt: day(20), updatedAt: day(2) },
    { id: 'user-012', email: 'media@swanclinic.vn', displayName: 'Lý Minh Tú', role: 'media', phone: '0901 234 012', isActive: true, createdAt: day(15), updatedAt: day(1) },
  ];

  for (const u of users) col.set(u.id as string, { ...u });
}

function seedTreatmentLocations(): void {
  const col = getCollection('treatmentLocations');
  const now = new Date().toISOString();
  const locations = [
    { id: 'loc-001', name: 'Swan Clinic', type: 'swan', address: '123 Nguyễn Thị Minh Khai, Q.1, TP.HCM', contactPerson: 'Lễ tân Swan', contactPhone: '028 1234 5678', active: true, createdAt: now, updatedAt: now },
    { id: 'loc-002', name: 'Bệnh viện CIH', type: 'cih', address: '200 Hoàng Văn Thụ, Q. Phú Nhuận, TP.HCM', contactPerson: 'Phòng phẫu thuật CIH', contactPhone: '028 2345 6789', active: true, createdAt: now, updatedAt: now },
    { id: 'loc-003', name: 'Bệnh viện Medika', type: 'medika', address: '58 Trần Não, Q.2, TP.HCM', contactPerson: 'Phòng phẫu thuật Medika', contactPhone: '028 3456 7890', active: true, createdAt: now, updatedAt: now },
    { id: 'loc-004', name: 'Bệnh viện liên kết khác', type: 'other_hospital', active: true, createdAt: now, updatedAt: now },
  ];
  for (const l of locations) col.set(l.id, l as Record<string, unknown>);
}

function seedServices(): void {
  const col = getCollection('services');
  const now = new Date().toISOString();
  const services = [
    { id: 'svc-001', name: 'Nâng ngực Ergo 2', category: 'breast', defaultPrice: 60000000, active: true, createdAt: now, updatedAt: now },
    { id: 'svc-002', name: 'Nâng ngực Mentor', category: 'breast', defaultPrice: 65000000, active: true, createdAt: now, updatedAt: now },
    { id: 'svc-003', name: 'Mentor X-Tra', category: 'breast', defaultPrice: 70000000, active: true, createdAt: now, updatedAt: now },
    { id: 'svc-004', name: 'Mentor Boost', category: 'breast', defaultPrice: 75000000, active: true, createdAt: now, updatedAt: now },
    { id: 'svc-005', name: 'Ergonomix II', category: 'breast', defaultPrice: 72000000, active: true, createdAt: now, updatedAt: now },
    { id: 'svc-006', name: 'Nâng mũi cấu trúc', category: 'nose', defaultPrice: 35000000, active: true, createdAt: now, updatedAt: now },
    { id: 'svc-007', name: 'Nâng mũi cấu trúc Surgiform', category: 'nose', defaultPrice: 40000000, active: true, createdAt: now, updatedAt: now },
    { id: 'svc-008', name: 'Nâng mũi bán cấu trúc', category: 'nose', defaultPrice: 25000000, active: true, createdAt: now, updatedAt: now },
    { id: 'svc-009', name: 'Hút mỡ 360', category: 'body', defaultPrice: 45000000, active: true, createdAt: now, updatedAt: now },
    { id: 'svc-010', name: 'Hút mỡ bắp tay', category: 'body', defaultPrice: 20000000, active: true, createdAt: now, updatedAt: now },
    { id: 'svc-011', name: 'Hút mỡ nách', category: 'body', defaultPrice: 15000000, active: true, createdAt: now, updatedAt: now },
    { id: 'svc-012', name: 'Hút mỡ lưng trên', category: 'body', defaultPrice: 18000000, active: true, createdAt: now, updatedAt: now },
    { id: 'svc-013', name: 'Hút mỡ nọng cằm', category: 'body', defaultPrice: 12000000, active: true, createdAt: now, updatedAt: now },
    { id: 'svc-014', name: 'Thu quầng vú', category: 'breast', defaultPrice: 22000000, active: true, createdAt: now, updatedAt: now },
    { id: 'svc-015', name: 'Thu đầu ti', category: 'breast', defaultPrice: 18000000, active: true, createdAt: now, updatedAt: now },
    { id: 'svc-016', name: 'Botox thon gọn hàm', category: 'injectable', defaultPrice: 5000000, active: true, createdAt: now, updatedAt: now },
    { id: 'svc-017', name: 'Tiêm căng bóng da', category: 'injectable', defaultPrice: 8000000, active: true, createdAt: now, updatedAt: now },
  ];
  for (const s of services) col.set(s.id, s as Record<string, unknown>);
}

function seedCustomers(): void {
  const col = getCollection('customers');
  const now = new Date();
  const day = (offset: number) => { const d = new Date(now); d.setDate(d.getDate() - offset); return d.toISOString(); };

  const customers = [
    { id: 'cus-001', customerCode: 'CUS-260620-001', fullName: 'Nguyễn Thị Bích Ngọc', phone: '0912 345 601', dateOfBirth: '1993-04-15', gender: 'female', source: 'online', privacyLevel: 'normal', createdBy: 'user-004', createdAt: day(15), updatedAt: day(15) },
    { id: 'cus-002', customerCode: 'CUS-260621-001', fullName: 'Trần Thị Hương', phone: '0912 345 602', dateOfBirth: '1990-08-22', gender: 'female', source: 'referral', privacyLevel: 'vip', createdBy: 'user-004', createdAt: day(10), updatedAt: day(10) },
    { id: 'cus-003', customerCode: 'CUS-260622-001', fullName: 'Lê Thị Mỹ Linh', phone: '0912 345 603', dateOfBirth: '1988-12-01', gender: 'female', source: 'offline', privacyLevel: 'normal', createdBy: 'user-006', createdAt: day(8), updatedAt: day(8) },
    { id: 'cus-004', customerCode: 'CUS-260623-001', fullName: 'Phạm Thị Thu Hà', phone: '0912 345 604', dateOfBirth: '1996-03-10', gender: 'female', source: 'koc', privacyLevel: 'highly_sensitive', createdBy: 'user-004', createdAt: day(5), updatedAt: day(5) },
    { id: 'cus-005', customerCode: 'CUS-260624-001', fullName: 'Vũ Thị Minh Châu', phone: '0912 345 605', dateOfBirth: '1991-07-18', gender: 'female', source: 'online', privacyLevel: 'normal', createdBy: 'user-005', createdAt: day(3), updatedAt: day(3) },
  ];
  for (const c of customers) col.set(c.id, c as Record<string, unknown>);
}

function seedCases(): void {
  const col = getCollection('cases');
  const now = new Date();
  const day = (offset: number) => { const d = new Date(now); d.setDate(d.getDate() - offset); return d.toISOString(); };
  const future = (offset: number) => { const d = new Date(now); d.setDate(d.getDate() + offset); return d.toISOString(); };

  const cases = [
    // Case 1: New — waiting payment confirmation
    {
      id: 'case-001', caseCode: 'SW-260620-001', customerId: 'cus-001', caseDate: day(14),
      mainServiceGroup: 'breast', treatmentLocationId: 'loc-002', treatmentLocationType: 'cih',
      expectedLabDate: future(3), expectedProcedureDate: future(7),
      status: 'waiting_payment_confirmation', priority: 'normal',
      totalBillBeforeDiscount: 72000000, discountType: 'fixed', discountValue: 2000000, discountReason: 'Khách VIP',
      totalBillAfterDiscount: 70000000, amountPaid: 10000000, remainingAmount: 60000000, paymentStatus: 'deposit',
      salesNote: 'Khách quan tâm Mentor, đã xem ảnh before/after. Cọc 10tr tiền mặt.', privacyLevel: 'normal',
      createdBy: 'user-004', createdAt: day(14), updatedAt: day(14),
    },
    // Case 2: Payment confirmed — waiting hospital coordination
    {
      id: 'case-002', caseCode: 'SW-260621-001', customerId: 'cus-002', caseDate: day(9),
      mainServiceGroup: 'nose', treatmentLocationId: 'loc-002', treatmentLocationType: 'cih',
      expectedLabDate: future(2), expectedProcedureDate: future(5),
      status: 'payment_confirmed', priority: 'high',
      totalBillBeforeDiscount: 40000000, discountType: 'none',
      totalBillAfterDiscount: 40000000, amountPaid: 40000000, remainingAmount: 0, paymentStatus: 'paid',
      salesNote: 'Khách muốn nâng mũi cấu trúc Surgiform. Đã thanh toán đủ.', privacyLevel: 'vip',
      createdBy: 'user-004', createdAt: day(9), updatedAt: day(7),
    },
    // Case 3: Lab test scheduled
    {
      id: 'case-003', caseCode: 'SW-260622-001', customerId: 'cus-003', caseDate: day(7),
      mainServiceGroup: 'body', treatmentLocationId: 'loc-003', treatmentLocationType: 'medika',
      expectedLabDate: day(1), expectedProcedureDate: future(6),
      status: 'waiting_lab_test', priority: 'normal',
      totalBillBeforeDiscount: 45000000, discountType: 'percent', discountValue: 10, discountReason: 'Sale tháng 6',
      totalBillAfterDiscount: 40500000, amountPaid: 20000000, remainingAmount: 20500000, paymentStatus: 'partial',
      salesNote: 'Hút mỡ 360. Đã có lịch xét nghiệm ngày mai tại Medika.', privacyLevel: 'normal',
      createdBy: 'user-006', createdAt: day(7), updatedAt: day(3),
    },
    // Case 4: Procedure completed — waiting images
    {
      id: 'case-004', caseCode: 'SW-260623-001', customerId: 'cus-004', caseDate: day(20),
      mainServiceGroup: 'breast', treatmentLocationId: 'loc-002', treatmentLocationType: 'cih',
      expectedProcedureDate: day(5), actualProcedureDate: day(5),
      status: 'waiting_images_upload', priority: 'normal',
      totalBillBeforeDiscount: 75000000, discountType: 'none',
      totalBillAfterDiscount: 75000000, amountPaid: 75000000, remainingAmount: 0, paymentStatus: 'paid',
      salesNote: 'Mentor Boost. Ca thực hiện suôn sẻ.', privacyLevel: 'highly_sensitive',
      createdBy: 'user-004', createdAt: day(20), updatedAt: day(5),
    },
    // Case 5: Post-op D3
    {
      id: 'case-005', caseCode: 'SW-260624-001', customerId: 'cus-005', caseDate: day(18),
      mainServiceGroup: 'nose', treatmentLocationId: 'loc-001', treatmentLocationType: 'swan',
      expectedProcedureDate: day(10), actualProcedureDate: day(10),
      status: 'post_op_d3', priority: 'normal',
      totalBillBeforeDiscount: 35000000, discountType: 'none',
      totalBillAfterDiscount: 35000000, amountPaid: 35000000, remainingAmount: 0, paymentStatus: 'paid',
      salesNote: 'Nâng mũi cấu trúc tại Swan. D3 hôm nay.', privacyLevel: 'normal',
      createdBy: 'user-005', createdAt: day(18), updatedAt: day(10),
    },
  ];
  for (const c of cases) col.set(c.id, c as Record<string, unknown>);
}

function seedCaseServices(): void {
  const col = getCollection('caseServices');
  const now = new Date().toISOString();
  const services = [
    { id: 'csvc-001', caseId: 'case-001', serviceName: 'Nâng ngực Mentor', serviceCategory: 'breast', listedPrice: 65000000, finalPrice: 65000000, quantity: 1, isMainService: true, isGift: false, isUpsell: false, createdAt: now, updatedAt: now },
    { id: 'csvc-002', caseId: 'case-001', serviceName: 'Thu đầu ti', serviceCategory: 'breast', listedPrice: 7000000, finalPrice: 5000000, quantity: 1, isMainService: false, isGift: false, isUpsell: true, createdAt: now, updatedAt: now },
    { id: 'csvc-003', caseId: 'case-002', serviceName: 'Nâng mũi cấu trúc Surgiform', serviceCategory: 'nose', listedPrice: 40000000, finalPrice: 40000000, quantity: 1, isMainService: true, isGift: false, isUpsell: false, createdAt: now, updatedAt: now },
    { id: 'csvc-004', caseId: 'case-003', serviceName: 'Hút mỡ 360', serviceCategory: 'body', listedPrice: 45000000, finalPrice: 40500000, quantity: 1, isMainService: true, isGift: false, isUpsell: false, createdAt: now, updatedAt: now },
    { id: 'csvc-005', caseId: 'case-004', serviceName: 'Mentor Boost', serviceCategory: 'breast', listedPrice: 75000000, finalPrice: 75000000, quantity: 1, isMainService: true, isGift: false, isUpsell: false, createdAt: now, updatedAt: now },
    { id: 'csvc-006', caseId: 'case-005', serviceName: 'Nâng mũi cấu trúc', serviceCategory: 'nose', listedPrice: 35000000, finalPrice: 35000000, quantity: 1, isMainService: true, isGift: false, isUpsell: false, createdAt: now, updatedAt: now },
  ];
  for (const s of services) col.set(s.id, s as Record<string, unknown>);
}

function seedPayments(): void {
  const col = getCollection('payments');
  const now = new Date();
  const day = (offset: number) => { const d = new Date(now); d.setDate(d.getDate() - offset); return d.toISOString(); };

  const payments = [
    { id: 'pay-001', caseId: 'case-001', customerId: 'cus-001', amount: 10000000, paymentMethod: 'cash', paymentType: 'deposit', receivedBy: 'user-004', paymentDate: day(14), status: 'confirmed', confirmedBy: 'user-007', confirmedAt: day(13), createdBy: 'user-004', createdAt: day(14), updatedAt: day(13) },
    { id: 'pay-002', caseId: 'case-001', customerId: 'cus-001', amount: 30000000, paymentMethod: 'bank_transfer', paymentType: 'partial', paymentDate: day(1), status: 'pending', createdBy: 'user-004', createdAt: day(1), updatedAt: day(1) },
    { id: 'pay-003', caseId: 'case-002', customerId: 'cus-002', amount: 40000000, paymentMethod: 'bank_transfer', paymentType: 'full', receivedBy: 'user-004', paymentDate: day(9), status: 'confirmed', confirmedBy: 'user-007', confirmedAt: day(8), createdBy: 'user-004', createdAt: day(9), updatedAt: day(8) },
    { id: 'pay-004', caseId: 'case-003', customerId: 'cus-003', amount: 20000000, paymentMethod: 'bank_transfer', paymentType: 'partial', receivedBy: 'user-006', paymentDate: day(6), status: 'confirmed', confirmedBy: 'user-007', confirmedAt: day(5), createdBy: 'user-006', createdAt: day(6), updatedAt: day(5) },
    { id: 'pay-005', caseId: 'case-004', customerId: 'cus-004', amount: 75000000, paymentMethod: 'bank_transfer', paymentType: 'full', receivedBy: 'user-004', paymentDate: day(20), status: 'confirmed', confirmedBy: 'user-007', confirmedAt: day(19), createdBy: 'user-004', createdAt: day(20), updatedAt: day(19) },
    { id: 'pay-006', caseId: 'case-005', customerId: 'cus-005', amount: 35000000, paymentMethod: 'bank_transfer', paymentType: 'full', receivedBy: 'user-005', paymentDate: day(17), status: 'confirmed', confirmedBy: 'user-007', confirmedAt: day(16), createdBy: 'user-005', createdAt: day(17), updatedAt: day(16) },
  ];
  for (const p of payments) col.set(p.id, p as Record<string, unknown>);
}

function seedStaffAssignments(): void {
  const col = getCollection('staffAssignments');
  const now = new Date().toISOString();
  const assignments = [
    { id: 'sa-001', caseId: 'case-001', masterSalesId: 'user-004', coordinatorId: 'user-010', accountantId: 'user-007', assignedBy: 'user-004', createdAt: now, updatedAt: now },
    { id: 'sa-002', caseId: 'case-002', masterSalesId: 'user-004', doctorId: 'user-008', coordinatorId: 'user-010', accountantId: 'user-007', assignedBy: 'user-004', createdAt: now, updatedAt: now },
    { id: 'sa-003', caseId: 'case-003', salesOfflineId: 'user-006', coordinatorId: 'user-010', accountantId: 'user-007', assignedBy: 'user-006', createdAt: now, updatedAt: now },
    { id: 'sa-004', caseId: 'case-004', masterSalesId: 'user-004', doctorId: 'user-008', coordinatorId: 'user-010', cskhPostopId: 'user-011', nurseIds: ['user-009'], assignedBy: 'user-004', createdAt: now, updatedAt: now },
    { id: 'sa-005', caseId: 'case-005', salesOnlineId: 'user-005', doctorId: 'user-008', cskhPostopId: 'user-011', assignedBy: 'user-005', createdAt: now, updatedAt: now },
  ];
  for (const a of assignments) col.set(a.id, a as Record<string, unknown>);
}

function seedTasks(): void {
  const col = getCollection('tasks');
  const now = new Date();
  const day = (offset: number) => { const d = new Date(now); d.setDate(d.getDate() - offset); return d.toISOString(); };
  const future = (offset: number) => { const d = new Date(now); d.setDate(d.getDate() + offset); return d.toISOString(); };

  const tasks = [
    { id: 'task-001', title: 'Liên hệ khách hàng xác nhận lịch lab', description: 'Gọi xác nhận Bích Ngọc đến lab xét nghiệm đúng ngày.', caseId: 'case-001', assignedTo: 'user-010', dueDate: future(2), priority: 'high', status: 'in_progress', createdBy: 'user-004', createdAt: day(2), updatedAt: day(1) },
    { id: 'task-002', title: 'Chuẩn bị hồ sơ bệnh viện CIH', description: 'Gửi hồ sơ khách hàng sang bệnh viện CIH cho ca nâng ngực.', caseId: 'case-002', assignedTo: 'user-010', dueDate: future(1), priority: 'high', status: 'todo', createdBy: 'user-004', createdAt: day(3), updatedAt: day(3) },
    { id: 'task-003', title: 'Xác nhận kết quả xét nghiệm Medika', description: 'Kiểm tra kết quả lab của Lê Thị Mỹ Linh tại Medika.', caseId: 'case-003', assignedTo: 'user-010', dueDate: day(0), priority: 'normal', status: 'todo', createdBy: 'user-006', createdAt: day(2), updatedAt: day(2) },
    { id: 'task-004', title: 'Upload ảnh trước/sau cho khách hàng KOC', description: 'Thu thập và upload ảnh before/after của Phạm Thị Thu Hà (lưu ý highly_sensitive).', caseId: 'case-004', assignedTo: 'user-012', dueDate: future(3), priority: 'normal', status: 'todo', createdBy: 'user-004', createdAt: day(5), updatedAt: day(5) },
    { id: 'task-005', title: 'Liên hệ followup D7 khách hàng Vũ Thị Minh Châu', description: 'Gọi điện theo dõi sức khỏe sau phẫu thuật nâng mũi.', caseId: 'case-005', assignedTo: 'user-011', dueDate: future(0), priority: 'high', status: 'todo', createdBy: 'user-011', createdAt: day(8), updatedAt: day(8) },
    { id: 'task-006', title: 'Cập nhật báo cáo doanh thu tháng 6', description: 'Tổng hợp báo cáo doanh thu cuối tháng.', assignedTo: 'user-007', dueDate: future(5), priority: 'normal', status: 'todo', createdBy: 'user-002', createdAt: day(1), updatedAt: day(1) },
    { id: 'task-007', title: 'Hoàn tất ảnh case Mentor Boost', description: 'Chụp ảnh Before/After case Mentor Boost đã hoàn thành.', caseId: 'case-004', assignedTo: 'user-012', dueDate: day(3), priority: 'low', status: 'done', completedAt: day(3), createdBy: 'user-004', createdAt: day(10), updatedAt: day(3) },
  ];
  for (const t of tasks) col.set(t.id, t as Record<string, unknown>);
}

function seedAppointments(): void {
  const col = getCollection('appointments');
  const now = new Date();
  const day = (offset: number) => { const d = new Date(now); d.setDate(d.getDate() - offset); return d.toISOString(); };
  const future = (offset: number) => { const d = new Date(now); d.setDate(d.getDate() + offset); return d.toISOString(); };

  const appointments = [
    { id: 'appt-001', caseId: 'case-001', customerId: 'cus-001', type: 'lab_test', title: 'Xét nghiệm máu & chụp X-Quang', startTime: future(2), endTime: future(2), locationId: 'loc-002', assignedStaffIds: ['user-010'], status: 'scheduled', note: 'Nhịn ăn sáng trước khi xét nghiệm', createdBy: 'user-010', createdAt: day(5), updatedAt: day(5) },
    { id: 'appt-002', caseId: 'case-002', customerId: 'cus-002', type: 'hospital_coordination', title: 'Phối hợp bệnh viện CIH — Nâng mũi Surgiform', startTime: future(4), endTime: future(4), locationId: 'loc-002', assignedStaffIds: ['user-010'], status: 'scheduled', note: 'Xác nhận phòng mổ và lịch bác sĩ', createdBy: 'user-010', createdAt: day(3), updatedAt: day(3) },
    { id: 'appt-003', caseId: 'case-003', customerId: 'cus-003', type: 'lab_test', title: 'Xét nghiệm tổng quát tại Medika', startTime: future(1), endTime: future(1), locationId: 'loc-003', assignedStaffIds: ['user-010'], status: 'confirmed', createdBy: 'user-006', createdAt: day(4), updatedAt: day(1) },
    { id: 'appt-004', caseId: 'case-002', customerId: 'cus-002', type: 'procedure', title: 'Phẫu thuật nâng mũi cấu trúc Surgiform', startTime: future(5), endTime: future(5), locationId: 'loc-002', assignedStaffIds: ['user-008', 'user-009'], status: 'scheduled', note: 'Ca mổ ước tính 2 tiếng', createdBy: 'user-010', createdAt: day(3), updatedAt: day(3) },
    { id: 'appt-005', caseId: 'case-005', customerId: 'cus-005', type: 'postop_followup', title: 'Followup D7 — Nâng mũi cấu trúc', startTime: future(0), endTime: future(0), locationId: 'loc-001', assignedStaffIds: ['user-011'], status: 'scheduled', note: 'Gọi điện theo dõi sức khỏe', createdBy: 'user-011', createdAt: day(10), updatedAt: day(10) },
    { id: 'appt-006', caseId: 'case-005', customerId: 'cus-005', type: 'checkup', title: 'Tái khám D10 — Nâng mũi cấu trúc', startTime: future(0), endTime: future(0), locationId: 'loc-001', assignedStaffIds: ['user-008', 'user-009'], status: 'scheduled', note: 'Kiểm tra vết mổ, cắt chỉ nếu cần', createdBy: 'user-010', createdAt: day(8), updatedAt: day(8) },
    { id: 'appt-007', caseId: 'case-001', customerId: 'cus-001', type: 'consultation', title: 'Tư vấn chi tiết nâng ngực Mentor', startTime: day(10), endTime: day(10), locationId: 'loc-001', assignedStaffIds: ['user-004'], status: 'completed', note: 'Khách đã chọn Mentor 350cc', createdBy: 'user-004', createdAt: day(14), updatedAt: day(10) },
  ];
  for (const a of appointments) col.set(a.id, a as Record<string, unknown>);
}

function seedHospitalCoordinations(): void {
  const col = getCollection('hospitalCoordinations');
  const now = new Date().toISOString();

  const coords = [
    { id: 'coord-001', caseId: 'case-001', treatmentLocationId: 'loc-002', hospitalNotified: true, hospitalConfirmed: false, operatingRoomConfirmed: false, labScheduleConfirmed: true, doctorScheduleConfirmed: false, coordinatorId: 'user-010', note: 'Đã gửi hồ sơ, chờ xác nhận từ CIH', createdAt: now, updatedAt: now },
    { id: 'coord-002', caseId: 'case-002', treatmentLocationId: 'loc-002', hospitalNotified: true, hospitalConfirmed: true, operatingRoomConfirmed: true, labScheduleConfirmed: true, doctorScheduleConfirmed: true, coordinatorId: 'user-010', note: 'Bệnh viện CIH đã xác nhận đầy đủ', createdAt: now, updatedAt: now },
    { id: 'coord-003', caseId: 'case-003', treatmentLocationId: 'loc-003', hospitalNotified: true, hospitalConfirmed: true, operatingRoomConfirmed: false, labScheduleConfirmed: true, doctorScheduleConfirmed: false, coordinatorId: 'user-010', note: 'Lab Medika xác nhận lịch xét nghiệm', createdAt: now, updatedAt: now },
  ];
  for (const c of coords) col.set(c.id, c as Record<string, unknown>);
}

function seedFollowups(): void {
  const col = getCollection('followups');
  const now = new Date();
  const day = (offset: number) => { const d = new Date(now); d.setDate(d.getDate() - offset); return d.toISOString(); };
  const future = (offset: number) => { const d = new Date(now); d.setDate(d.getDate() + offset); return d.toISOString(); };

  // Case 5 followups (post_op_d3 — procedure was 10 days ago)
  const procedureDate = new Date(now); procedureDate.setDate(procedureDate.getDate() - 10);
  const followups = [
    { id: 'fup-case005-D1', caseId: 'case-005', customerId: 'cus-005', followupDay: 'D1', dueDate: day(9), assignedTo: 'user-011', status: 'completed', customerCondition: 'Sưng nhẹ, không đau nhiều', painLevel: 1, swellingLevel: 2, bruisingLevel: 1, requestedImage: true, imageUploaded: true, note: 'Khách ổn, đang nghỉ ngơi.', createdAt: day(10), updatedAt: day(9) },
    { id: 'fup-case005-D3', caseId: 'case-005', customerId: 'cus-005', followupDay: 'D3', dueDate: day(7), assignedTo: 'user-011', status: 'contacted', customerCondition: 'Bầm giảm nhiều, sưng còn chút', painLevel: 1, swellingLevel: 1, bruisingLevel: 1, requestedImage: true, imageUploaded: false, note: 'Khách gọi hỏi về chế độ ăn.', createdAt: day(10), updatedAt: day(7) },
    { id: 'fup-case005-D7', caseId: 'case-005', customerId: 'cus-005', followupDay: 'D7', dueDate: future(0), assignedTo: 'user-011', status: 'pending', requestedImage: false, imageUploaded: false, createdAt: day(10), updatedAt: day(10) },
    { id: 'fup-case005-D14', caseId: 'case-005', customerId: 'cus-005', followupDay: 'D14', dueDate: future(4), assignedTo: 'user-011', status: 'pending', requestedImage: false, imageUploaded: false, createdAt: day(10), updatedAt: day(10) },
    { id: 'fup-case005-D30', caseId: 'case-005', customerId: 'cus-005', followupDay: 'D30', dueDate: future(20), assignedTo: 'user-011', status: 'pending', requestedImage: false, imageUploaded: false, createdAt: day(10), updatedAt: day(10) },
    { id: 'fup-case005-D90', caseId: 'case-005', customerId: 'cus-005', followupDay: 'D90', dueDate: future(80), assignedTo: 'user-011', status: 'pending', requestedImage: false, imageUploaded: false, createdAt: day(10), updatedAt: day(10) },
  ];
  for (const f of followups) col.set(f.id, f as Record<string, unknown>);
}

function seedAttachments(): void {
  const col = getCollection('attachments');
  const now = new Date();
  const day = (offset: number) => { const d = new Date(now); d.setDate(d.getDate() - offset); return d.toISOString(); };

  const attachments = [
    { id: 'att-case001-id-front', caseId: 'case-001', customerId: 'cus-001', type: 'national_id_front', fileName: 'cccd-mat-truoc-ngoc.jpg', fileUrl: '/mock-storage/cccd-mat-truoc-ngoc.jpg', storagePath: 'cases/case-001/cccd-mat-truoc-ngoc.jpg', mimeType: 'image/jpeg', size: 1250000, visibility: 'private', consentRequired: true, uploadedBy: 'user-004', createdAt: day(14), updatedAt: day(14) },
    { id: 'att-case001-payment', caseId: 'case-001', customerId: 'cus-001', type: 'payment_proof', fileName: 'chung-chu-coc-10tr.pdf', fileUrl: '/mock-storage/chung-chu-coc-10tr.pdf', storagePath: 'cases/case-001/chung-chu-coc-10tr.pdf', mimeType: 'application/pdf', size: 520000, visibility: 'sales_team', consentRequired: false, note: 'Chứng nhận cọc 10.000.000 VNĐ tiền mặt', uploadedBy: 'user-004', createdAt: day(14), updatedAt: day(14) },
    { id: 'att-case001-id-back', caseId: 'case-001', customerId: 'cus-001', type: 'national_id_back', fileName: 'cccd-mat-sau-ngoc.jpg', fileUrl: '/mock-storage/cccd-mat-sau-ngoc.jpg', storagePath: 'cases/case-001/cccd-mat-sau-ngoc.jpg', mimeType: 'image/jpeg', size: 1180000, visibility: 'private', consentRequired: true, uploadedBy: 'user-004', createdAt: day(14), updatedAt: day(14) },
    { id: 'att-case004-before', caseId: 'case-004', customerId: 'cus-004', type: 'before_image', fileName: 'before-mentor-boost-ha.jpg', fileUrl: '/mock-storage/before-mentor-boost-ha.jpg', storagePath: 'cases/case-004/before-mentor-boost-ha.jpg', mimeType: 'image/jpeg', size: 3200000, visibility: 'medical_team', consentRequired: true, consentId: 'con-cus004-treatment', uploadedBy: 'user-012', createdAt: day(20), updatedAt: day(20) },
    { id: 'att-case004-after', caseId: 'case-004', customerId: 'cus-004', type: 'immediately_after_image', fileName: 'after-mentor-boost-ha.jpg', fileUrl: '/mock-storage/after-mentor-boost-ha.jpg', storagePath: 'cases/case-004/after-mentor-boost-ha.jpg', mimeType: 'image/jpeg', size: 3500000, visibility: 'media_approved', consentRequired: true, consentId: 'con-cus004-treatment', uploadedBy: 'user-012', createdAt: day(5), updatedAt: day(5) },
    { id: 'att-case005-d1', caseId: 'case-005', customerId: 'cus-005', type: 'postop_d1', fileName: 'd1-nang-mui-chau.jpg', fileUrl: '/mock-storage/d1-nang-mui-chau.jpg', storagePath: 'cases/case-005/d1-nang-mui-chau.jpg', mimeType: 'image/jpeg', size: 2800000, visibility: 'medical_team', consentRequired: false, uploadedBy: 'user-011', createdAt: day(9), updatedAt: day(9) },
    { id: 'att-case005-d3', caseId: 'case-005', customerId: 'cus-005', type: 'postop_d3', fileName: 'd3-nang-mui-chau.jpg', fileUrl: '/mock-storage/d3-nang-mui-chau.jpg', storagePath: 'cases/case-005/d3-nang-mui-chau.jpg', mimeType: 'image/jpeg', size: 2600000, visibility: 'medical_team', consentRequired: false, uploadedBy: 'user-011', createdAt: day(7), updatedAt: day(7) },
    { id: 'att-case002-form', caseId: 'case-002', customerId: 'cus-002', type: 'medical_document', fileName: 'ho-so-benh-an-huong.pdf', fileUrl: '/mock-storage/ho-so-benh-an-huong.pdf', storagePath: 'cases/case-002/ho-so-benh-an-huong.pdf', mimeType: 'application/pdf', size: 850000, visibility: 'medical_team', consentRequired: false, uploadedBy: 'user-010', createdAt: day(7), updatedAt: day(7) },
  ];
  for (const a of attachments) col.set(a.id, a as Record<string, unknown>);
}

function seedConsents(): void {
  const col = getCollection('consents');
  const now = new Date();
  const day = (offset: number) => { const d = new Date(now); d.setDate(d.getDate() - offset); return d.toISOString(); };

  const consents = [
    { id: 'con-cus001-treatment', customerId: 'cus-001', caseId: 'case-001', consentType: 'treatment', consentStatus: 'granted', signedAt: day(14), signedBy: 'cus-001', note: 'Đồng ý điều trị nâng ngực Mentor', createdAt: day(14), updatedAt: day(14) },
    { id: 'con-cus001-image', customerId: 'cus-001', caseId: 'case-001', consentType: 'image_storage', consentStatus: 'granted', signedAt: day(14), signedBy: 'cus-001', note: 'Đồng ý lưu trữ ảnh before/after', createdAt: day(14), updatedAt: day(14) },
    { id: 'con-cus001-marketing', customerId: 'cus-001', consentType: 'marketing_usage', consentStatus: 'denied', signedAt: day(14), signedBy: 'cus-001', note: 'Từ chối sử dụng hình ảnh cho marketing', createdAt: day(14), updatedAt: day(14) },
    { id: 'con-cus002-treatment', customerId: 'cus-002', caseId: 'case-002', consentType: 'treatment', consentStatus: 'granted', signedAt: day(9), signedBy: 'cus-002', createdAt: day(9), updatedAt: day(9) },
    { id: 'con-cus002-image', customerId: 'cus-002', caseId: 'case-002', consentType: 'image_storage', consentStatus: 'granted', signedAt: day(9), signedBy: 'cus-002', createdAt: day(9), updatedAt: day(9) },
    { id: 'con-cus003-treatment', customerId: 'cus-003', consentType: 'treatment', consentStatus: 'pending', createdAt: day(8), updatedAt: day(8) },
    { id: 'con-cus004-treatment', customerId: 'cus-004', caseId: 'case-004', consentType: 'treatment', consentStatus: 'granted', signedAt: day(20), signedBy: 'cus-004', createdAt: day(20), updatedAt: day(20) },
    { id: 'con-cus004-hospital', customerId: 'cus-004', caseId: 'case-004', consentType: 'hospital_sharing', consentStatus: 'granted', signedAt: day(20), signedBy: 'cus-004', createdAt: day(20), updatedAt: day(20) },
    { id: 'con-cus005-treatment', customerId: 'cus-005', caseId: 'case-005', consentType: 'treatment', consentStatus: 'granted', signedAt: day(18), signedBy: 'cus-005', createdAt: day(18), updatedAt: day(18) },
    { id: 'con-cus005-image', customerId: 'cus-005', caseId: 'case-005', consentType: 'image_storage', consentStatus: 'granted', signedAt: day(18), signedBy: 'cus-005', createdAt: day(18), updatedAt: day(18) },
  ];
  for (const c of consents) col.set(c.id, c as Record<string, unknown>);
}

function seedNotifications(): void {
  const col = getCollection('notifications');
  const now = new Date();
  const day = (offset: number) => { const d = new Date(now); d.setDate(d.getDate() - offset); return d.toISOString(); };

  const notifications = [
    { id: 'notif-001', eventType: 'new_case_created', title: 'Ca mới được tạo', body: 'Ca SW-260620-001 (Nguyễn Thị Bích Ngọc) vừa được tạo.', caseId: 'case-001', customerId: 'cus-001', recipientUserIds: ['user-001', 'user-003'], channel: 'in_app', status: 'sent', readBy: ['user-001'], createdAt: day(14), sentAt: day(14) },
    { id: 'notif-002', eventType: 'payment_pending', title: 'Thanh toán chờ xác nhận', body: 'Thanh toán 30.000.000 VNĐ cho ca SW-260620-001 chờ xác nhận.', caseId: 'case-001', customerId: 'cus-001', recipientUserIds: ['user-007'], recipientRoles: ['accountant'], channel: 'in_app', status: 'sent', createdAt: day(1), sentAt: day(1) },
    { id: 'notif-003', eventType: 'hospital_coordination_required', title: 'Cần phối hợp bệnh viện', body: 'Ca SW-260622-001 (Lê Thị Mỹ Linh) cần phối hợp lịch lab tại Medika.', caseId: 'case-003', customerId: 'cus-003', recipientUserIds: ['user-010'], channel: 'in_app', status: 'sent', readBy: ['user-010'], createdAt: day(7), sentAt: day(7) },
    { id: 'notif-004', eventType: 'procedure_completed', title: 'Phẫu thuật hoàn thành', body: 'Ca SW-260623-001 (Phạm Thị Thu Hà) đã hoàn thành phẫu thuật. Chờ upload ảnh.', caseId: 'case-004', customerId: 'cus-004', recipientUserIds: ['user-004', 'user-012'], channel: 'in_app', status: 'sent', readBy: ['user-004'], createdAt: day(5), sentAt: day(5) },
    { id: 'notif-005', eventType: 'postop_followup_due', title: 'Followup D7 sắp đến hạn', body: 'Followup D7 cho ca SW-260624-001 (Vũ Thị Minh Châu) cần được thực hiện hôm nay.', caseId: 'case-005', customerId: 'cus-005', recipientUserIds: ['user-011'], channel: 'in_app', status: 'sent', createdAt: day(0), sentAt: day(0) },
    { id: 'notif-006', eventType: 'images_missing', title: 'Thiếu ảnh cho ca', body: 'Ca SW-260623-001 (Mentor Boost) đã hoàn thành PT nhưng chưa upload ảnh before/after.', caseId: 'case-004', customerId: 'cus-004', recipientUserIds: ['user-012', 'user-004'], channel: 'in_app', status: 'sent', readBy: ['user-004'], createdAt: day(5), sentAt: day(5) },
    { id: 'notif-007', eventType: 'payment_pending', title: 'Thanh toán chờ xác nhận', body: 'Thanh toán 40.000.000 VNĐ cho ca SW-260622-001 (Lê Thị Mỹ Linh) chờ xác nhận.', caseId: 'case-003', customerId: 'cus-003', recipientUserIds: ['user-007'], recipientRoles: ['accountant'], channel: 'in_app', status: 'sent', createdAt: day(6), sentAt: day(6) },
    { id: 'notif-008', eventType: 'new_case_created', title: 'Ca mới được tạo', body: 'Ca SW-260624-001 (Vũ Thị Minh Châu) vừa được tạo.', caseId: 'case-005', customerId: 'cus-005', recipientUserIds: ['user-001', 'user-003', 'user-011'], channel: 'in_app', status: 'sent', readBy: ['user-001'], createdAt: day(18), sentAt: day(18) },
    { id: 'notif-009', eventType: 'postop_followup_due', title: 'Followup D1 cần xử lý', body: 'Followup D1 cho ca SW-260624-001 (Vũ Thị Minh Châu) đã đến hạn.', caseId: 'case-005', customerId: 'cus-005', recipientUserIds: ['user-011'], channel: 'in_app', status: 'sent', readBy: ['user-011'], createdAt: day(9), sentAt: day(9) },
    { id: 'notif-010', eventType: 'procedure_scheduled', title: 'Lịch phẫu thuật đã đặt', body: 'Phẫu thuật nâng ngực Mentor Boost cho ca SW-260623-001 dự kiến 5 ngày trước.', caseId: 'case-004', customerId: 'cus-004', recipientUserIds: ['user-008', 'user-009', 'user-010'], channel: 'in_app', status: 'sent', readBy: ['user-008', 'user-010'], createdAt: day(10), sentAt: day(10) },
  ];
  for (const n of notifications) col.set(n.id, n as Record<string, unknown>);
}

function seedAuditLogs(): void {
  const col = getCollection('auditLogs');
  const now = new Date();
  const day = (offset: number) => { const d = new Date(now); d.setDate(d.getDate() - offset); return d.toISOString(); };

  const logs = [
    { id: 'audit-001', actorId: 'user-004', actorName: 'Trần Minh Sang', actorRole: 'master_sales', action: 'customer_created', entityType: 'customer', entityId: 'cus-001', after: { fullName: 'Nguyễn Thị Bích Ngọc', phone: '0912 345 601' }, createdAt: day(15) },
    { id: 'audit-002', actorId: 'user-004', actorName: 'Trần Minh Sang', actorRole: 'master_sales', action: 'case_created', entityType: 'case', entityId: 'case-001', after: { caseCode: 'SW-260620-001', status: 'draft', customerId: 'cus-001' }, createdAt: day(14) },
    { id: 'audit-003', actorId: 'user-004', actorName: 'Trần Minh Sang', actorRole: 'master_sales', action: 'attachment_uploaded', entityType: 'attachment', entityId: 'att-case001-id-front', after: { type: 'national_id_front', fileName: 'cccd-mat-truoc-ngoc.jpg' }, createdAt: day(14) },
    { id: 'audit-004', actorId: 'user-004', actorName: 'Trần Minh Sang', actorRole: 'master_sales', action: 'customer_updated', entityType: 'customer', entityId: 'cus-002', before: { fullName: 'Trần Thị Hương', privacyLevel: 'normal' }, after: { fullName: 'Trần Thị Hương', privacyLevel: 'vip' }, createdAt: day(10) },
    { id: 'audit-005', actorId: 'user-004', actorName: 'Trần Minh Sang', actorRole: 'master_sales', action: 'case_status_changed', entityType: 'case', entityId: 'case-001', before: { status: 'draft' }, after: { status: 'waiting_payment_confirmation' }, createdAt: day(14) },
    { id: 'audit-006', actorId: 'user-007', actorName: 'Hồ Thị Lan', actorRole: 'accountant', action: 'payment_confirmed', entityType: 'payment', entityId: 'pay-001', before: { status: 'pending' }, after: { status: 'confirmed' }, createdAt: day(13) },
    { id: 'audit-007', actorId: 'user-004', actorName: 'Trần Minh Sang', actorRole: 'master_sales', action: 'payment_created', entityType: 'payment', entityId: 'pay-002', after: { amount: 30000000, caseId: 'case-001' }, createdAt: day(1) },
    { id: 'audit-008', actorId: 'user-004', actorName: 'Trần Minh Sang', actorRole: 'master_sales', action: 'staff_assignment_changed', entityType: 'case', entityId: 'case-001', before: {}, after: { masterSalesId: 'user-004', coordinatorId: 'user-010', accountantId: 'user-007' }, createdAt: day(14) },
    { id: 'audit-009', actorId: 'user-010', actorName: 'Trương Văn Khoa', actorRole: 'coordinator', action: 'case_status_changed', entityType: 'case', entityId: 'case-002', before: { status: 'waiting_hospital_coordination' }, after: { status: 'payment_confirmed' }, createdAt: day(7) },
    { id: 'audit-010', actorId: 'user-012', actorName: 'Lý Minh Tú', actorRole: 'media', action: 'attachment_uploaded', entityType: 'attachment', entityId: 'att-case004-before', after: { type: 'before_image', fileName: 'before-mentor-boost-ha.jpg' }, createdAt: day(20) },
    { id: 'audit-011', actorId: 'user-012', actorName: 'Lý Minh Tú', actorRole: 'media', action: 'attachment_visibility_changed', entityType: 'attachment', entityId: 'att-case004-after', before: { visibility: 'private' }, after: { visibility: 'media_approved' }, createdAt: day(5) },
    { id: 'audit-012', actorId: 'user-004', actorName: 'Trần Minh Sang', actorRole: 'master_sales', action: 'consent_updated', entityType: 'consent', entityId: 'con-cus001-treatment', before: { consentStatus: 'pending' }, after: { consentStatus: 'granted', signedBy: 'cus-001' }, createdAt: day(14) },
    { id: 'audit-013', actorId: 'user-007', actorName: 'Hồ Thị Lan', actorRole: 'accountant', action: 'payment_confirmed', entityType: 'payment', entityId: 'pay-003', before: { status: 'pending' }, after: { status: 'confirmed' }, createdAt: day(8) },
    { id: 'audit-014', actorId: 'user-011', actorName: 'Phạm Ngọc Điệp', actorRole: 'cskh_postop', action: 'task_completed', entityType: 'task', entityId: 'task-007', before: { status: 'todo' }, after: { status: 'done', completedAt: day(3) }, createdAt: day(3) },
  ];
  for (const l of logs) col.set(l.id, l as Record<string, unknown>);
}
