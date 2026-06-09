"use client";

import { GroupHome } from "@/components/group/group-home";
import { use } from "react";

export default function GroupDashboardPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = use(params);

  return <GroupHome groupId={groupId} />;
}
