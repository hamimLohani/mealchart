"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/i18n/use-t";
import { isFirebaseConfigured } from "@/lib/firebase/config";

import { Skeleton } from "@/components/ui/skeleton";
import { useGroup, useMembers } from "@/lib/hooks/use-data";

export function GroupMemberDashboard({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { t, language } = useT();

  const { data: group, error: groupError, isLoading: groupLoading } = useGroup(isFirebaseConfigured ? groupId : undefined);
  const { data: members = [], isLoading: membersLoading } = useMembers(group?.id);

  const isLoading = groupLoading || membersLoading;

  if (isLoading) {
    return (
      <div className="group-page-grid py-16">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (groupError) {
    const msg = groupError instanceof Error ? groupError.message : t("errors.loadGroupFailed");
    return (
      <div className="mt-8">
        <div className="alert-error">{msg}</div>
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
              onClick={() => router.push(`/group/${groupId}/member/${member.id}`)}
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
