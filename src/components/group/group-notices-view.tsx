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
  if (error) return <p className="mt-8 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (!group) return null;

  return (
    <div className="py-6 grid gap-5">
      <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Notices</p>
        <h1 className="mt-1 text-2xl font-semibold">{group.name}</h1>
      </div>

      <div className="grid gap-3">
        {notices.length === 0 && <p className="text-sm text-[color:var(--soft-foreground)]">No notices yet.</p>}
        {notices.map((n) => (
          <div key={n.id} className="rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-4">
            <div className="flex items-center gap-2">
              <p className="font-semibold">{n.title}</p>
              {n.systemGenerated && (
                <span className="rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[color:var(--accent)]">auto</span>
              )}
            </div>
            <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">{n.body}</p>
            <p className="mt-1.5 text-xs text-[color:var(--muted)]">{new Date(n.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
