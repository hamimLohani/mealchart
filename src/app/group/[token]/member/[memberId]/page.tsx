"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import {
  findGroupByToken,
  getMealsForDate,
  getMealsForMonth,
  listCostsForChart,
  listDepositsForChart,
  listMembers,
  saveMealEntry,
} from "@/lib/firebase/repositories";
import { GroupTokenMismatchHint } from "@/components/forms/group-token-mismatch-hint";
import { useGroupSession } from "@/lib/hooks/use-group-session";
import type { CostEntry, DepositEntry, Group, MealEntry, Member } from "@/types/domain";
import { chartMonthDateBounds, daysInMonth, toDateInputValue } from "@/lib/utils/date";
import { formatMeal, getMemberTotals, getMonthTotals } from "@/lib/utils/meal-money";

export default function MemberPage({
  params,
}: {
  params: Promise<{ token: string; memberId: string }>;
}) {
  const { token, memberId } = use(params);
  const router = useRouter();
  const { chart } = useGroupSession();
  const [group, setGroup] = useState<Group | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [deposits, setDeposits] = useState<DepositEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => toDateInputValue(new Date()));
  const [mealCount, setMealCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMonthLoading, setIsMonthLoading] = useState(false);
  const [isMealLoading, setIsMealLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isFirebaseConfigured) {
        setError("Firebase is not configured yet.");
        setIsLoading(false);
        return;
      }
      try {
        const currentGroup = await findGroupByToken(token);
        if (!currentGroup) throw new Error("No group found for this token.");
        const currentMembers = await listMembers(currentGroup.id);
        const currentMember = currentMembers.find((m) => m.id === memberId);
        if (!currentMember) throw new Error("Member not found in this group.");
        if (!active) return;
        setGroup(currentGroup);
        setMember(currentMember);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load member.");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [token, memberId]);

  useEffect(() => {
    if (!chart) return;
    const bounds = chartMonthDateBounds(chart);
    const today = toDateInputValue(new Date());
    const clamped = today < bounds.min ? bounds.min : today > bounds.max ? bounds.max : today;
    queueMicrotask(() => setSelectedDate(clamped));
  }, [chart]);

  useEffect(() => {
    if (!group || !chart) return;
    let active = true;
    setIsMonthLoading(true);
    setMeals([]);
    setCosts([]);
    setDeposits([]);

    Promise.all([
      getMealsForMonth(group.id, chart.monthKey),
      listCostsForChart(group.id, chart.id),
      listDepositsForChart(group.id, chart.id),
    ])
      .then(([monthMeals, monthCosts, monthDeposits]) => {
        if (!active) return;
        setMeals(monthMeals);
        setCosts(monthCosts);
        setDeposits(monthDeposits);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load month data.");
      })
      .finally(() => {
        if (active) setIsMonthLoading(false);
      });

    return () => { active = false; };
  }, [group, chart]);

  useEffect(() => {
    if (!group || !chart || !selectedDate) return;
    let active = true;
    setIsMealLoading(true);
    setSaved(false);
    getMealsForDate(group.id, selectedDate)
      .then((entries) => {
        if (!active) return;
        const current = entries.find((entry) => entry.memberId === memberId);
        setMealCount(current?.quantity ?? 0);
      })
      .catch(() => {
        if (!active) return;
        setMealCount(0);
      })
      .finally(() => {
        if (active) setIsMealLoading(false);
      });

    return () => { active = false; };
  }, [group, chart, selectedDate, memberId]);

  if (isLoading) return <p className="py-16 text-center text-sm text-[color:var(--soft-foreground)]">Loading member…</p>;
  if (error) {
    return (
      <div className="mt-8">
        <div className="alert-error">{error}</div>
        <GroupTokenMismatchHint message={error} />
      </div>
    );
  }
  if (!group || !member) return null;
  if (!chart) {
    return (
      <div className="py-6 grid gap-4">
        <div className="alert-warn">Select a month from Home first.</div>
        <button type="button" onClick={() => router.push(`/group/${token}`)} className="button-secondary w-full">
          ← Back to Home
        </button>
      </div>
    );
  }

  const monthStart = `${chart.monthKey}-01`;
  const monthEnd = `${chart.monthKey}-${String(daysInMonth(chart.year, chart.month)).padStart(2, "0")}`;
  const { mealRate } = getMonthTotals(meals, costs, deposits);
  const myDeposits = deposits.filter((deposit) => deposit.memberId === memberId);
  const memberTotals = getMemberTotals(memberId, meals, deposits, mealRate);
  const myMeals = memberTotals.memberMeals.sort((a, b) => a.date.localeCompare(b.date));
  const myTotalMeals = memberTotals.totalMeals;
  const myTotalPaid = memberTotals.totalPaid;
  const myCost = memberTotals.totalCost;
  const myBalance = memberTotals.balance;
  const maxQty = Math.max(...myMeals.map((meal) => meal.quantity), 1);
  const days = Array.from({ length: daysInMonth(chart.year, chart.month) }, (_, i) => {
    const day = i + 1;
    const date = `${chart.monthKey}-${String(day).padStart(2, "0")}`;
    const meal = myMeals.find((entry) => entry.date === date);
    return { day, date, qty: meal?.quantity ?? 0 };
  });

  async function handleMealChange(value: number) {
    if (!group || !selectedDate || !chart || chart.locked) return;
    const clamped = Math.max(0, value);
    setMealCount(clamped);
    setSaved(false);
    setIsSaving(true);
    try {
      await saveMealEntry({ groupId: group.id, memberId, date: selectedDate, quantity: clamped });
      setSaved(true);
      setMeals((prev) => {
        const others = prev.filter((entry) => !(entry.memberId === memberId && entry.date === selectedDate));
        return [...others, { id: `${memberId}_${selectedDate}`, memberId, date: selectedDate, quantity: clamped }];
      });
    } catch {
      setError("Failed to save meal entry.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-8">
      <div className="py-6 grid gap-4">
        <div className="group-hero">
          <div className="min-w-0">
            <p className="group-kicker">{group.name} · {chart.label}</p>
            <p className="group-title">{member.fullName}</p>
            <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">All information for selected month</p>
            {chart.locked && (
              <p className="mt-1 inline-flex rounded-full border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-2 py-0.5 text-xs font-semibold text-[color:var(--danger)]">
                Month locked: meal editing disabled
              </p>
            )}
          </div>
          <button type="button" onClick={() => router.push(`/group/${token}`)} className="button-secondary shrink-0">
            ← Back
          </button>
        </div>

        {isMonthLoading ? (
          <p className="py-10 text-center text-sm text-[color:var(--soft-foreground)]">Loading month data…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Total Meals", value: formatMeal(myTotalMeals) },
                { label: "Total Cost", value: `${myCost.toFixed(2)} tk` },
                { label: "Total Paid", value: `${myTotalPaid.toFixed(2)} tk` },
                { label: "Balance", value: `${myBalance.toFixed(2)} tk` },
              ].map((s) => (
                <div key={s.label} className="group-stat-card">
                  <p className="group-stat-label">{s.label}</p>
                  <p className="group-stat-value">{s.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[var(--radius)] border-2 border-[color:var(--accent)] bg-[color:var(--panel)] p-5 shadow-[0_0_0_4px_var(--accent-dim)]">
              <p className="group-kicker text-[color:var(--accent)]">Add Meal ({chart.label})</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[220px_1fr] sm:items-center">
                <input
                  type="date"
                  className="input"
                  min={monthStart}
                  max={monthEnd}
                  placeholder={toDateInputValue(new Date())}
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  disabled={chart.locked}
                />
                {isMealLoading ? (
                  <p className="text-sm text-[color:var(--soft-foreground)]">Loading meal…</p>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <button className="meal-stepper-button" disabled={mealCount <= 0 || chart.locked} onClick={() => handleMealChange(mealCount - 0.25)} type="button">−</button>
                      <span className="w-16 text-center text-4xl font-bold tabular-nums">{formatMeal(mealCount)}</span>
                      <button className="meal-stepper-button" disabled={chart.locked} onClick={() => handleMealChange(mealCount + 0.25)} type="button">+</button>
                    </div>
                    <p className="text-sm font-medium text-[color:var(--muted)]">
                      {chart.locked ? "Month is locked" : isSaving ? "Saving…" : saved ? "✓ Saved" : "Tap to update"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="group-card">
              <p className="group-kicker">Daily Meals — {chart.label}</p>
              <div className="mt-4 grid gap-1.5">
                {days.map(({ day, date, qty }) => (
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

            <div className="group-card">
              <p className="group-kicker">Meal Entries</p>
              <div className="mt-3 divide-y divide-[color:var(--border)]">
                {myMeals.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[color:var(--soft-foreground)]">No meals recorded.</p>
                ) : (
                  myMeals.map((meal) => (
                    <div key={`${meal.memberId}-${meal.date}`} className="flex items-center justify-between py-2.5">
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

            <div className="group-card">
              <p className="group-kicker">Paid History</p>
              <div className="mt-3 divide-y divide-[color:var(--border)]">
                {myDeposits.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[color:var(--soft-foreground)]">No paid entries recorded.</p>
                ) : (
                  myDeposits.map((deposit) => (
                    <div key={deposit.id} className="flex items-center justify-between py-2.5">
                      <p className="text-sm font-semibold">{deposit.date}</p>
                      <p className="font-bold text-[color:var(--accent)]">{deposit.amount.toFixed(2)} tk</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}