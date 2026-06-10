"use client";

import { create } from 'zustand';

type InteractionStore = {
  isBlindsHovered: boolean;
  setBlindsHovered: (hovered: boolean) => void;
  /** Player ids the local user has muted for themselves only (in-memory, resets on refresh). */
  locallyMutedPlayerIds: Record<string, true>;
  toggleLocalMute: (playerId: string) => void;
};

export const useInteractionStore = create<InteractionStore>((set) => ({
  isBlindsHovered: false,
  setBlindsHovered: (hovered) => set({ isBlindsHovered: hovered }),
  locallyMutedPlayerIds: {},
  toggleLocalMute: (playerId) =>
    set((state) => {
      const next = { ...state.locallyMutedPlayerIds };
      if (next[playerId]) {
        delete next[playerId];
      } else {
        next[playerId] = true;
      }
      return { locallyMutedPlayerIds: next };
    }),
}));
