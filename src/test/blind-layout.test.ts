import { describe, expect, it } from "vitest";

import {
  layoutFromDealerButton,
  resolveHandBlindLayout,
} from "~/server/api/game/blind-layout";
import type { games, seats } from "~/server/db/schema";

type SeatRow = typeof seats.$inferSelect;
type GameRow = typeof games.$inferSelect;

function makeSeat(
  id: string,
  seatNumber: number,
  seatStatus: SeatRow["seatStatus"] = "active",
): SeatRow {
  return {
    id,
    tableId: "table-1",
    playerId: `player-${id}`,
    seatNumber,
    buyIn: 300,
    startingBalance: 300,
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

function makePreviousGame(partial: {
  dealerButtonSeatNumber: number;
  smallBlindSeatNumber: number | null;
  bigBlindSeatNumber: number;
  wasReset?: boolean;
}): GameRow {
  return {
    id: "game-prev",
    tableId: "table-1",
    isCompleted: true,
    state: "SHOWDOWN",
    dealerButtonSeatNumber: partial.dealerButtonSeatNumber,
    smallBlindSeatNumber: partial.smallBlindSeatNumber,
    bigBlindSeatNumber: partial.bigBlindSeatNumber,
    assignedSeatId: null,
    turnStartTime: null,
    communityCards: [],
    potTotal: 0,
    sidePotDetails: [],
    betCount: 0,
    requiredBetCount: 0,
    effectiveSmallBlind: 5,
    effectiveBigBlind: 10,
    lastRaiseIncrement: 10,
    wasReset: partial.wasReset ?? false,
    createdAt: new Date(),
    updatedAt: null,
  };
}

describe("TDA dead-button blind layout examples", () => {
  // Seat numbers 0→1→2→3→4 clockwise
  const fiveLive = [
    makeSeat("s1", 0),
    makeSeat("s2", 1),
    makeSeat("s3", 2),
    makeSeat("s4", 3),
    makeSeat("s5", 4),
  ];

  it("1. normal: Btn0 SB1 BB2 → next Btn1 SB2 BB3", () => {
    const layout = resolveHandBlindLayout(
      fiveLive,
      makePreviousGame({
        dealerButtonSeatNumber: 0,
        smallBlindSeatNumber: 1,
        bigBlindSeatNumber: 2,
      }),
    );
    expect(layout).toEqual({
      dealerButtonSeatNumber: 1,
      smallBlindSeatNumber: 2,
      bigBlindSeatNumber: 3,
    });
  });

  it("2. BB busts: Btn0 SB1 BB2(elim) → next Btn1, no SB, BB3", () => {
    const seatsAfter = [
      makeSeat("s1", 0),
      makeSeat("s2", 1),
      makeSeat("s3", 2, "eliminated"),
      makeSeat("s4", 3),
      makeSeat("s5", 4),
    ];
    const layout = resolveHandBlindLayout(
      seatsAfter,
      makePreviousGame({
        dealerButtonSeatNumber: 0,
        smallBlindSeatNumber: 1,
        bigBlindSeatNumber: 2,
      }),
    );
    expect(layout).toEqual({
      dealerButtonSeatNumber: 1,
      smallBlindSeatNumber: null,
      bigBlindSeatNumber: 3,
    });
  });

  it("3. SB busts: Btn0 SB1(elim) BB2 → next dead Btn on 1, SB2, BB3", () => {
    const seatsAfter = [
      makeSeat("s1", 0),
      makeSeat("s2", 1, "eliminated"),
      makeSeat("s3", 2),
      makeSeat("s4", 3),
      makeSeat("s5", 4),
    ];
    const layout = resolveHandBlindLayout(
      seatsAfter,
      makePreviousGame({
        dealerButtonSeatNumber: 0,
        smallBlindSeatNumber: 1,
        bigBlindSeatNumber: 2,
      }),
    );
    expect(layout).toEqual({
      dealerButtonSeatNumber: 1,
      smallBlindSeatNumber: 2,
      bigBlindSeatNumber: 3,
    });
  });

  it("4. both blinds bust → dead Btn on 1, no SB, BB3", () => {
    const seatsAfter = [
      makeSeat("s1", 0),
      makeSeat("s2", 1, "eliminated"),
      makeSeat("s3", 2, "eliminated"),
      makeSeat("s4", 3),
      makeSeat("s5", 4),
    ];
    const layout = resolveHandBlindLayout(
      seatsAfter,
      makePreviousGame({
        dealerButtonSeatNumber: 0,
        smallBlindSeatNumber: 1,
        bigBlindSeatNumber: 2,
      }),
    );
    expect(layout).toEqual({
      dealerButtonSeatNumber: 1,
      smallBlindSeatNumber: null,
      bigBlindSeatNumber: 3,
    });
  });

  it("5. leftover empty seat behind the button does not skip SB", () => {
    const seatsAfter = [
      makeSeat("s1", 0),
      makeSeat("s2", 1, "eliminated"),
      makeSeat("s3", 2),
      makeSeat("s4", 3),
      makeSeat("s5", 4),
    ];
    const layout = resolveHandBlindLayout(
      seatsAfter,
      makePreviousGame({
        dealerButtonSeatNumber: 0,
        smallBlindSeatNumber: 2,
        bigBlindSeatNumber: 3,
      }),
    );
    expect(layout).toEqual({
      dealerButtonSeatNumber: 2,
      smallBlindSeatNumber: 3,
      bigBlindSeatNumber: 4,
    });
  });

  it("6. after a no-SB hand, SB returns to the previous BB (dead button behind)", () => {
    const seatsAfter = [
      makeSeat("s1", 0),
      makeSeat("s2", 1, "eliminated"),
      makeSeat("s3", 2, "eliminated"),
      makeSeat("s4", 3),
      makeSeat("s5", 4),
      makeSeat("s6", 5),
    ];
    const layout = resolveHandBlindLayout(
      seatsAfter,
      makePreviousGame({
        dealerButtonSeatNumber: 1,
        smallBlindSeatNumber: null,
        bigBlindSeatNumber: 3,
      }),
    );
    expect(layout).toEqual({
      dealerButtonSeatNumber: 2,
      smallBlindSeatNumber: 3,
      bigBlindSeatNumber: 4,
    });
  });

  it("7. BB skips empty seats: SB stays on previous BB, not on the gap", () => {
    // Seats 1–8 = 0–7. P2, P3, P8 elim. Btn P4 / SB P5 / BB P6, then P6 busts.
    const seatsAfter = [
      makeSeat("s1", 0),
      makeSeat("s2", 1, "eliminated"),
      makeSeat("s3", 2, "eliminated"),
      makeSeat("s4", 3),
      makeSeat("s5", 4),
      makeSeat("s6", 5, "eliminated"),
      makeSeat("s7", 6),
      makeSeat("s8", 7, "eliminated"),
    ];
    const afterSixBusts = resolveHandBlindLayout(
      seatsAfter,
      makePreviousGame({
        dealerButtonSeatNumber: 3,
        smallBlindSeatNumber: 4,
        bigBlindSeatNumber: 5,
      }),
    );
    expect(afterSixBusts).toEqual({
      dealerButtonSeatNumber: 4, // P5
      smallBlindSeatNumber: null, // dead SB on P6
      bigBlindSeatNumber: 6, // P7
    });

    // Next: BB skips empty P8 and wraps to P1; SB stays on P7; dead button on P6
    expect(
      resolveHandBlindLayout(seatsAfter, makePreviousGame(afterSixBusts)),
    ).toEqual({
      dealerButtonSeatNumber: 5,
      smallBlindSeatNumber: 6,
      bigBlindSeatNumber: 0,
    });
  });

  it("7b. BB skips two empty seats around the wrap", () => {
    const seatsAfter = [
      makeSeat("s1", 0, "eliminated"),
      makeSeat("s2", 1),
      makeSeat("s3", 2),
      makeSeat("s4", 3),
      makeSeat("s5", 4),
      makeSeat("s6", 5),
      makeSeat("s7", 6),
      makeSeat("s8", 7, "eliminated"),
    ];
    expect(
      resolveHandBlindLayout(
        seatsAfter,
        makePreviousGame({
          dealerButtonSeatNumber: 4,
          smallBlindSeatNumber: 5,
          bigBlindSeatNumber: 6,
        }),
      ),
    ).toEqual({
      dealerButtonSeatNumber: 5,
      smallBlindSeatNumber: 6,
      bigBlindSeatNumber: 1,
    });
  });

  it("8. eliminated SB left the table (seat row gone) → dead button number kept", () => {
    // Seat number 1 is gone entirely (player left after bust)
    const seatsAfter = [
      makeSeat("s1", 0),
      makeSeat("s3", 2),
      makeSeat("s4", 3),
      makeSeat("s5", 4),
    ];
    const layout = resolveHandBlindLayout(
      seatsAfter,
      makePreviousGame({
        dealerButtonSeatNumber: 0,
        smallBlindSeatNumber: 1,
        bigBlindSeatNumber: 2,
      }),
    );
    expect(layout).toEqual({
      dealerButtonSeatNumber: 1, // dead button on empty seat number
      smallBlindSeatNumber: 2,
      bigBlindSeatNumber: 3,
    });
  });

  it("9. heads-up first hand: button posts SB", () => {
    const hu = [makeSeat("s1", 0), makeSeat("s2", 1)];
    const layout = resolveHandBlindLayout(hu, null);
    expect(layout).toEqual({
      dealerButtonSeatNumber: 0,
      smallBlindSeatNumber: 0,
      bigBlindSeatNumber: 1,
    });
  });

  it("10. heads-up continues: blinds swap", () => {
    const hu = [makeSeat("s1", 0), makeSeat("s2", 1)];
    const layout = resolveHandBlindLayout(
      hu,
      makePreviousGame({
        dealerButtonSeatNumber: 0,
        smallBlindSeatNumber: 0,
        bigBlindSeatNumber: 1,
      }),
    );
    expect(layout).toEqual({
      dealerButtonSeatNumber: 1,
      smallBlindSeatNumber: 1,
      bigBlindSeatNumber: 0,
    });
  });

  it("11. 3-to-2: next BB after previous BB; other is SB/button", () => {
    const seatsAfter = [
      makeSeat("s1", 0),
      makeSeat("s2", 1),
      makeSeat("s3", 2, "eliminated"),
    ];
    const layout = resolveHandBlindLayout(
      seatsAfter,
      makePreviousGame({
        dealerButtonSeatNumber: 0,
        smallBlindSeatNumber: 1,
        bigBlindSeatNumber: 2,
      }),
    );
    expect(layout).toEqual({
      dealerButtonSeatNumber: 1,
      smallBlindSeatNumber: 1,
      bigBlindSeatNumber: 0,
    });
  });

  it("wasReset freezes full button + SB + BB layout", () => {
    const layout = resolveHandBlindLayout(
      fiveLive,
      makePreviousGame({
        dealerButtonSeatNumber: 0,
        smallBlindSeatNumber: 1,
        bigBlindSeatNumber: 2,
        wasReset: true,
      }),
    );
    expect(layout).toEqual({
      dealerButtonSeatNumber: 0,
      smallBlindSeatNumber: 1,
      bigBlindSeatNumber: 2,
    });
  });

  it("wasReset recomputes blinds from the same button when the BB leaves", () => {
    const seatsAfter = [
      makeSeat("s1", 0),
      makeSeat("s2", 1),
      makeSeat("s4", 3),
      makeSeat("s5", 4),
    ];
    const layout = resolveHandBlindLayout(
      seatsAfter,
      makePreviousGame({
        dealerButtonSeatNumber: 0,
        smallBlindSeatNumber: 1,
        bigBlindSeatNumber: 2,
        wasReset: true,
      }),
    );
    expect(layout).toEqual({
      dealerButtonSeatNumber: 0,
      smallBlindSeatNumber: 1,
      bigBlindSeatNumber: 3,
    });
  });

  it("wasReset recomputes both blinds when the SB leaves", () => {
    const seatsAfter = [
      makeSeat("s1", 0),
      makeSeat("s3", 2),
      makeSeat("s4", 3),
      makeSeat("s5", 4),
    ];
    const layout = resolveHandBlindLayout(
      seatsAfter,
      makePreviousGame({
        dealerButtonSeatNumber: 0,
        smallBlindSeatNumber: 1,
        bigBlindSeatNumber: 2,
        wasReset: true,
      }),
    );
    expect(layout).toEqual({
      dealerButtonSeatNumber: 0,
      smallBlindSeatNumber: 2,
      bigBlindSeatNumber: 3,
    });
  });

  it("layoutFromDealerButton multiway skips eliminated/missing seats for blinds", () => {
    const seatsWithGap = [
      makeSeat("s1", 0),
      makeSeat("s3", 2),
      makeSeat("s4", 3),
    ];
    expect(layoutFromDealerButton(seatsWithGap, 0)).toEqual({
      dealerButtonSeatNumber: 0,
      smallBlindSeatNumber: 2,
      bigBlindSeatNumber: 3,
    });
  });
});
