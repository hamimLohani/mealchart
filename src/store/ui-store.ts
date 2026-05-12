"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";
export type Language = "en" | "bn";

type UiState = {
  language: Language;
  theme: Theme;
  loadingEntries: Record<string, string>;
  setLanguage: (language: Language) => void;
  setTheme: (theme: Theme) => void;
  startLoading: (key: string, message: string) => void;
  stopLoading: (key: string) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      language: "en",
      theme: "light",
      loadingEntries: {},
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
