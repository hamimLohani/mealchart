"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import type { Member } from "@/types/domain";
import { useT } from "@/i18n/use-t";

import { GroupMonthSelector } from "@/components/group/group-month-selector";
import { useGroupSession } from "@/lib/hooks/use-group-session";
import { saveChartReportPdf } from "@/lib/utils/pdf-report";
import { formatMeal, getMonthTotals } from "@/lib/utils/meal-money";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { useGroup, useMembers, useMealsForChart, useCosts, useDeposits } from "@/lib/hooks/use-data";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";

export function GroupDashboard({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { t } = useT();

  const { chart: activeChart } = useGroupSession();
  const [memberSearch, setMemberSearch] = useState("");

  // SWR — shared cache, automatic dedup & background refresh
  const { data: group, error: groupError, isLoading: groupLoading } = useGroup(isFirebaseConfigured ? groupId : undefined);
  const { data: members = [] } = useMembers(group?.id);
  const { data: monthMeals = [], isLoading: mealsLoading } = useMealsForChart(group?.id, activeChart || undefined);
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

  // Step 1: Select month/chart first
  if (!activeChart) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <GroupMonthSelector groupId={group.id} groupName={group.name} autoSelect />
      </motion.div>
    );
  }


  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="group-page-grid">
      <GroupMonthSelector groupId={group.id} groupName={group.name} autoSelect />

      <div className="group-hero">
        <div className="min-w-0">
          <p className="group-kicker">{group.name}</p>
          <p className="group-title">{t("groupNav.home")}</p>
          <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">{activeChart.label}</p>
        </div>
        <button type="button" onClick={handleDownloadPDF} className="button-secondary">
          {t("groupDash.exportCSV", { defaultValue: "Export PDF" })}
        </button>
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
