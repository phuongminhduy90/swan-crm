import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { firebaseConfig, isDevMode, hasFirebaseConfig } from '@/config/firebase';

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;
let initializationFailed = false;

function getApp(): FirebaseApp {
  if (app) return app;
  if (isDevMode || !hasFirebaseConfig) {
    app = getApps()[0] ?? initializeApp({ projectId: 'dev-swancase' });
  } else {
    app = getApps()[0] ?? initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (initializationFailed) {
    throw new Error('Firebase chưa được cấu hình. Vui lòng thiết lập biến môi trường.');
  }
  if (!auth) {
    try {
      auth = getAuth(getApp());
    } catch {
      initializationFailed = true;
      throw new Error('Firebase chưa được cấu hình.');
    }
  }
  return auth;
}

export function getFirebaseDb(): Firestore {
  if (!db) {
    db = getFirestore(getApp());
  }
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    storage = getStorage(getApp());
  }
  return storage;
}

export const firebaseReady = !isDevMode && hasFirebaseConfig;