export const groupsCollection = "groups";
export const adminsCollection = "admins";

export const membersCollection  = (groupId: string) => `groups/${groupId}/members`;
export const chartsCollection   = (groupId: string) => `groups/${groupId}/charts`;
export const mealsCollection    = (groupId: string) => `groups/${groupId}/meals`;
export const chartNoticesCollection = (groupId: string, chartId: string) => `groups/${groupId}/charts/${chartId}/notices`;
/** Month-level lock mirror for security rules (synced with chart.locked). */
export const lockedMonthsCollection = (groupId: string) => `groups/${groupId}/lockedMonths`;

// Chart-scoped: costs and deposits live only under charts/{chartId}/… (per-month isolation)
export const chartDepositsCollection = (groupId: string, chartId: string) =>
  `groups/${groupId}/charts/${chartId}/deposits`;

export const chartCostsCollection = (groupId: string, chartId: string) =>
  `groups/${groupId}/charts/${chartId}/costs`;
