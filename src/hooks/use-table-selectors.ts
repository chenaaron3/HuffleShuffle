import { useMemo } from 'react';
import { useTableStore } from '~/stores/table-store';

import type { SeatWithPlayer } from "~/server/api/routers/table";

/**
 * Selector hooks for accessing computed values from the table store.
 * These hooks compute derived state from the snapshot data.
 */

export function useTableSnapshot() {
  return useTableStore((state) => state.snapshot);
}

export function usePaddedSeats() {
  const snapshot = useTableStore((state) => state.snapshot);
  return useMemo(() => {
    if (!snapshot?.table?.maxSeats || !snapshot?.seats) return [];
    const maxSeats = snapshot.table.maxSeats;
    return Array.from({ length: maxSeats }, (_, index) => {
      const seat = snapshot.seats.find((s) => s.seatNumber === index);
      return seat || null;
    });
  }, [snapshot?.table?.maxSeats, snapshot?.seats]);
}

export function useOriginalSeats() {
  const snapshot = useTableStore((state) => state.snapshot);
  return snapshot?.seats ?? [];
}

export function useGameState() {
  const snapshot = useTableStore((state) => state.snapshot);
  return snapshot?.game?.state as string | undefined;
}

export function useDealSeatId() {
  const state = useGameState();
  const snapshot = useTableStore((state) => state.snapshot);
  return state === "DEAL_HOLE_CARDS"
    ? (snapshot?.game?.assignedSeatId ?? null)
    : null;
}

export function useBettingActorSeatId() {
  const state = useGameState();
  const snapshot = useTableStore((state) => state.snapshot);
  return state === "BETTING" ? (snapshot?.game?.assignedSeatId ?? null) : null;
}

export function useHighlightedSeatId() {
  const dealSeatId = useDealSeatId();
  const bettingActorSeatId = useBettingActorSeatId();
  return dealSeatId ?? bettingActorSeatId;
}

export function useCurrentUserSeatId(userId: string | undefined) {
  const originalSeats = useOriginalSeats();
  return useMemo(() => {
    if (!userId) return null;
    return (
      originalSeats.find((s: SeatWithPlayer) => s.playerId === userId)?.id ??
      null
    );
  }, [originalSeats, userId]);
}

export function useCurrentSeat(userId: string | undefined) {
  const originalSeats = useOriginalSeats();
  return useMemo(() => {
    if (!userId) return undefined;
    return originalSeats.find((s: SeatWithPlayer) => s.playerId === userId) as
      | SeatWithPlayer
      | undefined;
  }, [originalSeats, userId]);
}

export function useTotalPot() {
  const snapshot = useTableStore((state) => state.snapshot);
  return snapshot?.game?.potTotal ?? 0;
}

export function useEffectiveBigBlind() {
  const snapshot = useTableStore((state) => state.snapshot);
  return (
    snapshot?.game?.effectiveBigBlind ??
    snapshot?.blinds?.effectiveBigBlind ??
    0
  );
}

export function useCommunityCards() {
  const snapshot = useTableStore((state) => state.snapshot);
  return snapshot?.game?.communityCards ?? [];
}

export function useWinningCards() {
  const state = useGameState();
  const originalSeats = useOriginalSeats();
  return useMemo(() => {
    const winningCards = new Set<string>();
    if (state === "SHOWDOWN") {
      originalSeats.forEach((seat: SeatWithPlayer) => {
        if (Array.isArray(seat.winningCards)) {
          seat.winningCards.forEach((card: string) => {
            winningCards.add(card);
          });
        }
      });
    }
    return Array.from(winningCards);
  }, [state, originalSeats]);
}

export function useActivePlayerName() {
  const state = useGameState();
  const originalSeats = useOriginalSeats();
  const bettingActorSeatId = useBettingActorSeatId();
  return useMemo(() => {
    if (state === "BETTING") {
      return (
        originalSeats.find((s: SeatWithPlayer) => s.id === bettingActorSeatId)
          ?.player?.name ?? undefined
      );
    }
    return undefined;
  }, [state, originalSeats, bettingActorSeatId]);
}

export function useMaxBet() {
  const originalSeats = useOriginalSeats();
  return useMemo(() => {
    return Math.max(
      ...originalSeats
        .filter((s) => s.seatStatus !== "folded")
        .map((s) => s.currentBet),
      0,
    );
  }, [originalSeats]);
}

export function useDealerSeatInfo() {
  const snapshot = useTableStore((state) => state.snapshot);
  const paddedSeats = usePaddedSeats();
  return useMemo(() => {
    const dealerSeatId = snapshot?.game?.dealerButtonSeatId ?? null;
    const dealerSeat = dealerSeatId
      ? paddedSeats.find((s: SeatWithPlayer | null) => s?.id === dealerSeatId)
      : null;
    const dealerSeatNumber = dealerSeat?.seatNumber ?? -1;
    return { dealerSeatId, dealerSeat, dealerSeatNumber };
  }, [snapshot?.game?.dealerButtonSeatId, paddedSeats]);
}

export function useBlindSeatNumbers() {
  const snapshot = useTableStore((state) => state.snapshot);
  const paddedSeats = usePaddedSeats();

  return useMemo(() => {
    const dealerSeatId = snapshot?.game?.dealerButtonSeatId ?? null;
    const dealerSeat = dealerSeatId
      ? paddedSeats.find((s) => s?.id === dealerSeatId)
      : null;
    const dealerSeatNumber = dealerSeat?.seatNumber ?? -1;

    const findNextOccupiedSeat = (startSeatNumber: number): number => {
      if (startSeatNumber < 0) return -1;
      const totalSeats = snapshot?.table?.maxSeats ?? 8;
      for (let i = 1; i < totalSeats; i++) {
        const nextSeatNumber = (startSeatNumber + i) % totalSeats;
        const seat = paddedSeats[nextSeatNumber] || null;
        if (seat !== null && seat.seatStatus !== "eliminated") {
          return nextSeatNumber;
        }
      }
      return -1;
    };

    const smallBlindSeatNumber = findNextOccupiedSeat(dealerSeatNumber);
    const bigBlindSeatNumber =
      smallBlindSeatNumber >= 0
        ? findNextOccupiedSeat(smallBlindSeatNumber)
        : -1;

    return {
      smallBlindIdx: smallBlindSeatNumber,
      bigBlindIdx: bigBlindSeatNumber,
      dealerButtonIdx: dealerSeatNumber,
    };
  }, [
    snapshot?.game?.dealerButtonSeatId,
    snapshot?.table?.maxSeats,
    paddedSeats,
  ]);
}
