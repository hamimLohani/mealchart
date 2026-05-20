"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { SWRConfig } from "swr";
import { useUiStore } from "@/store/ui-store";
import { useAuthStore } from "@/store/auth-store";
import { auth } from "@/lib/firebase/client";
import { useT } from "@/i18n/use-t";
import { ToastContainer } from "@/components/ui/toast-container";

export function UiProvider({ children }: { children: React.ReactNode }) {
  const { language, theme, startLoading, stopLoading } = useUiStore();
  const loadingEntries = useUiStore((state) => state.loadingEntries);
  const { setAdmin, setLoaded } = useAuthStore();
  const { t } = useT();
  const [mounted, setMounted] = useState(false);
  const [isReloadingFromSession, setIsReloadingFromSession] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if we were reloading
    if (typeof window !== "undefined" && sessionStorage.getItem("is_reloading") === "true") {
      setIsReloadingFromSession(true);
      sessionStorage.removeItem("is_reloading");
      // Optionally stop any lingering reload loading state
      stopLoading("app-header-reload");
      // Hide the session-based reload message after a brief delay
      setTimeout(() => setIsReloadingFromSession(false), 500);
    }
  }, [stopLoading]);

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

  const loadingMessages = Object.entries(loadingEntries);
  // Prioritize reloading message if it exists
  const isReloading = isReloadingFromSession || !!loadingEntries["app-header-reload"];
  const loadingMessage = isReloading 
    ? (loadingEntries["app-header-reload"] || t("common.reloading"))
    : (loadingMessages.length > 0 ? loadingMessages[loadingMessages.length - 1][1] : t("common.loading"));
  const isLoading = mounted && (isReloading || loadingMessages.length > 0);

  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 10000,
        focusThrottleInterval: 15000,
      }}
    >
      <>
        {children}
        <ToastContainer />
        {isLoading ? (
          <div className="global-loading-overlay" aria-live="polite" aria-busy="true" role="status">
            <div className="global-loading-card">
              <span className="global-loading-spinner" aria-hidden="true" />
              <p className="global-loading-message">{loadingMessage}</p>
            </div>
          </div>
        ) : null}
      </>
    </SWRConfig>
  );
}
