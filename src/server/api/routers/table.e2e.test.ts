import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createCaller } from '~/server/api/root';
import { db } from '~/server/db';
import { games, pokerTables, seats, users } from '~/server/db/schema';

describe("table e2e flow", () => {
  const dealerId = "dealer-vitest";
  const playerAId = "playerA-vitest";
  const playerBId = "playerB-vitest";

  const dealerCaller = createCaller({
    session: {
      user: { id: dealerId, role: "dealer" as const },
      expires: new Date().toISOString(),
    },
    db,
  } as any);
  const playerACaller = createCaller({
    session: {
      user: { id: playerAId, role: "player" as const },
      expires: new Date().toISOString(),
    },
    db,
  } as any);
  const playerBCaller = createCaller({
    session: {
      user: { id: playerBId, role: "player" as const },
      expires: new Date().toISOString(),
    },
    db,
  } as any);

  const playerCId = "playerC-vitest";
  const playerCCaller = createCaller({
    session: {
      user: { id: playerCId, role: "player" as const },
      expires: new Date().toISOString(),
    },
    db,
  } as any);

  const cleanup = async () => {
    // Remove any tables created by this dealer (and related entities) in correct FK order
    const tables = await db.query.pokerTables.findMany({
      where: eq(pokerTables.dealerId, dealerId),
    });
    for (const t of tables) {
      await db.delete(games).where(eq(games.tableId, t.id));
      await db.delete(seats).where(eq(seats.tableId, t.id));
      await db.delete(pokerTables).where(eq(pokerTables.id, t.id));
    }
  };

  beforeAll(async () => {
    await db
      .insert(users)
      .values([
        { id: dealerId, email: "d@vitest.local", role: "dealer", balance: 0 },
        {
          id: playerAId,
          email: "a@vitest.local",
          role: "player",
          balance: 1000,
        },
        {
          id: playerBId,
          email: "b@vitest.local",
          role: "player",
          balance: 1000,
        },
      ])
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    await cleanup();
    // Upsert users to refresh balances/roles each test
    await db
      .insert(users)
      .values([
        { id: dealerId, email: "d@vitest.local", role: "dealer", balance: 0 },
        {
          id: playerAId,
          email: "a@vitest.local",
          role: "player",
          balance: 1000,
        },
        {
          id: playerBId,
          email: "b@vitest.local",
          role: "player",
          balance: 1000,
        },
        {
          id: playerCId,
          email: "c@vitest.local",
          role: "player",
          balance: 1000,
        },
      ])
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: sql`EXCLUDED.email`,
          role: sql`EXCLUDED.role`,
          balance: sql`EXCLUDED.balance`,
        },
      });
  });

  afterEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  it("creates table, joins, plays through all states, and resets", async () => {
    let tableId = "";
    try {
      const res = await dealerCaller.table.create({
        name: "Vitest",
        smallBlind: 5,
        bigBlind: 10,
      });
      tableId = res.tableId;
      expect(tableId).toBeTypeOf("string");

      await playerACaller.table.join({ tableId, buyIn: 200 });
      await playerBCaller.table.join({ tableId, buyIn: 200 });

      let snap = await dealerCaller.table.action({
        tableId,
        action: "START_GAME",
      });
      expect(snap.game?.state).toBe("DEAL_HOLE_CARDS");

      // Deal hole cards
      await dealerCaller.table.action({
        tableId,
        action: "DEAL_CARD",
        params: { rank: "A", suit: "s" },
      });
      await dealerCaller.table.action({
        tableId,
        action: "DEAL_CARD",
        params: { rank: "K", suit: "s" },
      });
      await dealerCaller.table.action({
        tableId,
        action: "DEAL_CARD",
        params: { rank: "Q", suit: "s" },
      });
      snap = await dealerCaller.table.action({
        tableId,
        action: "DEAL_CARD",
        params: { rank: "J", suit: "s" },
      });
      // Ensure exactly 2 hole cards per seat, no over-deal
      const holeSeats = await db.query.seats.findMany({
        where: eq(seats.tableId, tableId),
      });
      for (const s of holeSeats) {
        expect(s.cards.length).toBe(2);
      }
      expect(snap.game?.state).toBe("BETTING");

      // Minimal betting round (two checks)
      const order = await db.query.seats.findMany({
        where: eq(seats.tableId, tableId),
        orderBy: (s, { asc }) => [asc(s.seatNumber)],
      });
      const firstActor = snap.game?.assignedSeatId!;
      const firstActorUser = order.find((s) => s.id === firstActor)!.playerId;
      const firstCaller =
        firstActorUser === playerAId ? playerACaller : playerBCaller;
      const secondCaller =
        firstActorUser === playerAId ? playerBCaller : playerACaller;
      await firstCaller.table.action({ tableId, action: "CHECK" });
      snap = await secondCaller.table.action({ tableId, action: "CHECK" });
      expect(["DEAL_FLOP", "BETTING"]).toContain(snap.game?.state as string);

      // Flop
      await dealerCaller.table.action({
        tableId,
        action: "DEAL_CARD",
        params: { rank: "2", suit: "h" },
      });
      await dealerCaller.table.action({
        tableId,
        action: "DEAL_CARD",
        params: { rank: "3", suit: "h" },
      });
      snap = await dealerCaller.table.action({
        tableId,
        action: "DEAL_CARD",
        params: { rank: "4", suit: "h" },
      });
      // Ensure community has exactly 3 cards on flop
      expect((snap.game?.communityCards ?? []).length).toBe(3);
      expect(snap.game?.state).toBe("BETTING");

      await firstCaller.table.action({ tableId, action: "CHECK" });
      snap = await secondCaller.table.action({ tableId, action: "CHECK" });
      expect(["DEAL_TURN", "BETTING"]).toContain(snap.game?.state as string);

      // Turn
      snap = await dealerCaller.table.action({
        tableId,
        action: "DEAL_CARD",
        params: { rank: "5", suit: "h" },
      });
      expect((snap.game?.communityCards ?? []).length).toBe(4);
      expect(snap.game?.state).toBe("BETTING");
      await firstCaller.table.action({ tableId, action: "CHECK" });
      snap = await secondCaller.table.action({ tableId, action: "CHECK" });
      expect(["DEAL_RIVER", "BETTING"]).toContain(snap.game?.state as string);

      // River
      snap = await dealerCaller.table.action({
        tableId,
        action: "DEAL_CARD",
        params: { rank: "6", suit: "h" },
      });
      expect((snap.game?.communityCards ?? []).length).toBe(5);
      expect(snap.game?.state).toBe("BETTING");
      await firstCaller.table.action({ tableId, action: "CHECK" });
      snap = await secondCaller.table.action({ tableId, action: "CHECK" });
      expect(["SHOWDOWN", "BETTING"]).toContain(snap.game?.state as string);

      // Reset table -> completes game and creates new one
      snap = await dealerCaller.table.action({
        tableId,
        action: "RESET_TABLE",
      });
      expect(snap.game?.state).toBe("DEAL_HOLE_CARDS");
    } finally {
      await cleanup();
    }
  });

  it("betting round supports raises and folds", async () => {
    let tableId = "";
    try {
      const SMALL_BLIND = 5;
      const BIG_BLIND = 10;
      const BUY_IN = 300;
      // Create a table with 3 players
      const res = await dealerCaller.table.create({
        name: "Vitest-RF",
        smallBlind: SMALL_BLIND,
        bigBlind: BIG_BLIND,
      });
      tableId = res.tableId;

      const playerASeat = await playerACaller.table.join({
        tableId,
        buyIn: BUY_IN,
      });
      const playerBSeat = await playerBCaller.table.join({
        tableId,
        buyIn: BUY_IN,
      });
      const playerCSeat = await playerCCaller.table.join({
        tableId,
        buyIn: BUY_IN,
      });

      // Dealer starts the game, expects the dealer button to be the first player
      let snap = await dealerCaller.table.action({
        tableId,
        action: "START_GAME",
      });
      expect(snap.game).not.toBeNull();
      expect(snap.game?.dealerButtonSeatId).toBe(playerASeat.seatId);
      expect(snap.seats[1]?.currentBet).toBe(SMALL_BLIND);
      expect(snap.seats[2]?.currentBet).toBe(BIG_BLIND);
      expect(snap.game?.state).toBe("DEAL_HOLE_CARDS");

      // Dealer deals cards to players
      const hole: Array<[string, string]> = [
        ["A", "s"],
        ["K", "s"],
        ["Q", "s"],
        ["J", "s"],
        ["T", "s"],
        ["9", "s"],
      ];
      for (const [rank, suit] of hole) {
        snap = await dealerCaller.table.action({
          tableId,
          action: "DEAL_CARD",
          params: { rank, suit },
        });
      }
      // Try to deal another card and expect it fails
      await expect(
        dealerCaller.table.action({
          tableId,
          action: "DEAL_CARD",
          params: { rank: "8", suit: "s" },
        }),
      ).rejects.toThrowError();
      // Validate each player has exactly 2 cards in their hand
      snap.seats.forEach((s) => {
        expect(s.cards.length).toBe(2);
      });
      expect(snap.game?.state).toBe("BETTING");

      // Player A is the first better, since they are after big blind
      const callers: (typeof playerACaller)[] = [
        playerACaller,
        playerBCaller,
        playerCCaller,
      ];

      const bets = [
        // Player A raises to 50
        {
          action: "RAISE",
          params: { amount: 50 },
          expectedMaxBet: 50,
        },
        // Player B checks
        {
          action: "CHECK",
          params: {},
          expectedMaxBet: 50,
        },
        // Player C raises to 150
        {
          action: "RAISE",
          params: { amount: 150 },
          expectedMaxBet: 150,
        },
        // Player A Checks
        {
          action: "CHECK",
          params: {},
          expectedMaxBet: 150,
        },
        // Player B folds, betting round ends
        {
          action: "FOLD",
          params: {},
          expectedMaxBet: 0,
        },
      ];

      let betterIdx = 0;
      for (const bet of bets) {
        snap = await (callers[betterIdx] as any).table.action({
          tableId,
          action: bet.action,
          params: bet.params,
        });
        // Check the max bet is correct
        const maxBet = snap.seats.reduce(
          (max, s) => Math.max(max, s.currentBet),
          0,
        );
        expect(maxBet).toBe(bet.expectedMaxBet);
        betterIdx = (betterIdx + 1) % callers.length;
      }

      // Trying to bet again should fail
      await expect(
        playerACaller.table.action({
          tableId,
          action: "RAISE",
          params: { amount: 50 },
        }),
      ).rejects.toThrowError();

      // Should move to FLOP and pot be 350 (A and C 150 each, B checked at 50)
      expect(snap.game?.state).toBe("DEAL_FLOP");
      expect(snap.game?.potTotal).toBe(350);

      const finalSeats = await db.query.seats.findMany({
        where: eq(seats.tableId, tableId),
      });
      const spent = finalSeats.map((s) => BUY_IN - s.buyIn);
      // Expect two players spent 50 each, one spent 0
      const spentCount = spent.reduce(
        (acc, v) => ((acc[v] = (acc[v] ?? 0) + 1), acc),
        {} as Record<number, number>,
      );
      expect(spentCount[150]).toBe(2);
      expect(spentCount[50]).toBe(1);
    } finally {
      await cleanup();
    }
  });
});
