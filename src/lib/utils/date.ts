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

export function pickCurrentMonthChart<T extends { monthKey: string; monthKeys?: string[] }>(charts: T[], date = new Date()) {
  const curKey = currentMonthKey(date);
  return charts.find((chart) => {
    if (chart.monthKeys) return chart.monthKeys.includes(curKey);
    return chart.monthKey === curKey;
  }) ?? charts[0] ?? null;
}

export function formatChartLabel(year: number, month: number, duration: number = 1) {
  if (duration <= 1) {
    return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month - 1 + duration - 1, 1);
  const startStr = startDate.toLocaleDateString("en-US", { month: "long" });
  const endStr = endDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${startStr} – ${endStr}`;
  } else {
    const startYearStr = startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return `${startYearStr} – ${endStr}`;
  }
}

export function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function getChartMonthKeys(year: number, month: number, duration: number = 1): string[] {
  const keys: string[] = [];
  for (let i = 0; i < duration; i++) {
    const d = new Date(year, month - 1 + i, 1);
    keys.push(toMonthKey(d.getFullYear(), d.getMonth() + 1));
  }
  return keys;
}

export function getChartDates(chartOrKeys: { year: number; month: number; duration?: number } | string[]) {
  if (Array.isArray(chartOrKeys)) {
    const dates: string[] = [];
    for (const key of chartOrKeys) {
      const [y, m] = key.split("-").map(Number);
      const days = daysInMonth(y, m);
      for (let day = 1; day <= days; day++) {
        dates.push(`${key}-${String(day).padStart(2, "0")}`);
      }
    }
    return dates;
  }
  const duration = chartOrKeys.duration || 1;
  const dates: string[] = [];
  for (let i = 0; i < duration; i++) {
    const d = new Date(chartOrKeys.year, chartOrKeys.month - 1 + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const days = daysInMonth(y, m);
    const monthKey = toMonthKey(y, m);
    for (let day = 1; day <= days; day++) {
      dates.push(`${monthKey}-${String(day).padStart(2, "0")}`);
    }
  }
  return dates;
}

export function isChartActive(chart: { monthKey: string; monthKeys?: string[] }, date = new Date()) {
  const curKey = currentMonthKey(date);
  if (chart.monthKeys) {
    return chart.monthKeys.includes(curKey);
  }
  return chart.monthKey === curKey;
}

export function chartMonthDateBounds(chart: { monthKey: string; year: number; month: number; duration?: number }) {
  const duration = chart.duration || 1;
  const lastMonthYear = new Date(chart.year, chart.month - 1 + duration - 1, 1);
  const lastDay = daysInMonth(lastMonthYear.getFullYear(), lastMonthYear.getMonth() + 1);
  const lastMonthKey = toMonthKey(lastMonthYear.getFullYear(), lastMonthYear.getMonth() + 1);
  return {
    min: `${chart.monthKey}-01`,
    max: `${lastMonthKey}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function formatHeaderDate(dateStr: string, locale: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);
  return dateObj.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

/** Derive YYYY-MM from an ISO date string YYYY-MM-DD */
export function monthKeyFromDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date format.");
  return date.slice(0, 7);
}
