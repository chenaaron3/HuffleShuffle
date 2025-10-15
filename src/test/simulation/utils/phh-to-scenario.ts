/**
 * Convert PHH (Poker Hand History) format to test scenario format
 */

import type { Scenario, Step, PlayerKey } from "~/test/scenario.types";
import { parseAction, parseCard, parsePHH } from './phh-parser';

import type { PHHData } from "./phh-parser";

/**
 * Determine the dealer button position from blinds_or_straddles array
 * The dealer button is the position before the small blind
 */
export function getDealerButtonPlayer(blinds: number[]): number {
  // Find the small blind (first non-zero blind)
  const sbIndex = blinds.findIndex((blind) => blind > 0);
  if (sbIndex === -1) {
    // No blinds, default to last player
    return blinds.length;
  }

  // Dealer button is the position before small blind (circular)
  const buttonIndex = sbIndex === 0 ? blinds.length - 1 : sbIndex - 1;
  return buttonIndex + 1; // Convert to 1-indexed player number
}

/**
 * Derive dealer button from the first player action (UTG = Under The Gun)
 * UTG is first to act after the big blind, which is 3 positions after the button
 * Button -> SB -> BB -> UTG
 *
 * Special case: Heads-up (2 players)
 * Button is also SB and acts FIRST preflop
 */
export function getDealerButtonFromActions(
  actions: string[],
  numPlayers: number,
): number {
  // Find the first player action (not dealer action)
  for (const actionStr of actions) {
    const action = parseAction(actionStr);

    // Skip deal actions
    if (action.type === "deal_hole" || action.type === "deal_board") {
      continue;
    }

    // First player action
    if (action.player) {
      const firstToAct = action.player;

      // Heads-up special case: button acts first
      if (numPlayers === 2) {
        return firstToAct;
      }

      // Normal case: UTG acts first (3 positions after button)
      // Work backwards: UTG -> BB -> SB -> Button
      const utgIndex = firstToAct - 1; // Convert to 0-indexed
      const buttonIndex = (utgIndex - 3 + numPlayers) % numPlayers;
      return buttonIndex + 1; // Convert to 1-indexed
    }
  }

  // Default to last player if no actions found
  return numPlayers;
}

/**
 * Extract small blind and big blind values from blinds_or_straddles array
 */
export function getBlinds(blinds: number[] | undefined): {
  smallBlind: number;
  bigBlind: number;
} {
  if (!blinds) {
    // No blinds specified, use defaults
    return { smallBlind: 5, bigBlind: 10 };
  }

  // Find first two non-zero blinds (typically small blind and big blind)
  const nonZeroBlinds = blinds.filter((b) => b > 0);

  if (nonZeroBlinds.length === 0) {
    // No blinds specified, use defaults
    return { smallBlind: 5, bigBlind: 10 };
  }

  if (nonZeroBlinds.length === 1) {
    // Only one blind, assume it's the big blind
    return { smallBlind: nonZeroBlinds[0]! / 2, bigBlind: nonZeroBlinds[0]! };
  }

  // Standard case: first is SB, second is BB
  return { smallBlind: nonZeroBlinds[0]!, bigBlind: nonZeroBlinds[1]! };
}

/**
 * Convert PHH data to a test Scenario
 */
export function phhToScenario(phhContent: string, filename: string): Scenario {
  const phh = parsePHH(phhContent);

  // Only support No-Limit Texas Hold'em for now
  if (phh.variant !== "NT" && phh.variant !== "NL") {
    throw new Error(
      `Unsupported variant: ${phh.variant}. Only No-Limit Texas Hold'em (NT/NL) is supported.`,
    );
  }

  const numPlayers = phh.starting_stacks.length;
  if (numPlayers < 2 || numPlayers > 8) {
    throw new Error(`Invalid number of players: ${numPlayers}. Must be 2-8.`);
  }

  const steps: Step[] = [];

  // Step 1: Join players
  const players = [];
  for (let i = 0; i < numPlayers; i++) {
    const playerKey = `player${i + 1}` as PlayerKey;
    const buyIn = phh.starting_stacks[i]!;
    players.push({ key: playerKey, buyIn });
  }
  steps.push({ type: "join", players });

  // Step 2: Start game
  steps.push({ type: "action", action: "START_GAME", by: "dealer" });

  // Step 2.5: Validate dealer button is in correct position
  // Use blinds if available, otherwise derive from first action (UTG)
  const buttonPlayerNum = phh.blinds_or_straddles
    ? getDealerButtonPlayer(phh.blinds_or_straddles)
    : getDealerButtonFromActions(phh.actions, numPlayers);
  steps.push({
    type: "validate",
    dealerButtonFor: `player${buttonPlayerNum}` as PlayerKey,
  });

  // Step 3: Process actions
  const dealtHoleCards: Partial<Record<PlayerKey, [string, string]>> = {};
  let boardCards: string[] = [];

  for (const actionStr of phh.actions) {
    const action = parseAction(actionStr);

    switch (action.type) {
      case "deal_hole": {
        if (!action.player || !action.cards || action.cards.length !== 2) {
          throw new Error(`Invalid deal hole action: ${actionStr}`);
        }
        const playerKey = `player${action.player}` as PlayerKey;
        dealtHoleCards[playerKey] = [action.cards[0]!, action.cards[1]!];
        break;
      }

      case "deal_board": {
        if (!action.cards) {
          throw new Error(`Invalid deal board action: ${actionStr}`);
        }

        // Check if we've dealt all hole cards
        if (Object.keys(dealtHoleCards).length > 0) {
          // Add the deal_hole step before dealing board (make a copy)
          steps.push({ type: "deal_hole", hole: { ...dealtHoleCards } });
          // Clear for next hand
          Object.keys(dealtHoleCards).forEach(
            (k) => delete dealtHoleCards[k as PlayerKey],
          );
        }

        // Add board cards one by one
        for (const card of action.cards) {
          const { rank, suit } = parseCard(card);
          steps.push({
            type: "action",
            action: "DEAL_CARD",
            by: "dealer",
            params: { rank, suit },
          });
          boardCards.push(card);
        }
        break;
      }

      case "fold": {
        if (!action.player)
          throw new Error(`Invalid fold action: ${actionStr}`);

        // If we haven't dealt hole cards yet, do it now
        if (Object.keys(dealtHoleCards).length > 0) {
          steps.push({ type: "deal_hole", hole: { ...dealtHoleCards } });
          Object.keys(dealtHoleCards).forEach(
            (k) => delete dealtHoleCards[k as PlayerKey],
          );
        }

        const playerKey = `player${action.player}` as PlayerKey;
        steps.push({
          type: "action",
          action: "FOLD",
          by: playerKey,
        });
        break;
      }

      case "check": {
        if (!action.player)
          throw new Error(`Invalid check action: ${actionStr}`);

        // If we haven't dealt hole cards yet, do it now
        if (Object.keys(dealtHoleCards).length > 0) {
          steps.push({ type: "deal_hole", hole: { ...dealtHoleCards } });
          Object.keys(dealtHoleCards).forEach(
            (k) => delete dealtHoleCards[k as PlayerKey],
          );
        }

        const playerKey = `player${action.player}` as PlayerKey;
        steps.push({
          type: "action",
          action: "CHECK",
          by: playerKey,
        });
        break;
      }

      case "raise": {
        if (!action.player || action.amount === undefined) {
          throw new Error(`Invalid raise action: ${actionStr}`);
        }

        // If we haven't dealt hole cards yet, do it now
        if (Object.keys(dealtHoleCards).length > 0) {
          steps.push({ type: "deal_hole", hole: { ...dealtHoleCards } });
          Object.keys(dealtHoleCards).forEach(
            (k) => delete dealtHoleCards[k as PlayerKey],
          );
        }

        const playerKey = `player${action.player}` as PlayerKey;
        steps.push({
          type: "action",
          action: "RAISE",
          by: playerKey,
          params: { amount: action.amount },
        });
        break;
      }

      case "showdown": {
        // Showdown is implicit in the test harness - skip for now
        // The hand will automatically go to showdown after river
        break;
      }

      default:
        console.warn(`Unhandled action type: ${action}`);
    }
  }

  // Step 4: Validate game reaches showdown
  steps.push({ type: "validate", game: { state: "SHOWDOWN" } });

  // Step 5: Validate finishing stacks
  // Note: PHH finishing stacks already account for antes not being collected
  // (the original game also didn't collect them), so we use them as-is
  const finishingStackValidation: Partial<
    Record<PlayerKey, { buyIn: number }>
  > = {};

  for (let i = 0; i < numPlayers; i++) {
    const playerKey = `player${i + 1}` as PlayerKey;
    const expectedStack = phh.finishing_stacks[i];

    if (expectedStack !== undefined) {
      finishingStackValidation[playerKey] = { buyIn: expectedStack };
    }
  }

  steps.push({ type: "validate", seats: finishingStackValidation });

  // Create scenario name from metadata
  let name = filename.replace(/\.phh$/, "");
  if (phh.event) {
    name = phh.event;
    if (phh.hand) name += ` - Hand ${phh.hand}`;
  }

  // Determine dealer button and blind values
  // Use blinds if available, otherwise derive from first action (UTG)
  const dealerButtonPlayer = phh.blinds_or_straddles
    ? getDealerButtonPlayer(phh.blinds_or_straddles)
    : getDealerButtonFromActions(phh.actions, numPlayers);
  const { smallBlind, bigBlind } = getBlinds(phh.blinds_or_straddles);

  return {
    name,
    steps,
    metadata: {
      dealerButtonPlayer: `player${dealerButtonPlayer}` as PlayerKey,
      smallBlind,
      bigBlind,
    },
  };
}

/**
 * Validate that a PHH hand can be converted correctly
 */
export function validatePHH(phhContent: string): string[] {
  const errors: string[] = [];

  try {
    const phh = parsePHH(phhContent);

    // Check variant
    if (phh.variant !== "NT" && phh.variant !== "NL") {
      errors.push(`Unsupported variant: ${phh.variant}`);
    }

    // Check player count
    const numPlayers = phh.starting_stacks.length;
    if (numPlayers < 2 || numPlayers > 8) {
      errors.push(`Invalid number of players: ${numPlayers}`);
    }

    // Check array lengths match
    if (phh.antes.length !== numPlayers) {
      errors.push(
        `Antes array length (${phh.antes.length}) doesn't match player count (${numPlayers})`,
      );
    }
    if (
      phh.blinds_or_straddles &&
      phh.blinds_or_straddles.length !== numPlayers
    ) {
      errors.push(
        `Blinds array length (${phh.blinds_or_straddles.length}) doesn't match player count (${numPlayers})`,
      );
    }
    if (phh.finishing_stacks.length !== numPlayers) {
      errors.push(
        `Finishing stacks array length (${phh.finishing_stacks.length}) doesn't match player count (${numPlayers})`,
      );
    }

    // Track dealt cards to check for duplicates
    const dealtCards = new Set<string>();

    // Validate actions
    for (let i = 0; i < phh.actions.length; i++) {
      const actionStr = phh.actions[i]!;
      try {
        const action = parseAction(actionStr);

        // Validate player numbers
        if (
          action.player !== undefined &&
          (action.player < 1 || action.player > numPlayers)
        ) {
          errors.push(
            `Action ${i + 1}: Invalid player number p${action.player} (max is p${numPlayers})`,
          );
        }

        // Check for duplicate cards (but skip showdown actions - they're revealing, not dealing)
        if (action.cards && action.type !== "showdown") {
          for (const card of action.cards) {
            if (card.length >= 2) {
              const normalizedCard =
                card.toUpperCase()[0]! + card.toLowerCase()[1]!;
              if (dealtCards.has(normalizedCard)) {
                errors.push(`Action ${i + 1}: Duplicate card dealt: ${card}`);
              }
              dealtCards.add(normalizedCard);
            }

            // Validate card format
            try {
              parseCard(card);
            } catch (e) {
              errors.push(`Action ${i + 1}: ${(e as Error).message}`);
            }
          }
        }
      } catch (e) {
        errors.push(`Action ${i + 1}: ${(e as Error).message}`);
      }
    }

    // Validate stack conservation (chips don't disappear or appear)
    const startingTotal = phh.starting_stacks.reduce(
      (sum, stack) => sum + stack,
      0,
    );
    const finishingTotal = phh.finishing_stacks.reduce(
      (sum, stack) => sum + stack,
      0,
    );

    if (startingTotal !== finishingTotal) {
      errors.push(
        `Stack conservation violated: starting total (${startingTotal}) != finishing total (${finishingTotal})`,
      );
    }
  } catch (e) {
    errors.push(`Parse error: ${(e as Error).message}`);
  }

  return errors;
}
