import type { MessageKey } from "@/i18n/messages";

/** Map exact English errors (from throws / Firebase) to translation keys. */
export const errorMessageToKey: Partial<Record<string, MessageKey>> = {
  "Firebase is not configured yet.": "errors.firebaseNotConfigured",
  "Firebase is not configured.": "errors.firebaseNotConfiguredShort",
  "Firebase not configured.": "errors.firebaseNotConfiguredShort",
  "Firebase is not configured yet. Add your keys in .env.local first.":
    "errors.firebaseNotConfiguredLocal",
  "Enter a valid group token.": "errors.enterValidToken",
  "No group found for that token.": "errors.noGroupForToken",
  "This group has no members yet. Ask your admin to add members first.":
    "errors.groupNoMembers",
  "Failed to find that group.": "errors.findGroupFailed",
  "No group found for this token.": "errors.noGroupToken",
  "Group not found.": "errors.groupNotFound",
  "Member not found in this group.": "errors.memberNotInGroup",
  "Failed to load member.": "errors.loadMemberFailed",
  "Failed to load month data.": "errors.loadMonthFailed",
  "Failed to load group.": "errors.loadGroupFailed",
  "Failed to load notices.": "errors.loadNoticesFailed",
  "Failed to load.": "errors.genericLoad",
  "Failed to load chart.": "errors.loadChartFailed",
  "Failed to load data.": "errors.loadDataFailed",
  "Failed to load selected month.": "errors.loadSelectedMonth",
  "Firebase: Error (auth/email-already-in-use).": "errors.emailInUse",
  "Failed to register the group.": "errors.registerFailed",
  "No admin profile was found for the current user.": "errors.adminProfileNotFound",
  "No admin profile found.": "errors.adminProfileNotFoundShort",
  "No admin profile was found for this account.": "errors.adminProfileAccount",
  "No group was found for this admin profile.": "errors.noGroupAdmin",
  "Failed to load group details.": "errors.loadGroupDetails",
  "Log in as an admin to add money for members.": "errors.logInAddMoney",
  "Failed to load deposits.": "errors.loadDeposits",
  "This month is locked.": "errors.monthLocked",
  "Select a member and enter a valid deposit amount.": "errors.depositInvalid",
  "Failed to add money.": "errors.addMoneyFailed",
  "Log in as admin to manage costs.": "errors.logInCosts",
  "Failed to load costs.": "errors.loadCosts",
  "Item name and a valid amount are required.": "errors.costInvalid",
  "Failed to add cost.": "errors.addCostFailed",
  "Failed to delete cost.": "errors.deleteCostFailed",
  "Log in as an admin to manage members.": "errors.logInMembers",
  "Failed to load members.": "errors.loadMembersFailed",
  "Admin profile is required before managing members.": "errors.adminRequiredMembers",
  "Full name, join date, and email are required.": "errors.memberFieldsRequired",
  "A member with this email already exists.": "errors.memberExists",
  "Please enter a valid email address.": "errors.invalidEmail",
  "Failed to save member.": "errors.saveMemberFailed",
  "Failed to remove member.": "errors.removeMemberFailed",
  "Log in as admin to edit meals.": "errors.logInMeals",
  "Failed to load meals.": "errors.loadMealsFailed",
  "Failed to save meal.": "errors.saveMealFailed",
  "Log in as an admin to create charts.": "errors.logInCharts",
  "Failed to load charts.": "errors.loadChartsFailed",
  "Admin profile is required before creating a chart.": "errors.adminRequiredChart",
  "Enter a valid year and month.": "errors.invalidYearMonth",
  "Failed to create the chart.": "errors.createChartFailed",
  "Failed to update chart lock.": "errors.updateLockFailed",
  "Failed to save meal entry.": "errors.saveMealFailed",
  "Log in as admin to manage notices.": "errors.logInNotices",
  "Title and body are required.": "errors.noticeFieldsRequired",
  "Failed to save notice.": "errors.saveNoticeFailed",
  "Failed to delete notice.": "errors.deleteNoticeFailed",
  "Chart not found.": "errors.chartNotFound",
  "Chart is missing month information.": "errors.chartNoMonth",
  "A chart for that month already exists.": "errors.chartExists",
  "Member was not found.": "errors.memberNotFound",
  "Invalid date format.": "errors.invalidDateFormat",
  "Missing or insufficient permissions.": "errors.permissionDenied",
  "Firebase: Error (auth/permission-denied).": "errors.permissionDenied",
  "Firebase: Error (auth/network-request-failed).": "errors.networkRequestFailed",
};

export function translateErrorMessage(
  raw: string,
  t: (k: MessageKey, vars?: Record<string, string>) => string,
): string {
  // Handle complex reactive translations (e.g. email failures with dynamic reasons)
  if (raw.startsWith("ERR_TRANS:")) {
    try {
      const data = JSON.parse(raw.slice(10)) as { key: MessageKey; vars?: Record<string, string> };
      
      // If the nested 'error' variable is itself a translation key, translate it first
      const vars = { ...data.vars };
      if (vars.error && vars.error.startsWith("errors.")) {
        vars.error = t(vars.error as MessageKey);
      }
      
      return t(data.key, vars);
    } catch {
      return raw;
    }
  }

  const key = errorMessageToKey[raw];
  return key ? t(key) : raw;
}
