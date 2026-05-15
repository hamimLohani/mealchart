"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone] = useState(() => {
    if (typeof window !== "undefined") {
      // 1. Check if running as a standalone PWA (iOS or Android "Add to Home Screen")
      const isStandaloneMode = window.matchMedia("(display-mode: standalone)").matches;
      // 2. Check if running inside the Trusted Web Activity (TWA / Android APK)
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
    if (!installPrompt) return;
    
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    
    if (outcome === "accepted") {
      setInstallPrompt(null);
    }
  };

  if (isStandalone || !installPrompt) return null;

  return (
    <button
      onClick={handleInstall}
      className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--accent)] px-3.5 py-1.5 text-xs font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
      type="button"
    >
      Install App
    </button>
  );
}
