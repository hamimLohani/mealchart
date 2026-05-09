"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

type MemberNavKey = "meals" | "chart" | "money";

const navItems: Array<{ key: MemberNavKey; label: string }> = [
  { key: "meals", label: "Meals" },
  { key: "chart", label: "Chart" },
  { key: "money", label: "Money" },
];

export function MemberNavbar({
  token,
  memberId,
}: {
  token: string;
  memberId: string;
}) {
  const pathname = usePathname();

  const activeKey = useMemo<MemberNavKey>(() => {
    const parts = pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] as MemberNavKey | undefined;
    if (last === "meals" || last === "chart" || last === "money") return last;
    return "meals";
  }, [pathname]);

  return (
    <div className="sticky top-[3.75rem] z-20 -mx-4 px-4 pt-2 sm:top-[4rem] sm:-mx-0 sm:px-0">
      <div className="group-nav-panel">
        <nav className="flex items-center gap-0.5 overflow-x-auto">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={`/group/${token}/member/${memberId}/${item.key}`}
              className={item.key === activeKey ? "group-nav-link active" : "group-nav-link"}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
