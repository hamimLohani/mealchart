"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/i18n/use-t";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useGroupSession } from "@/lib/hooks/use-group-session";
import type { Group } from "@/types/domain";

import { memberDisplayName, memberIdsForMoneyRows } from "@/lib/utils/chart-members";
import { formatMeal, getMonthTotals } from "@/lib/utils/meal-money";
import { Skeleton } from "@/components/ui/skeleton";
import { useGroup, useMembers, useMealsForMonth, useCosts, useDeposits } from "@/lib/hooks/use-data";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";

export function GroupMoneyView({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { t } = useT();
  const { chart } = useGroupSession();

  const { data: group, error: groupError, isLoading: groupLoading } = useGroup(isFirebaseConfigured ? groupId : undefined);
  const { data: members = [] } = useMembers(group?.id);
  const { data: meals = [], isLoading: mealsLoading } = useMealsForMonth(group?.id, chart?.monthKey);
  const { data: costs = [], isLoading: costsLoading } = useCosts(group?.id, chart?.id);
  const { data: deposits = [], isLoading: depositsLoading } = useDeposits(group?.id, chart?.id);

  const dataLoading = !!(chart && (mealsLoading || costsLoading || depositsLoading));
  useGlobalLoading(
    `group-money-view-${groupId}`,
    groupLoading || dataLoading,
    groupLoading ? t("common.loading") : t("common.loading"),
  );

  const tk = t("common.tk");
  const former = t("common.formerMember");

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
      <div className="group-page-grid">
        <div className="group-hero">
          <div className="min-w-0">
            <p className="group-kicker">{(group as Group).name}</p>
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

  if (dataLoading) {
    return (
      <div className="group-page-grid py-8">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  const memberMeals: Record<string, number> = {};
  meals.forEach((m) => {
    const mid = m.memberId.toLowerCase();
    memberMeals[mid] = (memberMeals[mid] ?? 0) + m.quantity;
  });

  const memberDeposits: Record<string, number> = {};
  deposits.forEach((d) => {
    const mid = d.memberId.toLowerCase();
    memberDeposits[mid] = (memberDeposits[mid] ?? 0) + d.amount;
  });

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
          <p className="group-title">{t("groupMoney.title")}</p>
          <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">{chart.label}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t("groupMoney.statTotalCost"), value: `${totalCost.toFixed(2)} ${tk}`, color: "var(--success-text)" },
          { label: t("groupMoney.statTotalPaid"), value: `${totalPaid.toFixed(2)} ${tk}`, color: "var(--success-text)" },
          { label: t("groupMoney.statTotalMeals"), value: formatMeal(grandTotal) },
          { label: t("groupMoney.statMealRate"), value: `${mealRate.toFixed(2)} ${tk}`, color: "var(--success-text)" },
        ].map((s) => (
          <div key={s.label} className="group-stat-card">
            <p className="group-stat-label">{s.label}</p>
            <p className="group-stat-value" style={s.color ? { color: s.color } : {}}>{s.value}</p>
          </div>
        ))}
      </div>

      <div
        className={`rounded-[var(--radius-sm)] border px-3 py-2.5 ${balance >= 0 ? "border-[color:var(--success-border)] bg-[color:var(--success-bg)]" : "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)]"}`}
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
          {t("groupMoney.groupBalance")}
        </p>
        <p
          className={`mt-1 text-xl font-bold ${balance >= 0 ? "text-[color:var(--success-text)]" : "text-[color:var(--danger)]"}`}
        >
          {balance >= 0 ? "+" : ""}
          {balance.toFixed(2)} ${tk}
        </p>
        <p className="mt-0.5 text-xs text-[color:var(--muted)]">
          {balance >= 0 ? t("groupMoney.surplus") : t("groupMoney.deficit")}
        </p>
      </div>

      <div className="group-card">
        <p className="group-kicker">{t("groupMoney.memberBalances")}</p>
        <div className="mt-3 grid gap-2">
          {balanceRowIds.map((memberId) => {
            const eaten = (memberMeals[memberId] ?? 0) * mealRate;
            const paid = memberDeposits[memberId] ?? 0;
            const remaining = paid - eaten;
            const detail = t("groupMoney.balanceDetail", {
              meals: formatMeal(memberMeals[memberId] ?? 0),
              eaten: eaten.toFixed(2),
              paid: paid.toFixed(2),
              currency: tk,
            });
            return (
              <div
                key={memberId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{memberDisplayName(memberId, members, former)}</p>
                  <p 
                    className="group-stat-label"
                    style={{ color: remaining >= 0 ? "var(--success-text)" : "var(--danger)", opacity: 0.8 }}
                  >
                    {detail}
                  </p>
                </div>
                <p
                  className="shrink-0 font-bold"
                  style={{ color: remaining >= 0 ? "var(--success-text)" : "var(--danger)" }}
                >
                  {remaining >= 0 ? "+" : ""}
                  {remaining.toFixed(2)} ${tk}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="group-card">
        <p className="group-kicker">{t("groupMoney.deposits")}</p>
        <div className="mt-3 grid gap-2">
          {deposits.length === 0 && (
            <p className="py-4 text-center text-sm text-[color:var(--soft-foreground)]">{t("groupMoney.noDeposits")}</p>
          )}
          {deposits.map((d) => {
            const member = members.find((m) => m.id.toLowerCase() === d.memberId.toLowerCase());
            return (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-semibold">{member?.fullName ?? t("common.unknown")}</p>
                  <p className="group-stat-label">{d.date}</p>
                </div>
                <p 
                  className="font-bold"
                  style={{ color: d.amount >= 0 ? "var(--success-text)" : "var(--danger)" }}
                >
                  {d.amount >= 0 ? "+" : ""}{d.amount.toFixed(2)} ${tk}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="group-card">
        <p className="group-kicker">{t("groupMoney.costHistory")}</p>
        <div className="mt-3 grid gap-2">
          {costs.length === 0 && (
            <p className="py-4 text-center text-sm text-[color:var(--soft-foreground)]">{t("groupMoney.noCosts")}</p>
          )}
          {costs.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-semibold">{c.itemName}</p>
                <p className="group-stat-label">{c.date}</p>
              </div>
              <p 
                className="font-bold"
                style={{ color: c.amount >= 0 ? "var(--success-text)" : "var(--danger)" }}
              >
                {c.amount.toFixed(2)} ${tk}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
