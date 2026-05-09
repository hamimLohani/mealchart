"use client";

import { useCallback } from "react";
import { translateErrorMessage } from "@/i18n/error-map";
import type { MessageKey } from "@/i18n/messages";
import { messages } from "@/i18n/messages";
import type { Language } from "@/store/ui-store";
import { useUiStore } from "@/store/ui-store";

export function useT() {
  const language = useUiStore((s) => s.language) as Language;

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string>) => {
      let s = messages[language]?.[key] ?? messages.en[key] ?? String(key);
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.replaceAll(`{${k}}`, v);
        }
      }
      return s;
    },
    [language],
  );

  const tx = useCallback(
    (raw: string) => translateErrorMessage(raw, t),
    [t],
  );

  return { t, tx, language };
}
