import type { Chart } from "@/types/domain";
import { daysInMonth } from "@/lib/utils/date";

export const GROUP_CHART_SESSION_EVENT = "mc-chart-session-change";

/** Read selected chart from session (client-only; SSR returns null). */
export function readStoredChartFromSession(): Chart | null {
  if (typeof window === "undefined") return null;
  const id = sessionStorage.getItem("mc_chart_id");
  const label = sessionStorage.getItem("mc_chart_label");
  const monthKey = sessionStorage.getItem("mc_chart_month_key");
  const year = sessionStorage.getItem("mc_chart_year");
  const month = sessionStorage.getItem("mc_chart_month");
  const locked = sessionStorage.getItem("mc_chart_locked");

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
  sessionStorage.setItem("mc_chart_id", chart.id);
  sessionStorage.setItem("mc_chart_label", chart.label);
  sessionStorage.setItem("mc_chart_month_key", chart.monthKey);
  sessionStorage.setItem("mc_chart_year", String(chart.year));
  sessionStorage.setItem("mc_chart_month", String(chart.month));
  sessionStorage.setItem("mc_chart_locked", String(chart.locked));
  sessionStorage.removeItem("mc_manual_exit");
  window.dispatchEvent(new Event(GROUP_CHART_SESSION_EVENT));
}

export function clearStoredChartFromSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem("mc_chart_id");
  sessionStorage.removeItem("mc_chart_label");
  sessionStorage.removeItem("mc_chart_month_key");
  sessionStorage.removeItem("mc_chart_year");
  sessionStorage.removeItem("mc_chart_month");
  sessionStorage.removeItem("mc_chart_locked");
  sessionStorage.setItem("mc_manual_exit", "true");
  window.dispatchEvent(new Event(GROUP_CHART_SESSION_EVENT));
}
