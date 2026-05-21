export function getAuthErrorMessage(error: unknown, fallback: string) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: string }).code)
      : "";

  if (code === "auth/unauthorized-domain") {
    const host = typeof window !== "undefined" ? window.location.hostname : "this domain";
    const isIpAddress = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    if (isIpAddress) {
      return `Firebase Auth does not accept IP addresses like ${host} as authorized domains. Open the app from http://localhost:3000 on this computer, or use a real/tunnel domain and add that domain in Firebase Console > Authentication > Settings > Authorized domains.`;
    }

    return `Firebase Auth is not enabled for ${host}. Add ${host} in Firebase Console > Authentication > Settings > Authorized domains, or open the app from http://localhost:3000.`;
  }

  if (code === "auth/network-request-failed") {
    return "Firebase: Error (auth/network-request-failed).";
  }

  return error instanceof Error ? error.message : fallback;
}
