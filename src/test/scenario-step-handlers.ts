import { eq } from 'drizzle-orm';
import { expect } from 'vitest';
import { db } from '~/server/db';
import { games, pokerTables, seats } from '~/server/db/schema';

import type {
  ActionStep,
  DealHoleStep,
  JoinStep,
  PlayerKey,
  ValidateStep,
} from "~/test/scenario.types";

type CallerMap = Record<"dealer" | PlayerKey, any>;
type PlayerIdMap = Record<PlayerKey, string>;

export async function handleJoinStep(
  step: JoinStep,
  tableId: string,
  defaultBuyIn: number,
  publicKey: string,
  callers: CallerMap,
): Promise<void> {
  for (const p of step.players) {
    const playerBuyIn = p.buyIn ?? defaultBuyIn;
    await callers[p.key].table.join({
      tableId,
      buyIn: playerBuyIn,
      userPublicKey: publicKey,
    });
  }
}

export async function handleActionStep(
  step: ActionStep,
  tableId: string,
  callers: CallerMap,
): Promise<void> {
  if (step.isError) {
    await expect(
      callers[step.by].table.action({
        tableId,
        action: step.action,
        params: step.params as any,
      }),
    ).rejects.toThrow();
  } else {
    await callers[step.by].table.action({
      tableId,
      action: step.action,
      params: step.params as any,
    });
  }
}

export async function handleDealHoleStep(
  step: DealHoleStep,
  tableId: string,
  playerIds: PlayerIdMap,
  callers: CallerMap,
): Promise<void> {
  // Fetch table with game and seats
  const table = await db.query.pokerTables.findFirst({
    where: eq(pokerTables.id, tableId),
    with: {
      games: { orderBy: (g, { desc }) => [desc(g.createdAt)], limit: 1 },
      seats: { orderBy: (s, { asc }) => [asc(s.seatNumber)] },
    },
  });
  if (!table) throw new Error("Table not found");

  // Build player ID to key mapping
  const idMap = playerIds as Record<PlayerKey, string>;
  const userIdToKey: Record<string, PlayerKey> = Object.fromEntries(
    (Object.keys(idMap) as PlayerKey[]).map((k) => [idMap[k], k]),
  ) as Record<string, PlayerKey>;

  console.log("Seat assignments:");
  table.seats.forEach((s) => {
    console.log(
      `  Seat ${s.seatNumber}: ${userIdToKey[s.playerId]} (${s.playerId})`,
    );
  });

  // Get the game to find dealer button and determine dealing order
  const game = table.games[0];
  if (!game) throw new Error("No game found");

  // Find the dealer button seat
  const dealerButtonSeat = table.seats.find(
    (s) => s.id === game.dealerButtonSeatId,
  );
  if (!dealerButtonSeat) throw new Error("Dealer button seat not found");

  // Deal starting from small blind (next seat after dealer button)
  // Rotate through seats in order: small blind -> big blind -> ... -> dealer button
  const dealerSeatNumber = dealerButtonSeat.seatNumber;
  const orderedSeatsForDealing = [
    ...table.seats.filter((s) => s.seatNumber > dealerSeatNumber),
    ...table.seats.filter((s) => s.seatNumber <= dealerSeatNumber),
  ];

  const seatOrderKeys: PlayerKey[] = orderedSeatsForDealing.map((s) => {
    const key = userIdToKey[s.playerId];
    if (!key) throw new Error("Seat has unknown player id");
    return key;
  });

  // Deal in proper rotation: first a round of one card to each seat, then second round
  console.log(
    `Dealer button at seat ${dealerSeatNumber} (${userIdToKey[dealerButtonSeat.playerId]})`,
  );
  console.log("Seat order for dealing:", seatOrderKeys);
  for (let round = 0; round < 2; round++) {
    console.log(`Dealing round ${round + 1}:`);
    for (const key of seatOrderKeys) {
      // Skip players who don't have cards (e.g., eliminated players)
      if (!step.hole[key]) continue;

      const pair = step.hole[key] as [string, string];
      const card = pair[round]!;
      console.log(`  Dealing ${card} to ${key}`);
      await callers.dealer.table.action({
        tableId,
        action: "DEAL_CARD",
        params: { rank: card[0] as any, suit: card[1] as any },
      });
    }
  }

  // Verify final card assignment
  const finalSeats = await db.query.seats.findMany({
    where: eq(seats.tableId, tableId),
    orderBy: (s, { asc }) => [asc(s.seatNumber)],
  });
  console.log("Final card assignments:");
  finalSeats.forEach((s) => {
    console.log(`  ${userIdToKey[s.playerId]}: ${s.cards.join(", ")}`);
  });
}

export async function handleValidateStep(
  step: ValidateStep,
  tableId: string,
  playerIds: PlayerIdMap,
): Promise<void> {
  // Validate game state
  if (step.game) {
    const game = await db.query.games.findFirst({
      where: eq(games.tableId, tableId),
      orderBy: (g, { desc }) => [desc(g.createdAt)],
    });
    expect(game).toBeTruthy();
    for (const [k, v] of Object.entries(step.game)) {
      const actual = (game as any)?.[k];
      if (JSON.stringify(actual) !== JSON.stringify(v)) {
        console.error("Game validation mismatch", {
          key: k,
          expected: v,
          actual,
          game,
        });
      }
      expect(actual).toStrictEqual(v);
    }
  }

  // Validate dealer button position
  if (step.dealerButtonFor) {
    const snapshot = await db.query.pokerTables.findFirst({
      where: eq(pokerTables.id, tableId),
      with: {
        games: { orderBy: (g, { desc }) => [desc(g.createdAt)], limit: 1 },
        seats: { orderBy: (s, { asc }) => [asc(s.seatNumber)] },
      },
    });
    expect(snapshot).toBeTruthy();
    const game = snapshot!.games[0] ?? null;
    expect(game).toBeTruthy();
    const idMap = playerIds as Record<PlayerKey, string>;
    const targetPlayerId = idMap[step.dealerButtonFor];
    const targetSeat = snapshot!.seats.find(
      (s) => s.playerId === targetPlayerId,
    );
    expect(targetSeat).toBeTruthy();
    expect(game!.dealerButtonSeatId).toStrictEqual(targetSeat!.id);
  }

  // Validate table state
  if (step.table) {
    const table = await db.query.pokerTables.findFirst({
      where: eq(pokerTables.id, tableId),
    });
    expect(table).toBeTruthy();
    for (const [k, v] of Object.entries(step.table)) {
      const actual = (table as any)?.[k];
      if (JSON.stringify(actual) !== JSON.stringify(v)) {
        console.error("Table validation mismatch", {
          key: k,
          expected: v,
          actual,
          table,
        });
      }
      expect(actual).toStrictEqual(v);
    }
  }

  // Validate seat states
  if (step.seats) {
    const all = await db.query.seats.findMany({
      where: eq(seats.tableId, tableId),
    });
    const mapByPlayer: Record<string, (typeof all)[number]> = {};
    for (const s of all) mapByPlayer[s.playerId] = s;

    const idMap = playerIds;
    for (const key of Object.keys(step.seats) as PlayerKey[]) {
      const subset = (step.seats as any)[key];
      if (!subset) continue;
      const seat = mapByPlayer[idMap[key]];
      if (!seat) throw new Error(`Seat missing for ${key}`);
      for (const [k, v] of Object.entries(subset)) {
        const actual = (seat as any)?.[k];
        if (JSON.stringify(actual) !== JSON.stringify(v)) {
          console.error("Seat validation mismatch", {
            playerKey: key,
            seatId: seat.id,
            key: k,
            expected: v,
            actual,
            seat,
          });
        }
        expect(actual).toStrictEqual(v);
      }
    }
  }
}
