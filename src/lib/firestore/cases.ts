import { format } from 'date-fns';
import {
  CaseRecord,
  CaseService,
  CaseStatus,
  CreateCaseInput,
  CreateCaseServiceInput,
  UpdateCaseInput,
} from '@/lib/types';
import {
  getDocument,
  setDocument,
  updateDocument,
  getAllDocuments,
} from '@/lib/firebase/firestore';
import { isMockEnabled, getCollection, initSeedData } from '@/lib/mock/store';

const CASES_COLLECTION = 'cases';
const CASE_SERVICES_COLLECTION = 'caseServices';

function generateCaseCode(): string {
  const date = format(new Date(), 'yyMMdd');
  if (isMockEnabled()) {
    initSeedData();
    const col = getCollection(CASES_COLLECTION);
    const count = col.size + 1;
    return `SW-${date}-${String(count).padStart(3, '0')}`;
  }
  const suffix = Date.now().toString(36).slice(-6).toUpperCase();
  return `SW-${date}-${suffix}`;
}

export async function getCase(id: string): Promise<CaseRecord | null> {
  const data = await getDocument<Record<string, unknown>>(CASES_COLLECTION, id);
  if (!data) return null;
  return data as unknown as CaseRecord;
}

export async function getAllCases(): Promise<CaseRecord[]> {
  const data = await getAllDocuments<Record<string, unknown>>(CASES_COLLECTION);
  return (data as unknown as CaseRecord[])
    .filter((c) => c.active !== false) // exclude soft-deleted
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

export async function getCasesByCustomer(customerId: string): Promise<CaseRecord[]> {
  const data = await getAllDocuments<Record<string, unknown>>(CASES_COLLECTION, [
    { field: 'customerId', operator: '==', value: customerId },
  ]);
  return (data as unknown as CaseRecord[])
    .filter((c) => c.active !== false) // exclude soft-deleted
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

export async function createCase(
  input: CreateCaseInput,
  createdBy: string,
): Promise<CaseRecord> {
  const id = `case-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const caseCode = generateCaseCode();
  const now = new Date().toISOString();
  const amountPaid = input.amountPaid ?? 0;
  const remainingAmount = input.totalBillAfterDiscount - amountPaid;

  const caseRecord: CaseRecord = {
    id,
    caseCode,
    customerId: input.customerId,
    caseDate: now,
    mainServiceGroup: input.mainServiceGroup,
    treatmentLocationId: input.treatmentLocationId,
    treatmentLocationType: input.treatmentLocationType,
    expectedLabDate: input.expectedLabDate,
    expectedProcedureDate: input.expectedProcedureDate,
    status: 'draft',
    priority: input.priority ?? 'normal',
    totalBillBeforeDiscount: input.totalBillBeforeDiscount,
    discountType: input.discountType,
    discountValue: input.discountValue,
    discountReason: input.discountReason,
    totalBillAfterDiscount: input.totalBillAfterDiscount,
    amountPaid,
    remainingAmount,
    paymentStatus: amountPaid === 0 ? 'unpaid' : amountPaid >= input.totalBillAfterDiscount ? 'paid' : 'deposit',
    salesNote: input.salesNote,
    medicalNote: input.medicalNote,
    internalNote: input.internalNote,
    privacyLevel: input.privacyLevel ?? 'normal',
    createdBy,
    createdAt: now,
    updatedAt: now,
  };

  await setDocument(CASES_COLLECTION, id, caseRecord);
  return caseRecord;
}

export async function updateCase(
  id: string,
  input: UpdateCaseInput,
  updatedBy: string,
): Promise<void> {
  await updateDocument(CASES_COLLECTION, id, { ...input, updatedBy });
}

export async function updateCaseStatus(
  id: string,
  status: CaseStatus,
  updatedBy: string,
): Promise<void> {
  await updateDocument(CASES_COLLECTION, id, { status, updatedBy });
}

// Case Services
export async function getCaseServices(caseId: string): Promise<CaseService[]> {
  const data = await getAllDocuments<Record<string, unknown>>(CASE_SERVICES_COLLECTION, [
    { field: 'caseId', operator: '==', value: caseId },
  ]);
  return data as unknown as CaseService[];
}

export async function addCaseService(
  input: CreateCaseServiceInput,
): Promise<CaseService> {
  const id = `csvc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const service: CaseService = {
    id,
    caseId: input.caseId,
    serviceName: input.serviceName,
    serviceCategory: input.serviceCategory,
    listedPrice: input.listedPrice,
    finalPrice: input.finalPrice,
    quantity: input.quantity,
    isMainService: input.isMainService ?? false,
    isGift: input.isGift ?? false,
    isUpsell: input.isUpsell ?? false,
    note: input.note,
    createdAt: now,
    updatedAt: now,
  };

  await setDocument(CASE_SERVICES_COLLECTION, id, service);
  return service;
}

export async function updateCaseService(
  id: string,
  data: Partial<CaseService>,
): Promise<void> {
  await updateDocument(CASE_SERVICES_COLLECTION, id, data);
}

export async function removeCaseService(id: string): Promise<void> {
  // Soft delete — set to inactive
  await updateDocument(CASE_SERVICES_COLLECTION, id, { active: false });
}
