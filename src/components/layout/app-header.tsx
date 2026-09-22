"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/use-t";
import { useUiStore } from "@/store/ui-store";
import { PWAInstallButton } from "./pwa-install-button";

export function AppHeader() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const { language, setLanguage, theme, setTheme, startLoading } = useUiStore();
  const { t } = useT();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleReload = () => {
    // Set a flag in sessionStorage that we are reloading
    sessionStorage.setItem("is_reloading", "true");
    startLoading("app-header-reload", t("common.reloading"));
    setTimeout(() => {
      window.location.reload();
    }, 50);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--panel)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <Link className="flex items-center gap-2.5" href="/">
          <div className="flex h-10 w-auto shrink-0 items-center overflow-hidden rounded-lg">
            <Image src="/logo.png" alt="Meal Chart Logo" width={50} height={40} className="h-full w-auto object-contain" style={{ width: "auto", height: "auto" }} />
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
          <PWAInstallButton />
          <button
            className="rounded-full border border-[color:var(--border)] bg-[color:var(--background)] p-1.5 transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            onClick={handleReload}
            title={mounted ? t("common.reloading") : "Reload"}
            type="button"
          >
            <svg className="h-4 w-4 text-[color:var(--soft-foreground)]" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>

          {isHomePage ? (
            <>
              {/* BN / EN Language Toggle */}
              <button
                className="rounded-full border border-[color:var(--border)] bg-[color:var(--background)] px-2.5 py-1 text-xs font-semibold text-[color:var(--soft-foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                onClick={() => setLanguage(language === "en" ? "bn" : "en")}
                type="button"
                title={mounted ? (language === "en" ? "বাংলা ভাষায় পরিবর্তন করুন" : "Switch to English") : "Language"}
              >
                {mounted ? (language === "en" ? "বাং" : "EN") : "EN"}
              </button>

              {/* Light / Dark Mode Toggle */}
              <button
                className="rounded-full border border-[color:var(--border)] bg-[color:var(--background)] p-1.5 transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                type="button"
                title={mounted ? (theme === "light" ? t("header.themeDark") : t("header.themeLight")) : "Theme"}
                aria-label={mounted ? (theme === "light" ? t("header.themeDark") : t("header.themeLight")) : "Theme"}
              >
                {mounted ? (
                  theme === "light" ? (
                    <svg className="h-4 w-4 text-[color:var(--soft-foreground)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 text-[color:var(--soft-foreground)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21m9.75-9h-2.25m-13.5 0H3m15.364-6.364l-1.591 1.591M6.756 17.244l-1.591 1.591m12.728 0l-1.591-1.591M6.756 6.756L5.165 5.165M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                    </svg>
                  )
                ) : (
                  <div className="h-4 w-4" />
                )}
              </button>
            </>
          ) : (
            /* Settings Icon on non-home pages */
            <Link
              href="/admin/settings"
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--background)] p-1.5 transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
              title={t("adminNav.settings")}
              aria-label={t("adminNav.settings")}
            >
              <svg className="h-4 w-4 text-[color:var(--soft-foreground)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
