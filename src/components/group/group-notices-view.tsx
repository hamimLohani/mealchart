"use client";

import { useRouter } from "next/navigation";
import { Timestamp } from "firebase/firestore";
import { useT } from "@/i18n/use-t";
import { isFirebaseConfigured } from "@/lib/firebase/config";

import { useGroupSession } from "@/lib/hooks/use-group-session";
import { Skeleton } from "@/components/ui/skeleton";
import { useGroup, useNotices } from "@/lib/hooks/use-data";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";

function formatNoticeCreatedAt(raw: unknown, locale: string): string {
  if (raw instanceof Timestamp) {
    return raw.toDate().toLocaleString(locale === "bn" ? "bn-BD" : undefined, { dateStyle: "medium", timeStyle: "short" });
  }
  if (typeof raw === "string" && raw.length > 0) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString(locale === "bn" ? "bn-BD" : undefined, { dateStyle: "medium", timeStyle: "short" });
    }
  }
  return "";
}

export function GroupNoticesView({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { t, language } = useT();
  const locale = language === "bn" ? "bn" : "en";
  const { chart } = useGroupSession();

  const { data: group, error: groupError, isLoading: groupLoading } = useGroup(isFirebaseConfigured ? groupId : undefined);
  const { data: notices = [], isLoading: noticesLoading } = useNotices(group?.id, chart?.id);
  useGlobalLoading(
    `group-notices-view-${groupId}`,
    groupLoading || noticesLoading,
    t("common.loading"),
  );

  if (groupLoading) {
    return (
      <div className="group-page-grid py-16">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (groupError) {
    const msg = groupError instanceof Error ? groupError.message : t("errors.loadNoticesFailed");
    return (
      <div className="mt-8">
        <div className="alert-error">{msg}</div>
      </div>
    );
  }
  if (!group) return null;

  if (!chart) {
    return (
      <div className="group-page-grid">
        <div className="group-hero">
          <div className="min-w-0">
            <p className="group-kicker">{group.name}</p>
            <p className="group-title">{t("groupNotices.pageTitle")}</p>
            <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">{t("groupChart.noMonthBody")}</p>
          </div>
          <button type="button" onClick={() => router.push(`/group/${groupId}`)} className="button-secondary shrink-0">
            ← {t("groupNav.home")}
          </button>
        </div>
      </div>
    );
  }

  if (noticesLoading) {
    return (
      <div className="group-page-grid py-8">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const subtitle =
    notices.length === 0
      ? t("groupNotices.noneTitle")
      : language === "bn"
        ? `${notices.length}${t("groupNotices.suffixBn")}`
        : `${notices.length} ${notices.length === 1 ? t("groupNotices.wordOne") : t("groupNotices.wordMany")}`;

  return (
    <div className="group-page-grid">
      <div className="group-hero">
        <div className="min-w-0">
          <p className="group-kicker">{group.name}</p>
          <p className="group-title">{t("groupNotices.pageTitle")}</p>
          <p className="mt-1 text-sm font-medium text-[color:var(--accent)]">{chart.label}</p>
          <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">{subtitle}</p>
        </div>
      </div>

      {notices.length === 0 ? (
        <div className="group-card py-14 text-center">
          <p className="text-sm font-medium text-[color:var(--foreground)]">{t("groupNotices.caughtUp")}</p>
          <p className="mt-2 text-sm text-[color:var(--soft-foreground)]">{t("groupNotices.noneBody")}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {notices.map((n) => {
            const when = formatNoticeCreatedAt((n as { createdAt?: unknown }).createdAt, locale);
            const isSystem = n.systemGenerated === true;
            return (
              <article
                key={n.id}
                className={`overflow-hidden rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] shadow-[var(--shadow-sm)] ${
                  isSystem ? "border-l-[3px] border-l-[color:var(--accent)]" : ""
                }`}
              >
                <div className="px-4 py-4 sm:px-5 sm:py-5">
                  <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
                    <h2 className="min-w-0 text-base font-semibold leading-snug text-[color:var(--foreground)]">{n.title}</h2>
                    {isSystem ? <span className="badge-accent shrink-0">{t("common.auto")}</span> : null}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-[color:var(--soft-foreground)]">
                    {n.body}
                  </p>
                  {when ? (
                    <p className="mt-4 border-t border-[color:var(--border)] pt-3 text-xs font-medium text-[color:var(--muted)]">
                      {when}
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
