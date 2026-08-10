import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "~/server/db";
import {
  games,
  piDevices,
  seats,
  users,
} from "~/server/db/schema";
import { rsaEncryptB64 } from "~/utils/crypto";

type Tx = {
  insert: typeof db.insert;
  query: typeof db.query;
  update: typeof db.update;
  delete: typeof db.delete;
};

type SeatRow = typeof seats.$inferSelect;

export const fetchAllSeatsInOrder = async (
  tx: Pick<Tx, "query">,
  tableId: string,
): Promise<SeatRow[]> => {
  return await tx.query.seats.findMany({
    where: eq(seats.tableId, tableId),
    orderBy: (s, { asc }) => [asc(s.seatNumber)],
  });
};

/**
 * Shared transaction logic for creating a seat (used by both join and addBot)
 * Assumes the user already exists and has sufficient balance
 */
export async function createSeatTransaction(
  tx: Tx,
  params: {
    tableId: string;
    playerId: string;
    seatNumber: number;
    buyIn: number;
    userPublicKey: string;
  },
): Promise<SeatRow> {
  const { tableId, playerId, seatNumber, buyIn, userPublicKey } = params;

  // Update user's public key and deduct balance
  await tx
    .update(users)
    .set({ publicKey: userPublicKey })
    .where(eq(users.id, playerId));

  await tx
    .update(users)
    .set({ balance: sql`${users.balance} - ${buyIn}` })
    .where(eq(users.id, playerId));

  // Find seat-mapped Pi device
  const pi = await tx.query.piDevices.findFirst({
    where: and(
      eq(piDevices.tableId, tableId),
      eq(piDevices.type, "card"),
      eq(piDevices.seatNumber, seatNumber),
    ),
  });
  if (!pi || !pi.publicKey) {
    throw new Error("Pi device not found for seat");
  }

  // Generate ephemeral nonce and encrypt
  const nonce = crypto.randomUUID();
  const encUser = await rsaEncryptB64(userPublicKey, nonce);
  const encPi = await rsaEncryptB64(pi.publicKey, nonce);

  // Create seat
  const seatRows = await tx
    .insert(seats)
    .values({
      tableId,
      playerId,
      seatNumber,
      buyIn,
      startingBalance: buyIn,
      seatStatus: "active",
      encryptedUserNonce: encUser,
      encryptedPiNonce: encPi,
    })
    .returning();

  const seat = seatRows[0];
  if (!seat) throw new Error("Failed to create seat");

  return seat;
}

/**
 * Shared transaction logic for removing a player seat from a table
 * Used by both leave (player leaves voluntarily) and removePlayer (dealer kicks player)
 */
export async function removePlayerSeatTransaction(
  tx: Tx,
  params: {
    tableId: string;
    playerId: string;
  },
): Promise<{ ok: true }> {
  const { tableId, playerId } = params;

  // Find the player's seat
  const seat = await tx.query.seats.findFirst({
    where: and(eq(seats.tableId, tableId), eq(seats.playerId, playerId)),
  });
  if (!seat) throw new Error("Seat not found");

  // Check if table is joinable (no active game)
  const latest = await tx.query.games.findFirst({
    where: eq(games.tableId, tableId),
    orderBy: (g, { desc }) => [desc(g.createdAt)],
  });

  // Allow removing if table is joinable (no active game or game is completed)
  if (latest && latest.isCompleted === false) {
    throw new Error("Cannot remove player during an active hand");
  }

  // Refund remaining buy-in back to player's wallet
  if (seat.buyIn > 0) {
    await tx
      .update(users)
      .set({ balance: sql`${users.balance} + ${seat.buyIn}` })
      .where(eq(users.id, playerId));
  }

  // Remove seat
  await tx.delete(seats).where(eq(seats.id, seat.id));

  return { ok: true };
}
