import { TreatmentLocation, HospitalCoordination, CreateTreatmentLocationInput } from '@/lib/types';
import {
  getDocument,
  setDocument,
  updateDocument,
  getAllDocuments,
} from '@/lib/firebase/firestore';

const LOCATIONS_COLLECTION = 'treatmentLocations';
const COORDINATIONS_COLLECTION = 'hospitalCoordinations';

export async function getAllTreatmentLocations(): Promise<TreatmentLocation[]> {
  const data = await getAllDocuments<Record<string, unknown>>(LOCATIONS_COLLECTION);
  return (data as unknown as TreatmentLocation[]).filter((l) => l.active !== false);
}

export async function getTreatmentLocation(id: string): Promise<TreatmentLocation | null> {
  const data = await getDocument<Record<string, unknown>>(LOCATIONS_COLLECTION, id);
  if (!data) return null;
  return data as unknown as TreatmentLocation;
}

export async function createTreatmentLocation(
  input: CreateTreatmentLocationInput,
): Promise<TreatmentLocation> {
  const id = `loc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const location: TreatmentLocation = {
    id,
    name: input.name,
    type: input.type,
    address: input.address,
    contactPerson: input.contactPerson,
    contactPhone: input.contactPhone,
    note: input.note,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  await setDocument(LOCATIONS_COLLECTION, id, location);
  return location;
}

export async function updateTreatmentLocation(
  id: string,
  data: Partial<TreatmentLocation>,
): Promise<void> {
  await updateDocument(LOCATIONS_COLLECTION, id, data);
}

// Hospital Coordinations
export async function getCoordinationByCase(caseId: string): Promise<HospitalCoordination | null> {
  const data = await getAllDocuments<Record<string, unknown>>(COORDINATIONS_COLLECTION, [
    { field: 'caseId', operator: '==', value: caseId },
  ]);
  return data.length > 0 ? (data[0] as unknown as HospitalCoordination) : null;
}

export async function createHospitalCoordination(
  caseId: string,
  treatmentLocationId: string,
  coordinatorId: string,
): Promise<HospitalCoordination> {
  const id = `coord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const coordination: HospitalCoordination = {
    id,
    caseId,
    treatmentLocationId,
    hospitalNotified: false,
    hospitalConfirmed: false,
    operatingRoomConfirmed: false,
    labScheduleConfirmed: false,
    doctorScheduleConfirmed: false,
    coordinatorId,
    createdAt: now,
    updatedAt: now,
  };

  await setDocument(COORDINATIONS_COLLECTION, id, coordination);
  return coordination;
}

export async function updateHospitalCoordination(
  id: string,
  data: Partial<HospitalCoordination>,
): Promise<void> {
  await updateDocument(COORDINATIONS_COLLECTION, id, data);
}
