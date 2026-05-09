"use client";

import { useState } from "react";
import type { Chart } from "@/types/domain";
import { readStoredChartFromSession } from "@/lib/utils/group-chart-session";

export function useGroupSession() {
  const [chart] = useState<Chart | null>(() => readStoredChartFromSession());
  return { chart };
}
