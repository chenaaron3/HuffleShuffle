import type { Scenario } from "~/test/scenario.types";

/**
 * End-to-end coverage of the TDA dead-button examples:
 * 1. Normal advance
 * 2. BB busts → no SB
 * 3. SB busts → dead button
 * 4. Both blinds bust
 * 5. Old eliminated seat between button and blinds (no false skip-SB)
 * 6. Heads-up + 3→2
 */
const scenarios: Scenario[] = [
  {
    name: "TDA example 1: normal advance Btn/SB/BB each hand",
    steps: [
      {
        type: "join",
        players: [
          { key: "player1" },
          { key: "player2" },
          { key: "player3" },
          { key: "player4" },
        ],
      },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "validate",
        dealerButtonFor: "player1",
        smallBlindFor: "player2",
        bigBlindFor: "player3",
        seats: {
          player2: { currentBet: 5 },
          player3: { currentBet: 10 },
        },
      },
      {
        type: "deal_hole",
        hole: {
          player1: ["2c", "3d"],
          player2: ["4h", "5h"],
          player3: ["6s", "7s"],
          player4: ["As", "Ah"],
        },
      },
      { type: "action", action: "FOLD", by: "player4" },
      { type: "action", action: "FOLD", by: "player1" },
      { type: "action", action: "FOLD", by: "player2" },
      { type: "validate", game: { state: "SHOWDOWN" } },

      { type: "action", action: "RESET_TABLE", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "validate",
        dealerButtonFor: "player2",
        smallBlindFor: "player3",
        bigBlindFor: "player4",
        seats: {
          player3: { currentBet: 5 },
          player4: { currentBet: 10 },
          player1: { currentBet: 0 },
          player2: { currentBet: 0 },
        },
      },
    ],
  },
  {
    name: "TDA example 2: BB busts → next hand Btn=prev SB, no SB, BB=next live",
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
        type: "validate",
        dealerButtonFor: "player1",
        smallBlindFor: "player2",
        bigBlindFor: "player3",
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
        seats: { player3: { seatStatus: "eliminated" } },
      },

      { type: "action", action: "RESET_TABLE", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "validate",
        dealerButtonFor: "player2",
        smallBlindFor: null,
        bigBlindFor: "player4",
        seats: {
          player2: { currentBet: 0 },
          player4: { currentBet: 10 },
          player1: { currentBet: 0 },
          player5: { currentBet: 0 },
        },
      },
    ],
  },
  {
    name: "TDA example 3: SB busts → dead button on empty SB seat",
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
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "validate",
        dealerButtonFor: "player1",
        smallBlindFor: "player2",
        bigBlindFor: "player3",
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
      { type: "action", action: "CHECK", by: "player4" },
      { type: "action", action: "FOLD", by: "player5" },
      { type: "action", action: "FOLD", by: "player1" },
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
      { type: "action", action: "CHECK", by: "player3" },
      { type: "action", action: "CHECK", by: "player4" },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "2", suit: "h" },
      },
      { type: "action", action: "CHECK", by: "player3" },
      { type: "action", action: "CHECK", by: "player4" },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "3", suit: "h" },
      },
      { type: "action", action: "CHECK", by: "player3" },
      { type: "action", action: "CHECK", by: "player4" },
      { type: "validate", game: { state: "SHOWDOWN" } },
      {
        type: "validate",
        seats: { player2: { seatStatus: "eliminated" } },
      },

      { type: "action", action: "RESET_TABLE", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "validate",
        // Dead button remains on eliminated P2
        dealerButtonFor: "player2",
        smallBlindFor: "player3",
        bigBlindFor: "player4",
        seats: {
          player3: { currentBet: 5 },
          player4: { currentBet: 10 },
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
      {
        type: "validate",
        game: { state: "BETTING" },
        firstToActFor: "player5",
      },
    ],
  },
  {
    name: "TDA example 4: both blinds bust → dead button, no SB",
    steps: [
      {
        type: "join",
        players: [
          { key: "player1" },
          { key: "player2", buyIn: 5 },
          { key: "player3", buyIn: 10 },
          { key: "player4" },
          { key: "player5" },
        ],
      },
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
        },
      },
      { type: "action", action: "CHECK", by: "player4" },
      { type: "action", action: "FOLD", by: "player5" },
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

      { type: "action", action: "RESET_TABLE", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "validate",
        dealerButtonFor: "player2",
        smallBlindFor: null,
        bigBlindFor: "player4",
        seats: {
          player4: { currentBet: 10 },
          player1: { currentBet: 0 },
          player5: { currentBet: 0 },
        },
      },
    ],
  },
  {
    name: "TDA example 5: prior elim between button and blinds does not skip SB",
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
      // Hand 1: bust P2 (SB) so seat 2 is eliminated going forward
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
      { type: "action", action: "CHECK", by: "player2" },
      { type: "action", action: "CHECK", by: "player3" },
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
      { type: "action", action: "CHECK", by: "player3" },
      { type: "action", action: "CHECK", by: "player4" },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "2", suit: "h" },
      },
      { type: "action", action: "CHECK", by: "player3" },
      { type: "action", action: "CHECK", by: "player4" },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "3", suit: "h" },
      },
      { type: "action", action: "CHECK", by: "player3" },
      { type: "action", action: "CHECK", by: "player4" },
      { type: "validate", game: { state: "SHOWDOWN" } },
      {
        type: "validate",
        seats: { player2: { seatStatus: "eliminated" } },
      },

      // Hand 2: dead button on P2, P3=SB, P4=BB — play a quick fold to BB
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "validate",
        dealerButtonFor: "player2",
        smallBlindFor: "player3",
        bigBlindFor: "player4",
      },
      {
        type: "deal_hole",
        hole: {
          player1: ["2s", "3s"],
          player3: ["4s", "5s"],
          player4: ["Ks", "Kc"],
          player5: ["7h", "8h"],
        },
      },
      { type: "action", action: "FOLD", by: "player5" },
      { type: "action", action: "FOLD", by: "player1" },
      { type: "action", action: "FOLD", by: "player3" },
      { type: "validate", game: { state: "SHOWDOWN" } },

      // Hand 3: stored blinds were SB=P3 BB=P4 — advance normally (Btn3 SB4 BB5)
      // Must NOT treat eliminated P2 as previous BB and skip SB
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
          player3: { currentBet: 0 },
        },
      },
    ],
  },
  {
    name: "TDA example 6: heads-up button=SB, then swap; includes 3-to-2",
    steps: [
      {
        type: "join",
        players: [
          { key: "player1" },
          { key: "player2" },
          { key: "player3", buyIn: 10 },
        ],
      },
      // Hand 1 (3-way): P1 btn, P2 SB, P3 BB all-in → P3 busts
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "validate",
        dealerButtonFor: "player1",
        smallBlindFor: "player2",
        bigBlindFor: "player3",
      },
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
        seats: { player3: { seatStatus: "eliminated" } },
      },

      // Hand 2 HU from 3→2: next BB after prev BB(P3) = P1; other P2 = SB/button
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "validate",
        dealerButtonFor: "player2",
        smallBlindFor: "player2",
        bigBlindFor: "player1",
        seats: {
          player2: { currentBet: 5 },
          player1: { currentBet: 10 },
        },
        firstToActFor: "player2",
      },
      {
        type: "deal_hole",
        hole: {
          player1: ["Td", "Tc"],
          player2: ["9h", "9c"],
        },
      },
      { type: "action", action: "FOLD", by: "player2" },
      { type: "validate", game: { state: "SHOWDOWN" } },

      // Hand 3 HU: blinds swap
      { type: "action", action: "RESET_TABLE", by: "dealer" },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "validate",
        dealerButtonFor: "player1",
        smallBlindFor: "player1",
        bigBlindFor: "player2",
        seats: {
          player1: { currentBet: 5 },
          player2: { currentBet: 10 },
        },
        firstToActFor: "player1",
      },
    ],
  },
];

export default scenarios;
