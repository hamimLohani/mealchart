import { PageCard } from "@/components/layout/page-card";
import { RegisterGroupForm } from "@/components/forms/register-group-form";

export default function RegisterPage() {
  return (
    <PageCard
      eyebrow="Register Group"
      title="Admin registration flow"
      description="This page will create the admin account, create the group document, and generate the group token immediately after successful signup."
    >
      <RegisterGroupForm />
    </PageCard>
  );
}
