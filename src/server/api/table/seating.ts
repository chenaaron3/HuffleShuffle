import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import {
  buyIn,
  cashOut,
  ensureAccount,
  getWalletBalance,
} from "~/server/api/ledger";
import { db } from "~/server/db";
import { games, piDevices, seats, users } from "~/server/db/schema";
import { rsaEncryptB64 } from "~/utils/crypto";

type Tx = {
  insert: typeof db.insert;
  query: typeof db.query;
  update: typeof db.update;
  delete: typeof db.delete;
  select: typeof db.select;
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
 * Shared transaction logic for creating a seat (used by both join and addBot).
 * Moves wallet → table escrow via ledger buy-in (humans and bots).
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
  const {
    tableId,
    playerId,
    seatNumber,
    buyIn: buyInAmount,
    userPublicKey,
  } = params;

  await tx
    .update(users)
    .set({ publicKey: userPublicKey })
    .where(eq(users.id, playerId));

  const walletBalance = await getWalletBalance(tx, playerId);
  if (walletBalance < buyInAmount) {
    throw new Error("Insufficient balance for buy-in");
  }

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

  const nonce = crypto.randomUUID();
  const encUser = await rsaEncryptB64(userPublicKey, nonce);
  const encPi = await rsaEncryptB64(pi.publicKey, nonce);

  const seatRows = await tx
    .insert(seats)
    .values({
      tableId,
      playerId,
      seatNumber,
      buyIn: buyInAmount,
      startingBalance: buyInAmount,
      seatStatus: "active",
      encryptedUserNonce: encUser,
      encryptedPiNonce: encPi,
    })
    .returning();

  const seat = seatRows[0];
  if (!seat) throw new Error("Failed to create seat");

  await buyIn(tx, {
    userId: playerId,
    tableId,
    amount: buyInAmount,
    idempotencyKey: `buyIn:${seat.id}`,
  });

  return seat;
}

/**
 * Shared transaction logic for removing a player seat from a table.
 * Used by leave, removePlayer, and removeBot.
 */
export async function removePlayerSeatTransaction(
  tx: Tx,
  params: {
    tableId: string;
    playerId: string;
  },
): Promise<{ ok: true }> {
  const { tableId, playerId } = params;

  const seat = await tx.query.seats.findFirst({
    where: and(eq(seats.tableId, tableId), eq(seats.playerId, playerId)),
  });
  if (!seat) throw new Error("Seat not found");

  const latest = await tx.query.games.findFirst({
    where: eq(games.tableId, tableId),
    orderBy: (g, { desc }) => [desc(g.createdAt)],
  });

  if (latest && latest.isCompleted === false) {
    throw new Error("Cannot remove player during an active hand");
  }

  const escrow = await ensureAccount(tx, {
    kind: "TABLE_USER_ESCROW",
    tableId,
    userId: playerId,
  });

  if (escrow.balance !== seat.buyIn) {
    throw new Error(
      `Escrow/stack mismatch on leave: escrow=${escrow.balance} stack=${seat.buyIn}`,
    );
  }

  await cashOut(tx, {
    userId: playerId,
    tableId,
    amount: seat.buyIn,
    idempotencyKey: `cashOut:${seat.id}`,
  });

  await tx.delete(seats).where(eq(seats.id, seat.id));

  return { ok: true };
}
