import { PageCard } from "@/components/layout/page-card";
import { CostsManager } from "@/components/admin/costs-manager";

export default function CostsPage() {
  return (
    <PageCard
      eyebrow="Costs"
      title="Bazar and expense tracking"
      description="Add item costs with date. Each entry updates the total cost used in meal rate calculations."
    >
      <CostsManager />
    </PageCard>
  );
}
