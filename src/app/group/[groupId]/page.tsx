"use client";

import { GroupDashboard } from "@/components/group/group-dashboard";
import { GroupNavbar } from "@/components/group/group-navbar";
import { use } from "react";

export default function GroupDashboardPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = use(params);

  return (
    <main className="mx-auto w-full max-w-7xl px-2.5 py-4 sm:px-8 sm:py-6 md:flex md:items-start md:gap-6 md:py-8">
      <GroupNavbar groupId={groupId} />
      <div className="min-w-0 flex-1 pb-20 md:pb-0">
        <GroupDashboard groupId={groupId} />
      </div>
    </main>
  );
}
