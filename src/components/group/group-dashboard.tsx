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

export function GroupDashboard({ 
  token, 
  memberSearch = "" 
}: { 
  token: string; 
  memberSearch?: string; 
}) {
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);






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
    // Check if a member has already been selected
    const storedId = sessionStorage.getItem("mc_member_id");
    const storedName = sessionStorage.getItem("mc_member_name");

    if (storedId && storedName) {
      // Member already selected, set the active member
      setActiveMemberId(storedId);
      setActiveMemberName(storedName);
    }
    // If no member is selected, we stay in selection mode
  }, []);

  useEffect(() => {
    if (!token) return;
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

        const currentMembers = await listMembers(currentGroup.id);

        if (!active) return;

        setGroup(currentGroup);
        setMembers(currentMembers);
        
        // If we already have an active member, load their meal data too
        if (activeMemberId) {
          const todayMeals = await getMealsForDate(currentGroup.id, today);
          const mealMap: Record<string, number> = {};
          todayMeals.forEach((m: MealEntry) => { mealMap[m.memberId] = m.quantity; });
          setMeals(mealMap);
        }
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

  const handleMemberSelect = (member: Member) => {
    sessionStorage.setItem("mc_member_id", member.id);
    sessionStorage.setItem("mc_member_name", member.fullName);
    setActiveMemberId(member.id);
    setActiveMemberName(member.fullName);
    
    // Reload meals after setting the active member
    if (group) {
      getMealsForDate(group.id, today).then(todayMeals => {
        const mealMap: Record<string, number> = {};
        todayMeals.forEach((m: MealEntry) => { mealMap[m.memberId] = m.quantity; });
        setMeals(mealMap);
      }).catch(err => {
        setError(err instanceof Error ? err.message : "Failed to load meals.");
      });
    }
  };

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

  function handleMemberClick(memberId: string) {
    router.push(`/group/${token}/member/${memberId}`);
  }

  function handleLeave() {
    sessionStorage.removeItem("mc_member_id");
    sessionStorage.removeItem("mc_member_name");
    setActiveMemberId(null);
    setActiveMemberName(null);
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

  // If no member has been selected yet, show the member selection screen
  if (!activeMemberId || !activeMemberName) {
    return (
      <div className="py-6 grid gap-4">
        {/* Group header */}
        <div className="flex items-center justify-between gap-3 rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {group.name}
            </p>
            <p className="mt-0.5 truncate text-base font-semibold text-[color:var(--foreground)]">
              Select Your Name
            </p>
          </div>
        </div>

        {/* Members selection */}
        <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Who are you? Pick your name:
          </p>
          <div className="mt-3 grid gap-2">
            {members.map((member) => (
              <div
                key={member.id}
                onClick={() => handleMemberSelect(member)}
                className="flex items-center justify-between rounded-[1rem] border px-3 py-2.5 cursor-pointer border-[color:var(--border)] bg-[color:var(--background)] hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] hover:border-[color:var(--accent)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">
                    {member.fullName}
                  </p>
                  <p className="text-xs text-[color:var(--muted)]">
                    Joined {new Date(member.joinDate).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-[color:var(--accent)]">→</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

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
            {activeMemberName}
          </p>
        </div>
        <button
          onClick={handleLeave}
          type="button"
          className="shrink-0 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--soft-foreground)] transition hover:border-[color:var(--accent)]"
        >
          Change
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

      {/* All members - clickable to go to meal adding page */}
      <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Group Members
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
                  onClick={() => handleMemberClick(member.id)}
                  className={`flex items-center justify-between rounded-[1rem] border px-3 py-2.5 cursor-pointer ${
                    isMe
                      ? "border-[color:var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]"
                      : "border-[color:var(--border)] bg-[color:var(--background)] hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] hover:border-[color:var(--accent)]"
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
                    <p className="text-xs text-[color:var(--muted)]">
                      Today: {formatMeal(qty)} meal{qty !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="text-[color:var(--accent)]">→</span>
                </div>
              );
            })}
        </div>
      </div>


      {/* Note: group navbar removed from this page; it is shown in group layout (inserted right after entering token). */}
    </div>
  );
}

