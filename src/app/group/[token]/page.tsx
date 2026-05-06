import { PageCard } from "@/components/layout/page-card";
import { GroupDashboard } from "@/components/group/group-dashboard";

export default async function GroupDashboardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <PageCard
      eyebrow={`Group ${token}`}
      title="Shared group dashboard"
      description="This route will show today’s meal inputs for every member and act as the main group entry point after a token lookup."
    >
      <GroupDashboard token={token} />
    </PageCard>
  );
}
