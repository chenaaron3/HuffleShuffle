"use client";

import { create } from "zustand";

import type { TableSnapshot } from "~/server/api/routers/table";

export type TableStore = {
  snapshot: TableSnapshot | null;
  setSnapshot: (snapshot: TableSnapshot | null) => void;
  clearSnapshot: () => void;
};

/** Module-level refs so Zustand's useSyncExternalStore getSnapshot stays stable (React 19 + Zustand v5). */
export const selectTableSnapshot = (s: TableStore) => s.snapshot;
export const selectSetSnapshot = (s: TableStore) => s.setSnapshot;

export const useTableStore = create<TableStore>((set) => ({
  snapshot: null,
  setSnapshot: (snapshot) => set({ snapshot }),
  clearSnapshot: () => set({ snapshot: null }),
}));
