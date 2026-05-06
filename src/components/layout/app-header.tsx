"use client";

import Link from "next/link";
import { useUiStore } from "@/store/ui-store";

export function AppHeader() {
  const { language, setLanguage, theme, setTheme } = useUiStore();

  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--background)]/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-4">
        <Link className="flex items-center gap-2.5 sm:gap-3" href="/">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--accent)] text-xs font-bold text-white sm:h-10 sm:w-10 sm:rounded-2xl sm:text-sm">
            MC
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] sm:text-sm">
              Meat Chart
            </p>
            <p className="hidden text-xs text-[color:var(--soft-foreground)] sm:block sm:text-sm">
              Hostel and mess accounting
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            className="rounded-full border border-[color:var(--border)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] sm:px-3 sm:py-2 sm:text-sm"
            onClick={() => setLanguage(language === "en" ? "bn" : "en")}
            type="button"
          >
            {language === "en" ? "বাংলা" : "English"}
          </button>
          <button
            className="rounded-full border border-[color:var(--border)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] sm:px-3 sm:py-2 sm:text-sm"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            type="button"
          >
            {theme === "light" ? "Dark" : "Light"}
          </button>
        </div>
      </div>
    </header>
  );
}
