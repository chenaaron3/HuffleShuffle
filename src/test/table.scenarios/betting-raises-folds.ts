import type { Scenario } from "~/test/scenario.types";

const scenarios: Scenario[] = [
  {
    name: "betting round with raises and fold",
    steps: [
      {
        type: "join",
        players: [{ key: "player1" }, { key: "player2" }, { key: "player3" }],
      },
      { type: "action", action: "START_GAME", by: "dealer" },
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
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "T", suit: "s" },
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
        params: { rank: "8", suit: "s" },
        isError: true,
      },
      { type: "validate", game: { state: "BETTING" } },
      {
        type: "action",
        action: "RAISE",
        by: "player1",
        params: { amount: 50 },
      },
      { type: "action", action: "CHECK", by: "player2" },
      {
        type: "action",
        action: "RAISE",
        by: "player3",
        params: { amount: 150 },
      },
      { type: "action", action: "CHECK", by: "player1" },
      { type: "action", action: "FOLD", by: "player2" },
      { type: "validate", game: { state: "DEAL_FLOP", potTotal: 350 } },
    ],
  },
  {
    name: "min re-raise validation (TDA rule)",
    steps: [
      {
        type: "join",
        players: [{ key: "player1" }, { key: "player2" }],
      },
      { type: "action", action: "START_GAME", by: "dealer" },
      // Deal hole cards (6 cards total for 2 players)
      { type: "action", action: "DEAL_CARD", by: "dealer", params: { rank: "A", suit: "s" } },
      { type: "action", action: "DEAL_CARD", by: "dealer", params: { rank: "K", suit: "s" } },
      { type: "action", action: "DEAL_CARD", by: "dealer", params: { rank: "Q", suit: "s" } },
      { type: "action", action: "DEAL_CARD", by: "dealer", params: { rank: "J", suit: "s" } },
      { type: "validate", game: { state: "BETTING" } },
      // Heads-up: SB (player2) acts first. P2 raises to 50 (BB=10, increment 40; min re-raise = 90)
      { type: "action", action: "RAISE", by: "player2", params: { amount: 50 } },
      // P1 (BB) tries invalid re-raise to 70 (increment 20 < 40) - must fail
      {
        type: "action",
        action: "RAISE",
        by: "player1",
        params: { amount: 70 },
        isError: true,
      },
      // P1 makes valid min re-raise to 90
      { type: "action", action: "RAISE", by: "player1", params: { amount: 90 } },
      { type: "action", action: "CHECK", by: "player2" }, // P2 calls
      { type: "validate", game: { state: "DEAL_FLOP" } },
    ],
  },
];

export default scenarios;
