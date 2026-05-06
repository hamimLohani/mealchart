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

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function GroupChartView({ token }: { token: string }) {
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
        const monthDate = new Date(year, mon - 1, 1);

        const [memberList, mealList, costList, depositList] = await Promise.all([
          listMembers(g.id),
          getMealsForMonth(g.id, monthKey),
          listCostsForMonth(g.id, monthKey),
          listDepositsForMonth(g.id, monthDate),
        ]);

        if (!active) return;
        setGroup(g);
        setMembers(memberList);
        setMeals(mealList);
        setCosts(costList);
        setDeposits(depositList);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load chart.");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [token]);

  if (isLoading) return <p className="py-16 text-center text-sm text-[color:var(--soft-foreground)]">Loading chart…</p>;
  if (error) return <p className="mt-8 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (!group) return null;

  const monthKey = group.currentChartMonth ?? toMonthKey(new Date().getFullYear(), new Date().getMonth() + 1);
  const [year, mon] = monthKey.split("-").map(Number);
  const totalDays = daysInMonth(year, mon);
  const days = Array.from({ length: totalDays }, (_, i) => `${monthKey}-${String(i + 1).padStart(2, "0")}`);

  // meal map: memberId → date → quantity
  const mealMap: Record<string, Record<string, number>> = {};
  meals.forEach((m) => {
    if (!mealMap[m.memberId]) mealMap[m.memberId] = {};
    mealMap[m.memberId][m.date] = m.quantity;
  });

  const memberTotal = (id: string) => Object.values(mealMap[id] ?? {}).reduce((s, v) => s + v, 0);
  const grandTotal = members.reduce((s, m) => s + memberTotal(m.id), 0);
  const totalCost = costs.reduce((s, c) => s + c.amount, 0);
  const totalPaid = deposits.reduce((s, d) => s + d.amount, 0);
  const mealRate = grandTotal > 0 ? totalCost / grandTotal : 0;

  const monthLabel = new Date(year, mon - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="py-6 grid gap-5">
      {/* Header */}
      <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Chart View</p>
        <h1 className="mt-1 text-2xl font-semibold">{group.name}</h1>
        <p className="mt-0.5 text-sm text-[color:var(--soft-foreground)]">{monthLabel}</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Meals", value: formatMeal(grandTotal) },
          { label: "Total Cost", value: `${totalCost.toFixed(2)} tk` },
          { label: "Total Paid", value: `${totalPaid.toFixed(2)} tk` },
          { label: "Meal Rate", value: `${mealRate.toFixed(2)} tk` },
        ].map((s) => (
          <div key={s.label} className="rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-3 text-center">
            <p className="text-xs text-[color:var(--muted)]">{s.label}</p>
            <p className="mt-1 text-base font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Meal table */}
      <div className="overflow-x-auto rounded-[1.5rem] border border-[color:var(--border)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[color:var(--panel)]">
              <th className="sticky left-0 z-10 bg-[color:var(--panel)] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.15em] text-[color:var(--muted)]">Member</th>
              {days.map((d) => (
                <th key={d} className="min-w-[36px] px-1 py-2.5 text-center text-xs font-semibold text-[color:var(--muted)]">{d.slice(8)}</th>
              ))}
              <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-[0.15em] text-[color:var(--accent)]">Total</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member, ri) => (
              <tr key={member.id} className={ri % 2 === 0 ? "bg-[color:var(--background)]" : "bg-[color:var(--panel)]"}>
                <td className={`sticky left-0 z-10 px-3 py-2 font-medium ${ri % 2 === 0 ? "bg-[color:var(--background)]" : "bg-[color:var(--panel)]"}`}>{member.fullName}</td>
                {days.map((d) => (
                  <td key={d} className="px-1 py-2 text-center text-xs">{mealMap[member.id]?.[d] ? formatMeal(mealMap[member.id][d]) : ""}</td>
                ))}
                <td className="px-3 py-2 text-center font-bold text-[color:var(--accent)]">{formatMeal(memberTotal(member.id))}</td>
              </tr>
            ))}
            <tr className="border-t border-[color:var(--border)] bg-[color:var(--panel)] font-semibold">
              <td className="sticky left-0 z-10 bg-[color:var(--panel)] px-3 py-2 text-xs uppercase tracking-[0.15em] text-[color:var(--muted)]">Total</td>
              {days.map((d) => (
                <td key={d} className="px-1 py-2 text-center text-xs text-[color:var(--soft-foreground)]">
                  {members.reduce((s, m) => s + (mealMap[m.id]?.[d] ?? 0), 0) ? formatMeal(members.reduce((s, m) => s + (mealMap[m.id]?.[d] ?? 0), 0)) : ""}
                </td>
              ))}
              <td className="px-3 py-2 text-center font-bold">{formatMeal(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
