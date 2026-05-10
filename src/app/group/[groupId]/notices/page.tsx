import { GroupNoticesView } from "@/components/group/group-notices-view";
import { GroupNavbar } from "@/components/group/group-navbar";

export default async function GroupNoticesPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-8">
      <GroupNavbar groupId={groupId} />
      <GroupNoticesView groupId={groupId} />
    </main>
  );
}

