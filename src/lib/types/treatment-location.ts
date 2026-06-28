export type TreatmentLocationType = 'swan' | 'cih' | 'medika' | 'other_hospital';

export interface TreatmentLocation {
  id: string;
  name: string;
  type: TreatmentLocationType;

  address?: string;
  contactPerson?: string;
  contactPhone?: string;
  note?: string;

  active: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface HospitalCoordination {
  id: string;
  caseId: string;
  treatmentLocationId: string;

  hospitalNotified: boolean;
  hospitalConfirmed: boolean;
  operatingRoomConfirmed: boolean;
  labScheduleConfirmed: boolean;
  doctorScheduleConfirmed: boolean;

  hospitalNote?: string;
  coordinatorId: string;

  notifiedAt?: string;
  confirmedAt?: string;

  createdAt: string;
  updatedAt: string;
}

export interface CreateTreatmentLocationInput {
  name: string;
  type: TreatmentLocationType;
  address?: string;
  contactPerson?: string;
  contactPhone?: string;
  note?: string;
}
