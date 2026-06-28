export type ConsentType =
  | 'treatment'
  | 'image_storage'
  | 'marketing_usage'
  | 'hospital_sharing';

export type ConsentStatus = 'pending' | 'granted' | 'denied' | 'revoked';

export interface Consent {
  id: string;
  customerId: string;
  caseId?: string;

  consentType: ConsentType;
  consentStatus: ConsentStatus;

  signedAt?: string;
  signedBy?: string;
  documentUrl?: string;
  documentStoragePath?: string;

  note?: string;

  createdAt: string;
  updatedAt: string;
}

export interface CreateConsentInput {
  customerId: string;
  caseId?: string;
  consentType: ConsentType;
  consentStatus?: ConsentStatus;
  note?: string;
}
