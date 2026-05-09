"use client";

import { useEffect, useState } from "react";
import type { Chart } from "@/types/domain";
import { daysInMonth } from "@/lib/utils/date";

export function useGroupSession() {
  const [chart, setChart] = useState<Chart | null>(null);

  useEffect(() => {
    const id = sessionStorage.getItem("mc_chart_id");
    const label = sessionStorage.getItem("mc_chart_label");
    const monthKey = sessionStorage.getItem("mc_chart_month_key");
    const year = sessionStorage.getItem("mc_chart_year");
    const month = sessionStorage.getItem("mc_chart_month");
    const locked = sessionStorage.getItem("mc_chart_locked");

    if (id && label && monthKey && year && month) {
      setChart({
        id,
        label,
        monthKey,
        year: Number(year),
        month: Number(month),
        totalDays: daysInMonth(Number(year), Number(month)),
        active: true,
        locked: locked === "true",
        createdAt: "",
      });
    }
  }, []);

  return { chart };
}
