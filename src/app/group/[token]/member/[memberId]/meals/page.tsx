"use client";

import { use } from "react";
import { MemberNavbar } from "@/components/group/member-navbar";
import { MemberMealsManager } from "@/components/group/member-meals-manager";

export default function MemberMealsPage({
  params,
}: {
  params: Promise<{ token: string; memberId: string }>;
}) {
  const { token, memberId } = use(params);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-8">
      <MemberNavbar token={token} memberId={memberId} />
      <MemberMealsManager token={token} memberId={memberId} />
    </main>
  );
}
