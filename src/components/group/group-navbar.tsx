"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useRef, type TouchEvent } from "react";
import { motion } from "framer-motion";
import { useT } from "@/i18n/use-t";
import { useGroup, useMembers } from "@/lib/hooks/use-data";
import { useCurrentAdminProfile } from "@/lib/hooks/use-current-admin-profile";
import { useAuthStore } from "@/store/auth-store";

type NavKey = "home" | "chart" | "money" | "costs" | "members" | "settings";

export function GroupNavbar({
  groupId,
}: {
  groupId: string;
}) {
  const pathname = usePathname();
  const { t } = useT();
  const { admin: currentUser } = useAuthStore();
  // Read admin profile from the shared SWR cache — no extra Firestore reads.
  const { adminProfile } = useCurrentAdminProfile();
  const isGroupAdmin = adminProfile?.groupId === groupId;
  const { data: group } = useGroup(groupId);
  const { data: members = [] } = useMembers(groupId);
  const groupName = group?.name ?? groupId;
  const currentEmail = currentUser?.email?.trim().toLowerCase();
  const signedInMember = currentEmail ? members.find((member) => member.email.trim().toLowerCase() === currentEmail) : null;
  const identityName = !isGroupAdmin && signedInMember?.fullName ? signedInMember.fullName : currentUser?.displayName ?? groupName;
  const memberHomeHref =
    signedInMember && !isGroupAdmin
      ? `/group/${groupId}/member/${encodeURIComponent(signedInMember.id)}`
      : `/group/${groupId}`;

  const navItems = useMemo(
    () =>
      [
        { key: "chart" as const, icon: <ChartIcon />, label: t("groupNav.chart"), hint: t("groupNav.chartHint") },
        { key: "money" as const, icon: <MoneyIcon />, label: t("groupNav.money"), hint: t("groupNav.moneyHint") },
        { key: "costs" as const, icon: <CostsIcon />, label: t("groupNav.costs"), hint: t("groupNav.costsHint") },
        { key: "members" as const, icon: <MembersIcon />, label: t("groupNav.members"), hint: t("groupNav.membersHint") },
        { key: "settings" as const, icon: <SettingsIcon />, label: t("groupNav.settings"), hint: t("groupNav.settingsHint") },
      ] as const,
    [t],
  );

  const activeKey = useMemo<NavKey>(() => {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 2 && parts[0] === "group") return "home";
    const last = parts[parts.length - 1] as NavKey | undefined;
    if (last === "chart" || last === "money" || last === "costs" || last === "members" || last === "settings") return last;
    return "home";
  }, [pathname]);

  const router = useRouter();
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const swipeThreshold = 40;

  const bottomNavItems = useMemo(
    () => [
      { key: "home" as const, href: memberHomeHref, icon: <HomeIcon />, label: t("groupNav.home") },
      ...navItems.map((item) => ({
        key: item.key,
        href: `/group/${groupId}/${item.key}`,
        icon: item.icon,
        label: item.label,
      })),
    ],
    [groupId, memberHomeHref, navItems, t],
  );

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    if (Math.abs(deltaX) < swipeThreshold || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    const currentIndex = bottomNavItems.findIndex((item) => item.href === pathname);
    if (currentIndex === -1) return;

    const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= bottomNavItems.length) return;
    router.push(bottomNavItems[nextIndex].href);
  };

  return (
    <>
      {isGroupAdmin && (
        <div className="md:hidden sticky top-14 z-20 mb-2 flex items-center justify-between gap-2 rounded-full border border-[color:var(--accent)] mobile-sticky-admin-banner backdrop-blur-md px-3.5 py-1.5 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[color:var(--accent)]">
            <span>🛡️</span>
            <span>{adminProfile?.role === "owner" ? t("memberMgr.owner") : t("memberMgr.temporaryAdmin")}</span>
          </div>
          <Link
            href="/admin"
            className="button-primary !py-1 !px-2.5 text-xs flex items-center gap-1 rounded-full"
          >
            <span>{t("groupNav.adminPanel")}</span>
            <span>→</span>
          </Link>
        </div>
      )}
      <aside className="hidden shrink-0 md:block md:w-60 lg:w-64">
        <div className="sticky top-20">
          <nav className="admin-sidebar">
            <div className="admin-sidebar-identity">
              <div className="admin-sidebar-avatar">{identityName[0]?.toUpperCase() ?? "M"}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="admin-sidebar-role shrink-0">{t("groupNav.panel")}</span>
                  {isGroupAdmin && (
                    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-[color:var(--accent)] text-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-xs">
                      {adminProfile?.role === "owner" ? `👑 ${t("memberMgr.owner")}` : `🛡️ ${t("memberMgr.temporaryAdmin")}`}
                    </span>
                  )}
                </div>
                <p className="admin-sidebar-email truncate mt-0.5" title={identityName}>{identityName}</p>
              </div>
            </div>

            {isGroupAdmin && (
              <div className="mt-3">
                <Link
                  href="/admin"
                  className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[color:var(--accent)] bg-[color:var(--accent-dim)] px-3 py-2 text-xs font-bold text-[color:var(--accent)] transition hover:opacity-90"
                >
                  <div className="flex items-center gap-2">
                    <span>🛡️</span>
                    <span>{t("groupNav.adminPanel")}</span>
                  </div>
                  <span>→</span>
                </Link>
              </div>
            )}

            <Link
              href={memberHomeHref}
              className={activeKey === "home" ? "admin-sidebar-home-link active" : "admin-sidebar-home-link"}
            >
              <motion.div whileHover={{ x: 6 }} whileTap={{ scale: 0.985 }} transition={{ type: "spring", stiffness: 300 }}>
                <div className="admin-sidebar-link-text">
                  <span className="admin-sidebar-link-label">{t("groupNav.home")}</span>
                  <span className="admin-sidebar-link-hint">{t("groupNav.homeHint")}</span>
                </div>
              </motion.div>
              {activeKey === "home" && (
                <motion.div layoutId="sidebar-active" className="sidebar-indicator" aria-hidden />
              )}
            </Link>

            <div className="admin-sidebar-groups">
              <div className="admin-sidebar-group">
                <p className="admin-sidebar-group-label">{t("groupNav.overview")}</p>
                {navItems.map((item) => (
                  <Link
                    key={item.key}
                    href={`/group/${groupId}/${item.key}`}
                    className={item.key === activeKey ? "admin-sidebar-link active" : "admin-sidebar-link"}
                  >
                    <motion.div whileHover={{ x: 6 }} whileTap={{ scale: 0.985 }} transition={{ type: "spring", stiffness: 300 }}>
                      <div className="admin-sidebar-link-text">
                        <span className="admin-sidebar-link-label">{item.label}</span>
                        <span className="admin-sidebar-link-hint">{item.hint}</span>
                      </div>
                    </motion.div>
                    {item.key === activeKey && (
                      <motion.div layoutId="sidebar-active" className="sidebar-indicator" aria-hidden />
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </nav>
        </div>
      </aside>

      <div
        className="fixed bottom-0 left-0 right-0 z-[60] flex items-center justify-around border-t border-[color:var(--border)] bg-[color:var(--panel)] px-1 py-1.5 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.05)] md:hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {bottomNavItems.map((item) => {
          const isActive = item.key === activeKey;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 py-1 transition-colors ${
                isActive ? "text-[color:var(--accent)]" : "text-[color:var(--muted)]"
              }`}
            >
              <motion.div whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.95 }} transition={{ duration: 0.12 }} className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                isActive ? "bg-[color:var(--accent-dim)]" : "bg-transparent"
              }`}>
                {item.icon}
              </motion.div>
              <motion.div animate={{ scale: isActive ? 1.03 : 1 }} transition={{ duration: 0.12 }} className="flex flex-col items-center">
                <span className="text-[10px] font-bold tracking-tight">{item.label}</span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

function HomeIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0v16.5m0 0h16.5m-16.5 0v1.5m18-13.5-3.97 3.97a.75.75 0 0 1-1.06 0l-1.97-1.97a.75.75 0 0 0-1.06 0l-3.97 3.97a.75.75 0 1 1-1.06-1.06l3.97-3.97a2.25 2.25 0 0 1 3.18 0l1.97 1.97a2.25 2.25 0 0 0 3.18 0l3.97-3.97a.75.75 0 1 1 1.06 1.06Z" />
    </svg>
  );
}

function MoneyIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function CostsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7.5h6m-6 3h6m-7.5 9h9A2.25 2.25 0 0 0 18.75 17.25V5.625c0-.621-.504-1.125-1.125-1.125H6.375c-.621 0-1.125.504-1.125 1.125V17.25A2.25 2.25 0 0 0 7.5 19.5Zm0 0v-2.25m9 2.25v-2.25" />
    </svg>
  );
}

function MembersIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
