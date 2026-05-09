"use client";

import { PageCard } from "@/components/layout/page-card";
import { EnterGroupForm } from "@/components/forms/enter-group-form";
import { useT } from "@/i18n/use-t";

export default function EnterGroupPage() {
  const { t } = useT();

  return (
    <PageCard
      eyebrow={t("enterPage.eyebrow")}
      title={t("enterPage.title")}
      description={t("enterPage.description")}
    >
      <EnterGroupForm />
    </PageCard>
  );
}
