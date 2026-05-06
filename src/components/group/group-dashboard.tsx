"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { findGroupByToken, listMembers } from "@/lib/firebase/repositories";
import type { Group, Member } from "@/types/domain";

export function GroupDashboard({ token }: { token: string }) {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!isFirebaseConfigured) {
        setError("Firebase is not configured yet. Add your keys in .env.local first.");
        setIsLoading(false);
        return;
      }

      try {
        const currentGroup = await findGroupByToken(token);

        if (!currentGroup) {
          throw new Error("No group was found for this token.");
        }

        const currentMembers = await listMembers(currentGroup.id);

        if (!active) {
          return;
        }

        setGroup(currentGroup);
        setMembers(currentMembers);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error ? loadError.message : "Failed to load group.",
        );
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [token]);

  if (isLoading) {
    return <p className="mt-6 text-sm text-[color:var(--soft-foreground)]">Loading group...</p>;
  }

  if (error) {
    return (
      <p className="mt-6 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </p>
    );
  }

  if (!group) {
    return null;
  }

  return (
    <div className="mt-8 grid gap-6">
      <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--background)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Today&apos;s meal
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{group.name}</h2>
          <p className="mt-3 text-sm text-[color:var(--soft-foreground)]">
            Members will use this page for daily meal entry. The editable meal inputs and realtime sync come next; this screen already resolves the token and loads the correct group.
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--background)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Group token
          </p>
          <p className="mt-3 font-mono text-xl">{group.token}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link className="button-secondary" href={`/group/${group.token}/chart`}>
              Chart
            </Link>
            <Link className="button-secondary" href={`/group/${group.token}/money`}>
              Money
            </Link>
            <Link className="button-secondary" href={`/group/${group.token}/history`}>
              History
            </Link>
            <Link className="button-secondary" href={`/group/${group.token}/notices`}>
              Notices
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--background)] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Active members
            </p>
            <h3 className="mt-2 text-xl font-semibold">
              {members.length} member{members.length === 1 ? "" : "s"}
            </h3>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.length ? (
            members.map((member) => (
              <article
                key={member.id}
                className="rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-4"
              >
                <p className="font-semibold text-[color:var(--foreground)]">
                  {member.fullName}
                </p>
                <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">
                  Joined {member.joinDate}
                </p>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  Today&apos;s meal input pending
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm text-[color:var(--soft-foreground)]">
              No members have been added to this group yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
