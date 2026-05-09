"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import {
  findGroupByToken,
  getMealsForMonth,
  listCostsForChart,
  listDepositsForChart,
  listMembers,
} from "@/lib/firebase/repositories";
import { useGroupSession } from "@/lib/hooks/use-group-session";
import type { CostEntry, DepositEntry, Group, MealEntry, Member } from "@/types/domain";
import { GroupTokenMismatchHint } from "@/components/forms/group-token-mismatch-hint";
import { memberDisplayName, memberIdsForMoneyRows } from "@/lib/utils/chart-members";
import { formatMeal, getMonthTotals } from "@/lib/utils/meal-money";

export function GroupMoneyView({ token }: { token: string }) {
  const router = useRouter();
  const { chart } = useGroupSession();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [deposits, setDeposits] = useState<DepositEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isFirebaseConfigured) { setError("Firebase not configured."); setIsLoading(false); return; }
      try {
        const g = await findGroupByToken(token);
        if (!g) throw new Error("Group not found.");
        if (!active) return;
        setGroup(g);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load.");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!group || !chart) return;
    let active = true;
    setDataLoading(true);

    Promise.all([
      listMembers(group.id),
      getMealsForMonth(group.id, chart.monthKey),
      listCostsForChart(group.id, chart.id),
      listDepositsForChart(group.id, chart.id),
    ])
      .then(([memberList, mealList, costList, depositList]) => {
        if (!active) return;
        setMembers(memberList); setMeals(mealList); setCosts(costList); setDeposits(depositList);
      })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "Failed to load."); })
      .finally(() => { if (active) setDataLoading(false); });

    return () => { active = false; };
  }, [group, chart]);

  if (isLoading) return <p className="py-16 text-center text-sm text-[color:var(--soft-foreground)]">Loading…</p>;
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
            <p className="group-title">No month selected</p>
            <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">
              Go back to the home tab and select a month first.
            </p>
          </div>
          <button type="button" onClick={() => router.push(`/group/${token}`)} className="button-secondary shrink-0">
            ← Home
          </button>
        </div>
      </div>
    );
  }

  if (dataLoading) return <p className="py-16 text-center text-sm text-[color:var(--soft-foreground)]">Loading…</p>;

  const memberMeals: Record<string, number> = {};
  meals.forEach((m) => { memberMeals[m.memberId] = (memberMeals[m.memberId] ?? 0) + m.quantity; });

  const memberDeposits: Record<string, number> = {};
  deposits.forEach((d) => { memberDeposits[d.memberId] = (memberDeposits[d.memberId] ?? 0) + d.amount; });

  const grandTotal = Object.values(memberMeals).reduce((s, v) => s + v, 0);
  const { totalCost, totalPaid, mealRate, remainingTaka: balance } = getMonthTotals(meals, costs, deposits);
  const balanceRowIds = memberIdsForMoneyRows(
    members,
    meals,
    deposits.map((d) => d.memberId),
    chart.monthKey,
  );

  return (
    <div className="group-page-grid">
      <div className="group-hero">
        <div className="min-w-0">
          <p className="group-kicker">{group.name}</p>
          <p className="group-title">Money</p>
          <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">{chart.label}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Cost", value: `${totalCost.toFixed(2)} tk` },
          { label: "Total Paid", value: `${totalPaid.toFixed(2)} tk` },
          { label: "Total Meals", value: formatMeal(grandTotal) },
          { label: "Meal Rate", value: `${mealRate.toFixed(2)} tk` },
        ].map((s) => (
          <div key={s.label} className="group-stat-card">
            <p className="group-stat-label">{s.label}</p>
            <p className="group-stat-value">{s.value}</p>
          </div>
        ))}
      </div>

      <div className={`rounded-[var(--radius-sm)] border px-4 py-3 ${balance >= 0 ? "border-[color:var(--success-border)] bg-[color:var(--success-bg)]" : "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)]"}`}>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">Group Balance</p>
        <p className={`mt-1 text-xl font-bold ${balance >= 0 ? "text-[color:var(--success-text)]" : "text-[color:var(--danger)]"}`}>
          {balance >= 0 ? "+" : ""}{balance.toFixed(2)} tk
        </p>
        <p className="mt-0.5 text-xs text-[color:var(--muted)]">
          {balance >= 0 ? "Surplus — more paid than spent" : "Deficit — more spent than paid"}
        </p>
      </div>

      <div className="group-card">
        <p className="group-kicker">Member Balances</p>
        <div className="mt-3 grid gap-2">
          {balanceRowIds.map((memberId) => {
            const eaten = (memberMeals[memberId] ?? 0) * mealRate;
            const paid = memberDeposits[memberId] ?? 0;
            const remaining = paid - eaten;
            return (
              <div key={memberId} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">{memberDisplayName(memberId, members)}</p>
                  <p className="group-stat-label">
                    {formatMeal(memberMeals[memberId] ?? 0)} meals · eaten {eaten.toFixed(2)} tk · paid {paid.toFixed(2)} tk
                  </p>
                </div>
                <p className={`shrink-0 font-bold ${remaining >= 0 ? "text-[color:var(--accent)]" : "text-[color:var(--danger)]"}`}>
                  {remaining >= 0 ? "+" : ""}{remaining.toFixed(2)} tk
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="group-card">
        <p className="group-kicker">Deposits</p>
        <div className="mt-3 grid gap-2">
          {deposits.length === 0 && <p className="py-4 text-center text-sm text-[color:var(--soft-foreground)]">No deposits recorded.</p>}
          {deposits.map((d) => {
            const member = members.find((m) => m.id === d.memberId);
            return (
              <div key={d.id} className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-2.5">
                <div>
                  <p className="text-sm font-semibold">{member?.fullName ?? "Unknown"}</p>
                  <p className="group-stat-label">{d.date}</p>
                </div>
                <p className="font-bold text-[color:var(--accent)]">{d.amount.toFixed(2)} tk</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="group-card">
        <p className="group-kicker">Cost History</p>
        <div className="mt-3 grid gap-2">
          {costs.length === 0 && <p className="py-4 text-center text-sm text-[color:var(--soft-foreground)]">No costs recorded.</p>}
          {costs.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-2.5">
              <div>
                <p className="text-sm font-semibold">{c.itemName}</p>
                <p className="group-stat-label">{c.date}</p>
              </div>
              <p className="font-bold text-[color:var(--accent)]">{c.amount.toFixed(2)} tk</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
