import { Timestamp } from 'firebase/firestore';
import { User, UserRole } from '@/lib/types';
import { getDocument, setDocument, updateDocument, getAllDocuments } from '@/lib/firebase/firestore';

const USERS_COLLECTION = 'users';

function toIso(ts: Timestamp | string | undefined): string {
  if (!ts) return new Date().toISOString();
  if (typeof ts === 'string') return ts;
  return ts.toDate().toISOString();
}

export async function getUser(uid: string): Promise<User | null> {
  const data = await getDocument<Record<string, unknown>>(USERS_COLLECTION, uid);
  if (!data) {
    console.warn(`[getUser] User not found: ${uid}`);
    return null;
  }
  return {
    id: uid,
    email: data.email as string,
    displayName: (data.displayName as string) ?? '',
    role: data.role as UserRole,
    phone: data.phone as string | undefined,
    avatar: data.avatar as string | undefined,
    isActive: (data.isActive as boolean) ?? true,
    createdAt: toIso(data.createdAt as Timestamp),
    updatedAt: toIso(data.updatedAt as Timestamp),
  };
}

export async function createUser(user: User): Promise<void> {
  await setDocument(USERS_COLLECTION, user.id, {
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    phone: user.phone ?? null,
    avatar: user.avatar ?? null,
    isActive: user.isActive,
  });
}

export async function updateUser(
  uid: string,
  data: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<void> {
  await updateDocument(USERS_COLLECTION, uid, data);
}

export async function getAllUsers(): Promise<User[]> {
  const data = await getAllDocuments<Record<string, unknown>>(USERS_COLLECTION);
  return data.map((d) => ({
    id: d.id as string,
    email: d.email as string,
    displayName: (d.displayName as string) ?? '',
    role: d.role as UserRole,
    phone: d.phone as string | undefined,
    avatar: d.avatar as string | undefined,
    isActive: (d.isActive as boolean) ?? true,
    createdAt: toIso(d.createdAt as Timestamp),
    updatedAt: toIso(d.updatedAt as Timestamp),
  }));
}