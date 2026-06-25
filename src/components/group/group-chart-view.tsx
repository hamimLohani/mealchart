"use client";

import { useT } from "@/i18n/use-t";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { GroupMonthSelector } from "@/components/group/group-month-selector";
import { useGroupSession } from "@/lib/hooks/use-group-session";

import { memberDisplayName, memberIdsForChartRows } from "@/lib/utils/chart-members";
import { getChartDates, formatHeaderDate } from "@/lib/utils/date";
import { formatMeal, getMonthTotals, normalizeMealQuantity } from "@/lib/utils/meal-money";
import { Skeleton } from "@/components/ui/skeleton";
import { useGroup, useMembers, useMealsForChart, useCosts, useDeposits } from "@/lib/hooks/use-data";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";

export function GroupChartView({ groupId }: { groupId: string }) {
  const { t, language } = useT();
  const { chart } = useGroupSession();

  const { data: group, error: groupError, isLoading: groupLoading } = useGroup(isFirebaseConfigured ? groupId : undefined);
  const { data: members = [] } = useMembers(group?.id);
  const { data: meals = [], isLoading: mealsLoading } = useMealsForChart(group?.id, chart || undefined);
  const { data: costs = [] } = useCosts(group?.id, chart?.id);
  const { data: deposits = [] } = useDeposits(group?.id, chart?.id);

  const dataLoading = !!(chart && mealsLoading);
  useGlobalLoading(
    `group-chart-view-${groupId}`,
    groupLoading || dataLoading,
    groupLoading ? t("groupChart.loading") : t("groupChart.loading"),
  );

  if (groupLoading) {
    return (
      <div className="group-page-grid py-16">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (groupError) {
    const msg = groupError instanceof Error ? groupError.message : t("errors.genericLoad");
    return (
      <div className="mt-8">
        <div className="alert-error">{msg}</div>
      </div>
    );
  }
  if (!group) return null;

  if (!chart) {
    return (
      <GroupMonthSelector groupId={group.id} groupName={group.name} />
    );
  }

  if (dataLoading) {
    return (
      <div className="group-page-grid py-8">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const days = getChartDates(chart.monthKeys || [chart.monthKey]);

  const mealMap: Record<string, Record<string, number>> = {};
  meals.forEach((m) => {
    const mid = m.memberId.toLowerCase();
    if (!mealMap[mid]) mealMap[mid] = {};
    mealMap[mid][m.date] = normalizeMealQuantity(m.quantity);
  });

  const rowMemberIds = memberIdsForChartRows(members, meals, chart.monthKeys || [chart.monthKey]);
  const former = t("common.formerMember");
  const memberTotal = (id: string) => days.reduce((sum, d) => sum + (mealMap[id]?.[d] ?? 0), 0);
  const { totalMeals: grandTotal, totalCost, totalPaid, mealRate, remainingTaka } = getMonthTotals(meals, costs, deposits);
  const totalMembers = rowMemberIds.length;
  const tk = t("common.tk");

  return (
    <div className="group-page-grid">
      <GroupMonthSelector groupId={group.id} groupName={group.name} />

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
          { label: t("groupChart.statTotalCost"), value: `${totalCost.toFixed(2)} ${tk}`, color: "var(--success-text)" },
          { label: t("groupChart.statTotalPaid"), value: `${totalPaid.toFixed(2)} ${tk}`, color: "var(--success-text)" },
          { 
            label: t("groupChart.statRemaining"), 
            value: `${remainingTaka.toFixed(2)} ${tk}`,
            color: remainingTaka >= 0 ? "var(--success-text)" : "var(--danger)"
          },
          { label: t("groupChart.statMealRate"), value: `${mealRate.toFixed(2)} ${tk}`, color: "var(--success-text)" },
        ].map((s) => (
          <div key={s.label} className="group-stat-card">
            <p className="group-stat-label">{s.label}</p>
            <p className="group-stat-value" style={s.color ? { color: s.color } : {}}>{s.value}</p>
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
                <th key={d} className="min-w-[36px] px-1 py-2.5 text-center text-xs font-semibold text-[color:var(--muted)]">{formatHeaderDate(d, language)}</th>
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
