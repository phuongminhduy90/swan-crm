import { PaymentMethod } from '@/lib/types';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  card: 'Thẻ tín dụng',
  installment: 'Trả góp',
  other: 'Khác',
};

export const PAYMENT_METHOD_HEX: Record<PaymentMethod, string> = {
  cash: '#10B981',
  bank_transfer: '#00ADBE',
  card: '#8B5CF6',
  installment: '#F59E0B',
  other: '#9CA3AF',
};
