"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useT } from "@/i18n/use-t";
import {
  createDeposit,
  getGroupById,
  listCharts,
  listDepositsForChart,
  listMembers,
} from "@/lib/firebase/repositories";
import { chartMonthDateBounds, toDateInputValue } from "@/lib/utils/date";
import type { AdminProfile, Chart, DepositEntry, Member } from "@/types/domain";
import { sendMoneyReceiptEmail } from "@/lib/email/actions";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";
import { AdminLoadingState } from "@/components/admin/admin-loading-state";
import { useCurrentAdminProfile } from "@/lib/hooks/use-current-admin-profile";

type DepositFormState = { memberId: string; amount: string; date: string };

export function AddMoneyManager() {
  const { t, tx } = useT();
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
  const [deposits, setDeposits] = useState<DepositEntry[]>([]);
  const [depositsLoading, setDepositsLoading] = useState(false);
  const [form, setForm] = useState<DepositFormState>({ memberId: "", amount: "", date: toDateInputValue(new Date()) });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { adminProfile: currentAdminProfile, isLoading: profileLoading, error: profileError } = useCurrentAdminProfile();
  const activeAdminProfile =
    currentAdminProfile && adminProfile?.id === currentAdminProfile.id ? adminProfile : null;
  const visibleMembers = activeAdminProfile ? members : [];
  const visibleCharts = activeAdminProfile ? charts : [];
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
    isLoading || profileLoading || depositsLoading || isSubmitting,
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
    if (!activeAdminProfile || !selectedChart) return;
    let active = true;

    const loadDeposits = async () => {
      setDepositsLoading(true);
      setDeposits([]);
      try {
        const list = await listDepositsForChart(activeAdminProfile.groupId, selectedChart.id);
        if (active) setDeposits(list);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load deposits.");
      } finally {
        if (active) setDepositsLoading(false);
      }
    };

    void loadDeposits();

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

  const memberTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const d of deposits) {
      const mid = d.memberId.toLowerCase();
      totals.set(mid, (totals.get(mid) ?? 0) + d.amount);
    }
    return totals;
  }, [deposits]);

  const totalDeposited = useMemo(() => deposits.reduce((s, d) => s + d.amount, 0), [deposits]);

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

      if (member) {
        const emailResult = await sendMoneyReceiptEmail(
          member.email,
          member.fullName,
          amount,
          form.date,
          activeAdminProfile.email,
          groupName
        );
        if (!emailResult.success) {
          setError(`Money added, but receipt email failed: ${emailResult.error}`);
        }
      }

      setForm((c) => ({ ...c, amount: "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add money.");
    } finally {
      setIsSubmitting(false);
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
            <p className="mt-4 py-6 text-center text-sm text-[color:var(--soft-foreground)]">
              {t("admin.noChartsMeals")}
            </p>
          ) : (
            <div className="mt-4 grid gap-2">
              {visibleCharts.map((chart, i) => (
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
          onClick={() => { setSelectedChart(null); setDeposits([]); }}
          className="button-secondary shrink-0"
        >
          {t("costs.backMonths")}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: t("addMoney.statMonth"), value: selectedChart.label },
          { label: t("addMoney.statTotalDeposited"), value: `${totalDeposited.toFixed(2)} ${tk}` },
          { label: t("addMoney.statMembers"), value: String(visibleMembers.length) },
        ].map((s) => (
          <div key={s.label} className="group-stat-card">
            <p className="group-stat-label">{s.label}</p>
            <p className="group-stat-value">{s.value}</p>
          </div>
        ))}
      </div>

      <form
        className="grid gap-4 rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-sm)]"
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

      <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-sm)]">
        <p className="admin-section-label">{t("addMoney.memberTotals")} — {selectedChart.label}</p>
        <div className="mt-3 grid gap-2.5 md:grid-cols-2">
          {visibleMembers.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3"
            >
              <p className="font-semibold">{member.fullName}</p>
              <p className="font-bold text-[color:var(--accent)]">
                {(memberTotals.get(member.id.toLowerCase()) ?? 0).toFixed(2)} {tk}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-sm)]">
        <p className="admin-section-label">{t("addMoney.depositHistory")} — {selectedChart.label}</p>
        <div className="mt-3 grid gap-2.5">
        {depositsLoading && (
          <AdminLoadingState compact message={t("common.loading")} />
        )}
          {!depositsLoading && deposits.length === 0 && (
            <p className="py-4 text-center text-sm text-[color:var(--soft-foreground)]">
              {t("addMoney.emptyDeposits")}
            </p>
          )}
          {deposits.map((deposit) => {
            const member = visibleMembers.find((m) => m.id.toLowerCase() === deposit.memberId.toLowerCase());
            return (
              <article
                key={deposit.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3"
              >
                <div>
                  <p className="font-semibold">{member?.fullName ?? t("addMoney.unknownMember")}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--muted)]">{deposit.date}</p>
                </div>
                <p className="text-base font-bold text-[color:var(--accent)]">{deposit.amount.toFixed(2)} {tk}</p>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
