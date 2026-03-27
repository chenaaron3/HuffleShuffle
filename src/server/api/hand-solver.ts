import { eq, sql } from "drizzle-orm";
import { logEndGame } from "~/server/api/game-event-logger";
import { gameEvents, games, seats } from "~/server/db/schema";

import {
  activeCountOf,
  allActiveBetsEqual,
  fetchAllSeatsInOrder,
  mergeBetsIntoPotGeneric,
} from "./game-utils";
import { logMoneyConservationDiagnosticReport } from "./money-conservation-diagnostics";

const { Hand: PokerHand } = require("pokersolver");

type SeatRow = typeof seats.$inferSelect;
type GameRow = typeof games.$inferSelect;

import type { db } from "~/server/db";

type Tx = {
  insert: typeof db.insert;
  query: typeof db.query;
  update: typeof db.update;
};

// Type definitions for poker hand evaluation
interface PokerHandResult {
  name: string; // Hand type (e.g., "Straight Flush", "Four of a Kind")
  descr: string; // Detailed description (e.g., "Royal Flush", "Ace-High Straight Flush")
  cards: string[]; // Cards that make up the winning hand
  rank: number; // Hand rank (1-10, where 10 is highest)
  score: number; // Numeric score for comparison (derived from rank)
}

// Helper function to convert card format from our format to poker solver format
function convertCardsToPokerSolver(cards: string[]): string[] {
  return cards.map((card) => {
    if (card.length === 2) {
      // Handle single digit ranks (2-9)
      return (card[0] ?? "") + (card[1]?.toLowerCase() ?? "");
    } else if (card.length === 3) {
      // Handle '10' rank
      return "T" + (card[2]?.toLowerCase() ?? "");
    }
    return card;
  });
}

// Helper function to convert card format from poker solver format to our format
function convertCardsFromPokerSolver(cards: any[]): string[] {
  return cards.map((card) => {
    // Handle Card objects from pokersolver
    if (card && typeof card === "object" && card.value && card.suit) {
      // Poker solver uses '1' for ace in ace-to-5 straights, convert to 'A'
      const rankValue = card.value.toUpperCase();
      const rank = rankValue === "1" ? "A" : rankValue;
      const suit = card.suit.toUpperCase();
      return `${rank}${suit}`;
    }
    // Handle string format
    if (typeof card === "string" && card.length === 2) {
      // Convert from "Ad" format to "AS" format
      // Poker solver uses '1' for ace in ace-to-5 straights, convert to 'A'
      const rankValue = card[0]?.toUpperCase();
      const rank = rankValue === "1" ? "A" : rankValue;
      const suit = card[1]?.toUpperCase();
      const suitMap: Record<string, string> = {
        D: "D", // Diamonds
        H: "H", // Hearts
        S: "S", // Spades
        C: "C", // Clubs
      };
      return `${rank}${suitMap[suit ?? ""] ?? suit}`;
    }
    return card;
  });
}

// Helper function to normalize hand names
function normalizeHandName(pokerHand: any): string {
  let normalizedName = pokerHand.name;
  if (pokerHand.descr === "Royal Flush") {
    normalizedName = "Royal Flush";
  } else if (pokerHand.name === "Pair") {
    normalizedName = "One Pair";
  }
  return normalizedName;
}

// Helper function to solve a poker hand
export function solvePokerHand(cards: string[]): PokerHandResult {
  // pokersolver expects cards in format like ['Ad', 'As', 'Jc', 'Th', '2d', '3c', 'Kd']
  // Our cards are in format like ['AS', 'KH', 'QD', 'JC', '10S']
  const convertedCards = convertCardsToPokerSolver(cards);
  const pokerHand = PokerHand.solve(convertedCards);

  return {
    name: normalizeHandName(pokerHand),
    descr: pokerHand.descr,
    cards: convertCardsFromPokerSolver(pokerHand.cards), // Convert back to our format
    rank: pokerHand.rank,
    score: pokerHand.rank, // Use rank as score for comparison
  };
}

// Helper function to find winners among multiple hands
export function findPokerWinners(hands: PokerHandResult[]): PokerHandResult[] {
  if (hands.length === 0) return [];

  // Use pokersolver's built-in winner comparison
  const pokerHands = hands.map((hand) => {
    const convertedCards = convertCardsToPokerSolver(hand.cards);
    return PokerHand.solve(convertedCards);
  });

  const winners = PokerHand.winners(pokerHands);

  // Convert back to our format
  return winners.map((winner: any) => ({
    name: normalizeHandName(winner),
    descr: winner.descr,
    cards: convertCardsFromPokerSolver(winner.cards), // Convert back to our format
    rank: winner.rank,
    score: winner.rank, // Use rank as score for comparison
  }));
}

// Type for evaluated hand data
type EvaluatedHand = {
  seatId: string;
  hand: PokerHandResult;
  playerCards: string[];
};

// Evaluate hands for all contenders
function evaluateContenderHands(
  contenders: SeatRow[],
  allSeats: SeatRow[],
  communityCards: string[],
): EvaluatedHand[] {
  const seatsToEvaluate = new Set(contenders.map((s) => s.id));

  return allSeats
    .filter((s) => seatsToEvaluate.has(s.id) && s.cards.length > 0)
    .map((s: SeatRow) => {
      const playerCards = [...(s.cards as string[]), ...communityCards];
      const handResult = solvePokerHand(playerCards);

      return {
        seatId: s.id,
        hand: handResult,
        playerCards,
      };
    });
}

// Initialize tracking structures for winnings and hand info
function initializeHandTracking(hands: EvaluatedHand[]): {
  seatWinnings: Record<string, number>;
  seatHandInfo: Record<
    string,
    { type: string; descr: string; cards: string[] }
  >;
} {
  const seatWinnings: Record<string, number> = {};
  const seatHandInfo: Record<
    string,
    { type: string; descr: string; cards: string[] }
  > = {};

  for (const handData of hands) {
    seatWinnings[handData.seatId] = 0;
    seatHandInfo[handData.seatId] = {
      type: handData.hand.name,
      descr: handData.hand.descr,
      cards: handData.hand.cards,
    };
  }

  return { seatWinnings, seatHandInfo };
}

// Detailed side pot information for UI display
type SidePotDetail = {
  potNumber: number;
  amount: number;
  betLevelRange: { min: number; max: number };
  contributors: Array<{ seatId: string; contribution: number }>;
  eligibleSeatIds: string[];
  winners: Array<{ seatId: string; amount: number }>;
};

// Calculate side pots from cumulative bets (startingBalance - buyIn)
// This ensures accuracy at showdown by recalculating from scratch
// Returns detailed information for UI display
// Exported for unit tests (orphan-layer / chip conservation cases).
export function calculateSidePotsFromCumulativeBets(
  allSeats: SeatRow[],
): SidePotDetail[] {
  // Calculate cumulative bet for each seat (what they bet total across all rounds)
  const seatCumulativeBets = new Map<string, number>();
  for (const seat of allSeats) {
    const cumulativeBet = seat.startingBalance - seat.buyIn;
    if (cumulativeBet > 0) {
      seatCumulativeBets.set(seat.id, cumulativeBet);
    }
  }

  // Get all seats that have bets (including folded)
  const seatsWithBets = Array.from(seatCumulativeBets.entries())
    .map(([seatId, bet]) => {
      const seat = allSeats.find((s) => s.id === seatId);
      if (!seat) return null;
      return { ...seat, cumulativeBet: bet };
    })
    .filter((s): s is SeatRow & { cumulativeBet: number } => s !== null);

  // Get non-folded seats (eligible to win)
  const nonFoldedSeats = seatsWithBets.filter(
    (s) => s.seatStatus !== "folded" && s.seatStatus !== "eliminated",
  );

  // Sort by cumulative bet to determine pot levels
  const sortedByBet = [...seatsWithBets].sort(
    (a, b) => a.cumulativeBet - b.cumulativeBet,
  );

  const sidePots: SidePotDetail[] = [];
  let previousBetLevel = 0;
  let potNumber = 0;
  // Layers where every contributor is folded have no eligible winner; that money must not
  // vanish — carry it into the next pot that has eligibles, or into the last such pot.
  let deadCarry = 0;

  for (let i = 0; i < sortedByBet.length; i++) {
    const currentSeat = sortedByBet[i]!;
    const currentBetLevel = currentSeat.cumulativeBet;

    if (currentBetLevel === previousBetLevel) {
      continue; // Skip if same bet level
    }

    const betIncrement = currentBetLevel - previousBetLevel;

    // Eligible seats can WIN the pot - only non-folded players who bet at least this amount
    const eligibleSeats = nonFoldedSeats.filter(
      (s) => s.cumulativeBet >= currentBetLevel,
    );

    // Calculate pot amount: betIncrement * number of ALL players who bet at least currentBetLevel
    // This includes folded players who contributed chips but can't win
    const contributingSeats = seatsWithBets.filter(
      (s) => s.cumulativeBet >= currentBetLevel,
    );
    const potAmount = betIncrement * contributingSeats.length;

    if (potAmount > 0) {
      if (eligibleSeats.length > 0) {
        const contributors = contributingSeats.map((seat) => ({
          seatId: seat.id,
          contribution: betIncrement,
        }));

        sidePots.push({
          potNumber,
          amount: potAmount + deadCarry,
          betLevelRange: {
            min: previousBetLevel,
            max: currentBetLevel,
          },
          contributors,
          eligibleSeatIds: eligibleSeats.map((s) => s.id),
          winners: [], // Will be populated after hand evaluation
        });
        potNumber++;
        deadCarry = 0;
      } else {
        deadCarry += potAmount;
      }
    }

    previousBetLevel = currentBetLevel;
  }

  if (deadCarry > 0) {
    if (sidePots.length === 0) {
      throw new Error(
        `Side pot construction: ${deadCarry} chips in layers with no eligible winner and no lower pot to absorb them.`,
      );
    }
    const last = sidePots[sidePots.length - 1]!;
    last.amount += deadCarry;
  }

  return sidePots;
}

/**
 * Order tied winners for odd-chip splits: first seat clockwise from the button,
 * then continuing around the table (standard casino / Robert's Rules style).
 */
function orderWinnersClockwiseFromButton(
  orderedSeats: SeatRow[],
  dealerButtonSeatId: string | null,
  winnerSeatIds: string[],
): string[] {
  const winnerSet = new Set(winnerSeatIds);
  const result: string[] = [];
  const n = orderedSeats.length;
  if (n === 0) return [...winnerSeatIds];
  const mapIndex: Record<string, number> = {};
  orderedSeats.forEach((s, i) => {
    mapIndex[s.id] = i;
  });
  const buttonIdx = dealerButtonSeatId
    ? (mapIndex[dealerButtonSeatId] ?? 0)
    : 0;
  for (let i = 0; i < n; i++) {
    const idx = (buttonIdx + 1 + i) % n;
    const sid = orderedSeats[idx]!.id;
    if (winnerSet.has(sid)) {
      result.push(sid);
      winnerSet.delete(sid);
    }
  }
  for (const w of winnerSeatIds) {
    if (winnerSet.has(w)) result.push(w);
  }
  return result;
}

/**
 * Split a pot among tied winners. Remainder after `floor(pot/n)` is assigned one
 * chip at a time to the first winners in `orderWinnersClockwiseFromButton` order
 * so the full pot is distributed (fixes money conservation on odd-chip splits).
 */
export function distributePotAmountAmongTiedWinners(
  potAmount: number,
  winnerSeatIds: string[],
  orderedSeats: SeatRow[],
  dealerButtonSeatId: string | null,
): Record<string, number> {
  const n = winnerSeatIds.length;
  if (n === 0) return {};
  const base = Math.floor(potAmount / n);
  const remainder = potAmount % n;
  const ordered = orderWinnersClockwiseFromButton(
    orderedSeats,
    dealerButtonSeatId,
    winnerSeatIds,
  );
  const result: Record<string, number> = {};
  for (const id of ordered) {
    result[id] = base;
  }
  for (let i = 0; i < remainder; i++) {
    const id = ordered[i]!;
    result[id] = (result[id] ?? 0) + 1;
  }
  for (const id of winnerSeatIds) {
    if (result[id] === undefined) result[id] = base;
  }
  return result;
}

// Distribute side pots to winners and populate winner information
function distributeSidePots(
  sidePots: SidePotDetail[],
  hands: EvaluatedHand[],
  seatWinnings: Record<string, number>,
  orderedSeats: SeatRow[],
  dealerButtonSeatId: string | null,
): void {
  // Create a set of contender seat IDs for fast lookup (for error messages)
  const contenderSeatIds = new Set(hands.map((h) => h.seatId));

  for (const pot of sidePots) {
    // Find eligible hands for this pot
    // Note: hands already only contains contenders, so this filter implicitly
    // excludes any players who folded after the pot was created
    const eligibleHands = hands.filter((h) =>
      pot.eligibleSeatIds.includes(h.seatId),
    );

    if (eligibleHands.length === 0) {
      // This should not happen if side pot logic is correct, but can occur if:
      // - All eligible players for a pot folded after the pot was created
      // - This would result in money being lost, which is a bug
      throw new Error(
        `No eligible contenders for side pot: pot amount=${pot.amount}, original eligibleSeatIds=[${pot.eligibleSeatIds.join(", ")}], current contenders=[${Array.from(contenderSeatIds).join(", ")}]. This indicates all eligible players folded after the pot was created, which would result in money loss.`,
      );
    }

    // Find winners among eligible players
    const eligibleHandResults = eligibleHands.map((h) => h.hand);
    const potWinners = findPokerWinners(eligibleHandResults);

    // Map winners back to seat IDs (track used indices to handle ties)
    const usedIndices = new Set<number>();
    const potWinnerSeatIds = potWinners.map((winner) => {
      const handIndex = eligibleHands.findIndex((h, idx) => {
        if (usedIndices.has(idx)) return false; // Skip already matched hands
        const winnerCards = winner.cards.sort();
        const handCards = h.hand.cards.sort();
        return (
          winnerCards.length === handCards.length &&
          winnerCards.every((card, index) => card === handCards[index])
        );
      });
      usedIndices.add(handIndex);
      return eligibleHands[handIndex]!.seatId;
    });

    const perSeat = distributePotAmountAmongTiedWinners(
      pot.amount,
      potWinnerSeatIds,
      orderedSeats,
      dealerButtonSeatId,
    );
    for (const winnerId of potWinnerSeatIds) {
      const amt = perSeat[winnerId] ?? 0;
      seatWinnings[winnerId] = (seatWinnings[winnerId] || 0) + amt;
    }

    // Populate winners in side pot detail for UI
    pot.winners = potWinnerSeatIds.map((seatId) => ({
      seatId,
      amount: perSeat[seatId] ?? 0,
    }));
  }
}

// Update seats with hand evaluation results and winnings
async function updateSeatsWithWinnings(
  tx: Tx,
  hands: EvaluatedHand[],
  seatWinnings: Record<string, number>,
  seatHandInfo: Record<
    string,
    { type: string; descr: string; cards: string[] }
  >,
): Promise<void> {
  for (const handData of hands) {
    const winAmount = seatWinnings[handData.seatId] || 0;
    const handInfo = seatHandInfo[handData.seatId]!;

    await tx
      .update(seats)
      .set({
        handType: handInfo.type,
        handDescription: handInfo.descr,
        winAmount,
        buyIn: winAmount > 0 ? sql`${seats.buyIn} + ${winAmount}` : seats.buyIn,
        winningCards: winAmount > 0 ? handInfo.cards : sql`ARRAY[]::text[]`,
      })
      .where(eq(seats.id, handData.seatId));
  }
}

// Update elimination status for players with 0 chips
async function updateEliminationStatus(tx: Tx, tableId: string): Promise<void> {
  const allSeatsAfterWinnings = await fetchAllSeatsInOrder(tx, tableId);
  for (const seat of allSeatsAfterWinnings) {
    if (seat.buyIn === 0 && seat.seatStatus !== "eliminated") {
      // Mark players with 0 chips as eliminated
      await tx
        .update(seats)
        .set({ seatStatus: "eliminated" })
        .where(eq(seats.id, seat.id));
    }
    // Note: "all-in" players who win chips will be reset to "active" by resetGame()
    // when the next game starts, so no need to change status here
  }
}

// Comprehensive diagnostic logging function - only called when conservation error detected
async function logConservationErrorDiagnostics(
  tx: Tx,
  tableId: string,
  gameId: string,
  gameObj: GameRow,
  freshSeats: SeatRow[],
  contenders: SeatRow[],
  hands: EvaluatedHand[],
  sidePots: SidePotDetail[],
  seatWinnings: Record<string, number>,
): Promise<void> {
  const finalSeats = await fetchAllSeatsInOrder(tx, tableId);
  const allGameEvents = await tx.query.gameEvents.findMany({
    where: eq(gameEvents.gameId, gameId),
    orderBy: (events, { asc }) => [asc(events.createdAt)],
  });

  logMoneyConservationDiagnosticReport({
    tableId,
    gameId,
    gameObj,
    freshSeats,
    contenders,
    finalSeats,
    allGameEvents,
    hands,
    sidePots,
    seatWinnings,
  });
}

// Validate that money is conserved: sum of startingBalance should equal sum of buyIn
async function validateMoneyConservation(
  tx: Tx,
  tableId: string,
  gameId: string,
  gameObj: GameRow,
  freshSeats: SeatRow[],
  contenders: SeatRow[],
  hands: EvaluatedHand[],
  sidePots: SidePotDetail[],
  seatWinnings: Record<string, number>,
): Promise<void> {
  // Fetch all seats after winnings are distributed to get final buyIn values
  const finalSeats = await fetchAllSeatsInOrder(tx, tableId);

  // Calculate sum of starting balances (startingBalance is set at game start and doesn't change during the game)
  const totalStartingBalance = finalSeats.reduce(
    (sum, seat) => sum + seat.startingBalance,
    0,
  );

  const totalFinalBuyIn = finalSeats.reduce((sum, seat) => sum + seat.buyIn, 0);

  // Validate that money is conserved
  if (totalStartingBalance !== totalFinalBuyIn) {
    // Log comprehensive diagnostics before throwing error
    await logConservationErrorDiagnostics(
      tx,
      tableId,
      gameId,
      gameObj,
      freshSeats,
      contenders,
      hands,
      sidePots,
      seatWinnings,
    );

    const difference = totalFinalBuyIn - totalStartingBalance;
    throw new Error(
      `Money conservation validation failed: Starting balance sum (${totalStartingBalance}) does not equal final buyIn sum (${totalFinalBuyIn}). Difference: ${difference}. This indicates money was created or destroyed during the game.`,
    );
  }
}

// Complete the showdown: evaluate hands, distribute pots, update status
async function completeShowdown(
  tx: Tx,
  tableId: string,
  gameId: string,
  updatedGame: GameRow,
  contenders: SeatRow[],
  freshSeats: SeatRow[],
): Promise<void> {
  // Evaluate hands for all contenders
  const hands = evaluateContenderHands(
    contenders,
    freshSeats,
    updatedGame.communityCards,
  );

  // Initialize tracking structures
  const { seatWinnings, seatHandInfo } = initializeHandTracking(hands);

  // Recalculate side pots from scratch at showdown using cumulative bets
  // This ensures accuracy and avoids bugs from incremental merging across rounds
  const sidePots = calculateSidePotsFromCumulativeBets(freshSeats);

  // Distribute side pots (this also populates the winners field)
  distributeSidePots(
    sidePots,
    hands,
    seatWinnings,
    freshSeats,
    updatedGame.dealerButtonSeatId,
  );

  // Store side pot details in database for UI display
  await tx
    .update(games)
    .set({
      sidePotDetails: sidePots as any,
    })
    .where(eq(games.id, gameId));

  // Update seats with winnings
  await updateSeatsWithWinnings(tx, hands, seatWinnings, seatHandInfo);

  // Update elimination status
  await updateEliminationStatus(tx, tableId);

  // Validate that money is conserved (no money creation/destruction)
  await validateMoneyConservation(
    tx,
    tableId,
    gameId,
    updatedGame,
    freshSeats,
    contenders,
    hands,
    sidePots,
    seatWinnings,
  );

  // Emit End Game event with all winners
  const allWinners = Object.entries(seatWinnings)
    .filter(([_, amount]) => amount > 0)
    .map(([seatId, amount]) => ({
      seatId,
      amount,
      handType: seatHandInfo[seatId]?.type,
      cards: seatHandInfo[seatId]?.cards,
    }));

  await logEndGame(tx as any, tableId, gameId, {
    winners: allWinners,
  });

  // Set game to showdown state (pot and side pots remain for validation)
  await tx
    .update(games)
    .set({
      state: "SHOWDOWN",
      isCompleted: true,
      turnStartTime: null, // Clear turn start time when game is completed
      // Note: potTotal is not cleared here - it remains for validation
      // It will be cleared when the next game starts
    })
    .where(eq(games.id, gameId));
}

// Betting round is finished if there is only one player left
// or if all bets are equal
export async function evaluateBettingTransition(
  tx: Tx,
  tableId: string,
  gameObj: GameRow,
): Promise<void> {
  const freshSeats = await fetchAllSeatsInOrder(tx, tableId);
  const allEqual = allActiveBetsEqual(freshSeats);
  const activeCount = activeCountOf(freshSeats);

  // Betting is finished when all active players have matched the highest bet (allEqual)
  // AND either:
  //   - All active players have acted (betCount >= requiredBetCount), OR
  //   - Only 0-1 active players remain (others are all-in/folded)
  const finished =
    allEqual &&
    (activeCount <= 1 || gameObj.betCount >= gameObj.requiredBetCount);
  if (!finished) return;

  // Merge bets into pot
  const updatedGame = await mergeBetsIntoPotGeneric(tx, gameObj, freshSeats);
  const cc = updatedGame.communityCards.length;

  // Determine non-folded players (active + all-in)
  const contenders = freshSeats.filter(
    (s: SeatRow) => s.seatStatus === "active" || s.seatStatus === "all-in",
  );
  const nonFoldedCount = contenders.length;

  // Showdown conditions:
  // 1. Only one non-folded player left (early win - everyone else folded)
  // 2. All 5 community cards dealt (normal showdown - evaluate hands)
  const shouldShowdown = nonFoldedCount === 1 || cc === 5;

  if (shouldShowdown) {
    // SHOWDOWN - evaluate hands for all non-folded players (active + all-in)
    // Only contenders can win pots; folded and eliminated players are excluded
    await completeShowdown(
      tx,
      tableId,
      updatedGame.id,
      updatedGame,
      contenders,
      freshSeats,
    );
    return;
  }
  if (cc === 0) {
    await tx
      .update(games)
      .set({
        state: "DEAL_FLOP",
        turnStartTime: null, // Clear turn start time when transitioning to dealing
      })
      .where(eq(games.id, updatedGame.id));
  }
  if (cc === 3) {
    await tx
      .update(games)
      .set({
        state: "DEAL_TURN",
        turnStartTime: null, // Clear turn start time when transitioning to dealing
      })
      .where(eq(games.id, updatedGame.id));
  }
  if (cc === 4) {
    await tx
      .update(games)
      .set({
        state: "DEAL_RIVER",
        turnStartTime: null, // Clear turn start time when transitioning to dealing
      })
      .where(eq(games.id, updatedGame.id));
  }
}
