import type { Scenario } from "~/test/scenario.types";

const scenarios: Scenario[] = [
  {
    name: "betting round with raises and fold",
    steps: [
      { type: "join", players: ["player1", "player2", "player3"] },
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
];

export default scenarios;
