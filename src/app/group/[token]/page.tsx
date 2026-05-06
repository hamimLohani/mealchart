import { GroupDashboard } from "@/components/group/group-dashboard";
import { GroupNavbar } from "@/components/group/group-navbar";


export default async function GroupDashboardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-8">
      <GroupNavbar token={token} searchValue={""} />
      <GroupDashboard token={token} />
    </main>
  );
}


