"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { useT } from "@/i18n/use-t";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import {
  getMealsForChart,
  listCharts,
  listMembers,
  saveMealEntry,
  saveMealsBatch,
} from "@/lib/firebase/repositories";
import { normalizeMealQuantity, formatMeal } from "@/lib/utils/meal-money";
import { currentMonthKey, pickCurrentMonthChart, toDateInputValue, getChartDates, formatHeaderDate, isChartActive } from "@/lib/utils/date";
import type { AdminProfile, Chart, MealEntry, Member } from "@/types/domain";
import { memberDisplayName, memberIdsForChartRows } from "@/lib/utils/chart-members";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";
import { AdminLoadingState } from "@/components/admin/admin-loading-state";
import { useCurrentAdminProfile } from "@/lib/hooks/use-current-admin-profile";
import { useToast } from "@/lib/hooks/use-toast";



export function EditMealsManager() {
  const { t, tx, language } = useT();
  const { success: showSuccess } = useToast();
  const blocked = !isFirebaseConfigured || !auth;

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [error, setError] = useState<string | null>(blocked ? t("errors.firebaseNotConfigured") : null);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedChart, setSelectedChart] = useState<Chart | null>(null);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [meals, setMeals] = useState<Record<string, Record<string, number>>>({});
  const [tableLoading, setTableLoading] = useState(false);
  const [search, setSearch] = useState("");
  const savingRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const { adminProfile: currentAdminProfile, isLoading: profileLoading, error: profileError } = useCurrentAdminProfile();
  const resolvedError =
    error ??
    (profileError
      ? tx(profileError instanceof Error ? profileError.message : t("errors.loadDataFailed"))
      : !profileLoading && !currentAdminProfile && !blocked
        ? t("errors.logInMeals")
        : null);

  useGlobalLoading(
    "edit-meals-manager",
    isLoading || profileLoading || tableLoading,
    isLoading ? t("common.loading") : t("admin.loadingMeals"),
  );

  useEffect(() => {
    if (blocked) setTimeout(() => setError(t("errors.firebaseNotConfigured")), 0);
  }, [blocked, t]);

  useEffect(() => {
    if (blocked || !auth) return;
    if (profileLoading) return;
    if (profileError) {
      return;
    }
    if (!currentAdminProfile) return;
    let active = true;
    void (async () => {
      try {
        if (!active) return;
        setIsLoading(true);
        const [currentCharts, memberList] = await Promise.all([
          listCharts(currentAdminProfile.groupId),
          listMembers(currentAdminProfile.groupId),
        ]);
        if (!active) return;
        setAdminProfile(currentAdminProfile);
        setCharts(currentCharts);
        setMembers(memberList);
        setError(null);
      } catch (e) {
        if (!active) return;
        setError(tx(e instanceof Error ? e.message : t("errors.loadDataFailed")));
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [blocked, currentAdminProfile, profileError, profileLoading, t, tx]);

  useEffect(() => {
    if (selectedChart || isMonthPickerOpen || charts.length === 0) return;
    let active = true;
    const nextChart = pickCurrentMonthChart(charts);
    setTimeout(() => {
      if (active) setSelectedChart(nextChart);
    }, 0);
    return () => {
      active = false;
    };
  }, [charts, isMonthPickerOpen, selectedChart]);

  useEffect(() => {
    if (!adminProfile || !selectedChart) return;
    let active = true;
    const fetchMeals = async () => {
      setTableLoading(true);
      setMeals({});
      try {
        const mealList = await getMealsForChart(adminProfile.groupId, selectedChart);
        if (!active) return;
        const map: Record<string, Record<string, number>> = {};
        mealList.forEach((m: MealEntry) => {
          const mid = m.memberId.toLowerCase();
          if (!map[mid]) map[mid] = {};
          map[mid][m.date] = normalizeMealQuantity(m.quantity);
        });
        setMeals(map);
      } catch (e) {
        if (active) setError(tx(e instanceof Error ? e.message : t("errors.loadMealsFailed")));
      } finally {
        if (active) setTableLoading(false);
      }
    };

    void fetchMeals();

    return () => {
      active = false;
    };
  }, [adminProfile, selectedChart, t, tx]);

  const mealsAsEntries: MealEntry[] = useMemo(
    () =>
      Object.entries(meals).flatMap(([memberId, byDate]) =>
        Object.entries(byDate).map(([date, quantity]) => ({
          id: "",
          memberId,
          date,
          quantity,
        })),
      ),
    [meals],
  );

  const rowMemberIds = useMemo(() => {
    if (!selectedChart) return [];
    return memberIdsForChartRows(members, mealsAsEntries, selectedChart.monthKeys || [selectedChart.monthKey]);
  }, [members, mealsAsEntries, selectedChart]);

  const filteredRowMemberIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rowMemberIds;
    const formerLabel = t("common.formerMember");
    return rowMemberIds.filter((memberId) => {
      const name = memberDisplayName(memberId, members, formerLabel).toLowerCase();
      const member = members.find((m) => m.id === memberId);
      const email = member?.email?.toLowerCase() || "";
      return name.includes(q) || email.includes(q);
    });
  }, [search, rowMemberIds, members, t]);

  function isActiveMember(memberId: string) {
    return members.some((m) => m.id === memberId);
  }

  function parseMealQuantity(raw: string): number {
    if (raw === "") return 0;
    const n = Number(raw);
    return normalizeMealQuantity(n);
  }

  function handleChange(memberId: string, date: string, raw: string) {
    if (!adminProfile || !selectedChart || selectedChart.locked || !isActiveMember(memberId)) return;
    const val = parseMealQuantity(raw);
    setMeals((prev) => ({
      ...prev,
      [memberId]: { ...(prev[memberId] ?? {}), [date]: val },
    }));
    const key = `${memberId}_${date}`;
    clearTimeout(savingRef.current[key]);
    savingRef.current[key] = setTimeout(() => {
      void (async () => {
        try {
          await saveMealEntry({
            groupId: adminProfile.groupId,
            memberId,
            date,
            quantity: val,
          });
          showSuccess(t("toast.mealSaved"));
        } catch (e) {
          setError(tx(e instanceof Error ? e.message : t("errors.saveMealFailed")));
        }
      })();
    }, 600);
  }

  function handleDefaultChange(date: string, raw: string) {
    if (!adminProfile || !selectedChart || selectedChart.locked) return;
    const val = parseMealQuantity(raw);
    
    setMeals((prev) => {
      const next = { ...prev };
      for (const memberId of rowMemberIds) {
        if (isActiveMember(memberId)) {
          next[memberId] = { ...(next[memberId] ?? {}), [date]: val };
        }
      }
      return next;
    });

    const key = `default_${date}`;
    clearTimeout(savingRef.current[key]);
    savingRef.current[key] = setTimeout(() => {
      void (async () => {
        try {
          const activeMemberIds = rowMemberIds.filter(isActiveMember);
          await saveMealsBatch({
            groupId: adminProfile.groupId,
            memberIds: activeMemberIds,
            date,
            quantity: val,
          });
          showSuccess(t("toast.mealSaved"));
        } catch (e) {
          setError(tx(e instanceof Error ? e.message : t("errors.saveMealFailed")));
        }
      })();
    }, 600);
  }

  function memberTotal(memberId: string) {
    return days.reduce((s, d) => s + (meals[memberId]?.[d] ?? 0), 0);
  }

  function dayTotal(date: string) {
    return rowMemberIds.reduce((s, id) => s + (meals[id]?.[date] ?? 0), 0);
  }

  const former = t("common.formerMember");

  if (isLoading) {
    return <AdminLoadingState message={t("common.loading")} />;
  }

  if (!selectedChart) {
    return (
      <div className="mt-6 grid gap-5">
        {resolvedError && <p className="alert-error">{resolvedError}</p>}

        <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-sm)]">
          <p className="admin-section-label">{t("admin.selectMonth")}</p>
          <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">{t("admin.chooseMonthMeals")}</p>
          {charts.length === 0 ? (
            <p className="mt-4 py-6 text-center text-sm font-bold text-[color:var(--danger)]">
              {t("admin.noChartsMeals")}
            </p>
          ) : (
            <div className="mt-4 grid gap-2">
              {charts.map((chart) => (
                <button
                  key={chart.id}
                  type="button"
                  onClick={() => {
                    setIsMonthPickerOpen(false);
                    setSelectedChart(chart);
                  }}
                  className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3.5 text-left transition hover:border-[color:var(--accent)] hover:bg-[color:var(--accent-dim)]"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{chart.label}</p>
                      {isChartActive(chart) && <span className="badge-accent">{t("common.active")}</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-[color:var(--muted)]">{(chart.monthKeys || [chart.monthKey]).join(", ")}</p>
                  </div>
                  <span className="text-[color:var(--accent)]">→</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const days = getChartDates(selectedChart.monthKeys || [selectedChart.monthKey]);
  const currentDate = toDateInputValue(new Date());
  const todayDate = (selectedChart.monthKeys || [selectedChart.monthKey]).includes(currentDate.slice(0, 7)) ? currentDate : null;
  const grandTotal = rowMemberIds.reduce((s, id) => s + memberTotal(id), 0);

  return (
    <div className="mt-6 grid gap-5">
      {resolvedError && <p className="alert-error">{resolvedError}</p>}

      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3">
        <div>
          <p className="admin-section-label">{t("admin.editMeals")}</p>
          <p className="mt-0.5 font-semibold">{selectedChart.label}</p>
          {selectedChart.locked && (
            <p className="mt-1 text-xs font-semibold text-[color:var(--danger)]">{t("admin.monthLockedMeals")}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setIsMonthPickerOpen(true);
            setSelectedChart(null);
            setMeals({});
            setSearch("");
          }}
          className="button-secondary shrink-0"
        >
          {t("admin.backMonths")}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-semibold">
          {formatMeal(grandTotal)}{" "}
          <span className="text-sm font-normal text-[color:var(--muted)]">{t("admin.totalMeals")}</span>
        </p>
        <input
          className="input w-full sm:w-64"
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("memberMgr.searchPlaceholder")}
          value={search}
        />
      </div>

      {tableLoading ? (
        <AdminLoadingState compact message={t("admin.loadingMeals")} />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[color:var(--border)] shadow-[var(--shadow-sm)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[color:var(--panel)]">
                <th className="sticky left-0 z-10 min-w-[120px] bg-[color:var(--panel)] px-2.5 py-2 text-left text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--muted)]">
                  {t("groupChart.colMember")}
                </th>
                {days.map((date) => {
                  const isToday = date === todayDate;
                  return (
                    <th
                      key={date}
                      className={`min-w-[40px] px-0.5 py-2 text-center text-xs font-semibold tracking-tight ${
                        isToday ? "bg-[color:var(--accent-dim)] text-[color:var(--accent)]" : "text-[color:var(--muted)]"
                      }`}
                    >
                      {formatHeaderDate(date, language)}
                    </th>
                  );
                })}
                <th className="min-w-[50px] px-2.5 py-2 text-center text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--accent)]">
                  {t("groupChart.colTotal")}
                </th>
              </tr>
            </thead>
            <tbody>
              {!search.trim() && (
                <tr className="border-b border-[color:var(--border)] bg-[color:var(--panel)]">
                  <td className="sticky left-0 z-10 bg-[color:var(--panel)] px-3 py-2 text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--accent)]">
                    {t("admin.defaultMeal") || "Default"}
                  </td>
                  {days.map((date) => (
                    <td key={date} className="px-1 py-1 text-center">
                      <input
                        className="w-18 rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-1 text-center text-sm font-medium tabular-nums outline-none transition focus:border-[color:var(--accent)]"
                        min="0"
                        step="0.25"
                        type="number"
                        placeholder="-"
                        disabled={selectedChart.locked}
                        onChange={(e) => handleDefaultChange(date, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2"></td>
                </tr>
              )}
              {filteredRowMemberIds.length === 0 ? (
                <tr>
                  <td
                    colSpan={days.length + 2}
                    className="py-8 text-center text-sm text-[color:var(--soft-foreground)]"
                  >
                    {t("memberMgr.noSearchMatch")}
                  </td>
                </tr>
              ) : (
                filteredRowMemberIds.map((memberId, ri) => (
                  <tr key={memberId} className={ri % 2 === 0 ? "bg-[color:var(--background)]" : "bg-[color:var(--panel)]"}>
                    <td
                      className={`sticky left-0 z-10 px-2.5 py-1.5 text-sm font-medium ${ri % 2 === 0 ? "bg-[color:var(--background)]" : "bg-[color:var(--panel)]"}`}
                    >
                      {memberDisplayName(memberId, members, former)}
                    </td>
                    {days.map((date) => {
                      const val = meals[memberId]?.[date] ?? 0;
                      const isToday = date === todayDate;
                      return (
                        <td key={date} className={`px-0.5 py-1 text-center ${isToday ? "bg-[color:var(--accent-dim)]" : ""}`}>
                          <input
                            className={`w-18 rounded-md border border-transparent bg-transparent px-1 text-center text-sm font-medium tabular-nums outline-none transition focus:border-[color:var(--accent)] focus:bg-[color:var(--panel)] ${
                              isToday ? "border-[color:var(--accent)] bg-[color:var(--panel)]" : ""
                            }`}
                            min="0"
                            step="0.25"
                            type="number"
                            value={val === 0 ? "" : val}
                            placeholder="0"
                            disabled={selectedChart.locked || !isActiveMember(memberId)}
                            onChange={(e) => handleChange(memberId, date, e.target.value)}
                          />
                        </td>
                      );
                    })}
                    <td className="px-2.5 py-1.5 text-center text-sm font-bold text-[color:var(--accent)]">
                      {formatMeal(memberTotal(memberId))}
                    </td>
                  </tr>
                ))
              )}
              <tr className="border-t border-[color:var(--border)] bg-[color:var(--panel)]">
                <td className="sticky left-0 z-10 bg-[color:var(--panel)] px-3 py-2 text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--muted)]">
                  {t("admin.dayTotal")}
                </td>
                {days.map((date) => (
                  <td key={date} className="px-1 py-2 text-center text-xs font-semibold text-[color:var(--soft-foreground)]">
                    {dayTotal(date) ? formatMeal(dayTotal(date)) : ""}
                  </td>
                ))}
                <td className="px-3 py-2 text-center text-sm font-bold">{formatMeal(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {members.length === 0 && (
        <p className="py-4 text-center text-sm text-[color:var(--soft-foreground)]">{t("admin.noMembersYet")}</p>
      )}
    </div>
  );
}
