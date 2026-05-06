import { PageCard } from "@/components/layout/page-card";
import { findGroupByToken } from "@/lib/firebase/repositories";

export default async function GroupMoneyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const group = await findGroupByToken(token);

  return (
    <PageCard
      eyebrow={`Money ${token}`}
      title="Monthly money management"
      description={`This page will combine deposit history, cost history, meal rate, eaten cost per member, and remaining balances for the active chart.${group?.currentChartMonth ? ` Active chart: ${group.currentChartMonth}.` : " No chart has been created yet."}`}
    />
  );
}
