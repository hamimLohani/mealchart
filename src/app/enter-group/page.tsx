"use client";

import { EnterGroupForm } from "@/components/forms/enter-group-form";
import { useT } from "@/i18n/use-t";

export default function EnterGroupPage() {
  const { t } = useT();

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6 sm:py-16">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[color:var(--accent-dim)] mb-5">
          <svg className="w-8 h-8 text-[color:var(--accent)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
        </div>
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.26em] text-[color:var(--muted)]">
          {t("enterPage.eyebrow")}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--foreground)] sm:text-3xl">
          {t("enterPage.title")}
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-[color:var(--soft-foreground)] sm:text-[0.95rem] max-w-md mx-auto">
          {t("enterPage.description")}
        </p>
      </div>

      {/* Card */}
      <section className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--panel)] p-6 shadow-[var(--shadow)] sm:p-8">
        <EnterGroupForm />
      </section>

      {/* Footer hint */}
      <p className="mt-6 text-center text-xs text-[color:var(--muted)] leading-relaxed">
        {t("enterForm.footerHint")}
      </p>
    </main>
  );
}
