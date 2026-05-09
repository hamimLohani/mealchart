"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { findGroupByToken, listMembers } from "@/lib/firebase/repositories";

export function EnterGroupForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    sessionStorage.removeItem("mc_member_id");
    sessionStorage.removeItem("mc_member_name");
  }, []);

  async function handleTokenSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!isFirebaseConfigured) {
      setError("Firebase is not configured yet.");
      return;
    }

    const normalized = token.trim().toUpperCase();
    if (!normalized) { setError("Enter a valid group token."); return; }

    setIsSubmitting(true);
    try {
      const group = await findGroupByToken(normalized);
      if (!group) { setError("No group found for that token."); return; }

      const memberList = await listMembers(group.id);
      if (memberList.length === 0) {
        setError("This group has no members yet. Ask your admin to add members first.");
        return;
      }

      router.push(`/group/${group.token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to find that group.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-6 grid gap-4" onSubmit={handleTokenSubmit}>
      <label className="grid gap-1.5 text-sm font-medium text-[color:var(--foreground)]">
        Group token
        <input
          className="input font-mono uppercase tracking-wider"
          onChange={(e) => setToken(e.target.value.toUpperCase())}
          placeholder="STAR-HOST-7XK29Q"
          required
          value={token}
        />
      </label>

      {!isFirebaseConfigured && (
        <p className="alert-warn">
          Firebase keys are missing. Add them in <span className="font-mono">.env.local</span> first.
        </p>
      )}

      {error && <p className="alert-error">{error}</p>}

      <button
        className="button-primary w-full"
        disabled={isSubmitting || !isFirebaseConfigured}
        type="submit"
      >
        {isSubmitting ? "Looking up…" : "Continue"}
      </button>
    </form>
  );
}
