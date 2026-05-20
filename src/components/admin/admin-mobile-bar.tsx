"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/use-t";
import type { MessageKey } from "@/i18n/messages";

const pageLabelKeys: Record<string, MessageKey> = {
  "/admin": "adminMobile.panel",
  "/admin/members": "adminNav.members",
  "/admin/add-money": "adminNav.addMoney",
  "/admin/edit-meals": "adminNav.editMeals",
  "/admin/costs": "adminNav.costs",
  "/admin/create-chart": "adminNav.createChart",
  "/admin/notices": "adminNav.notices",
};

export function AdminMobileBar() {
  const pathname = usePathname();
  const { t } = useT();
  const labelKey = pageLabelKeys[pathname] ?? "adminMobile.admin";
  const label = t(labelKey);

  const navItems = [
    { href: "/admin", icon: <HomeIcon />, labelKey: "adminMobile.panel" as const },
    { href: "/admin/add-money", icon: <MoneyIcon />, labelKey: "adminNav.addMoney" as const },
    { href: "/admin/members", icon: <MembersIcon />, labelKey: "adminNav.members" as const },
    { href: "/admin/costs", icon: <CostsIcon />, labelKey: "adminNav.costs" as const },
    { href: "/admin/edit-meals", icon: <MealsIcon />, labelKey: "adminNav.editMeals" as const },
    { href: "/admin/create-chart", icon: <ChartIcon />, labelKey: "adminNav.createChart" as const },
    { href: "/admin/notices", icon: <NoticesIcon />, labelKey: "adminNav.notices" as const },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] flex items-center justify-around border-t border-[color:var(--border)] bg-[color:var(--panel)] px-1 py-1.5 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.05)] md:hidden">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-1 py-1 transition-colors ${
              isActive ? "text-[color:var(--accent)]" : "text-[color:var(--muted)]"
            }`}
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              isActive ? "bg-[color:var(--accent-dim)]" : "bg-transparent"
            }`}>
              {item.icon}
            </div>
            <span className="text-[10px] font-bold tracking-tight">{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </div>
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

function NoticesIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0M3.124 7.5A8.969 8.969 0 0 1 5.292 3m13.416 0a8.969 8.969 0 0 1 2.168 4.5" />
    </svg>
  );
}
