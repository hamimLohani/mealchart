"use client";

import { useUiStore, ToastType } from "@/store/ui-store";
import { useCallback } from "react";

export function useToast() {
  const addToast = useUiStore((state) => state.addToast);

  const toast = useCallback(
    (message: string, type: ToastType = "success") => {
      addToast(message, type);
    },
    [addToast]
  );

  return {
    toast,
    success: (msg: string) => toast(msg, "success"),
    error: (msg: string) => toast(msg, "error"),
    info: (msg: string) => toast(msg, "info"),
  };
}
