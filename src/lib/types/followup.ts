export type FollowupDay = 'D1' | 'D3' | 'D7' | 'D14' | 'D30' | 'D90';

export type FollowupStatus =
  | 'pending'
  | 'contacted'
  | 'no_response'
  | 'issue_reported'
  | 'completed';

export type SeverityLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface Followup {
  id: string;
  caseId: string;
  customerId: string;

  followupDay: FollowupDay;
  dueDate: string;

  assignedTo?: string; // có thể chưa có người phụ trách khi tạo tự động

  status: FollowupStatus;

  customerCondition?: string;
  painLevel?: SeverityLevel;
  swellingLevel?: SeverityLevel;
  bruisingLevel?: SeverityLevel;

  requestedImage: boolean;
  imageUploaded: boolean;

  note?: string;
  nextAction?: string;

  customerPhone?: string;

  createdAt: string;
  updatedAt: string;
}

export interface UpdateFollowupInput {
  status?: FollowupStatus;
  customerCondition?: string;
  painLevel?: SeverityLevel;
  swellingLevel?: SeverityLevel;
  bruisingLevel?: SeverityLevel;
  requestedImage?: boolean;
  imageUploaded?: boolean;
  note?: string;
  nextAction?: string;
}
