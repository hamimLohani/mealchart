import type { CostEntry, DepositEntry, MealEntry } from "@/types/domain";

export function normalizeMealQuantity(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 4) / 4;
}

export function formatMeal(n: number): string {
  const rounded = Math.round(n * 4) / 4;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString();
}

export function getMonthTotals(meals: MealEntry[], costs: CostEntry[], deposits: DepositEntry[]) {
  const totalMeals = meals.reduce((sum, meal) => sum + normalizeMealQuantity(meal.quantity), 0);
  const totalCost = Math.max(0, costs.reduce((sum, cost) => sum + (cost.amount || 0), 0));
  const totalPaid = Math.max(0, deposits.reduce((sum, deposit) => sum + (deposit.amount || 0), 0));
  const mealRate = totalMeals > 0 ? totalCost / totalMeals : 0;
  const remainingTaka = totalPaid - totalCost;
  return { totalMeals, totalCost, totalPaid, mealRate, remainingTaka };
}

export function getMemberTotals(
  memberId: string,
  meals: MealEntry[],
  deposits: DepositEntry[],
  mealRate: number,
) {
  const memberMeals = meals.filter((meal) => meal.memberId.toLowerCase() === memberId.toLowerCase());
  const totalMeals = memberMeals.reduce((sum, meal) => sum + normalizeMealQuantity(meal.quantity), 0);
  const totalPaid = deposits
    .filter((deposit) => deposit.memberId.toLowerCase() === memberId.toLowerCase())
    .reduce((sum, deposit) => sum + deposit.amount, 0);
  const totalCost = totalMeals * mealRate;
  const balance = totalPaid - totalCost;
  return { totalMeals, totalPaid, totalCost, balance, memberMeals };
}
