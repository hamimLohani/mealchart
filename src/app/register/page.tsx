import Link from "next/link";
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
      <div className="mt-8 border-t border-[color:var(--border)] pt-8">
        <p className="text-center text-sm text-[color:var(--soft-foreground)]">
          Already registered your group?
        </p>
        <Link href="/admin/login" className="button-secondary mt-4 block w-full text-center">
          Admin login
        </Link>
      </div>
    </PageCard>
  );
}
