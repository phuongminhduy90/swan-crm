import { UserRole } from './user';

export type AppointmentType =
  | 'consultation'
  | 'lab_test'
  | 'procedure'
  | 'checkup'
  | 'postop_followup'
  | 'hospital_coordination';

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface Appointment {
  id: string;
  caseId: string;
  customerId: string;

  type: AppointmentType;

  title: string;
  startTime: string;
  endTime?: string;

  locationId?: string;
  assignedStaffIds: string[];

  status: AppointmentStatus;

  note?: string;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentInput {
  caseId: string;
  customerId: string;
  type: AppointmentType;
  title: string;
  startTime: string;
  endTime?: string;
  locationId?: string;
  assignedStaffIds?: string[];
  note?: string;
}