"use client";

import { CreateChartManager } from "@/components/admin/create-chart-manager";
import { PageCard } from "@/components/layout/page-card";
import { useT } from "@/i18n/use-t";

export default function CreateChartPage() {
  const { t } = useT();

  return (
    <PageCard
      eyebrow={t("adminCreateChart.eyebrow")}
      title={t("adminCreateChart.title")}
      description={t("adminCreateChart.description")}
    >
      <CreateChartManager />
    </PageCard>
  );
}
