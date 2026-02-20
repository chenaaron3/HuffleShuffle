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
        seats: {
          player1: { buyIn: 200 },
          player2: { seatStatus: "eliminated", buyIn: 0 },
          player3: { buyIn: 100 },
          player4: { buyIn: 70 },
        },
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
      {
        type: "action",
        action: "RAISE",
        by: "player3",
        params: { amount: 70 },
      },
      { type: "action", action: "CHECK", by: "player4" },
      { type: "action", action: "FOLD", by: "player1" },

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
        seats: {
          player1: { buyIn: 190 },
          player2: { seatStatus: "eliminated", buyIn: 0 },
          player3: { buyIn: 180 },
          player4: { seatStatus: "eliminated", buyIn: 0 },
        },
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

      // Both go all-in: p3 acts first (UTG), p1 calls
      // After blinds: p1 has 180 chips (10 in pot as BB), p3 has 175 chips (5 in pot as SB)
      {
        type: "action",
        action: "RAISE",
        by: "player3",
        params: { amount: 180 }, // Goes all-in for 175 more (total bet 180)
      },
      { type: "action", action: "CHECK", by: "player1" }, // Calls for 170 more (total bet 180)

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
        seats: {
          player1: { buyIn: 370 },
          player2: { seatStatus: "eliminated", buyIn: 0 },
          player3: { seatStatus: "eliminated", buyIn: 0 },
          player4: { seatStatus: "eliminated", buyIn: 0 },
        },
      },

      // ===== Final: All 3 players eliminated =====
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      {
        type: "validate",
        seats: {
          player1: { buyIn: 370 },
          player2: { seatStatus: "eliminated", buyIn: 0 },
          player3: { seatStatus: "eliminated", buyIn: 0 },
          player4: { seatStatus: "eliminated", buyIn: 0 },
        },
      },
    ],
  },
  {
    name: "Player elimination: 8 players, 8 hands, eliminate to 1 winner",
    steps: [
      // Setup: 8 players (7×200 + 1×195 = 1595 total chips)
      {
        type: "join",
        players: [
          { key: "player1", buyIn: 200 },
          { key: "player2", buyIn: 200 },
          { key: "player3", buyIn: 200 },
          { key: "player4", buyIn: 200 },
          { key: "player5", buyIn: 200 },
          { key: "player6", buyIn: 200 },
          { key: "player7", buyIn: 195 },
          { key: "player8", buyIn: 200 },
        ],
      },

      // HAND 1: Everyone folds to BB (Button: p1, SB: p2, BB: p3)
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "deal_hole",
        hole: {
          player1: ["2c", "3c"],
          player2: ["4d", "5d"],
          player3: ["Kh", "Kc"],
          player4: ["6s", "7s"],
          player5: ["8h", "9h"],
          player6: ["Tc", "Jc"],
          player7: ["Qd", "2d"],
          player8: ["3h", "4h"],
        },
      },
      { type: "action", action: "FOLD", by: "player4" },
      { type: "action", action: "FOLD", by: "player5" },
      { type: "action", action: "FOLD", by: "player6" },
      { type: "action", action: "FOLD", by: "player7" },
      { type: "action", action: "FOLD", by: "player8" },
      { type: "action", action: "FOLD", by: "player1" },
      { type: "action", action: "FOLD", by: "player2" },
      { type: "validate", game: { state: "SHOWDOWN" } },
      {
        type: "validate",
        seats: {
          player1: { buyIn: 200 },
          player2: { buyIn: 195 },
          player3: { buyIn: 205 },
          player4: { buyIn: 200 },
          player5: { buyIn: 200 },
          player6: { buyIn: 200 },
          player7: { buyIn: 195 },
          player8: { buyIn: 200 },
        },
      },

      // HAND 2: p7 eliminated in all-in
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "deal_hole",
        hole: {
          player1: ["3s", "4s"],
          player2: ["As", "Ah"],
          player3: ["Kd", "Qd"],
          player4: ["7h", "8h"],
          player5: ["2c", "2d"],
          player6: ["Jc", "Tc"],
          player7: ["9s", "9h"],
          player8: ["5c", "6c"],
        },
      },
      { type: "action", action: "FOLD", by: "player5" },
      { type: "action", action: "FOLD", by: "player6" },
      {
        type: "action",
        action: "RAISE",
        by: "player7",
        params: { amount: 195 },
      },
      { type: "action", action: "FOLD", by: "player8" },
      { type: "action", action: "FOLD", by: "player1" },
      { type: "action", action: "CHECK", by: "player2" },
      { type: "action", action: "FOLD", by: "player3" },
      { type: "action", action: "FOLD", by: "player4" },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "T", suit: "d" },
      },
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
        params: { rank: "2", suit: "h" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "3", suit: "h" },
      },
      { type: "validate", game: { state: "SHOWDOWN" } },
      {
        type: "validate",
        seats: {
          player1: { buyIn: 200 },
          player2: { buyIn: 405 },
          player3: { buyIn: 200 },
          player4: { buyIn: 190 },
          player5: { buyIn: 200 },
          player6: { buyIn: 200 },
          player7: { buyIn: 0, seatStatus: "eliminated" },
          player8: { buyIn: 200 },
        },
      },

      // HAND 3: 3-way all-in, p1 and p5 eliminated
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "deal_hole",
        hole: {
          player1: ["Kh", "Kc"],
          player2: ["Ad", "Ac"],
          player3: ["Qs", "Qh"],
          player4: ["7c", "8c"],
          player5: ["Jd", "Jh"],
          player6: ["4s", "5s"],
          player8: ["9h", "Th"],
        },
      },
      { type: "action", action: "FOLD", by: "player6" },
      { type: "action", action: "FOLD", by: "player8" },
      {
        type: "action",
        action: "RAISE",
        by: "player1",
        params: { amount: 200 },
      },
      {
        type: "action",
        action: "RAISE",
        by: "player2",
        params: { amount: 400 },
      },
      { type: "action", action: "FOLD", by: "player3" },
      { type: "action", action: "FOLD", by: "player4" },
      { type: "action", action: "CHECK", by: "player5" },
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
        params: { rank: "5", suit: "c" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "6", suit: "d" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "7", suit: "s" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "8", suit: "d" },
      },
      { type: "validate", game: { state: "SHOWDOWN" } },
      {
        type: "validate",
        seats: {
          player1: { buyIn: 0, seatStatus: "eliminated" },
          player2: { buyIn: 810 },
          player3: { buyIn: 200 },
          player4: { buyIn: 185 },
          player5: { buyIn: 0, seatStatus: "eliminated" },
          player6: { buyIn: 200 },
          player7: { buyIn: 0, seatStatus: "eliminated" },
          player8: { buyIn: 200 },
        },
      },

      // HAND 4: Small pot
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "deal_hole",
        hole: {
          player2: ["Kh", "Qh"],
          player3: ["Js", "Ts"],
          player4: ["2c", "3c"],
          player6: ["6h", "7h"],
          player8: ["8s", "9s"],
        },
      },
      {
        type: "action",
        action: "RAISE",
        by: "player2",
        params: { amount: 30 },
      },
      { type: "action", action: "FOLD", by: "player3" },
      { type: "action", action: "FOLD", by: "player4" },
      { type: "action", action: "FOLD", by: "player6" },
      { type: "action", action: "FOLD", by: "player8" },
      { type: "validate", game: { state: "SHOWDOWN" } },
      {
        type: "validate",
        seats: {
          player1: { buyIn: 0, seatStatus: "eliminated" },
          player2: { buyIn: 825 },
          player3: { buyIn: 200 },
          player4: { buyIn: 185 },
          player5: { buyIn: 0, seatStatus: "eliminated" },
          player6: { buyIn: 195 },
          player7: { buyIn: 0, seatStatus: "eliminated" },
          player8: { buyIn: 190 },
        },
      },

      // HAND 5: p4 eliminated (Button: p6, SB: p8, BB: p2, First to act: p3)
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "deal_hole",
        hole: {
          player2: ["Ad", "Kc"],
          player3: ["9h", "Th"],
          player4: ["Qd", "Jd"],
          player6: ["2c", "3c"],
          player8: ["5s", "6s"],
        },
      },
      {
        type: "action",
        action: "RAISE",
        by: "player3",
        params: { amount: 50 },
      },
      {
        type: "action",
        action: "RAISE",
        by: "player4",
        params: { amount: 185 },
      },
      { type: "action", action: "FOLD", by: "player6" },
      { type: "action", action: "FOLD", by: "player8" },
      {
        type: "action",
        action: "RAISE",
        by: "player2",
        params: { amount: 320 },
      },
      { type: "action", action: "FOLD", by: "player3" },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "A", suit: "h" },
      },
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
        params: { rank: "4", suit: "d" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "7", suit: "h" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "8", suit: "d" },
      },
      { type: "validate", game: { state: "SHOWDOWN" } },
      {
        type: "validate",
        seats: {
          player1: { buyIn: 0, seatStatus: "eliminated" },
          player2: { buyIn: 1065 },
          player3: { buyIn: 150 },
          player4: { buyIn: 0, seatStatus: "eliminated" },
          player5: { buyIn: 0, seatStatus: "eliminated" },
          player6: { buyIn: 195 },
          player7: { buyIn: 0, seatStatus: "eliminated" },
          player8: { buyIn: 185 },
        },
      },

      // HAND 6: p3 eliminated (Button: p8, SB: p2, BB: p3, First to act: p6)
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "deal_hole",
        hole: {
          player2: ["7s", "8s"],
          player3: ["Qc", "Js"],
          player6: ["Ah", "As"],
          player8: ["3d", "4c"],
        },
      },
      {
        type: "action",
        action: "RAISE",
        by: "player6",
        params: { amount: 100 },
      },
      { type: "action", action: "FOLD", by: "player8" },
      { type: "action", action: "FOLD", by: "player2" },
      {
        type: "action",
        action: "RAISE",
        by: "player3",
        params: { amount: 150 },
      },
      { type: "action", action: "CHECK", by: "player6" },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "A", suit: "c" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "K", suit: "h" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "9", suit: "c" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "2", suit: "h" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "5", suit: "d" },
      },
      { type: "validate", game: { state: "SHOWDOWN" } },
      {
        type: "validate",
        seats: {
          player1: { buyIn: 0, seatStatus: "eliminated" },
          player2: { buyIn: 1060 },
          player3: { buyIn: 0, seatStatus: "eliminated" },
          player4: { buyIn: 0, seatStatus: "eliminated" },
          player5: { buyIn: 0, seatStatus: "eliminated" },
          player6: { buyIn: 350 },
          player7: { buyIn: 0, seatStatus: "eliminated" },
          player8: { buyIn: 185 },
        },
      },

      // HAND 7: p8 eliminated (Button: p2, SB: p6, BB: p8, First to act: p2)
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "deal_hole",
        hole: {
          player2: ["Kh", "Qh"],
          player6: ["9c", "Tc"],
          player8: ["Jc", "Ts"],
        },
      },
      {
        type: "action",
        action: "RAISE",
        by: "player2",
        params: { amount: 100 },
      },
      { type: "action", action: "FOLD", by: "player6" },
      {
        type: "action",
        action: "RAISE",
        by: "player8",
        params: { amount: 185 },
      },
      { type: "action", action: "CHECK", by: "player2" },
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
        params: { rank: "Q", suit: "d" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "3", suit: "s" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "7", suit: "c" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "2", suit: "d" },
      },
      { type: "validate", game: { state: "SHOWDOWN" } },
      {
        type: "validate",
        seats: {
          player1: { buyIn: 0, seatStatus: "eliminated" },
          player2: { buyIn: 1250 },
          player3: { buyIn: 0, seatStatus: "eliminated" },
          player4: { buyIn: 0, seatStatus: "eliminated" },
          player5: { buyIn: 0, seatStatus: "eliminated" },
          player6: { buyIn: 345 },
          player7: { buyIn: 0, seatStatus: "eliminated" },
          player8: { buyIn: 0, seatStatus: "eliminated" },
        },
      },

      // HAND 8 (FINAL): p6 eliminated, p2 wins tournament (Button: p6, SB: p6, BB: p2)
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "deal_hole",
        hole: {
          player2: ["Ac", "Ad"],
          player6: ["Ks", "Qc"],
        },
      },
      {
        type: "action",
        action: "RAISE",
        by: "player2",
        params: { amount: 100 },
      },
      {
        type: "action",
        action: "RAISE",
        by: "player6",
        params: { amount: 345 },
      },
      { type: "action", action: "CHECK", by: "player2" },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "5", suit: "h" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "9", suit: "s" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "3", suit: "h" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "6", suit: "d" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "4", suit: "h" },
      },
      { type: "validate", game: { state: "SHOWDOWN" } },
      {
        type: "validate",
        seats: {
          player1: { buyIn: 0, seatStatus: "eliminated" },
          player2: { buyIn: 1595 },
          player3: { buyIn: 0, seatStatus: "eliminated" },
          player4: { buyIn: 0, seatStatus: "eliminated" },
          player5: { buyIn: 0, seatStatus: "eliminated" },
          player6: { buyIn: 0, seatStatus: "eliminated" },
          player7: { buyIn: 0, seatStatus: "eliminated" },
          player8: { buyIn: 0, seatStatus: "eliminated" },
        },
      },

      // Try to start a new game with only 1 player - should throw
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      {
        type: "action",
        action: "START_GAME",
        by: "dealer",
        isError: true,
      },
    ],
  },
];

export default scenarios;
