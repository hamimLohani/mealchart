"use client";

import Link from "next/link";
import { useT } from "@/i18n/use-t";

export function GroupAuthRequired() {
  const { t } = useT();

  return (
    <div className="mx-auto w-full max-w-2xl py-8">
      <div className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--panel)] p-6 shadow-sm sm:p-8">
        <p className="admin-section-label">{t("adminDash.notSignedIn")}</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
          {t("adminDash.signInToManage")}
        </h1>
        <p className="mt-2 text-sm text-[color:var(--soft-foreground)]">
          {t("enterForm.signInHint")}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/enter-group" className="button-primary text-xs">
            {t("home.ctaEnter")}
          </Link>
          <Link href="/admin/login" className="button-secondary text-xs">
            {t("adminNav.login")}
          </Link>
        </div>
      </div>
    </div>
  );
}
