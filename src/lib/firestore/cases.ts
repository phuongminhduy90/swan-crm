import { format } from 'date-fns';
import {
  CaseRecord,
  CaseService,
  CaseStatus,
  CreateCaseInput,
  CreateCaseServiceInput,
  UpdateCaseInput,
  UserRole,
} from '@/lib/types';
import {
  getDocument,
  setDocument,
  updateDocument,
  getAllDocuments,
} from '@/lib/firebase/firestore';
import { isMockEnabled, getCollection, initSeedData } from '@/lib/mock/store';
import { isFlagEnabled } from '@/lib/feature-flags';
import { writeAuditLog } from '@/lib/firestore/audit';
import {
  recomputeBillFromPayments,
  recomputeBillFromServices,
  snapshotToCaseUpdate,
} from '@/lib/billing/recompute';

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

/**
 * Story F-HIGH-28 (Sprint 7.2) — Bill recompute helper.
 *
 * After a service is added / updated / removed, the case bill totals must
 * reflect the new state. When `NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE` is ON,
 * this helper:
 *  1. Recomputes `totalBillBeforeDiscount` / `totalBillAfterDiscount` from
 *     the service list (re-applying the case's discount).
 *  2. Persists the new totals to the case.
 *  3. Re-aggregates `amountPaid` / `refundedAmount` / `remainingAmount` /
 *     `paymentStatus` from the full payment history (pure recompute).
 *  4. Writes an audit log entry (`bill_recomputed`) so the accountant can
 *     trace the recompute.
 *
 * When the flag is OFF, this is a no-op — the existing flow continues to
 * mutate `totalBill*` only on case-form submission and `amountPaid` only on
 * payment confirm/reject (Sprint 6.4 behaviour preserved).
 */
async function recomputeBillForCase(
  caseId: string,
  trigger: 'service_added' | 'service_removed' | 'service_updated',
  actor: { uid: string; displayName: string; role: UserRole },
): Promise<void> {
  if (!isFlagEnabled('BILL_RECOMPUTE')) return;

  const [caseRecord, services] = await Promise.all([
    getCase(caseId),
    getCaseServices(caseId),
  ]);
  if (!caseRecord) return;

  // 1. Recompute totals from services.
  const newTotals = recomputeBillFromServices(services, caseRecord);

  // 2. Persist the new totals first so the recompute below sees them.
  await updateCase(
    caseId,
    {
      totalBillBeforeDiscount: newTotals.totalBillBeforeDiscount,
      totalBillAfterDiscount: newTotals.totalBillAfterDiscount,
    },
    actor.uid,
  );

  // 3. Re-aggregate paid/refunded/remaining from the payment history.
  //    Dynamic import avoids a circular dep with `./payments`.
  const { getPaymentsByCase } = await import('@/lib/firestore/payments');
  const payments = await getPaymentsByCase(caseId);
  const snapshot = recomputeBillFromPayments({
    caseRecord: {
      id: caseRecord.id,
      totalBillAfterDiscount: newTotals.totalBillAfterDiscount,
    },
    payments,
  });
  await updateCase(caseId, snapshotToCaseUpdate(snapshot), actor.uid);

  // 4. Audit trail (best-effort — failure here does not roll back the
  //    recompute, since the financial state is already correct).
  try {
    await writeAuditLog({
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: 'bill_recomputed',
      entityType: 'case',
      entityId: caseId,
      after: {
        trigger,
        amountPaid: snapshot.amountPaid,
        refundedAmount: snapshot.refundedAmount,
        remainingAmount: snapshot.remainingAmount,
        paymentStatus: snapshot.paymentStatus,
        totalBillAfterDiscount: newTotals.totalBillAfterDiscount,
        billHash: snapshot.billHash,
      },
    });
  } catch (err) {
    // Audit failures must not block the financial recompute.
    console.error('[cases] bill_recomputed audit log failed:', err);
  }
}

const DEV_ACTOR: { uid: string; displayName: string; role: UserRole } = {
  uid: 'dev-user',
  displayName: 'Dev User',
  role: 'admin',
};

export async function addCaseService(
  input: CreateCaseServiceInput,
  actor: { uid: string; displayName: string; role: UserRole } = DEV_ACTOR,
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

  // Story F-HIGH-28 — trigger bill recompute after service add.
  await recomputeBillForCase(input.caseId, 'service_added', actor);

  return service;
}

export async function updateCaseService(
  id: string,
  data: Partial<CaseService>,
  actor: { uid: string; displayName: string; role: UserRole } = DEV_ACTOR,
): Promise<void> {
  await updateDocument(CASE_SERVICES_COLLECTION, id, data);

  // Story F-HIGH-28 — trigger bill recompute after service update (price /
  // quantity / gift flag change). We re-read the service to get its caseId
  // since the caller only supplied the row id.
  try {
    const row = await getDocument<Record<string, unknown>>(CASE_SERVICES_COLLECTION, id);
    const caseId = (row as { caseId?: string } | null)?.caseId;
    if (caseId) {
      await recomputeBillForCase(caseId, 'service_updated', actor);
    }
  } catch (err) {
    console.error('[cases] updateCaseService recompute failed:', err);
  }
}

export async function removeCaseService(
  id: string,
  actor: { uid: string; displayName: string; role: UserRole } = DEV_ACTOR,
): Promise<void> {
  // Look up the caseId BEFORE soft-deleting so we can recompute after.
  let caseId: string | undefined;
  try {
    const row = await getDocument<Record<string, unknown>>(CASE_SERVICES_COLLECTION, id);
    caseId = (row as { caseId?: string } | null)?.caseId;
  } catch (err) {
    console.error('[cases] removeCaseService lookup failed:', err);
  }

  // Soft delete — set to inactive
  await updateDocument(CASE_SERVICES_COLLECTION, id, { active: false });

  // Story F-HIGH-28 — trigger bill recompute after service removal.
  if (caseId) {
    await recomputeBillForCase(caseId, 'service_removed', actor);
  }
}
