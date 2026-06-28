import { z } from 'zod';

export const createCustomerSchema = z.object({
  fullName: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự').max(100),
  phone: z
    .string()
    .trim()
    .min(10, 'Số điện thoại không hợp lệ (tối thiểu 10 số)')
    .max(15)
    .regex(/^[0-9+\s()-]+$/, 'Số điện thoại chỉ chứa số'),
  secondaryPhone: z.string().trim().optional().or(z.literal('')),
  dateOfBirth: z.string().optional().or(z.literal('')),
  gender: z.enum(['female', 'male', 'other', 'unknown']).optional(),
  nationalIdNumber: z
    .string()
    .regex(/^(\d{9}|\d{12})?$/, 'CMND phải 9 số hoặc CCCD phải 12 số')
    .optional()
    .or(z.literal('')),
  nationalIdIssueDate: z.string().optional().or(z.literal('')),
  nationalIdIssuePlace: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  zalo: z.string().optional().or(z.literal('')),
  facebook: z.string().optional().or(z.literal('')),
  emergencyContactName: z.string().optional().or(z.literal('')),
  emergencyContactPhone: z.string().optional().or(z.literal('')),
  source: z
    .enum(['online', 'offline', 'walk_in', 'referral', 'koc', 'old_data', 'other'])
    .optional(),
  sourceDetail: z.string().optional().or(z.literal('')),
  privacyLevel: z.enum(['normal', 'vip', 'highly_sensitive']).default('normal'),
  privacyNote: z.string().optional().or(z.literal('')),
  medicalNote: z.string().optional().or(z.literal('')),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerFormValues = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerFormValues = z.infer<typeof updateCustomerSchema>;
