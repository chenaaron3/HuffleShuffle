import type { Scenario } from "~/test/scenario.types";

const scenarios: Scenario[] = [
  {
    name: "Player elimination: 4 players, 3 get eliminated one by one",
    steps: [
      // Setup: 4 players
      {
        type: "join",
        players: [
          { key: "player1", buyIn: 200 },
          { key: "player2", buyIn: 50 },
          { key: "player3", buyIn: 50 },
          { key: "player4", buyIn: 70 },
        ],
      },

      // ===== GAME 1: Player 2 eliminated =====
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "deal_hole",
        hole: {
          player1: ["As", "Ah"],
          player2: ["2c", "3c"],
          player3: ["Kd", "Qd"],
          player4: ["Jh", "Th"],
        },
      },
      { type: "validate", game: { state: "BETTING" } },

      // Betting: p2 and p3 go all-in (same amount)
      { type: "action", action: "FOLD", by: "player4" },
      { type: "action", action: "FOLD", by: "player1" },
      {
        type: "action",
        action: "RAISE",
        by: "player2",
        params: { amount: 50 },
      },
      { type: "action", action: "CHECK", by: "player3" },

      // Run out the board
      { type: "validate", game: { state: "DEAL_FLOP" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "K", suit: "s" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "Q", suit: "s" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "J", suit: "s" },
      },
      { type: "validate", game: { state: "DEAL_TURN" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "5", suit: "h" },
      },
      { type: "validate", game: { state: "DEAL_RIVER" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "6", suit: "h" },
      },

      // p3 wins, p2 eliminated
      { type: "validate", game: { state: "SHOWDOWN" } },
      {
        type: "validate",
        seats: { player2: { seatStatus: "eliminated", buyIn: 0 } },
      },

      // ===== GAME 2: Player 4 eliminated =====
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      {
        type: "validate",
        seats: { player2: { seatStatus: "eliminated", buyIn: 0 } },
      },

      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "deal_hole",
        hole: {
          player1: ["Ac", "Ad"],
          player3: ["9s", "9c"],
          player4: ["7c", "8c"],
        },
      },
      { type: "validate", game: { state: "BETTING" } },
      {
        type: "validate",
        seats: { player2: { cards: [], seatStatus: "eliminated" } },
      },

      // Betting: p4 goes all-in and loses to p3
      { type: "action", action: "FOLD", by: "player1" },
      {
        type: "action",
        action: "RAISE",
        by: "player3",
        params: { amount: 70 },
      },
      { type: "action", action: "CHECK", by: "player4" },

      // Run out the board
      { type: "validate", game: { state: "DEAL_FLOP" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "9", suit: "h" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "A", suit: "s" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "2", suit: "h" },
      },
      { type: "validate", game: { state: "DEAL_TURN" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "3", suit: "h" },
      },
      { type: "validate", game: { state: "DEAL_RIVER" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "4", suit: "h" },
      },

      // p3 wins with three 9s, p4 eliminated
      { type: "validate", game: { state: "SHOWDOWN" } },
      {
        type: "validate",
        seats: { player4: { seatStatus: "eliminated", buyIn: 0 } },
      },

      // ===== GAME 3: Player 3 eliminated =====
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      {
        type: "validate",
        seats: {
          player2: { seatStatus: "eliminated", buyIn: 0 },
          player4: { seatStatus: "eliminated", buyIn: 0 },
        },
      },

      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "deal_hole",
        hole: {
          player1: ["Kh", "Kc"],
          player3: ["6c", "7d"],
        },
      },
      { type: "validate", game: { state: "BETTING" } },
      {
        type: "validate",
        seats: {
          player2: { cards: [], seatStatus: "eliminated" },
          player4: { cards: [], seatStatus: "eliminated" },
        },
      },

      // Heads-up: both go all-in
      {
        type: "action",
        action: "RAISE",
        by: "player1",
        params: { amount: 200 },
      },
      { type: "action", action: "CHECK", by: "player3" },

      // Run out the board
      { type: "validate", game: { state: "DEAL_FLOP" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "K", suit: "d" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "Q", suit: "h" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "J", suit: "c" },
      },
      { type: "validate", game: { state: "DEAL_TURN" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "T", suit: "c" },
      },
      { type: "validate", game: { state: "DEAL_RIVER" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "8", suit: "s" },
      },

      // p1 wins with three kings, p3 eliminated
      { type: "validate", game: { state: "SHOWDOWN" } },
      {
        type: "validate",
        seats: { player3: { seatStatus: "eliminated", buyIn: 0 } },
      },

      // ===== Final: All 3 players eliminated =====
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      {
        type: "validate",
        seats: {
          player2: { seatStatus: "eliminated", buyIn: 0 },
          player3: { seatStatus: "eliminated", buyIn: 0 },
          player4: { seatStatus: "eliminated", buyIn: 0 },
        },
      },
    ],
  },
];

export default scenarios;
