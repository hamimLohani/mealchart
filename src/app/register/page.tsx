"use client";

import Link from "next/link";
import { PageCard } from "@/components/layout/page-card";
import { RegisterGroupForm } from "@/components/forms/register-group-form";
import { useT } from "@/i18n/use-t";

export default function RegisterPage() {
  const { t } = useT();

  return (
    <PageCard
      eyebrow={t("registerPage.eyebrow")}
      title={t("registerPage.title")}
      description={t("registerPage.description")}
    >
      <RegisterGroupForm />
      <div className="mt-8 border-t border-[color:var(--border)] pt-8">
        <p className="text-center text-sm text-[color:var(--soft-foreground)]">
          {t("registerPage.hasAccount")}
        </p>
        <Link href="/admin/login" className="button-secondary mt-4 block w-full text-center">
          {t("registerPage.adminLogin")}
        </Link>
      </div>
    </PageCard>
  );
}
