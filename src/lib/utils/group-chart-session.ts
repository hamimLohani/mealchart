import type { Chart } from "@/types/domain";
import { daysInMonth } from "@/lib/utils/date";

export const GROUP_CHART_SESSION_EVENT = "mc-chart-session-change";

/**
 * The member's selected group/chart is persisted in localStorage (not
 * sessionStorage) so it survives fully closing the PWA. This keeps members
 * signed in to their group on their own device until they explicitly exit,
 * mirroring how Firebase keeps admins signed in.
 */

/** Read selected chart from storage (client-only; SSR returns null). */
export function readStoredChartFromSession(): Chart | null {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem("mc_chart_id");
  const label = localStorage.getItem("mc_chart_label");
  const monthKey = localStorage.getItem("mc_chart_month_key");
  const year = localStorage.getItem("mc_chart_year");
  const month = localStorage.getItem("mc_chart_month");
  const locked = localStorage.getItem("mc_chart_locked");

  if (id && label && monthKey && year && month) {
    const y = Number(year);
    const m = Number(month);
    return {
      id,
      label,
      monthKey,
      year: y,
      month: m,
      totalDays: daysInMonth(y, m),
      active: true,
      locked: locked === "true",
      createdAt: "",
    };
  }
  return null;
}

export function saveStoredChartToSession(chart: Chart) {
  if (typeof window === "undefined") return;
  localStorage.setItem("mc_chart_id", chart.id);
  localStorage.setItem("mc_chart_label", chart.label);
  localStorage.setItem("mc_chart_month_key", chart.monthKey);
  localStorage.setItem("mc_chart_year", String(chart.year));
  localStorage.setItem("mc_chart_month", String(chart.month));
  localStorage.setItem("mc_chart_locked", String(chart.locked));
  localStorage.removeItem("mc_manual_exit");
  window.dispatchEvent(new Event(GROUP_CHART_SESSION_EVENT));
}

export function clearStoredChartFromSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("mc_chart_id");
  localStorage.removeItem("mc_chart_label");
  localStorage.removeItem("mc_chart_month_key");
  localStorage.removeItem("mc_chart_year");
  localStorage.removeItem("mc_chart_month");
  localStorage.removeItem("mc_chart_locked");
  localStorage.setItem("mc_manual_exit", "true");
  window.dispatchEvent(new Event(GROUP_CHART_SESSION_EVENT));
}
