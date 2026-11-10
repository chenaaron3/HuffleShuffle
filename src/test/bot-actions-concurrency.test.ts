import { and, asc, eq, inArray } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { triggerBotActions } from "~/server/api/game/hand-lifecycle";
import { db } from "~/server/db";
import { gameEvents } from "~/server/db/schema";
import {
  cleanupHeadlessTablesForDealer,
  freshShuffledDeck,
  getLatestGame,
  setupHeadlessBotTable,
} from "~/test/headless-bot-game";

const dealerId = "bot-actions-concurrency-vitest";

/** Run `fn` with the in-request bot trigger disabled (table.action calls it). */
async function withoutInlineBots<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.BOT_ACTION_MAX_ITERATIONS;
  process.env.BOT_ACTION_MAX_ITERATIONS = "0";
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.BOT_ACTION_MAX_ITERATIONS;
    else process.env.BOT_ACTION_MAX_ITERATIONS = prev;
  }
}

describe("triggerBotActions concurrency", () => {
  // Bot users are shared across tests (one seat per player), so always free them.
  const cleanup = () => cleanupHeadlessTablesForDealer(dealerId);
  beforeEach(cleanup);
  afterEach(cleanup);

  it("never lets a bot act twice when two triggers race (API + Lambda)", async () => {
    const { tableId, dealerCaller } = await setupHeadlessBotTable({
      dealerId,
      numBots: 4,
      smallBlind: 5,
      bigBlind: 10,
      buyIn: 1000,
    });

    // Reach the first BETTING round without any bot acting yet.
    const deck = freshShuffledDeck();
    await withoutInlineBots(async () => {
      await dealerCaller.table.action({ tableId, action: "START_GAME" });
      while ((await getLatestGame(tableId))?.state === "DEAL_HOLE_CARDS") {
        const card = deck.shift()!;
        await dealerCaller.table.action({
          tableId,
          action: "DEAL_CARD",
          params: { rank: card.slice(0, -1), suit: card.slice(-1) },
        });
      }
    });
    const game = await getLatestGame(tableId);
    expect(game?.state).toBe("BETTING");

    // Two triggers at once, as when the API and the scan Lambda both fire.
    await Promise.all([
      triggerBotActions(db, tableId),
      triggerBotActions(db, tableId),
    ]);

    const actions = await db.query.gameEvents.findMany({
      where: and(
        eq(gameEvents.gameId, game!.id),
        inArray(gameEvents.type, ["RAISE", "CALL", "CHECK", "FOLD"]),
      ),
      orderBy: [asc(gameEvents.id)],
    });
    expect(actions.length).toBeGreaterThan(0);

    // Turn always passes to another seat, so a repeat means an out-of-turn action.
    const seatIds = actions.map((e) => (e.details as { seatId: string }).seatId);
    for (let i = 1; i < seatIds.length; i++) {
      expect(seatIds[i], `action #${i} repeated seat ${seatIds[i]}`).not.toBe(
        seatIds[i - 1],
      );
    }
  });
});
