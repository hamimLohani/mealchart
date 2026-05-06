"use client";

import { useEffect, useState } from "react";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import {
  findGroupByToken,
  getMealsForMonth,
  listCostsForMonth,
  listDepositsForMonth,
  listMembers,
} from "@/lib/firebase/repositories";
import { toMonthKey } from "@/lib/utils/date";
import type { CostEntry, DepositEntry, Group, MealEntry, Member } from "@/types/domain";

function formatMeal(n: number): string {
  const whole = Math.floor(n);
  const frac = Math.round((n - whole) * 4);
  const fracStr = [" ", "\u00bc", "\u00bd", "\u00be"][frac] ?? "";
  if (whole === 0 && frac === 0) return "0";
  if (whole === 0) return fracStr.trim();
  if (frac === 0) return String(whole);
  return `${whole}${fracStr}`;
}

export function GroupMoneyView({ token }: { token: string }) {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [deposits, setDeposits] = useState<DepositEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isFirebaseConfigured) { setError("Firebase not configured."); setIsLoading(false); return; }
      try {
        const g = await findGroupByToken(token);
        if (!g) throw new Error("Group not found.");
        const now = new Date();
        const monthKey = g.currentChartMonth ?? toMonthKey(now.getFullYear(), now.getMonth() + 1);
        const [year, mon] = monthKey.split("-").map(Number);
        const [memberList, mealList, costList, depositList] = await Promise.all([
          listMembers(g.id),
          getMealsForMonth(g.id, monthKey),
          listCostsForMonth(g.id, monthKey),
          listDepositsForMonth(g.id, new Date(year, mon - 1, 1)),
        ]);
        if (!active) return;
        setGroup(g); setMembers(memberList); setMeals(mealList); setCosts(costList); setDeposits(depositList);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load.");
      } finally { if (active) setIsLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [token]);

  if (isLoading) return <p className="py-16 text-center text-sm text-[color:var(--soft-foreground)]">Loading…</p>;
  if (error) return <p className="mt-8 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (!group) return null;

  const monthKey = group.currentChartMonth ?? toMonthKey(new Date().getFullYear(), new Date().getMonth() + 1);
  const [year, mon] = monthKey.split("-").map(Number);
  const monthLabel = new Date(year, mon - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const memberMeals: Record<string, number> = {};
  meals.forEach((m) => { memberMeals[m.memberId] = (memberMeals[m.memberId] ?? 0) + m.quantity; });

  const memberDeposits: Record<string, number> = {};
  deposits.forEach((d) => { memberDeposits[d.memberId] = (memberDeposits[d.memberId] ?? 0) + d.amount; });

  const grandTotal = Object.values(memberMeals).reduce((s, v) => s + v, 0);
  const totalCost = costs.reduce((s, c) => s + c.amount, 0);
  const totalPaid = deposits.reduce((s, d) => s + d.amount, 0);
  const mealRate = grandTotal > 0 ? totalCost / grandTotal : 0;

  return (
    <div className="py-6 grid gap-5">
      <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Money Management</p>
        <h1 className="mt-1 text-2xl font-semibold">{group.name}</h1>
        <p className="mt-0.5 text-sm text-[color:var(--soft-foreground)]">{monthLabel}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Cost", value: `${totalCost.toFixed(2)} tk` },
          { label: "Total Paid", value: `${totalPaid.toFixed(2)} tk` },
          { label: "Total Meals", value: String(grandTotal) },
          { label: "Meal Rate", value: `${mealRate.toFixed(2)} tk` },
        ].map((s) => (
          <div key={s.label} className="rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-3 text-center">
            <p className="text-xs text-[color:var(--muted)]">{s.label}</p>
            <p className="mt-1 text-base font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Per-member balance */}
      <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Member Balances</p>
        <div className="mt-3 grid gap-2">
          {members.map((member) => {
            const eaten = (memberMeals[member.id] ?? 0) * mealRate;
            const paid = memberDeposits[member.id] ?? 0;
            const remaining = paid - eaten;
            return (
              <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[1rem] border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3">
                <div>
                  <p className="font-semibold">{member.fullName}</p>
                  <p className="text-xs text-[color:var(--muted)]">
                    {formatMeal(memberMeals[member.id] ?? 0)} meals · eaten {eaten.toFixed(2)} tk · paid {paid.toFixed(2)} tk
                  </p>
                </div>
                <p className={`font-bold ${remaining >= 0 ? "text-[color:var(--accent)]" : "text-red-500"}`}>
                  {remaining >= 0 ? "+" : ""}{remaining.toFixed(2)} tk
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cost history */}
      <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Cost History</p>
        <div className="mt-3 grid gap-2">
          {costs.length === 0 && <p className="text-sm text-[color:var(--soft-foreground)]">No costs recorded.</p>}
          {costs.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-[1rem] border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-2.5">
              <div>
                <p className="text-sm font-semibold">{c.itemName}</p>
                <p className="text-xs text-[color:var(--muted)]">{c.date}</p>
              </div>
              <p className="font-bold">{c.amount.toFixed(2)} tk</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
