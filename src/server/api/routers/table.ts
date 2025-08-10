import { and, asc, count, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { createRequire } from 'node:module';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '~/server/api/trpc';
import { db } from '~/server/db';
import { games, pokerTables, seats, users } from '~/server/db/schema';

const requireCjs = createRequire(import.meta.url);
const Hand: any = requireCjs("pokersolver").Hand;

const ensureDealerRole = (role: string | undefined) => {
  if (role !== "dealer") throw new Error("FORBIDDEN: dealer role required");
};

const ensurePlayerRole = (role: string | undefined) => {
  if (role !== "player") throw new Error("FORBIDDEN: player role required");
};

const summarizeTable = async (client: any, tableId: string) => {
  const table = await client.query.pokerTables.findFirst({
    where: eq(pokerTables.id, tableId),
  });
  const tableSeats = await client.query.seats.findMany({
    where: eq(seats.tableId, tableId),
    orderBy: (s: any, { asc }: any) => [asc(s.seatNumber)],
  });
  const game = await client.query.games.findFirst({
    where: eq(games.tableId, tableId),
    orderBy: (g: any, { desc }: any) => [desc(g.createdAt)],
  });
  return { table, seats: tableSeats, game };
};

const pickNextIndex = (currentIndex: number, total: number) =>
  (currentIndex + 1) % total;

const rotateToNextActiveSeatId = (
  orderedSeats: Array<typeof seats.$inferSelect>,
  currentSeatId: string,
) => {
  const n = orderedSeats.length;
  const mapIndex: Record<string, number> = {};
  orderedSeats.forEach((s, i) => {
    mapIndex[s.id] = i;
  });
  let idx = mapIndex[currentSeatId] ?? 0;
  for (let i = 0; i < n; i++) {
    idx = pickNextIndex(idx, n);
    if (orderedSeats[idx]!.isActive) return orderedSeats[idx]!.id;
  }
  return orderedSeats[idx]!.id;
};

export const tableRouter = createTRPCRouter({
  list: publicProcedure.query(async () => {
    const rows = await db.query.pokerTables.findMany({
      orderBy: (t, { asc }) => [asc(t.createdAt)],
    });
    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      smallBlind: t.smallBlind,
      bigBlind: t.bigBlind,
    }));
  }),
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        smallBlind: z.number().int().positive(),
        bigBlind: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      ensureDealerRole(ctx.session.user.role);
      const id: string = await db.transaction(async (tx) => {
        const existing = await tx.query.pokerTables.findFirst({
          where: eq(pokerTables.dealerId, userId),
        });
        if (existing) throw new Error("Dealer already has a table");
        const rows = await tx
          .insert(pokerTables)
          .values({
            name: input.name,
            dealerId: userId,
            smallBlind: input.smallBlind,
            bigBlind: input.bigBlind,
          })
          .returning({ id: pokerTables.id });
        const row = rows?.[0];
        if (!row) throw new Error("Failed to create table");
        return row.id as string;
      });
      return { tableId: id };
    }),

  join: protectedProcedure
    .input(
      z.object({ tableId: z.string(), buyIn: z.number().int().positive() }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      ensurePlayerRole(ctx.session.user.role);
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      if (!user) throw new Error("User not found");
      const result = await db.transaction(async (tx) => {
        const table = await tx.query.pokerTables.findFirst({
          where: eq(pokerTables.id, input.tableId),
        });
        if (!table) throw new Error("Table not found");

        const activeGame = await tx.query.games.findFirst({
          where: and(
            eq(games.tableId, input.tableId),
            eq(games.status, "active"),
          ),
        });
        if (activeGame) throw new Error("Cannot join: game already active");

        // Seat auto-assign: next index based on count
        const existingSeats = await tx.query.seats.findMany({
          where: eq(seats.tableId, input.tableId),
        });
        if (existingSeats.length >= 8) throw new Error("Table is full");

        if (user.balance < input.buyIn)
          throw new Error("Insufficient balance for buy-in");

        const seatNumber = existingSeats.length; // contiguous 0..n-1

        // Deduct balance and create seat
        await tx
          .update(users)
          .set({ balance: sql`${users.balance} - ${input.buyIn}` })
          .where(eq(users.id, userId));
        const seatRows = await tx
          .insert(seats)
          .values({
            tableId: input.tableId,
            playerId: userId,
            seatNumber,
            buyIn: input.buyIn,
            isActive: true,
          })
          .returning();
        const seat = seatRows?.[0];
        if (!seat) throw new Error("Failed to create seat");
        return { seat } as const;
      });
      return { tableId: input.tableId, seatId: result.seat.id };
    }),

  leave: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      ensurePlayerRole(ctx.session.user.role);
      const result = await db.transaction(async (tx) => {
        const seat = await tx.query.seats.findFirst({
          where: and(
            eq(seats.tableId, input.tableId),
            eq(seats.playerId, userId),
          ),
        });
        if (!seat) throw new Error("Seat not found");

        const active = await tx.query.games.findFirst({
          where: and(
            eq(games.tableId, input.tableId),
            eq(games.status, "active"),
          ),
        });
        if (
          active &&
          !["GAME_START", "RESET_TABLE", "SHOWDOWN"].includes(
            (active as any).state,
          )
        ) {
          throw new Error("Cannot leave during an active hand");
        }

        // Refund remaining buy-in back to wallet
        if (seat.buyIn > 0) {
          await tx
            .update(users)
            .set({ balance: sql`${users.balance} + ${seat.buyIn}` })
            .where(eq(users.id, userId));
        }

        // Remove seat and resequence seat numbers
        await tx.delete(seats).where(eq(seats.id, seat.id));
        const remainingSeats = await tx.query.seats.findMany({
          where: eq(seats.tableId, input.tableId),
          orderBy: (s, { asc }) => [asc(s.seatNumber)],
        });
        for (let i = 0; i < remainingSeats.length; i++) {
          const s = remainingSeats[i]!;
          if (s.seatNumber !== i) {
            await tx
              .update(seats)
              .set({ seatNumber: i })
              .where(eq(seats.id, s.id));
          }
        }

        return { ok: true } as const;
      });
      return result;
    }),

  action: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        action: z.enum([
          "START_GAME",
          "DEAL_CARD",
          "RESET_TABLE",
          "RAISE",
          "FOLD",
          "CHECK",
        ]),
        params: z
          .object({
            rank: z.string().optional(),
            suit: z.string().optional(),
            amount: z.number().int().positive().optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const result = await db.transaction(async (tx) => {
        const table = await tx.query.pokerTables.findFirst({
          where: eq(pokerTables.id, input.tableId),
        });
        if (!table) throw new Error("Table not found");

        const orderedSeats = await tx.query.seats.findMany({
          where: eq(seats.tableId, input.tableId),
          orderBy: (s, { asc }) => [asc(s.seatNumber)],
        });
        const n = orderedSeats.length;
        if (n < 2 && input.action === "START_GAME")
          throw new Error("Need at least 2 players to start");

        let game = await tx.query.games.findFirst({
          where: and(
            eq(games.tableId, input.tableId),
            eq(games.status, "active"),
          ),
        });

        const isDealerCaller = table.dealerId === userId;

        const findSeatById = (id: string) =>
          orderedSeats.find((s) => s.id === id)!;
        const findIndexBySeatId = (id: string) =>
          orderedSeats.findIndex((s) => s.id === id);

        const toCardCode = (rank?: string, suit?: string) => {
          if (!rank || !suit) throw new Error("rank and suit required");
          return `${rank}${suit}`;
        };

        const allCardCodes = () => {
          const codes = new Set<string>();
          orderedSeats.forEach((s) => s.cards.forEach((c) => codes.add(c)));
          game?.communityCards.forEach((c) => codes.add(c));
          return codes;
        };

        const mergeBetsIntoPot = async () => {
          const total = orderedSeats.reduce((sum, s) => sum + s.currentBet, 0);
          await tx
            .update(games)
            .set({
              potTotal: sql`${games.potTotal} + ${total}`,
              betCount: 0,
              requiredBetCount: 0,
            })
            .where(eq(games.id, game!.id));
          for (const s of orderedSeats) {
            await tx
              .update(seats)
              .set({ currentBet: 0 })
              .where(eq(seats.id, s.id));
            s.currentBet = 0;
          }
          game = {
            ...game!,
            potTotal: game!.potTotal + total,
            betCount: 0,
            requiredBetCount: 0,
          } as any;
        };

        if (input.action === "START_GAME") {
          if (!isDealerCaller) throw new Error("Only dealer can START_GAME");
          // Complete existing game if present
          if (game) {
            await tx
              .update(games)
              .set({ status: "completed" })
              .where(eq(games.id, game.id));
          }

          // Pick or rotate dealer button
          let dealerButtonSeatId: string;
          if (!game?.dealerButtonSeatId) {
            // Deterministic: default to seatNumber 0
            dealerButtonSeatId = orderedSeats[0]!.id;
          } else {
            const idx = findIndexBySeatId(game.dealerButtonSeatId);
            dealerButtonSeatId = orderedSeats[pickNextIndex(idx, n)]!.id; // move clockwise by 1
          }

          const createdRows = await tx
            .insert(games)
            .values({
              tableId: input.tableId,
              status: "active",
              state: "GAME_START",
              dealerButtonSeatId,
              communityCards: [],
              potTotal: 0,
              betCount: 0,
              requiredBetCount: 0,
            })
            .returning();

          const g = createdRows?.[0];
          if (!g) throw new Error("Failed to create game");
          game = g;

          // Transition immediately to DEAL_HOLE_CARDS, starting at small blind (1 left of dealer)
          const dealerIdx = findIndexBySeatId(dealerButtonSeatId);
          const smallBlindSeat = orderedSeats[pickNextIndex(dealerIdx, n)]!;
          await tx
            .update(games)
            .set({
              state: "DEAL_HOLE_CARDS",
              assignedSeatId: smallBlindSeat.id,
            })
            .where(eq(games.id, g.id));
          game = {
            ...g,
            state: "DEAL_HOLE_CARDS",
            assignedSeatId: smallBlindSeat.id,
          } as any;

          return await summarizeTable(tx, input.tableId);
        }

        if (!game) throw new Error("No active game");

        if (input.action === "DEAL_CARD") {
          if (!isDealerCaller) throw new Error("Only dealer can DEAL_CARD");
          const code = toCardCode(input.params?.rank, input.params?.suit);
          const seen = allCardCodes();
          if (seen.has(code)) throw new Error("Card already dealt");

          if (game.state === "DEAL_HOLE_CARDS") {
            const seat = findSeatById(game.assignedSeatId!);
            await tx
              .update(seats)
              .set({ cards: sql`array_append(${seats.cards}, ${code})` })
              .where(eq(seats.id, seat.id));
            seat.cards.push(code);
            // Determine next seat or transition to BETTING when all have 2
            const allHaveTwo = orderedSeats.every((s) => s.cards.length >= 2);
            if (!allHaveTwo) {
              const nextSeatId = rotateToNextActiveSeatId(
                orderedSeats,
                seat.id,
              );
              await tx
                .update(games)
                .set({ assignedSeatId: nextSeatId })
                .where(eq(games.id, game.id));
              game = { ...game, assignedSeatId: nextSeatId } as any;
            } else {
              // Initialize betting round
              const bigBlindIdx = pickNextIndex(
                pickNextIndex(findIndexBySeatId(game.dealerButtonSeatId!), n),
                n,
              );
              const firstToAct = orderedSeats[pickNextIndex(bigBlindIdx, n)]!;
              const activeCount = orderedSeats.filter((s) => s.isActive).length;
              await tx
                .update(games)
                .set({
                  state: "BETTING",
                  assignedSeatId: firstToAct.id,
                  betCount: 0,
                  requiredBetCount: activeCount,
                })
                .where(eq(games.id, game.id));
              game = {
                ...game,
                state: "BETTING",
                assignedSeatId: firstToAct.id,
                betCount: 0,
                requiredBetCount: activeCount,
              } as any;
            }
            return await summarizeTable(tx, input.tableId);
          }

          if (
            game.state === "DEAL_FLOP" ||
            game.state === "DEAL_TURN" ||
            game.state === "DEAL_RIVER"
          ) {
            await tx
              .update(games)
              .set({
                communityCards: sql`array_append(${games.communityCards}, ${code})`,
              })
              .where(eq(games.id, game.id));
            game.communityCards.push(code);
            const cc = game.communityCards.length;
            if (
              (game.state === "DEAL_FLOP" && cc >= 3) ||
              (game.state === "DEAL_TURN" && cc >= 4) ||
              (game.state === "DEAL_RIVER" && cc >= 5)
            ) {
              // Start betting round again - postflop: start left of dealer button
              const dealerIdx = findIndexBySeatId(game.dealerButtonSeatId!);
              const firstToAct = orderedSeats[pickNextIndex(dealerIdx, n)]!;
              const activeCount = orderedSeats.filter((s) => s.isActive).length;
              await tx
                .update(games)
                .set({
                  state: "BETTING",
                  assignedSeatId: firstToAct.id,
                  betCount: 0,
                  requiredBetCount: activeCount,
                })
                .where(eq(games.id, game.id));
              game = {
                ...game,
                state: "BETTING",
                assignedSeatId: firstToAct.id,
                betCount: 0,
                requiredBetCount: activeCount,
              } as any;
            }
            return await summarizeTable(tx, input.tableId);
          }

          throw new Error("DEAL_CARD not valid in current state");
        }

        if (input.action === "RESET_TABLE") {
          if (!isDealerCaller) throw new Error("Only dealer can RESET_TABLE");
          for (const s of orderedSeats) {
            await tx
              .update(seats)
              .set({
                cards: sql`ARRAY[]::text[]`,
                isActive: true,
                currentBet: 0,
              })
              .where(eq(seats.id, s.id));
            s.cards = [];
            s.isActive = true;
            s.currentBet = 0;
          }

          // Mark current game complete and create a fresh one in GAME_START with rotated dealer button
          await tx
            .update(games)
            .set({ status: "completed" })
            .where(eq(games.id, game.id));
          const prevButton = game.dealerButtonSeatId ?? orderedSeats[0]!.id;
          const prevIdx = orderedSeats.findIndex((s) => s.id === prevButton);
          const nextButtonSeatId =
            orderedSeats[pickNextIndex(prevIdx, orderedSeats.length)]!.id;
          const [newGame] = await tx
            .insert(games)
            .values({
              tableId: input.tableId,
              status: "active",
              state: "GAME_START",
              dealerButtonSeatId: nextButtonSeatId,
              communityCards: [],
              potTotal: 0,
              betCount: 0,
              requiredBetCount: 0,
            })
            .returning();
          game = newGame as any;
          return await summarizeTable(tx, input.tableId);
        }

        // Player actions require assigned seat
        const actorSeat = orderedSeats.find((s) => s.playerId === userId);
        if (!actorSeat) throw new Error("Actor has no seat at this table");

        if (game.state !== "BETTING")
          throw new Error("Player actions only allowed in BETTING");
        if (game.assignedSeatId !== actorSeat.id)
          throw new Error("Not your turn");

        const maxBet = Math.max(
          ...orderedSeats.filter((s) => s.isActive).map((s) => s.currentBet),
        );

        if (input.action === "RAISE") {
          const amount = input.params?.amount ?? 0;
          if (amount <= 0) throw new Error("Invalid raise amount");
          if (actorSeat.buyIn < amount)
            throw new Error("Insufficient chips to raise");
          await tx
            .update(seats)
            .set({
              buyIn: sql`${seats.buyIn} - ${amount}`,
              currentBet: sql`${seats.currentBet} + ${amount}`,
            })
            .where(eq(seats.id, actorSeat.id));
          actorSeat.buyIn -= amount;
          actorSeat.currentBet += amount;
        } else if (input.action === "CHECK") {
          const need = maxBet - actorSeat.currentBet;
          if (need > 0) {
            if (actorSeat.buyIn < need)
              throw new Error("Insufficient chips to call");
            await tx
              .update(seats)
              .set({
                buyIn: sql`${seats.buyIn} - ${need}`,
                currentBet: sql`${seats.currentBet} + ${need}`,
              })
              .where(eq(seats.id, actorSeat.id));
            actorSeat.buyIn -= need;
            actorSeat.currentBet += need;
          }
        } else if (input.action === "FOLD") {
          await tx
            .update(seats)
            .set({ isActive: false })
            .where(eq(seats.id, actorSeat.id));
          actorSeat.isActive = false;
        }

        // Increment betCount and rotate assigned player
        await tx
          .update(games)
          .set({ betCount: sql`${games.betCount} + 1` })
          .where(eq(games.id, game.id));
        game.betCount += 1;
        const nextSeatId = rotateToNextActiveSeatId(orderedSeats, actorSeat.id);
        await tx
          .update(games)
          .set({ assignedSeatId: nextSeatId })
          .where(eq(games.id, game.id));
        game.assignedSeatId = nextSeatId as any;

        // Determine if betting round finished
        const activeSeats = orderedSeats.filter((s) => s.isActive);
        const allEqual = activeSeats.every(
          (s) => s.currentBet === activeSeats[0]!.currentBet,
        );
        const singleActive = activeSeats.length === 1;
        const finished =
          (game.betCount >= game.requiredBetCount && allEqual) || singleActive;

        if (finished) {
          await mergeBetsIntoPot();
          const cc = game.communityCards.length;
          if (singleActive || cc === 5) {
            // SHOWDOWN: evaluate winners and award pot
            const contenders = orderedSeats.filter((s) => s.isActive);
            const hands = contenders.map((s) =>
              Hand.solve([...s.cards, ...game!.communityCards]),
            );
            const winners = Hand.winners(hands);
            const winnerSeatIds = winners.map(
              (w: any) => contenders[hands.findIndex((h: any) => h === w)]!.id,
            );
            const share = Math.floor(game!.potTotal / winnerSeatIds.length);
            for (const sid of winnerSeatIds) {
              await tx
                .update(seats)
                .set({ buyIn: sql`${seats.buyIn} + ${share}` })
                .where(eq(seats.id, sid));
            }
            await tx
              .update(games)
              .set({ state: "SHOWDOWN" })
              .where(eq(games.id, game!.id));
            game = { ...game!, state: "SHOWDOWN" } as any;
          } else if (cc === 0) {
            await tx
              .update(games)
              .set({ state: "DEAL_FLOP" })
              .where(eq(games.id, game!.id));
            game = { ...game!, state: "DEAL_FLOP" } as any;
          } else if (cc === 3) {
            await tx
              .update(games)
              .set({ state: "DEAL_TURN" })
              .where(eq(games.id, game!.id));
            game = { ...game!, state: "DEAL_TURN" } as any;
          } else if (cc === 4) {
            await tx
              .update(games)
              .set({ state: "DEAL_RIVER" })
              .where(eq(games.id, game!.id));
            game = { ...game!, state: "DEAL_RIVER" } as any;
          }
        }

        return await summarizeTable(tx, input.tableId);
      });

      return result;
    }),

  get: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ input }) => {
      const snapshot = await summarizeTable(db, input.tableId);
      return snapshot;
    }),
});
