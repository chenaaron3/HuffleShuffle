import { describe, expect, it } from "vitest";

import { buildHudGrid } from "~/components/table/mobile/seat-hud-logic";

import type { HudSeatSnapshot } from "~/components/table/mobile/seat-hud-logic";

function seat(
  overrides: Partial<HudSeatSnapshot> & Pick<HudSeatSnapshot, "seatNumber">,
): HudSeatSnapshot {
  return {
    id: `seat-${overrides.seatNumber}`,
    playerId: `player-${overrides.seatNumber}`,
    buyIn: 200,
    currentBet: 0,
    seatStatus: "active",
    lastAction: null,
    ...overrides,
  };
}

const baseInput = {
  smallBlindSeatNumber: 0,
  bigBlindSeatNumber: 1,
  dealerButtonSeatNumber: 7,
  highlightedSeatId: null as string | null,
  myUserId: null as string | null,
  gameState: "BETTING" as string | undefined,
};

describe("buildHudGrid", () => {
  it("uses the expanded player grid: seat order, wrapping by player count", () => {
    const eight = buildHudGrid({
      ...baseInput,
      seats: [7, 1, 0, 4, 6, 2, 5, 3].map((seatNumber) => seat({ seatNumber })),
    });
    expect(eight.map((row) => row.map((cell) => cell.seatNumber + 1))).toEqual([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ]);

    const six = buildHudGrid({
      ...baseInput,
      seats: [0, 1, 2, 3, 4, 5].map((seatNumber) => seat({ seatNumber })),
    });
    expect(six.map((row) => row.map((cell) => cell.seatNumber + 1))).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);

    const four = buildHudGrid({
      ...baseInput,
      seats: [3, 0, 2, 1].map((seatNumber) => seat({ seatNumber })),
    });
    expect(four.map((row) => row.map((cell) => cell.seatNumber + 1))).toEqual([
      [1, 2],
      [3, 4],
    ]);

    const three = buildHudGrid({
      ...baseInput,
      seats: [0, 2, 1].map((seatNumber) => seat({ seatNumber })),
    });
    expect(three.map((row) => row.map((cell) => cell.seatNumber + 1))).toEqual([
      [1, 2],
      [3],
    ]);
  });

  it("omits seats with no player", () => {
    const grid = buildHudGrid({
      ...baseInput,
      seats: [seat({ seatNumber: 0, playerId: null }), seat({ seatNumber: 3 })],
    });

    expect(grid.flat().map((cell) => cell.seatNumber + 1)).toEqual([4]);
  });

  it("shows button instead of a blind when they share a seat", () => {
    const grid = buildHudGrid({
      ...baseInput,
      dealerButtonSeatNumber: 0,
      smallBlindSeatNumber: 0,
      bigBlindSeatNumber: 1,
      seats: [seat({ seatNumber: 0 }), seat({ seatNumber: 1 })],
    });

    const cells = grid.flat();
    expect(cells.find((cell) => cell.seatNumber === 0)?.role).toBe("BU");
    expect(cells.find((cell) => cell.seatNumber === 1)?.role).toBe("BB");
  });

  it("keeps stack and street bet, and colors the last action", () => {
    const grid = buildHudGrid({
      ...baseInput,
      seats: [
        seat({ seatNumber: 2, buyIn: 180, currentBet: 40, lastAction: "RAISE" }),
        seat({ seatNumber: 4, buyIn: 150, currentBet: 40, lastAction: "CALL" }),
        seat({ seatNumber: 5, buyIn: 200, currentBet: 0, lastAction: "CHECK" }),
      ],
    });

    const cells = grid.flat();
    const raiser = cells.find((cell) => cell.seatNumber === 2);
    expect(raiser).toMatchObject({ stack: 180, bet: 40, tone: "raise", dimmed: false });
    expect(cells.find((cell) => cell.seatNumber === 4)?.tone).toBe("call");
    expect(cells.find((cell) => cell.seatNumber === 5)?.tone).toBe("check");
  });

  it("dims folded and eliminated seats and lets all-in override the last action", () => {
    const grid = buildHudGrid({
      ...baseInput,
      seats: [
        seat({ seatNumber: 0, seatStatus: "folded", lastAction: "FOLD", currentBet: 10 }),
        seat({ seatNumber: 1, seatStatus: "eliminated", buyIn: 0 }),
        seat({
          seatNumber: 2,
          seatStatus: "all-in",
          lastAction: "RAISE",
          buyIn: 0,
          currentBet: 200,
        }),
      ],
    });

    const cells = grid.flat();
    expect(cells.find((cell) => cell.seatNumber === 0)).toMatchObject({
      tone: "fold",
      dimmed: true,
      bet: 10,
    });
    expect(cells.find((cell) => cell.seatNumber === 1)).toMatchObject({
      tone: "eliminated",
      dimmed: true,
    });
    expect(cells.find((cell) => cell.seatNumber === 2)).toMatchObject({
      tone: "all-in",
      dimmed: false,
    });
  });

  it("marks you, the actor, and the showdown winner", () => {
    const grid = buildHudGrid({
      ...baseInput,
      gameState: "SHOWDOWN",
      highlightedSeatId: "seat-3",
      myUserId: "player-3",
      seats: [
        seat({ seatNumber: 3, winAmount: 80 }),
        seat({ seatNumber: 4, winAmount: 0 }),
      ],
    });

    const cells = grid.flat();
    expect(cells.find((cell) => cell.seatNumber === 3)).toMatchObject({
      isSelf: true,
      isActor: true,
      isWinner: true,
    });
    expect(cells.find((cell) => cell.seatNumber === 4)?.isWinner).toBe(false);
  });
});
