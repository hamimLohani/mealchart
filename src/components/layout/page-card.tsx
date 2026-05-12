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
    <main className="mx-auto w-full max-w-3xl px-3 py-6 sm:px-8 sm:py-12">
      <section className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--panel)] p-4 shadow-[var(--shadow)] sm:p-10">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.26em] text-[color:var(--muted)]">
          {eyebrow}
        </p>
        <h1 className="mt-2.5 text-2xl font-semibold tracking-tight text-[color:var(--foreground)] sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-7 text-[color:var(--soft-foreground)] sm:text-base">
          {description}
        </p>
        {children}
      </section>
    </main>
  );
}
