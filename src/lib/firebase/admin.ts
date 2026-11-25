import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (serviceAccountJson) {
    try {
      const credentials = JSON.parse(serviceAccountJson);
      return initializeApp({
        credential: cert(credentials),
        ...(projectId ? { projectId } : {}),
      });
    } catch (error) {
      console.error("[FirebaseAdmin] Invalid FIREBASE_SERVICE_ACCOUNT_KEY JSON:", error);
    }
  }

  if (!projectId) {
    throw new Error("Firebase project ID is not configured on the server.");
  }

  return initializeApp({ projectId });
}

/**
 * Verifies a Firebase client ID token on the server for protected Server Actions.
 */
export async function verifyServerAuthToken(idToken?: string): Promise<DecodedIdToken> {
  const token = idToken?.trim();
  if (!token) {
    throw new Error("Authentication required.");
  }

  const app = getAdminApp();
  return getAuth(app).verifyIdToken(token);
}
