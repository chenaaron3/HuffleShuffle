"use client";

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { StateStorage } from "zustand/middleware";

type StreamingConfigState = {
  backgroundBlurEnabled: boolean;
  backgroundBlurSupported: boolean;
  setBackgroundBlurEnabled: (
    value: boolean | ((prev: boolean) => boolean),
  ) => void;
  setBackgroundBlurSupported: (value: boolean) => void;
};

const createNoopStorage = (): StateStorage => ({
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
});

export const useStreamingConfigStore = create<StreamingConfigState>()(
  persist(
    (set) => ({
      backgroundBlurEnabled: true,
      backgroundBlurSupported: true,
      setBackgroundBlurEnabled: (value) =>
        set((state) => ({
          backgroundBlurEnabled:
            typeof value === "function"
              ? value(state.backgroundBlurEnabled)
              : value,
        })),
      setBackgroundBlurSupported: (value: boolean) =>
        set({ backgroundBlurSupported: value }),
    }),
    {
      name: "huffle-shuffle.streaming-config",
      storage:
        typeof window !== "undefined"
          ? createJSONStorage(() => window.localStorage)
          : createNoopStorage(),
      partialize: (state) => ({
        backgroundBlurEnabled: state.backgroundBlurEnabled,
      }),
    },
  ),
);
