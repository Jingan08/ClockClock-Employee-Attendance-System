import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

// Check if we are running with placeholder configuration
export let isFirebaseConfigured =
  firebaseConfig &&
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'placeholder-api-key' &&
  !firebaseConfig.apiKey.includes('YOUR_');

export function forceOfflineMode() {
  isFirebaseConfigured = false;
  localStorage.setItem('eas_offline_mode', 'true');
}

export function enableFirebaseMode() {
  localStorage.removeItem('eas_offline_mode');
  window.location.reload(); // Reload to re-initialize
}

if (localStorage.getItem('eas_offline_mode') === 'true') {
  isFirebaseConfigured = false;
}

let app;
export let db: any = null;
export let auth: any = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);
  } catch (err) {
    console.error('Failed to initialize Firebase SDK', err);
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
    },
    operationType,
    path,
  };
  console.error('Firestore Hardened Gate Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
