import type { Scenario } from "~/test/scenario.types";

const scenarios: Scenario[] = [
  {
    name: "start game and deal hole cards",
    steps: [
      {
        type: "join",
        players: [{ key: "player1" }, { key: "player2" }, { key: "player3" }],
      },
      { type: "action", action: "START_GAME", by: "dealer" },
      { type: "validate", game: { state: "DEAL_HOLE_CARDS" } },
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
      { type: "validate", game: { state: "BETTING" } },
    ],
  },
];

export default scenarios;
