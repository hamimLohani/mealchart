"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useUiStore } from "@/store/ui-store";
import { useAuthStore } from "@/store/auth-store";
import { auth } from "@/lib/firebase/client";

export function UiProvider({ children }: { children: React.ReactNode }) {
  const { language, theme } = useUiStore();
  const { setAdmin, setLoaded } = useAuthStore();

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.theme = theme;
  }, [language, theme]);

  useEffect(() => {
    if (!auth) {
      setLoaded();
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAdmin(user);
      setLoaded();
    });

    return unsubscribe;
  }, [setAdmin, setLoaded]);

  return children;
}
