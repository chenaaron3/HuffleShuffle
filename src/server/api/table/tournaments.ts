import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "~/server/db";
import { games, tournaments } from "~/server/db/schema";

type GameRow = typeof games.$inferSelect;
type TournamentRow = typeof tournaments.$inferSelect;

type Tx = {
  insert: typeof db.insert;
  query: typeof db.query;
  update: typeof db.update;
};

export const SEATS_LOCKED_ERROR =
  "Seats are locked while the tournament is active";

export function isTournamentActive(
  tournament: { endedAt: Date | null } | null | undefined,
): boolean {
  return tournament != null && tournament.endedAt == null;
}

export function tableAvailability(
  game: { isCompleted: boolean } | null | undefined,
  tournament: { endedAt: Date | null } | null | undefined,
) {
  const isHandInProgress = !!game && !game.isCompleted;
  const tournamentActive = isTournamentActive(tournament);
  return {
    isHandInProgress,
    isTournamentActive: tournamentActive,
    isJoinable: !isHandInProgress && !tournamentActive,
  };
}

export async function findOpenTournament(
  tx: Tx,
  tableId: string,
): Promise<TournamentRow | null> {
  const row = await tx.query.tournaments.findFirst({
    where: and(eq(tournaments.tableId, tableId), isNull(tournaments.endedAt)),
    orderBy: [desc(tournaments.startedAt)],
  });
  return row ?? null;
}

export async function assertSeatsUnlocked(
  tx: Tx,
  tableId: string,
): Promise<void> {
  const open = await findOpenTournament(tx, tableId);
  if (open) throw new Error(SEATS_LOCKED_ERROR);
}

export async function startTournamentIfNeeded(
  tx: Tx,
  tableId: string,
): Promise<TournamentRow> {
  const open = await findOpenTournament(tx, tableId);
  if (open) return open;

  const created = await tx
    .insert(tournaments)
    .values({ tableId, startedAt: new Date() })
    .returning();
  const row = created[0];
  if (!row) throw new Error("Failed to create tournament");
  return row;
}

export async function endOpenTournament(
  tx: Tx,
  tableId: string,
  winnerPlayerId?: string | null,
): Promise<TournamentRow | null> {
  const open = await findOpenTournament(tx, tableId);
  if (!open) return null;

  const rows = await tx
    .update(tournaments)
    .set({
      endedAt: new Date(),
      winnerPlayerId: winnerPlayerId ?? null,
    })
    .where(eq(tournaments.id, open.id))
    .returning();
  return rows[0] ?? null;
}

/** Latest game in the same tournament scope (null tournament = practice hands). */
export async function findLayoutPreviousGame(
  tx: Tx,
  tableId: string,
  tournamentId: string | null,
): Promise<GameRow | null> {
  const row = await tx.query.games.findFirst({
    where: tournamentId
      ? and(eq(games.tableId, tableId), eq(games.tournamentId, tournamentId))
      : and(eq(games.tableId, tableId), isNull(games.tournamentId)),
    orderBy: [desc(games.createdAt)],
  });
  return row ?? null;
}
