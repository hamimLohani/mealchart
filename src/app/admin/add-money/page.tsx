"use client";

import { PageCard } from "@/components/layout/page-card";
import { AddMoneyManager } from "@/components/admin/add-money-manager";
import { useT } from "@/i18n/use-t";

export default function AddMoneyPage() {
  const { t } = useT();

  return (
    <PageCard
      eyebrow={t("adminAddMoney.eyebrow")}
      title={t("adminAddMoney.title")}
      description={t("adminAddMoney.description")}
    >
      <AddMoneyManager />
    </PageCard>
  );
}
