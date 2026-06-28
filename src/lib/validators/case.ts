import { z } from 'zod';

const serviceCategories = ['nose', 'breast', 'body', 'eyes', 'skin', 'injectable', 'other'] as const;

export const createCaseSchema = z.object({
  customerId: z.string().min(1, 'Vui lòng chọn khách hàng'),
  mainServiceGroup: z.enum(serviceCategories, { required_error: 'Vui lòng chọn nhóm dịch vụ' }),
  priority: z.enum(['normal', 'high', 'urgent']).default('normal'),
  totalBillBeforeDiscount: z.number().min(0, 'Tổng bill không hợp lệ'),
  discountType: z.enum(['none', 'percent', 'fixed', 'gift']).optional(),
  discountValue: z.number().min(0).optional(),
  discountReason: z.string().optional().or(z.literal('')),
  totalBillAfterDiscount: z.number().min(0),
  amountPaid: z.number().min(0).default(0),
  treatmentLocationId: z.string().optional().or(z.literal('')),
  treatmentLocationType: z.enum(['swan', 'cih', 'medika', 'other_hospital']).optional(),
  expectedLabDate: z.string().optional().or(z.literal('')),
  expectedProcedureDate: z.string().optional().or(z.literal('')),
  salesNote: z.string().optional().or(z.literal('')),
  medicalNote: z.string().optional().or(z.literal('')),
  internalNote: z.string().optional().or(z.literal('')),
  privacyLevel: z.enum(['normal', 'vip', 'highly_sensitive']).default('normal'),
}).refine(
  (data) => data.totalBillAfterDiscount <= data.totalBillBeforeDiscount,
  {
    message: 'Tổng bill sau giảm không được lớn hơn tổng bill trước giảm',
    path: ['totalBillAfterDiscount'],
  },
).refine(
  (data) => {
    if (data.discountType === 'percent' && data.discountValue !== undefined) {
      return data.discountValue >= 0 && data.discountValue <= 100;
    }
    return true;
  },
  { message: 'Giảm theo % phải từ 0 đến 100', path: ['discountValue'] },
).refine(
  (data) => {
    if (data.discountType === 'fixed' && data.discountValue !== undefined) {
      return data.discountValue <= data.totalBillBeforeDiscount;
    }
    return true;
  },
  { message: 'Giảm cố định không được lớn hơn tổng bill', path: ['discountValue'] },
);

export const addCaseServiceSchema = z.object({
  serviceName: z.string().min(1, 'Vui lòng nhập tên dịch vụ'),
  serviceCategory: z.enum(serviceCategories),
  listedPrice: z.number().min(0),
  finalPrice: z.number().min(0),
  quantity: z.number().min(1).default(1),
  isMainService: z.boolean().default(false),
  isGift: z.boolean().default(false),
  isUpsell: z.boolean().default(false),
  note: z.string().optional().or(z.literal('')),
});

export const updateCaseStatusSchema = z.object({
  status: z.string().min(1),
  note: z.string().optional().or(z.literal('')),
});

export type CreateCaseFormValues = z.infer<typeof createCaseSchema>;
export type AddCaseServiceFormValues = z.infer<typeof addCaseServiceSchema>;

export const updateCaseSchema = z.object({
  customerId: z.string().optional(),
  mainServiceGroup: z.enum(serviceCategories).optional(),
  priority: z.enum(['normal', 'high', 'urgent']).optional(),
  totalBillBeforeDiscount: z.number().min(0).optional(),
  discountType: z.enum(['none', 'percent', 'fixed', 'gift']).optional(),
  discountValue: z.number().min(0).optional(),
  discountReason: z.string().optional().or(z.literal('')),
  totalBillAfterDiscount: z.number().min(0).optional(),
  amountPaid: z.number().min(0).optional(),
  treatmentLocationId: z.string().optional().or(z.literal('')),
  treatmentLocationType: z.enum(['swan', 'cih', 'medika', 'other_hospital']).optional(),
  expectedLabDate: z.string().optional().or(z.literal('')),
  expectedProcedureDate: z.string().optional().or(z.literal('')),
  salesNote: z.string().optional().or(z.literal('')),
  medicalNote: z.string().optional().or(z.literal('')),
  internalNote: z.string().optional().or(z.literal('')),
  privacyLevel: z.enum(['normal', 'vip', 'highly_sensitive']).optional(),
}).refine(
  (data) => {
    if (
      data.totalBillAfterDiscount !== undefined &&
      data.totalBillBeforeDiscount !== undefined
    ) {
      return data.totalBillAfterDiscount <= data.totalBillBeforeDiscount;
    }
    return true;
  },
  {
    message: 'Tổng bill sau giảm không được lớn hơn tổng bill trước giảm',
    path: ['totalBillAfterDiscount'],
  },
);
export type UpdateCaseFormValues = z.infer<typeof updateCaseSchema>;
