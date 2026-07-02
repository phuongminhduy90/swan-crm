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
  runTransaction as firestoreRunTransaction,
  DocumentData,
  DocumentReference,
  QueryConstraint,
  Transaction as FirestoreTransaction,
} from 'firebase/firestore';
import { getFirebaseDb } from './client';
import {
  isMockEnabled,
  getCollection,
  initSeedData,
  runMockTransaction,
  type MockTransaction,
} from '@/lib/mock/store';

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

// ─── Story F-CRIT-08 (Sprint 7.2) — Transactional writes ──────────────
// The Firestore shim layer has historically been limited to single-document
// reads/writes. F-CRIT-08 introduces a `runTransaction` shim that wraps
// multi-document writes (payment status update + case amount recompute
// + audit log entry) in a single atomic batch. In real Firestore mode, we
// delegate to `firebase`'s `runTransaction`, which provides full ACID
// semantics including automatic retry on conflict. In mock mode, we use
// the in-memory `runMockTransaction` simulator (`@/lib/mock/store.ts`),
// which provides all-or-nothing semantics for testing purposes (no real
// conflict detection, no automatic retry).
//
// Production callers go through this shim rather than calling the SDK
// directly so the dev-mode mock store and the real Firestore share the
// same call site.

/**
 * Minimal transaction-shape callback that callers can satisfy in both
 * real and mock modes. In real mode this is `FirestoreTransaction`; in
 * mock mode this is `MockTransaction` from `@/lib/mock/store`. Both expose
 * a uniform `get/update/set/delete` surface; the wrappers below adapt the
 * type-specific paths to that surface.
 */
export interface TransactionHandle {
  /** Read a document by id within the transaction. */
  get<T = Record<string, unknown>>(
    collectionPath: string,
    docId: string,
  ): Promise<{ id: string; data: T | null; exists: boolean }>;
  /** Partial-update a document by id within the transaction. */
  update(collectionPath: string, docId: string, data: DocumentData): void;
  /** Overwrite a document by id within the transaction. */
  set(collectionPath: string, docId: string, data: DocumentData): void;
  /** Delete a document by id within the transaction. */
  delete(collectionPath: string, docId: string): void;
}

/**
 * Run `callback` against a transaction handle. On real Firestore, the
 * handle is the SDK's `FirestoreTransaction` (auto-retried on conflict).
 * On the mock store, the handle is `MockTransaction` (all-or-nothing via
 * a write buffer that is applied on COMMIT and discarded on ROLLBACK).
 *
 * Throwing from inside the callback aborts the transaction in both modes:
 * real Firestore rolls back via the SDK; the mock discards its write
 * buffer. The throw propagates to the caller.
 */
export async function runTransaction<T>(
  callback: (tx: TransactionHandle) => Promise<T>,
): Promise<T> {
  if (isMockEnabled()) {
    initSeedData();
    return runMockTransaction(async (mockTx: MockTransaction) => {
      const handle: TransactionHandle = {
        get: (collectionPath, docId) => mockTx.get(collectionPath, docId),
        update: (collectionPath, docId, data) => mockTx.update(collectionPath, docId, data as Record<string, unknown>),
        set: (collectionPath, docId, data) => mockTx.set(collectionPath, docId, data as Record<string, unknown>),
        delete: (collectionPath, docId) => mockTx.delete(collectionPath, docId),
      };
      return callback(handle);
    });
  }

  const db = getFirebaseDb();
  return firestoreRunTransaction(db, async (tx: FirestoreTransaction) => {
    const handle: TransactionHandle = {
      async get<T = Record<string, unknown>>(collectionPath: string, docId: string) {
        const ref: DocumentReference = doc(db, collectionPath, docId);
        const snap = await tx.get(ref);
        if (!snap.exists()) return { id: docId, data: null, exists: false };
        return { id: snap.id, data: snap.data() as T, exists: true };
      },
      update(collectionPath: string, docId: string, data: DocumentData) {
        const ref: DocumentReference = doc(db, collectionPath, docId);
        tx.update(ref, { ...data, updatedAt: Timestamp.now() });
      },
      set(collectionPath: string, docId: string, data: DocumentData) {
        const ref: DocumentReference = doc(db, collectionPath, docId);
        tx.set(ref, { ...data, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
      },
      delete(collectionPath: string, docId: string) {
        const ref: DocumentReference = doc(db, collectionPath, docId);
        tx.delete(ref);
      },
    };
    return callback(handle);
  });
}