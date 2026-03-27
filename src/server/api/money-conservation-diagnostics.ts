import type { gameEvents, games, seats } from "~/server/db/schema";

type SeatRow = typeof seats.$inferSelect;
type GameRow = typeof games.$inferSelect;
type GameEventRow = typeof gameEvents.$inferSelect;

/** Mirrors `SidePotDetail` in hand-solver (avoid circular imports). */
export type SidePotDiagnostics = {
  potNumber: number;
  amount: number;
  betLevelRange: { min: number; max: number };
  contributors: Array<{ seatId: string; contribution: number }>;
  eligibleSeatIds: string[];
  winners: Array<{ seatId: string; amount: number }>;
};

/** Mirrors `EvaluatedHand` in hand-solver for logging only. */
export type EvaluatedHandDiagnostics = {
  seatId: string;
  hand: {
    name: string;
    descr: string;
    cards: string[];
    rank: number;
    score: number;
  };
  playerCards: string[];
};

export type MoneyConservationDiagnosticInput = {
  tableId: string;
  gameId: string;
  gameObj: GameRow;
  freshSeats: SeatRow[];
  contenders: SeatRow[];
  finalSeats: SeatRow[];
  allGameEvents: GameEventRow[];
  hands: EvaluatedHandDiagnostics[];
  sidePots: SidePotDiagnostics[];
  seatWinnings: Record<string, number>;
  /** Defaults to `new Date()` */
  generatedAt?: Date;
};

/** Prefix for CloudWatch filter patterns (single log line includes this). */
export const CONSERVATION_DIAGNOSTIC_LOG_PREFIX =
  "[conservation_diagnostic] full_report";

/** JSON.stringify for CloudWatch-safe logs (Dates → ISO, bigint → string). */
export function stringifyForLog(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, v) => {
      if (v instanceof Date) return v.toISOString();
      if (typeof v === "bigint") return v.toString();
      return v;
    },
    2,
  );
}

/**
 * Builds the full money-conservation failure diagnostic as one string.
 * Call `console.log(buildMoneyConservationDiagnosticReport(...))` once so
 * CloudWatch returns a single log event (easier to grep / copy).
 */
export function buildMoneyConservationDiagnosticReport(
  input: MoneyConservationDiagnosticInput,
): string {
  const {
    tableId,
    gameId,
    gameObj,
    freshSeats,
    contenders,
    finalSeats,
    allGameEvents,
    hands,
    sidePots,
    seatWinnings,
    generatedAt = new Date(),
  } = input;

  const lines: string[] = [];

  const push = (s: string) => {
    lines.push(s);
  };

  const totalStartingBalance = finalSeats.reduce(
    (sum, seat) => sum + seat.startingBalance,
    0,
  );
  const totalFinalBuyIn = finalSeats.reduce((sum, seat) => sum + seat.buyIn, 0);
  const totalWinnings = finalSeats.reduce(
    (sum, seat) => sum + (seat.winAmount || 0),
    0,
  );
  const totalBuyInBeforeWinnings = finalSeats.reduce(
    (sum, seat) => sum + (seat.buyIn - (seat.winAmount || 0)),
    0,
  );
  const totalBets = totalStartingBalance - totalBuyInBeforeWinnings;
  const sidePotTotal = sidePots.reduce((sum, pot) => sum + pot.amount, 0);
  const expectedPot = totalStartingBalance - totalBuyInBeforeWinnings;

  const sumFreshBuyIn = freshSeats.reduce((s, seat) => s + seat.buyIn, 0);
  const sumFreshStarting = freshSeats.reduce(
    (s, seat) => s + seat.startingBalance,
    0,
  );

  push(CONSERVATION_DIAGNOSTIC_LOG_PREFIX);
  push("\n" + "=".repeat(80));
  push("🚨 MONEY CONSERVATION ERROR DETECTED - FULL DIAGNOSTIC REPORT");
  push("=".repeat(80));
  push(
    "[conservation_diagnostic] snapshot " +
      stringifyForLog({
        at: generatedAt.toISOString(),
        tableId,
        gameId,
        game: {
          state: gameObj.state,
          potTotal: gameObj.potTotal,
          communityCards: gameObj.communityCards,
          betCount: gameObj.betCount,
          requiredBetCount: gameObj.requiredBetCount,
          dealerButtonSeatId: gameObj.dealerButtonSeatId,
          assignedSeatId: gameObj.assignedSeatId,
          effectiveSmallBlind: gameObj.effectiveSmallBlind,
          effectiveBigBlind: gameObj.effectiveBigBlind,
          lastRaiseIncrement: gameObj.lastRaiseIncrement,
          wasReset: gameObj.wasReset,
        },
        totals: {
          totalStartingBalance,
          totalFinalBuyIn,
          difference: totalFinalBuyIn - totalStartingBalance,
          totalWinnings,
          totalBuyInBeforeWinnings,
          totalBets,
          sidePotTotal,
          expectedPotFromStacks: expectedPot,
          gamePotTotal: gameObj.potTotal,
          sidePotMinusGamePot: sidePotTotal - gameObj.potTotal,
        },
        freshSeatsAggregate: {
          count: freshSeats.length,
          sumBuyIn: sumFreshBuyIn,
          sumStartingBalance: sumFreshStarting,
          contenderSeatIds: contenders.map((c) => c.id),
        },
      }),
  );

  push("\n=== Game Information ===");
  push(`Game ID: ${gameId}`);
  push(`Game potTotal: ${gameObj.potTotal}`);
  push(`Game state: ${gameObj.state}`);
  push(
    "[conservation_diagnostic] gameRow (subset) " +
      stringifyForLog({
        id: gameObj.id,
        tableId: gameObj.tableId,
        state: gameObj.state,
        potTotal: gameObj.potTotal,
        communityCards: gameObj.communityCards,
        betCount: gameObj.betCount,
        requiredBetCount: gameObj.requiredBetCount,
        dealerButtonSeatId: gameObj.dealerButtonSeatId,
        assignedSeatId: gameObj.assignedSeatId,
        effectiveSmallBlind: gameObj.effectiveSmallBlind,
        effectiveBigBlind: gameObj.effectiveBigBlind,
        lastRaiseIncrement: gameObj.lastRaiseIncrement,
        wasReset: gameObj.wasReset,
        isCompleted: gameObj.isCompleted,
        createdAt: gameObj.createdAt,
        updatedAt: gameObj.updatedAt,
      }),
  );

  push("\n=== Game Events (Chronological) ===");
  push(`Total events: ${allGameEvents.length}`);
  allGameEvents.forEach((event, idx) => {
    push(
      `[${idx + 1}] [conservation_diagnostic] game_event ` +
        stringifyForLog({
          index: idx + 1,
          id: event.id,
          type: event.type,
          createdAt: event.createdAt,
          details: event.details,
        }),
    );
  });

  push("\n=== Seat States BEFORE Winnings Distribution ===");
  push(
    "[conservation_diagnostic] freshSeats " +
      stringifyForLog(
        freshSeats.map((seat) => ({
          id: seat.id,
          buyIn: seat.buyIn,
          startingBalance: seat.startingBalance,
          seatStatus: seat.seatStatus,
          currentBet: seat.currentBet,
          cards: seat.cards,
          winAmount: seat.winAmount,
        })),
      ),
  );

  push("\n=== Hand Evaluations ===");
  hands.forEach((hand) => {
    push(
      `[conservation_diagnostic] hand seatId=${hand.seatId} ` +
        stringifyForLog({
          seatId: hand.seatId,
          cards: hand.playerCards,
          handType: hand.hand.name,
          description: hand.hand.descr,
          winningCards: hand.hand.cards,
          score: hand.hand.score,
          rank: hand.hand.rank,
        }),
    );
  });

  push("\n=== Side Pot Calculation ===");
  push(
    "[conservation_diagnostic] sidePots (recalculated) " +
      stringifyForLog(sidePots),
  );
  push(`Side pot total: ${sidePotTotal}`);
  push(`Expected pot (startingBalance - buyIn before): ${expectedPot}`);
  push(`Difference: ${sidePotTotal - expectedPot}`);
  if (sidePotTotal !== expectedPot && expectedPot > 0) {
    push(
      `⚠️  WARNING: Recalculated side pots (${sidePotTotal}) != Expected pot (${expectedPot})`,
    );
  }

  push("\n=== Side Pot Distribution ===");
  sidePots.forEach((pot) => {
    push(
      `Pot ${pot.potNumber} (${pot.amount}) [conservation_diagnostic] ` +
        stringifyForLog({
          potNumber: pot.potNumber,
          amount: pot.amount,
          betLevelRange: pot.betLevelRange,
          contributors: pot.contributors,
          eligibleSeatIds: pot.eligibleSeatIds,
          winners: pot.winners,
        }),
    );
  });

  push("\n=== Winnings Distribution ===");
  push(
    "[conservation_diagnostic] seatWinnings " +
      stringifyForLog(seatWinnings),
  );
  push(`Total winnings: ${totalWinnings}`);

  push("\n=== Seat States AFTER Winnings Distribution ===");
  finalSeats.forEach((seat) => {
    const diff = seat.buyIn - seat.startingBalance;
    const buyInBeforeWinnings = seat.buyIn - (seat.winAmount || 0);
    const expectedDiff =
      (seat.winAmount || 0) -
      (seat.startingBalance - buyInBeforeWinnings);
    const row = {
      seatId: seat.id,
      startingBalance: seat.startingBalance,
      finalBuyIn: seat.buyIn,
      diff,
      seatStatus: seat.seatStatus,
      winAmount: seat.winAmount ?? 0,
      buyInBeforeWinnings,
      expectedDiff,
      currentBet: seat.currentBet,
    };
    push(`[conservation_diagnostic] finalSeat ${stringifyForLog(row)}`);
    if (diff !== expectedDiff) {
      push(
        `    ⚠️  WARNING: Expected diff ${expectedDiff} but got ${diff}`,
      );
    }
  });

  push("\n=== Money Conservation Summary ===");
  push(
    "[conservation_diagnostic] summary " +
      stringifyForLog({
        totalStartingBalance,
        totalFinalBuyIn,
        difference: totalFinalBuyIn - totalStartingBalance,
        totalWinnings,
        totalBets,
        totalBuyInBeforeWinnings,
        moneyFlowStartingEqualsBuyInBeforePlusBets:
          totalStartingBalance === totalBuyInBeforeWinnings + totalBets,
        moneyFlowBuyInBeforePlusWinningsEqualsFinal:
          totalBuyInBeforeWinnings + totalWinnings === totalFinalBuyIn,
        betsVsWinningsDiff: totalWinnings - totalBets,
      }),
  );
  push(`  Total starting balance: ${totalStartingBalance}`);
  push(`  Total final buyIn: ${totalFinalBuyIn}`);
  push(`  Difference: ${totalFinalBuyIn - totalStartingBalance}`);
  push(`  Total winnings distributed: ${totalWinnings}`);
  push(`  Total bets (startingBalance - buyIn_before): ${totalBets}`);
  push(
    `  Money flow check: startingBalance (${totalStartingBalance}) = buyIn_before (${totalBuyInBeforeWinnings}) + bets (${totalBets})`,
  );
  push(
    `  Money flow check: buyIn_before (${totalBuyInBeforeWinnings}) + winnings (${totalWinnings}) = finalBuyIn (${totalFinalBuyIn})`,
  );
  if (totalBets !== totalWinnings) {
    push(
      `  ⚠️  WARNING: Total bets (${totalBets}) != Total winnings (${totalWinnings}). Difference: ${totalWinnings - totalBets}`,
    );
  }

  push("\n" + "=".repeat(80));

  return lines.join("\n");
}

/** Single `console.log` of the full report (for CloudWatch one-event retrieval). */
export function logMoneyConservationDiagnosticReport(
  input: MoneyConservationDiagnosticInput,
): void {
  console.log(buildMoneyConservationDiagnosticReport(input));
}
