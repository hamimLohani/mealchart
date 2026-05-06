"use client";

import { create } from "zustand";
import type { User } from "firebase/auth";

type AuthState = {
  admin: User | null;
  isLoaded: boolean;
  setAdmin: (admin: User | null) => void;
  setLoaded: () => void;
};

export const useAuthStore = create<AuthState>()((set) => ({
  admin: null,
  isLoaded: false,
  setAdmin: (admin) => set({ admin }),
  setLoaded: () => set({ isLoaded: true }),
}));
