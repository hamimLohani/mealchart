"use client";

import { FormEvent, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";

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
      router.push("/admin/members");
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Failed to log in.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
      <label className="grid gap-2 text-sm font-medium text-[color:var(--foreground)]">
        Email
        <input
          className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="admin@example.com"
          required
          type="email"
          value={email}
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-[color:var(--foreground)]">
        Password
        <input
          className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
          minLength={6}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Your admin password"
          required
          type="password"
          value={password}
        />
      </label>

      {!isFirebaseConfigured ? (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Firebase keys are missing. Add them in <span className="font-mono">.env.local</span> before logging in.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        className="button-primary w-full sm:w-fit disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting || !isFirebaseConfigured}
        type="submit"
      >
        {isSubmitting ? "Logging in..." : "Login"}
      </button>
    </form>
  );
}
