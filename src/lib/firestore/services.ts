import { Service, CreateServiceInput } from '@/lib/types';
import {
  getDocument,
  setDocument,
  updateDocument,
  getAllDocuments,
} from '@/lib/firebase/firestore';

const COLLECTION = 'services';

export async function getAllServices(): Promise<Service[]> {
  const data = await getAllDocuments<Record<string, unknown>>(COLLECTION);
  return (data as unknown as Service[]).filter((s) => s.active !== false);
}

export async function getService(id: string): Promise<Service | null> {
  const data = await getDocument<Record<string, unknown>>(COLLECTION, id);
  if (!data) return null;
  return data as unknown as Service;
}

export async function createService(input: CreateServiceInput): Promise<Service> {
  const id = `svc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const service: Service = {
    id,
    name: input.name,
    category: input.category,
    defaultPrice: input.defaultPrice,
    description: input.description,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  await setDocument(COLLECTION, id, service);
  return service;
}

export async function updateService(id: string, data: Partial<Service>): Promise<void> {
  await updateDocument(COLLECTION, id, data);
}

export async function deactivateService(id: string): Promise<void> {
  await updateDocument(COLLECTION, id, { active: false });
}
