import { and, eq } from "drizzle-orm";
import { db } from "~/server/db";
import { pokerTables, seats } from "~/server/db/schema";

/** Table this user is already dealing or seated at, if any. */
export async function getCommittedTableId(
  userId: string,
  role: string | undefined,
): Promise<string | null> {
  if (role === "dealer") {
    const table = await db.query.pokerTables.findFirst({
      where: eq(pokerTables.dealerId, userId),
      columns: { id: true },
    });
    return table?.id ?? null;
  }

  const seat = await db.query.seats.findFirst({
    where: eq(seats.playerId, userId),
    columns: { tableId: true },
  });
  return seat?.tableId ?? null;
}

export function isTableParticipant(input: {
  userId: string;
  tableDealerId: string | null | undefined;
  seatedAtThisTable: boolean;
}): boolean {
  return input.tableDealerId === input.userId || input.seatedAtThisTable;
}

/** Spectators may read a table but cannot mutate it. */
export async function assertTableParticipant(
  userId: string,
  tableId: string,
): Promise<void> {
  const table = await db.query.pokerTables.findFirst({
    where: eq(pokerTables.id, tableId),
    columns: { dealerId: true },
  });
  if (!table) throw new Error("Table not found");
  const seat = await db.query.seats.findFirst({
    where: and(eq(seats.tableId, tableId), eq(seats.playerId, userId)),
    columns: { id: true },
  });
  if (
    !isTableParticipant({
      userId,
      tableDealerId: table.dealerId,
      seatedAtThisTable: !!seat,
    })
  ) {
    throw new Error("FORBIDDEN: spectators cannot modify this table");
  }
}
