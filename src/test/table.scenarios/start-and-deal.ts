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
  {
    name: "START_GAME during an active hand is rejected and leaks no blinds",
    steps: [
      {
        type: "join",
        players: [
          { key: "player1", buyIn: 200 },
          { key: "player2", buyIn: 200 },
          { key: "player3", buyIn: 200 },
        ],
      },
      { type: "action", action: "START_GAME", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer", isError: true },
      { type: "validate", game: { isCompleted: false } },
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      {
        type: "validate",
        seats: {
          player1: { buyIn: 200 },
          player2: { buyIn: 200 },
          player3: { buyIn: 200 },
        },
      },
    ],
  },
];

export default scenarios;
