"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const adminRoutes = [
  { href: "/admin/login", label: "Login", hint: "Admin access" },
  { href: "/admin/members", label: "Members", hint: "People and join dates" },
  { href: "/admin/costs", label: "Costs", hint: "Bazar and expenses" },
  { href: "/admin/add-money", label: "Add Money", hint: "Member deposits" },
  { href: "/admin/edit-meals", label: "Edit Meals", hint: "Daily meal table" },
  { href: "/admin/create-chart", label: "Create Chart", hint: "New 31-day sheet" },
  { href: "/admin/notices", label: "Notices", hint: "Updates and alerts" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav-shell">
      <div className="admin-nav-header">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
            Admin Panel
          </p>
          <p className="mt-2 text-xl font-semibold text-[color:var(--foreground)]">
            Manage the group from one place
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--soft-foreground)]">
            Switch between members, deposits, charts, meal editing, and notices without leaving the admin workspace.
          </p>
        </div>
        <div className="admin-nav-badge">
          <span>{adminRoutes.length}</span>
          <p>tools</p>
        </div>
      </div>

      <div className="admin-nav-links">
        {adminRoutes.map((route, index) => {
          const isActive = pathname === route.href;

          return (
            <Link
              key={route.href}
              className={isActive ? "admin-nav-link active" : "admin-nav-link"}
              href={route.href}
            >
              <span className="admin-nav-link-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="admin-nav-link-copy">
                <span className="admin-nav-link-title">{route.label}</span>
                <span className="admin-nav-link-hint">{route.hint}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
