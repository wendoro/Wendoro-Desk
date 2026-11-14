import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, GoogleAuthProvider, getAuth } from 'firebase/auth';
import { Firestore, doc, getDocFromServer, getFirestore } from 'firebase/firestore';

export interface FirebaseClientConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

const localConfigModules = import.meta.glob<{ default: FirebaseClientConfig }>(
  '/firebase-applet-config.json',
  { eager: true },
);

function resolveFirebaseConfig(): FirebaseClientConfig | null {
  const localModule = localConfigModules['/firebase-applet-config.json'];
  const fileConfig = localModule?.default;
  if (fileConfig && fileConfig.apiKey && fileConfig.projectId) {
    return fileConfig;
  }

  const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const envAppId = import.meta.env.VITE_FIREBASE_APP_ID;
  const envAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;

  if (envApiKey && envProjectId && envAppId && envAuthDomain) {
    return {
      apiKey: envApiKey,
      projectId: envProjectId,
      appId: envAppId,
      authDomain: envAuthDomain,
      firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || '(default)',
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    };
  }

  return null;
}

export const firebaseProjectConfig = resolveFirebaseConfig();
export const isFirebaseConfigured = Boolean(firebaseProjectConfig);

let app: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;

if (firebaseProjectConfig) {
  app = initializeApp(firebaseProjectConfig);
  dbInstance = firebaseProjectConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseProjectConfig.firestoreDatabaseId)
    : getFirestore(app);
  authInstance = getAuth(app);
}

export const db = dbInstance;
export const auth = authInstance;
export const googleProvider = new GoogleAuthProvider();

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
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export type FirestoreConnectionState = 'checking' | 'connected' | 'offline' | 'unconfigured';

export async function testFirestoreConnection(): Promise<FirestoreConnectionState> {
  if (!db) {
    return 'unconfigured';
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return 'connected';
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return 'offline';
    }
    return 'connected';
  }
}

if (isFirebaseConfigured) {
  void testFirestoreConnection();
}
