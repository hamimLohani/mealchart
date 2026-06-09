"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { AdminLoadingState } from "@/components/admin/admin-loading-state";
import { GroupDashboard } from "@/components/group/group-dashboard";
import { GroupNavbar } from "@/components/group/group-navbar";
import { useT } from "@/i18n/use-t";
import { getAdminProfileForUser } from "@/lib/auth/sign-in-routing";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";
import { useMembers } from "@/lib/hooks/use-data";
import { useAuthStore } from "@/store/auth-store";

export function GroupHome({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { t } = useT();
  const { admin: currentUser, isLoaded } = useAuthStore();
  const { data: members = [], isLoading: membersLoading } = useMembers(groupId);
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

  useEffect(() => {
    let active = true;

    async function checkAdmin() {
      if (!isLoaded) return;
      if (!currentUser) {
        setIsGroupAdmin(false);
        setIsCheckingAdmin(false);
        return;
      }

      setIsCheckingAdmin(true);
      try {
        const adminProfile = await getAdminProfileForUser(currentUser);
        if (!active) return;
        setIsGroupAdmin(adminProfile?.groupId === groupId);
      } catch {
        if (!active) return;
        setIsGroupAdmin(false);
      } finally {
        if (active) setIsCheckingAdmin(false);
      }
    }

    void checkAdmin();
    return () => {
      active = false;
    };
  }, [currentUser, groupId, isLoaded]);

  const currentEmail = currentUser?.email;
  const signedInMember = useMemo(() => {
    if (!currentEmail || isGroupAdmin) return null;
    const normalizedEmail = currentEmail.trim().toLowerCase();
    return members.find((member) => member.email.trim().toLowerCase() === normalizedEmail) ?? null;
  }, [currentEmail, isGroupAdmin, members]);

  useEffect(() => {
    if (!isLoaded || isCheckingAdmin || membersLoading || isGroupAdmin || !signedInMember) return;
    router.replace(`/group/${groupId}/member/${encodeURIComponent(signedInMember.id)}`);
  }, [groupId, isCheckingAdmin, isGroupAdmin, isLoaded, membersLoading, router, signedInMember]);

  const isRoutingMember = !!currentUser && !isGroupAdmin && !!signedInMember;
  const isLoading = !isLoaded || isCheckingAdmin || (!!currentUser && !isGroupAdmin && membersLoading) || isRoutingMember;

  useGlobalLoading(`group-home-${groupId}`, isLoading, t("groupDash.loading"));

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-2.5 py-4 sm:px-8 sm:py-6 md:py-8">
        <AdminLoadingState message={t("groupDash.loading")} />
      </div>
    );
  }

  return (
    <motion.main initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }} className="mx-auto w-full max-w-7xl px-2.5 py-4 sm:px-8 sm:py-6 md:flex md:items-start md:gap-6 md:py-8">
      <GroupNavbar groupId={groupId} />
      <div className="min-w-0 flex-1 pb-20 md:pb-0">
        <GroupDashboard groupId={groupId} />
      </div>
    </motion.main>
  );
}
