import type { Scenario } from "~/test/scenario.types";

/**
 * Option A: when the big blind busts, the next hand collects BB only (no SB)
 * from the next live player — so nobody skips paying a big blind.
 */
const scenarios: Scenario[] = [
  {
    name: "BB eliminated: next hand collects BB only from scheduled BB player",
    steps: [
      {
        type: "join",
        players: [
          { key: "player1" },
          { key: "player2" },
          { key: "player3", buyIn: 10 },
          { key: "player4" },
          { key: "player5" },
        ],
      },
      // Hand 1: P1=Btn, P2=SB, P3=BB (all-in posting)
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "validate",
        seats: {
          player2: { currentBet: 5, buyIn: 295 },
          player3: { currentBet: 10, buyIn: 0, seatStatus: "all-in" },
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
        },
      },
      { type: "validate", game: { state: "BETTING" }, firstToActFor: "player4" },
      { type: "action", action: "CHECK", by: "player4" },
      { type: "action", action: "FOLD", by: "player5" },
      { type: "action", action: "FOLD", by: "player1" },
      { type: "action", action: "FOLD", by: "player2" },
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
          player3: { seatStatus: "eliminated", buyIn: 0 },
          player4: { buyIn: 315 },
        },
      },

      // Hand 2: P2=Btn, no SB, P4=catch-up BB
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer" },
      { type: "validate", dealerButtonFor: "player2" },
      {
        type: "validate",
        seats: {
          player1: { currentBet: 0 },
          player2: { currentBet: 0 },
          player3: { seatStatus: "eliminated", currentBet: 0 },
          player4: { currentBet: 10, buyIn: 305 },
          player5: { currentBet: 0 },
        },
      },
      {
        type: "deal_hole",
        hole: {
          player1: ["Tc", "Jc"],
          player2: ["Qh", "Kh"],
          player4: ["Ad", "Ac"],
          player5: ["5d", "6d"],
        },
      },
      { type: "validate", game: { state: "BETTING" }, firstToActFor: "player5" },
    ],
  },
  {
    name: "BB eliminated catch-up then normal SB+BB on following hand",
    steps: [
      {
        type: "join",
        players: [
          { key: "player1" },
          { key: "player2" },
          { key: "player3", buyIn: 10 },
          { key: "player4" },
          { key: "player5" },
        ],
      },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "deal_hole",
        hole: {
          player1: ["2c", "3d"],
          player2: ["4h", "5h"],
          player3: ["6s", "7s"],
          player4: ["As", "Ah"],
          player5: ["8c", "9c"],
        },
      },
      { type: "action", action: "CHECK", by: "player4" },
      { type: "action", action: "FOLD", by: "player5" },
      { type: "action", action: "FOLD", by: "player1" },
      { type: "action", action: "FOLD", by: "player2" },
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

      // Hand 2: BB-only catch-up (quick fold to BB)
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "validate",
        seats: {
          player2: { currentBet: 0 },
          player4: { currentBet: 10 },
        },
      },
      {
        type: "deal_hole",
        hole: {
          player1: ["2s", "3s"],
          player2: ["4s", "5s"],
          player4: ["Ks", "Kc"],
          player5: ["7h", "8h"],
        },
      },
      { type: "action", action: "FOLD", by: "player5" },
      { type: "action", action: "FOLD", by: "player1" },
      { type: "action", action: "FOLD", by: "player2" },
      { type: "validate", game: { state: "SHOWDOWN" } },

      // Hand 3: normal SB + BB resume
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer" },
      { type: "validate", dealerButtonFor: "player4" },
      {
        type: "validate",
        seats: {
          player5: { currentBet: 5 },
          player1: { currentBet: 10 },
          player2: { currentBet: 0 },
          player4: { currentBet: 0 },
        },
      },
    ],
  },
];

export default scenarios;
