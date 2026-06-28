import { UserRole } from './user';

export interface StaffAssignment {
  id: string;
  caseId: string;

  masterSalesId?: string;
  salesOnlineId?: string;
  salesOfflineId?: string;
  accountantId?: string;
  doctorId?: string;
  nurseIds?: string[];
  coordinatorId?: string;
  cskhPostopId?: string;
  mediaId?: string;

  assignedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateStaffAssignmentInput {
  masterSalesId?: string | null;
  salesOnlineId?: string | null;
  salesOfflineId?: string | null;
  accountantId?: string | null;
  doctorId?: string | null;
  nurseIds?: string[];
  coordinatorId?: string | null;
  cskhPostopId?: string | null;
  mediaId?: string | null;
}
