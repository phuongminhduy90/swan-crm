export type AttachmentType =
  | 'national_id_front'
  | 'national_id_back'
  | 'payment_proof'
  | 'before_image'
  | 'immediately_after_image'
  | 'postop_d1'
  | 'postop_d3'
  | 'postop_d7'
  | 'postop_d14'
  | 'postop_d30'
  | 'postop_d90'
  | 'medical_document'
  | 'consent_form'
  | 'other';

export type AttachmentVisibility =
  | 'private'
  | 'medical_team'
  | 'sales_team'
  | 'media_approved'
  | 'public_marketing';

export interface Attachment {
  id: string;
  caseId: string;
  customerId: string;

  type: AttachmentType;

  fileName: string;
  fileUrl: string;
  storagePath: string;
  mimeType: string;
  size: number;

  visibility: AttachmentVisibility;

  consentRequired: boolean;
  consentId?: string;

  note?: string;

  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAttachmentInput {
  caseId: string;
  customerId: string;
  type: AttachmentType;
  fileName: string;
  fileUrl: string;
  storagePath: string;
  mimeType: string;
  size: number;
  visibility?: AttachmentVisibility;
  consentRequired?: boolean;
  note?: string;
}
