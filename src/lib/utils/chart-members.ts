import type { MealEntry, Member } from "@/types/domain";

/**
 * Row order: current members first, then any memberIds that appear in this month's meals
 * but are no longer in the group (so locked-month history stays visible after member delete).
 */
export function memberIdsForChartRows(members: Member[], meals: MealEntry[], monthKey: string): string[] {
  const inMonth = (m: MealEntry) => m.date >= `${monthKey}-01` && m.date <= `${monthKey}-31`;
  const idsWithMeals = new Set(meals.filter(inMonth).map((m) => m.memberId));
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const m of members) {
    ordered.push(m.id);
    seen.add(m.id);
  }
  for (const id of idsWithMeals) {
    if (!seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }
  return ordered;
}

export function memberDisplayName(memberId: string, members: Member[]): string {
  return members.find((m) => m.id === memberId)?.fullName ?? "Former member";
}

/** Money rows: chart meal participants plus anyone with a deposit this month. */
export function memberIdsForMoneyRows(
  members: Member[],
  meals: MealEntry[],
  depositMemberIds: string[],
  monthKey: string,
): string[] {
  const out = [...memberIdsForChartRows(members, meals, monthKey)];
  const seen = new Set(out);
  for (const id of depositMemberIds) {
    if (!seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  return out;
}
