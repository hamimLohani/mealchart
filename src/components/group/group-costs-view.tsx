"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { GroupMonthSelector } from "@/components/group/group-month-selector";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/i18n/use-t";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { submitCostRequest } from "@/lib/firebase/repositories";
import { useGroupSession } from "@/lib/hooks/use-group-session";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";
import { useToast } from "@/lib/hooks/use-toast";
import { useCharts, useCosts, useGroup, useMembers } from "@/lib/hooks/use-data";
import { chartMonthDateBounds, toDateInputValue } from "@/lib/utils/date";
import { useAuthStore } from "@/store/auth-store";

function parseAmountInput(value: string, messages: { invalidCharacters: string; invalidFormula: string }) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { value: null as number | null, isValid: false, isFormula: false, message: "" };
  }

  const expression = trimmed.startsWith("=") ? trimmed.slice(1).trim() : trimmed;
  const isFormula = trimmed.startsWith("=") || /[+\-*/()]/.test(expression);

  if (!expression) {
    return { value: null as number | null, isValid: false, isFormula: false, message: "" };
  }

  const numericPattern = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
  if (numericPattern.test(expression)) {
    const numericValue = Number(expression);
    return {
      value: Number.isFinite(numericValue) ? numericValue : null,
      isValid: Number.isFinite(numericValue),
      isFormula: false,
      message: "",
    };
  }

  if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
    return {
      value: null as number | null,
      isValid: false,
      isFormula: true,
      message: messages.invalidCharacters,
    };
  }

  try {
    const result = Function(`"use strict"; return (${expression});`)();
    if (!Number.isFinite(result)) {
      throw new Error("Invalid expression");
    }
    return { value: Number(result), isValid: true, isFormula, message: "" };
  } catch {
    return {
      value: null as number | null,
      isValid: false,
      isFormula: true,
      message: messages.invalidFormula,
    };
  }
}

export function GroupCostsView({ groupId }: { groupId: string }) {
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
  const { data: costs = [], isLoading: costsLoading } = useCosts(group?.id, activeChart?.id);

  const [itemName, setItemName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const member = useMemo(() => {
    const email = currentUser?.email?.trim().toLowerCase();
    if (!email) return null;
    return members.find((m) => m.email.trim().toLowerCase() === email) ?? null;
  }, [currentUser?.email, members]);

  const dataLoading = !!(activeChart && costsLoading);
  useGlobalLoading(
    `group-costs-view-${groupId}`,
    groupLoading || dataLoading || isSubmitting,
    isSubmitting ? t("groupCosts.submitting") : t("common.loading"),
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
    return <div className="mt-8"><div className="alert-error">{msg}</div></div>;
  }

  if (!group) return null;

  if (!activeChart) {
    return <GroupMonthSelector groupId={group.id} groupName={group.name} />;
  }

  const tk = t("common.tk");
  const totalCost = costs.reduce((sum, cost) => sum + cost.amount, 0);
  const dateBounds = chartMonthDateBounds(activeChart);
  const parsedAmountInput = parseAmountInput(amount, {
    invalidCharacters: t("costs.amountHintInvalidCharacters"),
    invalidFormula: t("costs.amountHintInvalidFormula"),
  });
  const amountLabelStatus = !amount.trim()
    ? ""
    : parsedAmountInput.isValid && parsedAmountInput.value !== null
      ? `= ${parsedAmountInput.value.toFixed(2)} ${tk}`
      : "ERROR";
  const amountHintClassName = !amount.trim()
    ? "text-xs text-[color:var(--muted)]"
    : parsedAmountInput.isValid
      ? "text-xs text-[color:var(--success-text)]"
      : "text-xs text-[color:var(--danger)]";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!group || !activeChart || !currentUser?.email || !member) {
      setError(t("groupCosts.signInRequired"));
      return;
    }
    if (activeChart.locked) {
      setError(t("errors.monthLocked"));
      return;
    }

    const parsedAmount = parseAmountInput(amount, {
      invalidCharacters: t("costs.amountHintInvalidCharacters"),
      invalidFormula: t("costs.amountHintInvalidFormula"),
    });
    if (!itemName.trim() || !parsedAmount.isValid || parsedAmount.value === null || parsedAmount.value <= 0) {
      setError(parsedAmount.message || t("errors.costInvalid"));
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await submitCostRequest({
        groupId: group.id,
        chartId: activeChart.id,
        itemName: itemName.trim(),
        amount: parsedAmount.value,
        date,
        memberId: member.id,
        memberName: member.fullName,
        requestedByEmail: currentUser.email,
      });
      setItemName("");
      setAmount("");
      showSuccess(t("toast.costRequestSent"));
      await mutate(["costRequests", group.id, activeChart.id]);
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
          <p className="group-title">{t("groupCosts.title")}</p>
          <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">{activeChart.label}</p>
        </div>
      </div>

      {error && <p className="alert-error">{error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="group-stat-card">
          <p className="group-stat-label">{t("groupCosts.totalApproved")}</p>
          <p className="group-stat-value" style={{ color: "var(--success-text)" }}>{totalCost.toFixed(2)} {tk}</p>
        </div>
        <div className="group-stat-card">
          <p className="group-stat-label">{t("costs.entries")}</p>
          <p className="group-stat-value">{costs.length}</p>
        </div>
        <div className="group-stat-card col-span-2 sm:col-span-1">
          <p className="group-stat-label">{t("addMoney.statMonth")}</p>
          <p className="group-stat-value">{activeChart.monthKey}</p>
        </div>
      </div>

      <form className="group-card grid gap-4" onSubmit={handleSubmit}>
        <div>
          <p className="group-kicker">{t("groupCosts.requestTitle")}</p>
          {activeChart.locked && <p className="mt-1 text-xs font-semibold text-[color:var(--danger)]">{t("costs.monthLockedNoEdit")}</p>}
          {!member && <p className="mt-1 text-xs font-semibold text-[color:var(--danger)]">{t("groupCosts.signInRequired")}</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-medium">
            {t("admin.itemName")}
            <input className="input" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder={t("costs.placeholderItem")} required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span className={amountHintClassName}>
              {amountLabelStatus
                ? `${t("admin.amountTk")} ${amountLabelStatus}`
                : t("admin.amountTk")}
            </span>
            <input
              className="input"
              type="text"
              inputMode="text"
              autoCorrect="off"
              autoComplete="off"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="250 or =122+1243+1234"
              required
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("admin.date")}
            <input className="input" type="date" min={dateBounds.min} max={dateBounds.max} value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
        </div>
        <button className="button-primary w-full sm:w-fit" type="submit" disabled={!member || isSubmitting || activeChart.locked}>
          {isSubmitting ? t("groupCosts.submitting") : t("groupCosts.submit")}
        </button>
      </form>

      <div className="group-card">
        <p className="group-kicker">{t("groupCosts.approvedHistory")}</p>
        <div className="mt-3 grid gap-2">
          {dataLoading && <Skeleton className="h-20 w-full" />}
          {!dataLoading && costs.length === 0 && (
            <p className="py-4 text-center text-sm text-[color:var(--soft-foreground)]">{t("groupMoney.noCosts")}</p>
          )}
          {!dataLoading && costs.map((cost) => (
            <div
              key={cost.id}
              className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-semibold">{cost.itemName}</p>
                <p className="group-stat-label">{cost.date}</p>
              </div>
              <p className="font-bold text-[color:var(--success-text)]">{cost.amount.toFixed(2)} {tk}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
