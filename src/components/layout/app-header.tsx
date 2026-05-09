"use client";

import Link from "next/link";
import Image from "next/image";
import { useT } from "@/i18n/use-t";
import { useUiStore } from "@/store/ui-store";

export function AppHeader() {
  const { language, setLanguage, theme, setTheme } = useUiStore();
  const { t } = useT();

  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--panel)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <Link className="flex items-center gap-2.5" href="/">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-[0_4px_10px_var(--accent-glow)] sm:h-9 sm:w-9">
            <Image src="/logo.png" alt="Meal Chart Logo" width={36} height={36} className="h-full w-full object-cover" />
          </div>
          <div className="leading-tight">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.22em] text-[color:var(--muted)]">
              {t("header.brand")}
            </p>
            <p className="hidden text-xs font-medium text-[color:var(--soft-foreground)] sm:block">
              {t("header.tagline")}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-1.5">
          <button
            className="rounded-full border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-1.5 text-xs font-semibold text-[color:var(--soft-foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            onClick={() => setLanguage(language === "en" ? "bn" : "en")}
            type="button"
          >
            {language === "en" ? "বাংলা" : "English"}
          </button>
          <button
            className="rounded-full border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-1.5 text-xs font-semibold text-[color:var(--soft-foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            type="button"
          >
            {theme === "light" ? t("header.themeDark") : t("header.themeLight")}
          </button>
        </div>
      </div>
    </header>
  );
}
