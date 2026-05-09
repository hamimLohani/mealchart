"use client";

import { FormEvent, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useT } from "@/i18n/use-t";
import {
  createCost,
  deleteCost,
  getAdminProfile,
  listCharts,
  listCostsForChart,
} from "@/lib/firebase/repositories";
import { chartMonthDateBounds, toDateInputValue } from "@/lib/utils/date";
import type { AdminProfile, Chart, CostEntry } from "@/types/domain";

export function CostsManager() {
  const { t, tx } = useT();
  const configError = !isFirebaseConfigured || !auth ? "Firebase is not configured yet." : null;

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [error, setError] = useState<string | null>(configError);
  const [isLoading, setIsLoading] = useState(!configError);

  const [selectedChart, setSelectedChart] = useState<Chart | null>(null);
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [costsLoading, setCostsLoading] = useState(false);
  const [itemName, setItemName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (configError || !auth) return;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setError("Log in as admin to manage costs."); setIsLoading(false); return; }
      try {
        const profile = await getAdminProfile(user.uid);
        if (!profile) throw new Error("No admin profile found.");
        const currentCharts = await listCharts(profile.groupId);
        setAdminProfile(profile);
        setCharts(currentCharts);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data.");
      } finally { setIsLoading(false); }
    });
    return unsub;
  }, [configError]);

  useEffect(() => {
    if (!adminProfile || !selectedChart) return;
    let active = true;
    setCostsLoading(true);
    setCosts([]);

    listCostsForChart(adminProfile.groupId, selectedChart.id)
      .then((list) => { if (active) setCosts(list); })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "Failed to load costs."); })
      .finally(() => { if (active) setCostsLoading(false); });

    return () => { active = false; };
  }, [adminProfile, selectedChart]);

  useEffect(() => {
    if (!selectedChart) return;
    const { min, max } = chartMonthDateBounds(selectedChart);
    setDate((d) => (d < min || d > max ? min : d));
  }, [selectedChart]);

  const total = costs.reduce((s, c) => s + c.amount, 0);
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

  if (isLoading) return <p className="mt-8 text-sm text-[color:var(--soft-foreground)]">{t("common.loading")}</p>;

  if (!selectedChart) {
    return (
      <div className="mt-6 grid gap-5">
        {error && <p className="alert-error">{tx(error)}</p>}

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
      {error && <p className="alert-error">{tx(error)}</p>}

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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="group-stat-card">
          <p className="group-stat-label">{t("costs.totalCost")}</p>
          <p className="group-stat-value">{total.toFixed(2)} {tk}</p>
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
        {costsLoading && (
          <p className="py-4 text-center text-sm text-[color:var(--soft-foreground)]">{t("common.loading")}</p>
        )}
        {!costsLoading && costs.length === 0 && (
          <p className="py-4 text-center text-sm text-[color:var(--soft-foreground)]">{t("costs.empty")}</p>
        )}
        {costs.map((cost) => (
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
