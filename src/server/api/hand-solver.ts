import { eq, sql } from 'drizzle-orm';
import { logEndGame } from '~/server/api/game-event-logger';
import { games, seats } from '~/server/db/schema';

import {
    activeCountOf, allActiveBetsEqual, fetchAllSeatsInOrder, mergeBetsIntoPotGeneric
} from './game-utils';

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

  // Get side pots to determine all eligible players (including eliminated ones)
  const sidePots =
    (updatedGame.sidePots as Array<{
      amount: number;
      eligibleSeatIds: string[];
    }>) || [];

  // Collect all seat IDs eligible for any side pot
  const allEligibleSeatIds = new Set<string>();
  for (const pot of sidePots) {
    for (const seatId of pot.eligibleSeatIds) {
      allEligibleSeatIds.add(seatId);
    }
  }

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
    // SHOWDOWN - evaluate hands for:
    // 1. All non-folded players (active + all-in) - for main pot/early wins
    // 2. All players eligible for side pots (even if eliminated) - to ensure side pots are distributed

    // Build set of seats to evaluate: contenders + any eligible eliminated players
    const seatsToEvaluate = new Set(contenders.map((s) => s.id));
    for (const seatId of allEligibleSeatIds) {
      seatsToEvaluate.add(seatId);
    }

    // Evaluate each player's hand (including eliminated players eligible for side pots)
    const hands = freshSeats
      .filter((s) => seatsToEvaluate.has(s.id) && s.cards.length > 0)
      .map((s: SeatRow) => {
        const playerCards = [
          ...(s.cards as string[]),
          ...updatedGame.communityCards,
        ];
        const handResult = solvePokerHand(playerCards);

        // Log hand evaluation for debugging
        console.log(`Player ${s.id} hand:`, {
          cards: playerCards,
          handType: handResult.name,
          description: handResult.descr,
          winningCards: handResult.cards,
          score: handResult.score,
        });

        return {
          seatId: s.id,
          hand: handResult,
          playerCards,
        };
      });

    // Track total winnings per seat
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

    // Distribute each side pot to the best hand among eligible players
    console.log("Distributing side pots:", sidePots);

    for (const pot of sidePots) {
      // Find eligible hands for this pot
      const eligibleHands = hands.filter((h) =>
        pot.eligibleSeatIds.includes(h.seatId),
      );

      if (eligibleHands.length === 0) {
        console.warn("No eligible players for pot:", pot);
        continue;
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

      // Split pot among winners
      const potShare = Math.floor(pot.amount / potWinnerSeatIds.length);
      for (const winnerId of potWinnerSeatIds) {
        seatWinnings[winnerId] = (seatWinnings[winnerId] || 0) + potShare;
      }

      console.log(
        `Pot of ${pot.amount} won by:`,
        potWinnerSeatIds,
        `(${potShare} each)`,
      );
    }

    // Store hand evaluation results and distribute winnings
    for (const handData of hands) {
      const winAmount = seatWinnings[handData.seatId] || 0;
      const handInfo = seatHandInfo[handData.seatId]!;
      await tx
        .update(seats)
        .set({
          handType: handInfo.type,
          handDescription: handInfo.descr,
          winAmount,
          buyIn:
            winAmount > 0 ? sql`${seats.buyIn} + ${winAmount}` : seats.buyIn,
          winningCards: winAmount > 0 ? handInfo.cards : sql`ARRAY[]::text[]`,
        })
        .where(eq(seats.id, handData.seatId));
    }

    // Update elimination status after winnings are distributed
    const allSeatsAfterWinnings = await fetchAllSeatsInOrder(tx, tableId);
    for (const seat of allSeatsAfterWinnings) {
      if (seat.buyIn === 0 && seat.seatStatus !== "eliminated") {
        // Mark players with 0 chips as eliminated
        await tx
          .update(seats)
          .set({ seatStatus: "eliminated" })
          .where(eq(seats.id, seat.id));
        console.log(`Player ${seat.id} eliminated (0 chips remaining)`);
      }
      // Note: "all-in" players who win chips will be reset to "active" by resetGame()
      // when the next game starts, so no need to change status here
    }

    // Emit End Game event with all winners
    const allWinners = Object.entries(seatWinnings)
      .filter(([_, amount]) => amount > 0)
      .map(([seatId, amount]) => ({
        seatId,
        amount,
        handType: seatHandInfo[seatId]?.type,
        cards: seatHandInfo[seatId]?.cards,
      }));

    await logEndGame(tx as any, tableId, updatedGame.id, {
      winners: allWinners,
    });

    // Set game to showdown state and clear pot (all chips have been distributed)
    await tx
      .update(games)
      .set({
        state: "SHOWDOWN",
        isCompleted: true,
        turnStartTime: null, // Clear turn start time when game is completed
        potTotal: 0, // Clear pot after distribution
        sidePots: sql`'[]'::jsonb`, // Clear side pots after distribution
      })
      .where(eq(games.id, updatedGame.id));
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
