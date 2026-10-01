import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import { selectGameEvents, selectTableSnapshot, useTableStore } from '~/stores/table-store';

import type { SeatPlayer, SeatWithPlayer } from "~/server/api/table/types";

/**
 * Selector hooks for accessing computed values from the table store.
 * These hooks compute derived state from the snapshot data.
 */

export function useTableSnapshot() {
  return useTableStore(selectTableSnapshot);
}

export function usePaddedSeats() {
  const snapshot = useTableStore(selectTableSnapshot);
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
  const snapshot = useTableStore(selectTableSnapshot);
  return snapshot?.seats ?? [];
}

export function useGameState() {
  const snapshot = useTableStore(selectTableSnapshot);
  return snapshot?.game?.state as string | undefined;
}

export function useDealSeatId() {
  const state = useGameState();
  const snapshot = useTableStore(selectTableSnapshot);
  return state === "DEAL_HOLE_CARDS"
    ? (snapshot?.game?.assignedSeatId ?? null)
    : null;
}

export function useBettingActorSeatId() {
  const state = useGameState();
  const snapshot = useTableStore(selectTableSnapshot);
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
  const snapshot = useTableStore(selectTableSnapshot);
  return snapshot?.game?.potTotal ?? 0;
}

export function useEffectiveBigBlind() {
  const snapshot = useTableStore(selectTableSnapshot);
  return (
    snapshot?.game?.effectiveBigBlind ??
    snapshot?.blinds?.effectiveBigBlind ??
    0
  );
}

/** Min raise increment for current betting round (TDA rule); falls back to big blind */
export function useMinRaiseIncrement() {
  const snapshot = useTableStore(selectTableSnapshot);
  const effectiveBigBlind =
    snapshot?.game?.effectiveBigBlind ??
    snapshot?.blinds?.effectiveBigBlind ??
    0;
  const lastRaise = snapshot?.game?.lastRaiseIncrement ?? 0;
  return lastRaise > 0 ? lastRaise : effectiveBigBlind;
}

export function useCommunityCards() {
  const snapshot = useTableStore(selectTableSnapshot);
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
      const actor = originalSeats.find(
        (s: SeatWithPlayer) => s.id === bettingActorSeatId,
      );
      return actor?.player?.displayName;
    }
    return undefined;
  }, [state, originalSeats, bettingActorSeatId]);
}

export function useMaxBet() {
  const originalSeats = useOriginalSeats();
  return useMemo(() => {
    return Math.max(
      ...originalSeats
        .filter(
          (s) => s.seatStatus !== "folded" && s.seatStatus !== "eliminated",
        )
        .map((s) => s.currentBet),
      0,
    );
  }, [originalSeats]);
}

/**
 * Current street bet target for calling/checking UX.
 * Preflop, this is floored to effective BB so short-posted BB hands match backend behavior.
 */
export function useCurrentBetTarget() {
  const snapshot = useTableStore(selectTableSnapshot);
  const maxBet = useMaxBet();

  return useMemo(() => {
    const effectiveBigBlind =
      snapshot?.game?.effectiveBigBlind ??
      snapshot?.blinds?.effectiveBigBlind ??
      0;
    const isPreflop = (snapshot?.game?.communityCards?.length ?? 0) === 0;
    return isPreflop ? Math.max(maxBet, effectiveBigBlind) : maxBet;
  }, [
    maxBet,
    snapshot?.game?.communityCards,
    snapshot?.game?.effectiveBigBlind,
    snapshot?.blinds?.effectiveBigBlind,
  ]);
}

export function useDealerSeatInfo() {
  const snapshot = useTableStore(selectTableSnapshot);
  const paddedSeats = usePaddedSeats();
  return useMemo(() => {
    const dealerSeatNumber = snapshot?.game?.dealerButtonSeatNumber ?? -1;
    const dealerSeat =
      dealerSeatNumber >= 0
        ? (paddedSeats.find(
            (s: SeatWithPlayer | null) => s?.seatNumber === dealerSeatNumber,
          ) ?? null)
        : null;
    return {
      dealerSeatId: dealerSeat?.id ?? null,
      dealerSeat,
      dealerSeatNumber,
    };
  }, [snapshot?.game?.dealerButtonSeatNumber, paddedSeats]);
}

export function useBlindSeatNumbers() {
  const snapshot = useTableStore(selectTableSnapshot);

  return useMemo(() => {
    return {
      smallBlindIdx: snapshot?.game?.smallBlindSeatNumber ?? -1,
      bigBlindIdx: snapshot?.game?.bigBlindSeatNumber ?? -1,
      dealerButtonIdx: snapshot?.game?.dealerButtonSeatNumber ?? -1,
    };
  }, [
    snapshot?.game?.dealerButtonSeatNumber,
    snapshot?.game?.smallBlindSeatNumber,
    snapshot?.game?.bigBlindSeatNumber,
  ]);
}

export function useDealerId() {
  const snapshot = useTableStore(selectTableSnapshot);
  return snapshot?.table?.dealerId ?? undefined;
}

export function useIsJoinable() {
  const snapshot = useTableStore(selectTableSnapshot);
  return snapshot?.isJoinable ?? false;
}

export function useIsHandInProgress() {
  const snapshot = useTableStore(selectTableSnapshot);
  return snapshot?.isHandInProgress ?? false;
}

export function useIsTournamentActive() {
  const snapshot = useTableStore(selectTableSnapshot);
  return snapshot?.isTournamentActive ?? false;
}

export function useBlinds() {
  const snapshot = useTableStore(selectTableSnapshot);
  return snapshot?.blinds;
}

export function useTableId(): string {
  const snapshot = useTableStore(selectTableSnapshot);
  const tableId = snapshot?.table?.id;
  if (!tableId) {
    throw new Error(
      "useTableId must be called within a table context with a valid tableId",
    );
  }
  return tableId;
}

export function useTurnStartTime() {
  const snapshot = useTableStore(selectTableSnapshot);
  return snapshot?.game?.turnStartTime ?? null;
}

export function useIsDealerRole() {
  const { data: session } = useSession();
  return session?.user?.role === "dealer";
}

/** True when this session user is the assigned dealer of the current table. */
export function useIsDealerAtTable() {
  const { data: session } = useSession();
  const dealerId = useDealerId();
  return !!session?.user?.id && dealerId === session.user.id;
}

/** Watching without a seat and without being this table's dealer. */
export function useIsSpectator() {
  const { data: session } = useSession();
  const snapshot = useTableSnapshot();
  const currentSeat = useCurrentSeat(session?.user?.id);
  const isDealerAtTable = useIsDealerAtTable();
  if (!session?.user?.id || !snapshot?.table) return false;
  return !currentSeat && !isDealerAtTable;
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

const TOURNAMENT_WINNER_MODAL_WINDOW_MS = 60_000;

function tournamentEndedAtMs(
  endedAt: Date | string | null | undefined,
): number | null {
  if (!endedAt) return null;
  const ms = new Date(endedAt).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Winner recorded on the latest tournament, only within 1 minute of it ending. */
export function useTournamentWinner(): SeatPlayer | null {
  const snapshot = useTableStore(selectTableSnapshot);
  const winner = snapshot?.tournament?.winner ?? null;
  const winnerId = winner?.id ?? null;
  const endedAtMs = tournamentEndedAtMs(snapshot?.tournament?.endedAt);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!winnerId || endedAtMs == null) return;
    const remaining = endedAtMs + TOURNAMENT_WINNER_MODAL_WINDOW_MS - Date.now();
    if (remaining <= 0) return;
    const id = window.setTimeout(() => setTick((n) => n + 1), remaining);
    return () => window.clearTimeout(id);
  }, [winnerId, endedAtMs]);

  if (!winner || endedAtMs == null) return null;
  if (Date.now() - endedAtMs > TOURNAMENT_WINNER_MODAL_WINDOW_MS) return null;
  return winner;
}

export function useGameEvents() {
  return useTableStore(selectGameEvents);
}

export function useSidePotDetails() {
  const snapshot = useTableStore(selectTableSnapshot);
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
