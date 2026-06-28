import { Appointment, CreateAppointmentInput } from '@/lib/types';
import {
  getDocument,
  setDocument,
  updateDocument,
  getAllDocuments,
} from '@/lib/firebase/firestore';

const COLLECTION = 'appointments';

export async function getAppointment(id: string): Promise<Appointment | null> {
  const data = await getDocument<Record<string, unknown>>(COLLECTION, id);
  if (!data) return null;
  return data as unknown as Appointment;
}

export async function getAppointmentsByCase(caseId: string): Promise<Appointment[]> {
  const data = await getAllDocuments<Record<string, unknown>>(COLLECTION, [
    { field: 'caseId', operator: '==', value: caseId },
  ]);
  return data as unknown as Appointment[];
}

export async function getAllAppointments(): Promise<Appointment[]> {
  const data = await getAllDocuments<Record<string, unknown>>(COLLECTION);
  return (data as unknown as Appointment[]).sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );
}

export async function createAppointment(
  input: CreateAppointmentInput,
  createdBy: string,
): Promise<Appointment> {
  const id = `appt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const appointment: Appointment = {
    id,
    caseId: input.caseId,
    customerId: input.customerId,
    type: input.type,
    title: input.title,
    startTime: input.startTime,
    endTime: input.endTime,
    locationId: input.locationId,
    assignedStaffIds: input.assignedStaffIds ?? [],
    status: 'scheduled',
    note: input.note,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };

  await setDocument(COLLECTION, id, appointment);
  return appointment;
}

export async function updateAppointment(
  id: string,
  data: Partial<Appointment>,
): Promise<void> {
  await updateDocument(COLLECTION, id, data);
}
