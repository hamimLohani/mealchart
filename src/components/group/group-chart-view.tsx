"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/use-t";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import {
  getGroupById,
  getMealsForMonth,
  listCostsForChart,
  listDepositsForChart,
  listMembers,
} from "@/lib/firebase/repositories";
import { useGroupSession } from "@/lib/hooks/use-group-session";
import type { CostEntry, DepositEntry, Group, MealEntry, Member } from "@/types/domain";
import { GroupTokenMismatchHint } from "@/components/forms/group-token-mismatch-hint";
import { memberDisplayName, memberIdsForChartRows } from "@/lib/utils/chart-members";
import { daysInMonth } from "@/lib/utils/date";
import { formatMeal, getMonthTotals } from "@/lib/utils/meal-money";

export function GroupChartView({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { t, tx } = useT();
  const { chart } = useGroupSession();
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
      if (!isFirebaseConfigured) {
        setError(t("errors.firebaseNotConfiguredShort"));
        setIsLoading(false);
        return;
      }
      try {
        const g = await getGroupById(groupId);
        if (!g) throw new Error("Group not found.");
        if (!active) return;
        setGroup(g);
      } catch (e) {
        if (!active) return;
        setError(tx(e instanceof Error ? e.message : t("errors.genericLoad")));
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [t, tx, groupId]);

  useEffect(() => {
    if (!group || !chart) return;
    let active = true;

    Promise.all([
      listMembers(group.id),
      getMealsForMonth(group.id, chart.monthKey),
      listCostsForChart(group.id, chart.id),
      listDepositsForChart(group.id, chart.id),
    ])
      .then(([memberList, mealList, costList, depositList]) => {
        if (!active) return;
        setMembers(memberList);
        setMeals(mealList);
        setCosts(costList);
        setDeposits(depositList);
      })
      .catch((e) => {
        if (active) setError(tx(e instanceof Error ? e.message : t("errors.loadChartFailed")));
      });

    return () => {
      active = false;
    };
  }, [group, chart, t, tx]);

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-[color:var(--soft-foreground)]">{t("groupChart.loading")}</p>;
  }
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
            <p className="group-title">{t("groupChart.noMonthTitle")}</p>
            <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">{t("groupChart.noMonthBody")}</p>
          </div>
          <button type="button" onClick={() => router.push(`/group/${groupId}`)} className="button-secondary shrink-0">
            ← {t("groupNav.home")}
          </button>
        </div>
      </div>
    );
  }

  const totalDays = daysInMonth(chart.year, chart.month);
  const days = Array.from({ length: totalDays }, (_, i) => `${chart.monthKey}-${String(i + 1).padStart(2, "0")}`);

  const mealMap: Record<string, Record<string, number>> = {};
  meals.forEach((m) => {
    if (!mealMap[m.memberId]) mealMap[m.memberId] = {};
    mealMap[m.memberId][m.date] = m.quantity;
  });

  const rowMemberIds = memberIdsForChartRows(members, meals, chart.monthKey);
  const former = t("common.formerMember");
  const memberTotal = (id: string) => Object.values(mealMap[id] ?? {}).reduce((s, v) => s + v, 0);
  const grandTotal = meals.reduce((s, m) => s + m.quantity, 0);
  const { totalCost, totalPaid, mealRate, remainingTaka } = getMonthTotals(meals, costs, deposits);
  const totalMembers = rowMemberIds.length;
  const tk = t("common.tk");

  return (
    <div className="group-page-grid">
      <div className="group-hero">
        <div className="min-w-0">
          <p className="group-kicker">{group.name}</p>
          <p className="group-title">{t("groupChart.title")}</p>
          <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">{chart.label}</p>
          {chart.locked && (
            <p className="mt-1 inline-flex rounded-full border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-2 py-0.5 text-xs font-semibold text-[color:var(--danger)]">
              {t("memberPage.monthLocked")}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: t("groupChart.statTotalMeals"), value: formatMeal(grandTotal) },
          { label: t("groupChart.statTotalMembers"), value: String(totalMembers) },
          { label: t("groupChart.statTotalCost"), value: `${totalCost.toFixed(2)} ${tk}` },
          { label: t("groupChart.statTotalPaid"), value: `${totalPaid.toFixed(2)} ${tk}` },
          { label: t("groupChart.statRemaining"), value: `${remainingTaka.toFixed(2)} ${tk}` },
          { label: t("groupChart.statMealRate"), value: `${mealRate.toFixed(2)} ${tk}` },
        ].map((s) => (
          <div key={s.label} className="group-stat-card">
            <p className="group-stat-label">{s.label}</p>
            <p className="group-stat-value">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[color:var(--border)] shadow-[var(--shadow-sm)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[color:var(--panel)]">
              <th className="sticky left-0 z-10 min-w-[120px] bg-[color:var(--panel)] px-3 py-2.5 text-left text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--muted)]">
                {t("groupChart.colMember")}
              </th>
              {days.map((d) => (
                <th key={d} className="min-w-[36px] px-1 py-2.5 text-center text-xs font-semibold text-[color:var(--muted)]">{d.slice(8)}</th>
              ))}
              <th className="px-3 py-2.5 text-center text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--accent)]">
                {t("groupChart.colTotal")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rowMemberIds.map((memberId, ri) => (
              <tr key={memberId} className={ri % 2 === 0 ? "bg-[color:var(--background)]" : "bg-[color:var(--panel)]"}>
                <td className={`sticky left-0 z-10 px-3 py-2 text-sm font-medium ${ri % 2 === 0 ? "bg-[color:var(--background)]" : "bg-[color:var(--panel)]"}`}>
                  {memberDisplayName(memberId, members, former)}
                </td>
                {days.map((d) => (
                  <td key={d} className="px-1 py-2 text-center text-xs">
                    {mealMap[memberId]?.[d] ? formatMeal(mealMap[memberId][d]) : ""}
                  </td>
                ))}
                <td className="px-3 py-2 text-center text-sm font-bold text-[color:var(--accent)]">{formatMeal(memberTotal(memberId))}</td>
              </tr>
            ))}
            <tr className="border-t border-[color:var(--border)] bg-[color:var(--panel)]">
              <td className="sticky left-0 z-10 bg-[color:var(--panel)] px-3 py-2 text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--muted)]">
                {t("groupChart.rowTotal")}
              </td>
              {days.map((d) => {
                const s = rowMemberIds.reduce((sum, id) => sum + (mealMap[id]?.[d] ?? 0), 0);
                return <td key={d} className="px-1 py-2 text-center text-xs text-[color:var(--soft-foreground)]">{s ? formatMeal(s) : ""}</td>;
              })}
              <td className="px-3 py-2 text-center text-sm font-bold">{formatMeal(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
