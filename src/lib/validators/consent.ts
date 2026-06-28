import { z } from 'zod';

export const CONSENT_TYPES = [
  'treatment',
  'image_storage',
  'marketing_usage',
  'hospital_sharing',
] as const;

export const CONSENT_STATUSES = [
  'pending',
  'granted',
  'denied',
  'revoked',
] as const;

export const createConsentSchema = z.object({
  customerId: z.string().min(1, 'Chưa chọn khách hàng'),
  caseId: z.string().optional().or(z.literal('')),
  consentType: z.enum(CONSENT_TYPES, {
    required_error: 'Chưa chọn loại consent',
  }),
  consentStatus: z.enum(CONSENT_STATUSES).optional().default('pending'),
  note: z.string().max(500, 'Ghi chú tối đa 500 ký tự').optional(),
});

export const updateConsentStatusSchema = z.object({
  status: z.enum(CONSENT_STATUSES),
  signedBy: z.string().optional(),
});

export const CONSENT_TYPE_LABELS: Record<(typeof CONSENT_TYPES)[number], string> = {
  treatment: 'Đồng ý điều trị',
  image_storage: 'Lưu trữ hình ảnh',
  marketing_usage: 'Sử dụng marketing',
  hospital_sharing: 'Chia sẻ bệnh viện',
};

export type CreateConsentFormValues = z.infer<typeof createConsentSchema>;
export type UpdateConsentStatusValues = z.infer<typeof updateConsentStatusSchema>;