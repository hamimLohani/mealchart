"use client";

import { useEffect, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { GroupTokenMismatchHint } from "@/components/forms/group-token-mismatch-hint";
import { findGroupByToken, listNotices } from "@/lib/firebase/repositories";
import type { Group, Notice } from "@/types/domain";

function formatNoticeCreatedAt(raw: unknown): string {
  if (raw instanceof Timestamp) {
    return raw.toDate().toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }
  if (typeof raw === "string" && raw.length > 0) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    }
  }
  return "";
}

export function GroupNoticesView({ token }: { token: string }) {
  const [group, setGroup] = useState<Group | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isFirebaseConfigured) {
        setError("Firebase not configured.");
        setIsLoading(false);
        return;
      }
      try {
        const g = await findGroupByToken(token);
        if (!g) throw new Error("Group not found.");
        const list = await listNotices(g.id);
        if (!active) return;
        setGroup(g);
        setNotices(list);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load notices.");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [token]);

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-[color:var(--soft-foreground)]">Loading…</p>;
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

  const formattedCount =
    notices.length === 0 ? "No notices yet" : `${notices.length} notice${notices.length !== 1 ? "s" : ""}`;

  return (
    <div className="group-page-grid">
      <div className="group-hero">
        <div className="min-w-0">
          <p className="group-kicker">{group.name}</p>
          <p className="group-title">Notices</p>
          <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">{formattedCount}</p>
        </div>
      </div>

      {notices.length === 0 ? (
        <div className="group-card py-14 text-center">
          <p className="text-sm font-medium text-[color:var(--foreground)]">You&apos;re all caught up</p>
          <p className="mt-2 text-sm text-[color:var(--soft-foreground)]">
            When your admin posts updates, they will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {notices.map((n) => {
            const when = formatNoticeCreatedAt((n as { createdAt?: unknown }).createdAt);
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
                    <h2 className="min-w-0 text-base font-semibold leading-snug text-[color:var(--foreground)]">
                      {n.title}
                    </h2>
                    {isSystem ? <span className="badge-accent shrink-0">auto</span> : null}
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
