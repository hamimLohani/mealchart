"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useT } from "@/i18n/use-t";
import { useAuthStore } from "@/store/auth-store";

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useT();
  const { admin, isLoaded } = useAuthStore();
  const isLoggedIn = isLoaded && !!admin;

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
    if (auth) await signOut(auth);
    router.push("/admin/login");
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
        {pathname !== "/admin" && <span>←</span>}
        <span>{t("adminNav.panel")}</span>
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
                    <span className="admin-sidebar-link-label">{t(item.labelKey)}</span>
                    <span className="admin-sidebar-link-hint">{t(item.hintKey)}</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
          <button className="admin-sidebar-logout" onClick={handleLogout} type="button">
            <span>↩</span>
            <span>{t("adminNav.signOut")}</span>
          </button>
        </>
      ) : (
        <Link href="/admin/login" className="admin-sidebar-link" style={{ margin: "0.5rem 0" }}>
          <span className="admin-sidebar-link-label">{t("adminNav.login")}</span>
          <span className="admin-sidebar-link-hint">{t("adminNav.loginHint")}</span>
        </Link>
      )}
    </nav>
  );
}
