import { z } from 'zod';

export const createPaymentSchema = z.object({
  caseId: z.string().min(1),
  customerId: z.string().min(1),
  amount: z
    .number()
    .min(1, 'Số tiền phải lớn hơn 0')
    .max(10_000_000_000, 'Số tiền không được vượt quá 10 tỷ VNĐ'),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'card', 'installment', 'other']),
  paymentType: z.enum(['deposit', 'partial', 'full', 'refund']),
  paymentDate: z.string().min(1, 'Vui lòng chọn ngày thanh toán'),
  receivedBy: z.string().optional().or(z.literal('')),
  note: z.string().optional().or(z.literal('')),
});

export const confirmPaymentSchema = z.object({
  confirmedBy: z.string().min(1),
  note: z.string().optional().or(z.literal('')),
});

export type CreatePaymentFormValues = z.infer<typeof createPaymentSchema>;
export type ConfirmPaymentFormValues = z.infer<typeof confirmPaymentSchema>;
