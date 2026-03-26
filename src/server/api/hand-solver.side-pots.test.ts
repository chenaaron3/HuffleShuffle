import { describe, expect, it } from "vitest";
import type { seats } from "~/server/db/schema";
import { calculateSidePotsFromCumulativeBets } from "./hand-solver";

type SeatRow = typeof seats.$inferSelect;

const STARTING = 300;

function makeSeat(
  id: string,
  seatNumber: number,
  cumulativeBet: number,
  seatStatus: SeatRow["seatStatus"],
): SeatRow {
  return {
    id,
    tableId: "table-test",
    playerId: `user-${id}`,
    seatNumber,
    buyIn: STARTING - cumulativeBet,
    startingBalance: STARTING,
    currentBet: 0,
    cards: [],
    seatStatus,
    encryptedUserNonce: null,
    encryptedPiNonce: null,
    handType: null,
    handDescription: null,
    winAmount: 0,
    winningCards: [],
    lastAction: null,
    voluntaryShow: false,
    createdAt: new Date(),
    updatedAt: null,
  };
}

function sumSidePotAmounts(pots: { amount: number }[]): number {
  return pots.reduce((sum, p) => sum + p.amount, 0);
}

describe("calculateSidePotsFromCumulativeBets (orphan layers / conservation)", () => {
  it("merges orphan top slice into contested pot so pot totals match chips committed (160/155/155, high folder)", () => {
    // Three players put 160 + 155 + 155 = 470 in the pot; the overbet (5) is only from a folded seat.
    // Skipping that layer used to distribute 465 in side pots vs 470 in potTotal → conservation error.
    const highFolder = makeSeat("seat-high", 0, 160, "folded");
    const a = makeSeat("seat-a", 1, 155, "active");
    const b = makeSeat("seat-b", 2, 155, "active");
    const allSeats = [highFolder, a, b];

    const pots = calculateSidePotsFromCumulativeBets(allSeats);
    const committed = allSeats.reduce(
      (sum, s) => sum + (s.startingBalance - s.buyIn),
      0,
    );

    expect(committed).toBe(470);
    expect(sumSidePotAmounts(pots)).toBe(committed);
    expect(pots).toHaveLength(1);
    expect(pots[0]!.amount).toBe(470);
    expect(new Set(pots[0]!.eligibleSeatIds)).toEqual(
      new Set(["seat-a", "seat-b"]),
    );
  });

  it("layers with eligibles at every step sum to total committed chips", () => {
    const s50 = makeSeat("s50", 0, 50, "active");
    const s150 = makeSeat("s150", 1, 150, "active");
    const s300 = makeSeat("s300", 2, 300, "active");
    const all = [s50, s150, s300];

    const pots = calculateSidePotsFromCumulativeBets(all);
    const committed = 50 + 150 + 300;

    expect(sumSidePotAmounts(pots)).toBe(committed);
    expect(pots.length).toBe(3);
  });
});
