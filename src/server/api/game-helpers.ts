import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "~/server/db";
import {
  games,
  piDevices,
  pokerTables,
  seats,
  users,
} from "~/server/db/schema";
import { rsaEncryptB64 } from "~/utils/crypto";

import { logCall, logCheck, logFold, logRaise } from "./game-event-logger";
import { fetchAllSeatsInOrder, getNextActiveSeatId } from "./game-utils";
import { evaluateBettingTransition } from "./hand-solver";

type Tx = {
  insert: typeof db.insert;
  query: typeof db.query;
  update: typeof db.update;
  delete: typeof db.delete;
};

type SeatRow = typeof seats.$inferSelect;
type GameRow = typeof games.$inferSelect;

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
 * Execute a betting action (RAISE, CHECK/CALL, FOLD) and update game state
 * This includes the action itself, bet count increment, turn rotation, and betting transition evaluation
 */
export async function executeBettingAction(
  tx: Tx,
  params: {
    actorSeatId: string;
    gameId: string;
    action: "RAISE" | "CHECK" | "FOLD";
    raiseAmount?: number;
  },
): Promise<{ updatedSeat: SeatRow; nextSeatId: string | null }> {
  const { actorSeatId, gameId, action, raiseAmount } = params;

  // Query game to get tableId
  const game = await tx.query.games.findFirst({
    where: eq(games.id, gameId),
  });
  if (!game) {
    throw new Error("Game not found");
  }

  // Query ordered seats for the table
  const orderedSeats = await fetchAllSeatsInOrder(tx, game.tableId);

  // Find actor seat from ordered seats
  const currentSeat = orderedSeats.find((s) => s.id === actorSeatId);
  if (!currentSeat) {
    throw new Error("Actor seat not found");
  }

  // Calculate max bet from all non-folded, non-eliminated players
  const maxPlayerBet = Math.max(
    ...orderedSeats
      .filter((s) => s.seatStatus !== "folded" && s.seatStatus !== "eliminated")
      .map((s) => s.currentBet),
    0,
  );

  // Variables for all actions
  const currentBet = currentSeat.currentBet;
  const availableFunds = currentSeat.buyIn;

  // Variables to be set in action branches
  let fundsRequested = 0;
  let effectiveAction: "RAISE" | "CALL" | "CHECK" | "FOLD" = action;
  let effectiveStatus: "active" | "all-in" | "folded" | "eliminated" = "active";

  // Validate and compute action-specific values
  if (action === "RAISE") {
    const amount = raiseAmount ?? 0;
    // Validation: ensure raise > maxbet
    if (amount <= maxPlayerBet) {
      throw new Error(
        `Invalid raise amount, must be greater than the max bet of ${maxPlayerBet}`,
      );
    }

    fundsRequested = amount - currentBet;
    effectiveAction = "RAISE";
  } else if (action === "CHECK") {
    // Validation: ensure max == currentBet (if not, it becomes a call)
    if (maxPlayerBet > currentBet) {
      // This becomes a call - validate that maxbet > currentbet (which we know is true)
      fundsRequested = maxPlayerBet - currentBet;
      effectiveAction = "CALL";
    } else if (maxPlayerBet < currentBet) {
      throw new Error("Invalid check: current bet exceeds max bet");
    } else {
      // maxPlayerBet == currentBet, so it's a check
      fundsRequested = 0;
      effectiveAction = "CHECK";
    }
  } else if (action === "FOLD") {
    // No validation needed for fold
    fundsRequested = 0;
    effectiveAction = "FOLD";
    effectiveStatus = "folded";
  }

  // Adjust fundsRequested if player doesn't have enough funds (allow going all-in)
  if (fundsRequested > availableFunds) {
    fundsRequested = availableFunds;
  }

  // Update seat: deduct from buyIn and add to currentBet (if needed)
  const newBuyIn = availableFunds - fundsRequested;
  const newCurrentBet = currentBet + fundsRequested;

  // Update effectiveStatus if not already set (e.g., for FOLD)
  if (effectiveStatus !== "folded") {
    effectiveStatus = newBuyIn === 0 ? "all-in" : "active";
  }

  const [updatedSeat] = await tx
    .update(seats)
    .set({
      buyIn: newBuyIn,
      currentBet: newCurrentBet,
      lastAction: effectiveAction,
      seatStatus: effectiveStatus,
    })
    .where(eq(seats.id, actorSeatId))
    .returning();

  if (!updatedSeat) {
    throw new Error("Failed to update seat");
  }

  // Log the action
  if (effectiveAction === "RAISE") {
    await logRaise(tx as any, game.tableId, game.id, {
      seatId: actorSeatId,
      total: newCurrentBet,
    });
  } else if (effectiveAction === "CALL") {
    await logCall(tx as any, game.tableId, game.id, {
      seatId: actorSeatId,
      total: newCurrentBet,
    });
  } else if (effectiveAction === "CHECK") {
    await logCheck(tx as any, game.tableId, game.id, {
      seatId: actorSeatId,
      total: maxPlayerBet,
    });
  } else if (effectiveAction === "FOLD") {
    await logFold(tx as any, game.tableId, game.id, {
      seatId: actorSeatId,
    });
  }

  // Get next active seat
  const nextSeatId = getNextActiveSeatId(orderedSeats, actorSeatId);

  // Increment betCount and rotate to next player
  await tx
    .update(games)
    .set({ betCount: sql`${games.betCount} + 1` })
    .where(eq(games.id, game.id));

  await tx
    .update(games)
    .set({
      assignedSeatId: nextSeatId,
      turnStartTime: nextSeatId ? new Date() : null,
    })
    .where(eq(games.id, game.id));

  // Evaluate if betting round is complete
  await evaluateBettingTransition(tx, game.tableId, {
    ...game,
    betCount: game.betCount + 1,
    assignedSeatId: nextSeatId,
  });

  return { updatedSeat, nextSeatId };
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
