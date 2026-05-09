"use client";

import { use } from "react";
import { GroupNavbar } from "@/components/group/group-navbar";
import { GroupMoneyView } from "@/components/group/group-money-view";

export default function GroupMoneyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-8">
      <GroupNavbar token={token} />
      <GroupMoneyView token={token} />
    </main>
  );
}
