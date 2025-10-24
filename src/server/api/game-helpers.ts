import crypto from 'crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '~/server/db';
import { games, piDevices, pokerTables, seats, users } from '~/server/db/schema';
import { rsaEncryptB64 } from '~/utils/crypto';

import { isBot } from './bot-constants';
import { logCall, logCheck, logFold, logRaise } from './game-event-logger';
import { notifyTableUpdate } from './game-logic';
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
  const maxBet = Math.max(
    ...orderedSeats
      .filter((s) => s.seatStatus !== "folded" && s.seatStatus !== "eliminated")
      .map((s) => s.currentBet),
    0,
  );

  let updatedSeat = { ...actorSeat };

  if (action === "RAISE") {
    const amount = raiseAmount ?? 0;
    if (amount <= 0 || amount < maxBet) {
      throw new Error(
        `Invalid raise amount, must be at least the max bet of ${maxBet}`,
      );
    }
    const total = amount - actorSeat.currentBet;
    if (actorSeat.buyIn < total) {
      throw new Error("Insufficient chips to raise");
    }

    const newBuyIn = actorSeat.buyIn - total;
    const newStatus = newBuyIn === 0 ? "all-in" : "active";

    await tx
      .update(seats)
      .set({
        buyIn: sql`${seats.buyIn} - ${total}`,
        currentBet: sql`${seats.currentBet} + ${total}`,
        lastAction: "RAISE",
        seatStatus: newStatus,
      })
      .where(eq(seats.id, actorSeat.id));

    updatedSeat.buyIn = newBuyIn;
    updatedSeat.currentBet += total;
    updatedSeat.seatStatus = newStatus;

    await logRaise(tx as any, tableId, game.id, {
      seatId: actorSeat.id,
      total: amount,
    });
  } else if (action === "CHECK") {
    const need = maxBet - actorSeat.currentBet;

    if (need > 0) {
      // Player is calling (matching the bet)
      const actualBet = Math.min(need, actorSeat.buyIn);
      const newBuyIn = actorSeat.buyIn - actualBet;
      const newStatus = newBuyIn === 0 ? "all-in" : "active";

      await tx
        .update(seats)
        .set({
          buyIn: sql`${seats.buyIn} - ${actualBet}`,
          currentBet: sql`${seats.currentBet} + ${actualBet}`,
          lastAction: "CALL",
          seatStatus: newStatus,
        })
        .where(eq(seats.id, actorSeat.id));

      updatedSeat.buyIn = newBuyIn;
      updatedSeat.currentBet += actualBet;
      updatedSeat.seatStatus = newStatus;

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
        total: maxBet,
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
 * Trigger bot actions in a loop until a human player's turn
 */
export async function triggerBotActions(tableId: string): Promise<void> {
  let iterations = 0;
  const MAX_ITERATIONS = 20; // Safety limit

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    // Fetch current game state
    const snapshot = await db.query.pokerTables.findFirst({
      where: eq(pokerTables.id, tableId),
      with: {
        games: { orderBy: (g, { desc }) => [desc(g.createdAt)], limit: 1 },
        seats: { orderBy: (s, { asc }) => [asc(s.seatNumber)] },
      },
    });

    if (!snapshot) return;

    const game = snapshot.games[0];
    if (!game || game.isCompleted) return;
    if (game.state !== "BETTING") return;
    if (!game.assignedSeatId) return;

    // Find the current seat
    const currentSeat = snapshot.seats.find(
      (s) => s.id === game.assignedSeatId,
    );
    if (!currentSeat) return;

    // Stop if current player is not a bot
    if (!isBot(currentSeat.playerId)) {
      return;
    }

    // Execute bot action
    await db.transaction(async (tx) => {
      // Re-fetch within transaction
      const orderedSeats = await tx.query.seats.findMany({
        where: eq(seats.tableId, tableId),
        orderBy: (s, { asc }) => [asc(s.seatNumber)],
      });

      const currentGame = await tx.query.games.findFirst({
        where: eq(games.id, game.id),
      });

      if (!currentGame) throw new Error("Game not found");

      const botSeat = orderedSeats.find((s) => s.id === currentSeat.id);
      if (!botSeat || botSeat.seatStatus !== "active") return;

      // Bot always uses CHECK action (handles check/call/all-in)
      // executeBettingAction now handles everything: action, betCount, turn rotation, and betting transition
      await executeBettingAction(tx, {
        tableId,
        game: currentGame,
        actorSeat: botSeat,
        orderedSeats,
        action: "CHECK",
      });
    });

    // Notify clients of table update after successful transaction
    await notifyTableUpdate(tableId);

    // Wait for 1 second
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (iterations >= MAX_ITERATIONS) {
    console.error("Bot actions: Max iterations reached");
  }
}
