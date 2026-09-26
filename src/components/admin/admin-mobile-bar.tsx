"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useMemo, type TouchEvent } from "react";
import { useT } from "@/i18n/use-t";
import { useAdminRequestCounts, type AdminRequestCountKey } from "@/lib/hooks/use-admin-request-counts";
import { useAuthStore } from "@/store/auth-store";
import { useCurrentAdminProfile } from "@/lib/hooks/use-current-admin-profile";
import { useMembers } from "@/lib/hooks/use-data";

export function AdminMobileBar() {
  const pathname = usePathname();
  const router = useRouter();
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const { t } = useT();
  const requestCounts = useAdminRequestCounts();
  const { admin, isLoaded } = useAuthStore();
  const { adminProfile } = useCurrentAdminProfile();
  const { data: members = [] } = useMembers(adminProfile?.groupId);

  const currentMember = useMemo(() => {
    if (!isLoaded || !admin) return null;
    const adminEmail = admin?.email;
    if (!adminEmail || !members.length) return null;
    const emailNorm = adminEmail.trim().toLowerCase();
    return members.find((m) => m.email.trim().toLowerCase() === emailNorm) ?? null;
  }, [admin, members]);

  const navItems = [
    { href: "/admin", icon: <HomeIcon />, labelKey: "adminMobile.panel" as const },
    { href: "/admin/add-money", icon: <MoneyIcon />, labelKey: "adminNav.addMoney" as const, requestCountKey: "money" as const },
    { href: "/admin/members", icon: <MembersIcon />, labelKey: "adminNav.members" as const, requestCountKey: "members" as const },
    { href: "/admin/costs", icon: <CostsIcon />, labelKey: "adminNav.costs" as const, requestCountKey: "costs" as const },
    { href: "/admin/edit-meals", icon: <MealsIcon />, labelKey: "adminNav.editMeals" as const },
    { href: "/admin/create-chart", icon: <ChartIcon />, labelKey: "adminNav.createChart" as const },
    { href: "/admin/settings", icon: <SettingsIcon />, labelKey: "adminNav.settings" as const },
  ];

  const swipeThreshold = 40;

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

    const currentIndex = navItems.findIndex((item) => item.href === pathname);
    if (currentIndex === -1) return;

    const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= navItems.length) return;
    router.push(navItems[nextIndex].href);
  };

  if (!isLoaded || !admin) {
    return null;
  }

  return (
    <>
      {currentMember && adminProfile && (
        <div className="md:hidden sticky top-14 z-20 mb-2 flex items-center">
          <Link
            href={`/group/${adminProfile.groupId}/member/${encodeURIComponent(currentMember.id)}`}
            className="flex-1 flex items-center justify-between gap-2 rounded-full border border-[color:var(--accent)] mobile-sticky-admin-banner backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-[color:var(--accent)] transition hover:opacity-90 shadow-xs"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-sm">👤</span>
              <span>{t("adminNav.myMemberView")}</span>
            </div>
            <span>→</span>
          </Link>
        </div>
      )}

      <div
        className="fixed bottom-0 left-0 right-0 z-[60] flex items-center justify-around border-t border-[color:var(--border)] bg-[color:var(--panel)] px-1 py-1.5 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.05)] md:hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const requestCountKey: AdminRequestCountKey | undefined =
          "requestCountKey" in item ? item.requestCountKey : undefined;
        const count = requestCountKey
          ? requestCounts[requestCountKey]
          : 0;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-1 py-1 transition-colors ${
              isActive ? "text-[color:var(--accent)]" : "text-[color:var(--muted)]"
            }`}
          >
            <div className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              isActive ? "bg-[color:var(--accent-dim)]" : "bg-transparent"
            }`}>
              {item.icon}
              {count > 0 && <RequestCountBadge count={count} />}
            </div>
            <span className="text-[10px] font-bold tracking-tight">{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </div>
    </>
  );
}

function RequestCountBadge({ count }: { count: number }) {
  return (
    <span className="admin-mobile-request-badge" aria-label={`${count} pending requests`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

function HomeIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
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

function MembersIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  );
}

function CostsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121 0 2.047-.9 2.206-2.012l.67-4.706c.151-1.059-.645-1.982-1.716-1.982H5.412m0 0L4.705 4.125M12 14v5m-3-5v5m6-5v5M7.5 14.25a3 3 0 0 1 3-3h3a3 3 0 0 1 3 3m-9 0h9" />
    </svg>
  );
}

function MealsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
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

function SettingsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
