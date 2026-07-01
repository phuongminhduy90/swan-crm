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

/**
 * Story PI-2 (Sprint 7.2) — Refund creation schema.
 *
 * Validates the wire format for POST /api/payments/refund. The "amount > original"
 * cap is enforced server-side inside `createRefund()` because it depends on the
 * original payment record (which is fetched inside the function, not at the
 * schema layer). Keeping schema validation pure-shape keeps this file a thin
 * transport contract.
 */
export const createRefundSchema = z.object({
  originalPaymentId: z.string().min(1, 'Vui lòng chọn thanh toán gốc'),
  amount: z
    .number()
    .min(1, 'Số tiền hoàn phải lớn hơn 0')
    .max(10_000_000_000, 'Số tiền hoàn không được vượt quá 10 tỷ VNĐ'),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'card', 'installment', 'other']),
  paymentDate: z.string().min(1, 'Vui lòng chọn ngày hoàn tiền'),
  note: z.string().optional().or(z.literal('')),
});

export type CreatePaymentFormValues = z.infer<typeof createPaymentSchema>;
export type ConfirmPaymentFormValues = z.infer<typeof confirmPaymentSchema>;
export type CreateRefundFormValues = z.infer<typeof createRefundSchema>;
