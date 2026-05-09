"use client";

import { useEffect, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/use-t";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { GroupTokenMismatchHint } from "@/components/forms/group-token-mismatch-hint";
import { findGroupByToken, listNoticesForChart } from "@/lib/firebase/repositories";
import { useGroupSession } from "@/lib/hooks/use-group-session";
import type { Group, Notice } from "@/types/domain";

function formatNoticeCreatedAt(raw: unknown, locale: string): string {
  if (raw instanceof Timestamp) {
    return raw.toDate().toLocaleString(locale === "bn" ? "bn-BD" : undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }
  if (typeof raw === "string" && raw.length > 0) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString(locale === "bn" ? "bn-BD" : undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    }
  }
  return "";
}

export function GroupNoticesView({ token }: { token: string }) {
  const router = useRouter();
  const { t, tx, language } = useT();
  const locale = language === "bn" ? "bn" : "en";
  const { chart } = useGroupSession();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isFirebaseConfigured) {
        setError(t("errors.firebaseNotConfiguredShort"));
        setIsLoading(false);
        return;
      }
      try {
        const g = await findGroupByToken(token);
        if (!g) throw new Error("Group not found.");
        if (!active) return;
        setGroup(g);
      } catch (e) {
        if (!active) return;
        setError(tx(e instanceof Error ? e.message : t("errors.loadNoticesFailed")));
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [t, tx, token]);

  useEffect(() => {
    if (!group || !chart) return;
    let active = true;
    setDataLoading(true);

    listNoticesForChart(group.id, chart.id)
      .then((list) => {
        if (!active) return;
        setNotices(list);
      })
      .catch((e) => {
        if (active) setError(tx(e instanceof Error ? e.message : t("errors.genericLoad")));
      })
      .finally(() => {
        if (active) setDataLoading(false);
      });

    return () => {
      active = false;
    };
  }, [group, chart, t, tx]);

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-[color:var(--soft-foreground)]">{t("common.loading")}</p>;
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

  if (!chart) {
    return (
      <div className="group-page-grid">
        <div className="group-hero">
          <div className="min-w-0">
            <p className="group-kicker">{group.name}</p>
            <p className="group-title">{t("groupNotices.pageTitle")}</p>
            <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">{t("groupChart.noMonthBody")}</p>
          </div>
          <button type="button" onClick={() => router.push(`/group/${token}`)} className="button-secondary shrink-0">
            ← {t("groupNav.home")}
          </button>
        </div>
      </div>
    );
  }

  if (dataLoading) {
    return <p className="py-16 text-center text-sm text-[color:var(--soft-foreground)]">{t("common.loading")}</p>;
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
