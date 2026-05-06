import { ReactNode } from "react";

export function PageCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <section className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-6 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)]">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--foreground)] sm:text-3xl">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-7 text-[color:var(--soft-foreground)] sm:text-base">
          {description}
        </p>
        {children}
      </section>
    </main>
  );
}
