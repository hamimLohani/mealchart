"use client";

import { useEffect, useState } from "react";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { findGroupByToken, listNotices } from "@/lib/firebase/repositories";
import type { Group, Notice } from "@/types/domain";

export function GroupNoticesView({ token }: { token: string }) {
  const [group, setGroup] = useState<Group | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isFirebaseConfigured) { setError("Firebase not configured."); setIsLoading(false); return; }
      try {
        const g = await findGroupByToken(token);
        if (!g) throw new Error("Group not found.");
        const list = await listNotices(g.id);
        if (!active) return;
        setGroup(g); setNotices(list);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load notices.");
      } finally { if (active) setIsLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [token]);

  if (isLoading) return <p className="py-16 text-center text-sm text-[color:var(--soft-foreground)]">Loading…</p>;
  if (error) return <div className="mt-8 alert-error">{error}</div>;
  if (!group) return null;

  return (
    <div className="group-page-grid">
      <div className="group-hero">
        <div className="min-w-0">
          <p className="group-kicker">{group.name}</p>
          <p className="group-title">Notices</p>
          <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">
            {notices.length} notice{notices.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {notices.length === 0 && (
          <p className="py-8 text-center text-sm text-[color:var(--soft-foreground)]">No notices yet.</p>
        )}
        {notices.map((n) => (
          <div
            key={n.id}
            className="rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--panel)] p-4"
          >
            <div className="flex items-center gap-2">
              <p className="font-semibold">{n.title}</p>
              {n.systemGenerated && <span className="badge-accent">auto</span>}
            </div>
            <p className="mt-1.5 text-sm text-[color:var(--soft-foreground)]">{n.body}</p>
            <p className="mt-2 text-xs text-[color:var(--muted)]">
              {new Date(n.createdAt).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
