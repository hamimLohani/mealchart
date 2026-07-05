import { useRouter } from "next/navigation";
import type { Auth } from "firebase/auth";
import { signOut } from "firebase/auth";

export const ADMIN_LOGIN_REDIRECT = "/?noredirect=1";

export async function handleAdminLogout(
  auth: Auth | null,
  router: ReturnType<typeof useRouter>,
  setIsSignOutInProgress: (value: boolean) => void,
  onError?: (error: Error) => void
): Promise<void> {
  try {
    setIsSignOutInProgress(true);
    if (auth) {
      await signOut(auth);
    }
    router.push(ADMIN_LOGIN_REDIRECT);
  } catch (error) {
    setIsSignOutInProgress(false);
    const err = error instanceof Error ? error : new Error("Failed to sign out");
    if (onError) {
      onError(err);
    } else {
      console.error("[Admin Logout Error]", err.message);
    }
  }
}
