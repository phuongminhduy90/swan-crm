import { format } from 'date-fns';
import { Customer, CreateCustomerInput, UpdateCustomerInput } from '@/lib/types';
import {
  getDocument,
  setDocument,
  updateDocument,
  deleteDocument,
  getAllDocuments,
} from '@/lib/firebase/firestore';
import { isMockEnabled, getCollection, initSeedData } from '@/lib/mock/store';

const COLLECTION = 'customers';

function generateCustomerCode(): string {
  const date = format(new Date(), 'yyMMdd');
  // In mock mode, count existing customers; real mode would use a counter
  if (isMockEnabled()) {
    initSeedData();
    const col = getCollection(COLLECTION);
    const count = col.size + 1;
    return `CUS-${date}-${String(count).padStart(3, '0')}`;
  }
  // Trong production: dùng timestamp base-36 để giảm rủi ro collision
  const tsBase36 = Date.now().toString(36).toUpperCase().slice(-5);
  return `CUS-${date}-${tsBase36}`;
}

/**
 * Check if a phone number already exists for a non-deleted customer.
 * Excludes the customer with the given excludeId (for updates).
 */
async function checkPhoneExists(
  phone: string,
  excludeId?: string,
): Promise<boolean> {
  const all = await getAllCustomersIncludingPending();
  return all.some(
    (c) => c.phone === phone && c.id !== excludeId,
  );
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const data = await getDocument<Record<string, unknown>>(COLLECTION, id);
  if (!data) return null;
  return data as unknown as Customer;
}

export async function getAllCustomers(): Promise<Customer[]> {
  const data = await getAllDocuments<Record<string, unknown>>(COLLECTION);
  return (data as unknown as Customer[])
    .filter((c) => !c.deletionRequested) // soft-deleted customers not shown
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getAllCustomersIncludingPending(): Promise<Customer[]> {
  const data = await getAllDocuments<Record<string, unknown>>(COLLECTION);
  return (data as unknown as Customer[]).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  const all = await getAllCustomers();
  const q = query.toLowerCase();
  return all.filter(
    (c) =>
      c.fullName.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.customerCode?.toLowerCase().includes(q),
  );
}

export async function createCustomer(
  input: CreateCustomerInput,
  createdBy: string,
): Promise<Customer> {
  // Check phone uniqueness
  const exists = await checkPhoneExists(input.phone);
  if (exists) {
    throw new Error(`Số điện thoại ${input.phone} đã tồn tại trong hệ thống`);
  }

  const id = `cus-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const customerCode = generateCustomerCode();
  const now = new Date().toISOString();

  const customer: Customer = {
    id,
    customerCode,
    fullName: input.fullName,
    phone: input.phone,
    secondaryPhone: input.secondaryPhone,
    dateOfBirth: input.dateOfBirth,
    gender: input.gender,
    nationalIdNumber: input.nationalIdNumber,
    nationalIdIssueDate: input.nationalIdIssueDate,
    nationalIdIssuePlace: input.nationalIdIssuePlace,
    address: input.address,
    zalo: input.zalo,
    facebook: input.facebook,
    emergencyContactName: input.emergencyContactName,
    emergencyContactPhone: input.emergencyContactPhone,
    source: input.source,
    sourceDetail: input.sourceDetail,
    privacyLevel: input.privacyLevel ?? 'normal',
    privacyNote: input.privacyNote,
    medicalNote: input.medicalNote,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };

  await setDocument(COLLECTION, id, customer);
  return customer;
}

export async function updateCustomer(
  id: string,
  input: UpdateCustomerInput,
  updatedBy: string,
): Promise<void> {
  // Check phone uniqueness if phone is being changed
  if (input.phone) {
    const exists = await checkPhoneExists(input.phone, id);
    if (exists) {
      throw new Error(`Số điện thoại ${input.phone} đã tồn tại trong hệ thống`);
    }
  }
  await updateDocument(COLLECTION, id, { ...input, updatedBy, updatedAt: new Date().toISOString() });
}

/**
 * Sales users request deletion of a customer.
 * This sets deletionRequested = true and records who/why.
 * Only CS, CEO, or master_sales can approve and delete.
 */
export async function requestCustomerDeletion(
  customerId: string,
  reason: string,
  requestedBy: string,
): Promise<void> {
  await updateDocument(COLLECTION, customerId, {
    deletionRequested: true,
    deletionRequestedAt: new Date().toISOString(),
    deletionRequestedBy: requestedBy,
    deletionReason: reason,
  });
}

/**
 * Approve and execute a customer deletion.
 * Sets deletionApprovedBy/At, then soft-deletes (hides from queries).
 */
export async function approveCustomerDeletion(
  customerId: string,
  approvedBy: string,
): Promise<void> {
  await updateDocument(COLLECTION, customerId, {
    deletionApprovedBy: approvedBy,
    deletionApprovedAt: new Date().toISOString(),
  });
}

/**
 * Reject a pending deletion request, resetting the flags.
 */
export async function rejectCustomerDeletion(
  customerId: string,
): Promise<void> {
  await updateDocument(COLLECTION, customerId, {
    deletionRequested: false,
    deletionRequestedAt: null,
    deletionRequestedBy: null,
    deletionReason: null,
  });
}

export async function deleteCustomer(id: string): Promise<void> {
  // Cascade: soft-delete all associated cases, payments, and followups before removing the customer
  try {
    const { getCasesByCustomer, updateCase } = await import('./cases');
    const cases = await getCasesByCustomer(id);

    // Soft-delete cases (sets active = false so they're hidden from queries)
    for (const c of cases) {
      try {
        await updateCase(c.id, { active: false } as never, 'system-cascade');
      } catch (err) {
        console.error(`[deleteCustomer] Failed to soft-delete case ${c.id}:`, err);
      }
    }

    // Soft-delete related payments and followups via direct document updates
    // (using updateDocument avoids circular dependency between firestore modules)
    const { getAllPayments } = await import('./payments');
    const allPayments = await getAllPayments();
    const customerPayments = allPayments.filter((p) => p.customerId === id);
    for (const p of customerPayments) {
      try {
        await updateDocument('payments', p.id, { active: false, updatedBy: 'system-cascade' });
      } catch (err) {
        console.error(`[deleteCustomer] Failed to soft-delete payment ${p.id}:`, err);
      }
    }

    const { getAllFollowups } = await import('./followups');
    const allFollowups = await getAllFollowups();
    const customerFollowups = allFollowups.filter((f) => f.customerId === id);
    for (const f of customerFollowups) {
      try {
        await updateDocument('followups', f.id, { active: false, updatedBy: 'system-cascade' });
      } catch (err) {
        console.error(`[deleteCustomer] Failed to soft-delete followup ${f.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[deleteCustomer] Cascade error (continuing with customer delete):', err);
  }

  await deleteDocument(COLLECTION, id);
}
