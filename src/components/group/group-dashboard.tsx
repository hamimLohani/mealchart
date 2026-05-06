"use client";

import { useEffect, useRef, useState } from "react";


import { useRouter } from "next/navigation";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import {
  findGroupByToken,
  getMealsForDate,
  listMembers,
  saveMealEntry,
} from "@/lib/firebase/repositories";
import type { Group, MealEntry, Member } from "@/types/domain";


// Format a meal quantity cleanly: 0 → "0", 1.25 → "1¼", 0.75 → "¾" etc.
function formatMeal(n: number): string {
  const whole = Math.floor(n);
  const frac = Math.round((n - whole) * 4); // quarters
  const fracStr = [" ", "¼", "½", "¾"][frac] ?? "";
  if (whole === 0 && frac === 0) return "0";
  if (whole === 0) return fracStr.trim();
  if (frac === 0) return String(whole);
  return `${whole}${fracStr}`;
}
function localDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function GroupDashboard({ token }: { token: string }) {

  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState<string>("");






  const [meals, setMeals] = useState<Record<string, number>>({});

  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [activeMemberName, setActiveMemberName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const today = localDateString();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    // Read who selected themselves on the enter-group page
    const storedId = sessionStorage.getItem("mc_member_id");
    const storedName = sessionStorage.getItem("mc_member_name");

    if (!storedId) {
      // No member selected — send back to enter-group
      router.replace("/enter-group");
      return;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    queueMicrotask(() => {
      setActiveMemberId(storedId);
      setActiveMemberName(storedName);
    });
  }, [router]);

  useEffect(() => {
    if (!activeMemberId) return;
    let active = true;

    async function load() {
      if (!isFirebaseConfigured) {
        setError("Firebase is not configured yet.");
        setIsLoading(false);
        return;
      }
      try {
        const currentGroup = await findGroupByToken(token);
        if (!currentGroup) throw new Error("No group found for this token.");

        const [currentMembers, todayMeals] = await Promise.all([
          listMembers(currentGroup.id),
          getMealsForDate(currentGroup.id, today),
        ]);

        if (!active) return;

        const mealMap: Record<string, number> = {};
        todayMeals.forEach((m: MealEntry) => { mealMap[m.memberId] = m.quantity; });

        setGroup(currentGroup);
        setMembers(currentMembers);
        setMeals(mealMap);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load group.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [token, today, activeMemberId]);

  function handleMealChange(memberId: string, value: number) {
    // Only the active member can change their own meals
    if (memberId !== activeMemberId) return;

    const clamped = Math.max(0, value);
    setMeals((prev) => ({ ...prev, [memberId]: clamped }));
    setSaved((prev) => ({ ...prev, [memberId]: false }));

    clearTimeout(timers.current[memberId]);
    timers.current[memberId] = setTimeout(async () => {
      if (!group) return;
      setSaving((prev) => ({ ...prev, [memberId]: true }));
      try {
        await saveMealEntry({ groupId: group.id, memberId, date: today, quantity: clamped });
        setSaved((prev) => ({ ...prev, [memberId]: true }));
      } catch {
        // silently fail — user can retry by tapping again
      } finally {
        setSaving((prev) => ({ ...prev, [memberId]: false }));
      }
    }, 500);
  }

  function handleLeave() {
    sessionStorage.removeItem("mc_member_id");
    sessionStorage.removeItem("mc_member_name");
    router.push("/enter-group");
  }

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-[color:var(--soft-foreground)]">Loading group…</p>;
  }

  if (error) {
    return (
      <div className="mt-8 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!group) return null;

  const totalMeals = Object.values(meals).reduce((sum, q) => sum + q, 0);
  const myMeals = activeMemberId ? (meals[activeMemberId] ?? 0) : 0;

  return (
    <div className="py-6 grid gap-4">
      {/* Top bar */}

      <div className="flex items-center justify-between gap-3 rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            {group.name}
          </p>
          <p className="mt-0.5 truncate text-base font-semibold text-[color:var(--foreground)]">
            {activeMemberName ?? "Member"}
          </p>
        </div>
        <button
          onClick={handleLeave}
          type="button"
          className="shrink-0 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--soft-foreground)] transition hover:border-[color:var(--accent)]"
        >
          Leave
        </button>
      </div>

      {/* My meal card — prominent */}
      {activeMemberId && (
        <div className="rounded-[1.5rem] border-2 border-[color:var(--accent)] bg-[color:var(--panel)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--accent)]">
            Your meals today · {today}
          </p>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[color:var(--border)] text-xl font-bold transition hover:border-[color:var(--accent)] active:scale-95 disabled:opacity-40"
                disabled={myMeals <= 0}
                onClick={() => handleMealChange(activeMemberId, myMeals - 0.25)}
                type="button"
              >
                −
              </button>
              <span className="w-16 text-center text-3xl font-bold">{formatMeal(myMeals)}</span>
              <button
                className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[color:var(--border)] text-xl font-bold transition hover:border-[color:var(--accent)] active:scale-95"
                onClick={() => handleMealChange(activeMemberId, myMeals + 0.25)}
                type="button"
              >
                +
              </button>
            </div>
            <p className="text-sm text-[color:var(--muted)]">
              {saving[activeMemberId] ? "Saving…" : saved[activeMemberId] ? "✓ Saved" : "Tap to update"}
            </p>
          </div>
        </div>
      )}

      {/* Group summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-3 text-center">
          <p className="text-xs text-[color:var(--muted)]">Date</p>
          <p className="mt-1 text-sm font-semibold">{today}</p>
        </div>
        <div className="rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-3 text-center">
          <p className="text-xs text-[color:var(--muted)]">Total Meals</p>
          <p className="mt-1 text-sm font-semibold">{formatMeal(totalMeals)}</p>
        </div>
        <div className="rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-3 text-center">
          <p className="text-xs text-[color:var(--muted)]">Members</p>
          <p className="mt-1 text-sm font-semibold">{members.length}</p>
        </div>
        <div className="rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-3 text-center">
          <p className="text-xs text-[color:var(--muted)]">Your Meals</p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--accent)]">{formatMeal(myMeals)}</p>
        </div>
      </div>

      {/* All members today */}
      <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Today&apos;s meals — all members
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {members
            .filter((m) => {
              const q = memberSearch.trim().toLowerCase();
              if (!q) return true;
              return m.fullName.toLowerCase().includes(q);
            })
            .map((member) => {
              const qty = meals[member.id] ?? 0;
              const isMe = member.id === activeMemberId;
              return (
                <div
                  key={member.id}
                  className={`flex items-center justify-between rounded-[1rem] border px-3 py-2.5 ${
                    isMe
                      ? "border-[color:var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]"
                      : "border-[color:var(--border)] bg-[color:var(--background)]"
                  }`}
                >
                  <div className="min-w-0">
                    <p
                      className={`truncate text-sm font-semibold ${
                        isMe ? "text-[color:var(--accent)]" : "text-[color:var(--foreground)]"
                      }`}
                    >
                      {member.fullName} {isMe && "(you)"}
                    </p>
                  </div>
                  <span className="ml-3 shrink-0 text-lg font-bold text-[color:var(--foreground)]">
                    {formatMeal(qty)}
                  </span>
                </div>
              );
            })}
        </div>
      </div>


      {/* Note: group navbar removed from this page; it is shown in group layout (inserted right after entering token). */}
    </div>
  );
}

