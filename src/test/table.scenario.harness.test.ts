import { and, desc, eq, sql } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createCaller } from '~/server/api/root';
import { db } from '~/server/db';
import { gameEvents, games, piDevices, pokerTables, seats, users } from '~/server/db/schema';

import type { Scenario, Step, PlayerKey } from "~/test/scenario.types";

const publicKey = `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyVsuzIuAr7TYmbOtLrAp\nr6rmZBQrgMiXF0apTg7rvvSwa8JfUrZ0wXBHLx5VgpyHWNq0vFUwah7FgkpdGFQ0\nwWqRiwYWU6DG3S0sxWSYwfOiRTTLnnLPcUN3SzJjbJ5gnh7V7ukx5mpsm0dPHSiB\nREg4PNvbOo9suK4eIFKmRCgRdwNskA0pgaBi3PMfOLY+FbyTzlbs4xaQom2RMPt+\n1yD6mEACuOKzHQQP8Ve4ikkR4TdcYrnApUbfGa44xloA4fv500ez1hlBfRZ2ekow\npynGBufiP7koxSK4Nt8TRAVvuS8zZYrtGyboIZvObx6mm2YS6j7T9n0pEACpO2rT\nrwIDAQAB\n-----END PUBLIC KEY-----`;

describe("table scenario harness", () => {
  // Use unique IDs to avoid collisions with existing e2e tests running in parallel
  const dealerId = "dealer-scenario-vitest";
  const playerIds: Record<PlayerKey, string> = {
    player1: "player1-scenario-vitest",
    player2: "player2-scenario-vitest",
    player3: "player3-scenario-vitest",
    player4: "player4-scenario-vitest",
    player5: "player5-scenario-vitest",
    player6: "player6-scenario-vitest",
    player7: "player7-scenario-vitest",
    player8: "player8-scenario-vitest",
  };

  const SMALL_BLIND = 5;
  const BIG_BLIND = 10;
  const BUY_IN = 300;

  const dealerCaller = createCaller({
    session: {
      user: { id: dealerId, role: "dealer" as const },
      expires: new Date().toISOString(),
    },
    db,
  } as any);
  const playerCallers: Record<PlayerKey, any> = Object.fromEntries(
    (Object.keys(playerIds) as PlayerKey[]).map((k) => [
      k,
      createCaller({
        session: {
          user: { id: playerIds[k], role: "player" as const },
          expires: new Date().toISOString(),
        },
        db,
      } as any),
    ]),
  ) as Record<PlayerKey, any>;

  let tableId = "";

  const cleanup = async () => {
    const tables = await db.query.pokerTables.findMany({
      where: eq(pokerTables.dealerId, dealerId),
    });
    for (const t of tables) {
      await db.delete(gameEvents).where(eq(gameEvents.tableId, t.id));
      await db.delete(games).where(eq(games.tableId, t.id));
      await db.delete(seats).where(eq(seats.tableId, t.id));
      await db.delete(piDevices).where(eq(piDevices.tableId, t.id));
      await db.delete(pokerTables).where(eq(pokerTables.id, t.id));
    }
  };

  beforeEach(async () => {
    await cleanup();
    await db
      .insert(users)
      .values([
        {
          id: dealerId,
          email: "dealer@vitest.local",
          role: "dealer",
          balance: 0,
          name: "Dealer",
        },
        ...(Object.keys(playerIds) as PlayerKey[]).map((k, i) => ({
          id: playerIds[k],
          email: `${k}@vitest.local`,
          role: "player" as const,
          balance: 1000,
          name: `${i + 1}`,
        })),
      ])
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: sql`EXCLUDED.email`,
          role: sql`EXCLUDED.role`,
          balance: sql`EXCLUDED.balance`,
          name: sql`EXCLUDED.name`,
        },
      });

    const res = await dealerCaller.table.create({
      name: "Scenario Harness",
      smallBlind: SMALL_BLIND,
      bigBlind: BIG_BLIND,
      maxSeats: 8,
    });
    tableId = res.tableId;
    // Seed Pi devices for card seats 0..7 with a public key so joins can encrypt nonce
    const cardPis = Array.from({ length: 8 }, (_, i) => ({
      serial: `${tableId}-card-${i}`,
      tableId,
      type: "card" as const,
      seatNumber: i,
      publicKey,
    }));
    await db.insert(piDevices).values(cardPis);
  });

  const callers: Record<"dealer" | PlayerKey, any> = {
    dealer: dealerCaller,
    ...playerCallers,
  };

  async function executeStep(step: Step) {
    console.log("Executing step:", step);
    if (step.type === "deal_hole") {
      // Validate table and state
      const table = await db.query.pokerTables.findFirst({
        where: eq(pokerTables.id, tableId),
        with: {
          games: { orderBy: (g, { desc }) => [desc(g.createdAt)], limit: 1 },
          seats: { orderBy: (s, { asc }) => [asc(s.seatNumber)] },
        },
      });
      if (!table) throw new Error("Table not found");

      // Ensure players joined and build seat order of PlayerKeys
      const idMap = playerIds as Record<PlayerKey, string>;
      const userIdToKey: Record<string, PlayerKey> = Object.fromEntries(
        (Object.keys(idMap) as PlayerKey[]).map((k) => [idMap[k], k]),
      ) as Record<string, PlayerKey>;
      const seatOrderKeys: PlayerKey[] = table.seats.map((s) => {
        const key = userIdToKey[s.playerId];
        if (!key) throw new Error("Seat has unknown player id");
        return key;
      });

      // Deal in proper rotation: first a round of one card to each seat, then second round
      for (let round = 0; round < 2; round++) {
        for (const key of seatOrderKeys) {
          const pair = step.hole[key] as [string, string];
          const card = pair[round]!;
          await callers.dealer.table.action({
            tableId,
            action: "DEAL_CARD",
            params: { rank: card[0] as any, suit: card[1] as any },
          });
        }
      }
      return;
    }
    if (step.type === "join") {
      for (const p of step.players) {
        await callers[p].table.join({
          tableId,
          buyIn: BUY_IN,
          userPublicKey: publicKey,
        });
      }
      return;
    }
    if (step.type === "action") {
      if (step.isError) {
        await expect(
          callers[step.by].table.action({
            tableId,
            action: step.action,
            params: step.params as any,
          }),
        ).rejects.toThrowError();
      } else {
        await callers[step.by].table.action({
          tableId,
          action: step.action,
          params: step.params as any,
        });
      }
      return;
    }

    // validate step
    if (step.game) {
      const game = await db.query.games.findFirst({
        where: eq(games.tableId, tableId),
        orderBy: (g, { desc }) => [desc(g.createdAt)],
      });
      expect(game).toBeTruthy();
      for (const [k, v] of Object.entries(step.game)) {
        expect((game as any)?.[k]).toStrictEqual(v);
      }
    }
    if (step.table) {
      const table = await db.query.pokerTables.findFirst({
        where: eq(pokerTables.id, tableId),
      });
      expect(table).toBeTruthy();
      for (const [k, v] of Object.entries(step.table)) {
        expect((table as any)?.[k]).toStrictEqual(v);
      }
    }
    if (step.seats) {
      const all = await db.query.seats.findMany({
        where: eq(seats.tableId, tableId),
      });
      const mapByPlayer: Record<string, (typeof all)[number]> = {};
      for (const s of all) mapByPlayer[s.playerId] = s;

      const idMap = playerIds;
      for (const key of Object.keys(step.seats) as PlayerKey[]) {
        const subset = (step.seats as any)[key];
        if (!subset) continue;
        const seat = mapByPlayer[idMap[key]];
        if (!seat) throw new Error(`Seat missing for ${key}`);
        for (const [k, v] of Object.entries(subset)) {
          expect((seat as any)?.[k]).toStrictEqual(v);
        }
      }
    }
  }

  // Load scenarios via Vite glob import
  const scenarioModules = (import.meta as any).glob(
    "./table.scenarios/**/*.ts",
    { eager: true },
  ) as Record<string, any>;
  const scenarios: Scenario[] = [];
  for (const mod of Object.values(scenarioModules)) {
    const payload = (mod as any).default ?? mod;
    if (Array.isArray(payload)) scenarios.push(...payload);
    else scenarios.push(payload);
  }

  for (const sc of scenarios) {
    it(sc.name, async () => {
      for (const step of sc.steps) {
        await executeStep(step);
      }
    });
  }
});
