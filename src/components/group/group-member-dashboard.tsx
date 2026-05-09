"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/use-t";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { GroupTokenMismatchHint } from "@/components/forms/group-token-mismatch-hint";
import { findGroupByToken, listMembers } from "@/lib/firebase/repositories";
import type { Group, Member } from "@/types/domain";

export function GroupMemberDashboard({ token }: { token: string }) {
  const router = useRouter();
  const { t, tx, language } = useT();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!isFirebaseConfigured) {
        setError(t("errors.firebaseNotConfigured"));
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
        setError(tx(err instanceof Error ? err.message : t("errors.loadGroupFailed")));
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [t, tx, token]);

  if (isLoading) {
    return (
      <div className="group-page-grid">
        <p className="py-16 text-center text-sm text-[color:var(--soft-foreground)]">{t("groupDash.loading")}</p>
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
          <p className="group-title">{t("groupMembers.title")}</p>
        </div>
      </div>

      <div className="group-card">
        <p className="group-kicker">{t("groupMembers.groupListTitle")}</p>
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
                  {t("groupDash.joined")}{" "}
                  {new Date(member.joinDate).toLocaleDateString(language === "bn" ? "bn-BD" : undefined)}
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
