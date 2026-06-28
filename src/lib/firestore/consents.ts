import { Consent, CreateConsentInput } from '@/lib/types';
import {
  setDocument,
  updateDocument,
  getAllDocuments,
} from '@/lib/firebase/firestore';

const COLLECTION = 'consents';

export async function getConsentsByCustomer(customerId: string): Promise<Consent[]> {
  const data = await getAllDocuments<Record<string, unknown>>(COLLECTION, [
    { field: 'customerId', operator: '==', value: customerId },
  ]);
  return data as unknown as Consent[];
}

export async function getConsentsByCase(caseId: string): Promise<Consent[]> {
  const data = await getAllDocuments<Record<string, unknown>>(COLLECTION, [
    { field: 'caseId', operator: '==', value: caseId },
  ]);
  return data as unknown as Consent[];
}

export async function createConsent(
  input: CreateConsentInput,
): Promise<Consent> {
  const id = `con-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const consent: Consent = {
    id,
    customerId: input.customerId,
    caseId: input.caseId,
    consentType: input.consentType,
    consentStatus: input.consentStatus ?? 'pending',
    note: input.note,
    createdAt: now,
    updatedAt: now,
  };

  await setDocument(COLLECTION, id, consent);
  return consent;
}

export async function updateConsentStatus(
  id: string,
  status: Consent['consentStatus'],
  signedBy?: string,
): Promise<void> {
  await updateDocument(COLLECTION, id, {
    consentStatus: status,
    signedBy,
    signedAt: status === 'granted' ? new Date().toISOString() : undefined,
  });
}
