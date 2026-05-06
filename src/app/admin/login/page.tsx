import { PageCard } from "@/components/layout/page-card";
import { AdminLoginForm } from "@/components/forms/admin-login-form";

export default function AdminLoginPage() {
  return (
    <PageCard
      eyebrow="Admin Login"
      title="Firebase email and password login"
      description="Only admins use full authentication. Members will continue using the group token flow for MVP."
    >
      <AdminLoginForm />
    </PageCard>
  );
}
