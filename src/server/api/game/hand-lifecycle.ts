import { eq, sql } from "drizzle-orm";
import process from "process";
import { isBot } from "~/server/api/bots/constants";
import { createBotGameState, makeBotDecision } from "~/server/api/bots/strategy";
import { computeBlindState } from "~/server/api/lib/blind-timer";
import { logEndGame, logStartGame } from "~/server/api/lib/game-event-logger";
import { withTableMutation } from "~/server/api/lib/table-transaction";
import { db } from "~/server/db";
import { games, pokerTables, seats } from "~/server/db/schema";
import { updateTable } from "~/server/signal";

import { executeBettingAction } from "~/server/api/game/betting-actions";
import {
  collectBigAndSmallBlind,
  getBigAndSmallBlindSeats,
  resolveHandBlindLayout,
} from "~/server/api/game/blind-layout";
import { nonEliminatedCountOf } from "./helpers/seats";

type DB = typeof db;
type SeatRow = typeof seats.$inferSelect;
type GameRow = typeof games.$inferSelect;
type TableRow = typeof pokerTables.$inferSelect;

type Tx = {
  insert: typeof db.insert;
  query: typeof db.query;
  update: typeof db.update;
};

export async function resetGame(
  tx: Tx,
  game: GameRow | null,
  orderedSeats: Array<SeatRow>,
  resetBalance: boolean = false,
  wasReset: boolean = false,
): Promise<void> {
  // Reset all seats, but preserve eliminated status
  for (const s of orderedSeats) {
    const updateData: any = {
      cards: sql`ARRAY[]::text[]`,
      currentBet: 0,
      handType: null,
      handDescription: null,
      winAmount: 0,
      winningCards: sql`ARRAY[]::text[]`,
      voluntaryShow: false,
    };

    // Only reset seatStatus to active if the player is NOT eliminated
    if (s.seatStatus !== "eliminated") {
      updateData.seatStatus = "active";
    }

    // Only reset buyIn to startingBalance if explicitly requested
    if (resetBalance) {
      updateData.buyIn = s.startingBalance;
    }

    await tx.update(seats).set(updateData).where(eq(seats.id, s.id));

    s.cards = [];
    // Preserve eliminated status
    if (s.seatStatus !== "eliminated") {
      s.seatStatus = "active";
    }
    s.currentBet = 0;
    s.handType = null;
    s.handDescription = null;
    s.winAmount = 0;
    s.winningCards = [];
    s.voluntaryShow = false;

    // Only reset buyIn to startingBalance if explicitly requested
    if (resetBalance) {
      s.buyIn = s.startingBalance;
    }
  }

  // Mark current game as completed and reset pot total (if there is one)
  if (game && !game.isCompleted) {
    await tx
      .update(games)
      .set({
        communityCards: sql`ARRAY[]::text[]`,
        assignedSeatId: null,
        isCompleted: true,
        potTotal: 0,
        state: "DEAL_HOLE_CARDS",
        wasReset,
      })
      .where(eq(games.id, game.id));
    // End game with no winners
    await logEndGame(tx, game.tableId, game.id, {
      winners: [],
    });
  }
}

export async function createNewGame(
  tx: Tx,
  table: TableRow,
  orderedSeats: Array<SeatRow>,
  previousGame: GameRow | null,
): Promise<GameRow> {
  // Reset all seats and mark current game as completed (if exists)
  await resetGame(tx, previousGame, orderedSeats);

  // Check that we have at least 2 non-eliminated players
  const nonEliminatedCount = nonEliminatedCountOf(orderedSeats);
  if (nonEliminatedCount < 2) {
    throw new Error(
      `Cannot start game: Need at least 2 players with chips. Currently ${nonEliminatedCount} player(s) remaining.`,
    );
  }

  // Update startingBalance to current buyIn for all non-eliminated players before starting new game
  for (const seat of orderedSeats) {
    await tx
      .update(seats)
      .set({ startingBalance: seat.buyIn })
      .where(eq(seats.id, seat.id));
    seat.startingBalance = seat.buyIn; // Update in-memory object too
  }

  // Compute effective blinds at game start (these will remain constant for the entire game)
  const blindState = computeBlindState(table);
  const effectiveSmallBlind = blindState.effectiveSmallBlind;
  const effectiveBigBlind = blindState.effectiveBigBlind;

  const {
    dealerButtonSeatNumber,
    smallBlindSeatNumber,
    bigBlindSeatNumber,
  } = resolveHandBlindLayout(orderedSeats, previousGame);
  const createdRows = await (tx as DB)
    .insert(games)
    .values({
      tableId: table.id,
      isCompleted: false,
      state: "DEAL_HOLE_CARDS",
      dealerButtonSeatNumber,
      smallBlindSeatNumber,
      bigBlindSeatNumber,
      communityCards: [],
      potTotal: 0,
      betCount: 0,
      requiredBetCount: 0,
      effectiveSmallBlind,
      effectiveBigBlind,
    })
    .returning();
  const game = createdRows?.[0];
  if (!game) throw new Error("Failed to create game");

  // Collect blinds; deal hole cards starting at SB (or BB when no SB)
  await collectBigAndSmallBlind(tx, orderedSeats, game);
  const { smallBlindSeat, bigBlindSeat } = getBigAndSmallBlindSeats(
    orderedSeats,
    game,
  );

  const firstDealSeatId = smallBlindSeat?.id ?? bigBlindSeat.id;
  await tx
    .update(games)
    .set({
      assignedSeatId: firstDealSeatId,
    })
    .where(eq(games.id, game.id));
  game.assignedSeatId = firstDealSeatId;

  await logStartGame(tx as any, table.id, game.id, {
    dealerButtonSeatNumber,
  });
  return game;
}

// Shared function to notify clients of table state changes
// Used in TRPC API and also consumer
export async function notifyTableUpdate(tableId: string): Promise<void> {
  if (process.env.NODE_ENV === "test") return;
  await updateTable(tableId);
}

export type BotActionLogEvent = {
  seatNumber: number;
  action: string;
  /** Present when action is RAISE — total bet amount (chips). */
  raiseTo?: number;
};

export type TriggerBotActionsHooks = {
  onBotAction?: (e: BotActionLogEvent) => void;
};

/**
 * Trigger bot actions in a loop until a human player's turn
 * Takes a database instance (DB) to work in both main app and lambda consumer contexts
 * Uses the database to create multiple transactions (one per bot action) with sleeps between them
 */
export async function triggerBotActions(
  database: DB,
  tableId: string,
  hooks?: TriggerBotActionsHooks,
): Promise<void> {
  let iterations = 0;
  const defaultMax =
    process.env.NODE_ENV === "test" && !process.env.BOT_ACTION_MAX_ITERATIONS
      ? 200
      : 20;
  const MAX_ITERATIONS = Number(
    process.env.BOT_ACTION_MAX_ITERATIONS ?? defaultMax,
  );
  const defaultDelayMs =
    process.env.NODE_ENV === "test" && process.env.BOT_ACTION_DELAY_MS === undefined
      ? 0
      : 500;
  const delayMs = Number(process.env.BOT_ACTION_DELAY_MS ?? defaultDelayMs);

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    // Fetch current game state
    const snapshot = await database.query.pokerTables.findFirst({
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

    // Execute bot action under the per-table mutation lock
    await withTableMutation(database, tableId, async (txInner) => {
      // Re-fetch within transaction
      const orderedSeats = await txInner.query.seats.findMany({
        where: eq(seats.tableId, tableId),
        orderBy: (s, { asc }) => [asc(s.seatNumber)],
      });

      const currentGame = await txInner.query.games.findFirst({
        where: eq(games.id, game.id),
      });

      if (!currentGame) throw new Error("Game not found");

      const botSeat = orderedSeats.find((s) => s.id === currentSeat.id);
      if (!botSeat || botSeat.seatStatus !== "active") return;

      // Create game state for bot decision
      const gameState = createBotGameState(botSeat, currentGame, orderedSeats);

      // Make intelligent decision
      const decision = makeBotDecision(gameState);

      // Execute the bot's decision
      await executeBettingAction(txInner, {
        actorSeatId: botSeat.id,
        gameId: currentGame.id,
        action: decision.action,
        raiseAmount: decision.action === "RAISE" ? decision.amount : undefined,
      });

      hooks?.onBotAction?.({
        seatNumber: botSeat.seatNumber,
        action: decision.action,
        raiseTo:
          decision.action === "RAISE" ? decision.amount : undefined,
      });
    });

    // Notify clients of table update after successful transaction
    await notifyTableUpdate(tableId);

    // Wait before next iteration (0 in test by default for headless stress runs)
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  if (iterations >= MAX_ITERATIONS) {
    console.error("Bot actions: Max iterations reached", {
      maxIterations: MAX_ITERATIONS,
      tableId,
    });
  }
}
