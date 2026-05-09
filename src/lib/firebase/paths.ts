export const groupsCollection = "groups";
export const adminsCollection = "admins";

export const membersCollection  = (groupId: string) => `groups/${groupId}/members`;
export const chartsCollection   = (groupId: string) => `groups/${groupId}/charts`;
export const mealsCollection    = (groupId: string) => `groups/${groupId}/meals`;
export const noticesCollection  = (groupId: string) => `groups/${groupId}/notices`;

// Legacy flat collections (kept for backward-compat reads during migration)
export const costsCollection    = (groupId: string) => `groups/${groupId}/costs`;
export const depositsCollection = (groupId: string) => `groups/${groupId}/deposits`;

// Chart-scoped: all money data lives under the chart it belongs to
export const chartDepositsCollection = (groupId: string, chartId: string) =>
  `groups/${groupId}/charts/${chartId}/deposits`;

export const chartCostsCollection = (groupId: string, chartId: string) =>
  `groups/${groupId}/charts/${chartId}/costs`;
