export type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'installment' | 'other';
export type PaymentType = 'deposit' | 'partial' | 'full' | 'refund';
export type PaymentRecordStatus = 'pending' | 'confirmed' | 'rejected';

export interface Payment {
  id: string;
  caseId: string;
  customerId: string;

  amount: number;
  paymentMethod: PaymentMethod;
  paymentType: PaymentType;

  receivedBy?: string;
  confirmedBy?: string;

  paymentDate: string;
  confirmedAt?: string;

  proofImageUrl?: string;
  proofStoragePath?: string;

  note?: string;
  status: PaymentRecordStatus;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentInput {
  caseId: string;
  customerId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentType: PaymentType;
  paymentDate: string;
  receivedBy?: string;
  note?: string;
}

export interface ConfirmPaymentInput {
  confirmedBy: string;
  note?: string;
}