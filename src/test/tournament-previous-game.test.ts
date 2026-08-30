import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { summarizeTable } from "~/server/api/table/snapshot";
import {
  endOpenTournament,
  findLayoutPreviousGame,
  findOpenTournament,
  startTournamentIfNeeded,
} from "~/server/api/table/tournaments";
import { db } from "~/server/db";
import { games, pokerTables, tournaments } from "~/server/db/schema";

const TABLE_NAME = "tournament-previous-game-vitest";

describe("tournament previous-game scope", () => {
  afterEach(async () => {
    const tables = await db.query.pokerTables.findMany({
      where: eq(pokerTables.name, TABLE_NAME),
    });
    for (const t of tables) {
      await db.delete(games).where(eq(games.tableId, t.id));
      await db.delete(tournaments).where(eq(tournaments.tableId, t.id));
      await db.delete(pokerTables).where(eq(pokerTables.id, t.id));
    }
  });

  async function seedTable() {
    const rows = await db
      .insert(pokerTables)
      .values({ name: TABLE_NAME, smallBlind: 5, bigBlind: 10 })
      .returning();
    return rows[0]!;
  }

  it("practice hands chain only to other practice hands", async () => {
    const table = await seedTable();
    await db.insert(games).values({
      tableId: table.id,
      isCompleted: true,
      dealerButtonSeatNumber: 0,
      smallBlindSeatNumber: 1,
      bigBlindSeatNumber: 2,
    });
    const later = await db
      .insert(games)
      .values({
        tableId: table.id,
        isCompleted: true,
        dealerButtonSeatNumber: 1,
        smallBlindSeatNumber: 2,
        bigBlindSeatNumber: 3,
      })
      .returning();

    const previous = await findLayoutPreviousGame(db, table.id, null);
    expect(previous?.id).toBe(later[0]!.id);
  });

  it("tournament hands ignore earlier practice hands (fresh first tournament game)", async () => {
    const table = await seedTable();
    await db.insert(games).values({
      tableId: table.id,
      isCompleted: true,
      dealerButtonSeatNumber: 1,
      smallBlindSeatNumber: 2,
      bigBlindSeatNumber: 3,
    });
    const tournament = await startTournamentIfNeeded(db, table.id);

    expect(await findLayoutPreviousGame(db, table.id, tournament.id)).toBeNull();
    expect(await findOpenTournament(db, table.id)).toMatchObject({
      id: tournament.id,
      endedAt: null,
    });
  });

  it("later tournament hands read only the same tournament", async () => {
    const table = await seedTable();
    await db.insert(games).values({
      tableId: table.id,
      isCompleted: true,
      dealerButtonSeatNumber: 0,
      smallBlindSeatNumber: 1,
      bigBlindSeatNumber: 2,
    });
    const tournament = await startTournamentIfNeeded(db, table.id);
    const first = await db
      .insert(games)
      .values({
        tableId: table.id,
        tournamentId: tournament.id,
        isCompleted: true,
        dealerButtonSeatNumber: 0,
        smallBlindSeatNumber: 1,
        bigBlindSeatNumber: 2,
      })
      .returning();

    const previous = await findLayoutPreviousGame(db, table.id, tournament.id);
    expect(previous?.id).toBe(first[0]!.id);
  });

  it("starting the timer twice reuses the same open tournament", async () => {
    const table = await seedTable();
    const first = await startTournamentIfNeeded(db, table.id);
    const second = await startTournamentIfNeeded(db, table.id);
    expect(second.id).toBe(first.id);
  });

  it("stopping the timer ends the tournament; a second start is a new one", async () => {
    const table = await seedTable();
    const first = await startTournamentIfNeeded(db, table.id);
    await endOpenTournament(db, table.id);
    expect(await findOpenTournament(db, table.id)).toBeNull();

    const second = await startTournamentIfNeeded(db, table.id);
    expect(second.id).not.toBe(first.id);
  });

  it("after a tournament ends, practice hands chain to the last practice hand", async () => {
    const table = await seedTable();
    const practice = await db
      .insert(games)
      .values({
        tableId: table.id,
        isCompleted: true,
        dealerButtonSeatNumber: 0,
        smallBlindSeatNumber: 1,
        bigBlindSeatNumber: 2,
      })
      .returning();
    const tournament = await startTournamentIfNeeded(db, table.id);
    await db.insert(games).values({
      tableId: table.id,
      tournamentId: tournament.id,
      isCompleted: true,
      dealerButtonSeatNumber: 3,
      smallBlindSeatNumber: 4,
      bigBlindSeatNumber: 5,
    });
    await endOpenTournament(db, table.id);

    const previous = await findLayoutPreviousGame(db, table.id, null);
    expect(previous?.id).toBe(practice[0]!.id);
  });

  it("snapshot includes the latest tournament (open or ended)", async () => {
    const table = await seedTable();
    expect((await summarizeTable(db, table.id)).tournament).toBeNull();

    const open = await startTournamentIfNeeded(db, table.id);
    const openSnap = await summarizeTable(db, table.id);
    expect(openSnap.tournament).toMatchObject({
      id: open.id,
      endedAt: null,
      winner: null,
    });

    await endOpenTournament(db, table.id);
    const endedSnap = await summarizeTable(db, table.id);
    expect(endedSnap.tournament?.id).toBe(open.id);
    expect(endedSnap.tournament?.endedAt).not.toBeNull();
    expect(endedSnap.tournament?.winner).toBeNull();
  });
});
