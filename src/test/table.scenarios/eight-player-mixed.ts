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
      { type: "validate", game: { state: "DEAL_FLOP" } },

      // Flop
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
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "4", suit: "h" },
      },
      { type: "validate", game: { state: "BETTING" } },
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
      { type: "validate", game: { state: "DEAL_TURN" } },

      // Turn
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "5", suit: "h" },
      },
      { type: "validate", game: { state: "BETTING" } },
      { type: "action", action: "CHECK", by: "player2" },
      { type: "action", action: "CHECK", by: "player3" },
      { type: "action", action: "FOLD", by: "player7" },
      { type: "action", action: "CHECK", by: "player8" },
      { type: "action", action: "CHECK", by: "player1" },
      { type: "validate", game: { state: "DEAL_RIVER" } },

      // River
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "6", suit: "h" },
      },
      { type: "validate", game: { state: "BETTING" } },
      { type: "action", action: "CHECK", by: "player2" },
      { type: "action", action: "CHECK", by: "player3" },
      { type: "action", action: "CHECK", by: "player8" },
      { type: "action", action: "CHECK", by: "player1" },
      { type: "validate", game: { state: "SHOWDOWN" } },
    ],
  },
];

export default scenarios;
