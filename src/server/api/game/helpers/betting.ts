import { seats, games } from "~/server/db/schema";

type SeatRow = typeof seats.$inferSelect;
type GameRow = typeof games.$inferSelect;
type BettingSeat = Pick<SeatRow, "seatStatus" | "currentBet">;
type BettingGameState = Pick<GameRow, "communityCards" | "effectiveBigBlind">;

export const allActiveBetsEqual = (orderedSeats: Array<SeatRow>): boolean => {
  // Canonical poker rule: Active players must match the highest bet from anyone
  // (including all-in players who may have bet more before going all-in)
  const activePlayers = orderedSeats.filter((s) => s.seatStatus === "active");
  const nonFoldedPlayers = orderedSeats.filter(
    (s) => s.seatStatus !== "folded",
  );

  // If no active players remain, betting is complete
  if (activePlayers.length === 0) return true;

  // Find the highest bet among all non-folded players (active + all-in)
  const highestBet = Math.max(...nonFoldedPlayers.map((s) => s.currentBet), 0);

  // All active players must have matched the highest bet
  return activePlayers.every((s) => s.currentBet === highestBet);
};

// Preflop, calling must at least match the configured big blind even if BB posted short.
export const getCurrentBetTarget = (
  game: BettingGameState,
  orderedSeats: Array<BettingSeat>,
): number => {
  const observedMaxBet = Math.max(
    ...orderedSeats
      .filter((s) => s.seatStatus !== "folded" && s.seatStatus !== "eliminated")
      .map((s) => s.currentBet),
    0,
  );
  const effectiveBigBlind = game.effectiveBigBlind ?? 0;
  const isPreflop = (game.communityCards?.length ?? 0) === 0;
  return isPreflop
    ? Math.max(observedMaxBet, effectiveBigBlind)
    : observedMaxBet;
};
