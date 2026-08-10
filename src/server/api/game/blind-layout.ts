import { eq, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { games, seats } from "~/server/db/schema";

import {
  findSeatByNumber,
  getNextDealableSeatAfterNumber,
  isAbsentOrEliminated,
  nonEliminatedCountOf,
} from "./helpers/seats";

type SeatRow = typeof seats.$inferSelect;
type GameRow = typeof games.$inferSelect;

type Tx = {
  insert: typeof db.insert;
  query: typeof db.query;
  update: typeof db.update;
};

export type HandBlindLayout = {
  dealerButtonSeatNumber: number;
  smallBlindSeatNumber: number | null;
  bigBlindSeatNumber: number;
};

/**
 * Lay out blinds from a button seat number. Button may sit on an empty/eliminated seat.
 * Heads-up (TDA 34-B): button posts the small blind.
 */
export function layoutFromDealerButton(
  orderedSeats: Array<SeatRow>,
  dealerButtonSeatNumber: number,
): HandBlindLayout {
  const liveCount = nonEliminatedCountOf(orderedSeats);
  if (liveCount < 2) {
    throw new Error("Need at least 2 players for blind layout");
  }

  if (liveCount === 2) {
    let buttonNumber = dealerButtonSeatNumber;
    if (isAbsentOrEliminated(orderedSeats, buttonNumber)) {
      buttonNumber = getNextDealableSeatAfterNumber(
        orderedSeats,
        buttonNumber,
      ).seatNumber;
    }
    const bigBlind = getNextDealableSeatAfterNumber(orderedSeats, buttonNumber);
    return {
      dealerButtonSeatNumber: buttonNumber,
      smallBlindSeatNumber: buttonNumber,
      bigBlindSeatNumber: bigBlind.seatNumber,
    };
  }

  const smallBlind = getNextDealableSeatAfterNumber(
    orderedSeats,
    dealerButtonSeatNumber,
  );
  const bigBlind = getNextDealableSeatAfterNumber(
    orderedSeats,
    smallBlind.seatNumber,
  );
  return {
    dealerButtonSeatNumber,
    smallBlindSeatNumber: smallBlind.seatNumber,
    bigBlindSeatNumber: bigBlind.seatNumber,
  };
}

function resolveHeadsUpFromPreviousBigBlind(
  orderedSeats: Array<SeatRow>,
  previousBigBlindSeatNumber: number,
): HandBlindLayout {
  const bigBlind = getNextDealableSeatAfterNumber(
    orderedSeats,
    previousBigBlindSeatNumber,
  );
  const smallBlind = getNextDealableSeatAfterNumber(
    orderedSeats,
    bigBlind.seatNumber,
  );
  return {
    dealerButtonSeatNumber: smallBlind.seatNumber,
    smallBlindSeatNumber: smallBlind.seatNumber,
    bigBlindSeatNumber: bigBlind.seatNumber,
  };
}

/**
 * TDA dead-button blind/button placement for a new hand.
 * Uses durable seat numbers so layout survives players leaving (seat rows deleted).
 */
export function resolveHandBlindLayout(
  orderedSeats: Array<SeatRow>,
  previousGame: GameRow | null,
): HandBlindLayout {
  const liveCount = nonEliminatedCountOf(orderedSeats);

  if (!previousGame) {
    const firstLive = orderedSeats.find((s) => s.seatStatus !== "eliminated");
    if (!firstLive) throw new Error("No live seats for blind layout");
    return layoutFromDealerButton(orderedSeats, firstLive.seatNumber);
  }

  if (previousGame.wasReset) {
    return {
      dealerButtonSeatNumber: previousGame.dealerButtonSeatNumber,
      smallBlindSeatNumber: previousGame.smallBlindSeatNumber,
      bigBlindSeatNumber: previousGame.bigBlindSeatNumber,
    };
  }

  const prevBtnNum = previousGame.dealerButtonSeatNumber;
  const prevSbNum = previousGame.smallBlindSeatNumber;
  const prevBbNum = previousGame.bigBlindSeatNumber;

  if (liveCount === 2) {
    return resolveHeadsUpFromPreviousBigBlind(orderedSeats, prevBbNum);
  }

  const nextBigBlind = getNextDealableSeatAfterNumber(orderedSeats, prevBbNum);

  if (isAbsentOrEliminated(orderedSeats, prevBbNum)) {
    return {
      dealerButtonSeatNumber: prevSbNum ?? prevBtnNum,
      smallBlindSeatNumber: null,
      bigBlindSeatNumber: nextBigBlind.seatNumber,
    };
  }

  if (prevSbNum != null) {
    return {
      dealerButtonSeatNumber: prevSbNum,
      smallBlindSeatNumber: prevBbNum,
      bigBlindSeatNumber: nextBigBlind.seatNumber,
    };
  }

  // Previous hand had no SB (BB-only catch-up): button moves to previous BB
  return layoutFromDealerButton(orderedSeats, prevBbNum);
}

export function getBigAndSmallBlindSeats(
  orderedSeats: Array<SeatRow>,
  game: GameRow,
): { smallBlindSeat: SeatRow | null; bigBlindSeat: SeatRow } {
  const bigBlindSeat = findSeatByNumber(orderedSeats, game.bigBlindSeatNumber);
  if (!bigBlindSeat) {
    throw new Error(
      `Big blind seat number ${game.bigBlindSeatNumber} not found`,
    );
  }

  const smallBlindSeat =
    game.smallBlindSeatNumber == null
      ? null
      : (findSeatByNumber(orderedSeats, game.smallBlindSeatNumber) ?? null);

  return { smallBlindSeat, bigBlindSeat };
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

export async function collectBigAndSmallBlind(
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

  if (smallBlindSeat) {
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

    smallBlindSeat.currentBet = smallBlindActual;
    smallBlindSeat.buyIn = smallBlindNewBuyIn;
    smallBlindSeat.seatStatus = smallBlindNewStatus;
  }

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

  bigBlindSeat.currentBet = bigBlindActual;
  bigBlindSeat.buyIn = bigBlindNewBuyIn;
  bigBlindSeat.seatStatus = bigBlindNewStatus;
}
