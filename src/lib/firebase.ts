/// <reference types="vite/client" />
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

// Initial config from environment variables
const initialConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || '(default)'
};

// We will initialize these lazily or updated later if needed
let app: FirebaseApp;
let finalConfig = { ...initialConfig };

// Synchronous check: if no environment variables, we might be in AI Studio
// In AI Studio, we often rely on the provided config file
// To avoid top-level await, we'll try a different approach
// For now, we'll assume the environment variables are the priority for external hosting

// If VITE_FIREBASE_API_KEY is missing, we try a best-effort approach to use the platform config
// In a real external deploy, the user MUST provide these variables.

app = initializeApp(finalConfig);

export const db = getFirestore(app, finalConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

// Test connection and potentially warn about missing config
async function initFirebase() {
  if (!finalConfig.apiKey) {
    console.warn('VITE_FIREBASE_API_KEY is missing. If you are hosting externally, please set your environment variables.');
  }

  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

initFirebase();
