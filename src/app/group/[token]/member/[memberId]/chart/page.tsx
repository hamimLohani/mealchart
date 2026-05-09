"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import {
  findGroupByToken,
  listMembers,
  listCharts,
  getMealsForMonth,
} from "@/lib/firebase/repositories";
import { MemberNavbar } from "@/components/group/member-navbar";
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

export default function MemberChartPage({
  params,
}: {
  params: Promise<{ token: string; memberId: string }>;
}) {
  const { token, memberId } = use(params);
  const router = useRouter();

  const [group, setGroup] = useState<Group | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedChart, setSelectedChart] = useState<Chart | null>(null);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);

  // Initial load
  useEffect(() => {
    let active = true;
    async function load() {
      if (!isFirebaseConfigured) { setError("Firebase is not configured yet."); setIsLoading(false); return; }
      try {
        const currentGroup = await findGroupByToken(token);
        if (!currentGroup) throw new Error("No group found for this token.");
        const [members, currentCharts] = await Promise.all([
          listMembers(currentGroup.id),
          listCharts(currentGroup.id),
        ]);
        const currentMember = members.find((m) => m.id === memberId);
        if (!currentMember) throw new Error("Member not found in this group.");
        if (!active) return;
        setGroup(currentGroup);
        setMember(currentMember);
        setCharts(currentCharts);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load data.");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [token, memberId]);

  // Load meals when chart selected
  useEffect(() => {
    if (!group || !selectedChart) return;
    let active = true;
    setMonthLoading(true);
    setMeals([]);

    getMealsForMonth(group.id, selectedChart.monthKey)
      .then((list) => { if (active) setMeals(list); })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "Failed to load meals."); })
      .finally(() => { if (active) setMonthLoading(false); });

    return () => { active = false; };
  }, [group, selectedChart]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-8">
      <MemberNavbar token={token} memberId={memberId} />
      <div className="py-6 grid gap-4">
        {isLoading ? (
          <p className="py-16 text-center text-sm text-[color:var(--soft-foreground)]">Loading…</p>
        ) : error ? (
          <div className="alert-error">{error}</div>
        ) : group && member ? (
          <>
            {/* Header */}
            <div className="group-hero">
              <div className="min-w-0">
                <p className="group-kicker">{group.name}</p>
                <p className="group-title">{member.fullName}&apos;s Chart</p>
                {selectedChart && (
                  <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">{selectedChart.label}</p>
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

            {/* Chart selection */}
            {!selectedChart ? (
              <div className="group-card">
                <p className="group-kicker">Select Month</p>
                <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">
                  Choose a month to view your meal chart.
                </p>
                {charts.length === 0 ? (
                  <p className="mt-4 py-6 text-center text-sm text-[color:var(--soft-foreground)]">
                    No charts created yet.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-2">
                    {charts.map((chart, i) => (
                      <button
                        key={chart.id}
                        type="button"
                        onClick={() => setSelectedChart(chart)}
                        className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3.5 text-left transition hover:border-[color:var(--accent)] hover:bg-[color:var(--accent-dim)]"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{chart.label}</p>
                            {i === 0 && <span className="badge-accent">active</span>}
                          </div>
                          <p className="mt-0.5 text-xs text-[color:var(--muted)]">{chart.monthKey}</p>
                        </div>
                        <span className="text-[color:var(--accent)]">→</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : monthLoading ? (
              <p className="py-12 text-center text-sm text-[color:var(--soft-foreground)]">Loading chart…</p>
            ) : (() => {
              const myMeals = meals
                .filter((m) => m.memberId === memberId)
                .sort((a, b) => a.date.localeCompare(b.date));

              const totalMeals = myMeals.reduce((s, m) => s + m.quantity, 0);
              const activeDays = myMeals.filter((m) => m.quantity > 0).length;
              const totalDays = daysInMonth(selectedChart.year, selectedChart.month);
              const maxQty = Math.max(...myMeals.map((m) => m.quantity), 1);

              // Build full day grid
              const days = Array.from({ length: totalDays }, (_, i) => {
                const d = String(i + 1).padStart(2, "0");
                const date = `${selectedChart.monthKey}-${d}`;
                const meal = myMeals.find((m) => m.date === date);
                return { date, day: i + 1, qty: meal?.quantity ?? 0 };
              });

              return (
                <>
                  <button
                    type="button"
                    onClick={() => { setSelectedChart(null); setMeals([]); }}
                    className="button-secondary w-full"
                  >
                    ← Change Month
                  </button>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: "Total Meals", value: formatMeal(totalMeals) },
                      { label: "Active Days", value: String(activeDays) },
                      { label: "Total Days", value: String(totalDays) },
                      { label: "Avg / Day", value: activeDays > 0 ? (totalMeals / activeDays).toFixed(2) : "0" },
                    ].map((s) => (
                      <div key={s.label} className="group-stat-card">
                        <p className="group-stat-label">{s.label}</p>
                        <p className="group-stat-value">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Bar chart */}
                  <div className="group-card">
                    <p className="group-kicker">Daily Meals — {selectedChart.label}</p>
                    <div className="mt-4 grid gap-1.5">
                      {days.map(({ date, day, qty }) => (
                        <div key={date} className="flex items-center gap-3">
                          <span className="w-6 shrink-0 text-right text-xs text-[color:var(--muted)]">{day}</span>
                          <div className="flex-1 overflow-hidden rounded-full bg-[color:var(--background)]">
                            {qty > 0 ? (
                              <div
                                className="flex h-6 items-center justify-end rounded-full bg-[color:var(--accent)] pr-2 text-xs font-bold text-white"
                                style={{ width: `${Math.max(6, (qty / maxQty) * 100)}%` }}
                              >
                                {formatMeal(qty)}
                              </div>
                            ) : (
                              <div className="h-6 rounded-full" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}
          </>
        ) : null}
      </div>
    </main>
  );
}
