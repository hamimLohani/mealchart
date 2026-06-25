"use client";

import { useEffect, useState } from "react";
import type { Chart } from "@/types/domain";
import { useT } from "@/i18n/use-t";
import { useCharts } from "@/lib/hooks/use-data";
import { useGroupSession } from "@/lib/hooks/use-group-session";
import { currentMonthKey, pickCurrentMonthChart, isChartActive } from "@/lib/utils/date";

const AUTO_SELECTED_CHART_KEY = "mc_auto_selected_chart";

export function GroupMonthSelector({
  groupId,
  groupName,
  autoSelect = false,
}: {
  groupId: string;
  groupName?: string;
  autoSelect?: boolean;
}) {
  const { t } = useT();
  const { chart, clearChart, selectChart } = useGroupSession();
  const { data: charts = [] } = useCharts(groupId);
  const [isExpanded, setIsExpanded] = useState(false);
  const activeMonthKey = currentMonthKey();

  useEffect(() => {
    if (!autoSelect || charts.length === 0) return;
    const hasManuallyExited = sessionStorage.getItem("mc_manual_exit");
    const hasStoredChart = sessionStorage.getItem("mc_chart_id");
    const wasAutoSelected = sessionStorage.getItem(AUTO_SELECTED_CHART_KEY) !== "false";
    const currentMonthChart = charts.find((monthChart) => isChartActive(monthChart));
    const preferredChart = pickCurrentMonthChart(charts);

    if (hasManuallyExited) return;

    if (
      !chart ||
      !hasStoredChart ||
      (wasAutoSelected && currentMonthChart && !isChartActive(chart))
    ) {
      sessionStorage.setItem(AUTO_SELECTED_CHART_KEY, "true");
      selectChart(preferredChart);
    }
  }, [autoSelect, chart, charts, activeMonthKey, selectChart]);

  function handleChartSelect(nextChart: Chart) {
    sessionStorage.setItem(AUTO_SELECTED_CHART_KEY, "false");
    selectChart(nextChart);
    setIsExpanded(false);
  }

  function handleChangeChart() {
    clearChart();
    setIsExpanded(true);
  }

  const shouldShowMonths = isExpanded || !chart;

  return (
    <div className="group-page-grid">
      <div className="group-hero">
        <div className="min-w-0">
          <p className="group-kicker">{groupName ?? t("groupDash.selectMonth")}</p>
          <p className="group-title">{chart ? chart.label : t("groupDash.selectMonth")}</p>
          <p className="mt-2 inline-block rounded-lg bg-[color:var(--accent-dim)] px-2.5 py-1 text-sm font-medium text-[color:var(--accent)]">
            {chart ? (chart.monthKeys || [chart.monthKey]).join(", ") : t("groupDash.selectMonthHelp")}
          </p>
          {chart?.locked && (
            <p className="mt-2 inline-flex rounded-full border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-2 py-0.5 text-xs font-semibold text-[color:var(--danger)]">
              {t("groupDash.monthLocked")}
            </p>
          )}
        </div>
        {chart && (
          <button type="button" onClick={handleChangeChart} className="button-secondary shrink-0">
            {t("groupDash.changeMonth")}
          </button>
        )}
      </div>

      {shouldShowMonths && (
        <div className="group-card">
          <p className="group-kicker">{t("groupDash.availableMonths")}</p>
          {charts.length === 0 ? (
            <p className="mt-4 py-6 text-center text-sm text-[color:var(--soft-foreground)]">
              {t("groupDash.noCharts")}
            </p>
          ) : (
            <div className="mt-3 grid gap-2">
              {charts.map((monthChart) => (
                <button
                  key={monthChart.id}
                  type="button"
                  onClick={() => handleChartSelect(monthChart)}
                  className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2.5 text-left transition hover:border-[color:var(--accent)] hover:bg-[color:var(--accent-dim)]"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{monthChart.label}</p>
                      {isChartActive(monthChart) && <span className="badge-accent">{t("common.active")}</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-[color:var(--muted)]">{(monthChart.monthKeys || [monthChart.monthKey]).join(", ")}</p>
                  </div>
                  <span className="text-[color:var(--accent)]">→</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
