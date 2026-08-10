import type { Scenario } from "~/test/scenario.types";

/**
 * TDA dead button: when SB busts, button sits on the empty seat;
 * previous BB posts SB; next live player posts BB.
 */
const scenarios: Scenario[] = [
  {
    name: "SB eliminated: next hand has dead button on empty SB seat",
    steps: [
      {
        type: "join",
        players: [
          { key: "player1" },
          { key: "player2", buyIn: 10 },
          { key: "player3" },
          { key: "player4" },
          { key: "player5" },
        ],
      },
      // Hand 1: P1=Btn, P2=SB (all-in), P3=BB
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "validate",
        seats: {
          player2: { currentBet: 5, buyIn: 5, seatStatus: "active" },
          player3: { currentBet: 10, buyIn: 290 },
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
      // P2 calls BB with remaining chips (all-in)
      { type: "action", action: "CHECK", by: "player2" },
      { type: "action", action: "CHECK", by: "player3" },
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
      { type: "validate", game: { state: "BETTING" } },
      { type: "action", action: "CHECK", by: "player3" },
      { type: "action", action: "CHECK", by: "player4" },
      { type: "validate", game: { state: "DEAL_TURN" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "2", suit: "h" },
      },
      { type: "validate", game: { state: "BETTING" } },
      { type: "action", action: "CHECK", by: "player3" },
      { type: "action", action: "CHECK", by: "player4" },
      { type: "validate", game: { state: "DEAL_RIVER" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "3", suit: "h" },
      },
      { type: "validate", game: { state: "BETTING" } },
      { type: "action", action: "CHECK", by: "player3" },
      { type: "action", action: "CHECK", by: "player4" },
      { type: "validate", game: { state: "SHOWDOWN" } },
      {
        type: "validate",
        seats: {
          player2: { seatStatus: "eliminated", buyIn: 0 },
          player4: { buyIn: 320 },
        },
      },

      // Hand 2: dead button on P2, P3=SB, P4=BB
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "validate",
        seats: {
          player1: { currentBet: 0 },
          player2: { seatStatus: "eliminated", currentBet: 0 },
          player3: { currentBet: 5, buyIn: 285 },
          player4: { currentBet: 10, buyIn: 310 },
          player5: { currentBet: 0 },
        },
      },
      {
        type: "deal_hole",
        hole: {
          player1: ["Tc", "Jc"],
          player3: ["Qh", "Kh"],
          player4: ["Ad", "Ac"],
          player5: ["5d", "6d"],
        },
      },
      // Postflop first-to-act is left of dead button = P3; preflop UTG = P5
      { type: "validate", game: { state: "BETTING" }, firstToActFor: "player5" },
    ],
  },
  {
    name: "heads-up: button posts SB and acts first preflop",
    steps: [
      {
        type: "join",
        players: [{ key: "player1" }, { key: "player2" }],
      },
      { type: "action", action: "START_GAME", by: "dealer" },
      { type: "validate", dealerButtonFor: "player1" },
      {
        type: "validate",
        seats: {
          player1: { currentBet: 5, buyIn: 295 },
          player2: { currentBet: 10, buyIn: 290 },
        },
      },
      {
        type: "deal_hole",
        hole: {
          player1: ["As", "Kh"],
          player2: ["Qd", "Jc"],
        },
      },
      { type: "validate", game: { state: "BETTING" }, firstToActFor: "player1" },
      { type: "action", action: "FOLD", by: "player1" },
      { type: "validate", game: { state: "SHOWDOWN" } },

      // Hand 2: blinds swap — P2 is SB/button, P1 is BB
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer" },
      { type: "validate", dealerButtonFor: "player2" },
      {
        type: "validate",
        seats: {
          player2: { currentBet: 5 },
          player1: { currentBet: 10 },
        },
      },
      {
        type: "deal_hole",
        hole: {
          player1: ["2c", "3d"],
          player2: ["4h", "5h"],
        },
      },
      { type: "validate", game: { state: "BETTING" }, firstToActFor: "player2" },
    ],
  },
  {
    name: "3-to-2: next BB is first live after previous BB; other is SB/button",
    steps: [
      {
        type: "join",
        players: [
          { key: "player1" },
          { key: "player2" },
          { key: "player3", buyIn: 10 },
        ],
      },
      // Hand 1: P1=Btn, P2=SB, P3=BB (all-in posting)
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "deal_hole",
        hole: {
          player1: ["2c", "3d"],
          player2: ["4h", "5h"],
          player3: ["6s", "7s"],
        },
      },
      { type: "action", action: "CHECK", by: "player1" },
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
          player3: { seatStatus: "eliminated" },
        },
      },

      // Hand 2 HU: previous BB was P3 (elim) → next BB = P1, other (P2) = SB/button
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer" },
      { type: "validate", dealerButtonFor: "player2" },
      {
        type: "validate",
        seats: {
          player2: { currentBet: 5 },
          player1: { currentBet: 10 },
          player3: { seatStatus: "eliminated", currentBet: 0 },
        },
      },
      {
        type: "deal_hole",
        hole: {
          player1: ["As", "Ah"],
          player2: ["Kd", "Kc"],
        },
      },
      { type: "validate", game: { state: "BETTING" }, firstToActFor: "player2" },
    ],
  },
];

export default scenarios;
