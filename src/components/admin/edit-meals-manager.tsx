"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useT } from "@/i18n/use-t";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import {
  getAdminProfile,
  getMealsForMonth,
  listCharts,
  listMembers,
  saveMealEntry,
} from "@/lib/firebase/repositories";
import type { AdminProfile, Chart, MealEntry, Member } from "@/types/domain";
import { memberDisplayName, memberIdsForChartRows } from "@/lib/utils/chart-members";

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function EditMealsManager() {
  const { t, tx } = useT();
  const blocked = !isFirebaseConfigured || !auth;

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [error, setError] = useState<string | null>(blocked ? t("errors.firebaseNotConfigured") : null);
  const [isLoading, setIsLoading] = useState(!blocked);

  const [selectedChart, setSelectedChart] = useState<Chart | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [meals, setMeals] = useState<Record<string, Record<string, number>>>({});
  const [tableLoading, setTableLoading] = useState(false);
  const savingRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (blocked) setError(t("errors.firebaseNotConfigured"));
  }, [blocked, t]);

  useEffect(() => {
    if (blocked || !auth) return;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setError(t("errors.logInMeals"));
        setIsLoading(false);
        return;
      }
      try {
        const profile = await getAdminProfile(user.uid);
        if (!profile) throw new Error("No admin profile found.");
        const [currentCharts, memberList] = await Promise.all([
          listCharts(profile.groupId),
          listMembers(profile.groupId),
        ]);
        setAdminProfile(profile);
        setCharts(currentCharts);
        setMembers(memberList);
        setError(null);
      } catch (e) {
        setError(tx(e instanceof Error ? e.message : t("errors.loadDataFailed")));
      } finally {
        setIsLoading(false);
      }
    });
    return unsub;
  }, [blocked, t, tx]);

  useEffect(() => {
    if (!adminProfile || !selectedChart) return;
    let active = true;
    setTableLoading(true);
    setMeals({});

    getMealsForMonth(adminProfile.groupId, selectedChart.monthKey)
      .then((mealList) => {
        if (!active) return;
        const map: Record<string, Record<string, number>> = {};
        mealList.forEach((m: MealEntry) => {
          if (!map[m.memberId]) map[m.memberId] = {};
          map[m.memberId][m.date] = m.quantity;
        });
        setMeals(map);
      })
      .catch((e) => {
        if (active) setError(tx(e instanceof Error ? e.message : t("errors.loadMealsFailed")));
      })
      .finally(() => {
        if (active) setTableLoading(false);
      });

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
    return memberIdsForChartRows(members, mealsAsEntries, selectedChart.monthKey);
  }, [members, mealsAsEntries, selectedChart]);

  function isActiveMember(memberId: string) {
    return members.some((m) => m.id === memberId);
  }

  function parseMealQuantity(raw: string): number {
    if (raw === "") return 0;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(20, n);
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
          const member = members.find(m => m.id === memberId);
          await saveMealEntry({
            groupId: adminProfile.groupId,
            memberId,
            date,
            quantity: val,
            chartId: selectedChart.id,
            memberName: member?.fullName,
          });
        } catch (e) {
          setError(tx(e instanceof Error ? e.message : t("errors.saveMealFailed")));
        }
      })();
    }, 600);
  }

  function memberTotal(memberId: string) {
    return Object.values(meals[memberId] ?? {}).reduce((s, v) => s + v, 0);
  }

  function dayTotal(date: string) {
    return rowMemberIds.reduce((s, id) => s + (meals[id]?.[date] ?? 0), 0);
  }

  const former = t("common.formerMember");

  if (isLoading) {
    return <p className="mt-8 text-sm text-[color:var(--soft-foreground)]">{t("common.loading")}</p>;
  }

  if (!selectedChart) {
    return (
      <div className="mt-6 grid gap-5">
        {error && <p className="alert-error">{error}</p>}

        <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-sm)]">
          <p className="admin-section-label">{t("admin.selectMonth")}</p>
          <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">{t("admin.chooseMonthMeals")}</p>
          {charts.length === 0 ? (
            <p className="mt-4 py-6 text-center text-sm text-[color:var(--soft-foreground)]">
              {t("admin.noChartsMeals")}
            </p>
          ) : (
            <div className="mt-4 grid gap-2">
              {charts.map((chart, i) => (
                <button
                  key={chart.id}
                  type="button"
                  onClick={() => setSelectedChart(chart)}
                  className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3.5 text-left transition hover:border-[color:var(--accent)] hover:bg-[color:var(--accent-dim)]"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{chart.label}</p>
                      {i === 0 && <span className="badge-accent">{t("common.active")}</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-[color:var(--muted)]">{chart.monthKey}</p>
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

  const totalDays = daysInMonth(selectedChart.year, selectedChart.month);
  const days = Array.from({ length: totalDays }, (_, i) => {
    const d = String(i + 1).padStart(2, "0");
    return `${selectedChart.monthKey}-${d}`;
  });
  const grandTotal = rowMemberIds.reduce((s, id) => s + memberTotal(id), 0);

  return (
    <div className="mt-6 grid gap-5">
      {error && <p className="alert-error">{error}</p>}

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
            setSelectedChart(null);
            setMeals({});
          }}
          className="button-secondary shrink-0"
        >
          {t("admin.backMonths")}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold">
          {grandTotal}{" "}
          <span className="text-sm font-normal text-[color:var(--muted)]">{t("admin.totalMeals")}</span>
        </p>
      </div>

      {tableLoading ? (
        <p className="py-8 text-center text-sm text-[color:var(--soft-foreground)]">{t("admin.loadingMeals")}</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[color:var(--border)] shadow-[var(--shadow-sm)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[color:var(--panel)]">
                <th className="sticky left-0 z-10 min-w-[120px] bg-[color:var(--panel)] px-3 py-2.5 text-left text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--muted)]">
                  {t("groupChart.colMember")}
                </th>
                {days.map((date) => (
                  <th key={date} className="min-w-[44px] px-1 py-2.5 text-center text-xs font-semibold text-[color:var(--muted)]">
                    {date.slice(8)}
                  </th>
                ))}
                <th className="min-w-[56px] px-3 py-2.5 text-center text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--accent)]">
                  {t("groupChart.colTotal")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rowMemberIds.map((memberId, ri) => (
                <tr key={memberId} className={ri % 2 === 0 ? "bg-[color:var(--background)]" : "bg-[color:var(--panel)]"}>
                  <td
                    className={`sticky left-0 z-10 px-3 py-2 text-sm font-medium ${ri % 2 === 0 ? "bg-[color:var(--background)]" : "bg-[color:var(--panel)]"}`}
                  >
                    {memberDisplayName(memberId, members, former)}
                  </td>
                  {days.map((date) => {
                    const val = meals[memberId]?.[date] ?? 0;
                    return (
                      <td key={date} className="px-1 py-1 text-center">
                        <input
                          className="w-10 rounded-md border border-transparent bg-transparent text-center text-sm font-medium outline-none transition focus:border-[color:var(--accent)] focus:bg-[color:var(--panel)]"
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
                  <td className="px-3 py-2 text-center text-sm font-bold text-[color:var(--accent)]">
                    {memberTotal(memberId)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-[color:var(--border)] bg-[color:var(--panel)]">
                <td className="sticky left-0 z-10 bg-[color:var(--panel)] px-3 py-2 text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--muted)]">
                  {t("admin.dayTotal")}
                </td>
                {days.map((date) => (
                  <td key={date} className="px-1 py-2 text-center text-xs font-semibold text-[color:var(--soft-foreground)]">
                    {dayTotal(date) || ""}
                  </td>
                ))}
                <td className="px-3 py-2 text-center text-sm font-bold">{grandTotal}</td>
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
