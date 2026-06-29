import { CustomerSource, PrivacyLevel } from '@/lib/types';

export const CUSTOMER_SOURCE_LABELS: Record<CustomerSource, string> = {
  online: 'Trực tuyến',
  offline: 'Trực tiếp',
  walk_in: 'Walk-in',
  referral: 'Giới thiệu',
  koc: 'KOC',
  old_data: 'Dữ liệu cũ',
  other: 'Khác',
};

export const CUSTOMER_SOURCE_HEX: Record<CustomerSource, string> = {
  online: '#00ADBE',
  offline: '#10B981',
  walk_in: '#8B5CF6',
  referral: '#C9A96E',
  koc: '#EC4899',
  old_data: '#6B7280',
  other: '#9CA3AF',
};

export const PRIVACY_LEVEL_LABELS: Record<PrivacyLevel, string> = {
  normal: 'Bình thường',
  vip: 'VIP',
  highly_sensitive: 'Bảo mật cao',
};

export const PRIVACY_LEVEL_HEX: Record<PrivacyLevel, string> = {
  normal: '#10B981',
  vip: '#C9A96E',
  highly_sensitive: '#EF4444',
};
