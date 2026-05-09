"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import {
  findGroupByToken,
  listMembers,
  listCharts,
  getMealsForMonth,
  listCostsForChart,
  listDepositsForChart,
} from "@/lib/firebase/repositories";
import type { Chart, CostEntry, DepositEntry, Group, MealEntry, Member } from "@/types/domain";
import { GroupTokenMismatchHint } from "@/components/forms/group-token-mismatch-hint";
import { readStoredChartFromSession } from "@/lib/utils/group-chart-session";
import { formatMeal, getMonthTotals } from "@/lib/utils/meal-money";

export function GroupDashboard({
  token,
}: {
  token: string;
}) {
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [monthMeals, setMonthMeals] = useState<MealEntry[]>([]);
  const [monthCosts, setMonthCosts] = useState<CostEntry[]>([]);
  const [monthDeposits, setMonthDeposits] = useState<DepositEntry[]>([]);
  const [isMonthLoading, setIsMonthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Session state (restored synchronously from sessionStorage on client mount)
  const [activeChart, setActiveChart] = useState<Chart | null>(() => readStoredChartFromSession());
  const [memberSearch, setMemberSearch] = useState("");

  // Load group, members, charts
  useEffect(() => {
    if (!token) return;
    let active = true;

    async function load() {
      if (!isFirebaseConfigured) { setError("Firebase is not configured yet."); setIsLoading(false); return; }
      try {
        const currentGroup = await findGroupByToken(token);
        if (!currentGroup) throw new Error("No group found for this token.");
        const [currentMembers, currentCharts] = await Promise.all([
          listMembers(currentGroup.id),
          listCharts(currentGroup.id),
        ]);
        if (!active) return;
        setGroup(currentGroup);
        setMembers(currentMembers);
        setCharts(currentCharts);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load group.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [token]);

  // Load chart scoped month data
  useEffect(() => {
    if (!group || !activeChart) return;
    let active = true;
    setIsMonthLoading(true);
    setMonthMeals([]);
    setMonthCosts([]);
    setMonthDeposits([]);

    Promise.all([
      getMealsForMonth(group.id, activeChart.monthKey),
      listCostsForChart(group.id, activeChart.id),
      listDepositsForChart(group.id, activeChart.id),
    ])
      .then(([meals, costs, deposits]) => {
        if (!active) return;
        setMonthMeals(meals);
        setMonthCosts(costs);
        setMonthDeposits(deposits);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load selected month.");
      })
      .finally(() => {
        if (active) setIsMonthLoading(false);
      });

    return () => { active = false; };
  }, [group, activeChart]);

  function handleMemberSelect(member: Member) {
    router.push(`/group/${token}/member/${member.id}`);
  }

  function handleChartSelect(chart: Chart) {
    sessionStorage.setItem("mc_chart_id", chart.id);
    sessionStorage.setItem("mc_chart_label", chart.label);
    sessionStorage.setItem("mc_chart_month_key", chart.monthKey);
    sessionStorage.setItem("mc_chart_year", String(chart.year));
    sessionStorage.setItem("mc_chart_month", String(chart.month));
    sessionStorage.setItem("mc_chart_locked", String(chart.locked));
    setActiveChart(chart);
  }

  function handleChangeChart() {
    sessionStorage.removeItem("mc_chart_id");
    sessionStorage.removeItem("mc_chart_label");
    sessionStorage.removeItem("mc_chart_month_key");
    sessionStorage.removeItem("mc_chart_year");
    sessionStorage.removeItem("mc_chart_month");
    sessionStorage.removeItem("mc_chart_locked");
    setActiveChart(null);
  }

  if (isLoading) return <p className="py-16 text-center text-sm text-[color:var(--soft-foreground)]">Loading group…</p>;
  if (error) {
    return (
      <div className="mt-8">
        <div className="alert-error">{error}</div>
        <GroupTokenMismatchHint message={error} />
      </div>
    );
  }
  if (!group) return null;

  const { totalMeals: monthTotalMeals, totalCost: monthTotalCost, totalPaid: monthTotalPaid, mealRate, remainingTaka } =
    getMonthTotals(monthMeals, monthCosts, monthDeposits);

  // Step 1: Select month/chart first
  if (!activeChart) {
    return (
      <div className="group-page-grid">
        <div className="group-hero">
          <div className="min-w-0">
            <p className="group-kicker">{group.name}</p>
            <p className="group-title">Select Month</p>
            <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">
              Choose a chart created by the admin to continue.
            </p>
          </div>
        </div>
        <div className="group-card">
          <p className="group-kicker">Available Months</p>
          {charts.length === 0 ? (
            <p className="mt-4 py-6 text-center text-sm text-[color:var(--soft-foreground)]">
              No charts created yet. Ask your admin to create a chart.
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
                      {i === 0 && <span className="badge-accent">active</span>}
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

  return (
    <div className="group-page-grid">
      <div className="group-hero">
        <div className="min-w-0">
          <p className="group-kicker">{group.name}</p>
          <p className="group-title">{activeChart.label}</p>
          <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">
            Review month totals, then select a member.
          </p>
          {activeChart.locked && (
            <p className="mt-1 inline-flex rounded-full border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-2 py-0.5 text-xs font-semibold text-[color:var(--danger)]">
              Month locked: meal editing disabled
            </p>
          )}
        </div>
        <button type="button" onClick={handleChangeChart} className="button-secondary shrink-0">
          ← Back
        </button>
      </div>

      {isMonthLoading ? (
        <p className="py-10 text-center text-sm text-[color:var(--soft-foreground)]">Loading chart totals…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Meal", value: formatMeal(monthTotalMeals) },
            { label: "Total Cost", value: `${monthTotalCost.toFixed(2)} tk` },
            { label: "Total Taka Paid", value: `${monthTotalPaid.toFixed(2)} tk` },
            { label: "Meal Rate", value: `${mealRate.toFixed(2)} tk` },
            { label: "Remaining Taka", value: `${remainingTaka.toFixed(2)} tk` },
            { label: "Members", value: String(members.length) },
          ].map((s) => (
            <div key={s.label} className="group-stat-card">
              <p className="group-stat-label">{s.label}</p>
              <p className="group-stat-value">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="group-card">
        <p className="group-kicker">Select Member</p>
        <input
          className="group-search-input mt-3"
          placeholder="Search members..."
          value={memberSearch}
          onChange={(event) => setMemberSearch(event.target.value)}
          type="search"
        />
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {members
            .filter((member) => {
              const query = memberSearch.trim().toLowerCase();
              return !query || member.fullName.toLowerCase().includes(query);
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
                    Joined {new Date(member.joinDate).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-[color:var(--accent)]">→</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
