/**
 * Centralized SWR data hooks.
 * These wrap repository functions so all UI components share the same cache.
 * Cache keys are stable tuples, making deduplication and invalidation predictable.
 */
"use client";

import useSWR from "swr";
import {
  getGroupById,
  listGroups,
  getAdminProfile,
  listMembers,
  listCharts,
  listJoinRequests,
  listDepositsForChart,
  listDepositRequestsForChart,
  listCostsForChart,
  listCostRequestsForChart,
  listNoticesForChart,
  getMealsForMonth,
  getMealsForDate,
  getMealsForChart,
} from "@/lib/firebase/repositories";
import type { Chart } from "@/types/domain";

// ── Group ────────────────────────────────────────────────────────────────────

export function useGroup(groupId: string | undefined) {
  return useSWR(
    groupId ? ["group", groupId] : null,
    ([, id]: [string, string]) => getGroupById(id),
  );
}

export function useGroups() {
  return useSWR("groups", () => listGroups());
}

// ── Admin ────────────────────────────────────────────────────────────────────

export function useAdminProfile(uid: string | undefined) {
  return useSWR(
    uid ? ["admin", uid] : null,
    ([, id]: [string, string]) => getAdminProfile(id),
  );
}

// ── Members ──────────────────────────────────────────────────────────────────

export function useMembers(groupId: string | undefined) {
  return useSWR(
    groupId ? ["members", groupId] : null,
    ([, id]: [string, string]) => listMembers(id),
  );
}

// ── Join Requests ─────────────────────────────────────────────────────────────

export function useJoinRequests(groupId: string | undefined) {
  return useSWR(
    groupId ? ["joinRequests", groupId] : null,
    ([, id]: [string, string]) => listJoinRequests(id),
  );
}

// ── Charts ────────────────────────────────────────────────────────────────────

export function useCharts(groupId: string | undefined) {
  return useSWR(
    groupId ? ["charts", groupId] : null,
    ([, id]: [string, string]) => listCharts(id),
  );
}

// ── Deposits ──────────────────────────────────────────────────────────────────

export function useDeposits(groupId: string | undefined, chartId: string | undefined) {
  return useSWR(
    groupId && chartId ? ["deposits", groupId, chartId] : null,
    ([, gid, cid]: [string, string, string]) => listDepositsForChart(gid, cid),
  );
}

export function useDepositRequests(groupId: string | undefined, chartId: string | undefined) {
  return useSWR(
    groupId && chartId ? ["depositRequests", groupId, chartId] : null,
    ([, gid, cid]: [string, string, string]) => listDepositRequestsForChart(gid, cid),
  );
}

// ── Costs ─────────────────────────────────────────────────────────────────────

export function useCosts(groupId: string | undefined, chartId: string | undefined) {
  return useSWR(
    groupId && chartId ? ["costs", groupId, chartId] : null,
    ([, gid, cid]: [string, string, string]) => listCostsForChart(gid, cid),
  );
}

export function useCostRequests(groupId: string | undefined, chartId: string | undefined) {
  return useSWR(
    groupId && chartId ? ["costRequests", groupId, chartId] : null,
    ([, gid, cid]: [string, string, string]) => listCostRequestsForChart(gid, cid),
  );
}

// ── Notices ───────────────────────────────────────────────────────────────────

export function useNotices(groupId: string | undefined, chartId: string | undefined) {
  return useSWR(
    groupId && chartId ? ["notices", groupId, chartId] : null,
    ([, gid, cid]: [string, string, string]) => listNoticesForChart(gid, cid),
  );
}

// ── Meals (month) ─────────────────────────────────────────────────────────────

export function useMealsForMonth(groupId: string | undefined, monthKey: string | undefined) {
  return useSWR(
    groupId && monthKey ? ["mealsMonth", groupId, monthKey] : null,
    ([, gid, mk]: [string, string, string]) => getMealsForMonth(gid, mk),
  );
}

// ── Meals (date) ──────────────────────────────────────────────────────────────

export function useMealsForDate(groupId: string | undefined, date: string | undefined) {
  return useSWR(
    groupId && date ? ["mealsDate", groupId, date] : null,
    ([, gid, d]: [string, string, string]) => getMealsForDate(gid, d),
  );
}

// ── Meals (chart) ─────────────────────────────────────────────────────────────

export function useMealsForChart(groupId: string | undefined, chart: Chart | undefined | null) {
  const cacheKey = groupId && chart ? ["mealsChart", groupId, chart.id, ...(chart.monthKeys || [chart.monthKey])] : null;
  return useSWR(
    cacheKey,
    () => getMealsForChart(groupId!, chart!),
  );
}
