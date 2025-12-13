import { describe, expect, it } from 'vitest';
import { redactSnapshotForUser } from '~/server/api/routers/table';

import type { TableSnapshot, SeatWithPlayer } from "~/server/api/routers/table";

// Helper to create a mock seat
function createMockSeat(
  overrides: Partial<SeatWithPlayer> = {},
): SeatWithPlayer {
  return {
    id: "seat-1",
    tableId: "table-1",
    playerId: "player-1",
    seatNumber: 0,
    buyIn: 1000,
    startingBalance: 1000,
    currentBet: 0,
    cards: ["AS", "KH"],
    seatStatus: "active",
    lastAction: null,
    encryptedUserNonce: null,
    encryptedPiNonce: null,
    handType: "One Pair",
    handDescription: "Pair of Aces",
    winAmount: 0,
    winningCards: [],
    player: { id: "player-1", name: "Player 1" },
    ...overrides,
  } as SeatWithPlayer;
}

// Helper to create a mock game
function createMockGame(overrides: Partial<any> = {}) {
  return {
    id: "game-1",
    tableId: "table-1",
    state: "BETTING",
    dealerButtonSeatId: "seat-1",
    assignedSeatId: "seat-1",
    communityCards: [],
    potTotal: 100,
    sidePots: null,
    betCount: 0,
    requiredBetCount: 2,
    effectiveSmallBlind: 5,
    effectiveBigBlind: 10,
    turnStartTime: null,
    isCompleted: false,
    createdAt: new Date(),
    ...overrides,
  };
}

// Helper to create a mock table snapshot
function createMockSnapshot(
  seats: SeatWithPlayer[],
  gameState: string = "BETTING",
  gameOverrides: Partial<any> = {},
): TableSnapshot {
  return {
    table: {
      id: "table-1",
      name: "Test Table",
      dealerId: "dealer-1",
      smallBlind: 5,
      bigBlind: 10,
      maxSeats: 8,
      createdAt: new Date(),
      blindTimerStart: null,
      blindTimerScheduleMinutes: null,
    },
    seats,
    game: createMockGame({ state: gameState, ...gameOverrides }),
    isJoinable: false,
    availableSeats: 6,
    blinds: {
      effectiveSmallBlind: 5,
      effectiveBigBlind: 10,
      currentLevelIndex: 0,
      currentLevelLabel: "5/10",
      nextLevelLabel: null,
      msUntilNextLevel: null,
    },
  };
}

describe("redactSnapshotForUser", () => {
  describe("basic card visibility", () => {
    it("shows cards to the player themselves", () => {
      const seat = createMockSeat({
        id: "seat-1",
        playerId: "player-1",
        cards: ["AS", "KH"],
        seatStatus: "active",
      });
      const snapshot = createMockSnapshot([seat]);

      const result = redactSnapshotForUser(snapshot, "player-1");

      expect(result.seats[0]!.cards).toEqual(["AS", "KH"]);
    });

    it("hides cards from other active players during betting", () => {
      const mySeat = createMockSeat({
        id: "seat-1",
        playerId: "player-1",
        cards: ["AS", "KH"],
        seatStatus: "active",
      });
      const otherSeat = createMockSeat({
        id: "seat-2",
        playerId: "player-2",
        seatNumber: 1,
        cards: ["QS", "JH"],
        seatStatus: "active",
      });
      const snapshot = createMockSnapshot([mySeat, otherSeat], "BETTING");

      const result = redactSnapshotForUser(snapshot, "player-1");

      expect(result.seats[0]!.cards).toEqual(["AS", "KH"]); // My cards visible
      expect(result.seats[1]!.cards).toEqual(["FD", "FD"]); // Other player hidden
    });

    it("never reveals folded player cards", () => {
      const activeSeat = createMockSeat({
        id: "seat-1",
        playerId: "player-1",
        cards: ["AS", "KH"],
        seatStatus: "active",
      });
      const foldedSeat = createMockSeat({
        id: "seat-2",
        playerId: "player-2",
        seatNumber: 1,
        cards: ["QS", "JH"],
        seatStatus: "folded",
      });
      const snapshot = createMockSnapshot([activeSeat, foldedSeat], "SHOWDOWN");

      const result = redactSnapshotForUser(snapshot, "player-1");

      expect(result.seats[1]!.cards).toEqual(["FD", "FD"]); // Folded stays hidden
    });

    it("clears handType and handDescription when hiding cards", () => {
      const mySeat = createMockSeat({
        id: "seat-1",
        playerId: "player-1",
        cards: ["AS", "KH"],
        seatStatus: "active",
      });
      const otherSeat = createMockSeat({
        id: "seat-2",
        playerId: "player-2",
        seatNumber: 1,
        cards: ["QS", "JH"],
        seatStatus: "active",
        handType: "One Pair",
        handDescription: "Pair of Queens",
      });
      const snapshot = createMockSnapshot([mySeat, otherSeat], "BETTING");

      const result = redactSnapshotForUser(snapshot, "player-1");

      expect(result.seats[1]!.handType).toBeNull();
      expect(result.seats[1]!.handDescription).toBeNull();
    });
  });

  describe("showdown visibility", () => {
    it("reveals all non-folded players cards in showdown", () => {
      const seat1 = createMockSeat({
        id: "seat-1",
        playerId: "player-1",
        cards: ["AS", "KH"],
        seatStatus: "active",
      });
      const seat2 = createMockSeat({
        id: "seat-2",
        playerId: "player-2",
        seatNumber: 1,
        cards: ["QS", "JH"],
        seatStatus: "active",
      });
      const snapshot = createMockSnapshot([seat1, seat2], "SHOWDOWN");

      const result = redactSnapshotForUser(snapshot, "player-1");

      expect(result.seats[0]!.cards).toEqual(["AS", "KH"]);
      expect(result.seats[1]!.cards).toEqual(["QS", "JH"]); // Revealed in showdown
    });

    it("hides winner cards when everyone else folded (single winner)", () => {
      const winnerSeat = createMockSeat({
        id: "seat-1",
        playerId: "player-1",
        cards: ["AS", "KH"],
        seatStatus: "active",
      });
      const foldedSeat = createMockSeat({
        id: "seat-2",
        playerId: "player-2",
        seatNumber: 1,
        cards: ["QS", "JH"],
        seatStatus: "folded",
      });
      const snapshot = createMockSnapshot([winnerSeat, foldedSeat], "SHOWDOWN");

      // Viewing as the folded player
      const result = redactSnapshotForUser(snapshot, "player-2");

      expect(result.seats[0]!.cards).toEqual(["FD", "FD"]); // Winner's cards hidden
      expect(result.seats[1]!.cards).toEqual(["QS", "JH"]); // Own cards visible
    });
  });

  describe("all-in visibility", () => {
    it("reveals cards when all remaining players are all-in (2 players)", () => {
      const seat1 = createMockSeat({
        id: "seat-1",
        playerId: "player-1",
        cards: ["AS", "KH"],
        seatStatus: "all-in",
      });
      const seat2 = createMockSeat({
        id: "seat-2",
        playerId: "player-2",
        seatNumber: 1,
        cards: ["QS", "JH"],
        seatStatus: "all-in",
      });
      const snapshot = createMockSnapshot([seat1, seat2], "BETTING");

      const result = redactSnapshotForUser(snapshot, "player-1");

      expect(result.seats[0]!.cards).toEqual(["AS", "KH"]); // Own cards
      expect(result.seats[1]!.cards).toEqual(["QS", "JH"]); // Revealed because all-in
    });

    it("reveals cards when all remaining players are all-in (3 players)", () => {
      const seat1 = createMockSeat({
        id: "seat-1",
        playerId: "player-1",
        cards: ["AS", "KH"],
        seatStatus: "all-in",
      });
      const seat2 = createMockSeat({
        id: "seat-2",
        playerId: "player-2",
        seatNumber: 1,
        cards: ["QS", "JH"],
        seatStatus: "all-in",
      });
      const seat3 = createMockSeat({
        id: "seat-3",
        playerId: "player-3",
        seatNumber: 2,
        cards: ["TC", "9D"],
        seatStatus: "all-in",
      });
      const snapshot = createMockSnapshot([seat1, seat2, seat3], "DEAL_FLOP");

      const result = redactSnapshotForUser(snapshot, "player-1");

      expect(result.seats[0]!.cards).toEqual(["AS", "KH"]);
      expect(result.seats[1]!.cards).toEqual(["QS", "JH"]);
      expect(result.seats[2]!.cards).toEqual(["TC", "9D"]);
    });

    it("still hides folded player cards when others are all-in", () => {
      const allInSeat1 = createMockSeat({
        id: "seat-1",
        playerId: "player-1",
        cards: ["AS", "KH"],
        seatStatus: "all-in",
      });
      const allInSeat2 = createMockSeat({
        id: "seat-2",
        playerId: "player-2",
        seatNumber: 1,
        cards: ["QS", "JH"],
        seatStatus: "all-in",
      });
      const foldedSeat = createMockSeat({
        id: "seat-3",
        playerId: "player-3",
        seatNumber: 2,
        cards: ["TC", "9D"],
        seatStatus: "folded",
      });
      const snapshot = createMockSnapshot(
        [allInSeat1, allInSeat2, foldedSeat],
        "DEAL_TURN",
      );

      const result = redactSnapshotForUser(snapshot, "player-1");

      expect(result.seats[0]!.cards).toEqual(["AS", "KH"]); // All-in revealed
      expect(result.seats[1]!.cards).toEqual(["QS", "JH"]); // All-in revealed
      expect(result.seats[2]!.cards).toEqual(["FD", "FD"]); // Folded hidden
    });

    it("does NOT reveal cards if one player is still active", () => {
      const activeSeat = createMockSeat({
        id: "seat-1",
        playerId: "player-1",
        cards: ["AS", "KH"],
        seatStatus: "active",
      });
      const allInSeat = createMockSeat({
        id: "seat-2",
        playerId: "player-2",
        seatNumber: 1,
        cards: ["QS", "JH"],
        seatStatus: "all-in",
      });
      const snapshot = createMockSnapshot([activeSeat, allInSeat], "BETTING");

      const result = redactSnapshotForUser(snapshot, "player-1");

      expect(result.seats[0]!.cards).toEqual(["AS", "KH"]); // Own cards
      expect(result.seats[1]!.cards).toEqual(["FD", "FD"]); // Still hidden
    });

    it("does NOT reveal cards with only one all-in player", () => {
      const allInSeat = createMockSeat({
        id: "seat-1",
        playerId: "player-1",
        cards: ["AS", "KH"],
        seatStatus: "all-in",
      });
      const foldedSeat = createMockSeat({
        id: "seat-2",
        playerId: "player-2",
        seatNumber: 1,
        cards: ["QS", "JH"],
        seatStatus: "folded",
      });
      const snapshot = createMockSnapshot([allInSeat, foldedSeat], "DEAL_FLOP");

      // Viewing as folded player - the all-in player won by default
      const result = redactSnapshotForUser(snapshot, "player-2");

      expect(result.seats[0]!.cards).toEqual(["FD", "FD"]); // Not revealed (only 1 all-in)
      expect(result.seats[1]!.cards).toEqual(["QS", "JH"]); // Own cards
    });

    it("reveals cards in all dealing states when all players all-in", () => {
      const states = [
        "DEAL_HOLE_CARDS",
        "DEAL_FLOP",
        "DEAL_TURN",
        "DEAL_RIVER",
      ];

      for (const state of states) {
        const seat1 = createMockSeat({
          id: "seat-1",
          playerId: "player-1",
          cards: ["AS", "KH"],
          seatStatus: "all-in",
        });
        const seat2 = createMockSeat({
          id: "seat-2",
          playerId: "player-2",
          seatNumber: 1,
          cards: ["QS", "JH"],
          seatStatus: "all-in",
        });
        const snapshot = createMockSnapshot([seat1, seat2], state);

        const result = redactSnapshotForUser(snapshot, "player-1");

        expect(result.seats[1]!.cards).toEqual(["QS", "JH"]);
      }
    });
  });

  describe("edge cases", () => {
    it("handles empty seats array", () => {
      const snapshot = createMockSnapshot([], "BETTING");

      const result = redactSnapshotForUser(snapshot, "player-1");

      expect(result.seats).toEqual([]);
    });

    it("handles null game state", () => {
      const seat = createMockSeat({
        id: "seat-1",
        playerId: "player-1",
        cards: ["AS", "KH"],
        seatStatus: "active",
      });
      const snapshot: TableSnapshot = {
        ...createMockSnapshot([seat]),
        game: null,
      };

      const result = redactSnapshotForUser(snapshot, "player-1");

      expect(result.seats[0]!.cards).toEqual(["AS", "KH"]);
    });

    it("handles eliminated players with cards", () => {
      const eliminatedSeat = createMockSeat({
        id: "seat-1",
        playerId: "player-1",
        cards: ["AS", "KH"],
        seatStatus: "eliminated",
        buyIn: 0,
      });
      const activeSeat = createMockSeat({
        id: "seat-2",
        playerId: "player-2",
        seatNumber: 1,
        cards: ["QS", "JH"],
        seatStatus: "active",
      });
      const snapshot = createMockSnapshot(
        [eliminatedSeat, activeSeat],
        "SHOWDOWN",
      );

      // Viewing as active player - eliminated player is the only non-folded
      // so this is "singleActive" scenario (the term is misleading but it means
      // only one non-folded player in the hand)
      const result = redactSnapshotForUser(snapshot, "player-2");

      // The eliminated player's cards are hidden because there's only 1 "active/all-in/eliminated-with-cards"
      // Actually wait, let me check: eliminated with cards + active = 2 players
      // So cards should be revealed in showdown
      expect(result.seats[0]!.cards).toEqual(["AS", "KH"]);
    });

    it("handles players with no cards", () => {
      const seatWithCards = createMockSeat({
        id: "seat-1",
        playerId: "player-1",
        cards: ["AS", "KH"],
        seatStatus: "all-in",
      });
      const seatWithoutCards = createMockSeat({
        id: "seat-2",
        playerId: "player-2",
        seatNumber: 1,
        cards: [],
        seatStatus: "all-in",
      });
      const snapshot = createMockSnapshot(
        [seatWithCards, seatWithoutCards],
        "DEAL_HOLE_CARDS",
      );

      const result = redactSnapshotForUser(snapshot, "player-1");

      expect(result.seats[0]!.cards).toEqual(["AS", "KH"]);
      expect(result.seats[1]!.cards).toEqual([]); // Empty array stays empty
    });

    it("preserves non-card seat properties", () => {
      const seat = createMockSeat({
        id: "seat-1",
        playerId: "player-1",
        buyIn: 500,
        currentBet: 50,
        seatStatus: "active",
        winAmount: 100,
      });
      const otherSeat = createMockSeat({
        id: "seat-2",
        playerId: "player-2",
        seatNumber: 1,
        cards: ["QS", "JH"],
        seatStatus: "active",
        buyIn: 750,
        currentBet: 50,
      });
      const snapshot = createMockSnapshot([seat, otherSeat], "BETTING");

      const result = redactSnapshotForUser(snapshot, "player-1");

      // Other seat's non-card properties should be preserved
      expect(result.seats[1]!.buyIn).toBe(750);
      expect(result.seats[1]!.currentBet).toBe(50);
      expect(result.seats[1]!.seatStatus).toBe("active");
    });
  });
});
