"use client";

import { create } from "zustand";

import type { TableSnapshot } from "~/server/api/table/types";
import type { gameEvents } from "~/server/db/schema";

export type GameEventRow = typeof gameEvents.$inferSelect;

export type TableStore = {
  snapshot: TableSnapshot | null;
  events: GameEventRow[];
  setSnapshot: (snapshot: TableSnapshot | null) => void;
  setEvents: (events: GameEventRow[]) => void;
  clearSnapshot: () => void;
};

/** Module-level refs so Zustand's useSyncExternalStore getSnapshot stays stable (React 19 + Zustand v5). */
export const selectTableSnapshot = (s: TableStore) => s.snapshot;
export const selectSetSnapshot = (s: TableStore) => s.setSnapshot;
export const selectGameEvents = (s: TableStore) => s.events;
export const selectSetEvents = (s: TableStore) => s.setEvents;

export const useTableStore = create<TableStore>((set) => ({
  snapshot: null,
  events: [],
  setSnapshot: (snapshot) => set({ snapshot }),
  setEvents: (events) => set({ events }),
  clearSnapshot: () => set({ snapshot: null, events: [] }),
}));
