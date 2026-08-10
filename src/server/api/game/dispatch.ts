import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { games, pokerTables, seats } from "~/server/db/schema";

import { executeBettingAction } from "~/server/api/game/betting-actions";
import { dealCard } from "~/server/api/game/dealing";
import {
  createNewGame,
  resetGame,
} from "~/server/api/game/hand-lifecycle";
import { getCurrentBetTarget } from "~/server/api/game/helpers/betting";

type Tx = {
  insert: typeof db.insert;
  query: typeof db.query;
  update: typeof db.update;
  delete: typeof db.delete;
  execute: typeof db.execute;
};

export type GameDispatchEvent =
  | { type: "RESET_TABLE" }
  | { type: "START_GAME" }
  | { type: "CARD_DEALT"; cardCode: string }
  | {
      type: "PLAYER_ACTION";
      action: "RAISE" | "CHECK" | "FOLD";
      amount?: number;
    }
  | { type: "VOLUNTEER_SHOW" }
  | { type: "TIMEOUT"; seatId: string };

/** Map public `table.action` input (except deal/SQS) to an internal game event. */
export function apiActionToDispatchEvent(input: {
  action:
    | "START_GAME"
    | "RESET_TABLE"
    | "RAISE"
    | "FOLD"
    | "CHECK"
    | "VOLUNTEER_SHOW"
    | "DEAL_CARD"
    | "DEAL_RANDOM";
  params?: { amount?: number };
}): GameDispatchEvent {
  switch (input.action) {
    case "RESET_TABLE":
      return { type: "RESET_TABLE" };
    case "START_GAME":
      return { type: "START_GAME" };
    case "VOLUNTEER_SHOW":
      return { type: "VOLUNTEER_SHOW" };
    case "RAISE":
    case "FOLD":
    case "CHECK":
      return {
        type: "PLAYER_ACTION",
        action: input.action,
        amount: input.params?.amount,
      };
    default:
      throw new Error(`Action must be mapped before dispatch: ${input.action}`);
  }
}

/**
 * Apply a game event inside an existing table-mutation transaction.
 * Callers own auth for SQS/deal plumbing; this owns game-rule checks + mutations.
 * Notify / bot follow-up stay in the router (or other adapter).
 */
export async function dispatchGameEvent(
  tx: Tx,
  tableId: string,
  event: GameDispatchEvent,
  opts: { actorUserId: string },
): Promise<void> {
  const { actorUserId } = opts;

  const snapshot = await tx.query.pokerTables.findFirst({
    where: eq(pokerTables.id, tableId),
    with: {
      games: { orderBy: (g, { desc }) => [desc(g.createdAt)], limit: 1 },
      seats: { orderBy: (s, { asc }) => [asc(s.seatNumber)] },
    },
  });
  if (!snapshot) throw new Error("Table not found");

  const orderedSeats = snapshot.seats;
  let game = snapshot.games[0] as typeof games.$inferSelect | undefined;
  const isDealerCaller = snapshot.dealerId === actorUserId;

  switch (event.type) {
    case "RESET_TABLE": {
      if (!isDealerCaller) throw new Error("Only dealer can RESET_TABLE");
      if (game && !game.isCompleted) {
        await resetGame(tx, game, orderedSeats, true, true);
      }
      return;
    }

    case "START_GAME": {
      if (!isDealerCaller) throw new Error("Only dealer can START_GAME");
      if (orderedSeats.length < 2)
        throw new Error("Need at least 2 players to start");
      await createNewGame(tx, snapshot, orderedSeats, game ?? null);
      return;
    }

    case "CARD_DEALT": {
      if (!isDealerCaller) throw new Error("Only dealer can DEAL_CARD");
      await dealCard(tx, tableId, game ?? null, event.cardCode);
      return;
    }

    case "VOLUNTEER_SHOW": {
      if (!game) throw new Error("No game");
      if (game.state !== "SHOWDOWN")
        throw new Error("VOLUNTEER_SHOW only allowed during showdown");
      const actorSeat = orderedSeats.find((s) => s.playerId === actorUserId);
      if (!actorSeat) throw new Error("You have no seat at this table");
      if (actorSeat.seatStatus === "eliminated")
        throw new Error("Cannot act - eliminated");
      await tx
        .update(seats)
        .set({ voluntaryShow: true })
        .where(eq(seats.id, actorSeat.id));
      return;
    }

    case "TIMEOUT": {
      if (!isDealerCaller)
        throw new Error("FORBIDDEN: not the dealer of this table");
      if (!game || game.isCompleted) throw new Error("No active game");
      if (game.state !== "BETTING")
        throw new Error("Timeout only allowed during betting");
      if (game.assignedSeatId !== event.seatId) {
        throw new Error("Seat ID does not match current player's turn");
      }
      const seat = orderedSeats.find((s) => s.id === event.seatId);
      if (!seat) throw new Error("Seat not found");
      if (seat.seatStatus !== "active") throw new Error("Seat is not active");

      const currentBetTarget = getCurrentBetTarget(game, orderedSeats);
      const timeoutAction: "CHECK" | "FOLD" =
        (seat.currentBet ?? 0) >= currentBetTarget ? "CHECK" : "FOLD";

      await executeBettingAction(tx, {
        actorSeatId: event.seatId,
        gameId: game.id,
        action: timeoutAction,
      });
      return;
    }

    case "PLAYER_ACTION": {
      if (!game || game.isCompleted) throw new Error("No active game");

      const actorSeat = orderedSeats.find((s) => s.playerId === actorUserId);
      if (!actorSeat) throw new Error("Actor has no seat at this table");
      if (actorSeat.seatStatus === "eliminated")
        throw new Error("Cannot act - player is eliminated");
      if (actorSeat.seatStatus !== "active")
        throw new Error("Seat cannot act (not active status)");

      if (game.state !== "BETTING")
        throw new Error("Player actions only allowed in BETTING");
      if (!game.assignedSeatId)
        throw new Error("No assigned seat for betting");
      if (game.assignedSeatId !== actorSeat.id) {
        const seat = orderedSeats.find((s) => s.id === game.assignedSeatId);
        if (seat) {
          console.log("Expected player id:", seat.playerId);
        } else {
          console.log("Expected seat id:", game.assignedSeatId);
        }
        throw new Error("Not your turn");
      }

      await executeBettingAction(tx, {
        actorSeatId: actorSeat.id,
        gameId: game.id,
        action: event.action,
        raiseAmount: event.amount,
      });
      return;
    }

    default: {
      const _exhaustive: never = event;
      throw new Error(`Unhandled game event: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
