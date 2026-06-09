"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useT } from "@/i18n/use-t";
import { useAuthStore } from "@/store/auth-store";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useT();
  const { admin, isLoaded } = useAuthStore();
  const [isSignOutInProgress, setIsSignOutInProgress] = useState(false);
  const isLoggedIn = isLoaded && !!admin;

  useGlobalLoading("admin-nav-sign-out", isSignOutInProgress, t("common.signingOut"));

  const navGroups = [
    {
      labelKey: "adminNav.people" as const,
      items: [
        { href: "/admin/members", labelKey: "adminNav.members" as const, hintKey: "adminNav.membersHint" as const },
        {
          href: "/admin/add-money",
          labelKey: "adminNav.addMoney" as const,
          hintKey: "adminNav.addMoneyHint" as const,
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
        { href: "/admin/costs", labelKey: "adminNav.costs" as const, hintKey: "adminNav.costsHint" as const },
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
          href: "/admin/notices",
          labelKey: "adminNav.notices" as const,
          hintKey: "adminNav.noticesHint" as const,
        },
      ],
    },
  ];

  async function handleLogout() {
    setIsSignOutInProgress(true);
    if (auth) await signOut(auth);
    router.push("/?noredirect=1");
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

      {isLoggedIn ? (
        <>
          <div className="admin-sidebar-groups">
            {navGroups.map((group) => (
              <div key={group.labelKey} className="admin-sidebar-group">
                <p className="admin-sidebar-group-label">{t(group.labelKey)}</p>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={pathname === item.href ? "admin-sidebar-link active" : "admin-sidebar-link"}
                  >
                    <motion.div whileHover={{ x: 6 }} whileTap={{ scale: 0.985 }} transition={{ type: "spring", stiffness: 300 }} className="admin-sidebar-link-text">
                      <span className="admin-sidebar-link-label">{t(item.labelKey)}</span>
                      <span className="admin-sidebar-link-hint">{t(item.hintKey)}</span>
                    </motion.div>
                    {pathname === item.href && <motion.div layoutId="sidebar-active" className="sidebar-indicator" aria-hidden />}
                  </Link>
                ))}
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
