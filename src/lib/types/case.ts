import { TreatmentLocationType } from './treatment-location';

export type ServiceCategory =
  | 'nose'
  | 'breast'
  | 'body'
  | 'eyes'
  | 'skin'
  | 'injectable'
  | 'other';

export type CaseStatus =
  | 'draft'
  | 'waiting_customer_info'
  | 'waiting_payment_confirmation'
  | 'payment_confirmed'
  | 'waiting_location_assignment'
  | 'waiting_hospital_confirmation'
  | 'hospital_confirmed'
  | 'waiting_doctor_review'
  | 'waiting_lab_test'
  | 'lab_test_done'
  | 'medically_approved'
  | 'scheduled'
  | 'reminder_sent'
  | 'checked_in'
  | 'in_procedure'
  | 'procedure_completed'
  | 'waiting_images_upload'
  | 'post_op_d1'
  | 'post_op_d3'
  | 'post_op_d7'
  | 'post_op_d14'
  | 'post_op_d30'
  | 'post_op_d90'
  | 'completed'
  | 'postponed'
  | 'cancelled'
  | 'complaint'
  | 'medical_alert'
  | 'medical_alert_resolved';

export type PaymentStatus = 'unpaid' | 'deposit' | 'partial' | 'paid' | 'refunded';
export type CasePriority = 'normal' | 'high' | 'urgent';
export type DiscountType = 'none' | 'percent' | 'fixed' | 'gift';

export interface CaseRecord {
  id: string;
  caseCode: string;
  customerId: string;
  caseDate: string;

  mainServiceGroup: ServiceCategory;

  treatmentLocationId?: string;
  treatmentLocationType?: TreatmentLocationType;

  expectedLabDate?: string;
  expectedProcedureDate?: string;
  actualProcedureDate?: string;

  status: CaseStatus;
  priority: CasePriority;

  totalBillBeforeDiscount: number;
  discountType?: DiscountType;
  discountValue?: number;
  discountReason?: string;

  totalBillAfterDiscount: number;
  amountPaid: number;
  remainingAmount: number;
  paymentStatus: PaymentStatus;

  salesNote?: string;
  medicalNote?: string;
  internalNote?: string;

  privacyLevel: 'normal' | 'vip' | 'highly_sensitive';

  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;

  /** Soft-delete flag — false khi bị cascade-delete từ customer deletion */
  active?: boolean;
}

export interface CreateCaseInput {
  customerId: string;
  mainServiceGroup: ServiceCategory;
  priority?: CasePriority;
  totalBillBeforeDiscount: number;
  discountType?: DiscountType;
  discountValue?: number;
  discountReason?: string;
  totalBillAfterDiscount: number;
  amountPaid?: number;
  treatmentLocationId?: string;
  treatmentLocationType?: TreatmentLocationType;
  expectedLabDate?: string;
  expectedProcedureDate?: string;
  salesNote?: string;
  medicalNote?: string;
  internalNote?: string;
  privacyLevel?: 'normal' | 'vip' | 'highly_sensitive';
}

export interface UpdateCaseInput extends Partial<CreateCaseInput> {
  status?: CaseStatus;
  actualProcedureDate?: string;
  amountPaid?: number;
  remainingAmount?: number;
  paymentStatus?: PaymentStatus;
}

export interface CaseService {
  id: string;
  caseId: string;

  serviceName: string;
  serviceCategory: ServiceCategory;

  listedPrice: number;
  finalPrice: number;
  quantity: number;

  isMainService: boolean;
  isGift: boolean;
  isUpsell: boolean;

  note?: string;
  active?: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface CreateCaseServiceInput {
  caseId: string;
  serviceName: string;
  serviceCategory: ServiceCategory;
  listedPrice: number;
  finalPrice: number;
  quantity: number;
  isMainService?: boolean;
  isGift?: boolean;
  isUpsell?: boolean;
  note?: string;
}