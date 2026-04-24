import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Dynamic Database Connection
const dbId = typeof window !== 'undefined' 
  ? new URLSearchParams(window.location.search).get('db') || firebaseConfig.firestoreDatabaseId
  : firebaseConfig.firestoreDatabaseId;

export const db = getFirestore(app, dbId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithAuurio = async (emailHint?: string) => {
  if (emailHint) {
    googleProvider.setCustomParameters({ login_hint: emailHint });
  }
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("SSO Error:", error);
    throw error;
  }
};

// Connection test
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration or network connection.");
    }
  }
}
