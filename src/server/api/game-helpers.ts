import crypto from 'crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '~/server/db';
import { games, piDevices, pokerTables, seats, users } from '~/server/db/schema';
import { rsaEncryptB64 } from '~/utils/crypto';

import { logCall, logCheck, logFold, logRaise } from './game-event-logger';
import { getNextActiveSeatId } from './game-utils';
import { evaluateBettingTransition } from './hand-solver';

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
    tableId: string;
    game: GameRow;
    actorSeat: SeatRow;
    orderedSeats: SeatRow[];
    action: "RAISE" | "CHECK" | "FOLD";
    raiseAmount?: number;
  },
): Promise<{ updatedSeat: SeatRow; nextSeatId: string | null }> {
  const { tableId, game, actorSeat, orderedSeats, action, raiseAmount } =
    params;

  // Calculate max bet from all non-folded, non-eliminated players
  const maxPlayerBet = Math.max(
    ...orderedSeats
      .filter((s) => s.seatStatus !== "folded" && s.seatStatus !== "eliminated")
      .map((s) => s.currentBet),
    0,
  );

  let updatedSeat = { ...actorSeat };

  if (action === "RAISE") {
    const amount = raiseAmount ?? 0;
    if (amount <= 0 || amount < maxPlayerBet) {
      throw new Error(
        `Invalid raise amount, must be at least the max bet of ${maxPlayerBet}`,
      );
    }

    // Re-fetch seat within transaction to ensure we have latest values
    const currentSeat = await tx.query.seats.findFirst({
      where: eq(seats.id, actorSeat.id),
    });
    if (!currentSeat) {
      throw new Error("Seat not found");
    }

    // Calculate using fresh database values (not stale actorSeat)
    const requestedTotal = amount - currentSeat.currentBet;

    // Ensure requestedTotal is positive (can't raise to less than current bet)
    if (requestedTotal <= 0) {
      // Already at or above the raise amount, just check
      await tx
        .update(seats)
        .set({ lastAction: "CHECK" })
        .where(eq(seats.id, actorSeat.id));
      return {
        updatedSeat,
        nextSeatId: getNextActiveSeatId(orderedSeats, actorSeat.id),
      };
    }

    // If not enough chips for requested raise, go all-in with remaining chips
    const actualTotal = Math.min(requestedTotal, currentSeat.buyIn);

    // Safety check: ensure we don't go negative
    if (actualTotal <= 0) {
      // No chips to raise with, just check
      await tx
        .update(seats)
        .set({ lastAction: "CHECK" })
        .where(eq(seats.id, actorSeat.id));
      return {
        updatedSeat,
        nextSeatId: getNextActiveSeatId(orderedSeats, actorSeat.id),
      };
    }

    const newBuyIn = currentSeat.buyIn - actualTotal;
    const newStatus = newBuyIn === 0 ? "all-in" : "active";

    // Use explicit values, not SQL expressions, to ensure consistency
    await tx
      .update(seats)
      .set({
        buyIn: newBuyIn,
        currentBet: currentSeat.currentBet + actualTotal,
        lastAction: "RAISE",
        seatStatus: newStatus,
      })
      .where(eq(seats.id, actorSeat.id));

    updatedSeat.buyIn = newBuyIn;
    updatedSeat.currentBet = currentSeat.currentBet + actualTotal;
    updatedSeat.seatStatus = newStatus;

    await logRaise(tx as any, tableId, game.id, {
      seatId: actorSeat.id,
      total: currentSeat.currentBet + actualTotal, // Log actual final bet amount
    });
  } else if (action === "CHECK") {
    // Re-fetch seat within transaction to ensure we have latest values
    const currentSeat = await tx.query.seats.findFirst({
      where: eq(seats.id, actorSeat.id),
    });
    if (!currentSeat) {
      throw new Error("Seat not found");
    }

    // Calculate using fresh database values
    const need = maxPlayerBet - currentSeat.currentBet;

    if (need > 0) {
      // Player is calling (matching the bet)
      // Calculate actual bet - can't bet more than available
      const actualBet = Math.min(need, currentSeat.buyIn);

      // Safety check: ensure we don't go negative
      if (actualBet <= 0) {
        // No chips to call with, just check (already all-in or no chips)
        await tx
          .update(seats)
          .set({ lastAction: "CHECK" })
          .where(eq(seats.id, actorSeat.id));
      } else {
        const newBuyIn = currentSeat.buyIn - actualBet;
        const newStatus = newBuyIn === 0 ? "all-in" : "active";

        // Use explicit values, not SQL expressions, to ensure consistency
        await tx
          .update(seats)
          .set({
            buyIn: newBuyIn,
            currentBet: currentSeat.currentBet + actualBet,
            lastAction: "CALL",
            seatStatus: newStatus,
          })
          .where(eq(seats.id, actorSeat.id));

        updatedSeat.buyIn = newBuyIn;
        updatedSeat.currentBet = currentSeat.currentBet + actualBet;
        updatedSeat.seatStatus = newStatus;
      }

      await logCall(tx as any, tableId, game.id, {
        seatId: actorSeat.id,
        total: updatedSeat.currentBet,
      });
    } else {
      // Player is checking (no bet to match)
      await tx
        .update(seats)
        .set({ lastAction: "CHECK" })
        .where(eq(seats.id, actorSeat.id));

      await logCheck(tx as any, tableId, game.id, {
        seatId: actorSeat.id,
        total: maxPlayerBet,
      });
    }
  } else if (action === "FOLD") {
    await tx
      .update(seats)
      .set({ seatStatus: "folded", lastAction: "FOLD" })
      .where(eq(seats.id, actorSeat.id));

    updatedSeat.seatStatus = "folded";

    await logFold(tx as any, tableId, game.id, {
      seatId: actorSeat.id,
    });
  }

  // Get next active seat
  const nextSeatId = getNextActiveSeatId(orderedSeats, actorSeat.id);

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
  await evaluateBettingTransition(tx, tableId, {
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
