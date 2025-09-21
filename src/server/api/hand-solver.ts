import { eq, sql } from 'drizzle-orm';
// Use the poker-hand-evaluator library
import * as PokerHand from 'poker-hand-evaluator';

import { games, seats } from '../db/schema';
import { allActiveBetsEqual, fetchOrderedSeats, mergeBetsIntoPotGeneric } from './game-logic';

type SeatRow = typeof seats.$inferSelect;
type GameRow = typeof games.$inferSelect;

import type { db } from "../db";
interface PokerHandStatic {
  solve(cards: string[]): unknown;
  winners(hands: unknown[]): unknown[];
}

// Create a compatibility layer for the poker-hand-evaluator library
const Hand: PokerHandStatic = {
  solve(cards: string[]) {
    // Convert card format and create PokerHand instance
    // poker-hand-evaluator expects cards in format like ['AS', 'KH', 'QD', 'JC', '10S']
    const pokerHand = new PokerHand(cards);
    return {
      score: pokerHand.getScore(),
      rank: pokerHand.getRank(),
      description: pokerHand.describe(),
    };
  },
  winners(hands: unknown[]) {
    // Implement winner logic using the new library
    // This is a simplified version - you can expand as needed
    if (hands.length === 0) return [];

    // Find the hand with the highest score
    let bestHand = hands[0];
    let bestScore = (bestHand as any)?.score || 0;

    for (let i = 1; i < hands.length; i++) {
      const currentScore = (hands[i] as any)?.score || 0;
      if (currentScore > bestScore) {
        bestHand = hands[i];
        bestScore = currentScore;
      }
    }

    return [bestHand];
  },
};

export async function evaluateBettingTransition(
  tx: { query: typeof db.query; update: typeof db.update },
  tableId: string,
  gameObj: GameRow,
): Promise<void> {
  const freshSeats = await fetchOrderedSeats(tx, tableId);
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
    const hands = contenders.map((s: SeatRow) =>
      Hand.solve([...(s.cards as string[]), ...updatedGame.communityCards]),
    ) as unknown[];
    const winners = Hand.winners(hands) as unknown[];
    const winnerSeatIds = winners.map((w) => {
      const idx = (hands as unknown[]).indexOf(w);
      return contenders[idx]!.id;
    });
    const share = Math.floor(updatedGame.potTotal / winnerSeatIds.length);
    for (const sid of winnerSeatIds) {
      await tx
        .update(seats)
        .set({ buyIn: sql`${seats.buyIn} + ${share}` })
        .where(eq(seats.id, sid));
    }
    await tx
      .update(games)
      .set({ state: "SHOWDOWN", isCompleted: true })
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
