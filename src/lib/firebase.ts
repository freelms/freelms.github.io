import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const hasFirebaseConfig = Boolean(config.apiKey && config.projectId);

let app: any = undefined;
let auth: any = undefined;
let db: any = undefined;
let storage: any = undefined;

if (hasFirebaseConfig) {
  app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  if (location.hostname === 'localhost') {
    // Uncomment to use emulators locally:
    // import('firebase/auth').then(m => m.connectAuthEmulator(auth, 'http://localhost:9099'));
    // import('firebase/firestore').then(m => m.connectFirestoreEmulator(db, 'localhost', 8080));
  }
}

export { app, auth, db, storage };
