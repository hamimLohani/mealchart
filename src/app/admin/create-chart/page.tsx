import { CreateChartManager } from "@/components/admin/create-chart-manager";
import { PageCard } from "@/components/layout/page-card";

export default function CreateChartPage() {
  return (
    <PageCard
      eyebrow="Create New Chart"
      title="Monthly chart creation"
      description="Create a new 31-day chart sheet for a selected month. The new chart becomes the active accounting base for Chart View and Money Management."
    >
      <CreateChartManager />
    </PageCard>
  );
}
