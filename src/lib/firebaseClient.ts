import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app); // Ensure we don't pass undefined databaseId explicitly, let SDK handle default

// Offline persistence disabled to prevent false 'saved' states if cloud writes fail
// Users will now see an immediate network or permission error if a write fails.

export const auth = getAuth(app);
