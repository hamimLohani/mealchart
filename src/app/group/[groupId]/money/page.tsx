"use client";

import { use } from "react";
import { GroupNavbar } from "@/components/group/group-navbar";
import { GroupMoneyView } from "@/components/group/group-money-view";

export default function GroupMoneyPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = use(params);

  return (
    <main className="mx-auto w-full max-w-7xl px-2.5 pb-16 sm:px-8">
      <GroupNavbar groupId={groupId} />
      <GroupMoneyView groupId={groupId} />
    </main>
  );
}
