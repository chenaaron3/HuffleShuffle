import { and, desc, eq, sql } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createCaller } from '~/server/api/root';
import { db } from '~/server/db';
import { games, pokerTables, seats, users } from '~/server/db/schema';

type ActionName =
  | "START_GAME"
  | "DEAL_CARD"
  | "RESET_TABLE"
  | "RAISE"
  | "FOLD"
  | "CHECK";

type ActionStep = {
  type: "action";
  action: ActionName;
  by: "dealer" | "A" | "B" | "C";
  params?: { rank?: string; suit?: string; amount?: number };
  isError?: boolean;
};

type SeatSubset = Partial<
  Pick<
    typeof seats.$inferSelect,
    | "buyIn"
    | "startingBalance"
    | "currentBet"
    | "isActive"
    | "handType"
    | "handDescription"
    | "winAmount"
  >
> & { cards?: string[]; winningCards?: string[] };

type GameSubset = Partial<
  Pick<
    typeof games.$inferSelect,
    | "isCompleted"
    | "state"
    | "dealerButtonSeatId"
    | "assignedSeatId"
    | "communityCards"
    | "potTotal"
    | "betCount"
    | "requiredBetCount"
  >
>;

type TableSubset = Partial<
  Pick<
    typeof pokerTables.$inferSelect,
    "name" | "smallBlind" | "bigBlind" | "maxSeats"
  >
>;

type ValidateStep = {
  type: "validate";
  game?: GameSubset;
  table?: TableSubset;
  seats?: {
    A?: SeatSubset;
    B?: SeatSubset;
    C?: SeatSubset;
  };
};

type Step = ActionStep | ValidateStep;

type Scenario = {
  name: string;
  steps: Step[];
};

const publicKey = `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyVsuzIuAr7TYmbOtLrAp\nr6rmZBQrgMiXF0apTg7rvvSwa8JfUrZ0wXBHLx5VgpyHWNq0vFUwah7FgkpdGFQ0\nwWqRiwYWU6DG3S0sxWSYwfOiRTTLnnLPcUN3SzJjbJ5gnh7V7ukx5mpsm0dPHSiB\nREg4PNvbOo9suK4eIFKmRCgRdwNskA0pgaBi3PMfOLY+FbyTzlbs4xaQom2RMPt+\n1yD6mEACuOKzHQQP8Ve4ikkR4TdcYrnApUbfGa44xloA4fv500ez1hlBfRZ2ekow\npynGBufiP7koxSK4Nt8TRAVvuS8zZYrtGyboIZvObx6mm2YS6j7T9n0pEACpO2rT\nrwIDAQAB\n-----END PUBLIC KEY-----`;

describe("table scenario harness", () => {
  // Use unique IDs to avoid collisions with existing e2e tests running in parallel
  const dealerId = "dealer-scenario-vitest";
  const playerAId = "playerA-scenario-vitest";
  const playerBId = "playerB-scenario-vitest";
  const playerCId = "playerC-scenario-vitest";

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
  const playerCCaller = createCaller({
    session: {
      user: { id: playerCId, role: "player" as const },
      expires: new Date().toISOString(),
    },
    db,
  } as any);

  let tableId = "";

  const cleanup = async () => {
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
        {
          id: dealerId,
          email: "d@vitest.local",
          role: "dealer",
          balance: 0,
          name: "Dealer",
        },
        {
          id: playerAId,
          email: "a@vitest.local",
          role: "player",
          balance: 1000,
          name: "A",
        },
        {
          id: playerBId,
          email: "b@vitest.local",
          role: "player",
          balance: 1000,
          name: "B",
        },
      ])
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    await cleanup();
    await db
      .insert(users)
      .values([
        {
          id: dealerId,
          email: "d@vitest.local",
          role: "dealer",
          balance: 0,
          name: "Dealer",
        },
        {
          id: playerAId,
          email: "a@vitest.local",
          role: "player",
          balance: 1000,
          name: "A",
        },
        {
          id: playerBId,
          email: "b@vitest.local",
          role: "player",
          balance: 1000,
          name: "B",
        },
        {
          id: playerCId,
          email: "c@vitest.local",
          role: "player",
          balance: 1000,
          name: "C",
        },
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

    await playerACaller.table.join({
      tableId,
      buyIn: BUY_IN,
      userPublicKey: publicKey,
    });
    await playerBCaller.table.join({
      tableId,
      buyIn: BUY_IN,
      userPublicKey: publicKey,
    });
    await playerCCaller.table.join({
      tableId,
      buyIn: BUY_IN,
      userPublicKey: publicKey,
    });
  });

  const callers: Record<"dealer" | "A" | "B" | "C", any> = {
    dealer: dealerCaller,
    A: playerACaller,
    B: playerBCaller,
    C: playerCCaller,
  };

  async function executeStep(step: Step) {
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

      const idMap: Record<"A" | "B" | "C", string> = {
        A: playerAId,
        B: playerBId,
        C: playerCId,
      };
      for (const key of ["A", "B", "C"] as const) {
        const subset = (step.seats as any)[key] as SeatSubset | undefined;
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
    "./table.scenarios/**/*.json",
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
