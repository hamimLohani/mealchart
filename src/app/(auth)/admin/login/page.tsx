"use client";

import Link from "next/link";
import { AdminLoginForm } from "@/components/forms/admin-login-form";
import { useT } from "@/i18n/use-t";

export default function AdminLoginPage() {
  const { t } = useT();

  return (
    <div className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--panel)] p-6 shadow-[var(--shadow-lg)] sm:p-8">
      <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--accent)] text-sm font-bold text-white shadow-[0_4px_12px_var(--accent-glow)]">
        MC
      </div>
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[color:var(--muted)]">
        {t("adminLoginPage.eyebrow")}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("adminLoginPage.title")}</h1>
      <p className="mt-1.5 text-sm text-[color:var(--soft-foreground)]">
        {t("adminLoginPage.subtitle")}
      </p>
      <AdminLoginForm />
      <div className="mt-8 border-t border-[color:var(--border)] pt-6">
        <p className="text-center text-xs font-medium text-[color:var(--muted)]">
          {t("adminLoginPage.needGroup")}
        </p>
        <Link href="/register" className="button-secondary mt-3 block w-full text-center">
          {t("adminLoginPage.registerGroup")}
        </Link>
      </div>
    </div>
  );
}
