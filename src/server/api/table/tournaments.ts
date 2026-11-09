import { and, asc, desc, eq, isNotNull, isNull, lte } from "drizzle-orm";
import { nextOccurrence } from "~/lib/tournament-schedule";
import { db } from "~/server/db";
import {
  games,
  MAX_SEATS_PER_TABLE,
  tournamentRegistrations,
  tournaments,
  tournamentSeries,
} from "~/server/db/schema";

type GameRow = typeof games.$inferSelect;
type TournamentRow = typeof tournaments.$inferSelect;

type Tx = {
  insert: typeof db.insert;
  query: typeof db.query;
  update: typeof db.update;
};

export const SEATS_LOCKED_ERROR =
  "Seats are locked while the tournament is active";

/** Scheduled but not started, ended, or cancelled. */
export const isPending = and(
  isNull(tournaments.startedAt),
  isNull(tournaments.endedAt),
  isNull(tournaments.cancelledAt),
);

/** Active = started (blinds running) and not yet ended. Scheduled-but-unstarted tournaments are not active. */
export function isTournamentActive(
  tournament:
    | { startedAt?: Date | null; endedAt: Date | null }
    | null
    | undefined,
): boolean {
  return tournament?.startedAt != null && tournament.endedAt == null;
}

export function tableAvailability(
  game: { isCompleted: boolean } | null | undefined,
  tournament:
    | { startedAt?: Date | null; endedAt: Date | null }
    | null
    | undefined,
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
    where: and(
      eq(tournaments.tableId, tableId),
      isNotNull(tournaments.startedAt),
      isNull(tournaments.endedAt),
    ),
    orderBy: [desc(tournaments.startedAt)],
  });
  return row ?? null;
}

/**
 * The tournament players are currently allowed to join at this table: not
 * started/ended/cancelled and its scheduled time has passed. If several are
 * due, the most recently scheduled one wins.
 */
export async function findJoinableTournament(
  tx: Pick<Tx, "query">,
  tableId: string,
  now: Date = new Date(),
): Promise<TournamentRow | null> {
  const row = await tx.query.tournaments.findFirst({
    where: and(
      eq(tournaments.tableId, tableId),
      isPending,
      lte(tournaments.scheduledAt, now),
    ),
    orderBy: [desc(tournaments.scheduledAt)],
  });
  return row ?? null;
}

/**
 * Gate for a player taking a seat. Joining after the scheduled time
 * auto-registers the player; they get in if they're within capacity.
 */
export async function assertCanJoinTournamentTable(
  tx: Pick<Tx, "query" | "insert">,
  tableId: string,
  userId: string,
  now: Date = new Date(),
): Promise<TournamentRow> {
  const tournament = await findJoinableTournament(tx, tableId, now);
  if (!tournament) {
    throw new Error(
      "This game hasn't opened yet. Register from the lobby to reserve your spot.",
    );
  }

  await tx
    .insert(tournamentRegistrations)
    .values({ tournamentId: tournament.id, userId })
    .onConflictDoNothing();

  const queue = await tx.query.tournamentRegistrations.findMany({
    where: eq(tournamentRegistrations.tournamentId, tournament.id),
    orderBy: [
      asc(tournamentRegistrations.queuedAt),
      asc(tournamentRegistrations.id),
    ],
    columns: { userId: true },
  });
  const position = queue.findIndex((r) => r.userId === userId);
  if (position >= MAX_SEATS_PER_TABLE) {
    throw new Error(
      `This game is full — you're #${position - MAX_SEATS_PER_TABLE + 1} on standby`,
    );
  }
  return tournament;
}

/**
 * Create the series' next game unless one is still live. It lands on the next
 * matching weekday after both now and the series' latest game, so cancelling
 * this week's game early schedules next week rather than the same day again.
 */
export async function scheduleNextInSeries(
  tx: Pick<Tx, "query" | "insert">,
  seriesId: string,
): Promise<void> {
  const series = await tx.query.tournamentSeries.findFirst({
    where: eq(tournamentSeries.id, seriesId),
    with: {
      tournaments: {
        orderBy: [desc(tournaments.scheduledAt)],
        limit: 1,
      },
    },
  });
  const latest = series?.tournaments[0];
  if (!series || (latest && !latest.endedAt && !latest.cancelledAt)) return;

  const now = new Date();
  const after =
    latest?.scheduledAt && latest.scheduledAt > now ? latest.scheduledAt : now;
  await tx.insert(tournaments).values({
    tableId: series.tableId,
    seriesId: series.id,
    name: series.name,
    scheduledAt: nextOccurrence(series.dayOfWeek, series.startTime, after),
  });
}

export async function cancelTournament(
  tx: Tx,
  tournamentId: string,
): Promise<TournamentRow> {
  const rows = await tx
    .update(tournaments)
    .set({ cancelledAt: new Date() })
    .where(and(eq(tournaments.id, tournamentId), isPending))
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Only upcoming tournaments can be cancelled");
  if (row.seriesId) await scheduleNextInSeries(tx, row.seriesId);
  return row;
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

  const now = new Date();
  const due = await findJoinableTournament(tx, tableId, now);
  if (due) {
    const started = await tx
      .update(tournaments)
      .set({ startedAt: now })
      .where(eq(tournaments.id, due.id))
      .returning();
    if (started[0]) return started[0];
  }

  // Nothing scheduled: ad-hoc tournament (e.g. dealer testing with bots).
  const created = await tx
    .insert(tournaments)
    .values({ tableId, scheduledAt: now, startedAt: now })
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
  const ended = rows[0] ?? null;
  if (ended?.seriesId) await scheduleNextInSeries(tx, ended.seriesId);
  return ended;
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
