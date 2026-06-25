"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase/client";
import { doc, getDoc } from "firebase/firestore";
import { useT } from "@/i18n/use-t";
import { groupsCollection } from "@/lib/firebase/paths";
import { useAuthStore } from "@/store/auth-store";
import type { Group } from "@/types/domain";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";
import { AdminLoadingState } from "@/components/admin/admin-loading-state";
import { useCurrentAdminProfile } from "@/lib/hooks/use-current-admin-profile";
import { AdminMonthSummary } from "@/components/admin/admin-month-summary";
import { useCharts, useCosts, useDeposits, useMealsForChart, useMembers } from "@/lib/hooks/use-data";
import { saveChartReportPdf } from "@/lib/utils/pdf-report";

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
  const [group, setGroup] = useState<Group | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSignOutInProgress, setIsSignOutInProgress] = useState(false);
  const { adminProfile, isLoading: profileLoading, error: profileError } = useCurrentAdminProfile();
  const visibleGroup = adminProfile && group?.id === adminProfile.groupId ? group : null;
  const { data: charts = [] } = useCharts(visibleGroup?.id);
  const { data: members = [] } = useMembers(visibleGroup?.id);
  const activeChart = useMemo(() => {
    if (!charts.length) return null;
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

  useEffect(() => {
    let active = true;

    async function loadGroup() {
      if (!adminProfile) return;
      try {
        setLoadError(null);
        if (!db) throw new Error("Firebase not configured.");
        const groupSnap = await getDoc(doc(db, groupsCollection, adminProfile.groupId));
        const currentGroup = groupSnap.exists() ? ({ id: groupSnap.id, ...groupSnap.data() } as Group) : null;
        if (!currentGroup) throw new Error("No group was found for this admin profile.");
        if (!active) return;
        setGroup(currentGroup);
      } catch (error) {
        if (!active) return;
        setLoadError(tx(error instanceof Error ? error.message : t("errors.loadGroupDetails")));
      }
    }

    void loadGroup();
    return () => {
      active = false;
    };
  }, [adminProfile, t, tx]);
  async function handleLogout() {
    setIsSignOutInProgress(true);
    if (auth) await signOut(auth);
    router.push("/?noredirect=1");
  }

  function handleDownloadPDF() {
    if (!visibleGroup || !activeChart || members.length === 0) return;

    try {
      saveChartReportPdf({
        groupName: visibleGroup.name || "Group",
        chartLabel: activeChart.label || "Report",
        monthKeys: activeChart.monthKeys || [activeChart.monthKey],
        members,
        meals: monthMeals || [],
        costs: monthCosts || [],
        deposits: monthDeposits || [],
        fileName: `${visibleGroup.name}_${activeChart.label}_Report.pdf`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate PDF";
      console.error("PDF export error:", msg);
      setLoadError(tx(msg));
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
        <div className="admin-dashboard-hero-actions">
          <button
            onClick={handleDownloadPDF}
            type="button"
            className="button-secondary"
            disabled={!visibleGroup || !activeChart || members.length === 0}
          >
            {t("groupDash.exportCSV", { defaultValue: "Export PDF" })}
          </button>
          <button onClick={handleLogout} type="button" className="button-secondary">
            {t("adminDash.signOut")}
          </button>
        </div>
      </section>

      {visibleGroup && <AdminMonthSummary groupId={visibleGroup.id} />}

      <div className="hidden gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
