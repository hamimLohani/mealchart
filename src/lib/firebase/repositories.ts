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
import {
  getMemberTotals,
  getMonthTotals,
  normalizeMealQuantity,
} from "@/lib/utils/meal-money";
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
  return {
    ...normalizeDoc<MealEntry>(id, data),
    quantity: normalizeMealQuantity(Number(data.quantity)),
    ...(mk ? { monthKey: mk } : {}),
  };
}

function isTimestampLike(value: unknown): value is { seconds: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof (value as { seconds?: unknown }).seconds === "number"
  );
}

function serializeDate(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (isTimestampLike(value)) {
    return new Date(value.seconds * 1000).toISOString();
  }
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
  const normalizedEmail = email.trim().toLowerCase();
  const q = query(collection(database, adminsCollection), where("email", "==", normalizedEmail), limit(1));
  const snap = await getDocs(q);
  if (snap.empty && normalizedEmail !== email.trim()) {
    const fallback = await getDocs(
      query(collection(database, adminsCollection), where("email", "==", email.trim()), limit(1)),
    );
    if (fallback.empty) return null;
    const d = fallback.docs[0];
    const data = d.data();
    return {
      ...normalizeDoc<AdminProfile>(d.id, data),
      createdAt: serializeDate(data.createdAt),
    };
  }
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  return {
    ...normalizeDoc<AdminProfile>(d.id, data),
    createdAt: serializeDate(data.createdAt),
  };
}
export async function updateAdminProfile(adminId: string, payload: Partial<AdminProfile>) {
  const database = ensureDb();
  await updateDoc(doc(database, adminsCollection, adminId), payload);
}


export async function migrateAdminProfile(oldUid: string, newUid: string) {
  const database = ensureDb();
  const oldRef = doc(database, adminsCollection, oldUid);
  const newRef = doc(database, adminsCollection, newUid);
  
  const snap = await getDoc(oldRef);
  if (!snap.exists()) return;
  
  const data = snap.data();
  const groupId = typeof data.groupId === "string" ? data.groupId : "";
  if (!groupId) throw new Error("Admin profile is missing a group.");

  const batch = writeBatch(database);
  batch.set(newRef, {
    ...data,
    id: newUid,
    email: typeof data.email === "string" ? data.email.trim().toLowerCase() : data.email,
  });
  batch.update(doc(database, groupsCollection, groupId), { adminId: newUid });
  await batch.commit();
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

  // --- Payment/Limit Check ---
  const groupSnap = await getDoc(doc(database, groupsCollection, input.groupId));
  if (!groupSnap.exists()) throw new Error("Group not found.");
  const groupData = groupSnap.data();
  
  const totalCreated = groupData.totalMembersCreated || 0;

  // Allow up to 4 free members, then require paid slots-------------------------------------------------------------------------------------------------------------------------------------
  if (totalCreated >= 4) {// <-----------------------------------------------------------------------------------------------------------------------------------------------------------------
    const paidSlots = groupData.paidMemberSlots || 0;
    if (paidSlots <= 0) {
      throw new Error("LIMIT_REACHED_MEMBER");
    }
    // Deduct one paid slot and increment total count
    await updateDoc(doc(database, groupsCollection, input.groupId), {
      paidMemberSlots: paidSlots - 1,
      totalMembersCreated: totalCreated + 1
    });
  } else {
    // Increment total count for free slot
    await updateDoc(doc(database, groupsCollection, input.groupId), {
      totalMembersCreated: totalCreated + 1
    });
  }
  // ---------------------------

  const record = buildMemberRecord({
    id: memberId,
    fullName: input.fullName,
    joinDate: input.joinDate,
    email: memberId,
  });

  await setDoc(memberRef, record);

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
  const normalizedEmail = input.email.trim().toLowerCase();
  if (normalizedEmail !== input.memberId.trim().toLowerCase()) {
    throw new Error("Member email cannot be changed after creation. Remove and re-add the member with the new email.");
  }

  const memberRef = doc(database, membersCollection(input.groupId), input.memberId);
  const payload = {
    fullName: input.fullName,
    joinDate: input.joinDate,
    email: normalizedEmail,
    active: true,
  };

  await updateDoc(memberRef, payload);

  return { id: input.memberId, ...payload } as Member;
}

export async function deleteMember(groupId: string, memberId: string) {
  const database = ensureDb();
  const memberRef = doc(database, membersCollection(groupId), memberId);
  const snapshot = await getDoc(memberRef);

  if (!snapshot.exists()) throw new Error("Member was not found.");

  await deleteDoc(memberRef);
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
  const normalizedEmail = email.trim().toLowerCase();
  const reqId = encodeURIComponent(normalizedEmail);
  const reqRef = doc(database, `groups/${groupId}/joinRequests`, reqId);
  const data = {
    id: reqId,
    fullName: fullName.trim(),
    email: normalizedEmail,
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

export async function getChartById(groupId: string, chartId: string) {
  const database = ensureDb();
  const snapshot = await getDoc(doc(database, chartsCollection(groupId), chartId));
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  const year = Number(data.year);
  const month = Number(data.month);
  const monthKey =
    typeof data.monthKey === "string" && data.monthKey.length >= 7
      ? data.monthKey
      : !Number.isNaN(year) && !Number.isNaN(month) && month >= 1 && month <= 12
        ? toMonthKey(year, month)
        : "";

  return {
    ...normalizeDoc<Chart>(snapshot.id, data),
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
}

export async function createChart(input: {
  groupId: string;
  year: number;
  month: number;
  carryOver?: boolean;
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

  // --- Payment/Limit Check ---
  const groupSnap = await getDoc(doc(database, groupsCollection, input.groupId));
  if (!groupSnap.exists()) throw new Error("Group not found.");
  const groupData = groupSnap.data();

  const totalCreated = groupData.totalChartsCreated || 0;

  // Allow up to 3 free charts, then require paid slots------------------------------------------------------------------------------------------------------------------------------
  if (totalCreated >= 3) {// <--------------------------------------------------------------------------------------------------------------------------------------------------------
    const paidSlots = groupData.paidChartSlots || 0;
    if (paidSlots <= 0) {
      throw new Error("LIMIT_REACHED_CHART");
    }
    // Deduct one paid slot and increment total count
    await updateDoc(doc(database, groupsCollection, input.groupId), {
      paidChartSlots: paidSlots - 1,
      totalChartsCreated: totalCreated + 1
    });
  } else {
    // Increment total count for free slot
    await updateDoc(doc(database, groupsCollection, input.groupId), {
      totalChartsCreated: totalCreated + 1
    });
  }
  // ---------------------------

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

  // --- Carry Over Logic ---
  if (input.carryOver) {
    const charts = await listCharts(input.groupId);
    // The newly created chart might be in the list, so we filter it out and take the next one
    const previousChart = charts.find((c) => c.id !== chartId);

    if (previousChart) {
      const [members, meals, costs, deposits] = await Promise.all([
        listMembers(input.groupId),
        getMealsForMonth(input.groupId, previousChart.monthKey),
        listCostsForChart(input.groupId, previousChart.id),
        listDepositsForChart(input.groupId, previousChart.id),
      ]);

      const { mealRate } = getMonthTotals(meals, costs, deposits);
      const firstDayOfNewMonth = `${monthKey}-01`;

      for (const member of members) {
        const { balance } = getMemberTotals(member.id, meals, deposits, mealRate);
        if (Math.abs(balance) > 0.01) {
          // Only carry over non-zero balances
          const depositId = crypto.randomUUID();
          const carryRecord = buildDepositRecord({
            id: depositId,
            memberId: member.id.toLowerCase(),
            amount: balance,
            date: firstDayOfNewMonth,
            collectedByAdminId: "system-carryover",
          });

          await setDoc(
            doc(database, chartDepositsCollection(input.groupId, chartId), depositId),
            carryRecord,
          );

          await addDoc(collection(database, chartNoticesCollection(input.groupId, chartId)), {
            ...buildNoticeRecord({
              title: `ERR_TRANS:${JSON.stringify({ key: "groupNotices.carryOverTitle" })}`,
              body: `ERR_TRANS:${JSON.stringify({
                key: "groupNotices.carryOverBody",
                vars: {
                  member: member.fullName,
                  amount: balance.toFixed(2),
                },
              })}`,
              systemGenerated: true,
            }),
            createdAt: serverTimestamp(),
          });
        }
      }
    }
  }
  // -------------------------

  await updateDoc(doc(database, groupsCollection, input.groupId), {
    currentChartId: chartId,
    currentChartMonth: monthKey,
  });

  return record;
}

/** 
 * Utility function to manually add paid slots to a group.
 * You can call this after receiving manual payment.
 */
export async function addPaidSlotsToGroup(groupId: string, charts: number, members: number) {
  const database = ensureDb();
  const groupRef = doc(database, groupsCollection, groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) throw new Error("Group not found.");
  
  const data = snap.data();
  const currentCharts = Number(data.paidChartSlots || 0);
  const currentMembers = Number(data.paidMemberSlots || 0);

  await updateDoc(groupRef, {
    paidChartSlots: currentCharts + charts,
    paidMemberSlots: currentMembers + members,
  });
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

/** Converts old plain-text system notices to the new translatable JSON format. */
export async function backfillSystemNotices(groupId: string) {
  const database = ensureDb();
  const charts = await listCharts(groupId);
  let batch = writeBatch(database);
  let ops = 0;

  for (const chart of charts) {
    const noticesRef = collection(database, chartNoticesCollection(groupId, chart.id));
    const snap = await getDocs(query(noticesRef, where("systemGenerated", "==", true)));
    
    for (const d of snap.docs) {
      const data = d.data();
      const title = String(data.title || "");
      const body = String(data.body || "");

      // Already in the new format
      if (title.startsWith("ERR_TRANS:")) continue;

      let newTitle = title;
      let newBody = body;

      // Identify deposit notices
      if (title === "Money added") {
        newTitle = `ERR_TRANS:${JSON.stringify({ key: "groupNotices.depositAddedTitle" })}`;
        // Extract amount and member from old body: "A deposit of 500.00 tk was added for Member Name."
        const match = body.match(/deposit of ([\d.]+) tk was added for (.*)\./);
        if (match) {
          newBody = `ERR_TRANS:${JSON.stringify({
            key: "groupNotices.depositAddedBody",
            vars: { amount: match[1], member: match[2] }
          })}`;
        }
      } else if (title === "Money deducted") {
        newTitle = `ERR_TRANS:${JSON.stringify({ key: "groupNotices.depositDeductedTitle" })}`;
        const match = body.match(/amount of ([\d.]+) tk was deducted\/returned for (.*)\./);
        if (match) {
          newBody = `ERR_TRANS:${JSON.stringify({
            key: "groupNotices.depositDeductedBody",
            vars: { amount: match[1], member: match[2] }
          })}`;
        }
      } else if (title === "Cost added") {
        newTitle = `ERR_TRANS:${JSON.stringify({ key: "groupNotices.costAddedTitle" })}`;
        // "Item Name — 250.00 tk on 2024-05-15."
        const match = body.match(/(.*) — ([\d.]+) tk on ([\d-]+)\./);
        if (match) {
          newBody = `ERR_TRANS:${JSON.stringify({
            key: "groupNotices.costAddedBody",
            vars: { item: match[1], amount: match[2], date: match[3] }
          })}`;
        }
      }

      if (newTitle !== title) {
        batch.update(d.ref, { title: newTitle, body: newBody });
        ops++;
        if (ops >= 400) {
          await batch.commit();
          batch = writeBatch(database);
          ops = 0;
        }
      }
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
    memberId: input.memberId.toLowerCase(),
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
      title: `ERR_TRANS:${JSON.stringify({ 
        key: input.amount < 0 ? "groupNotices.depositDeductedTitle" : "groupNotices.depositAddedTitle" 
      })}`,
      body: `ERR_TRANS:${JSON.stringify({ 
        key: input.amount < 0 ? "groupNotices.depositDeductedBody" : "groupNotices.depositAddedBody",
        vars: { 
          amount: Math.abs(input.amount).toFixed(2), 
          member: input.memberName || 'a member' 
        }
      })}`,
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
  const memberId = input.memberId.toLowerCase();
  const quantity = normalizeMealQuantity(input.quantity);
  const docId = `${memberId}_${input.date}`;
  const monthKey = monthKeyFromDate(input.date);
  await setDoc(doc(database, mealsCollection(input.groupId), docId), {
    memberId,
    date: input.date,
    quantity,
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
  const quantity = normalizeMealQuantity(input.quantity);

  for (const memberId of input.memberIds) {
    const mid = memberId.toLowerCase();
    const docId = `${mid}_${input.date}`;
    const ref = doc(database, mealsCollection(input.groupId), docId);
    batch.set(ref, {
      memberId: mid,
      date: input.date,
      quantity,
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
    return snapshot.docs.map((entry) => mapMealEntryDoc(entry.id, entry.data()));
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
      .map((entry) => mapMealEntryDoc(entry.id, entry.data()))
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
      title: `ERR_TRANS:${JSON.stringify({ key: "groupNotices.costAddedTitle" })}`,
      body: `ERR_TRANS:${JSON.stringify({ 
        key: "groupNotices.costAddedBody",
        vars: { 
          item: input.itemName, 
          amount: input.amount.toFixed(2),
          date: input.date 
        }
      })}`,
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



// ── Notices ───────────────────────────────────────────────────────────

export async function listNoticesForChart(groupId: string, chartId: string) {
  const database = ensureDb();
  const snapshot = await getDocs(
    query(
      collection(database, chartNoticesCollection(groupId, chartId)),
      orderBy("createdAt", "desc"),
    ),
  );
  return snapshot.docs.map((entry) => {
    const data = entry.data();
    return {
      ...normalizeDoc<Notice>(entry.id, data),
      createdAt: serializeDate(data.createdAt),
    };
  });
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
