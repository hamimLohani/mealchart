"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import type { Member } from "@/types/domain";


type NavKey = "chart" | "money" | "history" | "notices";

const navItems: Array<{ key: NavKey; label: string }> = [
  { key: "chart", label: "Chart" },
  { key: "money", label: "Money" },
  { key: "history", label: "History" },
  { key: "notices", label: "Notices" },
];

export function GroupNavbar({
  token,
  searchValue,
  onSearchValueChange,
}: {
  token: string;
  searchValue: string;
  onSearchValueChange?: (v: string) => void;
  members?: Member[];
}) {

  const pathname = usePathname();

  const activeKey = useMemo<NavKey>(() => {
    const parts = pathname.split("/").filter(Boolean);
    // expected: group / [token] / [section]
    const last = parts[parts.length - 1] as NavKey | undefined;
    if (last === "chart" || last === "money" || last === "history" || last === "notices") return last;
    return "chart";
  }, [pathname]);

  return (
    <div className="sticky top-[4.25rem] z-20 -mx-4 px-4 pt-2 sm:top-[4.5rem] sm:-mx-0 sm:px-0">
      <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--panel)] px-3 py-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex items-center gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const isActive = item.key === activeKey;
              return (
                <Link
                  key={item.key}
                  href={`/group/${token}/${item.key}`}
                  className={
                    `whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ` +
                    (isActive
                      ? "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[color:var(--accent)]"
                      : "text-[color:var(--foreground)] hover:border hover:border-[color:var(--accent)]")
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <input
              className="w-full rounded-full border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-1.5 text-sm outline-none placeholder:text-[color:var(--soft-foreground)] focus:border-[color:var(--accent)] sm:w-[220px]"
              placeholder={"Search members…"}


              value={searchValue}
              onChange={onSearchValueChange ? (e) => onSearchValueChange(e.target.value) : undefined}
              readOnly={!onSearchValueChange}
              type="search"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

