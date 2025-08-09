import { and, eq, sql } from 'drizzle-orm';
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
      expect(snap.game?.state).toBe("BETTING");
      await firstCaller.table.action({ tableId, action: "CHECK" });
      snap = await secondCaller.table.action({ tableId, action: "CHECK" });
      expect(["SHOWDOWN", "BETTING"]).toContain(snap.game?.state as string);

      // Reset table -> completes game and creates new one
      snap = await dealerCaller.table.action({
        tableId,
        action: "RESET_TABLE",
      });
      expect(snap.game?.state).toBe("GAME_START");
    } finally {
      await cleanup();
    }
  });

  it("betting round supports raises and folds", async () => {
    let tableId = "";
    try {
      const res = await dealerCaller.table.create({
        name: "Vitest-RF",
        smallBlind: 5,
        bigBlind: 10,
      });
      tableId = res.tableId;

      await playerACaller.table.join({ tableId, buyIn: 300 });
      await playerBCaller.table.join({ tableId, buyIn: 300 });
      await playerCCaller.table.join({ tableId, buyIn: 300 });

      let snap = await dealerCaller.table.action({
        tableId,
        action: "START_GAME",
      });
      expect(snap.game?.state).toBe("DEAL_HOLE_CARDS");

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
      expect(snap.game?.state).toBe("BETTING");

      const seatsOrdered = await db.query.seats.findMany({
        where: eq(seats.tableId, tableId),
        orderBy: (s, { asc }) => [asc(s.seatNumber)],
      });
      const seatMap = new Map(seatsOrdered.map((s) => [s.id, s]));
      const firstSeatId = snap.game?.assignedSeatId as string;
      expect(firstSeatId).toBeTypeOf("string");
      const firstSeat = seatMap.get(firstSeatId!);
      expect(firstSeat).toBeTruthy();
      const firstUserId = (firstSeat as any).playerId as string;

      const callers: Record<string, typeof playerACaller> = {
        [playerAId]: playerACaller,
        [playerBId]: playerBCaller,
        [playerCId]: playerCCaller,
      } as any;

      // 1) First actor raises 50
      const amount = 50;
      snap = await (callers[firstUserId] as any).table.action({
        tableId,
        action: "RAISE",
        params: { amount },
      });
      // 2) Next actor calls
      const secondSeatId = snap.game?.assignedSeatId as string;
      expect(secondSeatId).toBeTypeOf("string");
      const secondSeat = seatMap.get(secondSeatId!);
      expect(secondSeat).toBeTruthy();
      const secondUserId = (secondSeat as any).playerId as string;
      snap = await (callers[secondUserId] as any).table.action({
        tableId,
        action: "CHECK",
      });
      // 3) Next actor folds
      const thirdSeatId = snap.game?.assignedSeatId as string;
      expect(thirdSeatId).toBeTypeOf("string");
      const thirdSeat = seatMap.get(thirdSeatId!);
      expect(thirdSeat).toBeTruthy();
      const thirdUserId = (thirdSeat as any).playerId as string;
      snap = await (callers[thirdUserId] as any).table.action({
        tableId,
        action: "FOLD",
      });

      // Should move to FLOP and pot be 100 (raise + call)
      expect(snap.game?.state).toBe("DEAL_FLOP");
      expect(snap.game?.potTotal).toBe(100);

      const finalSeats = await db.query.seats.findMany({
        where: eq(seats.tableId, tableId),
      });
      const startBuyIn = 300;
      const spent = finalSeats.map((s) => startBuyIn - s.buyIn);
      // Expect two players spent 50 each, one spent 0
      const spentCount = spent.reduce(
        (acc, v) => ((acc[v] = (acc[v] ?? 0) + 1), acc),
        {} as Record<number, number>,
      );
      expect(spentCount[50]).toBe(2);
      expect(spentCount[0]).toBe(1);
    } finally {
      await cleanup();
    }
  });
});
