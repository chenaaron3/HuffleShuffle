const { Hand: PokerHand } = require("pokersolver");

import type { games, seats } from "~/server/db/schema";

type SeatRow = typeof seats.$inferSelect;
type GameRow = typeof games.$inferSelect;

/**
 * Bot decision result
 */
export type BotDecision =
  | { action: "FOLD" }
  | { action: "CHECK" }
  | { action: "RAISE"; amount: number };

/**
 * Game state snapshot for bot decision making
 */
export type BotGameState = {
  // Bot's information
  botSeat: SeatRow;
  botHoleCards: string[];

  // Game state
  communityCards: string[];
  potTotal: number;
  effectiveSmallBlind: number;
  effectiveBigBlind: number;

  // All seats (for context)
  orderedSeats: SeatRow[];
  dealerButtonSeatId: string | null;

  // Current betting round info
  maxBet: number;
  botCurrentBet: number;
  botStack: number;
};

/**
 * Convert card from our format (e.g., "AS", "10H") to pokersolver format (e.g., "As", "Th")
 * Our format: Rank + Suit (uppercase), e.g., "AS", "KH", "10S", "2D"
 * pokersolver format: Rank + Suit (lowercase), e.g., "As", "Kh", "Ts", "2d"
 */
function convertCardToPokerSolverFormat(card: string): string {
  if (card.length === 2) {
    // Single digit rank (2-9, A, K, Q, J)
    const rank = card[0] ?? "";
    const suit = (card[1] ?? "").toLowerCase();
    return rank + suit;
  } else if (card.length === 3) {
    // "10" rank - pokersolver uses 'T' for ten
    const rank = "T";
    const suit = (card[2] ?? "").toLowerCase();
    return rank + suit;
  }
  return card;
}

/**
 * Convert array of cards to pokersolver format
 */
function convertCardsToPokerSolverFormat(cards: string[]): string[] {
  return cards.map(convertCardToPokerSolverFormat);
}

/**
 * Generate all possible card combinations for Monte Carlo simulation
 * Excludes cards that are already known (hole cards + community cards)
 * Returns cards in our format (e.g., "AS", "KH", "10S")
 */
function generateDeck(excludeCards: string[]): string[] {
  const ranks = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
  ];
  const suits = ["S", "H", "C", "D"];
  const deck: string[] = [];

  for (const rank of ranks) {
    for (const suit of suits) {
      const card = rank + suit; // Our format: "AS", "10S", etc.
      if (!excludeCards.includes(card)) {
        deck.push(card);
      }
    }
  }

  return deck;
}

/**
 * Get random cards from deck (for opponent simulation)
 */
function getRandomCards(deck: string[], count: number): string[] {
  const shuffled = [...deck].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Calculate hand equity using pokersolver with Monte Carlo simulation
 * Uses pokersolver (413+ GitHub stars) for hand evaluation
 * Runs Monte Carlo simulation by randomly assigning opponent hands
 */
export function calculateHandEquity(
  holeCards: string[],
  communityCards: string[],
  numOpponents: number = 1,
  iterations: number = 100, // Number of Monte Carlo iterations
): { winPercentage: number; tiePercentage: number } {
  if (holeCards.length < 2) {
    return { winPercentage: 0, tiePercentage: 0 };
  }

  if (numOpponents === 0) {
    // No opponents means 100% win (edge case)
    return { winPercentage: 100, tiePercentage: 0 };
  }

  try {
    // Build deck of available cards (exclude known cards)
    const knownCards = [...holeCards, ...communityCards];
    const deck = generateDeck(knownCards);

    // Need at least 2 * numOpponents cards in deck
    if (deck.length < numOpponents * 2) {
      console.warn("Bot equity: Not enough cards in deck for simulation");
      return { winPercentage: 10, tiePercentage: 0 };
    }

    let wins = 0;
    let ties = 0;
    let successfulIterations = 0;

    // Run Monte Carlo simulation
    for (let i = 0; i < iterations; i++) {
      try {
        // Generate random hands for opponents
        const availableCards = [...deck];
        const opponentHands: string[][] = [];

        for (let j = 0; j < numOpponents; j++) {
          if (availableCards.length < 2) break;

          const opponentCards = getRandomCards(availableCards, 2);
          opponentHands.push(opponentCards);

          // Remove used cards from available pool
          opponentCards.forEach((card) => {
            const index = availableCards.indexOf(card);
            if (index > -1) availableCards.splice(index, 1);
          });
        }

        // Need at least one opponent
        if (opponentHands.length === 0) continue;

        // Build all hands (bot + opponents) with community cards
        const allHands: any[] = [];
        const botCards = convertCardsToPokerSolverFormat([
          ...holeCards,
          ...communityCards,
        ]);
        const botHand = PokerHand.solve(botCards);
        allHands.push(botHand);

        // Evaluate opponent hands
        for (const opponentCards of opponentHands) {
          const oppCards = convertCardsToPokerSolverFormat([
            ...opponentCards,
            ...communityCards,
          ]);
          const oppHand = PokerHand.solve(oppCards);
          allHands.push(oppHand);
        }

        // Find winners using pokersolver
        const winners = PokerHand.winners(allHands);

        // Check if bot won or tied
        const botWon = winners.some((w: any) => w === botHand);
        const botTied = winners.length > 1 && botWon;

        if (botWon && botTied) {
          ties++;
        } else if (botWon) {
          wins++;
        }

        successfulIterations++;
      } catch (iterError) {
        // Skip this iteration if it fails
        continue;
      }
    }

    // Calculate percentages
    if (successfulIterations === 0) {
      console.warn("Bot equity: No successful iterations");
      return { winPercentage: 10, tiePercentage: 0 };
    }

    return {
      winPercentage: (wins / successfulIterations) * 100,
      tiePercentage: (ties / successfulIterations) * 100,
    };
  } catch (error) {
    console.error("Error calculating hand equity:", error);
    return { winPercentage: 10, tiePercentage: 0 };
  }
}

/**
 * Calculate pot odds
 * Returns the pot odds as a percentage (0-100)
 * Pot odds = (amount to call) / (pot size + amount to call) * 100
 *
 * Special case: If pot is 0 (pre-flop blinds), use a more reasonable calculation
 * based on effective pot size (blinds + bets)
 */
export function calculatePotOdds(
  potSize: number,
  amountToCall: number,
): number {
  if (amountToCall <= 0) return 0;
  if (potSize + amountToCall === 0) return 0;

  // If pot is 0 or very small (pre-flop scenario), adjust calculation
  // to avoid artificially high pot odds
  const effectivePot = potSize > 0 ? potSize : amountToCall * 2; // Assume at least 2x the bet in effective pot

  return (amountToCall / (effectivePot + amountToCall)) * 100;
}

/**
 * Calculate effective equity (win % + tie % / 2)
 * This gives a single number representing expected value
 */
function calculateEffectiveEquity(
  winPercentage: number,
  tiePercentage: number,
): number {
  return winPercentage + tiePercentage / 2;
}

/**
 * Determine position relative to dealer button
 * Returns: 'early' | 'middle' | 'late' | 'blinds'
 */
function calculatePosition(
  botSeatId: string,
  orderedSeats: SeatRow[],
  dealerButtonSeatId: string | null,
): "early" | "middle" | "late" | "blinds" {
  if (!dealerButtonSeatId) return "middle";

  const botIndex = orderedSeats.findIndex((s) => s.id === botSeatId);
  const dealerIndex = orderedSeats.findIndex(
    (s) => s.id === dealerButtonSeatId,
  );

  if (botIndex === -1 || dealerIndex === -1) return "middle";

  // Calculate positions relative to dealer
  const totalSeats = orderedSeats.length;
  const positionsAfterDealer =
    (botIndex - dealerIndex + totalSeats) % totalSeats;

  // Small blind is next after dealer, big blind is after small blind
  const smallBlindIndex = (dealerIndex + 1) % totalSeats;
  const bigBlindIndex = (dealerIndex + 2) % totalSeats;

  if (botIndex === smallBlindIndex || botIndex === bigBlindIndex) {
    return "blinds";
  }

  // Early: first 2 positions after big blind
  // Middle: next 2 positions
  // Late: button and cutoff (last 2 positions before small blind)
  if (positionsAfterDealer <= 2) {
    return "early";
  } else if (positionsAfterDealer <= 4) {
    return "middle";
  } else {
    return "late";
  }
}

/**
 * Count active opponents (non-folded, non-eliminated, not the bot)
 */
function countActiveOpponents(
  orderedSeats: SeatRow[],
  botSeatId: string,
): number {
  return orderedSeats.filter(
    (s) =>
      s.id !== botSeatId &&
      s.seatStatus !== "folded" &&
      s.seatStatus !== "eliminated",
  ).length;
}

/**
 * Calculate stack-to-pot ratio (SPR)
 */
function calculateSPR(stack: number, pot: number): number {
  if (pot === 0) return Infinity;
  return stack / pot;
}

/**
 * Determine if bot should fold based on equity vs pot odds
 * Uses a margin/buffer to account for implied odds and drawing potential
 */
function shouldFold(
  effectiveEquity: number,
  potOdds: number,
  amountToCall: number,
  potSize: number,
  position: "early" | "middle" | "late" | "blinds",
  minEquityThreshold: number = 2, // Minimum 2% equity to continue (very low threshold)
  equityMargin: number = 8, // Only fold if equity is significantly worse (8% margin)
): boolean {
  // If checking (no bet to call), never fold
  if (amountToCall <= 0) return false;

  // If equity is below absolute minimum threshold, fold
  if (effectiveEquity < minEquityThreshold) return true;

  // Special handling for pre-flop (pot is 0 or very small)
  // Pre-flop, we should be more lenient since pot odds calculation is less reliable
  const isPreFlop = potSize === 0 || potSize < amountToCall * 2;

  if (isPreFlop) {
    // Pre-flop: Only fold if equity is very low or pot odds are extremely high
    // With 15% equity pre-flop, we should generally call small bets
    if (effectiveEquity >= 10 && amountToCall <= 50) {
      // Decent equity and small bet - don't fold
      return false;
    }
    // For larger pre-flop bets, use stricter criteria
    if (effectiveEquity < 5) return true;
    // Otherwise, be more lenient - only fold if equity is really bad
    return effectiveEquity < potOdds - (equityMargin + 10); // Extra margin for pre-flop
  }

  // Adjust margin based on position - be more aggressive in late position
  let positionMargin = equityMargin;
  if (position === "late") {
    positionMargin = equityMargin + 5; // Even more margin in late position
  } else if (position === "middle") {
    positionMargin = equityMargin + 2; // Some margin in middle position
  }
  // Early position and blinds use base margin

  // Add margin for implied odds - only fold if equity is significantly worse than pot odds
  // This accounts for:
  // - Implied odds (future betting rounds)
  // - Drawing potential
  // - Bluffing opportunities
  // - Position advantage
  const adjustedPotOdds = potOdds - positionMargin;

  // Only fold if equity is significantly worse than pot odds
  return effectiveEquity < adjustedPotOdds;
}

/**
 * Determine if bot should raise
 */
function shouldRaise(
  effectiveEquity: number,
  potOdds: number,
  position: "early" | "middle" | "late" | "blinds",
  spr: number,
  minEquityForRaise: number = 55, // Need at least 55% equity to raise
): boolean {
  // Need strong equity to raise
  if (effectiveEquity < minEquityForRaise) return false;

  // More likely to raise in late position
  if (position === "late" && effectiveEquity >= 50) return true;
  if (position === "middle" && effectiveEquity >= 60) return true;
  if (position === "early" && effectiveEquity >= 65) return true;

  // If equity is much better than pot odds, consider raising
  if (effectiveEquity > potOdds + 20) return true;

  return false;
}

/**
 * Calculate raise amount
 * Uses pot-sized raise as default, adjusted by equity and stack size
 */
function calculateRaiseAmount(
  currentMaxBet: number,
  botStack: number,
  potSize: number,
  effectiveEquity: number,
  bigBlind: number,
): number {
  // Minimum raise is 2x the current max bet (or big blind if no bet)
  const minRaise = Math.max(currentMaxBet * 2, bigBlind * 2);

  // Pot-sized raise
  const potSizedRaise = currentMaxBet + potSize;

  // Adjust based on equity
  let raiseAmount: number;
  if (effectiveEquity >= 70) {
    // Very strong hand - larger raise
    raiseAmount = potSizedRaise * 1.5;
  } else if (effectiveEquity >= 60) {
    // Strong hand - pot-sized raise
    raiseAmount = potSizedRaise;
  } else {
    // Moderate hand - smaller raise
    raiseAmount = Math.max(potSizedRaise * 0.75, minRaise);
  }

  // Round to nearest big blind
  raiseAmount = Math.round(raiseAmount / bigBlind) * bigBlind;

  // Don't raise more than stack
  raiseAmount = Math.min(raiseAmount, currentMaxBet + botStack);

  // Must be at least minimum raise
  raiseAmount = Math.max(raiseAmount, minRaise);

  return raiseAmount;
}

/**
 * Main bot decision function - pure function that takes game state and returns decision
 */
export function makeBotDecision(gameState: BotGameState): BotDecision {
  const {
    botSeat,
    botHoleCards,
    communityCards,
    potTotal,
    effectiveBigBlind,
    orderedSeats,
    dealerButtonSeatId,
    maxBet,
    botCurrentBet,
    botStack,
  } = gameState;

  // Can't make decision without hole cards
  if (botHoleCards.length < 2) {
    return { action: "CHECK" };
  }

  // Count active opponents
  const numOpponents = countActiveOpponents(orderedSeats, botSeat.id);

  // If no opponents, just check (shouldn't happen in normal play, but handle gracefully)
  if (numOpponents === 0) {
    return { action: "CHECK" };
  }

  // Calculate hand equity
  const { winPercentage, tiePercentage } = calculateHandEquity(
    botHoleCards,
    communityCards,
    numOpponents,
  );

  const effectiveEquity = calculateEffectiveEquity(
    winPercentage,
    tiePercentage,
  );

  // If equity calculation failed (returned 0), be conservative but don't auto-fold
  // This can happen if the library has issues - in that case, use a default equity
  const finalEquity = effectiveEquity > 0 ? effectiveEquity : 15; // Default 15% if calculation fails

  // Calculate amount needed to call
  const amountToCall = maxBet - botCurrentBet;

  // Calculate pot odds
  const potOdds = calculatePotOdds(potTotal, amountToCall);

  // Calculate position
  const position = calculatePosition(
    botSeat.id,
    orderedSeats,
    dealerButtonSeatId,
  );

  // Calculate stack-to-pot ratio
  const spr = calculateSPR(botStack, potTotal);

  // Debug logging
  console.log("Bot decision:", {
    seat: botSeat.seatNumber,
    holeCards: botHoleCards,
    communityCards,
    winPercentage: winPercentage.toFixed(1),
    tiePercentage: tiePercentage.toFixed(1),
    effectiveEquity: effectiveEquity.toFixed(1),
    finalEquity: finalEquity.toFixed(1),
    potOdds: potOdds.toFixed(1),
    amountToCall,
    potTotal,
    position,
    numOpponents,
  });

  // Decision logic
  // 1. Check if we should fold (use finalEquity which has fallback)
  if (shouldFold(finalEquity, potOdds, amountToCall, potTotal, position)) {
    console.log("Bot folding: equity too low or pot odds too high", {
      finalEquity: finalEquity.toFixed(1),
      potOdds: potOdds.toFixed(1),
      potTotal,
      amountToCall,
      position,
    });
    return { action: "FOLD" };
  }

  // 2. Check if we should raise (use finalEquity)
  if (shouldRaise(finalEquity, potOdds, position, spr)) {
    const raiseAmount = calculateRaiseAmount(
      maxBet,
      botStack,
      potTotal,
      finalEquity,
      effectiveBigBlind,
    );

    // If we can't afford a meaningful raise, just call/check
    if (raiseAmount <= maxBet || raiseAmount - maxBet < effectiveBigBlind) {
      return { action: "CHECK" };
    }

    return { action: "RAISE", amount: raiseAmount };
  }

  // 3. Default to check/call
  return { action: "CHECK" };
}

/**
 * Helper function to create BotGameState from database rows
 * This is a pure function that extracts and structures the data
 */
export function createBotGameState(
  botSeat: SeatRow,
  game: GameRow,
  orderedSeats: SeatRow[],
): BotGameState {
  // Calculate max bet from all non-folded players
  const maxBet = Math.max(
    ...orderedSeats
      .filter((s) => s.seatStatus !== "folded" && s.seatStatus !== "eliminated")
      .map((s) => s.currentBet),
    0,
  );

  return {
    botSeat,
    botHoleCards: botSeat.cards as string[],
    communityCards: (game.communityCards as string[]) ?? [],
    potTotal: game.potTotal ?? 0,
    effectiveSmallBlind: game.effectiveSmallBlind ?? 0,
    effectiveBigBlind: game.effectiveBigBlind ?? 0,
    orderedSeats,
    dealerButtonSeatId: game.dealerButtonSeatId,
    maxBet,
    botCurrentBet: botSeat.currentBet ?? 0,
    botStack: botSeat.buyIn ?? 0,
  };
}
