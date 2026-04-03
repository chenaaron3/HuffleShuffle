import type { Scenario } from "~/test/scenario.types";

/**
 * When a blind poster is forced all-in posting the blind, they become seatStatus
 * "all-in". Blind *positions* must still be resolved with the dealable chain
 * (active + all-in), not only "active", or the wrong seat gets assignedSeatId /
 * first hole card / UTG anchoring.
 */
const scenarios: Scenario[] = [
  {
    name: "small blind all-in: first hole card dealt to small blind seat",
    steps: [
      {
        type: "join",
        players: [
          { key: "player1" },
          { key: "player2", buyIn: 5 },
          { key: "player3" },
        ],
      },
      { type: "action", action: "START_GAME", by: "dealer" },
      { type: "validate", game: { state: "DEAL_HOLE_CARDS" } },
      {
        type: "validate",
        seats: {
          player2: {
            seatStatus: "all-in",
            currentBet: 5,
            buyIn: 0,
          },
          player3: {
            seatStatus: "active",
            currentBet: 10,
          },
        },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "A", suit: "s" },
      },
      {
        type: "validate",
        seats: {
          player2: { cards: ["As"] },
        },
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
        type: "validate",
        game: { state: "BETTING" },
        firstToActFor: "player1",
      },
    ],
  },
  {
    name: "big blind all-in: preflop first actor is UTG after correct BB anchor",
    steps: [
      {
        type: "join",
        players: [
          { key: "player1" },
          { key: "player2" },
          { key: "player3", buyIn: 10 },
        ],
      },
      { type: "action", action: "START_GAME", by: "dealer" },
      { type: "validate", game: { state: "DEAL_HOLE_CARDS" } },
      {
        type: "validate",
        seats: {
          player2: { seatStatus: "active", currentBet: 5 },
          player3: { seatStatus: "all-in", currentBet: 10, buyIn: 0 },
        },
      },
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
        type: "validate",
        game: { state: "BETTING" },
        firstToActFor: "player1",
      },
      { type: "action", action: "CHECK", by: "player1" },
    ],
  },
  {
    name: "four players: SB and BB all-in, UTG is player4",
    steps: [
      {
        type: "join",
        players: [
          { key: "player1" },
          { key: "player2", buyIn: 5 },
          { key: "player3", buyIn: 10 },
          { key: "player4" },
        ],
      },
      { type: "action", action: "START_GAME", by: "dealer" },
      { type: "validate", game: { state: "DEAL_HOLE_CARDS" } },
      {
        type: "validate",
        seats: {
          player1: { seatStatus: "active", currentBet: 0 },
          player2: {
            seatStatus: "all-in",
            currentBet: 5,
            buyIn: 0,
          },
          player3: {
            seatStatus: "all-in",
            currentBet: 10,
            buyIn: 0,
          },
          player4: { seatStatus: "active", currentBet: 0 },
        },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "8", suit: "s" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "7", suit: "s" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "6", suit: "s" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "5", suit: "s" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "4", suit: "s" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "3", suit: "s" },
      },
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
        params: { rank: "A", suit: "h" },
      },
      {
        type: "validate",
        game: { state: "BETTING" },
        firstToActFor: "player4",
      },
      { type: "action", action: "CHECK", by: "player4" },
    ],
  },
  {
    name: "short big blind preflop: check becomes call to full BB",
    steps: [
      {
        type: "join",
        players: [
          { key: "player1" },
          { key: "player2" },
          { key: "player3", buyIn: 6 },
        ],
      },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "validate",
        seats: {
          player2: { seatStatus: "active", currentBet: 5 },
          player3: { seatStatus: "all-in", currentBet: 6, buyIn: 0 },
        },
      },
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
        type: "validate",
        game: { state: "BETTING" },
        firstToActFor: "player1",
      },
      { type: "action", action: "CHECK", by: "player1" },
      {
        type: "validate",
        seats: {
          player1: { currentBet: 10, buyIn: 290, lastAction: "CALL" },
        },
      },
      { type: "action", action: "CHECK", by: "player2" },
      {
        type: "validate",
        seats: {
          player2: { buyIn: 290, lastAction: "CALL" },
        },
      },
    ],
  },
  {
    name: "short big blind preflop: min raise is based on full BB floor",
    steps: [
      {
        type: "join",
        players: [
          { key: "player1" },
          { key: "player2" },
          { key: "player3", buyIn: 6 },
        ],
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
        type: "validate",
        game: { state: "BETTING" },
        firstToActFor: "player1",
      },
      {
        type: "action",
        action: "RAISE",
        by: "player1",
        params: { amount: 16 },
        isError: true,
      },
      {
        type: "action",
        action: "RAISE",
        by: "player1",
        params: { amount: 20 },
      },
      {
        type: "validate",
        seats: {
          player1: { currentBet: 20, buyIn: 280, lastAction: "RAISE" },
        },
      },
    ],
  },
];

export default scenarios;
