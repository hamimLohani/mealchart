"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import type { Chart, Member } from "@/types/domain";
import { useT } from "@/i18n/use-t";

import { readStoredChartFromSession } from "@/lib/utils/group-chart-session";
import { saveChartReportPdf } from "@/lib/utils/pdf-report";
import { formatMeal, getMonthTotals } from "@/lib/utils/meal-money";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { useGroup, useMembers, useCharts, useMealsForMonth, useCosts, useDeposits } from "@/lib/hooks/use-data";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";

export function GroupDashboard({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { t } = useT();

  const [activeChart, setActiveChart] = useState<Chart | null>(() => readStoredChartFromSession());
  const [memberSearch, setMemberSearch] = useState("");

  // SWR — shared cache, automatic dedup & background refresh
  const { data: group, error: groupError, isLoading: groupLoading } = useGroup(isFirebaseConfigured ? groupId : undefined);
  const { data: members = [] } = useMembers(group?.id);
  const { data: charts = [] } = useCharts(group?.id);

  // Auto-select most recent chart on first arrival
  useEffect(() => {
    if (!groupLoading && charts.length > 0 && !activeChart) {
      const hasManuallyExited = sessionStorage.getItem("mc_manual_exit");
      const hasStoredChart = sessionStorage.getItem("mc_chart_id");
      
      if (!hasStoredChart && !hasManuallyExited) {
        handleChartSelect(charts[0]);
      }
    }
  }, [groupLoading, charts, activeChart]);
  const { data: monthMeals = [], isLoading: mealsLoading } = useMealsForMonth(group?.id, activeChart?.monthKey);
  const { data: monthCosts = [], isLoading: costsLoading } = useCosts(group?.id, activeChart?.id);
  const { data: monthDeposits = [], isLoading: depositsLoading } = useDeposits(group?.id, activeChart?.id);

  const isMonthLoading = !!(activeChart && (mealsLoading || costsLoading || depositsLoading));
  useGlobalLoading(
    `group-dashboard-${groupId}`,
    groupLoading || isMonthLoading,
    groupLoading ? t("groupDash.loading") : t("groupDash.loadingTotals"),
  );

  function handleMemberSelect(member: Member) {
    router.push(`/group/${groupId}/member/${member.id}`);
  }

  function handleChartSelect(chart: Chart) {
    sessionStorage.setItem("mc_chart_id", chart.id);
    sessionStorage.setItem("mc_chart_label", chart.label);
    sessionStorage.setItem("mc_chart_month_key", chart.monthKey);
    sessionStorage.setItem("mc_chart_year", String(chart.year));
    sessionStorage.setItem("mc_chart_month", String(chart.month));
    sessionStorage.setItem("mc_chart_locked", String(chart.locked));
    sessionStorage.removeItem("mc_manual_exit");
    setActiveChart(chart);
  }

  function handleChangeChart() {
    sessionStorage.removeItem("mc_chart_id");
    sessionStorage.removeItem("mc_chart_label");
    sessionStorage.removeItem("mc_chart_month_key");
    sessionStorage.removeItem("mc_chart_year");
    sessionStorage.removeItem("mc_chart_month");
    sessionStorage.removeItem("mc_chart_locked");
    // Set a flag so the auto-select effect doesn't immediately put them back in
    sessionStorage.setItem("mc_manual_exit", "true");
    setActiveChart(null);
  }

  function handleDownloadPDF() {
    if (!activeChart || !group || members.length === 0) return;

    try {
      saveChartReportPdf({
        groupName: group.name || "Group",
        chartLabel: activeChart.label || "Report",
        monthKey: activeChart.monthKey,
        members,
        meals: monthMeals || [],
        costs: monthCosts || [],
        deposits: monthDeposits || [],
        fileName: `${group.name}_${activeChart.label}_Report.pdf`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate PDF";
      console.error("PDF export error:", msg);
      // Could set error state here if needed
    }
  }

  if (!isFirebaseConfigured) {
    return <p className="py-16 text-center text-sm text-[color:var(--soft-foreground)]">{t("errors.firebaseNotConfigured")}</p>;
  }

  if (groupLoading) {
    return (
      <div className="group-page-grid py-16">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (groupError) {
    const msg = groupError instanceof Error ? groupError.message : t("errors.loadGroupFailed");
    return (
      <div className="mt-8">
        <div className="alert-error">{msg}</div>
      </div>
    );
  }
  if (!group) return null;

  const { totalMeals: monthTotalMeals, totalCost: monthTotalCost, totalPaid: monthTotalPaid, mealRate, remainingTaka } =
    getMonthTotals(monthMeals, monthCosts, monthDeposits);

  // Step 1: Select month/chart first
  if (!activeChart) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="group-page-grid">
        <div className="group-hero">
          <div className="min-w-0">
            <p className="group-kicker">{group.name}</p>
            <p className="group-title">{t("groupDash.selectMonth")}</p>
            <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">
              {t("groupDash.selectMonthHelp")}
            </p>
          </div>
        </div>
        <div className="group-card">
          <p className="group-kicker">{t("groupDash.availableMonths")}</p>
          {charts.length === 0 ? (
            <p className="mt-4 py-6 text-center text-sm text-[color:var(--soft-foreground)]">
              {t("groupDash.noCharts")}
            </p>
          ) : (
            <div className="mt-3 grid gap-2">
              {charts.map((chart, i) => (
                <button
                  key={chart.id}
                  type="button"
                  onClick={() => handleChartSelect(chart)}
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
      </motion.div>
    );
  }


  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="group-page-grid">
      <div className="group-hero">
        <div className="min-w-0">
          <p className="group-kicker">{group.name}</p>
          <p className="group-title">{activeChart.label}</p>
          <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">{t("groupDash.reviewTotals")}</p>
          {activeChart.locked && (
            <p className="mt-1 inline-flex rounded-full border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-2 py-0.5 text-xs font-semibold text-[color:var(--danger)]">
              {t("groupDash.monthLocked")}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0 sm:flex-row">
          <button type="button" onClick={handleDownloadPDF} className="button-secondary">
            {t("groupDash.exportCSV", { defaultValue: "Export PDF" })}
          </button>
          <button type="button" onClick={handleChangeChart} className="button-secondary">
            {t("groupDash.changeMonth")}
          </button>
        </div>
      </div>

      {isMonthLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: t("groupDash.statTotalMeal"), value: formatMeal(monthTotalMeals) },
            { label: t("groupDash.statTotalCost"), value: `${monthTotalCost.toFixed(2)} ${t("common.tk")}` },
            { label: t("groupDash.statTotalPaid"), value: `${monthTotalPaid.toFixed(2)} ${t("common.tk")}` },
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


      <div className="group-card">
        <p className="group-kicker">{t("groupDash.selectMember")}</p>
        <input
          className="group-search-input mt-3"
          placeholder={t("groupDash.searchMembers")}
          value={memberSearch}
          onChange={(event) => setMemberSearch(event.target.value)}
          type="search"
        />
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {members
            .filter((member) => {
              const query = memberSearch.trim().toLowerCase();
              return !query || 
                member.fullName.toLowerCase().includes(query) ||
                member.email.toLowerCase().includes(query);
            })
            .map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => handleMemberSelect(member)}
                className="member-row text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{member.fullName}</p>
                  <p className="text-xs text-[color:var(--muted)]">
                    {t("groupDash.joined")} {new Date(member.joinDate).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-[color:var(--accent)]">→</span>
              </button>
            ))}
        </div>
      </div>
    </motion.div>
  );
}
