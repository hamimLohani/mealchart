"use client";

import { useEffect } from "react";
import { useUiStore } from "@/store/ui-store";

export function useGlobalLoading(key: string, active: boolean, message: string) {
  const startLoading = useUiStore((state) => state.startLoading);
  const stopLoading = useUiStore((state) => state.stopLoading);

  useEffect(() => {
    if (active) {
      startLoading(key, message);
    } else {
      stopLoading(key);
    }

    return () => {
      stopLoading(key);
    };
  }, [active, key, message, startLoading, stopLoading]);
}
