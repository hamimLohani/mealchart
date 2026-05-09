"use client";

import { useEffect, useState } from "react";
import type { Chart } from "@/types/domain";

export function useGroupSession() {
  const [chart, setChart] = useState<Chart | null>(null);

  useEffect(() => {
    const id = sessionStorage.getItem("mc_chart_id");
    const label = sessionStorage.getItem("mc_chart_label");
    const monthKey = sessionStorage.getItem("mc_chart_month_key");
    const year = sessionStorage.getItem("mc_chart_year");
    const month = sessionStorage.getItem("mc_chart_month");

    if (id && label && monthKey && year && month) {
      setChart({
        id,
        label,
        monthKey,
        year: Number(year),
        month: Number(month),
        totalDays: 31,
        active: true,
        createdAt: "",
      });
    }
  }, []);

  return { chart };
}
