import { eq, sql } from "drizzle-orm";
import { logFlop, logRiver, logTurn } from "~/server/api/lib/game-event-logger";
import { fetchAllSeatsInOrder } from "~/server/api/table/seating";
import { db } from "~/server/db";
import { games, pokerTables, seats } from "~/server/db/schema";

import { createNewGame } from "~/server/api/game/hand-lifecycle";
import { evaluateBettingTransition } from "~/server/api/game/hand-solver";
import { parseRankSuitToBarcode } from "./helpers/cards";
import {
  activeCountOf,
  getNextActiveSeatAfterNumber,
  getNextDealableSeatAfterNumber,
} from "./helpers/seats";

type SeatRow = typeof seats.$inferSelect;
type GameRow = typeof games.$inferSelect;

type Tx = {
  insert: typeof db.insert;
  query: typeof db.query;
  update: typeof db.update;
  select: typeof db.select;
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
    const currentSeat = orderedSeats.find((s) => s.id === currentSeatId);
    if (!currentSeat) {
      throw new Error("Current seat not found");
    }
    const nextSeatId = getNextDealableSeatAfterNumber(
      orderedSeats,
      currentSeat.seatNumber,
    ).id;
    await tx
      .update(games)
      .set({ assignedSeatId: nextSeatId })
      .where(eq(games.id, gameObj.id));
  } else {
    // Preflop: first active seat left of the big blind (HU: SB/button).
    // If everyone is already all-in (e.g. short stacks posting blinds), skip actor lookup.
    const firstToActId =
      getNextActiveSeatAfterNumber(orderedSeats, gameObj.bigBlindSeatNumber)
        ?.id ?? null;
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
  // Postflop: first active seat left of dealer button. When all contenders are
  // all-in there is no actor — startBettingRound skips straight to runout/showdown.
  const firstToActId =
    getNextActiveSeatAfterNumber(orderedSeats, gameObj.dealerButtonSeatNumber)
      ?.id ?? null;
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
  firstToActId: string | null,
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
      turnStartTime: firstToActId ? new Date() : null,
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
