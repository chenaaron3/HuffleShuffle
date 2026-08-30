import type { Scenario } from "~/test/scenario.types";

/**
 * TDA dead button, 8-handed: Seat 1 starts with the button; Seats 2 (SB) and
 * 3 (BB) bust on the same hand. Button and blinds are placed relative to the
 * advancing live BB, even when they land on empty seats.
 *
 * Hand 1: Btn P1, SB P2, BB P3 (both blinds eliminated)
 * Hand 2: dead Btn P2, dead SB, BB P4 — P1 acts last postflop
 * Hand 3: dead Btn P3, SB P4, BB P5 — P1 acts last postflop again
 * Hand 4: Btn P4, SB P5, BB P6 — back to normal
 */
const scenarios: Scenario[] = [
  {
    name: "TDA 8-handed: both blinds bust → double dead → single dead → normal",
    steps: [
      {
        type: "join",
        players: [
          { key: "player1" },
          { key: "player2", buyIn: 5 },
          { key: "player3", buyIn: 10 },
          { key: "player4" },
          { key: "player5" },
          { key: "player6" },
          { key: "player7" },
          { key: "player8" },
        ],
      },

      // Hand 1: P1 button, P2 SB all-in, P3 BB all-in
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "validate",
        dealerButtonFor: "player1",
        smallBlindFor: "player2",
        bigBlindFor: "player3",
        seats: {
          player2: { currentBet: 5, seatStatus: "all-in" },
          player3: { currentBet: 10, seatStatus: "all-in" },
        },
      },
      {
        type: "deal_hole",
        hole: {
          player1: ["2c", "3d"],
          player2: ["4h", "5h"],
          player3: ["6s", "7s"],
          player4: ["As", "Ah"],
          player5: ["8c", "9c"],
          player6: ["2s", "3s"],
          player7: ["4c", "5c"],
          player8: ["6c", "7c"],
        },
      },
      { type: "validate", game: { state: "BETTING" }, firstToActFor: "player4" },
      { type: "action", action: "CHECK", by: "player4" },
      { type: "action", action: "FOLD", by: "player5" },
      { type: "action", action: "FOLD", by: "player6" },
      { type: "action", action: "FOLD", by: "player7" },
      { type: "action", action: "FOLD", by: "player8" },
      { type: "action", action: "FOLD", by: "player1" },
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
        params: { rank: "Q", suit: "d" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "J", suit: "d" },
      },
      { type: "validate", game: { state: "DEAL_TURN" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "2", suit: "h" },
      },
      { type: "validate", game: { state: "DEAL_RIVER" } },
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
          player2: { seatStatus: "eliminated" },
          player3: { seatStatus: "eliminated" },
        },
      },

      // Hand 2: dead button on P2, no SB, BB on P4. Postflop first = P4 (P1 last).
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "validate",
        dealerButtonFor: "player2",
        smallBlindFor: null,
        bigBlindFor: "player4",
        seats: {
          player1: { currentBet: 0 },
          player4: { currentBet: 10 },
          player5: { currentBet: 0 },
        },
      },
      {
        type: "deal_hole",
        hole: {
          player1: ["Tc", "Jc"],
          player4: ["Kd", "Kc"],
          player5: ["2d", "3c"],
          player6: ["4d", "5d"],
          player7: ["6d", "7d"],
          player8: ["8d", "9d"],
        },
      },
      { type: "validate", game: { state: "BETTING" }, firstToActFor: "player5" },
      { type: "action", action: "CHECK", by: "player5" },
      { type: "action", action: "FOLD", by: "player6" },
      { type: "action", action: "FOLD", by: "player7" },
      { type: "action", action: "FOLD", by: "player8" },
      { type: "action", action: "FOLD", by: "player1" },
      { type: "action", action: "CHECK", by: "player4" },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "2", suit: "s" },
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
        params: { rank: "4", suit: "s" },
      },
      { type: "validate", game: { state: "BETTING" }, firstToActFor: "player4" },
      { type: "action", action: "CHECK", by: "player4" },
      { type: "action", action: "CHECK", by: "player5" },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "5", suit: "s" },
      },
      { type: "action", action: "CHECK", by: "player4" },
      { type: "action", action: "CHECK", by: "player5" },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "6", suit: "s" },
      },
      { type: "action", action: "CHECK", by: "player4" },
      { type: "action", action: "CHECK", by: "player5" },
      { type: "validate", game: { state: "SHOWDOWN" } },

      // Hand 3: dead button on P3, SB P4, BB P5. Postflop first = P4 (P1 last again).
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "validate",
        dealerButtonFor: "player3",
        smallBlindFor: "player4",
        bigBlindFor: "player5",
        seats: {
          player4: { currentBet: 5 },
          player5: { currentBet: 10 },
          player1: { currentBet: 0 },
          player6: { currentBet: 0 },
        },
      },
      {
        type: "deal_hole",
        hole: {
          player1: ["Ts", "Js"],
          player4: ["Qh", "Kh"],
          player5: ["Ad", "Ac"],
          player6: ["2h", "3h"],
          player7: ["4h", "5s"],
          player8: ["6h", "7h"],
        },
      },
      { type: "validate", game: { state: "BETTING" }, firstToActFor: "player6" },
      { type: "action", action: "FOLD", by: "player6" },
      { type: "action", action: "FOLD", by: "player7" },
      { type: "action", action: "FOLD", by: "player8" },
      { type: "action", action: "FOLD", by: "player1" },
      { type: "action", action: "FOLD", by: "player4" },
      { type: "validate", game: { state: "SHOWDOWN" } },

      // Hand 4: button finally on a live player (P4)
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "validate",
        dealerButtonFor: "player4",
        smallBlindFor: "player5",
        bigBlindFor: "player6",
        seats: {
          player5: { currentBet: 5 },
          player6: { currentBet: 10 },
          player1: { currentBet: 0 },
          player4: { currentBet: 0 },
        },
      },
    ],
  },
];

export default scenarios;
