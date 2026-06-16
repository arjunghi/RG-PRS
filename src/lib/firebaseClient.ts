import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId); // Required for Cloud Run setup

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  console.warn("Firebase persistence error:", err.code);
});

export const auth = getAuth(app);
