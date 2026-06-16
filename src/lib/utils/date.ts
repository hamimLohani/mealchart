export function getCurrentMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  return { start, end };
}

export function toDateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function toMonthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function currentMonthKey(date = new Date()) {
  return toMonthKey(date.getFullYear(), date.getMonth() + 1);
}

export function pickCurrentMonthChart<T extends { monthKey: string }>(charts: T[], date = new Date()) {
  return charts.find((chart) => chart.monthKey === currentMonthKey(date)) ?? charts[0] ?? null;
}

export function formatChartLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function chartMonthDateBounds(chart: { monthKey: string; year: number; month: number }) {
  const lastDay = daysInMonth(chart.year, chart.month);
  return {
    min: `${chart.monthKey}-01`,
    max: `${chart.monthKey}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** Derive YYYY-MM from an ISO date string YYYY-MM-DD */
export function monthKeyFromDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date format.");
  return date.slice(0, 7);
}
