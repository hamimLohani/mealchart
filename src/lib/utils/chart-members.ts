import type { MealEntry, Member } from "@/types/domain";

/**
 * Row order: current members first, then any memberIds that appear in this month's meals
 * but are no longer in the group (so locked-month history stays visible after member delete).
 */
export function memberIdsForChartRows(members: Member[], meals: MealEntry[], monthKeys: string[]): string[] {
  const inChart = (m: MealEntry) => monthKeys.includes(m.date.slice(0, 7));
  const idsWithMeals = new Set(meals.filter(inChart).map((m) => m.memberId.toLowerCase()));
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const m of members) {
    const mid = m.id.toLowerCase();
    ordered.push(mid);
    seen.add(mid);
  }
  for (const id of idsWithMeals) {
    if (!seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }
  return ordered;
}

export function memberDisplayName(
  memberId: string,
  members: Member[],
  formerMemberLabel = "Former member",
): string {
  return members.find((m) => m.id === memberId)?.fullName ?? formerMemberLabel;
}

/** Money rows: chart meal participants plus anyone with a deposit this month. */
export function memberIdsForMoneyRows(
  members: Member[],
  meals: MealEntry[],
  depositMemberIds: string[],
  monthKeys: string[],
): string[] {
  const out = [...memberIdsForChartRows(members, meals, monthKeys)];
  const seen = new Set(out);
  for (const id of depositMemberIds) {
    if (!seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  return out;
}
