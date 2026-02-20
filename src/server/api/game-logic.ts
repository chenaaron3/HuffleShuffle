import { and, eq, isNotNull, sql } from 'drizzle-orm';
import process from 'process';
import {
    logEndGame, logFlop, logRiver, logStartGame, logTurn
} from '~/server/api/game-event-logger';
import { db } from '~/server/db';
import { games, pokerTables, seats } from '~/server/db/schema';
import { updateTable } from '~/server/signal';

import { computeBlindState } from './blind-timer';
import { isBot } from './bot-constants';
import { createBotGameState, makeBotDecision } from './bot-strategy';
import { executeBettingAction } from './game-helpers';
import {
    activeCountOf, fetchAllSeatsInOrder, getNextActiveSeatId, getNextDealableSeatId,
    nonEliminatedCountOf
} from './game-utils';
import { evaluateBettingTransition } from './hand-solver';

type DB = typeof db;
type SeatRow = typeof seats.$inferSelect;
type GameRow = typeof games.$inferSelect;
type TableRow = typeof pokerTables.$inferSelect;

type Tx = {
  insert: typeof db.insert;
  query: typeof db.query;
  update: typeof db.update;
};

// Check if more players needs cards. If so, rotate to the next player
// After all hole cards are dealt, start a new betting round
// Player after big blind starts first
export async function ensureHoleCardsProgression(
  tx: Tx,
  tableId: string,
  gameObj: GameRow,
  orderedSeats: SeatRow[],
  currentSeatId: string,
): Promise<void> {
  // Check if all dealable players (active + all-in) have two cards
  // Players who went all-in posting blinds still need their hole cards
  const allHaveTwo = orderedSeats
    .filter(
      (s: SeatRow) => s.seatStatus === "active" || s.seatStatus === "all-in",
    )
    .every((s: SeatRow) => s.cards.length >= 2);
  if (!allHaveTwo) {
    const nextSeatId = getNextDealableSeatId(orderedSeats, currentSeatId);
    await tx
      .update(games)
      .set({ assignedSeatId: nextSeatId })
      .where(eq(games.id, gameObj.id));
  } else {
    // Initialize betting round with non-contiguous active seats:
    // small blind is next active after dealer, big blind next after small blind,
    // first to act (UTG) is next active after big blind.
    const smallBlindSeatId = getNextActiveSeatId(
      orderedSeats,
      gameObj.dealerButtonSeatId!,
    );
    const bigBlindSeatId = getNextActiveSeatId(orderedSeats, smallBlindSeatId);
    const firstToActId = getNextActiveSeatId(orderedSeats, bigBlindSeatId);
    await startBettingRound(tx, tableId, gameObj, orderedSeats, firstToActId);
  }
}

// After flop, turn, or river is dealt, start a new betting round
// The person after the dealer always starts
export async function ensurePostflopProgression(
  tx: Tx,
  tableId: string,
  gameObj: GameRow,
  orderedSeats: Array<SeatRow>,
): Promise<void> {
  // Postflop: start with next active seat left of dealer button
  const firstToActId = getNextActiveSeatId(
    orderedSeats,
    gameObj.dealerButtonSeatId!,
  );
  await startBettingRound(tx, tableId, gameObj, orderedSeats, firstToActId);
}

// Start the betting round by transitioning the state
// and resetting the betting count
// Also reset the last action for fresh bet statuses
async function startBettingRound(
  tx: Tx,
  tableId: string,
  gameObj: GameRow,
  orderedSeats: Array<SeatRow>,
  firstToActId: string,
): Promise<void> {
  const activeCount = activeCountOf(orderedSeats);
  console.log("startBettingRound - activeCount:", activeCount);
  console.log(
    "Seats:",
    orderedSeats.map((s) => ({
      status: s.seatStatus,
      buyIn: s.buyIn,
      bet: s.currentBet,
    })),
  );

  const effectiveBigBlind = gameObj.effectiveBigBlind ?? 0;
  await tx
    .update(games)
    .set({
      state: "BETTING",
      assignedSeatId: firstToActId,
      turnStartTime: new Date(), // Set turn start time in game record
      betCount: 0,
      requiredBetCount: activeCount,
      lastRaiseIncrement: effectiveBigBlind, // Min raise = previous raise increment; BB for first raise of round
    })
    .where(eq(games.id, gameObj.id));
  // Clear lastAction for all seats at the start of the next betting round
  await tx
    .update(seats)
    .set({ lastAction: null })
    .where(eq(seats.tableId, tableId));

  // Edge case: If no active players remain (all went all-in or folded),
  // skip betting and proceed directly to next dealing state
  if (activeCount <= 1) {
    await evaluateBettingTransition(tx, tableId, {
      ...gameObj,
      state: "BETTING",
      assignedSeatId: firstToActId,
      betCount: 0,
      requiredBetCount: activeCount,
    });
  }
}

// Card dealing logic that can be shared between consumer and table router
export async function dealCard(
  tx: Tx,
  tableId: string,
  game: GameRow | null,
  cardCode: string,
): Promise<void> {
  // Start a new game on card deal
  if (game === null || game.isCompleted) {
    const table = await tx.query.pokerTables.findFirst({
      where: eq(pokerTables.id, tableId),
    });
    if (!table) throw new Error("Table not found");

    const orderedSeats = await fetchAllSeatsInOrder(tx, tableId);
    game = await createNewGame(tx, table, orderedSeats, game);
  }

  // Must be dealing cards to active seats
  const orderedSeats = await fetchAllSeatsInOrder(tx, tableId);
  // Check if card already dealt
  const seen = new Set<string>();
  orderedSeats.forEach((s) => s.cards.forEach((c) => seen.add(c)));
  (game.communityCards ?? []).forEach((c) => seen.add(c));
  if (seen.has(cardCode)) throw new Error("Card already dealt");

  if (game.state === "DEAL_HOLE_CARDS") {
    // Get the assigned seat to deal to
    if (!game.assignedSeatId) {
      throw new Error("No assigned seat for dealing hole cards");
    }
    const seat = orderedSeats.find((s) => s.id === game.assignedSeatId);
    if (!seat) {
      throw new Error("Assigned seat not found in ordered seats");
    }

    // Add a card to the seat and also update it in memory
    await tx
      .update(seats)
      .set({ cards: sql`array_append(${seats.cards}, ${cardCode})` })
      .where(eq(seats.id, seat.id));
    seat.cards.push(cardCode);

    // Continue to next player or move to betting round
    await ensureHoleCardsProgression(tx, tableId, game, orderedSeats, seat.id);
  } else if (
    game.state === "DEAL_FLOP" ||
    game.state === "DEAL_TURN" ||
    game.state === "DEAL_RIVER"
  ) {
    // Update the community card and also update it in memory
    await tx
      .update(games)
      .set({
        communityCards: sql`array_append(${games.communityCards}, ${cardCode})`,
      })
      .where(eq(games.id, game.id));
    game.communityCards.push(cardCode);

    // After reaching a certain number of cards, enter betting round
    const cc = game.communityCards.length;
    if (
      (game.state === "DEAL_FLOP" && cc == 3) ||
      (game.state === "DEAL_TURN" && cc == 4) ||
      (game.state === "DEAL_RIVER" && cc == 5)
    ) {
      // Emit FLOP/TURN/RIVER event with full community cards
      const payload = {
        communityAll: game.communityCards,
      };
      if (game.state === "DEAL_FLOP") {
        await logFlop(tx as any, tableId, game.id, payload);
      } else if (game.state === "DEAL_TURN") {
        await logTurn(tx as any, tableId, game.id, payload);
      } else {
        await logRiver(tx as any, tableId, game.id, payload);
      }
      await ensurePostflopProgression(tx, tableId, game, orderedSeats);
    }
  } else {
    throw new Error("DEAL_CARD not valid in current state");
  }
}

// Generate a random card that hasn't been dealt yet
// Has access to all player hands and community cards to ensure randomness
export async function generateRandomCard(
  tx: Tx,
  tableId: string,
  game: GameRow | null,
): Promise<string> {
  // Step 1: Deterministically enumerate all undealt cards
  // Get all seats to collect dealt cards (seats exist even if no game)
  const orderedSeats = await fetchAllSeatsInOrder(tx, tableId);

  // Collect all dealt cards from seats and community cards (if game exists)
  const dealt = new Set<string>();
  orderedSeats.forEach((s) => s.cards.forEach((c) => dealt.add(c)));
  if (game && game.communityCards) {
    game.communityCards.forEach((c) => dealt.add(c));
  }

  // Generate full deck deterministically
  const RANKS = [
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "T",
    "J",
    "Q",
    "K",
    "A",
  ];
  const SUITS = ["s", "h", "d", "c"];
  const deck: string[] = [];
  for (const r of RANKS) {
    for (const s of SUITS) {
      deck.push(`${r}${s}`);
    }
  }

  // Deterministically filter to undealt cards
  const undealtCards = deck.filter((c) => !dealt.has(c));
  if (undealtCards.length === 0) {
    throw new Error("No cards remaining to deal");
  }

  // Step 2: Randomly select one from the undealt cards
  const randomIndex = Math.floor(Math.random() * undealtCards.length);
  const randomCard = undealtCards[randomIndex]!;

  // Convert from internal format (e.g., "As") to barcode format (e.g., "1010")
  const rank = randomCard.slice(0, -1);
  const suit = randomCard.slice(-1);
  return parseRankSuitToBarcode(rank, suit);
}

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

  // Create a new game object
  let dealerButtonSeatId = orderedSeats[0]!.id;
  if (previousGame) {
    // If there was a previous game and it was NOT reset, progress the dealer button
    // If it WAS reset (via RESET_TABLE action), reuse the same button position
    if (previousGame.wasReset) {
      // If previous game had a null dealer button, fallback to first seat
      dealerButtonSeatId =
        previousGame.dealerButtonSeatId ?? orderedSeats[0]!.id;
    } else {
      // Normal game progression - advance the button
      const prevButton = previousGame.dealerButtonSeatId;
      if (prevButton) {
        dealerButtonSeatId = getNextActiveSeatId(orderedSeats, prevButton);
      }
      // If prevButton is null, dealerButtonSeatId remains as orderedSeats[0]!.id
    }
  }
  const createdRows = await (tx as DB)
    .insert(games)
    .values({
      tableId: table.id,
      isCompleted: false,
      state: "DEAL_HOLE_CARDS",
      dealerButtonSeatId,
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

  // Collect big and small blind
  await collectBigAndSmallBlind(tx, orderedSeats, game);
  const { smallBlindSeat } = getBigAndSmallBlindSeats(orderedSeats, game);

  // Small blind gets the first turn
  await tx
    .update(games)
    .set({
      assignedSeatId: smallBlindSeat.id,
    })
    .where(eq(games.id, game.id));
  game.assignedSeatId = smallBlindSeat.id;

  await logStartGame(tx as any, table.id, game.id, {
    dealerButtonSeatId,
  });
  return game;
}

export function getBigAndSmallBlindSeats(
  orderedSeats: Array<SeatRow>,
  game: GameRow,
): { smallBlindSeat: SeatRow; bigBlindSeat: SeatRow } {
  const smallBlindSeat = getNextActiveSeatId(
    orderedSeats,
    game.dealerButtonSeatId!,
  );
  const bigBlindSeat = getNextActiveSeatId(orderedSeats, smallBlindSeat);
  return {
    smallBlindSeat: orderedSeats.find((s) => s.id === smallBlindSeat)!,
    bigBlindSeat: orderedSeats.find((s) => s.id === bigBlindSeat)!,
  };
}

export function getBlindState(game: GameRow): {
  effectiveSmallBlind: number;
  effectiveBigBlind: number;
} {
  return {
    effectiveSmallBlind: game.effectiveSmallBlind ?? 0,
    effectiveBigBlind: game.effectiveBigBlind ?? 0,
  };
}

async function collectBigAndSmallBlind(
  tx: Tx,
  orderedSeats: Array<SeatRow>,
  game: GameRow,
): Promise<void> {
  const { smallBlindSeat, bigBlindSeat } = getBigAndSmallBlindSeats(
    orderedSeats,
    game,
  );
  const blinds = getBlindState(game);
  const smallBlindValue = blinds.effectiveSmallBlind;
  const bigBlindValue = blinds.effectiveBigBlind;

  // Collect small blind - if player doesn't have enough, go all-in
  const smallBlindActual = Math.min(smallBlindValue, smallBlindSeat.buyIn);
  const smallBlindNewBuyIn = smallBlindSeat.buyIn - smallBlindActual;
  const smallBlindNewStatus = smallBlindNewBuyIn === 0 ? "all-in" : "active";

  await tx
    .update(seats)
    .set({
      currentBet: smallBlindActual,
      buyIn: sql`${seats.buyIn} - ${smallBlindActual}`,
      seatStatus: smallBlindNewStatus,
    })
    .where(eq(seats.id, smallBlindSeat.id));

  // Update in-memory seat object
  smallBlindSeat.currentBet = smallBlindActual;
  smallBlindSeat.buyIn = smallBlindNewBuyIn;
  smallBlindSeat.seatStatus = smallBlindNewStatus;

  // Collect big blind - if player doesn't have enough, go all-in
  const bigBlindActual = Math.min(bigBlindValue, bigBlindSeat.buyIn);
  const bigBlindNewBuyIn = bigBlindSeat.buyIn - bigBlindActual;
  const bigBlindNewStatus = bigBlindNewBuyIn === 0 ? "all-in" : "active";

  await tx
    .update(seats)
    .set({
      currentBet: bigBlindActual,
      buyIn: sql`${seats.buyIn} - ${bigBlindActual}`,
      seatStatus: bigBlindNewStatus,
    })
    .where(eq(seats.id, bigBlindSeat.id));

  // Update in-memory seat object
  bigBlindSeat.currentBet = bigBlindActual;
  bigBlindSeat.buyIn = bigBlindNewBuyIn;
  bigBlindSeat.seatStatus = bigBlindNewStatus;
}

export function parseBarcodeToRankSuit(barcode: string): {
  rank: string;
  suit: string;
} {
  const suitCode = barcode.slice(0, 1);
  const rankCode = barcode.slice(1);
  const suitMap: Record<string, string> = {
    "1": "s",
    "2": "h",
    "3": "c",
    "4": "d",
  };
  const rankMap: Record<string, string> = {
    "010": "A",
    "020": "2",
    "030": "3",
    "040": "4",
    "050": "5",
    "060": "6",
    "070": "7",
    "080": "8",
    "090": "9",
    "100": "T",
    "110": "J",
    "120": "Q",
    "130": "K",
  };
  const suit = suitMap[suitCode];
  const rank = rankMap[rankCode];
  if (!suit || !rank) throw new Error("Invalid barcode");
  return { rank, suit };
}

export function parseRankSuitToBarcode(rank: string, suit: string): string {
  const suitMap: Record<string, string> = {
    s: "1",
    h: "2",
    c: "3",
    d: "4",
  };
  const rankMap: Record<string, string> = {
    A: "010",
    "2": "020",
    "3": "030",
    "4": "040",
    "5": "050",
    "6": "060",
    "7": "070",
    "8": "080",
    "9": "090",
    T: "100",
    J: "110",
    Q: "120",
    K: "130",
  };
  const suitCode = suitMap[suit];
  const rankCode = rankMap[rank];
  if (!suitCode || !rankCode) throw new Error("Invalid rank or suit");
  return `${suitCode}${rankCode}`;
}

// Shared function to notify clients of table state changes
// Used in TRPC API and also consumer
export async function notifyTableUpdate(tableId: string): Promise<void> {
  if (process.env.NODE_ENV === "test") return;
  await updateTable(tableId);
}

/**
 * Trigger bot actions in a loop until a human player's turn
 * Takes a database instance (DB) to work in both main app and lambda consumer contexts
 * Uses the database to create multiple transactions (one per bot action) with sleeps between them
 */
export async function triggerBotActions(
  database: DB,
  tableId: string,
): Promise<void> {
  let iterations = 0;
  const MAX_ITERATIONS = 20; // Safety limit

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

    // Execute bot action
    await database.transaction(async (txInner) => {
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
    });

    // Notify clients of table update after successful transaction
    await notifyTableUpdate(tableId);

    // Wait before next iteration
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (iterations >= MAX_ITERATIONS) {
    console.error("Bot actions: Max iterations reached");
  }
}
