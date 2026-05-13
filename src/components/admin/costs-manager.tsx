"use client";

import { FormEvent, useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useT } from "@/i18n/use-t";
import {
  createCost,
  deleteCost,
  listCharts,
  listCostsForChart,
  listDepositsForChart,
} from "@/lib/firebase/repositories";
import { chartMonthDateBounds, toDateInputValue } from "@/lib/utils/date";
import { getMonthTotals } from "@/lib/utils/meal-money";
import type { AdminProfile, Chart, CostEntry, DepositEntry } from "@/types/domain";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";
import { AdminLoadingState } from "@/components/admin/admin-loading-state";
import { useCurrentAdminProfile } from "@/lib/hooks/use-current-admin-profile";

export function CostsManager() {
  const { t, tx } = useT();
  const configError = !isFirebaseConfigured || !auth ? "Firebase is not configured yet." : null;

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [error, setError] = useState<string | null>(configError);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedChart, setSelectedChart] = useState<Chart | null>(null);
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [deposits, setDeposits] = useState<DepositEntry[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [itemName, setItemName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { adminProfile: currentAdminProfile, isLoading: profileLoading, error: profileError } = useCurrentAdminProfile();
  const resolvedError =
    error ??
    (profileError
      ? profileError instanceof Error
        ? profileError.message
        : "Failed to load data."
      : !profileLoading && !currentAdminProfile && !configError
        ? "Log in as admin to manage costs."
        : null);

  useGlobalLoading(
    "costs-manager",
    isLoading || profileLoading || dataLoading || isSubmitting,
    isLoading ? t("common.loading") : isSubmitting ? t("costs.adding") : t("common.loading"),
  );

  useEffect(() => {
    if (configError || !auth) return;
    if (profileLoading) return;
    if (profileError) return;
    if (!currentAdminProfile) return;
    let active = true;
    void (async () => {
      try {
        if (!active) return;
        setIsLoading(true);
        const currentCharts = await listCharts(currentAdminProfile.groupId);
        if (!active) return;
        setAdminProfile(currentAdminProfile);
        setCharts(currentCharts);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load data.");
      } finally { if (active) setIsLoading(false); }
    })();
    return () => { active = false; };
  }, [configError, currentAdminProfile, profileError, profileLoading]);

  useEffect(() => {
    if (!adminProfile || !selectedChart) return;
    let active = true;
    const fetchData = async () => {
      setDataLoading(true);
      setCosts([]);
      setDeposits([]);
      try {
        const [cList, dList] = await Promise.all([
          listCostsForChart(adminProfile.groupId, selectedChart.id),
          listDepositsForChart(adminProfile.groupId, selectedChart.id),
        ]);
        if (active) {
          setCosts(cList);
          setDeposits(dList);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load data.");
      } finally {
        if (active) setDataLoading(false);
      }
    };

    void fetchData();

    return () => { active = false; };
  }, [adminProfile, selectedChart]);

  useEffect(() => {
    if (!selectedChart) return;
    const { min, max } = chartMonthDateBounds(selectedChart);
    setTimeout(() => {
      setDate((d) => (d < min || d > max ? min : d));
    }, 0);
  }, [selectedChart]);

  const { totalCost, totalPaid, remainingTaka: balance } = getMonthTotals([], costs, deposits);
  const filteredCosts = costs.filter(c => 
    c.itemName.toLowerCase().includes(search.trim().toLowerCase())
  );
  const tk = t("common.tk");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!adminProfile || !selectedChart) return;
    if (selectedChart.locked) { setError("This month is locked."); return; }
    const amt = Number(amount);
    if (!itemName.trim() || isNaN(amt) || amt <= 0) {
      setError("Item name and a valid amount are required.");
      return;
    }
    setError(null); setIsSubmitting(true);
    try {
      const created = await createCost({
        groupId: adminProfile.groupId,
        chartId: selectedChart.id,
        itemName: itemName.trim(),
        amount: amt,
        date,
      });
      setCosts((prev) => {
        if (prev.some((c) => c.id === created.id)) return prev;
        return [created, ...prev];
      });
      setItemName(""); setAmount("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add cost.");
    } finally { setIsSubmitting(false); }
  }

  async function handleDelete(costId: string) {
    if (!adminProfile || !selectedChart) return;
    if (selectedChart.locked) { setError("This month is locked."); return; }
    try {
      await deleteCost(adminProfile.groupId, selectedChart.id, costId);
      setCosts((prev) => prev.filter((c) => c.id !== costId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete cost.");
    }
  }

  if (isLoading) return <AdminLoadingState message={t("common.loading")} />;

  if (!selectedChart) {
    return (
      <div className="mt-6 grid gap-5">
        {resolvedError && <p className="alert-error">{tx(resolvedError)}</p>}

        <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-sm)]">
          <p className="admin-section-label">{t("admin.selectMonth")}</p>
          <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">
            {t("costs.selectHelp")}
          </p>
          {charts.length === 0 ? (
            <p className="mt-4 py-6 text-center text-sm text-[color:var(--soft-foreground)]">
              {t("admin.noChartsMeals")}
            </p>
          ) : (
            <div className="mt-4 grid gap-2">
              {charts.map((chart, i) => (
                <button
                  key={chart.id}
                  type="button"
                  onClick={() => setSelectedChart(chart)}
                  className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3.5 text-left transition hover:border-[color:var(--accent)] hover:bg-[color:var(--accent-dim)]"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{chart.label}</p>
                      {i === 0 && <span className="badge-accent">{t("common.active")}</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-[color:var(--muted)]">{chart.monthKey}</p>
                  </div>
                  <span className="text-[color:var(--accent)]">→</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const dateBounds = chartMonthDateBounds(selectedChart);

  return (
    <div className="mt-6 grid gap-5">
      {resolvedError && <p className="alert-error">{tx(resolvedError)}</p>}

      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3">
        <div>
          <p className="admin-section-label">{t("costs.header")}</p>
          <p className="mt-0.5 font-semibold">{selectedChart.label}</p>
          {selectedChart.locked && (
            <p className="mt-1 text-xs font-semibold text-[color:var(--danger)]">{t("costs.monthLockedNoEdit")}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setSelectedChart(null); setCosts([]); }}
          className="button-secondary shrink-0"
        >
          {t("costs.backMonths")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="group-stat-card">
          <p className="group-stat-label">{t("groupMoney.statTotalPaid")}</p>
          <p className="group-stat-value">{totalPaid.toFixed(2)} {tk}</p>
        </div>
        <div className="group-stat-card">
          <p className="group-stat-label">{t("costs.totalCost")}</p>
          <p className="group-stat-value">{totalCost.toFixed(2)} {tk}</p>
        </div>
        <div className="group-stat-card">
          <p className="group-stat-label">{t("groupChart.statRemaining")}</p>
          <p 
            className="group-stat-value"
            style={{ color: balance >= 0 ? "var(--accent)" : "var(--danger)" }}
          >
            {balance >= 0 ? "+" : ""}{balance.toFixed(2)} {tk}
          </p>
        </div>
        <div className="group-stat-card">
          <p className="group-stat-label">{t("costs.entries")}</p>
          <p className="group-stat-value">{costs.length}</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-sm)]"
      >
        <p className="admin-section-label">{t("costs.addEntryTitle")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-medium">
            {t("admin.itemName")}
            <input className="input" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder={t("costs.placeholderItem")} required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("admin.amountTk")}
            <input className="input" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="250" required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("admin.date")}
            <input
              className="input"
              type="date"
              min={dateBounds.min}
              max={dateBounds.max}
              placeholder={toDateInputValue(new Date())}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
        </div>
        <button className="button-primary w-full sm:w-fit" disabled={!adminProfile || isSubmitting || selectedChart.locked} type="submit">
          {isSubmitting ? t("costs.adding") : t("costs.addCostBtn")}
        </button>
      </form>

      <div className="grid gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="admin-section-label">{t("costs.historyTitle")}</p>
          <input
            className="input w-full sm:w-64"
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("memberMgr.searchPlaceholder")}
            value={search}
          />
        </div>
        {dataLoading && (
          <AdminLoadingState compact message={t("common.loading")} />
        )}
        {!dataLoading && filteredCosts.length === 0 && (
          <p className="py-4 text-center text-sm text-[color:var(--soft-foreground)]">
            {search ? t("memberMgr.noSearchMatch") : t("costs.empty")}
          </p>
        )}
        {filteredCosts.map((cost) => (
          <div
            key={cost.id}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3"
          >
            <div>
              <p className="font-semibold">{cost.itemName}</p>
              <p className="mt-0.5 text-xs text-[color:var(--muted)]">{cost.date}</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="font-bold text-[color:var(--accent)]">{cost.amount.toFixed(2)} {tk}</p>
              <button
                onClick={() => void handleDelete(cost.id)}
                type="button"
                disabled={selectedChart.locked}
                className="rounded-full border border-[color:var(--danger-border)] px-3 py-1 text-xs font-semibold text-[color:var(--danger)] transition hover:bg-[color:var(--danger)] hover:text-white"
              >
                {t("admin.delete")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
