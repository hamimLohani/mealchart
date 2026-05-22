import { GroupNoticesView } from "@/components/group/group-notices-view";
import { GroupNavbar } from "@/components/group/group-navbar";

export default async function GroupNoticesPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  return (
    <main className="mx-auto w-full max-w-7xl px-2.5 pb-20 sm:px-8 md:pb-16">
      <GroupNavbar groupId={groupId} />
      <GroupNoticesView groupId={groupId} />
    </main>
  );
}
