"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const pageLabels: Record<string, string> = {
  "/admin":              "Admin Panel",
  "/admin/members":      "Members",
  "/admin/add-money":    "Add Money",
  "/admin/edit-meals":   "Edit Meals",
  "/admin/costs":        "Costs",
  "/admin/create-chart": "Create Chart",
  "/admin/notices":      "Notices",
};

export function AdminMobileBar() {
  const pathname = usePathname();
  const label = pageLabels[pathname] ?? "Admin";
  const isHome = pathname === "/admin";

  return (
    <div className="flex items-center gap-3 rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3">
      {!isHome && (
        <Link
          href="/admin"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] text-sm text-[color:var(--foreground)] transition hover:border-[color:var(--accent)]"
        >
          ←
        </Link>
      )}
      <p className="text-sm font-semibold text-[color:var(--foreground)]">{label}</p>
    </div>
  );
}
