"use client";

import { useEffect, useState, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/use-t";
import { GroupNavbar } from "@/components/group/group-navbar";
import { GroupMonthSelector } from "@/components/group/group-month-selector";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { saveMealEntry } from "@/lib/firebase/repositories";
import { saveChartReportPdf } from "@/lib/utils/pdf-report";
import { auth } from "@/lib/firebase/client";
import { onAuthStateChanged, User } from "firebase/auth";
import { getAdminProfileForUser } from "@/lib/auth/sign-in-routing";
import { useGroupSession } from "@/lib/hooks/use-group-session";
import { chartMonthDateBounds, getChartDates, toDateInputValue } from "@/lib/utils/date";
import { formatMeal, getMemberTotals, getMonthTotals, normalizeMealQuantity } from "@/lib/utils/meal-money";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useGroup, useMembers, useMealsForChart, useMealsForDate, useCosts, useDeposits, useCharts } from "@/lib/hooks/use-data";
import { mutate } from "swr";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";
export default function MemberPage({
  params,
}: {
  params: Promise<{ groupId: string; memberId: string }>;
}) {
  const { groupId, memberId } = use(params);
  const router = useRouter();
  const { chart } = useGroupSession();
  const { t, language } = useT();
  const locale = language === "bn" ? "bn-BD" : undefined;

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [mealCount, setMealCount] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>(() => toDateInputValue(new Date()));

  // SWR fetching — shared cache
  const { data: group, isLoading: groupLoading } = useGroup(isFirebaseConfigured ? groupId : undefined);
  const { data: allMembers = [] } = useMembers(group?.id);
  const { data: monthMeals = [], isLoading: monthLoading, mutate: mutateMonthMeals } = useMealsForChart(group?.id, chart || undefined);
  const { data: costs = [] } = useCosts(group?.id, chart?.id);
  const { data: deposits = [] } = useDeposits(group?.id, chart?.id);
  const { data: dateMeals = [], isLoading: dateMealLoading } = useMealsForDate(group?.id, selectedDate);
  const { data: charts = [] } = useCharts(group?.id);

  // Generate selectable dates for standard members: today and the next 5 days, filtered to only keep dates in the current selected month.
  const editableDates = useMemo(() => {
    if (!chart) return [];
    const dates = [];
    const baseDate = new Date();
    for (let i = 0; i <= 5; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      const dateStr = toDateInputValue(d);
      // Only include dates in the currently selected chart's month
      if ((chart.monthKeys || [chart.monthKey]).includes(dateStr.slice(0, 7))) {
        dates.push({
          dateStr,
          dateObj: d,
        });
      }
    }
    return dates;
  }, [chart]);

  // Normalize member from the list
  const normalizedMemberId = decodeURIComponent(memberId).toLowerCase();

  useGlobalLoading(
    `member-page-${groupId}-${normalizedMemberId}`,
    groupLoading || monthLoading || dateMealLoading || isSaving,
    groupLoading
      ? t("memberPage.loading")
      : monthLoading
        ? t("memberPage.loadingMonth")
        : dateMealLoading
          ? t("memberPage.loadingMeal")
          : t("memberPage.saving"),
  );

  const member = allMembers.find((m) => m.id.toLowerCase() === normalizedMemberId) ?? null;

  // Sync mealCount from SWR date data
  useEffect(() => {
    let active = true;
    const current = dateMeals.find((e) => e.memberId.toLowerCase() === normalizedMemberId);
    setTimeout(() => {
      if (!active) return;
      setMealCount(current?.quantity ?? 0);
      setSaved(false);
    }, 0);
    return () => {
      active = false;
    };
  }, [dateMeals, normalizedMemberId]);

  // Clamp selected date to chart bounds when chart changes
  useEffect(() => {
    if (!chart) return;
    let active = true;
    const bounds = chartMonthDateBounds(chart);
    const today = toDateInputValue(new Date());
    const clamped = today < bounds.min ? bounds.min : today > bounds.max ? bounds.max : today;
    setTimeout(() => {
      if (active) setSelectedDate(clamped);
    }, 0);
    return () => {
      active = false;
    };
  }, [chart]);

  // Auth state — needed for permission checks
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const admin = await getAdminProfileForUser(user);
          setIsAdmin(admin?.groupId === groupId);
        } catch {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });
  }, [groupId]);

  const tk = t("common.tk");

  if (!isFirebaseConfigured) {
    return <p className="py-16 text-center text-sm text-[color:var(--soft-foreground)]">Firebase is not configured yet.</p>;
  }

  if (groupLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-8">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="mt-4 h-48 w-full" />
      </div>
    );
  }
  if (!group || !member) return null;
  if (!chart) {
    return (
      <div className="mx-auto w-full max-w-7xl px-2.5 py-4 sm:px-8 sm:py-6 md:flex md:items-start md:gap-6 md:py-8">
        <GroupNavbar groupId={groupId} />
        <div className="min-w-0 flex-1 space-y-4 pb-20 md:pb-0">
          <GroupMonthSelector groupId={group.id} groupName={group.name} autoSelect />
          <div className="alert-warn">{t("memberPage.selectMonthWarn")}</div>
          <button type="button" onClick={() => router.push(`/group/${groupId}`)} className="button-secondary w-full">
            {t("memberPage.backToHome")}
          </button>
        </div>
      </div>
    );
  }

  const dateBounds = chartMonthDateBounds(chart);
  const monthStart = dateBounds.min;
  const monthEnd = dateBounds.max;
  const { mealRate, totalMeals, totalCost: monthTotalCost, totalPaid: monthTotalPaid, remainingTaka } = getMonthTotals(monthMeals, costs, deposits);
  const myDeposits = deposits.filter((deposit) => deposit.memberId.toLowerCase() === normalizedMemberId);
  const memberTotals = getMemberTotals(normalizedMemberId, monthMeals, deposits, mealRate);
  const myMeals = memberTotals.memberMeals.sort((a, b) => a.date.localeCompare(b.date));
  const myTotalMeals = memberTotals.totalMeals;
  const myTotalPaid = memberTotals.totalPaid;
  const myCost = memberTotals.totalCost;
  const myBalance = memberTotals.balance;
  const days = getChartDates(chart.monthKeys || [chart.monthKey]).map((date) => {
    const day = parseInt(date.slice(8), 10);
    const meal = myMeals.find((entry) => entry.date === date);
    return { day, date, qty: meal?.quantity ?? 0 };
  });

  const isOwner = currentUser?.email?.toLowerCase() === member?.email?.toLowerCase();
  const canEdit = isOwner || isAdmin;

  function isDateLocked(dateStr: string) {
    if (!canEdit) return true;
    const mKey = dateStr.slice(0, 7);
    if (chart && (chart.monthKeys || [chart.monthKey]).includes(mKey)) {
      return chart.locked;
    }
    const targetChart = charts.find((c) => (c.monthKeys || [c.monthKey]).includes(mKey));
    if (targetChart) {
      return targetChart.locked;
    }
    return false;
  }

  const isLocked = isDateLocked(selectedDate);

  function handleDownloadPDF() {
    if (!chart || !group) return;
    try {
      saveChartReportPdf({
        groupName: group.name || "Group",
        chartLabel: chart.label,
        monthKeys: chart.monthKeys || [chart.monthKey],
        members: allMembers,
        meals: monthMeals,
        costs,
        deposits,
        fileName: `${group.name}_${chart.label}_Report.pdf`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate PDF.";
      console.error("PDF export failed:", message);
    }
  }

  async function handleMealChange(value: number) {
    if (!group || !selectedDate || !chart || isLocked) return;
    const clamped = normalizeMealQuantity(value);
    setMealCount(clamped);
    setSaved(false);
    setSaveError(null);
    setIsSaving(true);
    try {
      await saveMealEntry({ groupId: group.id, memberId: normalizedMemberId, date: selectedDate, quantity: clamped });
      setSaved(true);
      // Invalidate SWR caches so all views refresh automatically
      void mutateMonthMeals();
      void mutate(["mealsDate", group.id, selectedDate]);
    } catch (err) {
      const isPermissionDenied =
        err instanceof Error &&
        (err.message.includes("PERMISSION_DENIED") || err.message.includes("Missing or insufficient permissions"));
      setSaveError(isPermissionDenied ? t("memberPage.monthLockedShort") : "Failed to save meal.");
    } finally {
      setIsSaving(false);
    }
  }

  const statusLine = chart.locked
    ? t("memberPage.monthLockedShort")
    : !canEdit
      ? t("memberPage.cannotEditMeals")
      : saveError
        ? <span className="text-[color:var(--danger)]">{saveError}</span>
        : isSaving
          ? t("memberPage.saving")
          : saved
            ? t("memberPage.saved")
            : t("memberPage.tapUpdate");

  return (
    <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mx-auto w-full max-w-7xl px-2.5 py-4 sm:px-8 sm:py-6 md:flex md:items-start md:gap-6 md:py-8">
      <GroupNavbar groupId={groupId} />
      <div className="min-w-0 flex-1 pb-20 md:pb-0">
        <GroupMonthSelector groupId={group.id} groupName={group.name} autoSelect />
        <div className="py-6 grid gap-4">
          <div className="group-hero flex items-start justify-between gap-3 sm:items-center">
            <div className="min-w-0">
              <p className="group-kicker">{group.name} · {chart.label}</p>
              <p className="group-title">{member.fullName}</p>
              <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">{t("memberPage.monthInfoSubtitle")}</p>
              {chart.locked && (
                <p className="mt-1 inline-flex rounded-full border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-2 py-0.5 text-xs font-semibold text-[color:var(--danger)]">
                  {t("memberPage.monthLocked")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="button-secondary rounded-full p-2"
              aria-label={t("groupDash.exportCSV", { defaultValue: "Export PDF" })}
              title={t("groupDash.exportCSV", { defaultValue: "Export PDF" })}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          </div>

        {monthLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <>
            <motion.div layout transition={{ duration: 0.18, ease: "easeOut" }} className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {[
                { label: t("memberPage.statMyMeals"), value: formatMeal(myTotalMeals) },
                { label: t("memberPage.statMyCost"), value: `${myCost.toFixed(2)} ${tk}`, color: "var(--success-text)" },
                { label: t("memberPage.statMyPaid"), value: `${myTotalPaid.toFixed(2)} ${tk}`, color: "var(--success-text)" },
                { label: t("memberPage.statMealRate"), value: `${mealRate.toFixed(2)} ${tk}`, color: "var(--accent)" },
                { 
                  label: t("memberPage.statBalance"), 
                  value: `${myBalance >= 0 ? "+" : ""}${myBalance.toFixed(2)} ${tk}`,
                  color: myBalance < 0 ? "var(--danger)" : "var(--success-text)"
                },
              ].map((s) => (
                <div key={s.label} className="group-stat-card">
                  <p className="group-stat-label" style={s.color ? { color: s.color, opacity: 0.8 } : {}}>{s.label}</p>
                  <p className="group-stat-value" style={s.color ? { color: s.color } : {}}>{s.value}</p>
                </div>
              ))}
            </motion.div>

            <div className="rounded-[var(--radius)] border-2 border-[color:var(--accent)] bg-[color:var(--panel)] p-5 shadow-[0_0_0_4px_var(--accent-dim)]">
              <p className="group-kicker text-[color:var(--accent)]">{t("memberPage.addMeal")} ({chart.label})</p>
              {chart.locked && (
                <p className="mt-1 text-xs font-semibold text-[color:var(--danger)]">{t("memberPage.monthLocked")}</p>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-[220px_1fr] sm:items-center">
                {isAdmin ? (
                  <input
                    type="date"
                    className="input"
                    min={monthStart}
                    max={monthEnd}
                    placeholder={toDateInputValue(new Date())}
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    disabled={isLocked}
                  />
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="relative w-full"
                  >
                    <select
                      className="input w-full appearance-none pr-8 font-bold bg-[color:var(--panel)] border-2 border-[color:var(--accent)] text-[color:var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] cursor-pointer"
                      value={selectedDate}
                      onChange={(event) => setSelectedDate(event.target.value)}
                      disabled={isLocked}
                    >
                      {editableDates.length === 0 ? (
                        <option value={selectedDate}>
                          {new Date(selectedDate).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
                        </option>
                      ) : (
                        editableDates.map(({ dateStr, dateObj }) => {
                          const isToday = dateStr === toDateInputValue(new Date());
                          const label = dateObj.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
                          return (
                            <option key={dateStr} value={dateStr}>
                              {label}{isToday ? ` (${t("common.today")})` : ""}
                            </option>
                          );
                        })
                      )}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[color:var(--accent)]">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                      </svg>
                    </div>
                  </motion.div>
                )}
                {dateMealLoading ? (
                  <p className="text-sm text-[color:var(--soft-foreground)]">{t("memberPage.loadingMeal")}</p>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <button className="meal-stepper-button" disabled={mealCount <= 0 || isLocked} onClick={() => handleMealChange(mealCount - 0.25)} type="button">−</button>
                      <span className="w-24 px-2 text-center text-4xl font-bold tabular-nums">{formatMeal(mealCount)}</span>
                      <button className="meal-stepper-button" disabled={isLocked} onClick={() => handleMealChange(mealCount + 0.25)} type="button">+</button>
                    </div>
                    <p className={`text-sm font-semibold ${chart.locked ? "text-[color:var(--danger)]" : "text-[color:var(--muted)]"}`}>
                      {statusLine}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4">
              <p className="group-kicker">{t("memberPage.monthTotals")}</p>
            </div>

            <motion.div layout transition={{ duration: 0.18, ease: "easeOut" }} className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-5">
              {[
                { label: t("memberPage.statTotalMeals"), value: formatMeal(totalMeals) },
                { label: t("memberPage.statTotalCost"), value: `${monthTotalCost.toFixed(2)} ${tk}`, color: "var(--success-text)" },
                { label: t("memberPage.statTotalPaid"), value: `${monthTotalPaid.toFixed(2)} ${tk}`, color: "var(--success-text)" },
                { label: t("memberPage.statTotalRemaining"), value: `${remainingTaka >= 0 ? "+" : ""}${remainingTaka.toFixed(2)} ${tk}`, color: remainingTaka < 0 ? "var(--danger)" : "var(--success-text)" },
                { label: t("memberPage.statTotalMembers"), value: allMembers.length },
              ].map((s) => (
                <div key={s.label} className="group-stat-card">
                  <p className="group-stat-label" style={s.color ? { color: s.color, opacity: 0.8 } : {}}>{s.label}</p>
                  <p className="group-stat-value" style={s.color ? { color: s.color } : {}}>{s.value}</p>
                </div>
              ))}
            </motion.div>

            <div className="group-card">
              <p className="group-kicker">{t("memberPage.dailyMeals")} — {chart.label}</p>
              <div className="mt-4 grid gap-1.5">
                {days.map(({ day, date, qty }) => {
                  const isToday = date === selectedDate;
                  return (
                    <div 
                      key={date} 
                      className={`flex items-center gap-3 rounded-lg px-2 py-1 transition-colors ${
                        isToday 
                          ? "bg-[color:var(--accent-dim)] ring-1 ring-[color:var(--accent)]" 
                          : "hover:bg-[color:var(--background-alt)]"
                      }`}
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                        isToday 
                          ? "bg-[color:var(--accent)] text-white" 
                          : "bg-[color:var(--panel)] text-[color:var(--muted)] border border-[color:var(--border)]"
                      }`}>
                        {day}
                      </div>
                      <div className="flex flex-1 items-center justify-between">
                        <p className={`text-sm ${isToday ? "font-bold text-[color:var(--accent)]" : "text-[color:var(--soft-foreground)]"}`}>
                          {new Date(date).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
                        </p>
                        <span className={`text-sm font-bold tabular-nums ${isToday ? "text-[color:var(--accent)]" : "text-[color:var(--foreground)]"}`}>
                          {formatMeal(qty)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="group-card">
              <p className="group-kicker">{t("memberPage.mealEntries")}</p>
              <div className="mt-3 divide-y divide-[color:var(--border)]">
                {myMeals.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[color:var(--soft-foreground)]">{t("memberPage.noMeals")}</p>
                ) : (
                  myMeals.map((meal) => (
                    <div key={`${meal.memberId}-${meal.date}`} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-semibold">{meal.date}</p>
                        <p className="text-xs text-[color:var(--muted)]">
                          {formatMeal(meal.quantity)} {meal.quantity !== 1 ? t("memberPage.mealsWord") : t("memberPage.mealWord")}
                        </p>
                      </div>
                      <p 
                        className="font-bold"
                        style={{ color: (meal.quantity * mealRate) >= 0 ? "var(--success-text)" : "var(--danger)" }}
                      >
                        {(meal.quantity * mealRate).toFixed(2)} ${tk}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="group-card">
              <p className="group-kicker">{t("memberPage.paidHistory")}</p>
              <div className="mt-3 divide-y divide-[color:var(--border)]">
                {myDeposits.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[color:var(--soft-foreground)]">{t("memberPage.noPaid")}</p>
                ) : (
                  myDeposits.map((deposit) => (
                    <div key={deposit.id} className="flex items-center justify-between py-2.5">
                      <p className="text-sm font-semibold">
                        {new Date(deposit.date + "T12:00:00").toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" })}
                      </p>
                      <p 
                        className="font-bold"
                        style={{ color: deposit.amount >= 0 ? "var(--success-text)" : "var(--danger)" }}
                      >
                        {deposit.amount.toFixed(2)} ${tk}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </motion.main>
  );
}
