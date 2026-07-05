import type { User } from "firebase/auth";
import type { Group, AdminProfile } from "@/types/domain";
import {
  findAdminProfileByEmail,
  findMemberGroupByEmail,
  getAdminProfile,
  listGroups,
  migrateAdminProfile,
  updateAdminProfile,
} from "@/lib/firebase/repositories";

export type SignInResolution =
  | { kind: "member"; groupId: string; memberId: string }
  | { kind: "admin" }
  | { kind: "join"; fullName: string; email: string; groups: Group[] };

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

type ResolveSignInOptions = {
  preferAdmin?: boolean;
};

export async function getAdminProfileForUser(user: User) {
  let profile: AdminProfile | null = null;

  if (!user.email) {
    profile = await getAdminProfile(user.uid);
  } else {
    profile = await getAdminProfile(user.uid);
    if (!profile) {
      profile = await findAdminProfileByEmail(user.email);
    }
  }

  // Backfill name if missing
  if (profile && !profile.fullName && user.displayName) {
    try {
      await updateAdminProfile(profile.id, { fullName: user.displayName });
      profile.fullName = user.displayName;
    } catch (e) {
      console.warn("Failed to backfill admin name:", e);
    }
  }

  return profile;
}

export async function resolveSignInDestination(user: User, options: ResolveSignInOptions = {}): Promise<SignInResolution> {
  if (!user.email) throw new Error("No email found from Google.");

  const email = normalizeEmail(user.email);
  if (options.preferAdmin) {
    const adminProfile = await getAdminProfileForUser(user);
    if (adminProfile) return { kind: "admin" };
  }

  const memberProfile = await findMemberGroupByEmail(email);
  if (memberProfile) {
    return {
      kind: "member",
      groupId: memberProfile.groupId,
      memberId: memberProfile.memberId,
    };
  }

  if (!options.preferAdmin) {
    const adminProfile = await getAdminProfileForUser(user);
    if (adminProfile) return { kind: "admin" };
  }

  return {
    kind: "join",
    fullName: user.displayName || "",
    email,
    groups: await listGroups(),
  };
}
