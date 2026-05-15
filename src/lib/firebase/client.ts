import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";
import { firebaseConfig, isFirebaseConfigured } from "./config";

const app = isFirebaseConfigured
  ? getApps().length
    ? getApps()[0]
    : initializeApp(firebaseConfig)
  : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

export const analytics = typeof window !== "undefined" && app 
  ? isSupported().then(yes => yes ? getAnalytics(app) : null)
  : Promise.resolve(null);
