import { eq, inArray, like } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCaller } from "~/server/api/root";
import {
  assertCanJoinTournamentTable,
  endOpenTournament,
  findOpenTournament,
  startTournamentIfNeeded,
} from "~/server/api/table/tournaments";
import { db } from "~/server/db";
import {
  MAX_SEATS_PER_TABLE,
  gameEvents,
  games,
  piDevices,
  pokerTables,
  seats,
  tournamentRegistrations,
  tournaments,
  tournamentSeries,
  users,
} from "~/server/db/schema";
import {
  clearTestLedger,
  ensureTestWalletBalance,
} from "~/test/ledger-test-utils";

const PREFIX = "tourney-reg-vitest";
const DEALER_ID = `${PREFIX}-dealer`;
const TABLE_NAME = `${PREFIX}-table`;
const playerId = (i: number) => `${PREFIX}-player-${i}`;

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

const HOUR = 60 * 60 * 1000;

describe("tournament registration", () => {
  const dealer = callerFor(DEALER_ID, "dealer");
  const player = (i: number) => callerFor(playerId(i), "player");
  let tableId = "";

  const cleanup = async () => {
    const tables = await db.query.pokerTables.findMany({
      where: eq(pokerTables.name, TABLE_NAME),
    });
    for (const t of tables) {
      await db
        .delete(tournamentSeries)
        .where(eq(tournamentSeries.tableId, t.id));
      await db.delete(gameEvents).where(eq(gameEvents.tableId, t.id));
      await db.delete(games).where(eq(games.tableId, t.id));
      await db.delete(tournaments).where(eq(tournaments.tableId, t.id));
      await db.delete(seats).where(eq(seats.tableId, t.id));
      await db.delete(piDevices).where(eq(piDevices.tableId, t.id));
      await db.delete(pokerTables).where(eq(pokerTables.id, t.id));
    }
    await clearTestLedger();
    await db.delete(users).where(like(users.id, `${PREFIX}-%`));
  };

  beforeEach(async () => {
    await cleanup();
    await db.insert(users).values([
      {
        id: DEALER_ID,
        email: `${DEALER_ID}@vitest.local`,
        role: "dealer",
        name: "Dealer",
      },
      ...Array.from({ length: 10 }, (_, i) => ({
        id: playerId(i),
        email: `${playerId(i)}@vitest.local`,
        role: "player" as const,
        name: `Player ${i}`,
        displayName: `Player ${i}`,
        recordingConsent: true,
      })),
    ]);
    for (let i = 0; i < 10; i++)
      await ensureTestWalletBalance(playerId(i), 1000);

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
  });

  afterEach(cleanup);

  const join = (i: number) =>
    player(i).table.join({ tableId, buyIn: 100, userPublicKey: publicKey });

  async function scheduleAt(scheduledAt: Date) {
    const { tournamentId } = await dealer.tournament.create({
      tableId,
      name: "Sunday 3pm",
      scheduledAt,
    });
    return tournamentId;
  }

  /** Register players in order with strictly increasing queuedAt. */
  async function registerInOrder(tournamentId: string, players: number[]) {
    const base = Date.now() - 10 * HOUR;
    await db.insert(tournamentRegistrations).values(
      players.map((i, idx) => ({
        tournamentId,
        userId: playerId(i),
        queuedAt: new Date(base + idx * 1000),
      })),
    );
  }

  it("lets players register before the start time but not sit down", async () => {
    const tournamentId = await scheduleAt(new Date(Date.now() + 2 * HOUR));
    await player(0).tournament.register({ tournamentId });

    const list = await player(0).tournament.list();
    const t = list.find((x) => x.id === tournamentId)!;
    expect(t.status).toBe("upcoming");
    expect(
      t.registrations.find((r) => r.userId === playerId(0))?.position,
    ).toBe(1);
    expect(t.registrations[0]?.name).toBe("Player 0");

    await expect(join(0)).rejects.toThrow(/hasn't opened yet/);
    // A scheduled-but-unstarted tournament must not lock seats.
    expect(await findOpenTournament(db, tableId)).toBeNull();
  });

  it("seats the first 8 registrants after the start time and waitlists the rest", async () => {
    const tournamentId = await scheduleAt(new Date(Date.now() - 1000));
    await registerInOrder(tournamentId, [0, 1, 2, 3, 4, 5, 6, 7, 8]);

    await join(0);
    await expect(join(8)).rejects.toThrow(/#1 on standby/);

    const list = await dealer.tournament.list();
    const t = list.find((x) => x.id === tournamentId)!;
    expect(t.status).toBe("open");
    expect(t.registrations.filter((r) => r.isSeated)).toHaveLength(
      MAX_SEATS_PER_TABLE,
    );
    expect(t.registrations[8]?.isSeated).toBe(false);
    expect(t.registrations[0]?.isAtTable).toBe(true);

    // Admin removes a no-show → the waitlisted player moves up and can join.
    const noShow = t.registrations.find((r) => r.userId === playerId(3))!;
    await dealer.tournament.removePlayer({ registrationId: noShow.id });
    await join(8);
  });

  it("auto-registers walk-ins after the start time when there is room", async () => {
    const tournamentId = await scheduleAt(new Date(Date.now() - 1000));
    await registerInOrder(tournamentId, [0, 1]);

    await join(5); // never registered
    const regs = await db.query.tournamentRegistrations.findMany({
      where: eq(tournamentRegistrations.tournamentId, tournamentId),
    });
    expect(regs.map((r) => r.userId)).toContain(playerId(5));
  });

  it("rejects walk-ins once 8 people are ahead (and does not keep their registration)", async () => {
    const tournamentId = await scheduleAt(new Date(Date.now() - 1000));
    await registerInOrder(tournamentId, [0, 1, 2, 3, 4, 5, 6, 7]);

    await expect(
      db.transaction((tx) =>
        assertCanJoinTournamentTable(tx, tableId, playerId(9)),
      ),
    ).rejects.toThrow(/full/);
    const regs = await db.query.tournamentRegistrations.findMany({
      where: eq(tournamentRegistrations.tournamentId, tournamentId),
    });
    expect(regs).toHaveLength(8);
  });

  it("on-demand games are open immediately to anyone", async () => {
    await dealer.tournament.create({ tableId });
    await join(0);
    await join(1);
  });

  it("starting blinds adopts the due scheduled tournament", async () => {
    const tournamentId = await scheduleAt(new Date(Date.now() - 1000));
    const started = await startTournamentIfNeeded(db, tableId);
    expect(started.id).toBe(tournamentId);
    expect(started.startedAt).not.toBeNull();
  });

  it("creating a series schedules the first game, and ending it schedules next week", async () => {
    await dealer.tournament.saveSeries({
      tableId,
      name: "Sunday 3pm",
      dayOfWeek: 0,
      startTime: "15:00",
    });
    const [series] = await db
      .select()
      .from(tournamentSeries)
      .where(eq(tournamentSeries.tableId, tableId));
    const first = await db.query.tournaments.findFirst({
      where: eq(tournaments.seriesId, series!.id),
    });
    expect(first?.scheduledAt).toBeTruthy();
    expect(first!.scheduledAt!.getTime()).toBeGreaterThan(Date.now());

    // Pretend it's game time: make it due, start, then end it.
    await db
      .update(tournaments)
      .set({ scheduledAt: new Date(Date.now() - 1000) })
      .where(eq(tournaments.id, first!.id));
    await startTournamentIfNeeded(db, tableId);
    await endOpenTournament(db, tableId);

    const all = await db.query.tournaments.findMany({
      where: eq(tournaments.seriesId, series!.id),
    });
    expect(all).toHaveLength(2);
    const next = all.find((t) => t.id !== first!.id)!;
    expect(next.startedAt).toBeNull();
    expect(next.scheduledAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("cancelling an upcoming series game schedules the following week, not the same one", async () => {
    await dealer.tournament.saveSeries({
      tableId,
      name: "Sunday 6pm",
      dayOfWeek: 0,
      startTime: "18:00",
    });
    const upcoming = await db.query.tournaments.findFirst({
      where: eq(tournaments.tableId, tableId),
    });
    await dealer.tournament.cancel({ tournamentId: upcoming!.id });

    const pending = (
      await db.query.tournaments.findMany({
        where: eq(tournaments.tableId, tableId),
      })
    ).filter((t) => !t.cancelledAt);
    expect(pending).toHaveLength(1);
    expect(
      pending[0]!.scheduledAt!.getTime() - upcoming!.scheduledAt!.getTime(),
    ).toBe(7 * 24 * HOUR);
  });

  it("deleting a series removes its upcoming game but keeps history", async () => {
    await dealer.tournament.saveSeries({
      tableId,
      name: "Sunday 3pm",
      dayOfWeek: 0,
      startTime: "15:00",
    });
    const [series] = await dealer.tournament.listSeries();
    await dealer.tournament.deleteSeries({ seriesId: series!.id });
    const remaining = await db.query.tournaments.findMany({
      where: inArray(tournaments.tableId, [tableId]),
    });
    expect(remaining).toHaveLength(0);
  });
  it("admins can drag a player to a new spot in the queue", async () => {
    const tournamentId = await scheduleAt(new Date(Date.now() + HOUR));
    await registerInOrder(tournamentId, [0, 1, 2, 3]);
    const order = async () =>
      (await dealer.tournament.list())
        .find((t) => t.id === tournamentId)!
        .registrations.map((r) => r.userId);

    const reg3 = (await db.query.tournamentRegistrations.findFirst({
      where: (r, { and, eq }) =>
        and(eq(r.tournamentId, tournamentId), eq(r.userId, playerId(3))),
    }))!;
    await dealer.tournament.movePlayer({ registrationId: reg3.id, toIndex: 0 });
    expect(await order()).toEqual([3, 0, 1, 2].map(playerId));

    await dealer.tournament.movePlayer({ registrationId: reg3.id, toIndex: 2 });
    expect(await order()).toEqual([0, 1, 3, 2].map(playerId));

    // New sign-ups still go to the back.
    await player(5).tournament.register({ tournamentId });
    expect((await order()).at(-1)).toBe(playerId(5));
  });

  it("editing a series renames/reschedules its upcoming game but keeps registrations", async () => {
    await dealer.tournament.saveSeries({
      tableId,
      name: "Sunday 3pm",
      dayOfWeek: 0,
      startTime: "15:00",
    });
    const [series] = await dealer.tournament.listSeries();
    const upcoming = (await db.query.tournaments.findFirst({
      where: eq(tournaments.seriesId, series!.id),
    }))!;
    await player(0).tournament.register({ tournamentId: upcoming.id });

    await dealer.tournament.saveSeries({
      seriesId: series!.id,
      tableId,
      name: "Sunday 6pm",
      dayOfWeek: 0,
      startTime: "18:00",
    });
    const after = (await db.query.tournaments.findFirst({
      where: eq(tournaments.id, upcoming.id),
    }))!;
    expect(after.name).toBe("Sunday 6pm");
    expect(after.scheduledAt!.getTime() - upcoming.scheduledAt!.getTime()).toBe(
      3 * HOUR,
    );
    const regs = await db.query.tournamentRegistrations.findMany({
      where: eq(tournamentRegistrations.tournamentId, upcoming.id),
    });
    expect(regs).toHaveLength(1);
  });
});
