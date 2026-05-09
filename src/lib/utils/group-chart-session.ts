import type { Chart } from "@/types/domain";
import { daysInMonth } from "@/lib/utils/date";

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
