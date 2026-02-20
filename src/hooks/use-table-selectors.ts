import { useSession } from "next-auth/react";
import { useMemo } from "react";
import { useTableStore } from "~/stores/table-store";

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

export function useIsPlayerTurn(userId: string | undefined) {
  const gameStatus = useGameState();
  const currentUserSeatId = useCurrentUserSeatId(userId);
  const bettingActorSeatId = useBettingActorSeatId();
  return useMemo(() => {
    return gameStatus === "BETTING" && currentUserSeatId === bettingActorSeatId;
  }, [gameStatus, currentUserSeatId, bettingActorSeatId]);
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

/** Min raise increment for current betting round (TDA rule); falls back to big blind */
export function useMinRaiseIncrement() {
  const snapshot = useTableStore((state) => state.snapshot);
  const effectiveBigBlind =
    snapshot?.game?.effectiveBigBlind ??
    snapshot?.blinds?.effectiveBigBlind ??
    0;
  const lastRaise = snapshot?.game?.lastRaiseIncrement ?? 0;
  return lastRaise > 0 ? lastRaise : effectiveBigBlind;
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

export function useDealerId() {
  const snapshot = useTableStore((state) => state.snapshot);
  return snapshot?.table?.dealerId ?? undefined;
}

export function useIsJoinable() {
  const snapshot = useTableStore((state) => state.snapshot);
  return snapshot?.isJoinable ?? false;
}

export function useBlinds() {
  const snapshot = useTableStore((state) => state.snapshot);
  return snapshot?.blinds;
}

export function useTableId(): string {
  const snapshot = useTableStore((state) => state.snapshot);
  const tableId = snapshot?.table?.id;
  if (!tableId) {
    throw new Error(
      "useTableId must be called within a table context with a valid tableId",
    );
  }
  return tableId;
}

export function useTurnStartTime() {
  const snapshot = useTableStore((state) => state.snapshot);
  return snapshot?.game?.turnStartTime ?? null;
}

export function useIsDealerRole() {
  const { data: session } = useSession();
  return session?.user?.role === "dealer";
}

/**
 * True when the current user can volunteer to show their hand at showdown.
 * Uses cardsVisibleToOthers from server-computed redaction.
 */
export function useCanVolunteerShow(userId: string | undefined) {
  const gameState = useGameState();
  const currentSeat = useCurrentSeat(userId);

  return useMemo(() => {
    if (!userId || gameState !== "SHOWDOWN" || !currentSeat) return false;
    // Can volunteer if cards are not yet visible to others
    return currentSeat.cardsVisibleToOthers === false;
  }, [userId, gameState, currentSeat]);
}

export function useSidePotDetails() {
  const snapshot = useTableStore((state) => state.snapshot);
  return (
    (snapshot?.game?.sidePotDetails as Array<{
      potNumber: number;
      amount: number;
      betLevelRange: { min: number; max: number };
      contributors: Array<{ seatId: string; contribution: number }>;
      eligibleSeatIds: string[];
      winners: Array<{ seatId: string; amount: number }>;
    }>) ?? []
  );
}
