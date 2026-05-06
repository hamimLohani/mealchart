"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { findGroupByToken, listMembers } from "@/lib/firebase/repositories";
import type { Group, Member } from "@/types/domain";

export function GroupMembersList({ 
  token, 
  memberSearch = "" 
}: { 
  token: string; 
  memberSearch?: string; 
}) {
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!isFirebaseConfigured) {
        setError("Firebase is not configured yet.");
        setIsLoading(false);
        return;
      }
      
      try {
        const currentGroup = await findGroupByToken(token);
        if (!currentGroup) throw new Error("No group found for this token.");

        const currentMembers = await listMembers(currentGroup.id);

        if (!active) return;

        setGroup(currentGroup);
        setMembers(currentMembers);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load group.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [token]);

  const handleMemberClick = (memberId: string) => {
    router.push(`/group/${token}/member/${memberId}`);
  };

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-[color:var(--soft-foreground)]">Loading members…</p>;
  }

  if (error) {
    return (
      <div className="mt-8 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!group) return null;

  return (
    <div className="py-6 grid gap-4">
      {/* Group header */}
      <div className="flex items-center justify-between gap-3 rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            {group.name}
          </p>
          <p className="mt-0.5 truncate text-base font-semibold text-[color:var(--foreground)]">
            Members List
          </p>
        </div>
      </div>

      {/* Members list */}
      <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          All Group Members
        </p>
        <div className="mt-3 grid gap-2">
          {members
            .filter((m) => {
              const q = memberSearch.trim().toLowerCase();
              if (!q) return true;
              return m.fullName.toLowerCase().includes(q);
            })
            .map((member) => (
              <div
                key={member.id}
                onClick={() => handleMemberClick(member.id)}
                className="flex items-center justify-between rounded-[1rem] border px-3 py-2.5 cursor-pointer border-[color:var(--border)] bg-[color:var(--background)] hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] hover:border-[color:var(--accent)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">
                    {member.fullName}
                  </p>
                  <p className="text-xs text-[color:var(--muted)]">
                    Joined {new Date(member.joinDate).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-[color:var(--accent)]">→</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}