"use client";

import useSWR from "swr";
import { useAuthStore } from "@/store/auth-store";
import { getAdminProfileForUser } from "@/lib/auth/sign-in-routing";

export function useCurrentAdminProfile() {
  const { admin, isLoaded } = useAuthStore();

  const swr = useSWR(
    isLoaded && admin ? ["currentAdminProfile", admin.uid, admin.email ?? ""] : null,
    async () => {
      const profile = await getAdminProfileForUser(admin!);
      if (!profile) throw new Error("No admin profile was found for the current user.");
      return profile;
    },
    {
      revalidateOnFocus: false,
      // Admin profile is static during a session — only re-fetch once per 5 min.
      dedupingInterval: 5 * 60 * 1000,
      revalidateIfStale: false,
    },
  );

  return {
    currentUser: admin,
    isAuthLoaded: isLoaded,
    adminProfile: swr.data ?? null,
    isLoading: !isLoaded || (!!admin && swr.isLoading),
    error: swr.error,
  };
}
