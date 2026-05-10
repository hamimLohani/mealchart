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
  writeBatch,
  collectionGroup,
  Firestore,
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
  chartNoticesCollection,
  groupsCollection,
  lockedMonthsCollection,
} from "@/lib/firebase/paths";
import {
  formatChartLabel,
  monthKeyFromDate,
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

async function assertDateBelongsToChart(groupId: string, chartId: string, date: string) {
  const database = ensureDb();
  const chartSnap = await getDoc(doc(database, chartsCollection(groupId), chartId));
  if (!chartSnap.exists()) throw new Error("Chart not found.");
  const data = chartSnap.data();
  let chartMk = typeof data.monthKey === "string" && data.monthKey.length >= 7 ? data.monthKey : "";
  if (!chartMk && typeof data.year === "number" && typeof data.month === "number") {
    chartMk = toMonthKey(data.year, data.month);
  }
  if (!chartMk) throw new Error("Chart is missing month information.");
  if (monthKeyFromDate(date) !== chartMk) {
    throw new Error(`Date must fall within ${chartMk} for this month’s chart.`);
  }
}

function mapMealEntryDoc(id: string, data: Record<string, unknown>): MealEntry {
  const mk =
    typeof data.monthKey === "string" && data.monthKey.length >= 7
      ? data.monthKey
      : typeof data.date === "string" && data.date.length >= 7
        ? data.date.slice(0, 7)
        : undefined;
  return { ...normalizeDoc<MealEntry>(id, data), ...(mk ? { monthKey: mk } : {}) };
}

function serializeDate(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return typeof value === "string" ? value : new Date().toISOString();
}

// ── Groups ────────────────────────────────────────────────────────────

export async function getGroupById(groupId: string) {
  const database = ensureDb();
  const snapshot = await getDoc(doc(database, groupsCollection, groupId));
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return {
    ...normalizeDoc<Group>(snapshot.id, data),
    createdAt: serializeDate(data.createdAt),
  };
}


export async function listGroups() {
  const database = ensureDb();
  const snapshot = await getDocs(
    query(collection(database, groupsCollection), where("active", "==", true), orderBy("name"))
  );
  return snapshot.docs.map((d) => ({
    ...normalizeDoc<Group>(d.id, d.data()),
    createdAt: serializeDate(d.data().createdAt),
  }));
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

export async function findAdminProfileByEmail(email: string) {
  const database = ensureDb();
  const q = query(collection(database, adminsCollection), where("email", "==", email.trim().toLowerCase()), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  return {
    ...normalizeDoc<AdminProfile>(d.id, data),
    createdAt: serializeDate(data.createdAt),
  };
}

export async function migrateAdminProfile(oldUid: string, newUid: string) {
  const database = ensureDb();
  const oldRef = doc(database, adminsCollection, oldUid);
  const newRef = doc(database, adminsCollection, newUid);
  
  const snap = await getDoc(oldRef);
  if (!snap.exists()) return;
  
  const data = snap.data();
  // Ensure the internal id matches the new UID for rule compliance
  const migratedData = { ...data, id: newUid };
  await setDoc(newRef, migratedData);
  // We keep the old one too just in case, or we could delete it.
  // Let's keep it for safety.
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
  email: string;
}) {
  const database = ensureDb();
  const memberId = input.email.trim().toLowerCase();
  
  const memberRef = doc(database, membersCollection(input.groupId), memberId);
  const snap = await getDoc(memberRef);
  if (snap.exists()) {
    throw new Error("A member with this email already exists.");
  }

  const record = buildMemberRecord({
    id: memberId,
    fullName: input.fullName,
    joinDate: input.joinDate,
    email: memberId,
  });

  await setDoc(memberRef, record);

  try {
    await addSystemNoticeToCurrentChart(database, input.groupId, "Member added", `${input.fullName} was added to the group.`);
  } catch (e) {
    console.warn("Failed to add system notice:", e);
  }

  return record;
}

export async function updateMember(input: {
  groupId: string;
  memberId: string;
  fullName: string;
  joinDate: string;
  email: string;
}) {
  const database = ensureDb();
  const memberRef = doc(database, membersCollection(input.groupId), input.memberId);
  const payload = {
    fullName: input.fullName,
    joinDate: input.joinDate,
    email: input.email.trim().toLowerCase(),
    active: true,
  };

  await updateDoc(memberRef, payload);

  try {
    await addSystemNoticeToCurrentChart(database, input.groupId, "Member updated", `${input.fullName} was updated.`);
  } catch (e) {
    console.warn("Failed to add system notice:", e);
  }

  return { id: input.memberId, ...payload } as Member;
}

export async function deleteMember(groupId: string, memberId: string) {
  const database = ensureDb();
  const memberRef = doc(database, membersCollection(groupId), memberId);
  const snapshot = await getDoc(memberRef);

  if (!snapshot.exists()) throw new Error("Member was not found.");

  const data = snapshot.data();
  await deleteDoc(memberRef);

  try {
    await addSystemNoticeToCurrentChart(database, groupId, "Member removed", `${String(data.fullName ?? "A member")} was removed from the group.`);
  } catch (e) {
    console.warn("Failed to add system notice:", e);
  }
}

export async function findMemberGroupByEmail(email: string): Promise<string | null> {
  const database = ensureDb();
  const q = query(collectionGroup(database, "members"), where("email", "==", email.trim().toLowerCase()), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  // path is groups/{groupId}/members/{memberId}
  const groupId = docSnap.ref.parent.parent?.id;
  return groupId ?? null;
}

// ── Join Requests ────────────────────────────────────────────────────────

export async function submitJoinRequest(groupId: string, fullName: string, email: string) {
  const database = ensureDb();
  const reqId = crypto.randomUUID();
  const reqRef = doc(database, `groups/${groupId}/joinRequests`, reqId);
  const data = {
    id: reqId,
    fullName: fullName.trim(),
    email: email.trim().toLowerCase(),
    createdAt: new Date().toISOString(),
  };
  await setDoc(reqRef, data);
}

export async function listJoinRequests(groupId: string) {
  const database = ensureDb();
  const snap = await getDocs(query(collection(database, `groups/${groupId}/joinRequests`), orderBy("createdAt")));
  return snap.docs.map(doc => doc.data() as import("@/types/domain").JoinRequest);
}

export async function rejectJoinRequest(groupId: string, requestId: string) {
  const database = ensureDb();
  await deleteDoc(doc(database, `groups/${groupId}/joinRequests`, requestId));
}

export async function approveJoinRequest(groupId: string, requestId: string, fullName: string, email: string) {
  const database = ensureDb();
  // We can just call createMember for simplicity, then delete the request
  await createMember({
    groupId,
    fullName,
    joinDate: new Date().toISOString().split("T")[0],
    email,
  });
  await deleteDoc(doc(database, `groups/${groupId}/joinRequests`, requestId));
}


// ── Charts ────────────────────────────────────────────────────────────

export async function listCharts(groupId: string) {
  const database = ensureDb();
  const snapshot = await getDocs(
    query(collection(database, chartsCollection(groupId)), orderBy("monthKey", "desc")),
  );
  return snapshot.docs.map((entry) => {
    const data = entry.data();
    const year = Number(data.year);
    const month = Number(data.month);
    const monthKey =
      typeof data.monthKey === "string" && data.monthKey.length >= 7
        ? data.monthKey
        : !Number.isNaN(year) && !Number.isNaN(month) && month >= 1 && month <= 12
          ? toMonthKey(year, month)
          : "";
    return {
      ...normalizeDoc<Chart>(entry.id, data),
      monthKey,
      totalDays:
        typeof data.totalDays === "number"
          ? data.totalDays
          : !Number.isNaN(year) && !Number.isNaN(month)
            ? new Date(year, month, 0).getDate()
            : 31,
      locked: data.locked === true,
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

  await addDoc(collection(database, chartNoticesCollection(input.groupId, chartId)), {
    ...buildNoticeRecord({
      title: "New chart created",
      body: `${record.label} chart was created with ${record.totalDays} days and set as active.`,
      systemGenerated: true,
    }),
    createdAt: serverTimestamp(),
  });

  return record;
}

export async function updateChartLock(input: {
  groupId: string;
  chartId: string;
  locked: boolean;
}) {
  const database = ensureDb();
  const chartRef = doc(database, chartsCollection(input.groupId), input.chartId);
  const chartSnap = await getDoc(chartRef);
  if (!chartSnap.exists()) throw new Error("Chart not found.");
  const data = chartSnap.data();
  let monthKey = typeof data.monthKey === "string" && data.monthKey.length >= 7 ? data.monthKey : "";
  if (!monthKey && typeof data.year === "number" && typeof data.month === "number") {
    monthKey = toMonthKey(data.year, data.month);
  }
  if (!monthKey) throw new Error("Chart is missing month information.");

  const lockRef = doc(database, lockedMonthsCollection(input.groupId), monthKey);
  const batch = writeBatch(database);
  batch.update(chartRef, { locked: input.locked });
  if (input.locked) {
    batch.set(lockRef, { locked: true, chartId: input.chartId }, { merge: true });
  } else {
    batch.delete(lockRef);
  }
  await batch.commit();
}

/** Writes lockedMonths docs for any chart already marked locked (repair / older data). */
export async function syncLockedMonthDocsFromCharts(groupId: string) {
  const database = ensureDb();
  const snapshot = await getDocs(collection(database, chartsCollection(groupId)));
  let batch = writeBatch(database);
  let ops = 0;
  for (const d of snapshot.docs) {
    const data = d.data();
    if (data.locked != true) continue;
    let monthKey = typeof data.monthKey === "string" && data.monthKey.length >= 7 ? data.monthKey : "";
    if (!monthKey && typeof data.year === "number" && typeof data.month === "number") {
      monthKey = toMonthKey(data.year, data.month);
    }
    if (!monthKey) continue;
    batch.set(
      doc(database, lockedMonthsCollection(groupId), monthKey),
      { locked: true, chartId: d.id },
      { merge: true },
    );
    ops++;
    if (ops >= 400) {
      await batch.commit();
      batch = writeBatch(database);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
}

/** Adds monthKey to older meal docs (YYYY-MM from date) so lock rules and deletes work. */
export async function backfillMealMonthKeys(groupId: string) {
  const database = ensureDb();
  const lockedSnap = await getDocs(collection(database, lockedMonthsCollection(groupId)));
  const lockedMonthKeys = new Set(lockedSnap.docs.map((docSnap) => docSnap.id));

  const snapshot = await getDocs(collection(database, mealsCollection(groupId)));
  let batch = writeBatch(database);
  let ops = 0;
  for (const d of snapshot.docs) {
    const data = d.data();
    if (typeof data.monthKey === "string") continue;
    if (typeof data.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) continue;
    const mk = data.date.slice(0, 7);
    if (lockedMonthKeys.has(mk)) continue;
    batch.update(d.ref, { monthKey: mk });
    ops++;
    if (ops >= 400) {
      await batch.commit();
      batch = writeBatch(database);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
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
  memberName?: string;
}) {
  await assertDateBelongsToChart(input.groupId, input.chartId, input.date);
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

  await addDoc(collection(database, chartNoticesCollection(input.groupId, input.chartId)), {
    ...buildNoticeRecord({
      title: input.amount < 0 ? "Money deducted" : "Money added",
      body: input.amount < 0 
        ? `An amount of ${Math.abs(input.amount).toFixed(2)} tk was deducted/returned for ${input.memberName || 'a member'}.` 
        : `A deposit of ${input.amount.toFixed(2)} tk was added for ${input.memberName || 'a member'}.`,
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
  return snapshot.docs.map((entry) => mapMealEntryDoc(entry.id, entry.data()));
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
  return snapshot.docs.map((entry) => mapMealEntryDoc(entry.id, entry.data()));
}

export async function saveMealEntry(input: {
  groupId: string;
  memberId: string;
  date: string;
  quantity: number;
  chartId?: string;
  memberName?: string;
}) {
  const database = ensureDb();
  const docId = `${input.memberId}_${input.date}`;
  const monthKey = monthKeyFromDate(input.date);
  await setDoc(doc(database, mealsCollection(input.groupId), docId), {
    memberId: input.memberId,
    date: input.date,
    quantity: input.quantity,
    monthKey,
  });
}

export async function saveMealsBatch(input: {
  groupId: string;
  memberIds: string[];
  date: string;
  quantity: number;
}) {
  const database = ensureDb();
  const batch = writeBatch(database);
  const monthKey = monthKeyFromDate(input.date);

  for (const memberId of input.memberIds) {
    const docId = `${memberId}_${input.date}`;
    const ref = doc(database, mealsCollection(input.groupId), docId);
    batch.set(ref, {
      memberId,
      date: input.date,
      quantity: input.quantity,
      monthKey,
    });
  }

  await batch.commit();
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
  await assertDateBelongsToChart(input.groupId, input.chartId, input.date);
  const database = ensureDb();
  const costId = crypto.randomUUID();
  const payload = { id: costId, itemName: input.itemName, amount: input.amount, date: input.date };

  await setDoc(
    doc(database, chartCostsCollection(input.groupId, input.chartId), costId),
    payload,
  );

  await addDoc(collection(database, chartNoticesCollection(input.groupId, input.chartId)), {
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

// ── Delete Chart (and all subcollections) ─────────────────────────────

async function deleteSubcollection(database: ReturnType<typeof ensureDb>, path: string) {
  const snapshot = await getDocs(collection(database, path));
  if (snapshot.empty) return;
  let batch = writeBatch(database);
  let ops = 0;
  for (const d of snapshot.docs) {
    batch.delete(d.ref);
    ops++;
    if (ops >= 400) {
      await batch.commit();
      batch = writeBatch(database);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
}

export async function deleteChart(groupId: string, chartId: string) {
  const database = ensureDb();

  // Read chart to get monthKey for lockedMonths cleanup
  const chartSnap = await getDoc(doc(database, chartsCollection(groupId), chartId));
  if (!chartSnap.exists()) throw new Error("Chart not found.");
  const data = chartSnap.data();
  const monthKey =
    typeof data.monthKey === "string" && data.monthKey.length >= 7
      ? data.monthKey
      : typeof data.year === "number" && typeof data.month === "number"
        ? toMonthKey(data.year, data.month)
        : "";

  // Delete all subcollections first
  await deleteSubcollection(database, chartDepositsCollection(groupId, chartId));
  await deleteSubcollection(database, chartCostsCollection(groupId, chartId));
  await deleteSubcollection(database, chartNoticesCollection(groupId, chartId));

  // Delete meals for this month (stored globally under groups/{groupId}/meals)
  if (monthKey) {
    const mealsSnap = await getDocs(
      query(
        collection(database, mealsCollection(groupId)),
        where("date", ">=", `${monthKey}-01`),
        where("date", "<=", `${monthKey}-31`),
      ),
    );
    if (!mealsSnap.empty) {
      let batch = writeBatch(database);
      let ops = 0;
      for (const d of mealsSnap.docs) {
        batch.delete(d.ref);
        ops++;
        if (ops >= 400) {
          await batch.commit();
          batch = writeBatch(database);
          ops = 0;
        }
      }
      if (ops > 0) await batch.commit();
    }
  }

  // Delete the chart document itself
  await deleteDoc(doc(database, chartsCollection(groupId), chartId));

  // Clean up lockedMonths mirror if it exists
  if (monthKey) {
    try {
      await deleteDoc(doc(database, lockedMonthsCollection(groupId), monthKey));
    } catch {
      // Ignore — may not exist
    }
  }

  // If this was the current chart, clear group's currentChartId
  const groupSnap = await getDoc(doc(database, groupsCollection, groupId));
  if (groupSnap.exists() && groupSnap.data().currentChartId === chartId) {
    await updateDoc(doc(database, groupsCollection, groupId), {
      currentChartId: "",
      currentChartMonth: "",
    });
  }
}

async function addSystemNoticeToCurrentChart(database: Firestore, groupId: string, title: string, body: string) {
  const groupSnap = await getDoc(doc(database, groupsCollection, groupId));
  if (!groupSnap.exists()) return;
  const currentChartId = groupSnap.data().currentChartId;
  if (!currentChartId) return;

  await addDoc(collection(database, chartNoticesCollection(groupId, currentChartId)), {
    ...buildNoticeRecord({
      title,
      body,
      systemGenerated: true,
    }),
    createdAt: serverTimestamp(),
  });
}

// ── Notices ───────────────────────────────────────────────────────────

export async function listNoticesForChart(groupId: string, chartId: string) {
  const database = ensureDb();
  const snapshot = await getDocs(
    query(
      collection(database, chartNoticesCollection(groupId, chartId)),
      orderBy("createdAt", "desc"),
    ),
  );
  return snapshot.docs.map((entry) => normalizeDoc<Notice>(entry.id, entry.data()));
}

export async function createNotice(input: { groupId: string; chartId: string; title: string; body: string }) {
  const database = ensureDb();
  const record = buildNoticeRecord({ title: input.title, body: input.body, systemGenerated: false });
  const ref = await addDoc(collection(database, chartNoticesCollection(input.groupId, input.chartId)), {
    ...record,
    createdAt: serverTimestamp(),
  });
  return { ...record, id: ref.id, createdAt: new Date().toISOString() };
}

export async function updateNotice(input: {
  groupId: string;
  chartId: string;
  noticeId: string;
  title: string;
  body: string;
}) {
  const database = ensureDb();
  await updateDoc(doc(database, chartNoticesCollection(input.groupId, input.chartId), input.noticeId), {
    title: input.title,
    body: input.body,
  });
}

export async function deleteNotice(groupId: string, chartId: string, noticeId: string) {
  const database = ensureDb();
  await deleteDoc(doc(database, chartNoticesCollection(groupId, chartId), noticeId));
}
