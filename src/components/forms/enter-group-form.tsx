"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { findGroupByToken, listMembers } from "@/lib/firebase/repositories";
import type { Member } from "@/types/domain";

type Step = "token" | "member";

export function EnterGroupForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("token");
  const [token, setToken] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [groupId, setGroupId] = useState(""); // kept for potential future use
  const [groupToken, setGroupToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clear stale session on mount
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

      setGroupId(group.id);
      setGroupToken(group.token);
      setMembers(memberList);
      setStep("member");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to find that group.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleMemberSelect(member: Member) {
    sessionStorage.setItem("mc_member_id", member.id);
    sessionStorage.setItem("mc_member_name", member.fullName);
    router.push(`/group/${groupToken}`);
  }

  if (step === "member") {
    return (
      <div className="mt-6 grid gap-3">
        <p className="text-sm font-medium text-[color:var(--foreground)]">
          Who are you? Pick your name:
        </p>
        {members.map((member) => (
          <button
            key={member.id}
            type="button"
            onClick={() => handleMemberSelect(member)}
            className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 text-left transition hover:border-[color:var(--accent)] active:scale-[0.98]"
          >
            <div>
              <p className="font-semibold text-[color:var(--foreground)]">{member.fullName}</p>
              <p className="text-xs text-[color:var(--muted)]">Joined {member.joinDate}</p>
            </div>
            <span className="text-[color:var(--accent)]">→</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => { setStep("token"); setError(null); }}
          className="mt-1 text-sm text-[color:var(--soft-foreground)] underline underline-offset-2"
        >
          ← Use a different token
        </button>
      </div>
    );
  }

  return (
    <form className="mt-6 grid gap-4" onSubmit={handleTokenSubmit}>
      <label className="grid gap-2 text-sm font-medium text-[color:var(--foreground)]">
        Group token
        <input
          className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 font-mono uppercase outline-none transition focus:border-[color:var(--accent)]"
          onChange={(e) => setToken(e.target.value.toUpperCase())}
          placeholder="STAR-HOST-7XK29Q"
          required
          value={token}
        />
      </label>

      {!isFirebaseConfigured && (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Firebase keys are missing. Add them in <span className="font-mono">.env.local</span> first.
        </p>
      )}

      {error && (
        <p className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting || !isFirebaseConfigured}
        type="submit"
      >
        {isSubmitting ? "Looking up…" : "Continue"}
      </button>
    </form>
  );
}
