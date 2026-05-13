import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  // This tells the code to look for a hidden file on your computer for the key
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "gen-lang-client-0527665513.firebaseapp.com",
  projectId: "gen-lang-client-0527665513",
  storageBucket: "gen-lang-client-0527665513.firebasestorage.app",
  messagingSenderId: "221885926112",
  appId: "1:221885926112:web:868f103682fb0f01641e85",
  measurementId: "G-KEKB8TQX32"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);