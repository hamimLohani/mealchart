import { GroupSettingsView } from "@/components/group/group-settings-view";
import { GroupNavbar } from "@/components/group/group-navbar";

export default async function GroupSettingsPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  return (
    <main className="mx-auto w-full max-w-7xl px-2.5 py-4 sm:px-8 sm:py-6 md:flex md:items-start md:gap-6 md:py-8">
      <GroupNavbar groupId={groupId} />
      <div className="min-w-0 flex-1 pb-20 md:pb-0">
        <GroupSettingsView groupId={groupId} />
      </div>
    </main>
  );
}
