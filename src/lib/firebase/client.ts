import { getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";
import { firebaseConfig, isFirebaseConfigured } from "./config";

const app = isFirebaseConfigured
  ? getApps().length
    ? getApps()[0]
    : initializeApp(firebaseConfig)
  : null;

function createAuth() {
  if (!app) return null;

  // On the client, initialize auth with IndexedDB persistence first.
  // IndexedDB survives installed-PWA restarts far more reliably than the
  // default localStorage persistence (which iOS/Android can silently evict),
  // so users stay signed in on their own device until they sign out.
  if (typeof window !== "undefined") {
    try {
      return initializeAuth(app, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      });
    } catch {
      // initializeAuth throws if auth was already initialized for this app
      // (e.g. fast refresh / re-import) — fall back to the existing instance.
      return getAuth(app);
    }
  }

  return getAuth(app);
}

export const auth = createAuth();
export const db = app ? getFirestore(app) : null;

export const analytics = typeof window !== "undefined" && app 
  ? isSupported().then(yes => yes ? getAnalytics(app) : null)
  : Promise.resolve(null);
