"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { useT } from "@/i18n/use-t";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { GroupMonthSelector } from "@/components/group/group-month-selector";
import { useGroupSession } from "@/lib/hooks/use-group-session";

import { memberDisplayName, memberIdsForMoneyRows } from "@/lib/utils/chart-members";
import { formatMeal, getMonthTotals, normalizeMealQuantity } from "@/lib/utils/meal-money";
import { Skeleton } from "@/components/ui/skeleton";
import { useCharts, useGroup, useMembers, useMealsForChart, useCosts, useDeposits } from "@/lib/hooks/use-data";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";
import { submitDepositRequest } from "@/lib/firebase/repositories";
import { chartMonthDateBounds, toDateInputValue } from "@/lib/utils/date";
import { useToast } from "@/lib/hooks/use-toast";
import { useAuthStore } from "@/store/auth-store";

export function GroupMoneyView({ groupId }: { groupId: string }) {
  const { t } = useT();
  const { chart, selectChart } = useGroupSession();
  const { admin: currentUser } = useAuthStore();
  const { mutate } = useSWRConfig();
  const { success: showSuccess, error: showError } = useToast();

  const { data: group, error: groupError, isLoading: groupLoading } = useGroup(isFirebaseConfigured ? groupId : undefined);
  const { data: charts = [] } = useCharts(group?.id);
  const activeChart = useMemo(() => {
    if (!chart) return null;
    return charts.find((monthChart) => monthChart.id === chart.id)
      ?? charts.find((monthChart) => monthChart.monthKey === chart.monthKey)
      ?? null;
  }, [chart, charts]);
  const { data: members = [] } = useMembers(group?.id);
  const { data: meals = [], isLoading: mealsLoading } = useMealsForChart(group?.id, activeChart || undefined);
  const { data: costs = [], isLoading: costsLoading } = useCosts(group?.id, activeChart?.id);
  const { data: deposits = [], isLoading: depositsLoading } = useDeposits(group?.id, activeChart?.id);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const signedInMember = useMemo(() => {
    const email = currentUser?.email?.trim().toLowerCase();
    if (!email) return null;
    return members.find((member) => member.email.trim().toLowerCase() === email) ?? null;
  }, [currentUser?.email, members]);

  const dataLoading = !!(activeChart && (mealsLoading || costsLoading || depositsLoading));
  useGlobalLoading(
    `group-money-view-${groupId}`,
    groupLoading || dataLoading || isSubmitting,
    isSubmitting ? t("groupMoney.requestSubmitting") : t("common.loading"),
  );

  useEffect(() => {
    if (!activeChart) return;
    if (chart && activeChart.id !== chart.id) {
      setTimeout(() => selectChart(activeChart), 0);
    }
    const { min, max } = chartMonthDateBounds(activeChart);
    setTimeout(() => {
      setDate((current) => (current < min || current > max ? min : current));
    }, 0);
  }, [activeChart, chart, selectChart]);

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

  if (!activeChart) {
    return (
      <GroupMonthSelector groupId={group.id} groupName={group.name} />
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
    memberMeals[mid] = (memberMeals[mid] ?? 0) + normalizeMealQuantity(m.quantity);
  });

  const memberDeposits: Record<string, number> = {};
  deposits.forEach((d) => {
    const mid = d.memberId.toLowerCase();
    memberDeposits[mid] = (memberDeposits[mid] ?? 0) + d.amount;
  });

  const grandTotal = Object.values(memberMeals).reduce((s, v) => s + v, 0);
  const { totalPaid, mealRate, remainingTaka: balance } = getMonthTotals(meals, costs, deposits);
  const balanceRowIds = memberIdsForMoneyRows(
    members,
    meals,
    deposits.map((d) => d.memberId),
    activeChart.monthKeys || [activeChart.monthKey],
  );
  const dateBounds = chartMonthDateBounds(activeChart);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!group || !activeChart || !currentUser?.email || !signedInMember) {
      setError(t("groupMoney.signInRequired"));
      return;
    }
    if (activeChart.locked) {
      setError(t("errors.monthLocked"));
      return;
    }

    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount === 0) {
      setError(t("errors.depositInvalid"));
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await submitDepositRequest({
        groupId: group.id,
        chartId: activeChart.id,
        memberId: signedInMember.id,
        memberName: signedInMember.fullName,
        requestedByEmail: currentUser.email,
        amount: parsedAmount,
        date,
      });
      setAmount("");
      showSuccess(t("toast.depositRequestSent"));
      await mutate(["depositRequests", group.id, activeChart.id]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("toast.genericError");
      setError(msg);
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="group-page-grid">
      <GroupMonthSelector groupId={group.id} groupName={group.name} />

      <div className="group-hero">
        <div className="min-w-0">
          <p className="group-kicker">{group.name}</p>
          <p className="group-title">{t("groupMoney.title")}</p>
          <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">{activeChart.label}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t("groupMoney.statTotalPaid"), value: `${totalPaid.toFixed(2)} ${tk}`, color: "var(--success-text)" },
          { label: t("groupMoney.statTotalMeals"), value: formatMeal(grandTotal) },
          { label: t("groupMoney.statMealRate"), value: `${mealRate.toFixed(2)} ${tk}`, color: "var(--success-text)" },
          { label: t("groupMoney.depositEntries"), value: String(deposits.length) },
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

      {error && <p className="alert-error">{error}</p>}

      <form className="group-card grid gap-4" onSubmit={handleSubmit}>
        <div>
          <p className="group-kicker">{t("groupMoney.requestTitle")}</p>
          {activeChart.locked && <p className="mt-1 text-xs font-semibold text-[color:var(--danger)]">{t("addMoney.monthLocked")}</p>}
          {!signedInMember && <p className="mt-1 text-xs font-semibold text-[color:var(--danger)]">{t("groupMoney.signInRequired")}</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">
            {t("admin.amountTk")}
            <input
              className="input"
              type="number"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="500"
              required
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("admin.date")}
            <input
              className="input"
              type="date"
              min={dateBounds.min}
              max={dateBounds.max}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
        </div>
        <button className="button-primary w-full sm:w-fit" type="submit" disabled={!signedInMember || isSubmitting || activeChart.locked}>
          {isSubmitting ? t("groupMoney.requestSubmitting") : t("groupMoney.requestSubmit")}
        </button>
      </form>

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
    </div>
  );
}
