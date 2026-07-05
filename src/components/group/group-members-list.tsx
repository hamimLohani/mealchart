"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/use-t";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useDebounce } from "@/lib/hooks/use-debounce";

import { GroupMonthSelector } from "@/components/group/group-month-selector";
import { getGroupById, listMembers } from "@/lib/firebase/repositories";
import { useGroupSession } from "@/lib/hooks/use-group-session";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";
import type { Group, Member } from "@/types/domain";

export function GroupMembersList({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { t, tx, language } = useT();
  const { chart } = useGroupSession();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const debouncedSearch = useDebounce(memberSearch, 300);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useGlobalLoading(`group-members-list-${groupId}`, isLoading, t("groupMembers.loading"));

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isFirebaseConfigured) {
        setError(t("errors.firebaseNotConfigured"));
        setIsLoading(false);
        return;
      }
      try {
        const currentGroup = await getGroupById(groupId);
        if (!currentGroup) throw new Error("No group found for this groupId.");
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
  }, [t, tx, groupId]);

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-[color:var(--soft-foreground)]">{t("groupMembers.loading")}</p>;
  }
  if (error) {
    return (
      <div className="mt-8">
        <div className="alert-error">{error}</div>
      </div>
    );
  }
  if (!group) return null;

  const filtered = members.filter((m) => {
    const q = debouncedSearch.trim().toLowerCase();
    return !q || 
      m.fullName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q);
  });

  const n = String(members.length);
  const subtitle =
    language === "bn"
      ? t("groupMembers.subtitleBn", { n })
      : members.length === 1
        ? t("groupMembers.subtitleOne", { n })
        : t("groupMembers.subtitleMany", { n });

  return (
    <div className="py-6 grid gap-4">
      <GroupMonthSelector groupId={group.id} groupName={group.name} />

      <div className="group-hero">
        <div className="min-w-0">
          <p className="group-kicker">
            {group.name}
            {chart ? ` · ${chart.label}` : ""}
          </p>
          <p className="group-title">{t("groupMembers.title")}</p>
          <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">{subtitle}</p>
        </div>
      </div>

      <div className="group-card">
        <p className="group-kicker">{t("groupMembers.allMembers")}</p>
        <input
          className="group-search-input mt-3"
          placeholder={t("groupDash.searchMembers")}
          value={memberSearch}
          onChange={(event) => setMemberSearch(event.target.value)}
          type="search"
        />
        <div className="mt-3 grid gap-2">
          {filtered.map((member) => (
            <button
              key={member.id}
              onClick={() => router.push(`/group/${groupId}/member/${member.id}`)}
              className="member-row"
              type="button"
              aria-label={`View ${member.fullName}'s details`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{member.fullName}</p>
                <p className="text-xs text-[color:var(--muted)]">
                  {t("groupDash.joined")} {new Date(member.joinDate).toLocaleDateString(language === "bn" ? "bn-BD" : undefined)}
                </p>
              </div>
              <span className="text-[color:var(--accent)]">→</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="py-4 text-center text-sm text-[color:var(--soft-foreground)]">{t("groupMembers.searchNoMatch")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
