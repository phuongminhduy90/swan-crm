import { CaseRecord, Customer, Payment, NotificationEventType } from '@/lib/types';
import { formatCurrency, formatDateVN } from '@/lib/utils/format';

// ── Security: Fields NEVER included in external notifications ──
// Per spec §21.6
const EXCLUDED_FROM_EXTERNAL = [
  'nationalIdNumber',
  'address',
  'medicalNote',
  'privacyNote',
];

interface CaseNotificationData {
  caseRecord: CaseRecord;
  customer: Customer;
  payments?: Payment[];
  locationName?: string;
  staffNames?: Record<string, string>;
}

export function buildNewCaseNotification(data: CaseNotificationData): {
  title: string;
  body: string;
} {
  const { caseRecord, customer, locationName, staffNames } = data;

  const title = `🔔 CA MỚI ĐÃ CHỐT — ${caseRecord.caseCode}`;
  const body = [
    `Khách: ${customer.fullName}`,
    `Dịch vụ: ${caseRecord.mainServiceGroup}`,
    `Tổng bill: ${formatCurrency(caseRecord.totalBillAfterDiscount)}`,
    `Đã thu: ${formatCurrency(caseRecord.amountPaid)}`,
    `Còn lại: ${formatCurrency(caseRecord.remainingAmount)}`,
    '',
    locationName ? `Nơi thực hiện: ${locationName}` : '',
    caseRecord.expectedLabDate
      ? `Ngày xét nghiệm: ${formatDateVN(caseRecord.expectedLabDate)}`
      : '',
    caseRecord.expectedProcedureDate
      ? `Ngày thực hiện: ${formatDateVN(caseRecord.expectedProcedureDate)}`
      : '',
    '',
    staffNames?.masterSales
      ? `Master Sales: ${staffNames.masterSales}`
      : '',
    staffNames?.salesOnline
      ? `Sales Online: ${staffNames.salesOnline}`
      : '',
    staffNames?.salesOffline
      ? `Sales Offline: ${staffNames.salesOffline}`
      : '',
    caseRecord.salesNote ? `\nGhi chú: ${caseRecord.salesNote}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { title, body };
}

export function buildPaymentPendingNotification(data: {
  caseCode: string;
  customerName: string;
  amount: number;
  paymentMethod: string;
  paymentType: string;
  createdByName: string;
}): { title: string; body: string } {
  const { caseCode, customerName, amount, paymentMethod, paymentType, createdByName } = data;

  const methodLabels: Record<string, string> = {
    cash: 'Tiền mặt',
    bank_transfer: 'Chuyển khoản',
    card: 'Thẻ',
    installment: 'Trả góp',
    other: 'Khác',
  };

  const typeLabels: Record<string, string> = {
    deposit: 'Đặt cọc',
    partial: 'Thanh toán thêm',
    full: 'Thanh toán đủ',
    refund: 'Hoàn tiền',
  };

  const title = `💰 THANH TOÁN CHỜ XÁC NHẬN — ${caseCode}`;
  const body = [
    `Khách: ${customerName}`,
    `Số tiền: ${formatCurrency(amount)}`,
    `Hình thức: ${methodLabels[paymentMethod] ?? paymentMethod}`,
    `Loại thanh toán: ${typeLabels[paymentType] ?? paymentType}`,
    `Người nhập: ${createdByName}`,
  ].join('\n');

  return { title, body };
}

export function buildHospitalCoordinationNotification(data: {
  caseCode: string;
  customerName: string;
  locationName: string;
  expectedLabDate?: string;
  expectedProcedureDate?: string;
  coordinatorName: string;
}): { title: string; body: string } {
  const { caseCode, customerName, locationName, expectedLabDate, expectedProcedureDate, coordinatorName } = data;

  const title = `🏥 CA CẦN ĐIỀU PHỐI BỆNH VIỆN — ${caseCode}`;
  const body = [
    `Khách: ${customerName}`,
    `Bệnh viện dự kiến: ${locationName}`,
    expectedLabDate ? `Ngày xét nghiệm dự kiến: ${formatDateVN(expectedLabDate)}` : '',
    expectedProcedureDate ? `Ngày thực hiện dự kiến: ${formatDateVN(expectedProcedureDate)}` : '',
    '',
    `Coordinator phụ trách: ${coordinatorName}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { title, body };
}

export function buildMedicalAlertNotification(caseCode: string): {
  title: string;
  body: string;
} {
  return {
    title: `⚠️ CẢNH BÁO CHUYÊN MÔN — ${caseCode}`,
    body: `Ca ${caseCode} có báo cáo bất thường từ follow-up hậu phẫu. Vui lòng kiểm tra ngay.`,
  };
}

export function buildComplaintNotification(caseCode: string): {
  title: string;
  body: string;
} {
  return {
    title: `🚨 KHIẾU NẠI — ${caseCode}`,
    body: `Ca ${caseCode} có khiếu nại từ khách hàng. Cần xử lý khẩn.`,
  };
}

export function buildPostOpFollowupDueNotification(data: {
  caseCode: string;
  customerName: string;
  followupDay: string;
  assigneeName: string;
}): { title: string; body: string } {
  const { caseCode, customerName, followupDay, assigneeName } = data;
  return {
    title: `📋 FOLLOW HẬU PHẪU ĐẾN HẠN — ${caseCode}`,
    body: `Khách: ${customerName}\nMốc: ${followupDay}\nĐược giao: ${assigneeName}\nVui lòng liên hệ khách hàng để cập nhật tình trạng.`,
  };
}
