"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { findGroupByToken, listCharts } from "@/lib/firebase/repositories";
import type { Chart, Group } from "@/types/domain";

export function GroupHistoryView({ token }: { token: string }) {
  const [group, setGroup] = useState<Group | null>(null);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isFirebaseConfigured) { setError("Firebase not configured."); setIsLoading(false); return; }
      try {
        const g = await findGroupByToken(token);
        if (!g) throw new Error("Group not found.");
        const list = await listCharts(g.id);
        if (!active) return;
        setGroup(g); setCharts(list);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load history.");
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">History</p>
        <h1 className="mt-1 text-2xl font-semibold">{group.name}</h1>
        <p className="mt-0.5 text-sm text-[color:var(--soft-foreground)]">{charts.length} chart{charts.length !== 1 ? "s" : ""} total</p>
      </div>

      <div className="grid gap-3">
        {charts.length === 0 && <p className="text-sm text-[color:var(--soft-foreground)]">No charts created yet.</p>}
        {charts.map((chart, i) => (
          <Link
            key={chart.id}
            href={`/group/${token}/chart`}
            className="flex items-center justify-between rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3 transition hover:border-[color:var(--accent)]"
          >
            <div>
              <p className="font-semibold">{chart.label}</p>
              <p className="text-xs text-[color:var(--muted)]">{chart.totalDays} days · {chart.monthKey}</p>
            </div>
            <div className="flex items-center gap-2">
              {i === 0 && (
                <span className="rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[color:var(--accent)]">active</span>
              )}
              <span className="text-[color:var(--muted)]">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
