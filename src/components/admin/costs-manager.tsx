"use client";

import { FormEvent, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { createCost, deleteCost, getAdminProfile, listCostsForMonth } from "@/lib/firebase/repositories";
import { toDateInputValue, toMonthKey } from "@/lib/utils/date";
import type { AdminProfile, CostEntry } from "@/types/domain";

export function CostsManager() {
  const configError = !isFirebaseConfigured || !auth
    ? "Firebase is not configured yet." : null;

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [itemName, setItemName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [error, setError] = useState<string | null>(configError);
  const [isLoading, setIsLoading] = useState(!configError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (configError || !auth) return;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setError("Log in as admin to manage costs."); setIsLoading(false); return; }
      try {
        const profile = await getAdminProfile(user.uid);
        if (!profile) throw new Error("No admin profile found.");
        const now = new Date();
        const monthKey = toMonthKey(now.getFullYear(), now.getMonth() + 1);
        const list = await listCostsForMonth(profile.groupId, monthKey);
        setAdminProfile(profile);
        setCosts(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load costs.");
      } finally { setIsLoading(false); }
    });
    return unsub;
  }, [configError]);

  const total = costs.reduce((s, c) => s + c.amount, 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!adminProfile) return;
    const amt = Number(amount);
    if (!itemName.trim() || isNaN(amt) || amt <= 0) {
      setError("Item name and a valid amount are required."); return;
    }
    setError(null); setIsSubmitting(true);
    try {
      const created = await createCost({ groupId: adminProfile.groupId, itemName: itemName.trim(), amount: amt, date });
      setCosts((prev) => [created, ...prev]);
      setItemName(""); setAmount("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add cost.");
    } finally { setIsSubmitting(false); }
  }

  async function handleDelete(costId: string) {
    if (!adminProfile) return;
    try {
      await deleteCost(adminProfile.groupId, costId);
      setCosts((prev) => prev.filter((c) => c.id !== costId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete cost.");
    }
  }

  if (isLoading) return <p className="mt-8 text-sm text-[color:var(--soft-foreground)]">Loading…</p>;

  return (
    <div className="mt-6 grid gap-5">
      {error && <p className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Total Cost</p>
          <p className="mt-1.5 text-2xl font-bold">{total.toFixed(2)} tk</p>
        </div>
        <div className="rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Entries</p>
          <p className="mt-1.5 text-2xl font-bold">{costs.length}</p>
        </div>
      </div>

      {/* Add form */}
      <form onSubmit={handleSubmit} className="grid gap-4 rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Add Cost Entry</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-medium">
            Item name
            <input className="input" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Rice, vegetables…" required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Amount (tk)
            <input className="input" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="250" required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Date
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
        </div>
        <button className="button-primary w-full disabled:opacity-60" disabled={!adminProfile || isSubmitting} type="submit">
          {isSubmitting ? "Adding…" : "Add cost"}
        </button>
      </form>

      {/* List */}
      <div className="grid gap-3">
        {costs.length === 0 && <p className="text-sm text-[color:var(--soft-foreground)]">No costs added yet.</p>}
        {costs.map((cost) => (
          <div key={cost.id} className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3">
            <div>
              <p className="font-semibold">{cost.itemName}</p>
              <p className="text-xs text-[color:var(--muted)]">{cost.date}</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="font-bold">{cost.amount.toFixed(2)} tk</p>
              <button onClick={() => void handleDelete(cost.id)} type="button" className="text-xs text-red-500 hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
