import { PageCard } from "@/components/layout/page-card";
import { findGroupByToken } from "@/lib/firebase/repositories";

export default async function GroupChartPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const group = await findGroupByToken(token);

  return (
    <PageCard
      eyebrow={`Chart ${token}`}
      title="Monthly meal chart"
      description={`This page will render the active chart month by date, plus total meals, total cost, total paid money, and the live meal rate.${group?.currentChartMonth ? ` Active chart: ${group.currentChartMonth}.` : " No chart has been created yet."}`}
    />
  );
}
