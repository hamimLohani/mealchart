"use client";

import { PageCard } from "@/components/layout/page-card";
import { EditMealsManager } from "@/components/admin/edit-meals-manager";
import { useT } from "@/i18n/use-t";

export default function EditMealsPage() {
  const { t } = useT();

  return (
    <PageCard
      eyebrow={t("adminEditMeals.eyebrow")}
      title={t("adminEditMeals.title")}
      description={t("adminEditMeals.description")}
    >
      <EditMealsManager />
    </PageCard>
  );
}
