"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import { useT } from "@/i18n/use-t";
import { useToast } from "@/lib/hooks/use-toast";
import { useAuthStore } from "@/store/auth-store";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";
import { useAdminRequestCounts, type AdminRequestCountKey } from "@/lib/hooks/use-admin-request-counts";
import { handleAdminLogout } from "@/lib/auth/admin-logout";
import { useCurrentAdminProfile } from "@/lib/hooks/use-current-admin-profile";
import { useMembers } from "@/lib/hooks/use-data";

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useT();
  const { toast } = useToast();
  const { admin, isLoaded } = useAuthStore();
  const { adminProfile } = useCurrentAdminProfile();
  const { data: members = [] } = useMembers(adminProfile?.groupId);
  const requestCounts = useAdminRequestCounts();
  const [isSignOutInProgress, setIsSignOutInProgress] = useState(false);
  const isLoggedIn = isLoaded && !!admin;

  const currentMember = useMemo(() => {
    const adminEmail = admin?.email;
    if (!adminEmail || !members.length) return null;
    const emailNorm = adminEmail.trim().toLowerCase();
    return members.find((m) => m.email.trim().toLowerCase() === emailNorm) ?? null;
  }, [admin, members]);

  useGlobalLoading("admin-nav-sign-out", isSignOutInProgress, t("common.signingOut"));

  const navGroups = [
    {
      labelKey: "adminNav.people" as const,
      items: [
        { href: "/admin/members", labelKey: "adminNav.members" as const, hintKey: "adminNav.membersHint" as const, requestCountKey: "members" as const },
        {
          href: "/admin/add-money",
          labelKey: "adminNav.addMoney" as const,
          hintKey: "adminNav.addMoneyHint" as const,
          requestCountKey: "money" as const,
        },
      ],
    },
    {
      labelKey: "adminNav.mealsCosts" as const,
      items: [
        {
          href: "/admin/edit-meals",
          labelKey: "adminNav.editMeals" as const,
          hintKey: "adminNav.editMealsHint" as const,
        },
        { href: "/admin/costs", labelKey: "adminNav.costs" as const, hintKey: "adminNav.costsHint" as const, requestCountKey: "costs" as const },
      ],
    },
    {
      labelKey: "adminNav.reports" as const,
      items: [
        {
          href: "/admin/create-chart",
          labelKey: "adminNav.createChart" as const,
          hintKey: "adminNav.createChartHint" as const,
        },
        {
          href: "/admin/settings",
          labelKey: "adminNav.settings" as const,
          hintKey: "adminNav.settingsHint" as const,
        },
      ],
    },
  ];

  async function handleLogout() {
    await handleAdminLogout(auth, router, setIsSignOutInProgress, (error) => {
      toast(error.message || "Failed to sign out. Please try again.", "error");
    });
  }

  return (
    <nav className="admin-sidebar">
      <div className="admin-sidebar-identity">
        <div className="admin-sidebar-avatar">{isLoggedIn ? (admin.email?.[0]?.toUpperCase() ?? "A") : "A"}</div>
        <div className="min-w-0">
          <p className="admin-sidebar-role">{t("adminNav.panel")}</p>
          <p className="admin-sidebar-email">{isLoggedIn ? admin.email : t("adminNav.notSignedIn")}</p>
        </div>
      </div>

      <Link
        href="/admin"
        className="mt-3 flex items-center gap-2 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm font-medium text-[color:var(--soft-foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
      >
        <motion.div whileHover={{ x: 4 }} whileTap={{ scale: 0.99 }} transition={{ type: "spring", stiffness: 300 }} className="flex items-center gap-2 w-full">
          {pathname !== "/admin" && <span>←</span>}
          <span>{t("adminNav.panel")}</span>
        </motion.div>
      </Link>

      {currentMember && adminProfile && (
        <Link
          href={`/group/${adminProfile.groupId}/member/${encodeURIComponent(currentMember.id)}`}
          className="mt-2 flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[color:var(--accent)] bg-[color:var(--accent-dim)] px-3 py-2 text-xs font-bold text-[color:var(--accent)] transition hover:opacity-90"
        >
          <div className="flex items-center gap-2">
            <span>👤</span>
            <span>{t("adminNav.myMemberView")}</span>
          </div>
          <span>→</span>
        </Link>
      )}

      {isLoggedIn ? (
        <>
          <div className="admin-sidebar-groups">
            {navGroups.map((group) => (
              <div key={group.labelKey} className="admin-sidebar-group">
                <p className="admin-sidebar-group-label">{t(group.labelKey)}</p>
                {group.items.map((item) => {
                  const requestCountKey: AdminRequestCountKey | undefined =
                    "requestCountKey" in item ? item.requestCountKey : undefined;
                  const count = requestCountKey
                    ? requestCounts[requestCountKey]
                    : 0;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={pathname === item.href ? "admin-sidebar-link active" : "admin-sidebar-link"}
                    >
                      <motion.div whileHover={{ x: 6 }} whileTap={{ scale: 0.985 }} transition={{ type: "spring", stiffness: 300 }} className="admin-sidebar-link-text">
                        <span className="admin-sidebar-link-label">{t(item.labelKey)}</span>
                        <span className="admin-sidebar-link-hint">{t(item.hintKey)}</span>
                      </motion.div>
                      {count > 0 && <RequestCountBadge count={count} />}
                      {pathname === item.href && <motion.div layoutId="sidebar-active" className="sidebar-indicator" aria-hidden />}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
          <motion.button
            className="admin-sidebar-logout"
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.99 }}
            transition={{ type: "spring", stiffness: 300 }}
            onClick={handleLogout}
            type="button"
          >
            <span>↩</span>
            <span>{t("adminNav.signOut")}</span>
          </motion.button>
        </>
      ) : (
        <Link href="/admin/login" className="admin-sidebar-link admin-sidebar-standalone-link">
          <motion.div whileHover={{ x: 4 }} whileTap={{ scale: 0.99 }} transition={{ type: "spring", stiffness: 300 }} className="admin-sidebar-link-text">
            <span className="admin-sidebar-link-label">{t("adminNav.login")}</span>
            <span className="admin-sidebar-link-hint">{t("adminNav.loginHint")}</span>
          </motion.div>
        </Link>
      )}
    </nav>
  );
}

function RequestCountBadge({ count }: { count: number }) {
  return (
    <span className="admin-request-badge" aria-label={`${count} pending requests`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
