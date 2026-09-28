import { eq } from "drizzle-orm";
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
