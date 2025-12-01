"use client";

import { create } from 'zustand';

type InteractionStore = {
  isBlindsHovered: boolean;
  setBlindsHovered: (hovered: boolean) => void;
};

export const useInteractionStore = create<InteractionStore>((set) => ({
  isBlindsHovered: false,
  setBlindsHovered: (hovered) => set({ isBlindsHovered: hovered }),
}));
