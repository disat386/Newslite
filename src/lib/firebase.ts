import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  initializeFirestore, 
  memoryLocalCache, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Diagnostic: Log environment context (strip sensitive info)
if (typeof window !== 'undefined') {
  console.log("Auurio Hub: initializing with project", (firebaseConfig as any).projectId);
  console.log("Auurio Hub: Current Hostname:", window.location.hostname);
}

// Initialize Firebase defensively
let app;
try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
} catch (e) {
  console.error("Firebase Init Failed:", e);
  app = initializeApp(firebaseConfig);
}

// Explicitly initialize Firestore with databaseId if provided
const firestoreDbId = (firebaseConfig as any).firestoreDatabaseId || "(default)";
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true, // Re-enabled for Cloud Run/Proxy compatibility
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
}, firestoreDbId);

if (typeof window !== 'undefined') {
  console.log("Auurio Hub: Firestore Target Database:", firestoreDbId);
  if (firestoreDbId !== "(default)") {
    console.warn("AUR-SYNC: Utilizing Non-Default Database Unit. Ensure Firestore Rules are deployed to this specific Instance ID.");
  }
}

export const auth = getAuth(app);

// Set persistence to local for better cross-session stability
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(err => {
    console.warn("Auth persistence failed:", err);
  });
}

export const googleProvider = new GoogleAuthProvider();

export const signInWithAuurio = async (emailHint?: string) => {
  if (emailHint) {
    googleProvider.setCustomParameters({ login_hint: emailHint });
  }
  
  // SSO Check: Ensure we have a valid auth context
  if (!auth.app.options.apiKey) {
    throw new Error("AUR-AUTH: Identity Provider disconnected. API Key required for Hub synchronization.");
  }

  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    console.error("SSO Error Detailed:", error);
    if (error.code === 'auth/api-key-not-valid') {
      console.error("AUR-FATAL: The provided API key is rejected for this domain. Please verify Google Cloud Referrer restrictions.");
    }
    throw error;
  }
};

// Enum for Firestore operations as per integration instructions
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
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? (error as any).code || error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error Payload:', JSON.stringify(errInfo));
  // Not throwing here to allow local error handling in components, but providing the formatted payload
  return errInfo;
}

// Connection test
export async function testConnection() {
  if (typeof window !== 'undefined' && !window.navigator.onLine) return;
  const path = 'test/connection';
  try {
    await getDocFromServer(doc(db, path));
    console.log("Auurio Hub: Firestore Link ACTIVE");
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      handleFirestoreError(error, OperationType.GET, path);
    }
    // Sliently fail for background parity check
    if (error.code !== 'unavailable' && !error.message?.includes('offline')) {
      console.warn("Auurio Hub: Firestore parity check failed (Permissions).");
    }
  }
}
