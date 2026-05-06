export const groupsCollection = "groups";
export const adminsCollection = "admins";

export const membersCollection = (groupId: string) => `groups/${groupId}/members`;
export const chartsCollection = (groupId: string) => `groups/${groupId}/charts`;
export const mealsCollection = (groupId: string) => `groups/${groupId}/meals`;
export const costsCollection = (groupId: string) => `groups/${groupId}/costs`;
export const depositsCollection = (groupId: string) => `groups/${groupId}/deposits`;
export const noticesCollection = (groupId: string) => `groups/${groupId}/notices`;
