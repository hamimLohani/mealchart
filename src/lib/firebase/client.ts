import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
} from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";
import { firebaseConfig, isFirebaseConfigured } from "./config";

const app = isFirebaseConfigured
  ? getApps().length
    ? getApps()[0]
    : initializeApp(firebaseConfig)
  : null;

export const auth = app ? getAuth(app) : null;

// Enable persistent IndexedDB cache so warm loads are served from disk,
// and multi-tab manager so all tabs share one Firestore WebSocket connection.
export const db = (() => {
  if (!app) return null;
  if (typeof window === "undefined") {
    // Server-side rendering: use default Firestore (no persistence)
    return getFirestore(app);
  }
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    // initializeFirestore throws if called twice (e.g. hot-reload); fall back
    return getFirestore(app);
  }
})();

export const analytics = typeof window !== "undefined" && app
  ? isSupported().then(yes => yes ? getAnalytics(app) : null)
  : Promise.resolve(null);
