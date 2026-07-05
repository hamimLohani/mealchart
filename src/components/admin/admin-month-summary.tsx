"use client";

import { useT } from "@/i18n/use-t";
import { formatMeal, getMemberTotals, getMonthTotals } from "@/lib/utils/meal-money";
import { toMonthKey, pickCurrentMonthChart } from "@/lib/utils/date";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCharts,
  useMembers,
  useMealsForChart,
  useCosts,
  useDeposits,
  useGroup
} from "@/lib/hooks/use-data";
import { useMemo, useState } from "react";
import { useDebounce } from "@/lib/hooks/use-debounce";

export function AdminMonthSummary({ groupId }: { groupId: string }) {
  const { t } = useT();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data: group } = useGroup(groupId);
  const { data: charts = [], isLoading: chartsLoading } = useCharts(groupId);
  const { data: members = [], isLoading: membersLoading } = useMembers(groupId);

  // Auto-detect active chart: current month first, then group.currentChartId, then first in list
  const activeChart = useMemo(() => {
    if (!charts.length) return null;
    const currentActive = pickCurrentMonthChart(charts);
    if (currentActive) return currentActive;
    const currentChartId = group?.currentChartId;
    if (currentChartId) {
      const found = charts.find((c) => c.id === currentChartId);
      if (found) return found;
    }
    return charts[0]; // Most recent by monthKey desc
  }, [charts, group?.currentChartId]);

  const { data: monthMeals = [], isLoading: mealsLoading } = useMealsForChart(groupId, activeChart || undefined);
  const { data: monthCosts = [], isLoading: costsLoading } = useCosts(groupId, activeChart?.id);
  const { data: monthDeposits = [], isLoading: depositsLoading } = useDeposits(groupId, activeChart?.id);

  const isLoading = chartsLoading || membersLoading || mealsLoading || costsLoading || depositsLoading;

  const { totalMeals, totalCost, totalPaid, mealRate, remainingTaka } = useMemo(
    () => getMonthTotals(monthMeals, monthCosts, monthDeposits),
    [monthMeals, monthCosts, monthDeposits]
  );

  const filteredMembers = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter(m => m.fullName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }, [members, debouncedSearch]);

  const isCurrentMonth = useMemo(() => {
    if (!activeChart) return false;
    const now = new Date();
    const currentMonthKey = toMonthKey(now.getFullYear(), now.getMonth() + 1);
    return (activeChart.monthKeys || [activeChart.monthKey]).includes(currentMonthKey);
  }, [activeChart]);

  if (!activeChart && !isLoading) {
    return (
      <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-sm)]">
        <p className="text-center text-sm font-bold text-[color:var(--danger)]">
          {t("admin.noChartsMeals")}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
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
            ].map((s) => {
              const isMoney = s.label.includes(t("common.tk")) || s.value.includes(t("common.tk"));
              const isNegative = s.value.includes("-");
              const color = isMoney 
                ? (isNegative ? "var(--danger)" : "var(--success-text)")
                : undefined;

              return (
                <div key={s.label} className="group-stat-card">
                  <p className="group-stat-label">{s.label}</p>
                  <p className="group-stat-value" style={color ? { color } : {}}>{s.value}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid gap-3">
        <div className="flex items-center justify-end gap-3">
          <input
            className="input w-48 text-xs h-8 px-3 rounded-full"
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("groupDash.searchMembers")}
            value={search}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.length === 0 && debouncedSearch.trim() !== "" ? (
            <div className="col-span-full rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-6 text-center">
              <p className="text-sm text-[color:var(--muted)]">No members match your search</p>
            </div>
          ) : (
            filteredMembers.map((member) => {
              const mid = member.id.toLowerCase();
              const totals = getMemberTotals(mid, monthMeals, monthDeposits, mealRate);
              const paid = totals.totalPaid;
              const eaten = totals.totalCost;
              const balance = totals.balance;
              const mealsCount = totals.totalMeals;
              
              return (
                <div key={member.id} className="group-card !p-3">
                  <p className="font-bold text-sm border-b border-[color:var(--border)] pb-2 mb-2">{member.fullName}</p>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-[color:var(--muted)] tracking-wider">{t("admin.paid")}</span>
                      <span className="text-xs font-bold text-[color:var(--success-text)]">{paid.toFixed(2)} {t("common.tk")}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-[color:var(--muted)] tracking-wider">{t("admin.meals")}</span>
                      <span className="text-xs font-bold text-[color:var(--foreground)]">{formatMeal(mealsCount)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-[color:var(--muted)] tracking-wider">{t("admin.owed")}</span>
                      <span className="text-xs font-bold text-[color:var(--danger)]">{eaten.toFixed(2)} {t("common.tk")}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-[color:var(--muted)] tracking-wider">{t("groupDash.statRemaining")}</span>
                      <span className={`text-xs font-bold ${balance >= 0 ? "text-[color:var(--success-text)]" : "text-[color:var(--danger)]"}`}>
                        {balance.toFixed(2)} {t("common.tk")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
