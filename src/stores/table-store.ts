"use client";

import { create } from "zustand";

import type { TableSnapshot } from "~/server/api/routers/table";

type TableStore = {
  snapshot: TableSnapshot | null;
  setSnapshot: (snapshot: TableSnapshot | null) => void;
  clearSnapshot: () => void;
};

export const useTableStore = create<TableStore>((set) => ({
  snapshot: null,
  setSnapshot: (snapshot) => set({ snapshot }),
  clearSnapshot: () => set({ snapshot: null }),
}));
