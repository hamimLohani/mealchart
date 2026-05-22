"use client";

import { use } from "react";
import { GroupNavbar } from "@/components/group/group-navbar";
import { GroupChartView } from "@/components/group/group-chart-view";

export default function GroupChartPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = use(params);
  return (
    <main className="mx-auto w-full max-w-7xl px-2.5 pb-20 sm:px-8 md:pb-16">
      <GroupNavbar groupId={groupId} />
      <GroupChartView groupId={groupId} />
    </main>
  );
}
