export type CustomerSource =
  | 'online'
  | 'offline'
  | 'walk_in'
  | 'referral'
  | 'koc'
  | 'old_data'
  | 'other';

export type PrivacyLevel = 'normal' | 'vip' | 'highly_sensitive';

export type Gender = 'female' | 'male' | 'other' | 'unknown';

export interface Customer {
  id: string;
  customerCode: string;

  fullName: string;
  phone: string;
  secondaryPhone?: string;
  dateOfBirth?: string;
  gender?: Gender;

  // Sensitive — restricted by role
  nationalIdNumber?: string;
  nationalIdIssueDate?: string;
  nationalIdIssuePlace?: string;
  address?: string;

  zalo?: string;
  facebook?: string;

  emergencyContactName?: string;
  emergencyContactPhone?: string;

  source?: CustomerSource;
  sourceDetail?: string;

  privacyLevel: PrivacyLevel;
  privacyNote?: string;
  medicalNote?: string;

  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;

  // Soft-delete + approval workflow
  deletionRequested?: boolean;
  deletionRequestedAt?: string;
  deletionRequestedBy?: string;
  deletionReason?: string;
  deletionApprovedBy?: string;
  deletionApprovedAt?: string;
}

export interface CreateCustomerInput {
  fullName: string;
  phone: string;
  secondaryPhone?: string;
  dateOfBirth?: string;
  gender?: Gender;
  nationalIdNumber?: string;
  nationalIdIssueDate?: string;
  nationalIdIssuePlace?: string;
  address?: string;
  zalo?: string;
  facebook?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  source?: CustomerSource;
  sourceDetail?: string;
  privacyLevel?: PrivacyLevel;
  privacyNote?: string;
  medicalNote?: string;
}

export interface UpdateCustomerInput extends Partial<CreateCustomerInput> {}

export interface RequestDeletionInput {
  customerId: string;
  reason: string;
  requestedBy: string;
}