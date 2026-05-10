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
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-8">
      <GroupNavbar groupId={groupId} />
      <GroupDashboard groupId={groupId} />
    </main>
  );
}
