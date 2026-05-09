"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import {
  findGroupByToken,
  listMembers,
  listCharts,
  getMealsForDate,
  saveMealEntry,
} from "@/lib/firebase/repositories";
import type { Chart, Group, MealEntry, Member } from "@/types/domain";

function formatMeal(n: number): string {
  const whole = Math.floor(n);
  const frac = Math.round((n - whole) * 4);
  const fracStr = [" ", "¼", "½", "¾"][frac] ?? "";
  if (whole === 0 && frac === 0) return "0";
  if (whole === 0) return fracStr.trim();
  if (frac === 0) return String(whole);
  return `${whole}${fracStr}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function buildDatesForChart(chart: Chart): string[] {
  const total = daysInMonth(chart.year, chart.month);
  return Array.from({ length: total }, (_, i) => {
    const d = String(i + 1).padStart(2, "0");
    return `${chart.monthKey}-${d}`;
  });
}

function localDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Step = "chart" | "date" | "meal";

export function MemberMealsManager({ token, memberId }: { token: string; memberId: string }) {
  const router = useRouter();

  const [group, setGroup] = useState<Group | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Step state
  const [step, setStep] = useState<Step>("chart");
  const [selectedChart, setSelectedChart] = useState<Chart | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Meal state
  const [mealCount, setMealCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mealLoading, setMealLoading] = useState(false);

  const today = localDateString();

  // Initial load: group, member, charts
  useEffect(() => {
    let active = true;
    async function load() {
      if (!isFirebaseConfigured) { setError("Firebase is not configured yet."); setLoading(false); return; }
      try {
        const currentGroup = await findGroupByToken(token);
        if (!currentGroup) throw new Error("No group found for this token.");
        const [currentMembers, currentCharts] = await Promise.all([
          listMembers(currentGroup.id),
          listCharts(currentGroup.id),
        ]);
        const targetMember = currentMembers.find((m) => m.id === memberId);
        if (!targetMember) throw new Error("Member not found in this group.");
        if (!active) return;
        setGroup(currentGroup);
        setMember(targetMember);
        setCharts(currentCharts);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load data.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [token, memberId]);

  // Load existing meal when date is selected
  useEffect(() => {
    if (!group || !selectedDate) return;
    let active = true;
    setMealLoading(true);
    setSaved(false);

    getMealsForDate(group.id, selectedDate)
      .then((entries) => {
        if (!active) return;
        const entry = entries.find((e: MealEntry) => e.memberId === memberId);
        setMealCount(entry?.quantity ?? 0);
      })
      .catch(() => { if (active) setMealCount(0); })
      .finally(() => { if (active) setMealLoading(false); });

    return () => { active = false; };
  }, [group, selectedDate, memberId]);

  const handleSelectChart = (chart: Chart) => {
    setSelectedChart(chart);
    setSelectedDate(null);
    setMealCount(0);
    setSaved(false);
    setStep("date");
  };

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setSaved(false);
    setStep("meal");
  };

  const handleMealChange = async (value: number) => {
    if (!group || !selectedDate) return;
    const clamped = Math.max(0, value);
    setMealCount(clamped);
    setSaved(false);
    setSaving(true);
    try {
      await saveMealEntry({ groupId: group.id, memberId, date: selectedDate, quantity: clamped });
      setSaved(true);
    } catch {
      setError("Failed to save meal entry.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-6 grid gap-4">
        <p className="py-16 text-center text-sm text-[color:var(--soft-foreground)]">Loading…</p>
      </div>
    );
  }

  if (error) return <div className="mt-6 alert-error">{error}</div>;
  if (!group || !member) return null;

  // ── Step indicator ────────────────────────────────────────────────
  const steps: { key: Step; label: string }[] = [
    { key: "chart", label: "Chart" },
    { key: "date", label: "Date" },
    { key: "meal", label: "Meal" },
  ];

  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="py-6 grid gap-4">
      {/* Header */}
      <div className="group-hero">
        <div className="min-w-0">
          <p className="group-kicker">{group.name}</p>
          <p className="group-title">{member.fullName}</p>
          {selectedChart && (
            <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">
              {selectedChart.label}{selectedDate ? ` · ${selectedDate}` : ""}
            </p>
          )}
        </div>
        <button
          onClick={() => router.push(`/group/${token}/members`)}
          type="button"
          className="button-secondary shrink-0"
        >
          ← Back
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3">
        {steps.map((s, i) => {
          const isDone = i < stepIndex;
          const isActive = s.key === step;
          return (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <span className="text-[color:var(--border-strong)]">›</span>}
              <button
                type="button"
                disabled={i > stepIndex}
                onClick={() => {
                  if (i < stepIndex) {
                    if (i === 0) { setStep("chart"); setSelectedDate(null); setSelectedChart(null); }
                    if (i === 1) { setStep("date"); setSelectedDate(null); }
                  }
                }}
                className={[
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition",
                  isActive
                    ? "bg-[color:var(--accent)] text-white"
                    : isDone
                    ? "bg-[color:var(--accent-dim)] text-[color:var(--accent)] cursor-pointer hover:bg-[color:var(--accent-glow)]"
                    : "text-[color:var(--muted)] cursor-not-allowed",
                ].join(" ")}
              >
                <span className={[
                  "flex h-4 w-4 items-center justify-center rounded-full text-[0.6rem] font-bold",
                  isActive ? "bg-white/20" : isDone ? "bg-[color:var(--accent)] text-white" : "bg-[color:var(--border-strong)] text-[color:var(--muted)]",
                ].join(" ")}>
                  {isDone ? "✓" : i + 1}
                </span>
                {s.label}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Select chart ─────────────────────────────────── */}
      {step === "chart" && (
        <div className="group-card">
          <p className="group-kicker">Select a Chart</p>
          <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">
            Choose the monthly chart you want to add meals to.
          </p>
          {charts.length === 0 ? (
            <p className="mt-4 py-6 text-center text-sm text-[color:var(--soft-foreground)]">
              No charts created yet. Ask your admin to create a chart first.
            </p>
          ) : (
            <div className="mt-4 grid gap-2">
              {charts.map((chart) => (
                <button
                  key={chart.id}
                  type="button"
                  onClick={() => handleSelectChart(chart)}
                  className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 text-left transition hover:border-[color:var(--accent)] hover:bg-[color:var(--accent-dim)]"
                >
                  <div>
                    <p className="font-semibold">{chart.label}</p>
                    <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                      {chart.totalDays} days · {chart.monthKey}
                    </p>
                  </div>
                  <span className="text-[color:var(--accent)]">→</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Select date ──────────────────────────────────── */}
      {step === "date" && selectedChart && (
        <div className="group-card">
          <p className="group-kicker">Select a Date</p>
          <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">
            Pick a day from <span className="font-semibold">{selectedChart.label}</span>.
          </p>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {buildDatesForChart(selectedChart).map((date) => {
              const day = date.slice(8);
              const isToday = date === today;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => handleSelectDate(date)}
                  className={[
                    "flex aspect-square items-center justify-center rounded-[var(--radius-sm)] text-sm font-semibold transition",
                    isToday
                      ? "border-2 border-[color:var(--accent)] bg-[color:var(--accent-dim)] text-[color:var(--accent)]"
                      : "border border-[color:var(--border)] bg-[color:var(--background)] hover:border-[color:var(--accent)] hover:bg-[color:var(--accent-dim)] hover:text-[color:var(--accent)]",
                  ].join(" ")}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Step 3: Add meal ─────────────────────────────────────── */}
      {step === "meal" && selectedDate && (
        <>
          <div className="rounded-[var(--radius)] border-2 border-[color:var(--accent)] bg-[color:var(--panel)] p-5 shadow-[0_0_0_4px_var(--accent-dim)]">
            <p className="group-kicker text-[color:var(--accent)]">
              Meals for {selectedDate}
            </p>
            {mealLoading ? (
              <p className="mt-4 text-sm text-[color:var(--soft-foreground)]">Loading…</p>
            ) : (
              <div className="mt-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <button
                    className="meal-stepper-button"
                    disabled={mealCount <= 0}
                    onClick={() => handleMealChange(mealCount - 0.25)}
                    type="button"
                  >
                    −
                  </button>
                  <span className="w-16 text-center text-4xl font-bold tabular-nums">
                    {formatMeal(mealCount)}
                  </span>
                  <button
                    className="meal-stepper-button"
                    onClick={() => handleMealChange(mealCount + 0.25)}
                    type="button"
                  >
                    +
                  </button>
                </div>
                <p className="text-sm font-medium text-[color:var(--muted)]">
                  {saving ? "Saving…" : saved ? "✓ Saved" : "Tap to update"}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => { setStep("date"); setSelectedDate(null); setSaved(false); }}
            className="button-secondary w-full"
          >
            ← Pick another date
          </button>
        </>
      )}
    </div>
  );
}
