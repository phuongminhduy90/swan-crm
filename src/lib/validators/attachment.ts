import { z } from 'zod';

export const ATTACHMENT_TYPES = [
  'national_id_front',
  'national_id_back',
  'payment_proof',
  'before_image',
  'immediately_after_image',
  'postop_d1',
  'postop_d3',
  'postop_d7',
  'postop_d14',
  'postop_d30',
  'postop_d90',
  'medical_document',
  'consent_form',
  'other',
] as const;

export const ATTACHMENT_VISIBILITIES = [
  'private',
  'medical_team',
  'sales_team',
  'media_approved',
  'public_marketing',
] as const;

// Max 20 MB
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export const createAttachmentSchema = z.object({
  caseId: z.string().min(1, 'Chưa chọn ca'),
  customerId: z.string().min(1, 'Chưa chọn khách hàng'),
  type: z.enum(ATTACHMENT_TYPES, { required_error: 'Chưa chọn loại file' }),
  fileName: z.string().min(1, 'Tên file không hợp lệ'),
  fileUrl: z.string().min(1, 'URL file không hợp lệ'),
  storagePath: z.string().min(1, 'Đường dẫn lưu trữ không hợp lệ'),
  mimeType: z.string().min(1, 'Định dạng file không hợp lệ'),
  size: z
    .number()
    .int()
    .nonnegative()
    .max(MAX_FILE_SIZE_BYTES, 'File quá lớn (tối đa 20MB)'),
  visibility: z
    .enum(ATTACHMENT_VISIBILITIES)
    .optional()
    .default('private'),
  consentRequired: z.boolean().optional(),
  note: z.string().max(500, 'Ghi chú tối đa 500 ký tự').optional(),
});

export const updateAttachmentVisibilitySchema = z.object({
  visibility: z.enum(ATTACHMENT_VISIBILITIES),
});

export const ATTACHMENT_TYPE_LABELS: Record<(typeof ATTACHMENT_TYPES)[number], string> = {
  national_id_front: 'CCCD mặt trước',
  national_id_back: 'CCCD mặt sau',
  payment_proof: 'Bằng chứng thanh toán',
  before_image: 'Ảnh trước PT',
  immediately_after_image: 'Ảnh ngay sau PT',
  postop_d1: 'Ảnh sau PT D1',
  postop_d3: 'Ảnh sau PT D3',
  postop_d7: 'Ảnh sau PT D7',
  postop_d14: 'Ảnh sau PT D14',
  postop_d30: 'Ảnh sau PT D30',
  postop_d90: 'Ảnh sau PT D90',
  medical_document: 'Tài liệu y tế',
  consent_form: 'Biểu mẫu consent',
  other: 'Khác',
};

export const ATTACHMENT_VISIBILITY_LABELS: Record<
  (typeof ATTACHMENT_VISIBILITIES)[number],
  string
> = {
  private: 'Riêng tư',
  medical_team: 'Nhóm y tế',
  sales_team: 'Nhóm kinh doanh',
  media_approved: 'Media duyệt',
  public_marketing: 'Marketing công khai',
};

export type CreateAttachmentFormValues = z.infer<typeof createAttachmentSchema>;
export type UpdateAttachmentVisibilityValues = z.infer<
  typeof updateAttachmentVisibilitySchema
>;