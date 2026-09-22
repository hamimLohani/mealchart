"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { auth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useT } from "@/i18n/use-t";
import {
  approveDepositRequest,
  createDeposit,
  getGroupById,
  listCharts,
  listCostsForChart,
  listDepositRequestsForChart,
  listDepositsForChart,
  listMembers,
  getMealsForChart,
  rejectDepositRequest,
} from "@/lib/firebase/repositories";
import { chartMonthDateBounds, currentMonthKey, pickCurrentMonthChart, toMonthKey, toDateInputValue, isChartActive } from "@/lib/utils/date";
import { getMemberTotals, getMonthTotals, normalizeMealQuantity } from "@/lib/utils/meal-money";
import type { AdminProfile, Chart, CostEntry, DepositEntry, DepositRequest, Member, MealEntry } from "@/types/domain";
import { sendMoneyReceiptEmail, sendMoneyRequestEmail, sendBatchMoneyRequestEmails, type MoneyRequestRecipient } from "@/lib/email/actions";
import { getFriendlyEmailError } from "@/lib/utils/email-error";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";
import { AdminLoadingState } from "@/components/admin/admin-loading-state";
import { useCurrentAdminProfile } from "@/lib/hooks/use-current-admin-profile";
import { useToast } from "@/lib/hooks/use-toast";

type DepositFormState = { memberId: string; amount: string; date: string };

export function AddMoneyManager() {
  const { t, tx } = useT();
  const { mutate } = useSWRConfig();
  const { success: showSuccess, error: showError } = useToast();
  const configurationError =
    !isFirebaseConfigured || !auth
      ? "Firebase is not configured yet. Add your keys in .env.local first."
      : null;

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState<string | null>(configurationError);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedChart, setSelectedChart] = useState<Chart | null>(null);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [deposits, setDeposits] = useState<DepositEntry[]>([]);
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([]);
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<DepositFormState>({ memberId: "", amount: "", date: toDateInputValue(new Date()) });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestAction, setRequestAction] = useState<{ id: string; type: "approve" | "reject" } | null>(null);

  // Money reminder section state
  const [reminderTarget, setReminderTarget] = useState<"negative" | "all" | "single">("negative");
  const [selectedSingleMemberId, setSelectedSingleMemberId] = useState("");
  const [reminderAmountMode, setReminderAmountMode] = useState<"due" | "fixed">("due");
  const [fixedAmount, setFixedAmount] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [reminderNote, setReminderNote] = useState("");
  const [isSendingReminders, setIsSendingReminders] = useState(false);

  // Quick remind modal state for a single member row
  const [quickRemindState, setQuickRemindState] = useState<{
    member: Member;
    balance: number;
    paid: number;
    meals: number;
    dueAmount: number;
  } | null>(null);
  const [quickAmount, setQuickAmount] = useState("");
  const [quickPaymentInfo, setQuickPaymentInfo] = useState("");
  const [quickNote, setQuickNote] = useState("");
  const [isSendingQuick, setIsSendingQuick] = useState(false);

  // Restore saved payment instructions
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mealchart_payment_info");
      if (saved) {
        setPaymentInstructions(saved);
        setQuickPaymentInfo(saved);
      }
    } catch {}
  }, []);

  const handlePaymentInfoChange = (val: string) => {
    setPaymentInstructions(val);
    try {
      localStorage.setItem("mealchart_payment_info", val);
    } catch {}
  };

  const { adminProfile: currentAdminProfile, isLoading: profileLoading, error: profileError } = useCurrentAdminProfile();
  const activeAdminProfile =
    currentAdminProfile && adminProfile?.id === currentAdminProfile.id ? adminProfile : null;
  const visibleMembers = useMemo(() => (activeAdminProfile ? members : []), [activeAdminProfile, members]);
  const visibleCharts = useMemo(() => (activeAdminProfile ? charts : []), [activeAdminProfile, charts]);
  const resolvedError =
    error ??
    (profileError
      ? profileError instanceof Error
        ? profileError.message
        : "Failed to load data."
      : !profileLoading && !currentAdminProfile && !configurationError
        ? "Log in as an admin to add money for members."
        : null);

  useGlobalLoading(
    "add-money-manager",
    isLoading || profileLoading || dataLoading || isSubmitting,
    isLoading ? t("common.loading") : isSubmitting ? t("addMoney.adding") : t("common.loading"),
  );

  useEffect(() => {
    if (configurationError || !auth) return;
    if (profileLoading) return;
    if (profileError || !currentAdminProfile) return;

    let active = true;
    void (async () => {
      try {
        if (!active) return;
        setIsLoading(true);
        setError(null);
        const [currentMembers, currentCharts, group] = await Promise.all([
          listMembers(currentAdminProfile.groupId),
          listCharts(currentAdminProfile.groupId),
          getGroupById(currentAdminProfile.groupId),
        ]);
        if (!active) return;
        setAdminProfile(currentAdminProfile);
        setMembers(currentMembers);
        setCharts(currentCharts);
        setGroupName(group?.name ?? "");
        setForm((c) => ({ ...c, memberId: c.memberId || currentMembers[0]?.id || "" }));
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load data.");
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [configurationError, currentAdminProfile, profileError, profileLoading]);

  useEffect(() => {
    if (selectedChart || isMonthPickerOpen || visibleCharts.length === 0) return;
    let active = true;
    const nextChart = pickCurrentMonthChart(visibleCharts);
    setTimeout(() => {
      if (active) setSelectedChart(nextChart);
    }, 0);
    return () => {
      active = false;
    };
  }, [isMonthPickerOpen, selectedChart, visibleCharts]);

  useEffect(() => {
    if (!activeAdminProfile || !selectedChart) return;
    let active = true;

    const loadData = async () => {
      setDataLoading(true);
      setDeposits([]);
      setDepositRequests([]);
      setCosts([]);
      setMeals([]);
      try {
        const [dList, requestList, cList, mList] = await Promise.all([
          listDepositsForChart(activeAdminProfile.groupId, selectedChart.id),
          listDepositRequestsForChart(activeAdminProfile.groupId, selectedChart.id),
          listCostsForChart(activeAdminProfile.groupId, selectedChart.id),
          getMealsForChart(activeAdminProfile.groupId, selectedChart),
        ]);
        if (active) {
          setDeposits(dList);
          setDepositRequests(requestList);
          setCosts(cList);
          setMeals(mList);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load data.");
      } finally {
        if (active) setDataLoading(false);
      }
    };

    void loadData();

    return () => { active = false; };
  }, [activeAdminProfile, selectedChart]);

  useEffect(() => {
    if (!selectedChart) return;
    const { min, max } = chartMonthDateBounds(selectedChart);
    setTimeout(() => {
      setForm((c) => ({
        ...c,
        date: c.date < min || c.date > max ? min : c.date,
      }));
    }, 0);
  }, [selectedChart]);

  const { totalPaid, remainingTaka: balance, mealRate } = useMemo(() => {
    return getMonthTotals(meals, costs, deposits);
  }, [meals, costs, deposits]);

  const memberStatsList = useMemo(() => {
    return visibleMembers.map((member) => {
      const mid = member.id.toLowerCase();
      const memberPaid = deposits
        .filter((d) => d.memberId.toLowerCase() === mid)
        .reduce((s, d) => s + d.amount, 0);
      const memberMealsCount = meals
        .filter((m) => m.memberId.toLowerCase() === mid)
        .reduce((s, m) => s + normalizeMealQuantity(m.quantity), 0);
      const memberEaten = memberMealsCount * mealRate;
      const memberRemaining = memberPaid - memberEaten;
      return {
        member,
        paid: memberPaid,
        meals: memberMealsCount,
        eaten: memberEaten,
        balance: memberRemaining,
        isNegative: memberRemaining < 0,
        dueAmount: memberRemaining < 0 ? Math.abs(memberRemaining) : 0,
      };
    });
  }, [visibleMembers, deposits, meals, mealRate]);

  const negativeStats = useMemo(() => memberStatsList.filter((s) => s.isNegative), [memberStatsList]);

  const targetRecipients = useMemo(() => {
    if (reminderTarget === "negative") {
      return negativeStats;
    }
    if (reminderTarget === "single") {
      const found = memberStatsList.find((s) => s.member.id === selectedSingleMemberId);
      return found ? [found] : [];
    }
    return memberStatsList;
  }, [reminderTarget, negativeStats, memberStatsList, selectedSingleMemberId]);

  const getRecipientAmount = (stat: (typeof memberStatsList)[number]): number => {
    if (reminderAmountMode === "due") {
      return stat.dueAmount > 0 ? stat.dueAmount : (parseFloat(fixedAmount) || 500);
    }
    return parseFloat(fixedAmount) || 0;
  };

  async function handleSendBatchReminders() {
    if (!selectedChart || !activeAdminProfile) return;
    if (targetRecipients.length === 0) {
      showError(t("moneyReminder.noNegativeMembers"));
      return;
    }

    const validRecipients: MoneyRequestRecipient[] = targetRecipients
      .filter((s) => s.member.email && s.member.email.includes("@"))
      .map((s) => ({
        memberEmail: s.member.email,
        memberName: s.member.fullName,
        requestedAmount: getRecipientAmount(s),
        currentBalance: s.balance,
        totalPaid: s.paid,
        totalMeals: s.meals,
        mealRate,
      }))
      .filter((r) => r.requestedAmount > 0);

    if (validRecipients.length === 0) {
      showError("No valid recipients with amount > 0 found.");
      return;
    }

    setIsSendingReminders(true);
    try {
      const result = await sendBatchMoneyRequestEmails({
        groupName: groupName || "মিল চার্ট",
        chartLabel: selectedChart.label,
        adminName: activeAdminProfile.fullName || "Admin",
        paymentInstructions: paymentInstructions.trim() || undefined,
        note: reminderNote.trim() || undefined,
        recipients: validRecipients,
      });

      if (!result.success) {
        showError(result.error || "Failed to send reminder emails.");
      } else if (result.failedCount === 0) {
        showSuccess(t("moneyReminder.batchSuccess", { sent: String(result.sentCount) }));
      } else {
        showSuccess(
          t("moneyReminder.batchPartial", {
            sent: String(result.sentCount),
            total: String(result.totalCount),
            failed: String(result.failedCount),
          }),
        );
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Error sending reminders");
    } finally {
      setIsSendingReminders(false);
    }
  }

  function openQuickRemind(item: (typeof memberStatsList)[number]) {
    setQuickRemindState(item);
    setQuickAmount(item.dueAmount > 0 ? String(Math.round(item.dueAmount)) : "500");
    setQuickPaymentInfo(paymentInstructions);
    setQuickNote("");
  }

  async function handleSendQuickReminder() {
    if (!quickRemindState || !selectedChart || !activeAdminProfile) return;
    const amount = parseFloat(quickAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      showError("Enter a valid amount.");
      return;
    }
    if (!quickRemindState.member.email || !quickRemindState.member.email.includes("@")) {
      showError(t("moneyReminder.noEmailWarning"));
      return;
    }

    setIsSendingQuick(true);
    try {
      const result = await sendMoneyRequestEmail({
        groupName: groupName || "মিল চার্ট",
        chartLabel: selectedChart.label,
        adminName: activeAdminProfile.fullName || "Admin",
        paymentInstructions: quickPaymentInfo.trim() || undefined,
        note: quickNote.trim() || undefined,
        recipient: {
          memberEmail: quickRemindState.member.email,
          memberName: quickRemindState.member.fullName,
          requestedAmount: amount,
          currentBalance: quickRemindState.balance,
          totalPaid: quickRemindState.paid,
          totalMeals: quickRemindState.meals,
          mealRate,
        },
      });

      if (result.success) {
        showSuccess(t("moneyReminder.batchSuccess", { sent: "1" }));
        setQuickRemindState(null);
      } else {
        showError(result.error || "Failed to send email");
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Error sending reminder");
    } finally {
      setIsSendingQuick(false);
    }
  }

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visibleMembers;
    return visibleMembers.filter(m => 
      m.fullName.toLowerCase().includes(q) || 
      m.email.toLowerCase().includes(q)
    );
  }, [search, visibleMembers]);

  const filteredDeposits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deposits;
    return deposits.filter(d => {
      const member = visibleMembers.find(m => m.id.toLowerCase() === d.memberId.toLowerCase());
      return (
        member?.fullName.toLowerCase().includes(q) || 
        member?.email.toLowerCase().includes(q)
      );
    });
  }, [search, deposits, visibleMembers]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!activeAdminProfile || !selectedChart) return;
    if (selectedChart.locked) { setError("This month is locked."); return; }
    const amount = Number(form.amount);
    if (!form.memberId || Number.isNaN(amount) || amount === 0) {
      setError("Select a member and enter a valid deposit amount.");
      return;
    }
    setIsSubmitting(true);
    try {
      const mid = form.memberId.toLowerCase();
      const member = visibleMembers.find(m => m.id.toLowerCase() === mid);
      const deposit = await createDeposit({
        groupId: activeAdminProfile.groupId,
        chartId: selectedChart.id,
        memberId: form.memberId,
        amount,
        date: form.date,
        collectedByAdminId: activeAdminProfile.id,
        memberName: member?.fullName,
      });
      setDeposits((prev) => {
        if (prev.some((d) => d.id === deposit.id)) return prev;
        return [deposit, ...prev];
      });
      showSuccess(amount >= 0 ? t("toast.depositAdded") : t("toast.depositDeducted"));

      if (member) {
        const memberTotal = deposits
          .filter(d => d.memberId.toLowerCase() === mid)
          .reduce((s, d) => s + d.amount, 0) + amount;

        const { balance: memberBalance } = getMemberTotals(
          mid,
          meals,
          [...deposits, deposit],
          mealRate,
        );

        const emailResult = await sendMoneyReceiptEmail(
          member.email,
          member.fullName,
          amount,
          form.date,
          activeAdminProfile.fullName || activeAdminProfile.email,
          groupName,
          memberTotal,
          memberBalance,
        );
        if (!emailResult.success) {
          const friendlyError = getFriendlyEmailError(emailResult.error || "");
          setError(`ERR_TRANS:${JSON.stringify({ 
            key: "errors.emailReceiptFailed", 
            vars: { error: friendlyError } 
          })}`);
        }
      }

      setForm((c) => ({ ...c, amount: "" }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("toast.genericError");
      setError(msg);
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleApproveRequest(requestId: string) {
    if (!activeAdminProfile || !selectedChart) return;
    if (selectedChart.locked) { setError("This month is locked."); return; }
    setError(null);
    setRequestAction({ id: requestId, type: "approve" });
    try {
      const deposit = await approveDepositRequest({
        groupId: activeAdminProfile.groupId,
        chartId: selectedChart.id,
        requestId,
        collectedByAdminId: activeAdminProfile.id,
      });
      setDeposits((prev) => [deposit, ...prev]);
      setDepositRequests((prev) => prev.filter((request) => request.id !== requestId));
      void mutate((key) => Array.isArray(key) && key[0] === "adminChartRequestCounts");
      void mutate(["depositRequests", activeAdminProfile.groupId, selectedChart.id]);
      showSuccess(t("toast.depositRequestApproved"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("toast.genericError");
      setError(msg);
      showError(msg);
    } finally {
      setRequestAction(null);
    }
  }

  async function handleRejectRequest(requestId: string) {
    if (!activeAdminProfile || !selectedChart) return;
    if (selectedChart.locked) { setError("This month is locked."); return; }
    setError(null);
    setRequestAction({ id: requestId, type: "reject" });
    try {
      await rejectDepositRequest(activeAdminProfile.groupId, selectedChart.id, requestId);
      setDepositRequests((prev) => prev.filter((request) => request.id !== requestId));
      void mutate((key) => Array.isArray(key) && key[0] === "adminChartRequestCounts");
      void mutate(["depositRequests", activeAdminProfile.groupId, selectedChart.id]);
      showSuccess(t("toast.depositRequestRejected"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("toast.genericError");
      setError(msg);
      showError(msg);
    } finally {
      setRequestAction(null);
    }
  }

  const tk = t("common.tk");

  if (isLoading) {
    return <AdminLoadingState message={t("common.loading")} />;
  }

  if (!selectedChart) {
    return (
      <div className="mt-6 grid gap-5">
        {resolvedError && <p className="alert-error">{tx(resolvedError)}</p>}

        <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-sm)]">
          <p className="admin-section-label">{t("admin.selectMonth")}</p>
          <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">
            {t("addMoney.selectHelp")}
          </p>
          {visibleCharts.length === 0 ? (
            <p className="mt-4 py-6 text-center text-sm font-bold text-[color:var(--danger)]">
              {t("admin.noChartsMeals")}
            </p>
          ) : (
            <div className="mt-4 grid gap-2">
              {visibleCharts.map((chart) => (
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

  const depositDateBounds = chartMonthDateBounds(selectedChart);

  return (
    <div className="mt-6 grid gap-5">
      {resolvedError && <p className="alert-error">{tx(resolvedError)}</p>}

      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3">
        <div>
          <p className="admin-section-label">{t("addMoney.header")}</p>
          <p className="mt-0.5 font-semibold">{selectedChart.label}</p>
          {selectedChart.locked && (
            <p className="mt-1 text-xs font-semibold text-[color:var(--danger)]">{t("addMoney.monthLocked")}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setIsMonthPickerOpen(true); setSelectedChart(null); setDeposits([]); setDepositRequests([]); }}
          className="button-secondary shrink-0"
        >
          {t("costs.backMonths")}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: t("addMoney.statMonth"), value: selectedChart.label },
          { label: t("groupMoney.statTotalPaid"), value: `${totalPaid.toFixed(2)} ${tk}`, color: "var(--success-text)" },
          { label: t("addMoney.statMembers"), value: String(visibleMembers.length) },
          { 
            label: t("groupChart.statRemaining"), 
            value: `${balance >= 0 ? "+" : ""}${balance.toFixed(2)} ${tk}`,
            color: balance >= 0 ? "var(--success-text)" : "var(--danger)"
          },
        ].map((s) => (
          <div key={s.label} className="group-stat-card">
            <p className="group-stat-label">{s.label}</p>
            <p className="group-stat-value" style={s.color ? { color: s.color } : {}}>{s.value}</p>
          </div>
        ))}
      </div>

      <form
        className="grid gap-4 rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-3.5 sm:p-5 shadow-[var(--shadow-sm)]"
        onSubmit={handleSubmit}
      >
        <p className="admin-section-label">{t("addMoney.formTitle")}</p>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-medium">
            {t("admin.member")}
            <select
              className="input"
              onChange={(e) => setForm((c) => ({ ...c, memberId: e.target.value }))}
              value={form.memberId}
            >
              <option value="">{t("addMoney.selectMember")}</option>
              {visibleMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.fullName}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("admin.amountTk")}
            <input
              className="input"
              onChange={(e) => setForm((c) => ({ ...c, amount: e.target.value }))}
              placeholder="500"
              step="0.01"
              type="number"
              value={form.amount}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("admin.date")}
            <input
              className="input"
              min={depositDateBounds.min}
              max={depositDateBounds.max}
              onChange={(e) => setForm((c) => ({ ...c, date: e.target.value }))}
              placeholder={toDateInputValue(new Date())}
              type="date"
              value={form.date}
            />
          </label>
        </div>
        <button
          className="button-primary w-full sm:w-fit"
          disabled={!activeAdminProfile || !visibleMembers.length || isSubmitting || selectedChart.locked}
          type="submit"
        >
          {isSubmitting ? t("addMoney.adding") : t("addMoney.submit")}
        </button>
      </form>

      <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-3.5 sm:p-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="admin-section-label">{t("addMoney.pendingRequests")}</p>
          <span className="badge-accent">{depositRequests.length}</span>
        </div>
        <div className="mt-3 grid gap-2.5">
          {dataLoading && (
            <AdminLoadingState compact message={t("common.loading")} />
          )}
          {!dataLoading && depositRequests.length === 0 && (
            <p className="py-4 text-center text-sm text-[color:var(--soft-foreground)]">
              {t("addMoney.noRequests")}
            </p>
          )}
          {depositRequests.map((request) => {
            const isApproving = requestAction?.id === request.id && requestAction.type === "approve";
            const isRejecting = requestAction?.id === request.id && requestAction.type === "reject";
            const isActionBusy = requestAction !== null;

            return (
            <article
              key={request.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2.5 sm:px-4 sm:py-3"
            >
              <div className="min-w-0">
                <p className="font-semibold">{request.memberName || request.requestedByEmail}</p>
                <p className="mt-0.5 text-xs text-[color:var(--muted)]">{request.date}</p>
              </div>
              <div className="flex items-center gap-2">
                <p
                  className="text-base font-bold"
                  style={{ color: request.amount >= 0 ? "var(--success-text)" : "var(--danger)" }}
                >
                  {request.amount >= 0 ? "+" : ""}{request.amount.toFixed(2)} {tk}
                </p>
                <button
                  onClick={() => void handleApproveRequest(request.id)}
                  type="button"
                  disabled={selectedChart.locked || isActionBusy}
                  className="button-primary px-3 py-1.5 text-xs"
                >
                  {isApproving ? t("memberMgr.submittingApprove") : t("memberMgr.approve")}
                </button>
                <button
                  onClick={() => void handleRejectRequest(request.id)}
                  type="button"
                  disabled={selectedChart.locked || isActionBusy}
                  className="rounded-full border border-[color:var(--danger-border)] px-3 py-1 text-xs font-semibold text-[color:var(--danger)] transition hover:bg-[color:var(--danger)] hover:text-white"
                >
                  {isRejecting ? t("memberMgr.submittingReject") : t("memberMgr.reject")}
                </button>
              </div>
            </article>
            );
          })}
        </div>
      </div>

      {/* ── Money Reminder & Request Section ── */}
      <div className="rounded-[var(--radius)] border-2 border-[color:var(--accent)]/30 bg-[color:var(--panel)] p-4 sm:p-6 shadow-[var(--shadow)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[color:var(--accent)]/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[color:var(--border)]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--accent-dim)] text-lg">
              🔔
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-base text-[color:var(--foreground)]">{t("moneyReminder.sectionTitle")}</p>
                <span className="badge-accent">{selectedChart.label}</span>
              </div>
              <p className="text-xs text-[color:var(--muted)]">{t("moneyReminder.sectionSubtitle")}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              negativeStats.length > 0 
                ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20" 
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
            }`}>
              {negativeStats.length > 0 ? `⚠️ ${negativeStats.length} জন বকেয়া` : "✅ কোনো বকেয়া নেই"}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {/* Target Selection */}
          <div className="rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] p-3.5 flex flex-col justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--muted)] mb-2">
                1. {t("moneyReminder.targetLabel")}
              </p>
              <div className="grid gap-2">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="reminderTarget"
                    value="negative"
                    checked={reminderTarget === "negative"}
                    onChange={() => setReminderTarget("negative")}
                    className="accent-[color:var(--accent)]"
                  />
                  <span>🔴 {t("moneyReminder.targetNegativeOnly", { count: String(negativeStats.length) })}</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="reminderTarget"
                    value="all"
                    checked={reminderTarget === "all"}
                    onChange={() => setReminderTarget("all")}
                    className="accent-[color:var(--accent)]"
                  />
                  <span>👥 {t("moneyReminder.targetAll", { count: String(visibleMembers.length) })}</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="reminderTarget"
                    value="single"
                    checked={reminderTarget === "single"}
                    onChange={() => setReminderTarget("single")}
                    className="accent-[color:var(--accent)]"
                  />
                  <span>👤 {t("moneyReminder.targetSingle")}</span>
                </label>
              </div>

              {reminderTarget === "single" && (
                <div className="mt-2.5">
                  <select
                    className="input !py-1.5 !text-xs w-full"
                    value={selectedSingleMemberId}
                    onChange={(e) => setSelectedSingleMemberId(e.target.value)}
                  >
                    <option value="">{t("moneyReminder.selectMember")}</option>
                    {memberStatsList.map((s) => (
                      <option key={s.member.id} value={s.member.id}>
                        {s.member.fullName} ({s.balance >= 0 ? "+" : ""}{s.balance.toFixed(0)} ৳)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <p className="text-[11px] text-[color:var(--muted)]">
              নির্বাচিত প্রাপক: <strong className="text-[color:var(--foreground)]">{targetRecipients.length} জন</strong>
            </p>
          </div>

          {/* Amount Mode */}
          <div className="rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] p-3.5 flex flex-col justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--muted)] mb-2">
                2. {t("moneyReminder.amountModeLabel")}
              </p>
              <div className="grid gap-2">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="reminderAmountMode"
                    value="due"
                    checked={reminderAmountMode === "due"}
                    onChange={() => setReminderAmountMode("due")}
                    className="accent-[color:var(--accent)]"
                  />
                  <span>🎯 {t("moneyReminder.amountModeDue")}</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="reminderAmountMode"
                    value="fixed"
                    checked={reminderAmountMode === "fixed"}
                    onChange={() => setReminderAmountMode("fixed")}
                    className="accent-[color:var(--accent)]"
                  />
                  <span>🏷️ {t("moneyReminder.amountModeFixed")}</span>
                </label>
              </div>

              {reminderAmountMode === "fixed" && (
                <div className="mt-2.5">
                  <input
                    type="number"
                    step="50"
                    placeholder={t("moneyReminder.amountPlaceholder")}
                    value={fixedAmount}
                    onChange={(e) => setFixedAmount(e.target.value)}
                    className="input !py-1.5 !text-xs w-full"
                  />
                </div>
              )}
            </div>

            <p className="text-[11px] text-[color:var(--muted)]">
              {reminderAmountMode === "due" 
                ? "সদস্যদের নিজ নিজ বকেয়া পরিমাণ অনুযায়ী রিকোয়েস্ট যাবে" 
                : `প্রতি সদস্যের জন্য নির্ধারিত পরিমাণ: ${fixedAmount || "0"} ৳`}
            </p>
          </div>
        </div>

        {/* Payment Details & Note */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <span>💳 {t("moneyReminder.paymentInfoLabel")}</span>
              <span className="text-[10px] text-[color:var(--muted)]">(অটো-সেভ হয়)</span>
            </span>
            <input
              type="text"
              className="input !py-2 !text-xs"
              placeholder={t("moneyReminder.paymentInfoPlaceholder")}
              value={paymentInstructions}
              onChange={(e) => handlePaymentInfoChange(e.target.value)}
            />
          </label>

          <label className="grid gap-1.5 text-xs font-medium">
            <span>📝 অ্যাডমিন বার্তা / নোট (ঐচ্ছিক)</span>
            <input
              type="text"
              className="input !py-2 !text-xs"
              placeholder="যেমন: আগামী ৩ দিনের মধ্যে টাকা পরিশোধ করুন"
              value={reminderNote}
              onChange={(e) => setReminderNote(e.target.value)}
            />
          </label>
        </div>

        {/* Recipients Mini Checklist Preview */}
        {targetRecipients.length > 0 && (
          <div className="mt-4 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] p-3">
            <p className="text-xs font-bold text-[color:var(--soft-foreground)] mb-2">
              {t("moneyReminder.recipientsPreview", { count: String(targetRecipients.length) })}:
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
              {targetRecipients.map((s) => {
                const reqAmt = getRecipientAmount(s);
                return (
                  <span
                    key={s.member.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--panel)] px-2.5 py-1 text-[11px] font-semibold shadow-2xs"
                  >
                    <span>{s.member.fullName}</span>
                    <span className={s.isNegative ? "text-red-500 font-bold" : "text-[color:var(--muted)]"}>
                      ({s.balance >= 0 ? "+" : ""}{s.balance.toFixed(0)} ৳)
                    </span>
                    <span className="text-[color:var(--accent)] font-bold">
                      → {reqAmt.toFixed(0)} ৳
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Send Action */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[color:var(--border)]">
          <p className="text-xs text-[color:var(--muted)]">
            সদস্যদের নিবন্ধিত ইমেইলে বাংলায় সম্পূর্ণ বিবরণসহ রিকোয়েস্ট পৌঁছাবে।
          </p>
          <button
            type="button"
            disabled={isSendingReminders || targetRecipients.length === 0}
            onClick={handleSendBatchReminders}
            className="button-primary !py-2.5 !px-5 text-xs font-bold flex items-center gap-2 rounded-full shadow-sm"
          >
            {isSendingReminders ? (
              <>
                <span className="animate-spin text-sm">⏳</span>
                <span>{t("moneyReminder.sendingButton")}</span>
              </>
            ) : (
              <>
                <span>✉️</span>
                <span>
                  {t("moneyReminder.sendButton")} ({targetRecipients.length} জন)
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-3.5 sm:p-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="admin-section-label">{t("addMoney.memberTotals")} — {selectedChart.label}</p>
          <input
            className="input w-full sm:w-64"
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("memberMgr.searchPlaceholder")}
            value={search}
          />
        </div>
        <div className="mt-3 grid gap-2.5 md:grid-cols-2">
          {filteredMembers.map((member) => {
            const stat = memberStatsList.find((s) => s.member.id === member.id) ?? {
              member,
              paid: 0,
              meals: 0,
              eaten: 0,
              balance: 0,
              isNegative: false,
              dueAmount: 0,
            };

            return (
              <div
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2.5 sm:px-4 sm:py-3.5"
              >
                <div className="min-w-[120px] flex-1">
                  <p className="font-bold text-[color:var(--foreground)]">{member.fullName}</p>
                  <p className="text-xs text-[color:var(--muted)]">{member.email}</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="grid grid-cols-2 gap-4 sm:gap-6">
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                        {t("groupMoney.statTotalPaid")}
                      </p>
                      <p className="font-semibold text-[color:var(--success-text)]">
                        {stat.paid.toFixed(2)} {tk}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <p 
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: stat.balance >= 0 ? "var(--success-text)" : "var(--danger)" }}
                      >
                        {t("groupChart.statRemaining")}
                      </p>
                      <p 
                        className="font-bold"
                        style={{ color: stat.balance >= 0 ? "var(--success-text)" : "var(--danger)" }}
                      >
                        {stat.balance >= 0 ? "+" : ""}{stat.balance.toFixed(2)} {tk}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openQuickRemind(stat)}
                    title={t("moneyReminder.quickRemind")}
                    className="button-secondary !py-1 !px-2.5 text-xs flex items-center gap-1 rounded-full text-[color:var(--accent)] hover:border-[color:var(--accent)] shadow-2xs"
                  >
                    <span>✉️</span>
                    <span className="hidden sm:inline font-semibold">{t("moneyReminder.quickRemind")}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-3.5 sm:p-5 shadow-[var(--shadow-sm)]">
        <p className="admin-section-label">{t("addMoney.depositHistory")} — {selectedChart.label}</p>
        <div className="mt-3 grid gap-2.5">
          {dataLoading && (
            <AdminLoadingState compact message={t("common.loading")} />
          )}
          {!dataLoading && filteredDeposits.length === 0 && (
            <p className="py-4 text-center text-sm text-[color:var(--soft-foreground)]">
              {search ? t("memberMgr.noSearchMatch") : t("addMoney.emptyDeposits")}
            </p>
          )}
          {filteredDeposits.map((deposit) => {
            const member = visibleMembers.find((m) => m.id.toLowerCase() === deposit.memberId.toLowerCase());
            return (
              <article
                key={deposit.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2.5 sm:px-4 sm:py-3"
              >
                <div>
                  <p className="font-semibold">{member?.fullName ?? t("addMoney.unknownMember")}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--muted)]">{deposit.date}</p>
                </div>
                <p 
                  className="text-base font-bold"
                  style={{ color: deposit.amount >= 0 ? "var(--success-text)" : "var(--danger)" }}
                >
                  {deposit.amount >= 0 ? "+" : ""}{deposit.amount.toFixed(2)} {tk}
                </p>
              </article>
            );
          })}
        </div>
      </div>

      {/* ── Quick Remind Modal ── */}
      {quickRemindState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel-solid)] p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[color:var(--border)]">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--accent-dim)] text-lg">
                  🔔
                </span>
                <div>
                  <h3 className="font-bold text-sm text-[color:var(--foreground)]">
                    {t("moneyReminder.quickModalTitle", { name: quickRemindState.member.fullName })}
                  </h3>
                  <p className="text-xs text-[color:var(--muted)]">{quickRemindState.member.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickRemindState(null)}
                className="text-[color:var(--muted)] hover:text-[color:var(--foreground)] text-lg px-1.5"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 py-2 px-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] flex items-center justify-between text-xs">
              <span className="text-[color:var(--muted)]">বর্তমান ব্যালেন্স:</span>
              <span className={`font-bold ${quickRemindState.balance < 0 ? "text-red-500" : "text-emerald-500"}`}>
                {quickRemindState.balance >= 0 ? "+" : ""}{quickRemindState.balance.toFixed(2)} ৳
              </span>
            </div>

            <div className="mt-3 grid gap-3">
              <label className="grid gap-1 text-xs font-semibold">
                <span>{t("moneyReminder.amountModeLabel")} (টাকা)</span>
                <input
                  type="number"
                  step="50"
                  value={quickAmount}
                  onChange={(e) => setQuickAmount(e.target.value)}
                  className="input !py-1.5 !text-xs font-bold"
                  placeholder="500"
                />
              </label>

              <label className="grid gap-1 text-xs font-semibold">
                <span>💳 টাকা পাঠানোর মাধ্যম ও তথ্য</span>
                <input
                  type="text"
                  value={quickPaymentInfo}
                  onChange={(e) => setQuickPaymentInfo(e.target.value)}
                  className="input !py-1.5 !text-xs"
                  placeholder="যেমন: বিকাশ পার্সোনাল: ০১৭১১-XXXXXX"
                />
              </label>

              <label className="grid gap-1 text-xs font-semibold">
                <span>📝 বিশেষ বার্তা (ঐচ্ছিক)</span>
                <input
                  type="text"
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  className="input !py-1.5 !text-xs"
                  placeholder="যেমন: মেসের রান্নার জন্য দ্রুত পরিশোধ করুন"
                />
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-[color:var(--border)]">
              <button
                type="button"
                disabled={isSendingQuick}
                onClick={() => setQuickRemindState(null)}
                className="button-secondary !py-1.5 !px-3.5 text-xs font-semibold rounded-full"
              >
                {t("moneyReminder.cancel")}
              </button>
              <button
                type="button"
                disabled={isSendingQuick}
                onClick={handleSendQuickReminder}
                className="button-primary !py-1.5 !px-4 text-xs font-bold flex items-center gap-1.5 rounded-full"
              >
                {isSendingQuick ? (
                  <>
                    <span className="animate-spin text-xs">⏳</span>
                    <span>{t("moneyReminder.sendingButton")}</span>
                  </>
                ) : (
                  <>
                    <span>✉️</span>
                    <span>{t("moneyReminder.confirmSend")}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
