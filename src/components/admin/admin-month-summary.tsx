"use client";

import { useT } from "@/i18n/use-t";
import { formatMeal, getMonthTotals } from "@/lib/utils/meal-money";
import { toMonthKey } from "@/lib/utils/date";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCharts,
  useMembers,
  useMealsForMonth,
  useCosts,
  useDeposits,
  useGroup
} from "@/lib/hooks/use-data";
import { useMemo } from "react";

export function AdminMonthSummary({ groupId }: { groupId: string }) {
  const { t } = useT();

  const { data: group } = useGroup(groupId);
  const { data: charts = [], isLoading: chartsLoading } = useCharts(groupId);
  const { data: members = [], isLoading: membersLoading } = useMembers(groupId);

  // Auto-detect active chart: group.currentChartId or the first from list
  const activeChart = useMemo(() => {
    if (!charts.length) return null;
    const currentChartId = group?.currentChartId;
    if (currentChartId) {
      const found = charts.find((c) => c.id === currentChartId);
      if (found) return found;
    }
    return charts[0]; // Most recent by monthKey desc
  }, [charts, group]);

  const { data: monthMeals = [], isLoading: mealsLoading } = useMealsForMonth(groupId, activeChart?.monthKey);
  const { data: monthCosts = [], isLoading: costsLoading } = useCosts(groupId, activeChart?.id);
  const { data: monthDeposits = [], isLoading: depositsLoading } = useDeposits(groupId, activeChart?.id);

  const isLoading = chartsLoading || membersLoading || mealsLoading || costsLoading || depositsLoading;

  const { totalMeals, totalCost, totalPaid, mealRate, remainingTaka } = useMemo(
    () => getMonthTotals(monthMeals, monthCosts, monthDeposits),
    [monthMeals, monthCosts, monthDeposits]
  );

  const isCurrentMonth = useMemo(() => {
    if (!activeChart) return false;
    const now = new Date();
    const currentMonthKey = toMonthKey(now.getFullYear(), now.getMonth() + 1);
    return activeChart.monthKey === currentMonthKey;
  }, [activeChart]);

  if (!activeChart && !isLoading) return null;

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-1">
         <div className="flex items-center gap-2">
           <p className="admin-section-label">{t("admin.month", { defaultValue: "Month" })}</p>
           {isCurrentMonth && <span className="badge-accent">{t("common.active")}</span>}
         </div>
         <h2 className="text-xl font-bold tracking-tight text-[color:var(--foreground)] sm:text-2xl">
           {activeChart?.label || "Summary"}
         </h2>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: t("groupDash.statTotalMeal"), value: formatMeal(totalMeals) },
            { label: t("groupDash.statTotalCost"), value: `${totalCost.toFixed(2)} ${t("common.tk")}` },
            { label: t("groupDash.statTotalPaid"), value: `${totalPaid.toFixed(2)} ${t("common.tk")}` },
            { label: t("groupDash.statMealRate"), value: `${mealRate.toFixed(2)} ${t("common.tk")}` },
            { label: t("groupDash.statRemaining"), value: `${remainingTaka.toFixed(2)} ${t("common.tk")}` },
            { label: t("groupDash.statMembers"), value: String(members.length) },
          ].map((s) => (
            <div key={s.label} className="group-stat-card">
              <p className="group-stat-label">{s.label}</p>
              <p className="group-stat-value">{s.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
