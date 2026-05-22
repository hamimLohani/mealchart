"use client";

import { useEffect, useState } from "react";
import type { Chart } from "@/types/domain";
import {
  clearStoredChartFromSession,
  GROUP_CHART_SESSION_EVENT,
  readStoredChartFromSession,
  saveStoredChartToSession,
} from "@/lib/utils/group-chart-session";

export function useGroupSession() {
  const [chart, setChart] = useState<Chart | null>(() => readStoredChartFromSession());

  useEffect(() => {
    function syncChart() {
      setChart(readStoredChartFromSession());
    }

    window.addEventListener(GROUP_CHART_SESSION_EVENT, syncChart);
    window.addEventListener("storage", syncChart);
    return () => {
      window.removeEventListener(GROUP_CHART_SESSION_EVENT, syncChart);
      window.removeEventListener("storage", syncChart);
    };
  }, []);

  return {
    chart,
    clearChart: clearStoredChartFromSession,
    selectChart: saveStoredChartToSession,
  };
}
