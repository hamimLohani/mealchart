"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { findGroupByToken } from "@/lib/firebase/repositories";

export function EnterGroupForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isFirebaseConfigured) {
      setError("Firebase is not configured yet. Add your keys in .env.local first.");
      return;
    }

    const normalizedToken = token.trim().toUpperCase();
    if (!normalizedToken) {
      setError("Enter a valid group token.");
      return;
    }

    setIsSubmitting(true);

    try {
      const group = await findGroupByToken(normalizedToken);

      if (!group) {
        setError("No group was found for that token.");
        return;
      }

      router.push(`/group/${group.token}`);
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : "Failed to find that group.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
      <label className="grid gap-2 text-sm font-medium text-[color:var(--foreground)]">
        Group token
        <input
          className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 font-mono uppercase outline-none transition focus:border-[color:var(--accent)]"
          onChange={(event) => setToken(event.target.value.toUpperCase())}
          placeholder="STAR-HOST-7XK29Q"
          required
          value={token}
        />
      </label>

      {!isFirebaseConfigured ? (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Firebase keys are missing. Add them in <span className="font-mono">.env.local</span> before testing token entry.
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
        {isSubmitting ? "Checking token..." : "Enter group"}
      </button>
    </form>
  );
}
