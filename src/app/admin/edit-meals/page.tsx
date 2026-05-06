import { PageCard } from "@/components/layout/page-card";
import { EditMealsManager } from "@/components/admin/edit-meals-manager";

export default function EditMealsPage() {
  return (
    <PageCard
      eyebrow="Edit Meals"
      title="Current month meal table"
      description="Edit any member's meal count for any day. Changes save automatically and update all calculations."
    >
      <EditMealsManager />
    </PageCard>
  );
}
