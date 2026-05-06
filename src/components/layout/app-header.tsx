"use client";

import Link from "next/link";
import { useUiStore } from "@/store/ui-store";

export function AppHeader() {
  const { language, setLanguage, theme, setTheme } = useUiStore();

  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--background)]/88 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link className="flex items-center gap-3" href="/">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--accent)] text-sm font-bold text-white">
            MC
          </span>
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-[color:var(--muted)] uppercase">
              Meat Chart
            </p>
            <p className="text-sm text-[color:var(--foreground)]">
              Hostel and mess accounting
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <button
            className="rounded-full border border-[color:var(--border)] px-3 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)]"
            onClick={() => setLanguage(language === "en" ? "bn" : "en")}
            type="button"
          >
            {language === "en" ? "বাংলা" : "English"}
          </button>
          <button
            className="rounded-full border border-[color:var(--border)] px-3 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)]"
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
