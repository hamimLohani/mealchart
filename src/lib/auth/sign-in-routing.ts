import type { User } from "firebase/auth";
import type { Group } from "@/types/domain";
import {
  findAdminProfileByEmail,
  findMemberGroupByEmail,
  getAdminProfile,
  listGroups,
  migrateAdminProfile,
} from "@/lib/firebase/repositories";

export type SignInResolution =
  | { kind: "member"; groupId: string }
  | { kind: "admin" }
  | { kind: "join"; fullName: string; email: string; groups: Group[] };

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function getAdminProfileForUser(user: User) {
  if (!user.email) return getAdminProfile(user.uid);

  const uidProfile = await getAdminProfile(user.uid);
  if (uidProfile) return uidProfile;

  const emailProfile = await findAdminProfileByEmail(user.email);
  if (!emailProfile) return null;

  try {
    await migrateAdminProfile(emailProfile.id, user.uid);
    const migratedProfile = await getAdminProfile(user.uid);
    if (!migratedProfile) {
      throw new Error("Admin profile repair did not complete.");
    }
    return migratedProfile;
  } catch (error) {
    console.warn("Failed to migrate admin profile:", error);
    throw new Error("Admin profile was found for this email, but account repair failed. Deploy the latest Firestore rules, then sign in again.");
  }
}

export async function resolveSignInDestination(user: User): Promise<SignInResolution> {
  if (!user.email) throw new Error("No email found from Google.");

  const email = normalizeEmail(user.email);
  const memberGroupId = await findMemberGroupByEmail(email);
  if (memberGroupId) return { kind: "member", groupId: memberGroupId };

  const adminProfile = await getAdminProfileForUser(user);
  if (adminProfile) return { kind: "admin" };

  return {
    kind: "join",
    fullName: user.displayName || "",
    email,
    groups: await listGroups(),
  };
}
