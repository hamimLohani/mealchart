"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuthStore } from "@/store/auth-store";

const navGroups = [
  {
    label: "People",
    items: [
      { href: "/admin/members", label: "Members", hint: "Add, edit, remove" },
      { href: "/admin/add-money", label: "Add Money", hint: "Member deposits" },
    ],
  },
  {
    label: "Meals & Costs",
    items: [
      { href: "/admin/edit-meals", label: "Edit Meals", hint: "Daily meal table" },
      { href: "/admin/costs", label: "Costs", hint: "Bazar and expenses" },
    ],
  },
  {
    label: "Reports",
    items: [
      { href: "/admin/create-chart", label: "Create Chart", hint: "New monthly sheet" },
      { href: "/admin/notices", label: "Notices", hint: "Updates and alerts" },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, isLoaded } = useAuthStore();
  const isLoggedIn = isLoaded && !!admin;

  async function handleLogout() {
    if (auth) await signOut(auth);
    router.push("/admin/login");
  }

  return (
    <nav className="admin-sidebar">
      <div className="admin-sidebar-identity">
        <div className="admin-sidebar-avatar">
          {isLoggedIn ? (admin.email?.[0]?.toUpperCase() ?? "A") : "A"}
        </div>
        <div className="min-w-0">
          <p className="admin-sidebar-role">Admin Panel</p>
          <p className="admin-sidebar-email">
            {isLoggedIn ? admin.email : "Not signed in"}
          </p>
        </div>
      </div>

      {isLoggedIn ? (
        <>
          <div className="admin-sidebar-groups">
            {navGroups.map((group) => (
              <div key={group.label} className="admin-sidebar-group">
                <p className="admin-sidebar-group-label">{group.label}</p>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={pathname === item.href ? "admin-sidebar-link active" : "admin-sidebar-link"}
                  >
                    <span className="admin-sidebar-link-label">{item.label}</span>
                    <span className="admin-sidebar-link-hint">{item.hint}</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
          <button className="admin-sidebar-logout" onClick={handleLogout} type="button">
            <span>↩</span>
            <span>Sign out</span>
          </button>
        </>
      ) : (
        <Link href="/admin/login" className="admin-sidebar-link" style={{ margin: "0.5rem 0" }}>
          <span className="admin-sidebar-link-label">Login</span>
          <span className="admin-sidebar-link-hint">Admin access</span>
        </Link>
      )}
    </nav>
  );
}
