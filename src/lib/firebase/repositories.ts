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
  buildAdminProfile,
  buildChartRecord,
  buildDepositRecord,
  buildMemberRecord,
} from "@/lib/firebase/factories";
import {
  adminsCollection,
  chartsCollection,
  chartCostsCollection,
  chartCostRequestsCollection,
  chartDepositRequestsCollection,
  chartDepositsCollection,
  mealsCollection,
  membersCollection,
  groupsCollection,
  lockedMonthsCollection,
} from "@/lib/firebase/paths";
import {
  formatChartLabel,
  monthKeyFromDate,
  toMonthKey,
  getChartMonthKeys,
} from "@/lib/utils/date";
import {
  getMemberTotals,
  getMonthTotals,
  normalizeMealQuantity,
} from "@/lib/utils/meal-money";
import type { AdminProfile, Chart, CostEntry, CostRequest, DepositEntry, DepositRequest, Group, MealEntry, Member } from "@/types/domain";

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
  
  const mKeys = Array.isArray(data.monthKeys) && data.monthKeys.length > 0 ? data.monthKeys : [chartMk];
  const dateMk = monthKeyFromDate(date);
  if (!mKeys.includes(dateMk)) {
    throw new Error(`Date must fall within one of the chart's months (${mKeys.join(', ')}).`);
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

export async function updateGroupWhatsappConfig(
  groupId: string,
  config: {
    whatsappPhoneNumberId: string;
    whatsappAccessToken: string;
    whatsappRecipientPhone: string;
    whatsappEnabled: boolean;
  }
): Promise<void> {
  const database = ensureDb();
  await setDoc(doc(database, groupsCollection, groupId, "settings", "whatsapp"), {
    whatsappPhoneNumberId: config.whatsappPhoneNumberId.trim(),
    whatsappAccessToken: config.whatsappAccessToken.trim(),
    whatsappRecipientPhone: config.whatsappRecipientPhone.trim(),
    whatsappEnabled: config.whatsappEnabled,
  });
}

export async function getGroupWhatsappConfig(groupId: string) {
  const database = ensureDb();
  const snapshot = await getDoc(doc(database, groupsCollection, groupId, "settings", "whatsapp"));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    whatsappPhoneNumberId: (data.whatsappPhoneNumberId as string | undefined) ?? "",
    whatsappAccessToken: (data.whatsappAccessToken as string | undefined) ?? "",
    whatsappRecipientPhone: (data.whatsappRecipientPhone as string | undefined) ?? "",
    whatsappEnabled: (data.whatsappEnabled as boolean | undefined) ?? false,
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

export async function deleteAdminProfile(adminId: string) {
  const database = ensureDb();
  await deleteDoc(doc(database, adminsCollection, adminId));
}

export async function createAdminProfile(input: {
  groupId: string;
  email: string;
  fullName?: string;
  role?: "owner" | "admin";
}) {
  const database = ensureDb();
  const normalizedEmail = input.email.trim().toLowerCase();
  const profileId = `${input.groupId}:${normalizedEmail}`;
  const profileRef = doc(database, adminsCollection, profileId);
  const existingSnap = await getDoc(profileRef);
  if (existingSnap.exists()) {
    throw new Error("ADMIN_ALREADY_EXISTS");
  }

  // Check if email is already an admin in any group
  const existingAdmin = await findAdminProfileByEmail(input.email);
  if (existingAdmin) {
    throw new Error("ADMIN_ALREADY_EXISTS");
  }

  // Check if email is already a member in another group
  const existingMember = await findMemberGroupByEmail(input.email);
  if (existingMember && existingMember.groupId !== input.groupId) {
    throw new Error("EMAIL_ALREADY_MEMBER");
  }

  const payload = buildAdminProfile({
    id: profileId,
    email: normalizedEmail,
    fullName: input.fullName?.trim() || undefined,
    groupId: input.groupId,
    role: input.role ?? "admin",
  });

  await setDoc(profileRef, payload);
  return payload;
}

export async function listAdminProfiles(groupId: string) {
  const database = ensureDb();
  const snapshot = await getDocs(query(collection(database, adminsCollection), where("groupId", "==", groupId)));
  return snapshot.docs.map((entry) => ({
    ...normalizeDoc<AdminProfile>(entry.id, entry.data()),
    createdAt: serializeDate(entry.data().createdAt),
  }));
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

  const groupRef = doc(database, groupsCollection, groupId);
  const groupSnap = await getDoc(groupRef);
  const groupData = groupSnap.exists() ? groupSnap.data() : null;
  const currentAdminId = typeof groupData?.adminId === "string" ? groupData.adminId : "";
  const shouldUpdateGroupAdmin = !currentAdminId || currentAdminId === oldUid;

  const batch = writeBatch(database);
  batch.set(newRef, {
    ...data,
    id: newUid,
    email: typeof data.email === "string" ? data.email.trim().toLowerCase() : data.email,
  });
  if (shouldUpdateGroupAdmin) {
    batch.update(groupRef, { adminId: newUid });
  }
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

  // Check if email is already an admin in any group
  const existingAdmin = await findAdminProfileByEmail(input.email);
  if (existingAdmin) {
    throw new Error("EMAIL_ALREADY_ADMIN");
  }

  // Check if email is already a member in any group
  const existingMember = await findMemberGroupByEmail(input.email);
  if (existingMember) {
    throw new Error("EMAIL_ALREADY_MEMBER");
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

  const data = snapshot.data();
  if (data?.email) {
    const adminDocId = `${groupId}:${data.email.trim().toLowerCase()}`;
    const adminDocRef = doc(database, adminsCollection, adminDocId);
    try {
      await deleteDoc(adminDocRef);
    } catch {
      // ignore if admin doc doesn't exist
    }
  }

  await deleteDoc(memberRef);
}

export async function findMemberGroupByEmail(email: string): Promise<{ groupId: string; memberId: string } | null> {
  const database = ensureDb();
  const q = query(collectionGroup(database, "members"), where("email", "==", email.trim().toLowerCase()), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  // path is groups/{groupId}/members/{memberId}
  const groupId = docSnap.ref.parent.parent?.id;
  if (!groupId) return null;
  return { groupId, memberId: docSnap.id };
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
      duration: data.duration ?? 1,
      monthKeys: Array.isArray(data.monthKeys) ? data.monthKeys : [monthKey],
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
    duration: data.duration ?? 1,
    monthKeys: Array.isArray(data.monthKeys) ? data.monthKeys : [monthKey],
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
  duration?: number;
}) {
  const database = ensureDb();
  const duration = input.duration || 1;
  const monthKeys = getChartMonthKeys(input.year, input.month, duration);
  const monthKey = monthKeys[0];

  // Use array-contains-any to avoid downloading all charts — only fetch those
  // whose monthKeys array overlaps with the new chart's month keys.
  const overlapSnap = await getDocs(
    query(
      collection(database, chartsCollection(input.groupId)),
      where("monthKeys", "array-contains-any", monthKeys),
    )
  );
  if (!overlapSnap.empty) {
    throw new Error("A chart for one or more of these months already exists.");
  }

  // --- Payment/Limit Check ---
  const groupSnap = await getDoc(doc(database, groupsCollection, input.groupId));
  if (!groupSnap.exists()) throw new Error("Group not found.");
  const groupData = groupSnap.data();

  const totalCreated = groupData.totalChartsCreated || 0;

  // Allow up to 3 free charts, then require paid slots------------------------------------------------------------------------------------------------------------------------------
  if (totalCreated >= 3) {// <--------------------------------------------------------------------------------------------------------------------------------------------------------
    const paidSlots = groupData.paidChartSlots || 0;
    if (paidSlots < duration) {
      throw new Error("LIMIT_REACHED_CHART");
    }
    // Deduct slots based on duration and increment total count
    await updateDoc(doc(database, groupsCollection, input.groupId), {
      paidChartSlots: paidSlots - duration,
      totalChartsCreated: totalCreated + duration
    });
  } else {
    // Increment total count for free slot
    const remainingFree = Math.max(0, 3 - totalCreated);
    const slotsToPay = Math.max(0, duration - remainingFree);
    
    if (slotsToPay > 0) {
      const paidSlots = groupData.paidChartSlots || 0;
      if (paidSlots < slotsToPay) {
        throw new Error("LIMIT_REACHED_CHART");
      }
      await updateDoc(doc(database, groupsCollection, input.groupId), {
        paidChartSlots: paidSlots - slotsToPay,
        totalChartsCreated: totalCreated + duration
      });
    } else {
      await updateDoc(doc(database, groupsCollection, input.groupId), {
        totalChartsCreated: totalCreated + duration
      });
    }
  }
  // ---------------------------

  const chartId = crypto.randomUUID();
  const record = buildChartRecord({
    id: chartId,
    label: formatChartLabel(input.year, input.month, duration),
    monthKey,
    year: input.year,
    month: input.month,
    duration,
  });

  await setDoc(
    doc(database, chartsCollection(input.groupId), chartId),
    { ...record, createdAt: serverTimestamp() },
  );

  // --- Carry Over Logic ---
  if (input.carryOver) {
    const charts = await listCharts(input.groupId);
    // Find the chronologically preceding chart
    const previousChart = charts
      .filter((c) => c.id !== chartId && c.monthKey < monthKey)
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey))[0];

    if (previousChart) {
      const [members, meals, costs, deposits] = await Promise.all([
        listMembers(input.groupId),
        getMealsForChart(input.groupId, previousChart),
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

  const mKeys = Array.isArray(data.monthKeys) && data.monthKeys.length > 0 ? data.monthKeys : [monthKey];

  const batch = writeBatch(database);
  batch.update(chartRef, { locked: input.locked });
  for (const mk of mKeys) {
    const lockRef = doc(database, lockedMonthsCollection(input.groupId), mk);
    if (input.locked) {
      batch.set(lockRef, { locked: true, chartId: input.chartId }, { merge: true });
    } else {
      batch.delete(lockRef);
    }
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
    
    const mKeys = Array.isArray(data.monthKeys) && data.monthKeys.length > 0 ? data.monthKeys : [monthKey];
    for (const mk of mKeys) {
      batch.set(
        doc(database, lockedMonthsCollection(groupId), mk),
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

export async function listDepositRequestsForChart(groupId: string, chartId: string) {
  const database = ensureDb();
  const snapshot = await getDocs(
    query(
      collection(database, chartDepositRequestsCollection(groupId, chartId)),
      orderBy("createdAt", "desc"),
    ),
  );
  return snapshot.docs.map((entry) => {
    const data = entry.data();
    return {
      ...normalizeDoc<DepositRequest>(entry.id, data),
      createdAt: serializeDate(data.createdAt),
    };
  });
}

export async function submitDepositRequest(input: {
  groupId: string;
  chartId: string;
  memberId: string;
  memberName: string;
  requestedByEmail: string;
  amount: number;
  date: string;
}) {
  await assertDateBelongsToChart(input.groupId, input.chartId, input.date);
  const database = ensureDb();
  const requestId = crypto.randomUUID();
  const payload: DepositRequest = {
    id: requestId,
    memberId: input.memberId.toLowerCase(),
    memberName: input.memberName,
    requestedByEmail: input.requestedByEmail.trim().toLowerCase(),
    amount: input.amount,
    date: input.date,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  await setDoc(
    doc(database, chartDepositRequestsCollection(input.groupId, input.chartId), requestId),
    payload,
  );

  return payload;
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

  return record;
}

export async function approveDepositRequest(input: {
  groupId: string;
  chartId: string;
  requestId: string;
  collectedByAdminId: string;
}) {
  const database = ensureDb();
  const requestRef = doc(database, chartDepositRequestsCollection(input.groupId, input.chartId), input.requestId);
  const requestSnap = await getDoc(requestRef);
  if (!requestSnap.exists()) throw new Error("Money request was not found.");
  const request = normalizeDoc<DepositRequest>(requestSnap.id, requestSnap.data());

  const deposit = await createDeposit({
    groupId: input.groupId,
    chartId: input.chartId,
    memberId: request.memberId,
    amount: request.amount,
    date: request.date,
    collectedByAdminId: input.collectedByAdminId,
    memberName: request.memberName,
  });
  await deleteDoc(requestRef);
  return deposit;
}

export async function rejectDepositRequest(groupId: string, chartId: string, requestId: string) {
  const database = ensureDb();
  await deleteDoc(doc(database, chartDepositRequestsCollection(groupId, chartId), requestId));
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
  // Use monthKey equality filter — much faster than a date range query.
  // Falls back to date range if monthKey index is unavailable.
  try {
    const snapshot = await getDocs(
      query(
        collection(database, mealsCollection(groupId)),
        where("monthKey", "==", monthKey),
      ),
    );
    return snapshot.docs.map((entry) => mapMealEntryDoc(entry.id, entry.data()));
  } catch {
    // Fallback for older documents that don't have monthKey set yet
    const snapshot = await getDocs(
      query(
        collection(database, mealsCollection(groupId)),
        where("date", ">=", `${monthKey}-01`),
        where("date", "<=", `${monthKey}-31`),
      ),
    );
    return snapshot.docs.map((entry) => mapMealEntryDoc(entry.id, entry.data()));
  }
}

export async function getMealsForChart(groupId: string, chart: Chart) {
  const mKeys = chart.monthKeys && chart.monthKeys.length > 0 ? chart.monthKeys : [chart.monthKey];
  // Fetch all months in parallel instead of sequentially
  const results = await Promise.all(mKeys.map((mk) => getMealsForMonth(groupId, mk)));
  return results.flat();
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

export async function listCostRequestsForChart(groupId: string, chartId: string) {
  const database = ensureDb();
  const snapshot = await getDocs(
    query(
      collection(database, chartCostRequestsCollection(groupId, chartId)),
      orderBy("createdAt", "desc"),
    ),
  );
  return snapshot.docs.map((entry) => {
    const data = entry.data();
    return {
      ...normalizeDoc<CostRequest>(entry.id, data),
      createdAt: serializeDate(data.createdAt),
    };
  });
}

export async function submitCostRequest(input: {
  groupId: string;
  chartId: string;
  itemName: string;
  amount: number;
  date: string;
  memberId: string;
  memberName: string;
  requestedByEmail: string;
}) {
  await assertDateBelongsToChart(input.groupId, input.chartId, input.date);
  const database = ensureDb();
  const requestId = crypto.randomUUID();
  const payload: CostRequest = {
    id: requestId,
    itemName: input.itemName,
    amount: input.amount,
    date: input.date,
    memberId: input.memberId.toLowerCase(),
    memberName: input.memberName,
    requestedByEmail: input.requestedByEmail.trim().toLowerCase(),
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  await setDoc(
    doc(database, chartCostRequestsCollection(input.groupId, input.chartId), requestId),
    payload,
  );

  return payload;
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

  return payload as CostEntry;
}

export async function deleteCost(groupId: string, chartId: string, costId: string) {
  const database = ensureDb();
  await deleteDoc(doc(database, chartCostsCollection(groupId, chartId), costId));
}

export async function approveCostRequest(groupId: string, chartId: string, requestId: string) {
  const database = ensureDb();
  const requestRef = doc(database, chartCostRequestsCollection(groupId, chartId), requestId);
  const requestSnap = await getDoc(requestRef);
  if (!requestSnap.exists()) throw new Error("Cost request was not found.");
  const request = normalizeDoc<CostRequest>(requestSnap.id, requestSnap.data());

  const cost = await createCost({
    groupId,
    chartId,
    itemName: request.itemName,
    amount: request.amount,
    date: request.date,
  });
  await deleteDoc(requestRef);
  return cost;
}

export async function rejectCostRequest(groupId: string, chartId: string, requestId: string) {
  const database = ensureDb();
  await deleteDoc(doc(database, chartCostRequestsCollection(groupId, chartId), requestId));
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
  await deleteSubcollection(database, chartDepositRequestsCollection(groupId, chartId));
  await deleteSubcollection(database, chartCostsCollection(groupId, chartId));
  await deleteSubcollection(database, chartCostRequestsCollection(groupId, chartId));

  // Delete meals for this month (stored globally under groups/{groupId}/meals)
  if (monthKey) {
    const mKeys = Array.isArray(data.monthKeys) && data.monthKeys.length > 0 ? data.monthKeys : [monthKey];
    for (const mk of mKeys) {
      const mealsSnap = await getDocs(
        query(
          collection(database, mealsCollection(groupId)),
          where("date", ">=", `${mk}-01`),
          where("date", "<=", `${mk}-31`),
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
  }

  // Delete the chart document itself
  await deleteDoc(doc(database, chartsCollection(groupId), chartId));

  // Clean up lockedMonths mirror if it exists
  if (monthKey) {
    const mKeys = Array.isArray(data.monthKeys) && data.monthKeys.length > 0 ? data.monthKeys : [monthKey];
    for (const mk of mKeys) {
      try {
        await deleteDoc(doc(database, lockedMonthsCollection(groupId), mk));
      } catch {
        // Ignore — may not exist
      }
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




/**
 * Permanently deletes an entire group and all associated records:
 * - All charts and their subcollections (deposits, depositRequests, costs, costRequests, notices)
 * - All global meals
 * - All members
 * - All lockedMonths mirrors
 * - All joinRequests
 * - Group settings (e.g. WhatsApp)
 * - The group document itself
 * - All admin profiles for this group (including owner and temporary admins)
 */
export async function deleteEntireGroupAndAccount(groupId: string, ownerAdminId?: string) {
  const database = ensureDb();

  // 1. Delete all charts and their subcollections
  const chartsSnap = await getDocs(collection(database, chartsCollection(groupId)));
  for (const chartDoc of chartsSnap.docs) {
    const chartId = chartDoc.id;
    await deleteSubcollection(database, chartDepositsCollection(groupId, chartId));
    await deleteSubcollection(database, chartDepositRequestsCollection(groupId, chartId));
    await deleteSubcollection(database, chartCostsCollection(groupId, chartId));
    await deleteSubcollection(database, chartCostRequestsCollection(groupId, chartId));
    await deleteDoc(chartDoc.ref);
  }

  // 2. Delete all global meals
  const mealsSnap = await getDocs(collection(database, mealsCollection(groupId)));
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

  // 3. Delete all members
  const membersSnap = await getDocs(collection(database, membersCollection(groupId)));
  if (!membersSnap.empty) {
    let batch = writeBatch(database);
    let ops = 0;
    for (const d of membersSnap.docs) {
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

  // 4. Delete lockedMonths mirrors
  const lockedSnap = await getDocs(collection(database, lockedMonthsCollection(groupId)));
  if (!lockedSnap.empty) {
    let batch = writeBatch(database);
    let ops = 0;
    for (const d of lockedSnap.docs) {
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

  // 5. Delete joinRequests
  const joinRequestsSnap = await getDocs(collection(database, `groups/${groupId}/joinRequests`));
  if (!joinRequestsSnap.empty) {
    let batch = writeBatch(database);
    let ops = 0;
    for (const d of joinRequestsSnap.docs) {
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

  // 6. Delete group settings
  try {
    await deleteDoc(doc(database, groupsCollection, groupId, "settings", "whatsapp"));
  } catch {
    // Ignore if not present
  }

  // 7. Delete all admins for this group
  const adminsSnap = await getDocs(
    query(collection(database, adminsCollection), where("groupId", "==", groupId)),
  );
  if (!adminsSnap.empty) {
    let batch = writeBatch(database);
    let ops = 0;
    for (const d of adminsSnap.docs) {
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

  // Also make sure owner's admin doc by UID is deleted if it wasn't caught in query
  if (ownerAdminId) {
    try {
      await deleteDoc(doc(database, adminsCollection, ownerAdminId));
    } catch {
      // Ignore if already deleted
    }
  }

  // 8. Delete the group document itself
  await deleteDoc(doc(database, groupsCollection, groupId));
}

