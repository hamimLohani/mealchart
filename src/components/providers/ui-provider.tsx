"use client";

import { useEffect } from "react";
import { useUiStore } from "@/store/ui-store";

export function UiProvider({ children }: { children: React.ReactNode }) {
  const { language, theme } = useUiStore();

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.theme = theme;
  }, [language, theme]);

  return children;
}
