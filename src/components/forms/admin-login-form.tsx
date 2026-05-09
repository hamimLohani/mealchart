"use client";

import { FormEvent, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import { useT } from "@/i18n/use-t";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import type { MessageKey } from "@/i18n/messages";

function authCodeToKey(code: string): MessageKey {
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
    return "adminLogin.errInvalidCreds";
  }
  if (code === "auth/too-many-requests") return "adminLogin.errTooMany";
  if (code === "auth/network-request-failed") return "adminLogin.errNetwork";
  if (code === "auth/operation-not-allowed") return "adminLogin.errNotAllowed";
  return "adminLogin.errFailed";
}

export function AdminLoginForm() {
  const router = useRouter();
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isFirebaseConfigured || !auth) {
      setError(t("errors.firebaseNotConfiguredLocal"));
      return;
    }

    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.push("/admin");
    } catch (loginError) {
      const code =
        typeof loginError === "object" && loginError !== null && "code" in loginError
          ? String((loginError as { code?: string }).code)
          : "";
      if (code) setError(t(authCodeToKey(code)));
      else setError(loginError instanceof Error ? loginError.message : t("adminLogin.errFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
      <label className="grid gap-1.5 text-sm font-medium text-[color:var(--foreground)]">
        {t("registerForm.email")}
        <input
          className="input"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@example.com"
          required
          type="email"
          value={email}
        />
      </label>

      <label className="grid gap-1.5 text-sm font-medium text-[color:var(--foreground)]">
        {t("registerForm.password")}
        <input
          className="input"
          minLength={6}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("adminLoginForm.placeholderPassword")}
          required
          type="password"
          value={password}
        />
      </label>

      {!isFirebaseConfigured && (
        <p className="alert-warn">
          {t("adminLoginForm.warnEnv")}
        </p>
      )}

      {error && <p className="alert-error">{error}</p>}

      <button
        className="button-primary w-full"
        disabled={isSubmitting || !isFirebaseConfigured}
        type="submit"
      >
        {isSubmitting ? t("adminLoginForm.signingIn") : t("adminLoginForm.signIn")}
      </button>
    </form>
  );
}
