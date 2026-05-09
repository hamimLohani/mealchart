"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

type NavKey = "home" | "chart" | "notices";

const navItems: Array<{ key: NavKey; label: string }> = [
  { key: "home", label: "Home" },
  { key: "chart", label: "Chart" },
  { key: "notices", label: "Notices" },
];

export function GroupNavbar({
  token,
}: {
  token: string;
}) {
  const pathname = usePathname();

  const activeKey = useMemo<NavKey>(() => {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 2 && parts[0] === "group") return "home";
    const last = parts[parts.length - 1] as NavKey | undefined;
    if (last === "chart" || last === "notices") return last;
    return "home";
  }, [pathname]);

  return (
    <div className="group-nav-shell">
      <div className="group-nav-panel">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex items-center gap-0.5 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.key === "home" ? `/group/${token}` : `/group/${token}/${item.key}`}
                className={item.key === activeKey ? "group-nav-link active" : "group-nav-link"}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
