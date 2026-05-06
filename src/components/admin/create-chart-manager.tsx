"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import {
  createChart,
  getAdminProfile,
  listCharts,
} from "@/lib/firebase/repositories";
import { formatChartLabel } from "@/lib/utils/date";
import type { AdminProfile, Chart } from "@/types/domain";

type ChartFormState = {
  year: string;
  month: string;
};

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
    if (configurationError || !auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAdminProfile(null);
        setCharts([]);
        setError("Log in as an admin to create charts.");
        setIsLoading(false);
        return;
      }

      try {
        setError(null);
        const profile = await getAdminProfile(user.uid);

        if (!profile) {
          throw new Error("No admin profile was found for the current user.");
        }

        const currentCharts = await listCharts(profile.groupId);
        setAdminProfile(profile);
        setCharts(currentCharts);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load charts.",
        );
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [configurationError]);

  const previewLabel = useMemo(() => {
    const year = Number(form.year);
    const month = Number(form.month);

    if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
      return "Invalid month";
    }

    return `${formatChartLabel(year, month)} • 31 days`;
  }, [form.month, form.year]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!adminProfile) {
      setError("Admin profile is required before creating a chart.");
      return;
    }

    const year = Number(form.year);
    const month = Number(form.month);

    if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
      setError("Enter a valid year and month.");
      return;
    }

    setIsSubmitting(true);

    try {
      const created = await createChart({
        groupId: adminProfile.groupId,
        year,
        month,
      });

      setCharts((current) =>
        [created, ...current].sort((left, right) =>
          right.monthKey.localeCompare(left.monthKey),
        ),
      );
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Failed to create the chart.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <p className="mt-8 text-sm text-[color:var(--soft-foreground)]">Loading charts...</p>;
  }

  return (
    <div className="mt-8 grid gap-6">
      {error ? (
        <p className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--background)] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Chart meaning
        </p>
        <p className="mt-3 text-sm leading-7 text-[color:var(--soft-foreground)]">
          Each chart is a monthly accounting sheet with 31 day slots. When a new chart is created, it becomes the active chart for future Chart View and Money Management calculations.
        </p>
      </div>

      <form
        className="grid gap-4 rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--background)] p-5"
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Year
            <input
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
              onChange={(event) =>
                setForm((current) => ({ ...current, year: event.target.value }))
              }
              placeholder="2026"
              type="number"
              value={form.year}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Month
            <select
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
              onChange={(event) =>
                setForm((current) => ({ ...current, month: event.target.value }))
              }
              value={form.month}
            >
              {Array.from({ length: 12 }, (_, index) => {
                const month = String(index + 1).padStart(2, "0");

                return (
                  <option key={month} value={month}>
                    {month}
                  </option>
                );
              })}
            </select>
          </label>
        </div>

        <div className="rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            New chart preview
          </p>
          <p className="mt-2 text-lg font-semibold">{previewLabel}</p>
        </div>

        <button
          className="button-primary w-full sm:w-fit disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!adminProfile || isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Creating chart..." : "Create new chart"}
        </button>
      </form>

      <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--background)] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Existing charts
        </p>
        <div className="mt-4 grid gap-3">
          {charts.length ? (
            charts.map((chart, index) => (
              <article
                key={chart.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-4"
              >
                <div>
                  <p className="font-semibold">{chart.label}</p>
                  <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">
                    {chart.totalDays} days • {chart.monthKey}
                  </p>
                </div>
                <p className="text-sm font-medium text-[color:var(--muted)]">
                  {index === 0 ? "Latest" : "Previous"}
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm text-[color:var(--soft-foreground)]">
              No charts have been created yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
