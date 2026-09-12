"use client";

import useSWR from "swr";
import { listCostRequestsForChart, listDepositRequestsForChart } from "@/lib/firebase/repositories";
import { useCharts, useJoinRequests } from "@/lib/hooks/use-data";
import { useCurrentAdminProfile } from "@/lib/hooks/use-current-admin-profile";

export type AdminRequestCountKey = "members" | "money" | "costs";

export function useAdminRequestCounts(): Record<AdminRequestCountKey, number> {
  const { adminProfile } = useCurrentAdminProfile();
  const groupId = adminProfile?.groupId;

  const { data: joinRequests } = useJoinRequests(groupId);
  const { data: charts } = useCharts(groupId);

  // Only query unlocked charts — locked charts can't receive new pending requests,
  // so querying them wastes Firestore reads. This reduces reads from 2×N to 2×active.
  const activeChartIds = charts?.filter((c) => !c.locked).map((c) => c.id) ?? [];

  const { data: chartRequestCounts } = useSWR(
    groupId && activeChartIds.length > 0 ? ["adminChartRequestCounts", groupId, ...activeChartIds] : null,
    async ([, activeGroupId, ...ids]: [string, string, ...string[]]) => {
      const requestGroups = await Promise.all(
        ids.map(async (chartId) => {
          const [depositRequests, costRequests] = await Promise.all([
            listDepositRequestsForChart(activeGroupId, chartId),
            listCostRequestsForChart(activeGroupId, chartId),
          ]);
          return {
            money: depositRequests.length,
            costs: costRequests.length,
          };
        }),
      );

      return requestGroups.reduce(
        (total, requestGroup) => ({
          money: total.money + requestGroup.money,
          costs: total.costs + requestGroup.costs,
        }),
        { money: 0, costs: 0 },
      );
    },
  );

  return {
    members: joinRequests?.length ?? 0,
    money: chartRequestCounts?.money ?? 0,
    costs: chartRequestCounts?.costs ?? 0,
  };
}
