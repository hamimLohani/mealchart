import type {
  AdminProfile,
  Chart,
  CostEntry,
  DepositEntry,
  Group,
  MealEntry,
  Member,
  Notice,
  JoinRequest,
} from "@/types/domain";
import { daysInMonth } from "@/lib/utils/date";

export function buildGroupRecord(input: {
  id: string;
  name: string;
  adminId: string;
  token?: string;
}): Group {
  return {
    id: input.id,
    name: input.name,
    token: input.token ?? input.id.slice(0, 8).toUpperCase(),
    adminId: input.adminId,
    createdAt: new Date().toISOString(),
    active: true,
    paidChartSlots: 0,
    paidMemberSlots: 0,
    totalChartsCreated: 0,
    totalMembersCreated: 0,
  };
}

export function buildChartRecord(input: {
  id: string;
  label: string;
  monthKey: string;
  year: number;
  month: number;
}): Chart {
  return {
    id: input.id,
    label: input.label,
    monthKey: input.monthKey,
    year: input.year,
    month: input.month,
    totalDays: daysInMonth(input.year, input.month),
    active: true,
    locked: false,
    createdAt: new Date().toISOString(),
  };
}

export function buildAdminProfile(input: {
  id: string;
  email: string;
  fullName?: string;
  groupId: string;
}): AdminProfile {
  return {
    id: input.id,
    email: input.email.trim().toLowerCase(),
    fullName: input.fullName,
    groupId: input.groupId,
    createdAt: new Date().toISOString(),
  };
}

export function buildMemberRecord(input: {
  id: string;
  fullName: string;
  joinDate: string;
  email: string;
}): Member {
  return {
    id: input.id,
    fullName: input.fullName,
    joinDate: input.joinDate,
    email: input.email,
    active: true,
  };
}

export function buildMealRecord(input: {
  id: string;
  memberId: string;
  date: string;
  quantity: number;
}): MealEntry {
  return {
    id: input.id,
    memberId: input.memberId,
    date: input.date,
    quantity: input.quantity,
  };
}

export function buildCostRecord(input: {
  id: string;
  itemName: string;
  amount: number;
  date: string;
}): CostEntry {
  return {
    id: input.id,
    itemName: input.itemName,
    amount: input.amount,
    date: input.date,
  };
}

export function buildDepositRecord(input: {
  id: string;
  memberId: string;
  amount: number;
  date: string;
  collectedByAdminId: string;
}): DepositEntry {
  return {
    id: input.id,
    memberId: input.memberId,
    amount: input.amount,
    date: input.date,
    collectedByAdminId: input.collectedByAdminId,
  };
}

export function buildNoticeRecord(input: {
  title: string;
  body: string;
  systemGenerated: boolean;
}): Notice {
  return {
    id: crypto.randomUUID(),
    title: input.title,
    body: input.body,
    systemGenerated: input.systemGenerated,
    createdAt: new Date().toISOString(),
  };
}

export function buildJoinRequestRecord(input: {
  id: string;
  fullName: string;
  email: string;
}): JoinRequest {
  return {
    id: input.id,
    fullName: input.fullName,
    email: input.email,
    createdAt: new Date().toISOString(),
  };
}
