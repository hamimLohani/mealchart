"use client";

import { FormEvent, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";

function getAuthErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";

  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
    return "Invalid email or password. Use the admin account that created the group in this Firebase project.";
  }
  if (code === "auth/too-many-requests") {
    return "Too many failed login attempts. Wait a bit, then try again.";
  }
  if (code === "auth/network-request-failed") {
    return "Network error while contacting Firebase Auth. Check your connection and try again.";
  }
  if (code === "auth/operation-not-allowed") {
    return "Email/password login is not enabled in Firebase Authentication.";
  }
  return error instanceof Error ? error.message : "Failed to log in.";
}

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isFirebaseConfigured || !auth) {
      setError("Firebase is not configured yet. Add your keys in .env.local first.");
      return;
    }

    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.push("/admin");
    } catch (loginError) {
      setError(getAuthErrorMessage(loginError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
      <label className="grid gap-1.5 text-sm font-medium text-[color:var(--foreground)]">
        Email
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
        Password
        <input
          className="input"
          minLength={6}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your admin password"
          required
          type="password"
          value={password}
        />
      </label>

      {!isFirebaseConfigured && (
        <p className="alert-warn">
          Firebase keys are missing. Add them in <span className="font-mono">.env.local</span> before logging in.
        </p>
      )}

      {error && <p className="alert-error">{error}</p>}

      <button
        className="button-primary w-full"
        disabled={isSubmitting || !isFirebaseConfigured}
        type="submit"
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
