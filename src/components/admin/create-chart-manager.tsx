"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import {
  backfillMealMonthKeys,
  createChart,
  getAdminProfile,
  listCharts,
  syncLockedMonthDocsFromCharts,
  updateChartLock,
} from "@/lib/firebase/repositories";
import { formatChartLabel } from "@/lib/utils/date";
import { daysInMonth } from "@/lib/utils/date";
import type { AdminProfile, Chart } from "@/types/domain";

type ChartFormState = { year: string; month: string };

const today = new Date();
const initialState: ChartFormState = {
  year: String(today.getFullYear()),
  month: String(today.getMonth() + 1).padStart(2, "0"),
};

export function CreateChartManager() {
  const configurationError =
    !isFirebaseConfigured || !auth
      ? "Firebase is not configured yet. Add your keys in .env.local first."
      : null;

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [form, setForm] = useState<ChartFormState>(initialState);
  const [error, setError] = useState<string | null>(configurationError);
  const [isLoading, setIsLoading] = useState(!configurationError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (configurationError || !auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAdminProfile(null); setCharts([]);
        setError("Log in as an admin to create charts.");
        setIsLoading(false);
        return;
      }
      try {
        setError(null);
        const profile = await getAdminProfile(user.uid);
        if (!profile) throw new Error("No admin profile was found for the current user.");
        const currentCharts = await listCharts(profile.groupId);
        await backfillMealMonthKeys(profile.groupId);
        await syncLockedMonthDocsFromCharts(profile.groupId);
        setAdminProfile(profile);
        setCharts(currentCharts);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load charts.");
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [configurationError]);

  const previewLabel = useMemo(() => {
    const y = Number(form.year);
    const m = Number(form.month);
    if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) return "Invalid month";
    return `${formatChartLabel(y, m)} · ${daysInMonth(y, m)} days`;
  }, [form.month, form.year]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!adminProfile) { setError("Admin profile is required before creating a chart."); return; }
    const year = Number(form.year);
    const month = Number(form.month);
    if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
      setError("Enter a valid year and month.");
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await createChart({ groupId: adminProfile.groupId, year, month });
      setCharts((c) => [created, ...c].sort((a, b) => b.monthKey.localeCompare(a.monthKey)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create the chart.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleLock(chart: Chart) {
    if (!adminProfile) return;
    setError(null);
    try {
      await updateChartLock({
        groupId: adminProfile.groupId,
        chartId: chart.id,
        locked: !chart.locked,
      });
      setCharts((prev) =>
        prev.map((current) =>
          current.id === chart.id ? { ...current, locked: !current.locked } : current,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update chart lock.");
    }
  }

  if (isLoading) {
    return <p className="mt-8 text-sm text-[color:var(--soft-foreground)]">Loading charts…</p>;
  }

  return (
    <div className="mt-6 grid gap-5">
      {error && <p className="alert-error">{error}</p>}

      <div className="rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] p-4">
        <p className="admin-section-label">About charts</p>
        <p className="mt-2 text-sm leading-6 text-[color:var(--soft-foreground)]">
          Each chart is a monthly accounting sheet. When a new chart is created, it becomes the active chart for Chart View and Money Management calculations.
        </p>
      </div>

      <form
        className="grid gap-4 rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-sm)]"
        onSubmit={handleSubmit}
      >
        <p className="admin-section-label">New Chart</p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">
            Year
            <input
              className="input"
              onChange={(e) => setForm((c) => ({ ...c, year: e.target.value }))}
              placeholder="2026"
              type="number"
              value={form.year}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Month
            <select
              className="input"
              onChange={(e) => setForm((c) => ({ ...c, month: e.target.value }))}
              value={form.month}
            >
              {Array.from({ length: 12 }, (_, i) => {
                const m = String(i + 1).padStart(2, "0");
                return <option key={m} value={m}>{m}</option>;
              })}
            </select>
          </label>
        </div>

        <div className="rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] p-3.5">
          <p className="admin-section-label">Preview</p>
          <p className="mt-1.5 text-base font-semibold">{previewLabel}</p>
        </div>

        <button
          className="button-primary w-full sm:w-fit"
          disabled={!adminProfile || isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Creating…" : "Create new chart"}
        </button>
      </form>

      <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-sm)]">
        <p className="admin-section-label">Existing Charts</p>
        <div className="mt-3 grid gap-2.5">
          {charts.length ? (
            charts.map((chart, index) => (
              <article
                key={chart.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3"
              >
                <div>
                  <p className="font-semibold">{chart.label}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                    {chart.totalDays} days · {chart.monthKey}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {chart.locked ? (
                    <span className="rounded-full border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-2 py-0.5 text-xs font-semibold text-[color:var(--danger)]">
                      locked
                    </span>
                  ) : null}
                  {index === 0 && <span className="badge-accent">active</span>}
                  <button
                    type="button"
                    onClick={() => void handleToggleLock(chart)}
                    className="button-secondary"
                  >
                    {chart.locked ? "Unlock" : "Lock"}
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="py-4 text-center text-sm text-[color:var(--soft-foreground)]">
              No charts have been created yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
