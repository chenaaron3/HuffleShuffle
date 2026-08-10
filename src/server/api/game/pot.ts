import { eq, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { games, seats } from "~/server/db/schema";

type SeatRow = typeof seats.$inferSelect;
type GameRow = typeof games.$inferSelect;

type Tx = {
  insert: typeof db.insert;
  query: typeof db.query;
  update: typeof db.update;
};

export async function mergeBetsIntoPotGeneric(
  tx: Tx,
  gameObj: GameRow,
  orderedSeats: Array<SeatRow>,
): Promise<GameRow> {
  // Calculate total bets
  const total = orderedSeats.reduce((sum, s) => sum + s.currentBet, 0);

  // NOTE: Side pots are recalculated from scratch at showdown using cumulative bets
  // (startingBalance - buyIn), so we don't need to track them incrementally here.
  // We just clear them and let the showdown logic recalculate them accurately.

  // Update game with new pot total
  // Note: Side pots are recalculated from scratch at showdown, not stored in DB
  await tx
    .update(games)
    .set({
      potTotal: sql`${games.potTotal} + ${total}`,
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
    betCount: 0,
    requiredBetCount: 0,
  };
}
