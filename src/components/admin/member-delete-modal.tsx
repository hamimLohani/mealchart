"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/i18n/use-t";
import {
  listCharts,
  getMealsForChart,
  listCostsForChart,
  listDepositsForChart,
} from "@/lib/firebase/repositories";
import {
  getMonthTotals,
  getMemberTotals,
  formatMeal,
  normalizeMealQuantity,
} from "@/lib/utils/meal-money";
import {
  chartMonthDateBounds,
  pickCurrentMonthChart,
  toDateInputValue,
} from "@/lib/utils/date";
import { Skeleton } from "@/components/ui/skeleton";
import type { Chart, CostEntry, DepositEntry, MealEntry, Member } from "@/types/domain";

export type MemberDeleteSettlement =
  | { mode: "keep_records"; chartId?: string }
  | { mode: "refund"; amount: number; chartId: string; date: string }
  | { mode: "settle_due"; amount: number; chartId: string; date: string }
  | { mode: "delete_deposits"; chartId: string };

type MemberDeleteModalProps = {
  open: boolean;
  member: Member | null;
  groupId: string;
  onCancel: () => void;
  onConfirm: (settlement: MemberDeleteSettlement) => Promise<void>;
  isProcessing: boolean;
};

export function MemberDeleteModal({
  open,
  member,
  groupId,
  onCancel,
  onConfirm,
  isProcessing,
}: MemberDeleteModalProps) {
  const { t } = useT();

  const [charts, setCharts] = useState<Chart[]>([]);
  const [selectedChartId, setSelectedChartId] = useState<string>("");
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [deposits, setDeposits] = useState<DepositEntry[]>([]);
  const [isLoadingCharts, setIsLoadingCharts] = useState(false);
  const [isLoadingChartData, setIsLoadingChartData] = useState(false);

  // Settlement choice
  const [settlementMode, setSettlementMode] = useState<"settle_balance" | "keep_records" | "delete_deposits">("settle_balance");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  // Load charts when modal opens
  useEffect(() => {
    if (!open || !groupId) return;
    let active = true;

    async function fetchCharts() {
      setIsLoadingCharts(true);
      try {
        const loadedCharts = await listCharts(groupId);
        if (!active) return;
        setCharts(loadedCharts);
        const activeChart = pickCurrentMonthChart(loadedCharts) || loadedCharts[0];
        if (activeChart) {
          setSelectedChartId(activeChart.id);
        }
      } catch (err) {
        console.error("Failed to load charts:", err);
      } finally {
        if (active) setIsLoadingCharts(false);
      }
    }

    void fetchCharts();

    return () => {
      active = false;
    };
  }, [open, groupId]);

  // Selected chart object
  const selectedChart = useMemo(
    () => charts.find((c) => c.id === selectedChartId) || null,
    [charts, selectedChartId]
  );

  // Load meals, costs, deposits when selectedChart changes
  useEffect(() => {
    if (!open || !groupId || !selectedChart) return;
    const chart = selectedChart;
    let active = true;

    async function loadData() {
      setIsLoadingChartData(true);
      try {
        const [loadedMeals, loadedCosts, loadedDeposits] = await Promise.all([
          getMealsForChart(groupId, chart),
          listCostsForChart(groupId, chart.id),
          listDepositsForChart(groupId, chart.id),
        ]);
        if (!active) return;
        setMeals(loadedMeals);
        setCosts(loadedCosts);
        setDeposits(loadedDeposits);
      } catch (err) {
        console.error("Failed to load chart financial data:", err);
      } finally {
        if (active) setIsLoadingChartData(false);
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [open, groupId, selectedChart]);

  // Calculations for member
  const memberFinances = useMemo(() => {
    if (!member) {
      return { totalDeposits: 0, totalMeals: 0, mealCost: 0, balance: 0, mealRate: 0, depositCount: 0 };
    }

    const { mealRate } = getMonthTotals(meals, costs, deposits);
    const totals = getMemberTotals(member.id, meals, deposits, mealRate);
    const mid = member.id.toLowerCase();
    const memberDeposits = deposits.filter((d) => d.memberId.toLowerCase() === mid);

    return {
      totalDeposits: totals.totalPaid,
      totalMeals: totals.totalMeals,
      mealCost: totals.totalCost,
      balance: totals.balance,
      mealRate,
      depositCount: memberDeposits.length,
    };
  }, [member, meals, costs, deposits]);

  // Set default amount when financial data finishes loading
  useEffect(() => {
    if (memberFinances.balance > 0.01) {
      setCustomAmount(memberFinances.balance.toFixed(2));
      setSettlementMode("settle_balance");
    } else if (memberFinances.balance < -0.01) {
      setCustomAmount(Math.abs(memberFinances.balance).toFixed(2));
      setSettlementMode("settle_balance");
    } else {
      setCustomAmount("0.00");
      setSettlementMode("keep_records");
    }
  }, [memberFinances.balance]);

  if (!open || !member) return null;

  const isLocked = selectedChart?.locked === true;
  const isBalanceRefundable = memberFinances.balance > 0.01;
  const isBalanceDue = memberFinances.balance < -0.01;
  const isBalanceZero = !isBalanceRefundable && !isBalanceDue;

  async function handleConfirm() {
    setFormError(null);

    if (!selectedChart) {
      // No chart exists; just delete member keeping records
      await onConfirm({ mode: "keep_records" });
      return;
    }

    if (isLocked || settlementMode === "keep_records") {
      await onConfirm({ mode: "keep_records", chartId: selectedChart.id });
      return;
    }

    if (settlementMode === "delete_deposits") {
      await onConfirm({ mode: "delete_deposits", chartId: selectedChart.id });
      return;
    }

    if (settlementMode === "settle_balance") {
      if (isBalanceZero) {
        await onConfirm({ mode: "keep_records", chartId: selectedChart.id });
        return;
      }

      const parsedAmount = parseFloat(customAmount);
      if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        setFormError(t("errors.depositInvalid"));
        return;
      }

      const bounds = chartMonthDateBounds(selectedChart);
      const today = toDateInputValue(new Date());
      const settlementDate = today >= bounds.min && today <= bounds.max ? today : bounds.max;

      if (isBalanceRefundable) {
        // Refund: deducts money from group deposits
        await onConfirm({
          mode: "refund",
          amount: parsedAmount,
          chartId: selectedChart.id,
          date: settlementDate,
        });
      } else {
        // Settle due: adds money to group deposits
        await onConfirm({
          mode: "settle_due",
          amount: parsedAmount,
          chartId: selectedChart.id,
          date: settlementDate,
        });
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] p-6 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[color:var(--border)] pb-4">
          <div>
            <h3 className="text-lg font-bold text-[color:var(--foreground)]">
              {t("memberMgr.deleteModalTitle")}
            </h3>
            <p className="mt-0.5 text-xs text-[color:var(--muted)]">
              {t("memberMgr.deleteModalSubtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="rounded-full p-1.5 text-[color:var(--muted)] hover:bg-[color:var(--hover-bg)] hover:text-[color:var(--foreground)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Member & Month Selector */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)]/50 p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--accent)] font-bold text-white shadow-sm">
              {member.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-[color:var(--foreground)] leading-tight">
                {member.fullName}
              </p>
              <p className="text-xs text-[color:var(--muted)]">{member.email}</p>
            </div>
          </div>

          {charts.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[color:var(--muted)]">
                {t("memberMgr.selectChartLabel")}:
              </span>
              <select
                className="input h-8 text-xs py-1 px-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--panel)]"
                value={selectedChartId}
                onChange={(e) => setSelectedChartId(e.target.value)}
                disabled={isProcessing || isLoadingChartData}
              >
                {charts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} {c.locked ? "🔒" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Financial Summary */}
        <div className="mt-4">
          {isLoadingCharts || isLoadingChartData ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : !selectedChart ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
              {t("memberMgr.noChartsFound")}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--panel)] p-2.5 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                  {t("memberMgr.statDeposited")}
                </span>
                <p className="mt-1 text-sm font-extrabold text-[color:var(--foreground)]">
                  ৳{memberFinances.totalDeposits.toFixed(2)}
                </p>
              </div>

              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--panel)] p-2.5 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                  {t("memberMgr.statMeals")}
                </span>
                <p className="mt-1 text-sm font-extrabold text-[color:var(--foreground)]">
                  {formatMeal(memberFinances.totalMeals)}
                </p>
              </div>

              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--panel)] p-2.5 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                  {t("memberMgr.statMealCost")}
                </span>
                <p className="mt-1 text-sm font-extrabold text-[color:var(--foreground)]">
                  ৳{memberFinances.mealCost.toFixed(2)}
                </p>
              </div>

              <div
                className={`rounded-xl border p-2.5 text-center transition-all ${
                  isBalanceRefundable
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : isBalanceDue
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    : "border-[color:var(--border)] bg-[color:var(--panel)] text-[color:var(--muted)]"
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {t("memberMgr.statNetBalance")}
                </span>
                <p className="mt-1 text-sm font-extrabold">
                  {isBalanceRefundable && "+"}
                  ৳{memberFinances.balance.toFixed(2)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Locked Chart Warning */}
        {isLocked && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            🔒 {t("memberMgr.chartLockedNotice", { chart: selectedChart.label })}
          </div>
        )}

        {/* Settlement Choices (Only if chart exists and not locked) */}
        {selectedChart && !isLocked && (
          <div className="mt-4 space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]">
              {t("memberMgr.settlementTitle")}
            </label>

            {/* Option 1: Settle / Refund Balance */}
            <div
              onClick={() => setSettlementMode("settle_balance")}
              className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                settlementMode === "settle_balance"
                  ? "border-[color:var(--accent)] bg-[color:var(--accent)]/5 shadow-sm"
                  : "border-[color:var(--border)] bg-[color:var(--panel)] hover:border-[color:var(--accent)]/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  id="opt-settle"
                  name="settlement"
                  checked={settlementMode === "settle_balance"}
                  onChange={() => setSettlementMode("settle_balance")}
                  className="mt-1 text-[color:var(--accent)]"
                  disabled={isProcessing}
                />
                <div className="flex-1">
                  <label htmlFor="opt-settle" className="cursor-pointer text-xs font-bold text-[color:var(--foreground)]">
                    {isBalanceRefundable
                      ? t("memberMgr.optRefundTitle")
                      : isBalanceDue
                      ? t("memberMgr.optSettleDueTitle")
                      : t("memberMgr.optAlreadySettledTitle")}
                  </label>
                  <p className="mt-0.5 text-xs text-[color:var(--muted)] leading-relaxed">
                    {isBalanceRefundable
                      ? t("memberMgr.optRefundDesc", { amount: `৳${customAmount || memberFinances.balance.toFixed(2)}` })
                      : isBalanceDue
                      ? t("memberMgr.optSettleDueDesc", { amount: `৳${customAmount || Math.abs(memberFinances.balance).toFixed(2)}` })
                      : t("memberMgr.optAlreadySettledDesc")}
                  </p>

                  {/* Input for custom settlement amount when balance is not zero */}
                  {settlementMode === "settle_balance" && !isBalanceZero && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[color:var(--muted)]">৳</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          placeholder="0.00"
                          disabled={isProcessing}
                          className="input h-9 w-full pl-7 pr-3 text-xs font-semibold rounded-lg border border-[color:var(--border)] bg-[color:var(--panel)]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setCustomAmount(
                            isBalanceRefundable
                              ? memberFinances.balance.toFixed(2)
                              : Math.abs(memberFinances.balance).toFixed(2)
                          )
                        }
                        className="rounded-lg border border-[color:var(--border)] bg-[color:var(--hover-bg)] px-2.5 py-2 text-[11px] font-semibold text-[color:var(--foreground)] hover:bg-[color:var(--accent)]/10"
                      >
                        {t("memberMgr.quickFullBalance")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Option 2: Keep records as Former Member */}
            <div
              onClick={() => setSettlementMode("keep_records")}
              className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                settlementMode === "keep_records"
                  ? "border-[color:var(--accent)] bg-[color:var(--accent)]/5 shadow-sm"
                  : "border-[color:var(--border)] bg-[color:var(--panel)] hover:border-[color:var(--accent)]/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  id="opt-keep"
                  name="settlement"
                  checked={settlementMode === "keep_records"}
                  onChange={() => setSettlementMode("keep_records")}
                  className="mt-1 text-[color:var(--accent)]"
                  disabled={isProcessing}
                />
                <div className="flex-1">
                  <label htmlFor="opt-keep" className="cursor-pointer text-xs font-bold text-[color:var(--foreground)]">
                    {t("memberMgr.optKeepTitle")}
                  </label>
                  <p className="mt-0.5 text-xs text-[color:var(--muted)] leading-relaxed">
                    {t("memberMgr.optKeepDesc")}
                  </p>
                </div>
              </div>
            </div>

            {/* Option 3: Delete all deposit entries */}
            {memberFinances.depositCount > 0 && (
              <div
                onClick={() => setSettlementMode("delete_deposits")}
                className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                  settlementMode === "delete_deposits"
                    ? "border-rose-500/60 bg-rose-500/5 shadow-sm"
                    : "border-[color:var(--border)] bg-[color:var(--panel)] hover:border-rose-500/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    id="opt-delete-deposits"
                    name="settlement"
                    checked={settlementMode === "delete_deposits"}
                    onChange={() => setSettlementMode("delete_deposits")}
                    className="mt-1 text-rose-500"
                    disabled={isProcessing}
                  />
                  <div className="flex-1">
                    <label htmlFor="opt-delete-deposits" className="cursor-pointer text-xs font-bold text-rose-600 dark:text-rose-400">
                      {t("memberMgr.optDeleteDepositsTitle")}
                    </label>
                    <p className="mt-0.5 text-xs text-[color:var(--muted)] leading-relaxed">
                      {t("memberMgr.optDeleteDepositsDesc", {
                        count: String(memberFinances.depositCount),
                        amount: `৳${memberFinances.totalDeposits.toFixed(2)}`,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error notification */}
        {formError && (
          <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs font-medium text-rose-600 dark:text-rose-400">
            {formError}
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-[color:var(--border)] pt-4">
          <button
            type="button"
            className="button-secondary text-xs"
            onClick={onCancel}
            disabled={isProcessing}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="button-danger text-xs font-bold"
            onClick={handleConfirm}
            disabled={isProcessing || isLoadingCharts || isLoadingChartData}
          >
            {isProcessing ? t("memberMgr.settlingAndRemoving") : t("memberMgr.confirmDeleteBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
