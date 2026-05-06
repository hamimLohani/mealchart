"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { 
  findGroupByToken, 
  listMembers, 
  getMealsForDate, 
  saveMealEntry 
} from "@/lib/firebase/repositories";
import type { Group, Member, MealEntry } from "@/types/domain";

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

export function MemberMealsManager({ token, memberId }: { token: string; memberId: string }) {
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [meals, setMeals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const today = localDateString();

  useEffect(() => {
    let active = true;

    async function load() {
      if (!isFirebaseConfigured) {
        setError("Firebase is not configured yet.");
        setLoading(false);
        return;
      }

      try {
        const currentGroup = await findGroupByToken(token);
        if (!currentGroup) throw new Error("No group found for this token.");

        const currentMembers = await listMembers(currentGroup.id);
        const targetMember = currentMembers.find(m => m.id === memberId);

        if (!targetMember) throw new Error("Member not found in this group.");

        const todayMeals = await getMealsForDate(currentGroup.id, today);

        if (!active) return;

        const mealMap: Record<string, number> = {};
        todayMeals.forEach((m: MealEntry) => { 
          mealMap[m.memberId] = m.quantity; 
        });

        setGroup(currentGroup);
        setMember(targetMember);
        setMeals(mealMap);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load data.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [token, memberId, today]);

  const handleMealChange = async (value: number) => {
    if (!group) return;

    const clamped = Math.max(0, value);
    setMeals(prev => ({ ...prev, [memberId]: clamped }));
    setSaved(false);
    setSaving(true);

    try {
      await saveMealEntry({ 
        groupId: group.id, 
        memberId, 
        date: today, 
        quantity: clamped 
      });
      setSaved(true);
    } catch (err) {
      setError('Failed to save meal entry');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    router.push(`/group/${token}`);
  };

  if (loading) {
    return (
      <div className="py-6 grid gap-4">
        <p className="py-16 text-center text-sm text-[color:var(--soft-foreground)]">Loading member data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!group || !member) return null;

  const currentMealCount = meals[memberId] ?? 0;

  return (
    <div className="py-6 grid gap-4">
      {/* Member header */}
      <div className="flex items-center justify-between gap-3 rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            {group.name}
          </p>
          <p className="mt-0.5 truncate text-base font-semibold text-[color:var(--foreground)]">
            {member.fullName}
          </p>
        </div>
        <button
          onClick={handleBack}
          type="button"
          className="shrink-0 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--soft-foreground)] transition hover:border-[color:var(--accent)]"
        >
          Back
        </button>
      </div>

      {/* Meal card */}
      <div className="rounded-[1.5rem] border-2 border-[color:var(--accent)] bg-[color:var(--panel)] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--accent)]">
          Meals today · {today}
        </p>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[color:var(--border)] text-xl font-bold transition hover:border-[color:var(--accent)] active:scale-95 disabled:opacity-40"
              disabled={currentMealCount <= 0}
              onClick={() => handleMealChange(currentMealCount - 0.25)}
              type="button"
            >
              −
            </button>
            <span className="w-16 text-center text-3xl font-bold">{formatMeal(currentMealCount)}</span>
            <button
              className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[color:var(--border)] text-xl font-bold transition hover:border-[color:var(--accent)] active:scale-95"
              onClick={() => handleMealChange(currentMealCount + 0.25)}
              type="button"
            >
              +
            </button>
          </div>
          <p className="text-sm text-[color:var(--muted)]">
            {saving ? "Saving…" : saved ? "✓ Saved" : "Tap to update"}
          </p>
        </div>
      </div>

      {/* Member details */}
      <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Member Details
        </p>
        <div className="mt-3 grid gap-2">
          <div className="flex justify-between py-2 border-b border-[color:var(--border)]">
            <span className="text-[color:var(--muted)]">Full Name:</span>
            <span className="font-semibold">{member.fullName}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[color:var(--border)]">
            <span className="text-[color:var(--muted)]">Phone:</span>
            <span className="font-semibold">{member.phoneNumber}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-[color:var(--muted)]">Join Date:</span>
            <span className="font-semibold">{new Date(member.joinDate).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}