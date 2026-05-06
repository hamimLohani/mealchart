"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { getAdminProfile, getMealsForMonth, listMembers, saveMealEntry } from "@/lib/firebase/repositories";
import { toMonthKey } from "@/lib/utils/date";
import type { AdminProfile, MealEntry, Member } from "@/types/domain";

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function EditMealsManager() {
  const configError = !isFirebaseConfigured || !auth ? "Firebase is not configured yet." : null;

  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth() + 1);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  // meals[memberId][date] = quantity
  const [meals, setMeals] = useState<Record<string, Record<string, number>>>({});
  const [error, setError] = useState<string | null>(configError);
  const [isLoading, setIsLoading] = useState(!configError);
  const savingRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const monthKey = toMonthKey(year, month);
  const totalDays = daysInMonth(year, month);
  const days = Array.from({ length: totalDays }, (_, i) => {
    const d = String(i + 1).padStart(2, "0");
    return `${monthKey}-${d}`;
  });

  useEffect(() => {
    if (configError || !auth) return;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setError("Log in as admin to edit meals."); setIsLoading(false); return; }
      try {
        const profile = await getAdminProfile(user.uid);
        if (!profile) throw new Error("No admin profile found.");
        const [memberList, mealList] = await Promise.all([
          listMembers(profile.groupId),
          getMealsForMonth(profile.groupId, monthKey),
        ]);
        const map: Record<string, Record<string, number>> = {};
        mealList.forEach((m: MealEntry) => {
          if (!map[m.memberId]) map[m.memberId] = {};
          map[m.memberId][m.date] = m.quantity;
        });
        setAdminProfile(profile);
        setMembers(memberList);
        setMeals(map);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load meals.");
      } finally { setIsLoading(false); }
    });
    return unsub;
  }, [configError, monthKey]);

  function handleChange(memberId: string, date: string, raw: string) {
    const val = raw === "" ? 0 : Math.max(0, Number(raw));
    setMeals((prev) => ({
      ...prev,
      [memberId]: { ...(prev[memberId] ?? {}), [date]: val },
    }));

    const key = `${memberId}_${date}`;
    clearTimeout(savingRef.current[key]);
    savingRef.current[key] = setTimeout(async () => {
      if (!adminProfile) return;
      await saveMealEntry({ groupId: adminProfile.groupId, memberId, date, quantity: val });
    }, 600);
  }

  function memberTotal(memberId: string) {
    return Object.values(meals[memberId] ?? {}).reduce((s, v) => s + v, 0);
  }

  function dayTotal(date: string) {
    return members.reduce((s, m) => s + (meals[m.id]?.[date] ?? 0), 0);
  }

  const grandTotal = members.reduce((s, m) => s + memberTotal(m.id), 0);

  if (isLoading) return <p className="mt-8 text-sm text-[color:var(--soft-foreground)]">Loading…</p>;

  return (
    <div className="mt-6 grid gap-4">
      {error && <p className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[color:var(--foreground)]">
          {new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          {" · "}
          <span className="text-[color:var(--muted)]">Total: {grandTotal} meals</span>
        </p>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto rounded-[1.5rem] border border-[color:var(--border)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[color:var(--panel)]">
              <th className="sticky left-0 z-10 min-w-[120px] bg-[color:var(--panel)] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.15em] text-[color:var(--muted)]">
                Member
              </th>
              {days.map((date) => (
                <th key={date} className="min-w-[44px] px-1 py-2.5 text-center text-xs font-semibold text-[color:var(--muted)]">
                  {date.slice(8)}
                </th>
              ))}
              <th className="min-w-[56px] px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-[0.15em] text-[color:var(--accent)]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((member, ri) => (
              <tr key={member.id} className={ri % 2 === 0 ? "bg-[color:var(--background)]" : "bg-[color:var(--panel)]"}>
                <td className={`sticky left-0 z-10 px-3 py-2 font-medium ${ri % 2 === 0 ? "bg-[color:var(--background)]" : "bg-[color:var(--panel)]"}`}>
                  {member.fullName}
                </td>
                {days.map((date) => {
                  const val = meals[member.id]?.[date] ?? 0;
                  return (
                    <td key={date} className="px-1 py-1 text-center">
                      <input
                        className="w-10 rounded-lg border border-transparent bg-transparent text-center text-sm font-medium outline-none transition focus:border-[color:var(--accent)] focus:bg-[color:var(--panel)]"
                        min="0"
                        step="0.25"
                        type="number"
                        value={val === 0 ? "" : val}
                        placeholder="0"
                        onChange={(e) => handleChange(member.id, date, e.target.value)}
                      />
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center font-bold text-[color:var(--accent)]">
                  {memberTotal(member.id)}
                </td>
              </tr>
            ))}
            {/* Day totals row */}
            <tr className="border-t border-[color:var(--border)] bg-[color:var(--panel)]">
              <td className="sticky left-0 z-10 bg-[color:var(--panel)] px-3 py-2 text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--muted)]">
                Day total
              </td>
              {days.map((date) => (
                <td key={date} className="px-1 py-2 text-center text-xs font-semibold text-[color:var(--soft-foreground)]">
                  {dayTotal(date) || ""}
                </td>
              ))}
              <td className="px-3 py-2 text-center text-sm font-bold text-[color:var(--foreground)]">
                {grandTotal}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {members.length === 0 && (
        <p className="text-sm text-[color:var(--soft-foreground)]">No members in this group yet.</p>
      )}
    </div>
  );
}
