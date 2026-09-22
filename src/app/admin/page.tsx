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
import { pickCurrentMonthChart } from "@/lib/utils/date";
import { handleAdminLogout } from "@/lib/auth/admin-logout";

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
    href: "/admin/notices",
    labelKey: "adminNav.notices" as const,
    hintKey: "adminNav.noticesHint" as const,
    metric: "06",
  },
];

export default function AdminPage() {
  const { admin, isLoaded } = useAuthStore();
  const router = useRouter();
  const { t, tx } = useT();
  const { toast } = useToast();
  const [isSignOutInProgress, setIsSignOutInProgress] = useState(false);
  const { adminProfile, isLoading: profileLoading, error: profileError } = useCurrentAdminProfile();

  // Use the shared SWR cache for the group — avoids a raw getDoc() on every mount.
  const { data: group = null, error: groupError } = useGroup(adminProfile?.groupId);
  const visibleGroup = adminProfile && group?.id === adminProfile.groupId ? group : null;
  const loadError = groupError ? tx(groupError instanceof Error ? groupError.message : t("errors.loadGroupDetails")) : null;

  const { data: charts = [] } = useCharts(visibleGroup?.id);
  const { data: members = [] } = useMembers(visibleGroup?.id);
  const activeChart = useMemo(() => {
    if (!charts.length) return null;
    const currentActive = pickCurrentMonthChart(charts);
    if (currentActive) return currentActive;
    const currentChartId = visibleGroup?.currentChartId;
    if (currentChartId) {
      const found = charts.find((chart) => chart.id === currentChartId);
      if (found) return found;
    }
    return charts[0];
  }, [charts, visibleGroup?.currentChartId]);
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

      <section className="admin-dashboard-hero">
        <div className="min-w-0">
          <p className="admin-section-label">{t("adminDash.workspace")}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {visibleGroup?.name ?? t("adminDash.manageFallback")}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[color:var(--soft-foreground)]">
            {t("adminDash.subtitle")}
          </p>
        </div>
        <div className="admin-dashboard-hero-actions flex items-center gap-2">
          <button
            onClick={handleDownloadPDF}
            type="button"
            className="button-secondary rounded-full p-2"
            disabled={!visibleGroup || !activeChart || members.length === 0}
            aria-label="Export report as PDF"
            title="Export report as PDF"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        </div>
      </section>

      {visibleGroup && <AdminMonthSummary groupId={visibleGroup.id} />}

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
