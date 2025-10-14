import type { Scenario } from "~/test/scenario.types";

const scenarios: Scenario[] = [
  {
    name: "Side pot: Single all-in player with smaller stack",
    steps: [
      // Player 1: 50 chips, Player 2: 300 chips, Player 3: 300 chips
      {
        type: "join",
        players: [
          { key: "player1", buyIn: 50 },
          { key: "player2", buyIn: 300 },
          { key: "player3", buyIn: 300 },
        ],
      },
      { type: "action", action: "START_GAME", by: "dealer" },
      // Deal hole cards - Player 1 gets best hand (royal flush)
      {
        type: "deal_hole",
        hole: {
          player1: ["As", "Ks"], // Will make royal flush
          player2: ["2h", "3h"],
          player3: ["4d", "5d"],
        },
      },
      { type: "validate", game: { state: "BETTING" } },
      // Preflop betting
      { type: "action", action: "CHECK", by: "player1" }, // Calls BB (10), has 40 left
      {
        type: "action",
        action: "RAISE",
        by: "player2",
        params: { amount: 100 },
      },
      { type: "action", action: "CHECK", by: "player3" }, // Calls 100
      { type: "action", action: "CHECK", by: "player1" }, // Goes all-in for remaining 40 chips
      // Betting round ends - should create side pots
      { type: "validate", game: { state: "DEAL_FLOP" } },
      // Deal flop
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
      { type: "validate", game: { state: "BETTING" } },
      // Player 2 and 3 continue betting
      { type: "action", action: "CHECK", by: "player2" },
      { type: "action", action: "CHECK", by: "player3" },
      { type: "validate", game: { state: "DEAL_TURN" } },
      // Deal turn
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "6", suit: "c" },
      },
      { type: "validate", game: { state: "BETTING" } },
      { type: "action", action: "CHECK", by: "player2" },
      { type: "action", action: "CHECK", by: "player3" },
      { type: "validate", game: { state: "DEAL_RIVER" } },
      // Deal river
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "7", suit: "c" },
      },
      { type: "validate", game: { state: "BETTING" } },
      { type: "action", action: "CHECK", by: "player2" },
      { type: "action", action: "CHECK", by: "player3" },
      // Showdown - Player 1 should win main pot (150: 50 from each player)
      // Player 2 and Player 3 tie for side pot (100: each gets 50)
      { type: "validate", game: { state: "SHOWDOWN" } },
      {
        type: "validate",
        seats: {
          player1: { handType: "Royal Flush", winAmount: 150 },
          player2: { winAmount: 50 }, // Splits side pot with P3
          player3: { winAmount: 50 }, // Splits side pot with P2
        },
      },
    ],
  },
  {
    name: "Side pot: Multiple all-ins with different stack sizes",
    steps: [
      // Player 1: 50, Player 2: 150, Player 3: 300
      {
        type: "join",
        players: [
          { key: "player1", buyIn: 50 },
          { key: "player2", buyIn: 150 },
          { key: "player3", buyIn: 300 },
        ],
      },
      { type: "action", action: "START_GAME", by: "dealer" },
      // Deal cards - P3 has best hand
      {
        type: "deal_hole",
        hole: {
          player1: ["2h", "3h"],
          player2: ["4d", "5d"],
          player3: ["As", "Ah"], // Pair of aces
        },
      },
      { type: "validate", game: { state: "BETTING" } },
      // Preflop betting - everyone goes all-in
      {
        type: "action",
        action: "RAISE",
        by: "player1",
        params: { amount: 50 },
      }, // All-in
      {
        type: "action",
        action: "RAISE",
        by: "player2",
        params: { amount: 150 },
      }, // All-in
      {
        type: "action",
        action: "RAISE",
        by: "player3",
        params: { amount: 300 },
      }, // All-in
      // Should create multiple side pots:
      // Main pot: 150 (50 from each) - all 3 eligible
      // Side pot 1: 200 (100 from P2 and P3) - only P2 and P3 eligible
      // Side pot 2: 150 (150 from P3) - only P3 eligible
      { type: "validate", game: { state: "DEAL_FLOP" } },
      // Deal flop
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
      // No more betting (all players all-in)
      { type: "validate", game: { state: "DEAL_TURN" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "T", suit: "s" },
      },
      { type: "validate", game: { state: "DEAL_RIVER" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "9", suit: "s" },
      },
      // Showdown - Player 3 should win all pots with Royal Flush
      { type: "validate", game: { state: "SHOWDOWN" } },
      {
        type: "validate",
        seats: {
          player3: { handType: "Royal Flush", winAmount: 500 }, // Wins all 3 pots
        },
      },
    ],
  },
  {
    name: "Side pot: All-in player folds - no side pot created",
    steps: [
      {
        type: "join",
        players: [
          { key: "player1", buyIn: 50 },
          { key: "player2", buyIn: 300 },
          { key: "player3", buyIn: 300 },
        ],
      },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "deal_hole",
        hole: {
          player1: ["2h", "3h"],
          player2: ["As", "Ks"],
          player3: ["Ah", "Kh"],
        },
      },
      { type: "validate", game: { state: "BETTING" } },
      // Player 1 folds immediately
      { type: "action", action: "FOLD", by: "player1" },
      { type: "action", action: "CHECK", by: "player2" },
      { type: "action", action: "CHECK", by: "player3" },
      // No side pots should be created since P1 folded
      { type: "validate", game: { state: "DEAL_FLOP" } },
      // Continue with normal play
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
      { type: "action", action: "CHECK", by: "player2" },
      { type: "action", action: "CHECK", by: "player3" },
      { type: "validate", game: { state: "DEAL_TURN" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "T", suit: "d" },
      },
      { type: "validate", game: { state: "BETTING" } },
      { type: "action", action: "CHECK", by: "player2" },
      { type: "action", action: "CHECK", by: "player3" },
      { type: "validate", game: { state: "DEAL_RIVER" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "9", suit: "d" },
      },
      { type: "validate", game: { state: "BETTING" } },
      { type: "action", action: "CHECK", by: "player2" },
      { type: "action", action: "CHECK", by: "player3" },
      { type: "validate", game: { state: "SHOWDOWN" } },
      // One of P2 or P3 should win (both have same high card)
    ],
  },
  {
    name: "Side pot: Everyone goes all-in - no more betting rounds",
    steps: [
      {
        type: "join",
        players: [
          { key: "player1", buyIn: 100 },
          { key: "player2", buyIn: 100 },
          { key: "player3", buyIn: 100 },
        ],
      },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "deal_hole",
        hole: {
          player1: ["As", "Ks"],
          player2: ["Ad", "Kd"],
          player3: ["Ac", "Kc"],
        },
      },
      { type: "validate", game: { state: "BETTING" } },
      // Everyone goes all-in preflop
      {
        type: "action",
        action: "RAISE",
        by: "player1",
        params: { amount: 100 },
      }, // All-in (100 chips)
      { type: "action", action: "CHECK", by: "player2" }, // Calls 100, goes all-in
      { type: "action", action: "CHECK", by: "player3" }, // Calls 100, goes all-in
      // All players are all-in, should skip betting in future rounds
      { type: "validate", game: { state: "DEAL_FLOP" } },
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
        params: { rank: "3", suit: "s" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "4", suit: "s" },
      },
      // Should skip betting and go straight to turn
      { type: "validate", game: { state: "DEAL_TURN" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "5", suit: "s" },
      },
      { type: "validate", game: { state: "DEAL_RIVER" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "6", suit: "s" },
      },
      { type: "validate", game: { state: "SHOWDOWN" } },
      // All 3 players should split the pot (they all have same hand)
      {
        type: "validate",
        seats: {
          player1: { winAmount: 100 }, // Split 300 three ways
          player2: { winAmount: 100 },
          player3: { winAmount: 100 },
        },
      },
    ],
  },
  {
    name: "Side pot: Complex scenario with 4 players and multiple side pots",
    steps: [
      {
        type: "join",
        players: [
          { key: "player1", buyIn: 50 }, // Smallest stack
          { key: "player2", buyIn: 100 }, // Medium-small stack
          { key: "player3", buyIn: 200 }, // Medium-large stack
          { key: "player4", buyIn: 300 }, // Largest stack
        ],
      },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "deal_hole",
        hole: {
          player1: ["2h", "3h"], // Weakest hand
          player2: ["7d", "8d"], // Medium hand
          player3: ["Jc", "Qc"], // Better hand
          player4: ["As", "Ks"], // Best hand
        },
      },
      { type: "validate", game: { state: "BETTING" } },
      // Preflop betting - everyone goes all-in
      // UTG is Player4, then Player1, Player2, Player3
      {
        type: "action",
        action: "RAISE",
        by: "player4",
        params: { amount: 50 },
      },
      { type: "action", action: "CHECK", by: "player1" }, // Calls 50, goes all-in
      {
        type: "action",
        action: "RAISE",
        by: "player2",
        params: { amount: 100 },
      }, // All-in
      {
        type: "action",
        action: "RAISE",
        by: "player3",
        params: { amount: 200 },
      }, // All-in
      {
        type: "action",
        action: "RAISE",
        by: "player4",
        params: { amount: 300 },
      }, // All-in
      // All players are now all-in, betting round completes
      // Should create:
      // Main pot: 200 (50 from each of 4 players)
      // Side pot 1: 150 (50 more from P2, P3, P4)
      // Side pot 2: 200 (100 more from P3, P4)
      // Side pot 3: 100 (100 more from P4)
      { type: "validate", game: { state: "DEAL_FLOP" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "K", suit: "h" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "A", suit: "h" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "5", suit: "c" },
      },
      { type: "validate", game: { state: "DEAL_TURN" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "9", suit: "d" },
      },
      { type: "validate", game: { state: "DEAL_RIVER" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "T", suit: "s" },
      },
      { type: "validate", game: { state: "SHOWDOWN" } },
      // Player 3 wins first 3 pots with Straight (550), Player 4 wins last pot (100)
      {
        type: "validate",
        seats: {
          player3: { handType: "Straight", winAmount: 550 }, // Wins main pot + side pot 1 + side pot 2
          player4: { handType: "Two Pair", winAmount: 100 }, // Only wins side pot 3 (only they're eligible)
        },
      },
    ],
  },
  {
    name: "Side pot: Winner of side pot but not main pot",
    steps: [
      {
        type: "join",
        players: [
          { key: "player1", buyIn: 80 },
          { key: "player2", buyIn: 300 },
          { key: "player3", buyIn: 300 },
        ],
      },
      { type: "action", action: "START_GAME", by: "dealer" },
      {
        type: "deal_hole",
        hole: {
          player1: ["Ah", "Ac"], // Best hand - pair of aces
          player2: ["Ks", "Kh"], // Second best - pair of kings
          player3: ["2d", "3d"], // Worst hand
        },
      },
      { type: "validate", game: { state: "BETTING" } },
      // Preflop betting
      {
        type: "action",
        action: "RAISE",
        by: "player1",
        params: { amount: 70 },
      }, // Raises to 70, has 10 left
      {
        type: "action",
        action: "RAISE",
        by: "player2",
        params: { amount: 150 },
      },
      { type: "action", action: "CHECK", by: "player3" }, // Calls 150
      { type: "action", action: "CHECK", by: "player1" }, // Goes all-in for remaining 10 (bet=80 total)
      // Main pot: 240 (80 from each) - P1, P2, P3 eligible
      // Side pot: 140 (70 from P2 and P3) - Only P2, P3 eligible
      { type: "validate", game: { state: "DEAL_FLOP" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "7", suit: "c" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "8", suit: "c" },
      },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "9", suit: "c" },
      },
      { type: "validate", game: { state: "BETTING" } },
      { type: "action", action: "CHECK", by: "player2" },
      { type: "action", action: "CHECK", by: "player3" },
      { type: "validate", game: { state: "DEAL_TURN" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "4", suit: "h" },
      },
      { type: "validate", game: { state: "BETTING" } },
      { type: "action", action: "CHECK", by: "player2" },
      { type: "action", action: "CHECK", by: "player3" },
      { type: "validate", game: { state: "DEAL_RIVER" } },
      {
        type: "action",
        action: "DEAL_CARD",
        by: "dealer",
        params: { rank: "5", suit: "h" },
      },
      { type: "validate", game: { state: "BETTING" } },
      { type: "action", action: "CHECK", by: "player2" },
      { type: "action", action: "CHECK", by: "player3" },
      { type: "validate", game: { state: "SHOWDOWN" } },
      // P1 wins main pot (240) with pair of aces
      // P2 wins side pot (140) with pair of kings
      {
        type: "validate",
        seats: {
          player1: { handType: "One Pair", winAmount: 240 },
          player2: { handType: "One Pair", winAmount: 140 },
          player3: { winAmount: 0 },
        },
      },
    ],
  },
];

export default scenarios;
