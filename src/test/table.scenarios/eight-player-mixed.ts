import type { Scenario } from "~/test/scenario.types";

// 8-player hand with mixed actions across streets, no side pots
// Assumptions: everyone has sufficient stack (buyIn=300) and bets keep within stack sizes
// Flow: join 8 -> start -> deal 6 cards to feed deterministic board evaluator ->
// preflop: checks and some raises/folds -> flop: mixed -> turn: mixed -> river: mixed -> showdown

const scenarios: Scenario[] = [
  {
    name: "eight players: mixed actions no side pots",
    steps: [
      {
        type: "join",
        players: [
          "player1",
          "player2",
          "player3",
          "player4",
          "player5",
          "player6",
          "player7",
          "player8",
        ],
      },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "deal_hole",
        hole: {
          player1: ["As", "Ks"],
          player2: ["Qs", "Js"],
          player3: ["Ts", "9s"],
          player4: ["8s", "7s"],
          player5: ["6s", "5s"],
          player6: ["4s", "3s"],
          player7: ["2s", "Ad"],
          player8: ["Kd", "Qd"],
        },
      },
      { type: "validate", game: { state: "BETTING" } },

      // Preflop betting (UTG starts: player4), use CHECK to call to avoid side pots
      {
        type: "action",
        action: "RAISE",
        by: "player4",
        params: { amount: 20 },
      },
      { type: "action", action: "FOLD", by: "player5" },
      { type: "action", action: "CHECK", by: "player6" },
      { type: "action", action: "CHECK", by: "player7" },
      { type: "action", action: "CHECK", by: "player8" },
      { type: "action", action: "CHECK", by: "player1" },
      { type: "action", action: "CHECK", by: "player2" },
      { type: "action", action: "CHECK", by: "player3" },
      // After preflop betting: 5+10 blinds + 7 players call 20 = 140
      { type: "validate", game: { state: "DEAL_FLOP", potTotal: 140 } },

      // Flop (set up for a single winner later: AKQ on board, only player3 holds a T)
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
        params: { rank: "K", suit: "c" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "Q", suit: "h" },
      },
      { type: "validate", game: { state: "BETTING", potTotal: 140 } },
      { type: "action", action: "CHECK", by: "player2" },
      {
        type: "action",
        action: "RAISE",
        by: "player3",
        params: { amount: 30 },
      },
      { type: "action", action: "FOLD", by: "player4" },
      // Player 5 already folded
      { type: "action", action: "FOLD", by: "player6" },
      { type: "action", action: "CHECK", by: "player7" },
      { type: "action", action: "CHECK", by: "player8" },
      { type: "action", action: "CHECK", by: "player1" },
      { type: "action", action: "CHECK", by: "player2" },
      // After flop betting: 140 + (5 players × 30) = 290
      { type: "validate", game: { state: "DEAL_TURN", potTotal: 290 } },

      // Turn (J to complete Broadway only with a Ten in hole)
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "J", suit: "d" },
      },
      { type: "validate", game: { state: "BETTING", potTotal: 290 } },
      { type: "action", action: "CHECK", by: "player2" },
      { type: "action", action: "CHECK", by: "player3" },
      { type: "action", action: "FOLD", by: "player7" },
      { type: "action", action: "CHECK", by: "player8" },
      { type: "action", action: "CHECK", by: "player1" },
      // After turn betting: 290 + 0 (all checks) = 290
      { type: "validate", game: { state: "DEAL_RIVER", potTotal: 290 } },

      // River (blank that doesn't change hand ranking)
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "2", suit: "c" },
      },
      { type: "validate", game: { state: "BETTING", potTotal: 290 } },
      { type: "action", action: "CHECK", by: "player2" },
      { type: "action", action: "CHECK", by: "player3" },
      { type: "action", action: "CHECK", by: "player8" },
      { type: "action", action: "CHECK", by: "player1" },
      { type: "validate", game: { state: "SHOWDOWN" } },
      // Validate pot distribution: player3 has Broadway straight (AKQJT) and wins
      { type: "validate", game: { potTotal: 290 } },
      {
        type: "validate",
        seats: {
          // player1: As+Ks = Two Pair A's & K's
          player1: { winAmount: 0, buyIn: 250 },
          // player2: Qs+Js = Two Pair Q's & J's
          player2: { winAmount: 0, buyIn: 250 },
          // player3: Ts+9s = Broadway Straight (AKQJT) - WINNER
          player3: { winAmount: 290, buyIn: 540 },
          player4: { winAmount: 0, buyIn: 280 },
          player5: { winAmount: 0, buyIn: 300 },
          player6: { winAmount: 0, buyIn: 280 },
          player7: { winAmount: 0, buyIn: 250 },
          // player8: Kd+Qd = Two Pair K's & Q's
          player8: { winAmount: 0, buyIn: 250 },
        },
      },

      // Start second hand and validate dealer button moved to next active player (player2)
      { type: "action", action: "START_GAME", by: "dealer" },
      // After START_GAME, the new game's dealer button should advance by one active seat
      { type: "validate", dealerButtonFor: "player2" },
    ],
  },
];

export default scenarios;
