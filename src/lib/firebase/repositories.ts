import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  buildChartRecord,
  buildDepositRecord,
  buildMemberRecord,
  buildNoticeRecord,
} from "@/lib/firebase/factories";
import {
  adminsCollection,
  chartsCollection,
  depositsCollection,
  membersCollection,
  noticesCollection,
  groupsCollection,
} from "@/lib/firebase/paths";
import {
  formatChartLabel,
  getCurrentMonthRange,
  toDateInputValue,
  toMonthKey,
} from "@/lib/utils/date";
import type { AdminProfile, Chart, DepositEntry, Group, Member } from "@/types/domain";

function ensureDb() {
  if (!db) {
    throw new Error("Firebase is not configured yet.");
  }

  return db;
}

function normalizeDoc<T>(id: string, data: Record<string, unknown>) {
  return { id, ...data } as T;
}

function serializeDate(value: unknown) {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  return typeof value === "string" ? value : new Date().toISOString();
}

export async function findGroupByToken(token: string) {
  const database = ensureDb();
  const snapshot = await getDocs(
    query(
      collection(database, groupsCollection),
      where("token", "==", token),
      limit(1),
    ),
  );

  const current = snapshot.docs[0];
  if (!current) {
    return null;
  }

  const data = current.data();

  return {
    ...normalizeDoc<Group>(current.id, data),
    createdAt: serializeDate(data.createdAt),
  };
}

export async function getAdminProfile(adminId: string) {
  const database = ensureDb();
  const snapshot = await getDoc(doc(database, adminsCollection, adminId));

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  return {
    ...normalizeDoc<AdminProfile>(snapshot.id, data),
    createdAt: serializeDate(data.createdAt),
  };
}

export async function listMembers(groupId: string) {
  const database = ensureDb();
  const snapshot = await getDocs(
    query(collection(database, membersCollection(groupId)), orderBy("fullName")),
  );

  return snapshot.docs.map((entry) => normalizeDoc<Member>(entry.id, entry.data()));
}

export async function listCharts(groupId: string) {
  const database = ensureDb();
  const snapshot = await getDocs(
    query(collection(database, chartsCollection(groupId)), orderBy("monthKey", "desc")),
  );

  return snapshot.docs.map((entry) => {
    const data = entry.data();

    return {
      ...normalizeDoc<Chart>(entry.id, data),
      createdAt: serializeDate(data.createdAt),
    };
  });
}

export async function createChart(input: {
  groupId: string;
  year: number;
  month: number;
}) {
  const database = ensureDb();
  const monthKey = toMonthKey(input.year, input.month);
  const existing = await getDocs(
    query(
      collection(database, chartsCollection(input.groupId)),
      where("monthKey", "==", monthKey),
      limit(1),
    ),
  );

  if (!existing.empty) {
    throw new Error("A chart for that month already exists.");
  }

  const record = buildChartRecord({
    id: crypto.randomUUID(),
    label: formatChartLabel(input.year, input.month),
    monthKey,
    year: input.year,
    month: input.month,
  });

  const chartReference = await addDoc(
    collection(database, chartsCollection(input.groupId)),
    record,
  );

  await updateDoc(doc(database, groupsCollection, input.groupId), {
    currentChartId: chartReference.id,
    currentChartMonth: monthKey,
  });

  await addDoc(collection(database, noticesCollection(input.groupId)), {
    ...buildNoticeRecord({
      title: "New chart created",
      body: `${record.label} chart was created with 31 days and set as active.`,
      systemGenerated: true,
    }),
    createdAt: new Date().toISOString(),
  });

  return {
    ...record,
    id: chartReference.id,
  };
}

export async function listDepositsForMonth(groupId: string, date: Date) {
  const database = ensureDb();
  const { start, end } = getCurrentMonthRange(date);
  const snapshot = await getDocs(
    query(
      collection(database, depositsCollection(groupId)),
      where("date", ">=", toDateInputValue(start)),
      where("date", "<=", toDateInputValue(end)),
      orderBy("date", "desc"),
    ),
  );

  return snapshot.docs.map((entry) =>
    normalizeDoc<DepositEntry>(entry.id, entry.data()),
  );
}

export async function createDeposit(input: {
  groupId: string;
  memberId: string;
  amount: number;
  date: string;
  collectedByAdminId: string;
}) {
  const database = ensureDb();
  const record = buildDepositRecord({
    id: crypto.randomUUID(),
    memberId: input.memberId,
    amount: input.amount,
    date: input.date,
    collectedByAdminId: input.collectedByAdminId,
  });

  const depositReference = await addDoc(
    collection(database, depositsCollection(input.groupId)),
    record,
  );

  await addDoc(collection(database, noticesCollection(input.groupId)), {
    ...buildNoticeRecord({
      title: "Money added",
      body: `A deposit of ${input.amount.toFixed(2)} tk was added.`,
      systemGenerated: true,
    }),
    createdAt: new Date().toISOString(),
  });

  return {
    ...record,
    id: depositReference.id,
  };
}

export async function createMember(input: {
  groupId: string;
  fullName: string;
  joinDate: string;
  phoneNumber: string;
}) {
  const database = ensureDb();
  const record = buildMemberRecord({
    id: crypto.randomUUID(),
    fullName: input.fullName,
    joinDate: input.joinDate,
    phoneNumber: input.phoneNumber,
  });

  const memberReference = await addDoc(
    collection(database, membersCollection(input.groupId)),
    record,
  );

  await addDoc(collection(database, noticesCollection(input.groupId)), {
    ...buildNoticeRecord({
      title: "Member added",
      body: `${input.fullName} was added to the group.`,
      systemGenerated: true,
    }),
    createdAt: new Date().toISOString(),
  });

  return {
    ...record,
    id: memberReference.id,
  };
}

export async function updateMember(input: {
  groupId: string;
  memberId: string;
  fullName: string;
  joinDate: string;
  phoneNumber: string;
}) {
  const database = ensureDb();
  const memberReference = doc(
    database,
    membersCollection(input.groupId),
    input.memberId,
  );

  const payload = {
    fullName: input.fullName,
    joinDate: input.joinDate,
    phoneNumber: input.phoneNumber,
    active: true,
  };

  await updateDoc(memberReference, payload);

  await addDoc(collection(database, noticesCollection(input.groupId)), {
    ...buildNoticeRecord({
      title: "Member updated",
      body: `${input.fullName} was updated.`,
      systemGenerated: true,
    }),
    createdAt: new Date().toISOString(),
  });

  return {
    id: input.memberId,
    ...payload,
  } as Member;
}

export async function deleteMember(groupId: string, memberId: string) {
  const database = ensureDb();
  const memberReference = doc(database, membersCollection(groupId), memberId);
  const snapshot = await getDoc(memberReference);

  if (!snapshot.exists()) {
    throw new Error("Member was not found.");
  }

  const data = snapshot.data();
  await deleteDoc(memberReference);

  await addDoc(collection(database, noticesCollection(groupId)), {
    ...buildNoticeRecord({
      title: "Member removed",
      body: `${String(data.fullName ?? "A member")} was removed from the group.`,
      systemGenerated: true,
    }),
    createdAt: new Date().toISOString(),
  });
}
