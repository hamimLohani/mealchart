import { PageCard } from "@/components/layout/page-card";
import { EnterGroupForm } from "@/components/forms/enter-group-form";

export default function EnterGroupPage() {
  return (
    <PageCard
      eyebrow="Enter Group"
      title="Enter your group token"
      description="Type the token your admin shared with you. You'll then pick your name from the member list to start entering meals."
    >
      <EnterGroupForm />
    </PageCard>
  );
}
