import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  DocumentData,
  QueryConstraint,
} from 'firebase/firestore';
import { getFirebaseDb } from './client';
import { isMockEnabled, getCollection, initSeedData } from '@/lib/mock/store';

export async function getDocument<T>(
  collectionPath: string,
  id: string,
): Promise<T | null> {
  if (isMockEnabled()) {
    initSeedData();
    const col = getCollection(collectionPath);
    const data = col.get(id);
    if (!data) return null;
    return { id, ...data } as T;
  }

  const snap = await getDoc(doc(getFirebaseDb(), collectionPath, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as T;
}

export async function setDocument<T extends DocumentData>(
  collectionPath: string,
  id: string,
  data: T,
): Promise<void> {
  if (isMockEnabled()) {
    initSeedData();
    const col = getCollection(collectionPath);
    const now = new Date().toISOString();
    col.set(id, { ...data, createdAt: now, updatedAt: now });
    return;
  }

  await setDoc(doc(getFirebaseDb(), collectionPath, id), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

export async function updateDocument(
  collectionPath: string,
  id: string,
  data: DocumentData,
): Promise<void> {
  if (isMockEnabled()) {
    initSeedData();
    const col = getCollection(collectionPath);
    const existing = col.get(id);
    if (!existing) {
      throw new Error(`Document ${collectionPath}/${id} does not exist`);
    }
    const now = new Date().toISOString();
    col.set(id, { ...existing, ...data, updatedAt: now });
    return;
  }

  await updateDoc(doc(getFirebaseDb(), collectionPath, id), {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteDocument(
  collectionPath: string,
  id: string,
): Promise<void> {
  if (isMockEnabled()) {
    initSeedData();
    const col = getCollection(collectionPath);
    col.delete(id);
    return;
  }

  await deleteDoc(doc(getFirebaseDb(), collectionPath, id));
}

export async function getAllDocuments<T>(
  collectionPath: string,
  filters: { field: string; operator: '==' | '!=' | 'in'; value: unknown }[] = [],
): Promise<T[]> {
  if (isMockEnabled()) {
    initSeedData();
    const col = getCollection(collectionPath);
    let items = Array.from(col.entries()).map(([id, data]) => ({ id, ...data }));

    for (const f of filters) {
      items = items.filter((item) => {
        const fieldValue = (item as Record<string, unknown>)[f.field];
        if (f.operator === '==') return fieldValue === f.value;
        if (f.operator === '!=') return fieldValue !== f.value;
        if (f.operator === 'in') {
          return Array.isArray(f.value) && f.value.includes(fieldValue);
        }
        return true;
      });
    }

    return items as T[];
  }

  const constraints: QueryConstraint[] = [];
  filters.forEach((f) => {
    constraints.push(where(f.field, f.operator, f.value));
  });
  const q = constraints.length
    ? query(collection(getFirebaseDb(), collectionPath), ...constraints)
    : query(collection(getFirebaseDb(), collectionPath));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}