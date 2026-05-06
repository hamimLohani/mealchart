"use client";

import { GroupNavbar } from "@/components/group/group-navbar";
import { MemberMealsManager } from "@/components/group/member-meals-manager";
import { use } from "react";

export default function MemberPage({
  params,
}: {
  params: Promise<{ token: string; memberId: string }>;
}) {
  const { token, memberId } = use(params);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-8">
      <GroupNavbar token={token} searchValue={""} />
      <MemberMealsManager token={token} memberId={memberId} />
    </main>
  );
}