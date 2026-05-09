"use client";

import Link from "next/link";
import { useT } from "@/i18n/use-t";

function isTokenNotFoundMessage(message: string | null) {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    /no group found|group not found/i.test(m) ||
    /এই টোকেন|গ্রুপ পাওয়া যায়নি|টোকেনে কোনো গ্রুপ/.test(message)
  );
}

export function GroupTokenMismatchHint({ message }: { message: string | null }) {
  const { t } = useT();
  if (!isTokenNotFoundMessage(message)) return null;

  return (
    <div className="mt-4 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-4">
      <p className="text-sm font-medium text-[color:var(--foreground)]">{t("tokenHint.title")}</p>
      <p className="mt-1 text-xs text-[color:var(--soft-foreground)]">{t("tokenHint.body")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/register" className="button-primary inline-flex text-center text-sm">
          {t("tokenHint.register")}
        </Link>
        <Link href="/enter-group" className="button-secondary inline-flex text-center text-sm">
          {t("tokenHint.tryAgain")}
        </Link>
      </div>
    </div>
  );
}
