"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import {
  findGroupByToken,
  listMembers,
  listCharts,
  getMealsForMonth,
  listCostsForChart,
  listDepositsForChart,
} from "@/lib/firebase/repositories";
import { MemberNavbar } from "@/components/group/member-navbar";
import type { Chart, CostEntry, DepositEntry, Group, MealEntry, Member } from "@/types/domain";

function formatMeal(n: number): string {
  const whole = Math.floor(n);
  const frac = Math.round((n - whole) * 4);
  const fracStr = [" ", "¼", "½", "¾"][frac] ?? "";
  if (whole === 0 && frac === 0) return "0";
  if (whole === 0) return fracStr.trim();
  if (frac === 0) return String(whole);
  return `${whole}${fracStr}`;
}

export default function MemberMoneyPage({
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

  // Chart selection
  const [selectedChart, setSelectedChart] = useState<Chart | null>(null);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [deposits, setDeposits] = useState<DepositEntry[]>([]);
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

  // Load chart data when chart selected
  useEffect(() => {
    if (!group || !selectedChart) return;
    let active = true;
    setMonthLoading(true);
    setMeals([]); setCosts([]); setDeposits([]);

    Promise.all([
      getMealsForMonth(group.id, selectedChart.monthKey),
      listCostsForChart(group.id, selectedChart.id),
      listDepositsForChart(group.id, selectedChart.id),
    ])
      .then(([mealList, costList, depositList]) => {
        if (!active) return;
        setMeals(mealList);
        setCosts(costList);
        setDeposits(depositList);
      })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "Failed to load month data."); })
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
                <p className="group-title">{member.fullName}&apos;s Money</p>
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
                  Choose a month to view your money summary.
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
              <p className="py-12 text-center text-sm text-[color:var(--soft-foreground)]">Loading month data…</p>
            ) : (() => {
              // Compute this member's stats for the selected chart
              const myMeals = meals.filter((m) => m.memberId === memberId);
              const myTotalMeals = myMeals.reduce((s, m) => s + m.quantity, 0);

              const allMeals = meals.reduce((s, m) => s + m.quantity, 0);
              const totalCost = costs.reduce((s, c) => s + c.amount, 0);
              const mealRate = allMeals > 0 ? totalCost / allMeals : 0;
              const myExpense = myTotalMeals * mealRate;

              const myDeposits = deposits.filter((d) => d.memberId === memberId);
              const myPaid = myDeposits.reduce((s, d) => s + d.amount, 0);
              const myBalance = myPaid - myExpense;

              return (
                <>
                  {/* Back to months */}
                  <button
                    type="button"
                    onClick={() => { setSelectedChart(null); setMeals([]); setCosts([]); setDeposits([]); }}
                    className="button-secondary w-full"
                  >
                    ← Change Month
                  </button>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: "My Meals", value: formatMeal(myTotalMeals) },
                      { label: "Meal Rate", value: `${mealRate.toFixed(2)} tk` },
                      { label: "My Expense", value: `${myExpense.toFixed(2)} tk` },
                      { label: "My Paid", value: `${myPaid.toFixed(2)} tk` },
                    ].map((s) => (
                      <div key={s.label} className="group-stat-card">
                        <p className="group-stat-label">{s.label}</p>
                        <p className="group-stat-value">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Balance */}
                  <div className={`rounded-[var(--radius-sm)] border px-4 py-3 ${
                    myBalance >= 0
                      ? "border-[color:var(--success-border)] bg-[color:var(--success-bg)]"
                      : "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)]"
                  }`}>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">My Balance</p>
                    <p className={`mt-1 text-2xl font-bold ${myBalance >= 0 ? "text-[color:var(--success-text)]" : "text-[color:var(--danger)]"}`}>
                      {myBalance >= 0 ? "+" : ""}{myBalance.toFixed(2)} tk
                    </p>
                    <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                      {myBalance >= 0 ? "You have credit remaining" : "You owe this amount"}
                    </p>
                  </div>

                  {/* My meal entries */}
                  <div className="group-card">
                    <p className="group-kicker">My Meal Entries — {selectedChart.label}</p>
                    <div className="mt-3 divide-y divide-[color:var(--border)]">
                      {myMeals.length === 0 ? (
                        <p className="py-6 text-center text-sm text-[color:var(--soft-foreground)]">No meals recorded.</p>
                      ) : (
                        myMeals.map((meal, i) => (
                          <div key={i} className="flex items-center justify-between py-2.5">
                            <div>
                              <p className="text-sm font-semibold">{meal.date}</p>
                              <p className="text-xs text-[color:var(--muted)]">{formatMeal(meal.quantity)} meal{meal.quantity !== 1 ? "s" : ""}</p>
                            </div>
                            <p className="font-bold text-[color:var(--accent)]">{(meal.quantity * mealRate).toFixed(2)} tk</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* My deposits */}
                  <div className="group-card">
                    <p className="group-kicker">My Deposits — {selectedChart.label}</p>
                    <div className="mt-3 divide-y divide-[color:var(--border)]">
                      {myDeposits.length === 0 ? (
                        <p className="py-6 text-center text-sm text-[color:var(--soft-foreground)]">No deposits recorded.</p>
                      ) : (
                        myDeposits.map((d) => (
                          <div key={d.id} className="flex items-center justify-between py-2.5">
                            <p className="text-sm font-semibold">{d.date}</p>
                            <p className="font-bold text-[color:var(--accent)]">{d.amount.toFixed(2)} tk</p>
                          </div>
                        ))
                      )}
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
