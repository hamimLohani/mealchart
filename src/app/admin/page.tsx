"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { useT } from "@/i18n/use-t";
import { useAuthStore } from "@/store/auth-store";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";
import { useToast } from "@/lib/hooks/use-toast";
import { AdminLoadingState } from "@/components/admin/admin-loading-state";
import { useCurrentAdminProfile } from "@/lib/hooks/use-current-admin-profile";
import { AdminMonthSummary } from "@/components/admin/admin-month-summary";
import { useCharts, useCosts, useDeposits, useGroup, useMealsForChart, useMembers } from "@/lib/hooks/use-data";
import { saveChartReportPdf } from "@/lib/utils/pdf-report";
import { pickCurrentMonthChart, isChartActive } from "@/lib/utils/date";
import { handleAdminLogout } from "@/lib/auth/admin-logout";
import { motion, AnimatePresence } from "framer-motion";

const navItemKeys = [
  { href: "/admin/members", labelKey: "adminNav.members" as const, hintKey: "adminNav.membersHint" as const, metric: "01" },
  {
    href: "/admin/add-money",
    labelKey: "adminNav.addMoney" as const,
    hintKey: "adminNav.addMoneyHint" as const,
    metric: "02",
  },
  {
    href: "/admin/edit-meals",
    labelKey: "adminNav.editMeals" as const,
    hintKey: "adminNav.editMealsHint" as const,
    metric: "03",
  },
  { href: "/admin/costs", labelKey: "adminNav.costs" as const, hintKey: "adminNav.costsHint" as const, metric: "04" },
  {
    href: "/admin/create-chart",
    labelKey: "adminNav.createChart" as const,
    hintKey: "adminNav.createChartHint" as const,
    metric: "05",
  },
  {
    href: "/admin/settings",
    labelKey: "adminNav.settings" as const,
    hintKey: "adminNav.settingsHint" as const,
    metric: "06",
  },
];

export default function AdminPage() {
  const { admin, isLoaded } = useAuthStore();
  const router = useRouter();
  const { t, tx } = useT();
  const { toast } = useToast();
  const [isSignOutInProgress, setIsSignOutInProgress] = useState(false);
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null);
  const [isMonthSelectorOpen, setIsMonthSelectorOpen] = useState(false);
  const { adminProfile, isLoading: profileLoading, error: profileError } = useCurrentAdminProfile();

  // Use the shared SWR cache for the group — avoids a raw getDoc() on every mount.
  const { data: group = null, error: groupError } = useGroup(adminProfile?.groupId);
  const visibleGroup = adminProfile && group?.id === adminProfile.groupId ? group : null;
  const loadError = groupError ? tx(groupError instanceof Error ? groupError.message : t("errors.loadGroupDetails")) : null;

  const { data: charts = [] } = useCharts(visibleGroup?.id);
  const { data: members = [] } = useMembers(visibleGroup?.id);
  const activeChart = useMemo(() => {
    if (!charts.length) return null;
    if (selectedChartId) {
      const found = charts.find((chart) => chart.id === selectedChartId);
      if (found) return found;
    }
    const currentActive = pickCurrentMonthChart(charts);
    if (currentActive) return currentActive;
    const currentChartId = visibleGroup?.currentChartId;
    if (currentChartId) {
      const found = charts.find((chart) => chart.id === currentChartId);
      if (found) return found;
    }
    return charts[0];
  }, [charts, selectedChartId, visibleGroup?.currentChartId]);
  const { data: monthMeals = [] } = useMealsForChart(visibleGroup?.id, activeChart || undefined);
  const { data: monthCosts = [] } = useCosts(visibleGroup?.id, activeChart?.id);
  const { data: monthDeposits = [] } = useDeposits(visibleGroup?.id, activeChart?.id);
  const isPageLoading = !isLoaded || profileLoading || (!!adminProfile && !visibleGroup && !loadError);
  const displayError =
    loadError ??
    (profileError ? tx(profileError instanceof Error ? profileError.message : t("errors.loadGroupDetails")) : null);

  useGlobalLoading("admin-page", isPageLoading, t("adminDash.loading"));
  useGlobalLoading("admin-page-sign-out", isSignOutInProgress, t("common.signingOut"));
  async function handleLogout() {
    await handleAdminLogout(auth, router, setIsSignOutInProgress, (error) => {
      toast(error.message || "Failed to sign out. Please try again.", "error");
    });
  }

  async function handleDownloadPDF() {
    if (!visibleGroup || !activeChart || members.length === 0) return;

    try {
      await saveChartReportPdf({
        groupName: visibleGroup.name || "Group",
        chartLabel: activeChart.label || "Report",
        monthKeys: activeChart.monthKeys || [activeChart.monthKey],
        members,
        meals: monthMeals || [],
        costs: monthCosts || [],
        deposits: monthDeposits || [],
        fileName: `${visibleGroup.name}_${activeChart.label}_Report.pdf`,
      });
      toast("Report exported successfully", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate PDF";
      console.error("PDF export error:", msg);
      toast(tx(msg), "error");
    }
  }

  if (!isLoaded) {
    return (
      <AdminLoadingState message={t("adminDash.loading")} />
    );
  }

  if (!admin) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--panel)] p-6 shadow-[var(--shadow)] sm:p-8">
        <p className="admin-section-label">{t("adminDash.notSignedIn")}</p>
        <h1 className="mt-2 text-2xl font-semibold">{t("adminDash.accessRequired")}</h1>
        <p className="mt-2 text-sm text-[color:var(--soft-foreground)]">{t("adminDash.signInToManage")}</p>
        <Link className="button-primary mt-5 inline-flex" href="/admin/login">
          {t("adminDash.goLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {displayError && <p className="alert-error">{displayError}</p>}
      {!visibleGroup && !displayError ? <AdminLoadingState compact message={t("adminDash.loading")} /> : null}

      <section className="admin-dashboard-hero !flex-col !items-stretch gap-3">
        <div className="flex items-start justify-between gap-6 sm:items-center w-full">
          <div className="min-w-0 flex-1">
            <p className="admin-section-label">{t("adminDash.workspace")}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {visibleGroup?.name ?? t("adminDash.manageFallback")}
            </h1>
            {activeChart && (
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
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
            )}
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[color:var(--soft-foreground)]">
              {t("adminDash.subtitle")}
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-1.5 shrink-0 min-w-[85px]">
            <button
              onClick={handleDownloadPDF}
              type="button"
              className="button-secondary !py-1 !px-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 rounded-lg w-full transition hover:bg-[color:var(--accent-dim)]"
              disabled={!visibleGroup || !activeChart || members.length === 0}
              aria-label="Export report as PDF"
              title="Export report as PDF"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>PDF</span>
            </button>

            {/* Months option right below download PDF inside the box */}
            <button
              type="button"
              onClick={() => setIsMonthSelectorOpen((prev) => !prev)}
              className="button-secondary !py-1 !px-2.5 text-xs font-semibold flex items-center justify-center gap-1 rounded-lg w-full transition hover:bg-[color:var(--accent-dim)]"
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
                          setSelectedChartId(monthChart.id);
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
      </section>

      {visibleGroup && <AdminMonthSummary groupId={visibleGroup.id} selectedChart={activeChart} />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {navItemKeys.map((item) => (
          <Link key={item.href} href={item.href} className="admin-panel-card">
            <span className="admin-panel-card-index">{item.metric}</span>
            <p className="admin-panel-card-title">{t(item.labelKey)}</p>
            <p className="admin-panel-card-hint">{t(item.hintKey)}</p>
            <span className="admin-panel-card-arrow">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
