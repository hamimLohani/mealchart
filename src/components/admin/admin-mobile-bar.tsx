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
  const isHome = pathname === "/admin";

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-2.5 shadow-[var(--shadow-sm)]">
      {!isHome && (
        <Link
          href="/admin"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] text-sm text-[color:var(--soft-foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
        >
          ←
        </Link>
      )}
      <p className="text-sm font-semibold text-[color:var(--foreground)]">{label}</p>
    </div>
  );
}
