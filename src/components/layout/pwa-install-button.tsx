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
  const [isInstalled, setIsInstalled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;

    // Check initial installation status
    const isStandaloneMode = window.matchMedia("(display-mode: standalone)").matches;
    const isTWA = document.referrer.includes("android-app://") || 
                 (window as any).navigator.standalone ||
                 window.location.search.includes("utm_source=twa");
    
    if (isStandaloneMode || isTWA) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") {
        setInstallPrompt(null);
        setIsInstalled(true);
      }
      return;
    }

    // Fallback for Safari (iOS or macOS)
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    if (isIOS || isSafari) {
      alert(t("common.iosInstructions"));
    }
  };

  if (!mounted || isInstalled) return null;

  const isIOS = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isSafari = typeof navigator !== "undefined" && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  // Show button on:
  // 1. Browsers with PWA prompt support (Chrome/Edge/Android)
  // 2. iOS devices (to show Safari instructions)
  // 3. Desktop Safari (to show instructions for "Add to Dock")
  if (installPrompt || isIOS || isSafari) {
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
