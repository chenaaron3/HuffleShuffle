import { eq } from "drizzle-orm";
import { computeBlindState } from "~/server/api/lib/blind-timer";
import { tableAvailability } from "~/server/api/table/tournaments";
import type { SeatWithPlayer, TableSnapshot } from "~/server/api/table/types";
import { db } from "~/server/db";
import { pokerTables } from "~/server/db/schema";

type DB = typeof db;

export async function summarizeTable(
  client: DB,
  tableId: string,
): Promise<TableSnapshot> {
  const snapshot = await client.query.pokerTables.findFirst({
    where: eq(pokerTables.id, tableId),
    with: {
      games: {
        orderBy: (g, { desc }) => [desc(g.createdAt)],
        limit: 1,
      },
      tournaments: {
        where: (t, { isNotNull }) => isNotNull(t.startedAt),
        orderBy: (t, { desc }) => [desc(t.startedAt)],
        limit: 1,
        with: {
          winner: {
            columns: {
              id: true,
              name: true,
              displayName: true,
            },
          },
        },
      },
      seats: {
        orderBy: (s, { asc }) => [asc(s.seatNumber)],
        with: {
          player: {
            columns: {
              id: true,
              name: true,
              displayName: true,
            },
          },
        },
      },
    },
  });
  if (!snapshot) throw new Error("Table not found");
  // Split relations off the table row. `table` must be the bare row: if the
  // nested `seats` rode along, every player's hole cards would bypass redaction.
  const {
    seats: tableSeats,
    games,
    tournaments,
    ...tableRow
  } = snapshot;
  const latestGame = games[0] ?? null;
  const latestTournament = tournaments[0] ?? null;
  const availableSeats = tableRow.maxSeats - tableSeats.length;
  const availability = tableAvailability(latestGame, latestTournament);

  return {
    table: tableRow,
    seats: tableSeats,
    game: latestGame,
    tournament: latestTournament,
    ...availability,
    availableSeats,
    blinds: computeBlindState(tableRow),
  };
}

/** Drop any relation data attached to the table row (defense in depth). */
function stripTableRelations(
  table: TableSnapshot["table"],
): TableSnapshot["table"] {
  if (!table) return table;
  const {
    seats: _seats,
    games: _games,
    tournaments: _tournaments,
    ...row
  } = table as NonNullable<TableSnapshot["table"]> & {
    seats?: unknown;
    games?: unknown;
    tournaments?: unknown;
  };
  return row;
}

export function redactSnapshotForUser(
  snapshot: TableSnapshot,
  userId: string,
): TableSnapshot {
  const isShowdown = snapshot.game?.state === "SHOWDOWN";

  const activeCount = snapshot.seats.filter(
    (s) => s.seatStatus === "active",
  ).length;
  const allInCount = snapshot.seats.filter(
    (s) => s.seatStatus === "all-in",
  ).length;

  // Show cards when there's a runout (all all-in or one active + others all-in)
  // and no active player has a pending call/fold decision.
  const nonFoldedSeats = snapshot.seats.filter(
    (s) => s.seatStatus !== "folded" && s.seatStatus !== "eliminated",
  );
  const maxBet = Math.max(...nonFoldedSeats.map((s) => s.currentBet ?? 0), 0);
  const activePlayerFacingDecision = snapshot.seats.some(
    (s) => s.seatStatus === "active" && (s.currentBet ?? 0) < maxBet,
  );
  const showCardsForRunout =
    (activeCount === 0 && allInCount >= 2) ||
    (activeCount === 1 && allInCount >= 1)
      ? !activePlayerFacingDecision
      : false;

  // Check if only one non-folded player remains (everyone else folded)
  const singleActive =
    snapshot.seats.filter(
      (s) =>
        s.seatStatus === "active" ||
        s.seatStatus === "all-in" ||
        (s.seatStatus === "eliminated" && s.cards.length > 0),
    ).length === 1;

  const computeCardsVisibleToOthers = (s: SeatWithPlayer): boolean => {
    if (s.seatStatus === "folded") {
      return !!s.voluntaryShow;
    }
    if (showCardsForRunout) {
      return true;
    }
    if (isShowdown) {
      if (singleActive) {
        return !!s.voluntaryShow;
      }
      return true;
    }
    return false;
  };

  const redactedSeats: SeatWithPlayer[] = snapshot.seats.map((s) => {
    const cardsVisibleToOthers = computeCardsVisibleToOthers(s);
    const hiddenCount = (s.cards ?? []).length;
    const hiddenCards = {
      ...s,
      cards: Array(hiddenCount).fill("FD"),
      handType: null,
      handDescription: null,
      winningCards: [],
      cardsVisibleToOthers,
    } as SeatWithPlayer;

    if (s.playerId === userId) {
      return { ...s, cardsVisibleToOthers };
    }
    if (!cardsVisibleToOthers) {
      return hiddenCards;
    }
    return { ...s, cardsVisibleToOthers };
  });
  return {
    ...snapshot,
    table: stripTableRelations(snapshot.table),
    seats: redactedSeats,
  };
}
