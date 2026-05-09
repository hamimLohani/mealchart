"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { GroupTokenMismatchHint } from "@/components/forms/group-token-mismatch-hint";
import { findGroupByToken, listMembers } from "@/lib/firebase/repositories";
import type { Group, Member } from "@/types/domain";

export function GroupMemberDashboard({ token }: { token: string }) {
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!isFirebaseConfigured) { setError("Firebase is not configured yet."); setIsLoading(false); return; }
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

  if (isLoading) {
    return (
      <div className="group-page-grid">
        <p className="py-16 text-center text-sm text-[color:var(--soft-foreground)]">Loading group…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8">
        <div className="alert-error">{error}</div>
        <GroupTokenMismatchHint message={error} />
      </div>
    );
  }
  if (!group) return null;

  return (
    <div className="group-page-grid">
      <div className="group-hero">
        <div className="min-w-0">
          <p className="group-kicker">{group.name}</p>
          <p className="group-title">Members</p>
        </div>
      </div>

      <div className="group-card">
        <p className="group-kicker">Group Members</p>
        <div className="mt-3 grid gap-2">
          {members.map((member) => (
            <div
              key={member.id}
              onClick={() => router.push(`/group/${token}/member/${member.id}`)}
              className="member-row"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{member.fullName}</p>
                <p className="group-stat-label">
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
