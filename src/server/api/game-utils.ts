import { eq, sql } from 'drizzle-orm';
import { db } from '~/server/db';
import { games, seats } from '~/server/db/schema';

type SeatRow = typeof seats.$inferSelect;
type GameRow = typeof games.$inferSelect;

type Tx = {
  insert: typeof db.insert;
  query: typeof db.query;
  update: typeof db.update;
};

// --- Helper utilities shared between game-logic and hand-solver ---

const pickNextIndex = (currentIndex: number, total: number) =>
  (currentIndex + 1) % total;

// The input seats don't have to all be active since the
// current seat can be inactive. This finds the first active
// seat after the current seat (skips eliminated players).
export const getNextActiveSeatId = (
  orderedSeats: Array<SeatRow>,
  currentSeatId: string,
) => {
  const n = orderedSeats.length;
  const mapIndex: Record<string, number> = {};
  orderedSeats.forEach((s, i) => {
    mapIndex[s.id] = i;
  });
  let idx = mapIndex[currentSeatId] ?? 0;
  for (let i = 0; i < n; i++) {
    idx = pickNextIndex(idx, n);
    if (orderedSeats[idx]!.seatStatus === "active")
      return orderedSeats[idx]!.id;
  }
  return orderedSeats[idx]!.id;
};

// Find the next seat that should receive hole cards.
// Includes both "active" and "all-in" players (anyone not folded/eliminated).
// This is needed because players can go all-in posting blinds before cards are dealt.
export const getNextDealableSeatId = (
  orderedSeats: Array<SeatRow>,
  currentSeatId: string,
) => {
  const n = orderedSeats.length;
  const mapIndex: Record<string, number> = {};
  orderedSeats.forEach((s, i) => {
    mapIndex[s.id] = i;
  });
  let idx = mapIndex[currentSeatId] ?? 0;
  for (let i = 0; i < n; i++) {
    idx = pickNextIndex(idx, n);
    const status = orderedSeats[idx]!.seatStatus;
    if (status === "active" || status === "all-in")
      return orderedSeats[idx]!.id;
  }
  return orderedSeats[idx]!.id;
};

// Fetch all seats to be safe and filter by actives later
export const fetchAllSeatsInOrder = async (
  tx: Tx,
  tableId: string,
): Promise<SeatRow[]> => {
  return await tx.query.seats.findMany({
    where: eq(seats.tableId, tableId),
    orderBy: (s, { asc }) => [asc(s.seatNumber)],
  });
};

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

export const activeCountOf = (orderedSeats: Array<SeatRow>): number =>
  orderedSeats.filter((s) => s.seatStatus === "active").length;

// Helper to count non-eliminated players (those who can still play)
export const nonEliminatedCountOf = (orderedSeats: Array<SeatRow>): number =>
  orderedSeats.filter((s) => s.seatStatus !== "eliminated").length;

export async function mergeBetsIntoPotGeneric(
  tx: Tx,
  gameObj: GameRow,
  orderedSeats: Array<SeatRow>,
): Promise<GameRow> {
  // Calculate total bets
  const total = orderedSeats.reduce((sum, s) => sum + s.currentBet, 0);

  // If no bets or all bets are zero, skip side pot creation
  if (total === 0) {
    await tx
      .update(games)
      .set({
        betCount: 0,
        requiredBetCount: 0,
      })
      .where(eq(games.id, gameObj.id));
    return {
      ...gameObj,
      betCount: 0,
      requiredBetCount: 0,
    };
  }

  // Create side pots based on all-in players
  // Algorithm:
  // 1. Sort ALL players with bets by currentBet (ascending) to determine pot levels
  // 2. For each betting level, create a pot with contributions from all players
  // 3. Only non-folded players are eligible to WIN the pot (eligibleSeatIds)

  const seatsWithBets = orderedSeats.filter((s) => s.currentBet > 0);
  const nonFoldedSeats = seatsWithBets.filter(
    (s) => s.seatStatus !== "folded" && s.seatStatus !== "eliminated",
  );

  // Sort ALL seats with bets (including folded) to determine pot levels
  // This ensures folded players' bets are included in side pots
  const sortedByBet = [...seatsWithBets].sort(
    (a, b) => a.currentBet - b.currentBet,
  );

  const newSidePots: Array<{ amount: number; eligibleSeatIds: string[] }> = [];
  let previousBetLevel = 0;

  for (let i = 0; i < sortedByBet.length; i++) {
    const currentSeat = sortedByBet[i]!;
    const currentBetLevel = currentSeat.currentBet;

    if (currentBetLevel === previousBetLevel) {
      continue; // Skip if same bet level
    }

    const betIncrement = currentBetLevel - previousBetLevel;

    // Eligible seats can WIN the pot - only non-folded players who bet at least this amount
    const eligibleSeats = nonFoldedSeats.filter(
      (s) => s.currentBet >= currentBetLevel,
    );

    // Calculate pot amount: betIncrement * number of ALL players who bet at least currentBetLevel
    // This includes folded players who contributed chips but can't win
    const contributingSeats = seatsWithBets.filter(
      (s) => s.currentBet >= currentBetLevel,
    );
    const potAmount = betIncrement * contributingSeats.length;

    // Only create side pot if there's actual betting happening
    if (potAmount > 0 && eligibleSeats.length > 0) {
      newSidePots.push({
        amount: potAmount,
        eligibleSeatIds: eligibleSeats.map((s) => s.id),
      });
    }

    previousBetLevel = currentBetLevel;
  }

  // Merge new side pots with existing ones
  const existingSidePots = (gameObj.sidePots as any) || [];
  const allSidePots = [...existingSidePots, ...newSidePots];

  // Update game with new pot total and side pots
  await tx
    .update(games)
    .set({
      potTotal: sql`${games.potTotal} + ${total}`,
      sidePots: allSidePots as any,
      betCount: 0,
      requiredBetCount: 0,
    })
    .where(eq(games.id, gameObj.id));

  // Clear current bets
  for (const s of orderedSeats) {
    await tx.update(seats).set({ currentBet: 0 }).where(eq(seats.id, s.id));
    s.currentBet = 0;
  }

  return {
    ...gameObj,
    potTotal: gameObj.potTotal + total,
    sidePots: allSidePots as any,
    betCount: 0,
    requiredBetCount: 0,
  };
}
