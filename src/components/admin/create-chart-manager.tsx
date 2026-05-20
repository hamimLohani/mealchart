"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useT } from "@/i18n/use-t";
import {
  backfillMealMonthKeys,
  backfillSystemNotices,
  createChart,
  deleteChart,
  listCharts,
  syncLockedMonthDocsFromCharts,
  updateChartLock,
  getMealsForMonth,
  listCostsForChart,
  listDepositsForChart,
  listMembers,
  getGroupById,
} from "@/lib/firebase/repositories";
import { formatChartLabel } from "@/lib/utils/date";
import { daysInMonth } from "@/lib/utils/date";
import { saveChartReportPdf } from "@/lib/utils/pdf-report";
import type { AdminProfile, Chart } from "@/types/domain";
import { sendMonthSummaryEmails } from "@/lib/email/actions";
import { getFriendlyEmailError } from "@/lib/utils/email-error";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";
import { AdminLoadingState } from "@/components/admin/admin-loading-state";
import { useCurrentAdminProfile } from "@/lib/hooks/use-current-admin-profile";

type ChartFormState = { year: string; month: string };

const today = new Date();
const initialState: ChartFormState = {
  year: String(today.getFullYear()),
  month: String(today.getMonth() + 1).padStart(2, "0"),
};

export function CreateChartManager() {
  const { t, tx } = useT();
  const configurationError =
    !isFirebaseConfigured || !auth
      ? "Firebase is not configured yet. Add your keys in .env.local first."
      : null;

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [paidChartSlots, setPaidChartSlots] = useState(0);
  const [totalChartsCreated, setTotalChartsCreated] = useState(0);
  const [form, setForm] = useState<ChartFormState>(initialState);
  const [error, setError] = useState<string | null>(configurationError);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lockingAction, setLockingAction] = useState<{ id: string; type: "lock" | "unlock" } | null>(null);
  const [exportingChartId, setExportingChartId] = useState<string | null>(null);
  const [isRepairingData, setIsRepairingData] = useState(false);
  const { adminProfile: currentAdminProfile, isLoading: profileLoading, error: profileError } = useCurrentAdminProfile();
  const activeAdminProfile =
    currentAdminProfile && adminProfile?.id === currentAdminProfile.id ? adminProfile : null;
  const visibleCharts = activeAdminProfile ? charts : [];
  const resolvedError =
    error ??
    (profileError
      ? profileError instanceof Error
        ? profileError.message
        : "Failed to load charts."
      : !profileLoading && !currentAdminProfile && !configurationError
        ? "Log in as an admin to create charts."
        : null);

  useGlobalLoading(
    "create-chart-manager",
    isLoading || profileLoading || isSubmitting || isDeleting || lockingAction !== null || exportingChartId !== null || isRepairingData,
    isLoading
      ? t("createChart.loadingCharts")
      : isRepairingData
        ? "Repairing older chart data…"
      : isSubmitting
        ? t("createChart.createBtnBusy")
      : isDeleting
        ? t("createChart.deleting")
      : lockingAction !== null
        ? lockingAction.type === "unlock" ? t("createChart.unlocking") : t("createChart.locking")
      : exportingChartId !== null
        ? t("createChart.exporting")
        : t("common.loading"),
  );

  useEffect(() => {
    if (configurationError || !auth) return;
    if (profileLoading) return;
    if (profileError || !currentAdminProfile) return;
    let active = true;
    void (async () => {
      try {
        if (!active) return;
        setIsLoading(true);
        setError(null);
        const [currentCharts, group] = await Promise.all([
          listCharts(currentAdminProfile.groupId),
          getGroupById(currentAdminProfile.groupId),
        ]);
        if (!active) return;
        setAdminProfile(currentAdminProfile);
        setCharts(currentCharts);
        setPaidChartSlots(group?.paidChartSlots ?? 0);
        setTotalChartsCreated(group?.totalChartsCreated ?? 0);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load charts.");
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [configurationError, currentAdminProfile, profileError, profileLoading]);

  const previewLabel = useMemo(() => {
    const y = Number(form.year);
    const m = Number(form.month);
    if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) return t("costs.invalidMonth");
    const label = formatChartLabel(y, m);
    const days = daysInMonth(y, m);
    return t("createChart.previewLine", { label, days: String(days), unit: t("createChart.daysUnit") });
  }, [form.month, form.year, t]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!activeAdminProfile) { setError("Admin profile is required before creating a chart."); return; }
    const year = Number(form.year);
    const month = Number(form.month);
    if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
      setError("Enter a valid year and month.");
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await createChart({ groupId: activeAdminProfile.groupId, year, month });
      setCharts((c) => [created, ...c].sort((a, b) => b.monthKey.localeCompare(a.monthKey)));
      // Re-fetch group to update paid slots
      const group = await getGroupById(activeAdminProfile.groupId);
      setPaidChartSlots(group?.paidChartSlots ?? 0);
      setTotalChartsCreated(group?.totalChartsCreated ?? 0);
    } catch (e) {
      if (e instanceof Error && e.message === "LIMIT_REACHED_CHART") {
        setError("LIMIT_REACHED_CHART");
      } else {
        setError(e instanceof Error ? e.message : "Failed to create the chart.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleLock(chart: Chart) {
    if (!activeAdminProfile) return;
    setError(null);
    setLockingAction({ id: chart.id, type: chart.locked ? "unlock" : "lock" });
    try {
      await updateChartLock({
        groupId: activeAdminProfile.groupId,
        chartId: chart.id,
        locked: !chart.locked,
      });
      setCharts((prev) =>
        prev.map((current) =>
          current.id === chart.id ? { ...current, locked: !current.locked } : current,
        ),
      );

      if (!chart.locked) {
        const group = await getGroupById(activeAdminProfile.groupId);
        if (!group) throw new Error("Group not found");
        const [members, meals, costs, deposits] = await Promise.all([
          listMembers(activeAdminProfile.groupId),
          getMealsForMonth(activeAdminProfile.groupId, chart.monthKey),
          listCostsForChart(activeAdminProfile.groupId, chart.id),
          listDepositsForChart(activeAdminProfile.groupId, chart.id),
        ]);
        const emailResult = await sendMonthSummaryEmails({
          groupName: group.name,
          chartLabel: chart.label,
          members,
          meals,
          costs,
          deposits,
        });
        if (!emailResult.success) {
          const friendlyError = getFriendlyEmailError(emailResult.error || "");
          setError(`ERR_TRANS:${JSON.stringify({ 
            key: "errors.emailSummaryFailed", 
            vars: { error: friendlyError } 
          })}`);
        } else if (emailResult.failedCount && emailResult.failedCount > 0) {
          setError(
            t("errors.emailSummaryStatus", {
              sent: String(emailResult.sentCount),
              failed: String(emailResult.failedCount),
            })
          );
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update chart lock.");
    } finally {
      setLockingAction(null);
    }
  }

  async function handleDeleteChart(chart: Chart) {
    if (!activeAdminProfile) return;
    const confirmed = window.confirm(t("createChart.deleteConfirm"));
    if (!confirmed) return;
    setError(null);
    setIsDeleting(true);
    try {
      await deleteChart(activeAdminProfile.groupId, chart.id);
      setCharts((prev) => prev.filter((c) => c.id !== chart.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("createChart.deleteFailed"));
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleRepairData() {
    if (!activeAdminProfile) return;
    setError(null);
    setIsRepairingData(true);
    try {
      await backfillMealMonthKeys(activeAdminProfile.groupId);
      await backfillSystemNotices(activeAdminProfile.groupId);
      await syncLockedMonthDocsFromCharts(activeAdminProfile.groupId);
      const currentCharts = await listCharts(activeAdminProfile.groupId);
      setCharts(currentCharts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to repair older chart data.");
    } finally {
      setIsRepairingData(false);
    }
  }

  async function handleDownloadPDF(chart: Chart) {
    if (!activeAdminProfile) return;
    try {
      setExportingChartId(chart.id);
      const groupId = activeAdminProfile.groupId;
      const group = await getGroupById(groupId);
      if (!group) throw new Error("Group not found");

      const [members, meals, costs, deposits] = await Promise.all([
        listMembers(groupId),
        getMealsForMonth(groupId, chart.monthKey),
        listCostsForChart(groupId, chart.id),
        listDepositsForChart(groupId, chart.id),
      ]);

      // Ensure all arrays are valid
      if (!Array.isArray(members) || !Array.isArray(meals) || !Array.isArray(costs) || !Array.isArray(deposits)) {
        throw new Error("Failed to load chart data - invalid response format");
      }

      saveChartReportPdf({
        groupName: group.name || "Group",
        chartLabel: chart.label || "Report",
        monthKey: chart.monthKey,
        members,
        meals,
        costs,
        deposits,
        fileName: `${group.name}_${chart.label}_Report.pdf`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to export PDF");
    } finally {
      setExportingChartId(null);
    }
  }

  if (isLoading) {
    return <AdminLoadingState message={t("createChart.loadingCharts")} />;
  }

  const daysUnit = t("createChart.daysUnit");

  return (
    <div className="mt-6 grid gap-4">
      {resolvedError && (
        <div className={resolvedError === "LIMIT_REACHED_CHART" ? "alert-warning" : "alert-error"}>
          {resolvedError === "LIMIT_REACHED_CHART" ? (
            <div className="flex flex-col gap-2">
              <p className="font-bold">Free Limit Reached (3 Charts)</p>
              <p className="font-bold text-[color:var(--danger)]">
                To create more charts, please pay 20 taka to <strong>01xxxxxxxxx</strong> (bKash/Nagad).
                <br />
                <span className="text-xs opacity-80">After payment, we will enable your next chart slot.</span>
              </p>
            </div>
          ) : (
            tx(resolvedError)
          )}
        </div>
      )}

      <div className="rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] p-4">
        <div className="flex items-center justify-between">
          <p className="admin-section-label">Chart Usage Status</p>
          <span className="text-xs font-medium bg-[color:var(--accent)] text-white px-2 py-1 rounded-full">
            Paid Slots: {paidChartSlots}
          </span>
        </div>
        <p className="mt-2 text-sm text-[color:var(--soft-foreground)]">
          Free Limit: 3 Charts. Used: {Math.min(totalChartsCreated, 3)}/3.
          {totalChartsCreated > 3 && ` Paid Charts: ${totalChartsCreated - 3}.`}
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void handleRepairData()}
            disabled={!activeAdminProfile || isRepairingData}
            className="button-secondary w-full sm:w-fit"
          >
            {isRepairingData ? "Repairing…" : "Repair Older Data"}
          </button>
          <p className="text-xs text-[color:var(--muted)]">
            Runs one-time fixes for legacy meal month keys and locked-month mirror docs.
          </p>
        </div>
      </div>

      <form
        className="grid gap-4 rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-4 shadow-[var(--shadow-sm)]"
        onSubmit={handleSubmit}
      >
        <p className="admin-section-label">{t("createChart.formTitle")}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">
            {t("admin.year")}
            <input
              className="input"
              onChange={(e) => setForm((c) => ({ ...c, year: e.target.value }))}
              placeholder="2026"
              type="number"
              value={form.year}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("admin.month")}
            <select
              className="input"
              onChange={(e) => setForm((c) => ({ ...c, month: e.target.value }))}
              value={form.month}
            >
              {Array.from({ length: 12 }, (_, i) => {
                const m = String(i + 1).padStart(2, "0");
                return <option key={m} value={m}>{m}</option>;
              })}
            </select>
          </label>
        </div>

        <div className="rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] p-3.5">
          <p className="admin-section-label">{t("createChart.preview")}</p>
          <p className="mt-1.5 text-base font-semibold">{previewLabel}</p>
        </div>

        <button
          className="button-primary w-full sm:w-fit"
          disabled={!activeAdminProfile || isSubmitting}
          type="submit"
        >
          {isSubmitting ? t("createChart.createBtnBusy") : t("createChart.createBtn")}
        </button>
      </form>

      <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-4 shadow-[var(--shadow-sm)]">
        <p className="admin-section-label">{t("createChart.existingTitle")}</p>
        <div className="mt-3 grid gap-2.5">
          {visibleCharts.length ? (
            visibleCharts.map((chart, index) => (
              <article
                key={chart.id}
                className="grid gap-4 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] p-4 sm:flex sm:items-center sm:justify-between sm:px-4 sm:py-3"
              >
                <div className="flex items-start justify-between sm:block">
                  <div className="min-w-0">
                    <p className="font-semibold">{chart.label}</p>
                    <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                      {chart.totalDays} {daysUnit} · {chart.monthKey}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5 sm:hidden">
                    {chart.locked ? (
                      <span className="rounded-full border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-[color:var(--danger)]">
                        {t("createChart.lockedBadge")}
                      </span>
                    ) : null}
                    {index === 0 && <span className="badge-accent !py-0.5 !text-[0.65rem]">{t("common.active")}</span>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <div className="hidden items-center gap-2 sm:flex">
                    {chart.locked ? (
                      <span className="rounded-full border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-2 py-0.5 text-xs font-semibold text-[color:var(--danger)]">
                        {t("createChart.lockedBadge")}
                      </span>
                    ) : null}
                    {index === 0 && <span className="badge-accent">{t("common.active")}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDownloadPDF(chart)}
                    disabled={exportingChartId === chart.id}
                    className="button-secondary flex-1 sm:flex-none"
                  >
                    {exportingChartId === chart.id ? "..." : t("groupDash.exportCSV", { defaultValue: "Export PDF" })}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleLock(chart)}
                    className="button-secondary flex-1 sm:flex-none"
                  >
                    {chart.locked ? t("createChart.unlock") : t("createChart.lock")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteChart(chart)}
                    className="rounded-full border border-[color:var(--danger-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--danger)] transition hover:bg-[color:var(--danger)] hover:text-white sm:px-4"
                  >
                    {t("createChart.deleteBtn")}
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="py-4 text-center text-sm font-bold text-[color:var(--danger)]">
              {t("admin.noChartsMeals")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
