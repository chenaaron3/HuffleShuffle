import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCaller } from "~/server/api/root";
import {
  endOpenTournament,
  SEATS_LOCKED_ERROR,
  startTournamentIfNeeded,
} from "~/server/api/table/tournaments";
import { db } from "~/server/db";
import {
  gameEvents,
  games,
  piDevices,
  pokerTables,
  seats,
  tournaments,
  users,
} from "~/server/db/schema";
import {
  clearTestLedger,
  ensureTestWalletBalance,
} from "~/test/ledger-test-utils";

const DEALER_ID = "dealer-seat-lock-vitest";
const PLAYER1_ID = "player1-seat-lock-vitest";
const PLAYER2_ID = "player2-seat-lock-vitest";
const PLAYER3_ID = "player3-seat-lock-vitest";
const TABLE_NAME = "tournament-seat-lock-vitest";

const publicKey = `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyVsuzIuAr7TYmbOtLrAp\nr6rmZBQrgMiXF0apTg7rvvSwa8JfUrZ0wXBHLx5VgpyHWNq0vFUwah7FgkpdGFQ0\nwWqRiwYWU6DG3S0sxWSYwfOiRTTLnnLPcUN3SzJjbJ5gnh7V7ukx5mpsm0dPHSiB\nREg4PNvbOo9suK4eIFKmRCgRdwNskA0pgaBi3PMfOLY+FbyTzlbs4xaQom2RMPt+\n1yD6mEACuOKzHQQP8Ve4ikkR4TdcYrnApUbfGa44xloA4fv500ez1hlBfRZ2ekow\npynGBufiP7koxSK4Nt8TRAVvuS8zZYrtGyboIZvObx6mm2YS6j7T9n0pEACpO2rT\nrwIDAQAB\n-----END PUBLIC KEY-----`;

function callerFor(userId: string, role: "dealer" | "player") {
  return createCaller({
    session: {
      user: { id: userId, role },
      expires: new Date().toISOString(),
    },
    db,
  } as any);
}

async function expectSeatsLocked(promise: Promise<unknown>) {
  await expect(promise).rejects.toThrow(SEATS_LOCKED_ERROR);
}

describe("tournament seat lock", () => {
  const dealer = callerFor(DEALER_ID, "dealer");
  const player1 = callerFor(PLAYER1_ID, "player");
  const player2 = callerFor(PLAYER2_ID, "player");
  const player3 = callerFor(PLAYER3_ID, "player");

  let tableId = "";

  const cleanup = async () => {
    const tables = await db.query.pokerTables.findMany({
      where: eq(pokerTables.name, TABLE_NAME),
    });
    for (const t of tables) {
      await db.delete(gameEvents).where(eq(gameEvents.tableId, t.id));
      await db.delete(games).where(eq(games.tableId, t.id));
      await db.delete(tournaments).where(eq(tournaments.tableId, t.id));
      await db.delete(seats).where(eq(seats.tableId, t.id));
      await db.delete(piDevices).where(eq(piDevices.tableId, t.id));
      await db.delete(pokerTables).where(eq(pokerTables.id, t.id));
    }
    await clearTestLedger();
  };

  beforeEach(async () => {
    await cleanup();
    await db
      .insert(users)
      .values([
        {
          id: DEALER_ID,
          email: "dealer-seat-lock@vitest.local",
          role: "dealer",
          name: "Dealer",
          displayName: "Dealer",
        },
        {
          id: PLAYER1_ID,
          email: "player1-seat-lock@vitest.local",
          role: "player",
          name: "P1",
          displayName: "Player 1",
        },
        {
          id: PLAYER2_ID,
          email: "player2-seat-lock@vitest.local",
          role: "player",
          name: "P2",
          displayName: "Player 2",
        },
        {
          id: PLAYER3_ID,
          email: "player3-seat-lock@vitest.local",
          role: "player",
          name: "P3",
          displayName: "Player 3",
        },
      ])
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: sql`EXCLUDED.email`,
          role: sql`EXCLUDED.role`,
          name: sql`EXCLUDED.name`,
          displayName: sql`EXCLUDED."displayName"`,
        },
      });

    await ensureTestWalletBalance(PLAYER1_ID, 1000);
    await ensureTestWalletBalance(PLAYER2_ID, 1000);
    await ensureTestWalletBalance(PLAYER3_ID, 1000);

    const created = await dealer.table.create({
      name: TABLE_NAME,
      smallBlind: 5,
      bigBlind: 10,
      maxSeats: 8,
    });
    tableId = created.tableId;

    await db.insert(piDevices).values(
      Array.from({ length: 8 }, (_, i) => ({
        serial: `${tableId}-card-${i}`,
        tableId,
        type: "card" as const,
        seatNumber: i,
        publicKey,
      })),
    );

    await player1.table.join({
      tableId,
      buyIn: 300,
      userPublicKey: publicKey,
    });
    await player2.table.join({
      tableId,
      buyIn: 300,
      userPublicKey: publicKey,
    });
    await dealer.table.addBot({
      tableId,
      seatNumber: 2,
      buyIn: 300,
    });
  });

  afterEach(cleanup);

  it("locks join, leave, seat moves, and dealer add/remove while a tournament is open", async () => {
    await startTournamentIfNeeded(db, tableId);

    const listed = await dealer.table.list();
    const row = listed.find((t) => t.id === tableId);
    expect(row?.isTournamentActive).toBe(true);
    expect(row?.isHandInProgress).toBe(false);
    expect(row?.isJoinable).toBe(false);

    await expectSeatsLocked(
      player3.table.join({
        tableId,
        buyIn: 300,
        userPublicKey: publicKey,
      }),
    );
    await expectSeatsLocked(player1.table.leave({ tableId }));
    await expectSeatsLocked(
      player1.table.changeSeat({
        tableId,
        toSeatNumber: 4,
        userPublicKey: publicKey,
      }),
    );
    await expectSeatsLocked(
      dealer.table.addBot({
        tableId,
        seatNumber: 3,
        buyIn: 300,
      }),
    );
    await expectSeatsLocked(
      dealer.table.removeBot({
        tableId,
        seatNumber: 2,
      }),
    );
    await expectSeatsLocked(
      dealer.table.removePlayer({
        tableId,
        playerId: PLAYER1_ID,
      }),
    );

    const seated = await db.query.seats.findMany({
      where: eq(seats.tableId, tableId),
    });
    expect(seated.map((s) => s.seatNumber).sort()).toEqual([0, 1, 2]);
  });

  it("unlocks seats after the tournament ends", async () => {
    await startTournamentIfNeeded(db, tableId);
    await endOpenTournament(db, tableId);

    const listed = await dealer.table.list();
    const row = listed.find((t) => t.id === tableId);
    expect(row?.isTournamentActive).toBe(false);
    expect(row?.isHandInProgress).toBe(false);
    expect(row?.isJoinable).toBe(true);

    await player1.table.leave({ tableId });
    await player3.table.join({
      tableId,
      buyIn: 300,
      userPublicKey: publicKey,
    });

    const seated = await db.query.seats.findMany({
      where: eq(seats.tableId, tableId),
    });
    expect(seated.some((s) => s.playerId === PLAYER1_ID)).toBe(false);
    expect(seated.some((s) => s.playerId === PLAYER3_ID)).toBe(true);
  });
});
