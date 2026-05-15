import { MessageKey } from "@/i18n/messages";

/**
 * Detects if an email error is related to Gmail authentication issues (534-5.7.9)
 * and returns a localized translation key or the original error.
 */
export function getFriendlyEmailError(error: string): MessageKey | string {
  const lowerError = error.toLowerCase();
  if (
    lowerError.includes("534-5.7.9") || 
    lowerError.includes("webloginrequired") || 
    lowerError.includes("invalid login") ||
    lowerError.includes("authentication failed")
  ) {
    return "errors.emailAuthFailed";
  }
  
  if (
    lowerError.includes("econnrefused") ||
    lowerError.includes("etimedout") ||
    lowerError.includes("dns") ||
    lowerError.includes("smtp") ||
    lowerError.includes("connection closed")
  ) {
    return "errors.emailFailed";
  }

  return error;
}
