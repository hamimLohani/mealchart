"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";
export type Language = "en" | "bn";

export type ToastType = "success" | "error" | "info";

export type Toast = {
  id: string;
  message: string;
  type: ToastType;
};

type UiState = {
  language: Language;
  theme: Theme;
  loadingEntries: Record<string, string>;
  toasts: Toast[];
  setLanguage: (language: Language) => void;
  setTheme: (theme: Theme) => void;
  startLoading: (key: string, message: string) => void;
  stopLoading: (key: string) => void;
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      language: "bn",
      theme: "light",
      loadingEntries: {},
      toasts: [],
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      startLoading: (key, message) =>
        set((state) => ({
          loadingEntries: { ...state.loadingEntries, [key]: message },
        })),
      stopLoading: (key) =>
        set((state) => {
          const next = { ...state.loadingEntries };
          delete next[key];
          return { loadingEntries: next };
        }),
      addToast: (message, type) =>
        set((state) => ({
          toasts: [...state.toasts, { id: Math.random().toString(36).substring(2, 9), message, type }],
        })),
      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),
    }),
    {
      name: "meat-chart-ui",
      partialize: (state) => ({
        language: state.language,
        theme: state.theme,
      }),
    },
  ),
);
