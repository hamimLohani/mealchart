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
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-5xl items-start">
      <section className="w-full rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)]">
          {eyebrow}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[color:var(--foreground)] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[color:var(--soft-foreground)]">
          {description}
        </p>
        {children}
      </section>
    </main>
  );
}
