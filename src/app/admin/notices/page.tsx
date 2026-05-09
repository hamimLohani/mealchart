"use client";

import { PageCard } from "@/components/layout/page-card";
import { NoticesManager } from "@/components/admin/notices-manager";
import { useT } from "@/i18n/use-t";

export default function AdminNoticesPage() {
  const { t } = useT();

  return (
    <PageCard
      eyebrow={t("adminNoticesPage.eyebrow")}
      title={t("adminNoticesPage.title")}
      description={t("adminNoticesPage.description")}
    >
      <NoticesManager />
    </PageCard>
  );
}
