export type AdminProfile = {
  id: string;
  email: string;
  fullName?: string;
  groupId: string;
  createdAt: string;
};

export type Group = {
  id: string;
  name: string;
  token?: string;
  adminId: string;
  currentChartId?: string;
  currentChartMonth?: string;
  createdAt: string;
  active: boolean;
};

export type Chart = {
  id: string;
  label: string;
  monthKey: string;
  year: number;
  month: number;
  totalDays: number;
  active: boolean;
  locked: boolean;
  createdAt: string;
};

export type Member = {
  id: string;
  fullName: string;
  joinDate: string;
  email: string;
  active: boolean;
};

export type MealEntry = {
  id: string;
  memberId: string;
  date: string;
  quantity: number;
  /** YYYY-MM; required on new writes for lock enforcement */
  monthKey?: string;
};

export type CostEntry = {
  id: string;
  itemName: string;
  amount: number;
  date: string;
};

export type DepositEntry = {
  id: string;
  memberId: string;
  amount: number;
  date: string;
  collectedByAdminId: string;
};

export type Notice = {
  id: string;
  title: string;
  body: string;
  systemGenerated: boolean;
  createdAt: string;
};

export type JoinRequest = {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
};
