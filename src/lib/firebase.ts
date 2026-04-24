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
const isCustomDomain = typeof window !== 'undefined' && 
  !window.location.hostname.includes('run.app') && 
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1';

export const db = initializeFirestore(app, {
  databaseId: firestoreDbId,
  experimentalForceLongPolling: true, // Use long-polling for better compatibility on custom domains
  localCache: isCustomDomain 
    ? memoryLocalCache() 
    : persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

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

// Connection test
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Auurio Hub: Firestore Link ACTIVE");
  } catch (error) {
    console.warn("Auurio Hub: Firestore parity check failed. Check permissions.");
  }
}
