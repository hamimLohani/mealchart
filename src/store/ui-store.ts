"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";
export type Language = "en" | "bn";

type UiState = {
  language: Language;
  theme: Theme;
  setLanguage: (language: Language) => void;
  setTheme: (theme: Theme) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      language: "en",
      theme: "light",
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "meat-chart-ui",
    },
  ),
);
