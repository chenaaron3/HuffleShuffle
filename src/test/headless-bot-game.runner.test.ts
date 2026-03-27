import { beforeEach, describe, expect, it } from 'vitest';
import {
  cleanupHeadlessTablesForDealer,
  resolveHeadlessActionLogFromEnv,
  runManyBotHands,
  setupHeadlessBotTable,
} from "~/test/headless-bot-game";

const dealerId = "headless-bot-runner-vitest";

describe("headless bot game runner", () => {
  beforeEach(async () => {
    await cleanupHeadlessTablesForDealer(dealerId);
  });

  it("runs multiple random hands with API-only bots (no client)", async () => {
    expect(process.env.NODE_ENV).toBe("test");

    // Any rejection or thrown Error fails the test (tRPC, dealCard, hand-solver money conservation, etc.).
    const numHands = Number(process.env.HEADLESS_BOT_HANDS ?? "5000");
    const buyIn = 20000;
    const numBots = 8;
    const { tableId, dealerCaller } = await setupHeadlessBotTable({
      dealerId,
      numBots,
      smallBlind: 5,
      bigBlind: 10,
      buyIn,
    });

    await runManyBotHands(dealerCaller, tableId, {
      numHands,
      replenish: { numBots, buyIn },
      actionLogPath: resolveHeadlessActionLogFromEnv(),
    });
  });
});
