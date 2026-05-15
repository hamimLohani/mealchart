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
  const [showOptions, setShowOptions] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
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
    if (typeof window !== "undefined") {
      setIsAndroid(/Android/i.test(navigator.userAgent));
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handlePWAInstall = async () => {
    if (!installPrompt) {
      // If it's an iOS device, we must show manual instructions because Safari doesn't support the prompt API
      if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        alert(t("common.iosInstructions"));
        setShowOptions(false);
      }
      return;
    }
    
    setShowOptions(false);
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    
    if (outcome === "accepted") {
      setInstallPrompt(null);
    }
  };

  const handleAPKDownload = () => {
    setShowOptions(false);
    const link = document.createElement("a");
    link.href = "/meal-chart.apk";
    link.download = "meal-chart.apk";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isStandalone) return null;

  // Case 1: Android - Show dropdown for both PWA and APK
  if (isAndroid) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowOptions(!showOptions)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--accent)] px-3.5 py-1.5 text-xs font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          type="button"
        >
          {t("common.installApp")}
          <svg className={`h-3 w-3 transition-transform ${showOptions ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </button>

        {showOptions && (
          <div className="absolute right-0 mt-2 w-52 origin-top-right rounded-xl border border-[color:var(--border)] bg-[color:var(--panel)] p-1 shadow-xl ring-1 ring-black/5 focus:outline-none z-50">
            {installPrompt && (
              <button
                onClick={handlePWAInstall}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-[color:var(--foreground)] transition hover:bg-[color:var(--accent-dim)] hover:text-[color:var(--accent)]"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
                {t("common.installApp")}
              </button>
            )}
            <button
               onClick={handleAPKDownload}
               className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-[color:var(--foreground)] transition hover:bg-[color:var(--accent-dim)] hover:text-[color:var(--accent)]"
             >
               <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
               </svg>
               {t("common.downloadAPK")}
             </button>

             <button
               onClick={handlePWAInstall}
               className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-[color:var(--foreground)] transition hover:bg-[color:var(--accent-dim)] hover:text-[color:var(--accent)]"
             >
               <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
               </svg>
               {t("common.downloadIOS")}
             </button>
           </div>
         )}
      </div>
    );
  }

  // Case 2: Desktop / Others with PWA support - Show simple install button
  if (installPrompt) {
    return (
      <button
        onClick={handlePWAInstall}
        className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--accent)] px-3.5 py-1.5 text-xs font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        type="button"
      >
        {t("common.installApp")}
      </button>
    );
  }

  return null;
}
