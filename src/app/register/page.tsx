"use client";

import Link from "next/link";
import { RegisterGroupForm } from "@/components/forms/register-group-form";
import { useT } from "@/i18n/use-t";

export default function RegisterPage() {
  const { t } = useT();

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6 sm:py-16">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[color:var(--accent-dim)] mb-5">
          <svg className="w-8 h-8 text-[color:var(--accent)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
          </svg>
        </div>
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.26em] text-[color:var(--muted)]">
          {t("registerPage.eyebrow")}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--foreground)] sm:text-3xl">
          {t("registerPage.title")}
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-[color:var(--soft-foreground)] sm:text-[0.95rem] max-w-md mx-auto">
          {t("registerPage.description")}
        </p>
      </div>

      {/* Card */}
      <section className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--panel)] p-6 shadow-[var(--shadow)] sm:p-8">
        <RegisterGroupForm />
        <div className="mt-8 border-t border-[color:var(--border)] pt-8">
          <p className="text-center text-sm text-[color:var(--soft-foreground)]">
            {t("registerPage.hasAccount")}
          </p>
          <Link href="/enter-group" className="button-secondary mt-4 block w-full text-center">
            {t("registerPage.adminLogin")}
          </Link>
        </div>
      </section>
    </main>
  );
}
