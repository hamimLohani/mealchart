"use client";

import { useState } from "react";
import { GroupNavbar } from "@/components/group/group-navbar";
import { GroupMembersList } from "@/components/group/group-members-list";
import { use } from "react";

export default function GroupMembersPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [searchValue, setSearchValue] = useState("");

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-8">
      <GroupNavbar 
        token={token} 
        searchValue={searchValue} 
        onSearchValueChange={setSearchValue} 
      />
      <GroupMembersList token={token} memberSearch={searchValue} />
    </main>
  );
}