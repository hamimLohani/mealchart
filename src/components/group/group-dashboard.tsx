"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import type { Member } from "@/types/domain";
import { useT } from "@/i18n/use-t";

import { GroupMonthSelector } from "@/components/group/group-month-selector";
import { useGroupSession } from "@/lib/hooks/use-group-session";
import { saveChartReportPdf } from "@/lib/utils/pdf-report";
import { formatMeal, getMonthTotals } from "@/lib/utils/meal-money";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { useGroup, useMembers, useMealsForChart, useCosts, useDeposits, useCharts } from "@/lib/hooks/use-data";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";
import { pickCurrentMonthChart, isChartActive } from "@/lib/utils/date";

export function GroupDashboard({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { t } = useT();

  const { chart: activeChart, selectChart } = useGroupSession();
  const [memberSearch, setMemberSearch] = useState("");
  const [isMonthSelectorOpen, setIsMonthSelectorOpen] = useState(false);

  // SWR — shared cache, automatic dedup & background refresh
  const { data: group, error: groupError, isLoading: groupLoading } = useGroup(isFirebaseConfigured ? groupId : undefined);
  const { data: members = [] } = useMembers(group?.id);
  const { data: charts = [] } = useCharts(group?.id);
  const { data: monthMeals = [], isLoading: mealsLoading } = useMealsForChart(group?.id, activeChart || undefined);
  const { data: monthCosts = [], isLoading: costsLoading } = useCosts(group?.id, activeChart?.id);
  const { data: monthDeposits = [], isLoading: depositsLoading } = useDeposits(group?.id, activeChart?.id);

  // Auto-select preferred current chart if none selected yet
  useEffect(() => {
    if (charts.length === 0 || activeChart) return;
    const hasManuallyExited = sessionStorage.getItem("mc_manual_exit");
    if (hasManuallyExited) return;
    const preferredChart = pickCurrentMonthChart(charts);
    if (preferredChart) {
      selectChart(preferredChart);
    }
  }, [activeChart, charts, selectChart]);

  const isMonthLoading = !!(activeChart && (mealsLoading || costsLoading || depositsLoading));
  useGlobalLoading(
    `group-dashboard-${groupId}`,
    groupLoading || isMonthLoading,
    groupLoading ? t("groupDash.loading") : t("groupDash.loadingTotals"),
  );

  function handleMemberSelect(member: Member) {
    router.push(`/group/${groupId}/member/${member.id}`);
  }

  async function handleDownloadPDF() {
    if (!activeChart || !group || members.length === 0) return;

    try {
      await saveChartReportPdf({
        groupName: group.name || "Group",
        chartLabel: activeChart.label || "Report",
        monthKeys: activeChart.monthKeys || [activeChart.monthKey],
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

  // Step 1: Select month/chart first if none is active
  if (!activeChart) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <GroupMonthSelector groupId={group.id} groupName={group.name} autoSelect />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="group-page-grid">
      <div className="group-hero !flex-col !items-stretch gap-3">
        <div className="flex items-start justify-between gap-6 sm:items-center w-full">
          <div className="min-w-0 flex-1">
            <p className="group-kicker">{group.name}</p>
            <p className="group-title">{t("groupNav.home")}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-sm font-semibold text-[color:var(--foreground)]">{activeChart.label}</span>
              <span className="rounded-md bg-[color:var(--accent-dim)] px-2 py-0.5 text-xs font-semibold text-[color:var(--accent)]">
                {(activeChart.monthKeys || [activeChart.monthKey]).join(", ")}
              </span>
              {activeChart.locked && (
                <span className="rounded-md border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-2 py-0.5 text-xs font-semibold text-[color:var(--danger)]">
                  {t("groupDash.monthLocked")}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-1.5 shrink-0 min-w-[110px]">
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="button-secondary !py-1.5 !px-3 text-xs font-semibold flex items-center justify-center gap-1.5 rounded-lg w-full transition hover:bg-[color:var(--accent-dim)]"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>{t("groupDash.exportCSV", { defaultValue: "Export PDF" })}</span>
            </button>

            {/* Months option right below download PDF inside the box */}
            <button
              type="button"
              onClick={() => setIsMonthSelectorOpen((prev) => !prev)}
              className="button-secondary !py-1.5 !px-3 text-xs font-semibold flex items-center justify-center gap-1 rounded-lg w-full transition hover:bg-[color:var(--accent-dim)]"
              title={t("groupDash.changeMonth")}
            >
              <span>{t("groupDash.changeMonth")}</span>
              <span className="text-[10px] opacity-70">{isMonthSelectorOpen ? "▲" : "▼"}</span>
            </button>
          </div>
        </div>

        {/* Months Selector Grid Inside The Box */}
        <AnimatePresence>
          {isMonthSelectorOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full mt-2 border-t border-[color:var(--border)] pt-3 overflow-hidden"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--muted)] mb-2">
                {t("groupDash.availableMonths")}
              </p>
              {charts.length === 0 ? (
                <p className="py-2 text-center text-xs text-[color:var(--soft-foreground)]">
                  {t("groupDash.noCharts")}
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {charts.map((monthChart) => {
                    const isSelected = activeChart?.id === monthChart.id;
                    const isActive = isChartActive(monthChart);
                    return (
                      <button
                        key={monthChart.id}
                        type="button"
                        onClick={() => {
                          sessionStorage.setItem("mc_auto_selected_chart", "false");
                          selectChart(monthChart);
                          setIsMonthSelectorOpen(false);
                        }}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                          isSelected
                            ? "border-[color:var(--accent)] bg-[color:var(--accent-dim)] text-[color:var(--accent)] font-bold shadow-xs"
                            : "border-[color:var(--border)] bg-[color:var(--background)] hover:border-[color:var(--accent)]"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold truncate">{monthChart.label}</span>
                            {isActive && <span className="badge-accent !text-[10px] !py-0 !px-1.5">{t("common.active")}</span>}
                          </div>
                          <span className="text-xs text-[color:var(--muted)] truncate block">
                            {(monthChart.monthKeys || [monthChart.monthKey]).join(", ")}
                          </span>
                        </div>
                        {isSelected && <span className="text-sm font-bold text-[color:var(--accent)]">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
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
