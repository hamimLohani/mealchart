"use client";

import { PageCard } from "@/components/layout/page-card";
import { CostsManager } from "@/components/admin/costs-manager";
import { useT } from "@/i18n/use-t";

export default function CostsPage() {
  const { t } = useT();

  return (
    <PageCard
      eyebrow={t("adminCosts.eyebrow")}
      title={t("adminCosts.title")}
      description={t("adminCosts.description")}
    >
      <CostsManager />
    </PageCard>
  );
}
