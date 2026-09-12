"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { SWRConfig } from "swr";
import { useUiStore } from "@/store/ui-store";
import { useAuthStore } from "@/store/auth-store";
import { auth } from "@/lib/firebase/client";
import { useT } from "@/i18n/use-t";
import { useToast } from "@/lib/hooks/use-toast";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { ToastContainer } from "@/components/ui/toast-container";

export function UiProvider({ children }: { children: React.ReactNode }) {
  const { language, theme } = useUiStore();
  const loadingEntries = useUiStore((state) => state.loadingEntries);
  const { setAdmin, setLoaded } = useAuthStore();
  const { t } = useT();
  const { success: showOnline } = useToast();
  const [mounted, setMounted] = useState(false);
  const [isReloadingFromSession, setIsReloadingFromSession] = useState(false);
  const isOnline = useOnlineStatus();
  const isOffline = !isOnline;
  const previousOnlineStatus = useRef<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    const wasReloading = sessionStorage.getItem("is_reloading") === "true";
    if (!wasReloading) return;

    sessionStorage.removeItem("is_reloading");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsReloadingFromSession(true);
  }, []);

  useEffect(() => {
    if (!isReloadingFromSession) return;
    const timer = window.setTimeout(() => {
      setIsReloadingFromSession(false);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [isReloadingFromSession]);

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

  useEffect(() => {
    if (previousOnlineStatus.current === null) {
      previousOnlineStatus.current = isOnline;

      return;
    }

    if (previousOnlineStatus.current === isOnline) return;
    previousOnlineStatus.current = isOnline;

    if (isOnline) {
      showOnline(t("common.backOnline"));
    }
  }, [isOnline, showOnline, t]);

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
        shouldRetryOnError: () => isOnline,
        // Deduplicate requests within 60s — prevents waterfall re-fetches
        // when navigating between pages or switching tabs quickly.
        dedupingInterval: 60_000,
        focusThrottleInterval: 60_000,
      }}
    >
      <>
        {children}
        <ToastContainer />
        {isOffline ? <OfflineBanner /> : null}
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

function OfflineBanner() {
  const { t } = useT();

  return (
    <div className="offline-banner" role="alert" aria-live="assertive">
      <div className="offline-banner-icon" aria-hidden="true">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75h.008v.008H12v-.008Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.287 15.038a5.25 5.25 0 0 1 7.426 0" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.106 11.856c3.807-3.807 9.981-3.807 13.788 0" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m3 3 18 18" />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="offline-banner-title">{t("common.offlineTitle")}</p>
        <p className="offline-banner-message">{t("common.offlineBody")}</p>
      </div>
    </div>
  );
}
