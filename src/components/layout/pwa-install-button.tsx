"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/use-t";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstallButton() {
  const { t } = useT();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone] = useState(() => {
    if (typeof window !== "undefined") {
      const isStandaloneMode = window.matchMedia("(display-mode: standalone)").matches;
      const isTWA = document.referrer.includes("android-app://") || 
                   (window as any).navigator.standalone ||
                   window.location.search.includes("utm_source=twa");
      
      return isStandaloneMode || isTWA;
    }
    return false;
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") {
        setInstallPrompt(null);
      }
      return;
    }

    // Fallback for iOS Safari which doesn't support beforeinstallprompt
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      alert(t("common.iosInstructions"));
    }
  };

  if (isStandalone) return null;

  // Show button if we have a prompt OR if it's an iOS device (to show instructions)
  const isIOS = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (installPrompt || isIOS) {
    return (
      <button
        onClick={handleInstall}
        className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--accent)] px-3.5 py-1.5 text-xs font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        type="button"
      >
        {t("common.installApp")}
      </button>
    );
  }

  return null;
}
