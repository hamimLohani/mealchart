"use client";

import Link from "next/link";
import { AdminLoginForm } from "@/components/forms/admin-login-form";
import { useT } from "@/i18n/use-t";

export default function AdminLoginPage() {
  const { t } = useT();

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6 sm:py-16">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[color:var(--accent-dim)] mb-5">
          <svg className="w-8 h-8 text-[color:var(--accent)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[color:var(--muted)]">
          {t("adminLoginPage.eyebrow")}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--foreground)] sm:text-3xl">
          {t("adminLoginPage.title")}
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-[color:var(--soft-foreground)] sm:text-[0.95rem] max-w-md mx-auto">
          {t("adminLoginPage.subtitle")}
        </p>
      </div>

      {/* Card */}
      <section className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--panel)] p-6 shadow-[var(--shadow)] sm:p-8">
        <AdminLoginForm />
        <div className="mt-8 border-t border-[color:var(--border)] pt-6">
          <p className="text-center text-xs font-medium text-[color:var(--muted)]">
            {t("adminLoginPage.needGroup")}
          </p>
          <Link href="/register" className="button-secondary mt-3 block w-full text-center">
            {t("adminLoginPage.registerGroup")}
          </Link>
        </div>
      </section>
    </main>
  );
}
