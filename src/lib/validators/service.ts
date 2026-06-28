import { z } from 'zod';

const serviceCategories = ['nose', 'breast', 'body', 'eyes', 'skin', 'injectable', 'other'] as const;

export const createServiceSchema = z.object({
  name: z.string().min(2, 'Tên dịch vụ phải có ít nhất 2 ký tự').max(200),
  category: z.enum(serviceCategories, { required_error: 'Vui lòng chọn nhóm dịch vụ' }),
  defaultPrice: z.number().min(0, 'Giá không hợp lệ').optional(),
  description: z.string().optional().or(z.literal('')),
});

export const updateServiceSchema = createServiceSchema.partial();

export type CreateServiceFormValues = z.infer<typeof createServiceSchema>;
export type UpdateServiceFormValues = z.infer<typeof updateServiceSchema>;
