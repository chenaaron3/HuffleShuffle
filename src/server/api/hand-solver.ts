import { eq, sql } from 'drizzle-orm';

import { games, seats } from '../db/schema';
import { logEndGame } from './game-event-logger';
import { allActiveBetsEqual, fetchAllSeatsInOrder, mergeBetsIntoPotGeneric } from './game-logic';

const { Hand: PokerHand } = require("pokersolver");

type SeatRow = typeof seats.$inferSelect;
type GameRow = typeof games.$inferSelect;

import type { db } from "../db";

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
      const rank = card.value.toUpperCase();
      const suit = card.suit.toUpperCase();
      return `${rank}${suit}`;
    }
    // Handle string format
    if (typeof card === "string" && card.length === 2) {
      // Convert from "Ad" format to "AS" format
      const rank = card[0]?.toUpperCase();
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
  const activeSeats = freshSeats.filter((s: SeatRow) => s.isActive);
  const singleActive = activeSeats.length === 1;
  const allEqual = allActiveBetsEqual(freshSeats);
  const finished =
    (gameObj.betCount >= gameObj.requiredBetCount && allEqual) || singleActive;
  if (!finished) return;

  // Merge bets into pot
  const updatedGame = await mergeBetsIntoPotGeneric(tx, gameObj, freshSeats);
  const cc = updatedGame.communityCards.length;
  if (singleActive || cc === 5) {
    // SHOWDOWN
    const contenders = freshSeats.filter((s: SeatRow) => s.isActive);

    // Evaluate each player's hand
    const hands = contenders.map((s: SeatRow) => {
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

    // Find winners using pokersolver's built-in tie-breaking
    const handResults = hands.map((h) => h.hand);
    const winners = findPokerWinners(handResults);

    // Get winner seat IDs by comparing the actual winning hand objects
    const winnerSeatIds = winners.map((winner) => {
      // Find the hand that matches this winner by comparing the actual hand data
      const handIndex = hands.findIndex((h) => {
        // Compare the actual cards that make up the winning hand
        const winnerCards = winner.cards.sort();
        const handCards = h.hand.cards.sort();

        // Check if the cards match (this handles tie-breaking correctly)
        return (
          winnerCards.length === handCards.length &&
          winnerCards.every((card, index) => card === handCards[index])
        );
      });
      return hands[handIndex]!.seatId;
    });

    // Log winner information
    console.log("Showdown results:", {
      totalPlayers: contenders.length,
      winners: winners.map((w) => ({
        handType: w.name,
        description: w.descr,
        winningCards: w.cards,
        score: w.score,
      })),
      winnerSeatIds,
    });

    // Additional debug logging for tie-breaking
    console.log(
      "Hand comparison details:",
      hands.map((h, index) => ({
        seatId: h.seatId,
        handType: h.hand.name,
        description: h.hand.descr,
        score: h.hand.score,
        winningCards: h.hand.cards,
        isWinner: winnerSeatIds.includes(h.seatId),
      })),
    );

    // Store hand evaluation results and distribute pot
    const share = Math.floor(updatedGame.potTotal / winnerSeatIds.length);

    for (const handData of hands) {
      const isWinner = winnerSeatIds.includes(handData.seatId);
      await tx
        .update(seats)
        .set({
          handType: handData.hand.name,
          handDescription: handData.hand.descr,
          winAmount: isWinner ? share : 0,
          buyIn: isWinner ? sql`${seats.buyIn} + ${share}` : seats.buyIn,
          winningCards: isWinner ? handData.hand.cards : sql`ARRAY[]::text[]`,
        })
        .where(eq(seats.id, handData.seatId));
    }

    // Emit End Game event with winners
    await logEndGame(tx as any, tableId, updatedGame.id, {
      winners: winnerSeatIds.map((sid, i) => ({
        seatId: sid,
        amount: share,
        handType: winners[i % winners.length]?.name,
        cards: winners[i % winners.length]?.cards,
      })),
    });

    // Set game to showdown state
    await tx
      .update(games)
      .set({
        state: "SHOWDOWN",
        isCompleted: true,
      })
      .where(eq(games.id, updatedGame.id));
    return;
  }
  if (cc === 0) {
    await tx
      .update(games)
      .set({ state: "DEAL_FLOP" })
      .where(eq(games.id, updatedGame.id));
  }
  if (cc === 3) {
    await tx
      .update(games)
      .set({ state: "DEAL_TURN" })
      .where(eq(games.id, updatedGame.id));
  }
  if (cc === 4) {
    await tx
      .update(games)
      .set({ state: "DEAL_RIVER" })
      .where(eq(games.id, updatedGame.id));
  }
}
