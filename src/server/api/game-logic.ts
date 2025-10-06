import { table } from 'console';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { logFlop, logRiver, logTurn } from '~/server/api/game-event-logger';
import { db } from '~/server/db';
import { games, pokerTables, seats } from '~/server/db/schema';
import { updateTable } from '~/server/signal';

type DB = typeof db;
type SeatRow = typeof seats.$inferSelect;
type GameRow = typeof games.$inferSelect;
type TableRow = typeof pokerTables.$inferSelect;

// --- Helper utilities ---
const pickNextIndex = (currentIndex: number, total: number) =>
  (currentIndex + 1) % total;

// The input seats don't have to all be active since the
// current seat can be inactive. This finds the first active
// seat after the current seat.
export const getNextActiveSeatId = (
  orderedSeats: Array<SeatRow>,
  currentSeatId: string,
) => {
  const n = orderedSeats.length;
  const mapIndex: Record<string, number> = {};
  orderedSeats.forEach((s, i) => {
    mapIndex[s.id] = i;
  });
  let idx = mapIndex[currentSeatId] ?? 0;
  for (let i = 0; i < n; i++) {
    idx = pickNextIndex(idx, n);
    if (orderedSeats[idx]!.isActive) return orderedSeats[idx]!.id;
  }
  return orderedSeats[idx]!.id;
};

// Fetch all seats to be safe and filter by actives later
export const fetchAllSeatsInOrder = async (
  tx: { query: typeof db.query; update: typeof db.update },
  tableId: string,
): Promise<SeatRow[]> => {
  return await tx.query.seats.findMany({
    where: eq(seats.tableId, tableId),
    orderBy: (s, { asc }) => [asc(s.seatNumber)],
  });
};

export const allActiveBetsEqual = (orderedSeats: Array<SeatRow>): boolean => {
  const active = orderedSeats.filter((s) => s.isActive);
  if (active.length === 0) return true;
  return active.every((s) => s.currentBet === active[0]!.currentBet);
};

export const activeCountOf = (orderedSeats: Array<SeatRow>): number =>
  orderedSeats.filter((s) => s.isActive).length;

export async function mergeBetsIntoPotGeneric(
  tx: { query: typeof db.query; update: typeof db.update },
  gameObj: GameRow,
  orderedSeats: Array<SeatRow>,
): Promise<GameRow> {
  const total = orderedSeats.reduce((sum, s) => sum + s.currentBet, 0);
  await tx
    .update(games)
    .set({
      potTotal: sql`${games.potTotal} + ${total}`,
      betCount: 0,
      requiredBetCount: 0,
    })
    .where(eq(games.id, gameObj.id));
  for (const s of orderedSeats) {
    await tx.update(seats).set({ currentBet: 0 }).where(eq(seats.id, s.id));
    s.currentBet = 0;
  }
  return {
    ...gameObj,
    potTotal: gameObj.potTotal + total,
    betCount: 0,
    requiredBetCount: 0,
  };
}

// Check if more players needs cards. If so, rotate to the next player
// After all hole cards are dealt, start a new betting round
// Player after big blind starts first
export async function ensureHoleCardsProgression(
  tx: { query: typeof db.query; update: typeof db.update },
  tableId: string,
  gameObj: GameRow,
  orderedSeats: SeatRow[],
  currentSeatId: string,
): Promise<void> {
  // Check if all active players have two cards
  const allHaveTwo = orderedSeats
    .filter((s: SeatRow) => s.isActive)
    .every((s: SeatRow) => s.cards.length >= 2);
  if (!allHaveTwo) {
    const nextSeatId = getNextActiveSeatId(orderedSeats, currentSeatId);
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
  tx: { query: typeof db.query; update: typeof db.update },
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
  tx: { query: typeof db.query; update: typeof db.update },
  tableId: string,
  gameObj: GameRow,
  orderedSeats: Array<SeatRow>,
  firstToActId: string,
): Promise<void> {
  const activeCount = activeCountOf(orderedSeats);
  await tx
    .update(games)
    .set({
      state: "BETTING",
      assignedSeatId: firstToActId,
      betCount: 0,
      requiredBetCount: activeCount,
    })
    .where(eq(games.id, gameObj.id));
  // Clear lastAction for all seats at the start of the next betting round
  await tx
    .update(seats)
    .set({ lastAction: null })
    .where(eq(seats.tableId, tableId));
}

// Card dealing logic that can be shared between consumer and table router
export async function dealCard(
  tx: { query: typeof db.query; update: typeof db.update },
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

export async function createNewGame(
  tx: { query: typeof db.query; update: typeof db.update },
  table: TableRow,
  orderedSeats: Array<SeatRow>,
  previousGame: GameRow | null,
): Promise<GameRow> {
  // Validate that all players have enough chips to participate
  const minimumBet = table.bigBlind; // Players need at least the big blind amount
  const playersWithInsufficientChips = orderedSeats.filter(
    (seat) => seat.buyIn < minimumBet,
  );

  if (playersWithInsufficientChips.length > 0) {
    const playerNames = playersWithInsufficientChips
      .map((seat) => `Player at seat ${seat.seatNumber} (${seat.buyIn} chips)`)
      .join(", ");
    throw new Error(
      `Cannot start game: ${playerNames} have insufficient chips. Minimum required: ${minimumBet} chips (big blind amount)`,
    );
  }

  // Update startingBalance to current buyIn for all players before starting new game
  for (const seat of orderedSeats) {
    await tx
      .update(seats)
      .set({ startingBalance: seat.buyIn })
      .where(eq(seats.id, seat.id));
    seat.startingBalance = seat.buyIn; // Update in-memory object too
  }

  // Create a new game object
  let dealerButtonSeatId = orderedSeats[0]!.id;
  if (previousGame) {
    // If there was a previous game, progress the dealer button
    const prevButton = previousGame.dealerButtonSeatId!;
    dealerButtonSeatId = getNextActiveSeatId(orderedSeats, prevButton);
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
    })
    .returning();
  const game = createdRows?.[0];
  if (!game) throw new Error("Failed to create game");

  // Collect big and small blind
  await collectBigAndSmallBlind(tx, table, orderedSeats, game);
  const { smallBlindSeat } = getBigAndSmallBlindSeats(orderedSeats, game);

  // Small blind gets the first turn
  await tx
    .update(games)
    .set({
      assignedSeatId: smallBlindSeat.id,
    })
    .where(eq(games.id, game.id));
  game.assignedSeatId = smallBlindSeat.id;
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

async function collectBigAndSmallBlind(
  tx: { query: typeof db.query; update: typeof db.update },
  table: TableRow,
  orderedSeats: Array<SeatRow>,
  game: GameRow,
): Promise<void> {
  const { smallBlindSeat, bigBlindSeat } = getBigAndSmallBlindSeats(
    orderedSeats,
    game,
  );
  // Transfer buy-in into bets for big and small blind
  await tx
    .update(seats)
    .set({
      currentBet: sql`${table.smallBlind}`,
      buyIn: sql`${seats.buyIn} - ${table.smallBlind}`,
    })
    .where(eq(seats.id, smallBlindSeat.id));
  await tx
    .update(seats)
    .set({
      currentBet: sql`${table.bigBlind}`,
      buyIn: sql`${seats.buyIn} - ${table.bigBlind}`,
    })
    .where(eq(seats.id, bigBlindSeat.id));
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
  await updateTable(tableId);
}
