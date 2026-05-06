"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { createDeposit, getAdminProfile, listDepositsForMonth, listMembers } from "@/lib/firebase/repositories";
import { getCurrentMonthRange, toDateInputValue } from "@/lib/utils/date";
import type { AdminProfile, DepositEntry, Member } from "@/types/domain";

type DepositFormState = {
  memberId: string;
  amount: string;
  date: string;
};

const initialForm: DepositFormState = {
  memberId: "",
  amount: "",
  date: toDateInputValue(new Date()),
};

export function AddMoneyManager() {
  const configurationError =
    !isFirebaseConfigured || !auth
      ? "Firebase is not configured yet. Add your keys in .env.local first."
      : null;
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [deposits, setDeposits] = useState<DepositEntry[]>([]);
  const [form, setForm] = useState<DepositFormState>(initialForm);
  const [error, setError] = useState<string | null>(configurationError);
  const [isLoading, setIsLoading] = useState(!configurationError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (configurationError || !auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAdminProfile(null);
        setMembers([]);
        setDeposits([]);
        setError("Log in as an admin to add money for members.");
        setIsLoading(false);
        return;
      }

      try {
        setError(null);
        const profile = await getAdminProfile(user.uid);

        if (!profile) {
          throw new Error("No admin profile was found for the current user.");
        }

        const [currentMembers, currentDeposits] = await Promise.all([
          listMembers(profile.groupId),
          listDepositsForMonth(profile.groupId, new Date()),
        ]);

        setAdminProfile(profile);
        setMembers(currentMembers);
        setDeposits(currentDeposits);
        setForm((current) => ({
          ...current,
          memberId: current.memberId || currentMembers[0]?.id || "",
        }));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load money data.");
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [configurationError]);

  const memberTotals = useMemo(() => {
    const totals = new Map<string, number>();

    for (const deposit of deposits) {
      totals.set(deposit.memberId, (totals.get(deposit.memberId) ?? 0) + deposit.amount);
    }

    return totals;
  }, [deposits]);

  const totalPaidTaka = useMemo(
    () => deposits.reduce((sum, deposit) => sum + deposit.amount, 0),
    [deposits],
  );

  const monthLabel = useMemo(() => {
    const { start } = getCurrentMonthRange(new Date());

    return start.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!adminProfile) {
      setError("Admin profile is required before creating deposits.");
      return;
    }

    const amount = Number(form.amount);
    if (!form.memberId || Number.isNaN(amount) || amount <= 0) {
      setError("Select a member and enter a valid deposit amount.");
      return;
    }

    setIsSubmitting(true);

    try {
      const deposit = await createDeposit({
        groupId: adminProfile.groupId,
        memberId: form.memberId,
        amount,
        date: form.date,
        collectedByAdminId: adminProfile.id,
      });

      setDeposits((current) => [deposit, ...current]);
      setForm((current) => ({ ...current, amount: "" }));
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Failed to add money.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <p className="mt-8 text-sm text-[color:var(--soft-foreground)]">Loading add-money data...</p>;
  }

  return (
    <div className="mt-8 grid gap-6">
      {error ? (
        <p className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--background)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Current month
          </p>
          <p className="mt-2 text-2xl font-semibold">{monthLabel}</p>
        </div>
        <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--background)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Total money
          </p>
          <p className="mt-2 text-2xl font-semibold">{totalPaidTaka.toFixed(2)} tk</p>
        </div>
        <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--background)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Members
          </p>
          <p className="mt-2 text-2xl font-semibold">{members.length}</p>
        </div>
      </div>

      <form className="grid gap-4 rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--background)] p-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-medium">
            Member
            <select
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
              onChange={(event) =>
                setForm((current) => ({ ...current, memberId: event.target.value }))
              }
              value={form.memberId}
            >
              <option value="">Select member</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Amount
            <input
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
              min="0"
              onChange={(event) =>
                setForm((current) => ({ ...current, amount: event.target.value }))
              }
              placeholder="500"
              step="0.01"
              type="number"
              value={form.amount}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Date
            <input
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
              onChange={(event) =>
                setForm((current) => ({ ...current, date: event.target.value }))
              }
              type="date"
              value={form.date}
            />
          </label>
        </div>

        <button
          className="button-primary w-full sm:w-fit disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!adminProfile || !members.length || isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Adding money..." : "Add money"}
        </button>
      </form>

      <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--background)] p-5">
        <div className="grid gap-3 md:grid-cols-2">
          {members.map((member) => (
            <article
              key={member.id}
              className="rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-4"
            >
              <p className="font-semibold">{member.fullName}</p>
              <p className="mt-2 text-sm text-[color:var(--soft-foreground)]">
                Previous taka: {(memberTotals.get(member.id) ?? 0).toFixed(2)} tk
              </p>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--background)] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Current month deposit history
        </p>
        <div className="mt-4 grid gap-3">
          {deposits.length ? (
            deposits.map((deposit) => {
              const member = members.find((entry) => entry.id === deposit.memberId);

              return (
                <article
                  key={deposit.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-4"
                >
                  <div>
                    <p className="font-semibold">{member?.fullName ?? "Unknown member"}</p>
                    <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">
                      {deposit.date}
                    </p>
                  </div>
                  <p className="text-lg font-semibold">{deposit.amount.toFixed(2)} tk</p>
                </article>
              );
            })
          ) : (
            <p className="text-sm text-[color:var(--soft-foreground)]">
              No money has been added for this month yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
