import { PageCard } from "@/components/layout/page-card";
import { EnterGroupForm } from "@/components/forms/enter-group-form";

export default function EnterGroupPage() {
  return (
    <PageCard
      eyebrow="Enter Group"
      title="Token-based group entry"
      description="Members will enter the shared group token here and move into the public group dashboard for meals, charts, money management, history, and notices."
    >
      <EnterGroupForm />
    </PageCard>
  );
}
