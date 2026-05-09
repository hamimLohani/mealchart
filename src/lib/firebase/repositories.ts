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
  serverTimestamp,
  setDoc,
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
  chartCostsCollection,
  chartDepositsCollection,
  mealsCollection,
  membersCollection,
  noticesCollection,
  groupsCollection,
} from "@/lib/firebase/paths";
import {
  formatChartLabel,
  toMonthKey,
} from "@/lib/utils/date";
import type { AdminProfile, Chart, CostEntry, DepositEntry, Group, MealEntry, Member, Notice } from "@/types/domain";

function ensureDb() {
  if (!db) throw new Error("Firebase is not configured yet.");
  return db;
}

function normalizeDoc<T>(id: string, data: Record<string, unknown>) {
  return { ...data, id } as T;
}

function serializeDate(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return typeof value === "string" ? value : new Date().toISOString();
}

// ── Groups ────────────────────────────────────────────────────────────

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
  if (!current) return null;

  const data = current.data();
  return {
    ...normalizeDoc<Group>(current.id, data),
    createdAt: serializeDate(data.createdAt),
  };
}

// ── Admins ────────────────────────────────────────────────────────────

export async function getAdminProfile(adminId: string) {
  const database = ensureDb();
  const snapshot = await getDoc(doc(database, adminsCollection, adminId));
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return {
    ...normalizeDoc<AdminProfile>(snapshot.id, data),
    createdAt: serializeDate(data.createdAt),
  };
}

// ── Members ───────────────────────────────────────────────────────────

export async function listMembers(groupId: string) {
  const database = ensureDb();
  const snapshot = await getDocs(
    query(collection(database, membersCollection(groupId)), orderBy("fullName")),
  );
  return snapshot.docs.map((entry) => normalizeDoc<Member>(entry.id, entry.data()));
}

export async function createMember(input: {
  groupId: string;
  fullName: string;
  joinDate: string;
  phoneNumber: string;
}) {
  const database = ensureDb();
  const memberId = crypto.randomUUID();
  const record = buildMemberRecord({
    id: memberId,
    fullName: input.fullName,
    joinDate: input.joinDate,
    phoneNumber: input.phoneNumber,
  });

  await setDoc(
    doc(database, membersCollection(input.groupId), memberId),
    record,
  );

  await addDoc(collection(database, noticesCollection(input.groupId)), {
    ...buildNoticeRecord({
      title: "Member added",
      body: `${input.fullName} was added to the group.`,
      systemGenerated: true,
    }),
    createdAt: serverTimestamp(),
  });

  return record;
}

export async function updateMember(input: {
  groupId: string;
  memberId: string;
  fullName: string;
  joinDate: string;
  phoneNumber: string;
}) {
  const database = ensureDb();
  const memberRef = doc(database, membersCollection(input.groupId), input.memberId);
  const payload = {
    fullName: input.fullName,
    joinDate: input.joinDate,
    phoneNumber: input.phoneNumber,
    active: true,
  };

  await updateDoc(memberRef, payload);

  await addDoc(collection(database, noticesCollection(input.groupId)), {
    ...buildNoticeRecord({
      title: "Member updated",
      body: `${input.fullName} was updated.`,
      systemGenerated: true,
    }),
    createdAt: serverTimestamp(),
  });

  return { id: input.memberId, ...payload } as Member;
}

export async function deleteMember(groupId: string, memberId: string) {
  const database = ensureDb();
  const memberRef = doc(database, membersCollection(groupId), memberId);
  const snapshot = await getDoc(memberRef);

  if (!snapshot.exists()) throw new Error("Member was not found.");

  const data = snapshot.data();
  await deleteDoc(memberRef);

  await addDoc(collection(database, noticesCollection(groupId)), {
    ...buildNoticeRecord({
      title: "Member removed",
      body: `${String(data.fullName ?? "A member")} was removed from the group.`,
      systemGenerated: true,
    }),
    createdAt: serverTimestamp(),
  });
}

// ── Charts ────────────────────────────────────────────────────────────

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

  if (!existing.empty) throw new Error("A chart for that month already exists.");

  const chartId = crypto.randomUUID();
  const record = buildChartRecord({
    id: chartId,
    label: formatChartLabel(input.year, input.month),
    monthKey,
    year: input.year,
    month: input.month,
  });

  await setDoc(
    doc(database, chartsCollection(input.groupId), chartId),
    { ...record, createdAt: serverTimestamp() },
  );

  await updateDoc(doc(database, groupsCollection, input.groupId), {
    currentChartId: chartId,
    currentChartMonth: monthKey,
  });

  await addDoc(collection(database, noticesCollection(input.groupId)), {
    ...buildNoticeRecord({
      title: "New chart created",
      body: `${record.label} chart was created with 31 days and set as active.`,
      systemGenerated: true,
    }),
    createdAt: serverTimestamp(),
  });

  return record;
}

// ── Deposits (chart-scoped) ──────────────────────────────────────────

export async function listDepositsForChart(groupId: string, chartId: string) {
  const database = ensureDb();
  const snapshot = await getDocs(
    query(
      collection(database, chartDepositsCollection(groupId, chartId)),
      orderBy("date", "desc"),
    ),
  );
  return snapshot.docs.map((entry) => normalizeDoc<DepositEntry>(entry.id, entry.data()));
}

export async function createDeposit(input: {
  groupId: string;
  chartId: string;
  memberId: string;
  amount: number;
  date: string;
  collectedByAdminId: string;
}) {
  const database = ensureDb();
  const depositId = crypto.randomUUID();
  const record = buildDepositRecord({
    id: depositId,
    memberId: input.memberId,
    amount: input.amount,
    date: input.date,
    collectedByAdminId: input.collectedByAdminId,
  });

  await setDoc(
    doc(database, chartDepositsCollection(input.groupId, input.chartId), depositId),
    record,
  );

  await addDoc(collection(database, noticesCollection(input.groupId)), {
    ...buildNoticeRecord({
      title: "Money added",
      body: `A deposit of ${input.amount.toFixed(2)} tk was added.`,
      systemGenerated: true,
    }),
    createdAt: serverTimestamp(),
  });

  return record;
}

// ── Meals ─────────────────────────────────────────────────────────────

export async function getMealsForDate(groupId: string, date: string) {
  const database = ensureDb();
  const snapshot = await getDocs(
    query(
      collection(database, mealsCollection(groupId)),
      where("date", "==", date),
    ),
  );
  return snapshot.docs.map((entry) => normalizeDoc<MealEntry>(entry.id, entry.data()));
}

export async function getMealsForMonth(groupId: string, monthKey: string) {
  const database = ensureDb();
  const snapshot = await getDocs(
    query(
      collection(database, mealsCollection(groupId)),
      where("date", ">=", `${monthKey}-01`),
      where("date", "<=", `${monthKey}-31`),
    ),
  );
  return snapshot.docs.map((entry) => normalizeDoc<MealEntry>(entry.id, entry.data()));
}

// Deterministic doc ID: memberId_date — allows setDoc upsert without a prior read
export async function saveMealEntry(input: {
  groupId: string;
  memberId: string;
  date: string;
  quantity: number;
}) {
  const database = ensureDb();
  const docId = `${input.memberId}_${input.date}`;
  await setDoc(doc(database, mealsCollection(input.groupId), docId), {
    memberId: input.memberId,
    date: input.date,
    quantity: input.quantity,
  });
}

export async function getMealsForMemberInDateRange(
  groupId: string,
  memberId: string,
  startDate: string,
  endDate: string,
): Promise<MealEntry[]> {
  const database = ensureDb();

  // Primary query: uses composite index (memberId ASC, date ASC)
  try {
    const snapshot = await getDocs(
      query(
        collection(database, mealsCollection(groupId)),
        where("memberId", "==", memberId),
        where("date", ">=", startDate),
        where("date", "<=", endDate),
        orderBy("date", "asc"),
      ),
    );
    return snapshot.docs.map((entry) => normalizeDoc<MealEntry>(entry.id, entry.data()));
  } catch (err) {
    // Fallback if composite index is still building: filter client-side
    const isIndexError =
      err instanceof Error &&
      (err.message.includes("requires an index") || err.message.includes("FAILED_PRECONDITION"));

    if (!isIndexError) throw err;

    const snapshot = await getDocs(
      query(
        collection(database, mealsCollection(groupId)),
        where("date", ">=", startDate),
        where("date", "<=", endDate),
        orderBy("date", "asc"),
      ),
    );
    return snapshot.docs
      .map((entry) => normalizeDoc<MealEntry>(entry.id, entry.data()))
      .filter((m) => m.memberId === memberId);
  }
}

// ── Costs (chart-scoped) ──────────────────────────────────────────────

export async function listCostsForChart(groupId: string, chartId: string) {
  const database = ensureDb();
  const snapshot = await getDocs(
    query(
      collection(database, chartCostsCollection(groupId, chartId)),
      orderBy("date", "desc"),
    ),
  );
  return snapshot.docs.map((entry) => normalizeDoc<CostEntry>(entry.id, entry.data()));
}

export async function createCost(input: {
  groupId: string;
  chartId: string;
  itemName: string;
  amount: number;
  date: string;
}) {
  const database = ensureDb();
  const costId = crypto.randomUUID();
  const payload = { id: costId, itemName: input.itemName, amount: input.amount, date: input.date };

  await setDoc(
    doc(database, chartCostsCollection(input.groupId, input.chartId), costId),
    payload,
  );

  await addDoc(collection(database, noticesCollection(input.groupId)), {
    ...buildNoticeRecord({
      title: "Cost added",
      body: `${input.itemName} — ${input.amount.toFixed(2)} tk on ${input.date}.`,
      systemGenerated: true,
    }),
    createdAt: serverTimestamp(),
  });

  return payload as CostEntry;
}

export async function deleteCost(groupId: string, chartId: string, costId: string) {
  const database = ensureDb();
  await deleteDoc(doc(database, chartCostsCollection(groupId, chartId), costId));
}

// ── Notices ───────────────────────────────────────────────────────────

export async function listNotices(groupId: string) {
  const database = ensureDb();
  const snapshot = await getDocs(
    query(
      collection(database, noticesCollection(groupId)),
      orderBy("createdAt", "desc"),
    ),
  );
  return snapshot.docs.map((entry) => normalizeDoc<Notice>(entry.id, entry.data()));
}

export async function createNotice(input: { groupId: string; title: string; body: string }) {
  const database = ensureDb();
  const record = buildNoticeRecord({ title: input.title, body: input.body, systemGenerated: false });
  const ref = await addDoc(collection(database, noticesCollection(input.groupId)), {
    ...record,
    createdAt: serverTimestamp(),
  });
  return { ...record, id: ref.id, createdAt: new Date().toISOString() };
}

export async function updateNotice(input: {
  groupId: string;
  noticeId: string;
  title: string;
  body: string;
}) {
  const database = ensureDb();
  await updateDoc(doc(database, noticesCollection(input.groupId), input.noticeId), {
    title: input.title,
    body: input.body,
  });
}

export async function deleteNotice(groupId: string, noticeId: string) {
  const database = ensureDb();
  await deleteDoc(doc(database, noticesCollection(groupId), noticeId));
}
