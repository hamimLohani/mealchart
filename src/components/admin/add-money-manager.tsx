"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import {
  createDeposit,
  getAdminProfile,
  listCharts,
  listDepositsForChart,
  listMembers,
} from "@/lib/firebase/repositories";
import { chartMonthDateBounds, toDateInputValue } from "@/lib/utils/date";
import type { AdminProfile, Chart, DepositEntry, Member } from "@/types/domain";

type DepositFormState = { memberId: string; amount: string; date: string };

export function AddMoneyManager() {
  const configurationError =
    !isFirebaseConfigured || !auth
      ? "Firebase is not configured yet. Add your keys in .env.local first."
      : null;

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [error, setError] = useState<string | null>(configurationError);
  const [isLoading, setIsLoading] = useState(!configurationError);

  // Chart selection
  const [selectedChart, setSelectedChart] = useState<Chart | null>(null);
  const [deposits, setDeposits] = useState<DepositEntry[]>([]);
  const [depositsLoading, setDepositsLoading] = useState(false);
  const [form, setForm] = useState<DepositFormState>({ memberId: "", amount: "", date: toDateInputValue(new Date()) });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load admin profile, members, charts
  useEffect(() => {
    if (configurationError || !auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAdminProfile(null); setMembers([]); setCharts([]);
        setError("Log in as an admin to add money for members.");
        setIsLoading(false);
        return;
      }
      try {
        setError(null);
        const profile = await getAdminProfile(user.uid);
        if (!profile) throw new Error("No admin profile was found for the current user.");
        const [currentMembers, currentCharts] = await Promise.all([
          listMembers(profile.groupId),
          listCharts(profile.groupId),
        ]);
        setAdminProfile(profile);
        setMembers(currentMembers);
        setCharts(currentCharts);
        setForm((c) => ({ ...c, memberId: c.memberId || currentMembers[0]?.id || "" }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data.");
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [configurationError]);

  // Load deposits when chart is selected
  useEffect(() => {
    if (!adminProfile || !selectedChart) return;
    let active = true;
    setDepositsLoading(true);
    setDeposits([]);

    listDepositsForChart(adminProfile.groupId, selectedChart.id)
      .then((list) => { if (active) setDeposits(list); })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "Failed to load deposits."); })
      .finally(() => { if (active) setDepositsLoading(false); });

    return () => { active = false; };
  }, [adminProfile, selectedChart]);

  useEffect(() => {
    if (!selectedChart) return;
    const { min, max } = chartMonthDateBounds(selectedChart);
    setForm((c) => ({
      ...c,
      date: c.date < min || c.date > max ? min : c.date,
    }));
  }, [selectedChart]);

  const memberTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const d of deposits) totals.set(d.memberId, (totals.get(d.memberId) ?? 0) + d.amount);
    return totals;
  }, [deposits]);

  const totalDeposited = useMemo(() => deposits.reduce((s, d) => s + d.amount, 0), [deposits]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!adminProfile || !selectedChart) return;
    if (selectedChart.locked) { setError("This month is locked."); return; }
    const amount = Number(form.amount);
    if (!form.memberId || Number.isNaN(amount) || amount <= 0) {
      setError("Select a member and enter a valid deposit amount.");
      return;
    }
    setIsSubmitting(true);
    try {
      const deposit = await createDeposit({
        groupId: adminProfile.groupId,
        chartId: selectedChart.id,
        memberId: form.memberId,
        amount,
        date: form.date,
        collectedByAdminId: adminProfile.id,
      });
      setDeposits((c) => [deposit, ...c]);
      setForm((c) => ({ ...c, amount: "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add money.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <p className="mt-8 text-sm text-[color:var(--soft-foreground)]">Loading…</p>;
  }

  // ── Chart selection ───────────────────────────────────────────────
  if (!selectedChart) {
    return (
      <div className="mt-6 grid gap-5">
        {error && <p className="alert-error">{error}</p>}

        <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-sm)]">
          <p className="admin-section-label">Select Month</p>
          <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">
            Choose the monthly chart to add deposits to.
          </p>
          {charts.length === 0 ? (
            <p className="mt-4 py-6 text-center text-sm text-[color:var(--soft-foreground)]">
              No charts created yet. Create a chart first.
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
                      {i === 0 && <span className="badge-accent">active</span>}
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

  // ── Deposit management for selected chart ─────────────────────────
  const depositDateBounds = chartMonthDateBounds(selectedChart);

  return (
    <div className="mt-6 grid gap-5">
      {error && <p className="alert-error">{error}</p>}

      {/* Header with back */}
      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3">
        <div>
          <p className="admin-section-label">Add Money</p>
          <p className="mt-0.5 font-semibold">{selectedChart.label}</p>
          {selectedChart.locked && (
            <p className="mt-1 text-xs font-semibold text-[color:var(--danger)]">Month locked: deposits disabled</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setSelectedChart(null); setDeposits([]); }}
          className="button-secondary shrink-0"
        >
          ← Months
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Month", value: selectedChart.label },
          { label: "Total deposited", value: `${totalDeposited.toFixed(2)} tk` },
          { label: "Members", value: String(members.length) },
        ].map((s) => (
          <div key={s.label} className="group-stat-card">
            <p className="group-stat-label">{s.label}</p>
            <p className="group-stat-value">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Add deposit form */}
      <form
        className="grid gap-4 rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-sm)]"
        onSubmit={handleSubmit}
      >
        <p className="admin-section-label">Add Deposit</p>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-medium">
            Member
            <select
              className="input"
              onChange={(e) => setForm((c) => ({ ...c, memberId: e.target.value }))}
              value={form.memberId}
            >
              <option value="">Select member</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.fullName}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Amount (tk)
            <input
              className="input"
              min="0"
              onChange={(e) => setForm((c) => ({ ...c, amount: e.target.value }))}
              placeholder="500"
              step="0.01"
              type="number"
              value={form.amount}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Date
            <input
              className="input"
              min={depositDateBounds.min}
              max={depositDateBounds.max}
              onChange={(e) => setForm((c) => ({ ...c, date: e.target.value }))}
              type="date"
              value={form.date}
            />
          </label>
        </div>
        <button
          className="button-primary w-full sm:w-fit"
          disabled={!adminProfile || !members.length || isSubmitting || selectedChart.locked}
          type="submit"
        >
          {isSubmitting ? "Adding…" : "Add money"}
        </button>
      </form>

      {/* Member totals */}
      <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-sm)]">
        <p className="admin-section-label">Member Totals — {selectedChart.label}</p>
        <div className="mt-3 grid gap-2.5 md:grid-cols-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3"
            >
              <p className="font-semibold">{member.fullName}</p>
              <p className="font-bold text-[color:var(--accent)]">
                {(memberTotals.get(member.id) ?? 0).toFixed(2)} tk
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Deposit history */}
      <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-sm)]">
        <p className="admin-section-label">Deposit History — {selectedChart.label}</p>
        <div className="mt-3 grid gap-2.5">
          {depositsLoading && (
            <p className="py-4 text-center text-sm text-[color:var(--soft-foreground)]">Loading…</p>
          )}
          {!depositsLoading && deposits.length === 0 && (
            <p className="py-4 text-center text-sm text-[color:var(--soft-foreground)]">
              No deposits for this month yet.
            </p>
          )}
          {deposits.map((deposit) => {
            const member = members.find((m) => m.id === deposit.memberId);
            return (
              <article
                key={deposit.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3"
              >
                <div>
                  <p className="font-semibold">{member?.fullName ?? "Unknown member"}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--muted)]">{deposit.date}</p>
                </div>
                <p className="text-base font-bold text-[color:var(--accent)]">{deposit.amount.toFixed(2)} tk</p>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
