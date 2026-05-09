import { GroupNoticesView } from "@/components/group/group-notices-view";
import { GroupNavbar } from "@/components/group/group-navbar";

export default async function GroupNoticesPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="group-workspace">
      <GroupNavbar token={token} />
      <GroupNoticesView token={token} />
    </main>
  );
}

