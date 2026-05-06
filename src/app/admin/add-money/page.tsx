import { PageCard } from "@/components/layout/page-card";
import { AddMoneyManager } from "@/components/admin/add-money-manager";

export default function AddMoneyPage() {
  return (
    <PageCard
      eyebrow="Add Money"
      title="Member deposit collection"
      description="This page will show each member’s previous deposit total, record new money given to the admin, and recalculate the current month’s mess balance in realtime."
    >
      <AddMoneyManager />
    </PageCard>
  );
}
