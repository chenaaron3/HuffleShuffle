import { and, asc, count, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { AccessToken } from 'livekit-server-sdk';
import { createRequire } from 'node:module';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '~/server/api/trpc';
import { db } from '~/server/db';
import {
    games, MAX_SEATS_PER_TABLE, piDevices, pokerTables, seats, users
} from '~/server/db/schema';

import {
    dealCard, notifyTableUpdate, pickNextIndex, rotateToNextActiveSeatId
} from '../game-logic';
import { evaluateBettingTransition } from '../hand-solver';

import type { VideoGrant } from "livekit-server-sdk";
const requireCjs = createRequire(import.meta.url);
interface PokerHandStatic {
  solve(cards: string[]): unknown;
  winners(hands: unknown[]): unknown[];
}
const Hand: PokerHandStatic = requireCjs("pokersolver").Hand as PokerHandStatic;

const ensureDealerRole = (role: string | undefined) => {
  if (role !== "dealer") throw new Error("FORBIDDEN: dealer role required");
};

const ensurePlayerRole = (role: string | undefined) => {
  if (role !== "player") throw new Error("FORBIDDEN: player role required");
};

type DB = typeof db;
type SeatRow = typeof seats.$inferSelect;
export type SeatWithPlayer = SeatRow & {
  player?: { id: string; name: string | null } | null;
};
type GameRow = typeof games.$inferSelect;
type TableRow = typeof pokerTables.$inferSelect;
type TableSnapshot = {
  table: TableRow | null;
  seats: SeatWithPlayer[];
  game: GameRow | null;
  isJoinable: boolean;
  availableSeats: number;
};
type TableTransaction = { update: typeof db.update; query: typeof db.query };

const summarizeTable = async (
  client: DB,
  tableId: string,
): Promise<TableSnapshot> => {
  const table = await client.query.pokerTables.findFirst({
    where: eq(pokerTables.id, tableId),
  });
  const tableSeats = await client.query.seats.findMany({
    where: eq(seats.tableId, tableId),
    orderBy: (s, { asc }) => [asc(s.seatNumber)],
    with: {
      player: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });
  const game = await client.query.games.findFirst({
    where: eq(games.tableId, tableId),
    orderBy: (g, { desc }) => [desc(g.createdAt)],
  });
  if (!table) throw new Error("Table not found");
  // Determine if table is joinable
  const isJoinable = !game || game.isCompleted;
  const availableSeats = table?.maxSeats - tableSeats.length;

  return {
    table: table,
    seats: tableSeats,
    game: game ?? null,
    isJoinable,
    availableSeats,
  };
};

function redactSnapshotForUser(
  snapshot: TableSnapshot,
  userId: string,
): TableSnapshot {
  const isShowdown = snapshot.game?.state === "SHOWDOWN";
  const redactedSeats: SeatWithPlayer[] = snapshot.seats.map((s) => {
    if (isShowdown || s.playerId === userId) return s;
    const hiddenCount = (s.cards ?? []).length;
    return { ...s, cards: Array(hiddenCount).fill("FD") } as SeatWithPlayer;
  });
  return { ...snapshot, seats: redactedSeats };
}

function getBigAndSmallBlindSeats(
  orderedSeats: Array<SeatRow>,
  game: GameRow,
): { smallBlindSeat: SeatRow; bigBlindSeat: SeatRow } {
  const dealerIdx = orderedSeats.findIndex(
    (s) => s.id === game.dealerButtonSeatId,
  );
  const n = orderedSeats.length;
  return {
    smallBlindSeat: orderedSeats[pickNextIndex(dealerIdx, n)]!,
    bigBlindSeat: orderedSeats[pickNextIndex(dealerIdx + 1, n)]!,
  };
}

async function collectBigAndSmallBlind(
  tx: TableTransaction,
  table: TableRow,
  orderedSeats: Array<SeatRow>,
  game: GameRow,
): Promise<void> {
  const { smallBlindSeat, bigBlindSeat } = getBigAndSmallBlindSeats(
    orderedSeats,
    game,
  );
  // Transfer buy-in into bets for big and small blind
  await tx
    .update(seats)
    .set({
      currentBet: sql`${table.smallBlind}`,
      buyIn: sql`${seats.buyIn} - ${table.smallBlind}`,
    })
    .where(eq(seats.id, smallBlindSeat.id));
  await tx
    .update(seats)
    .set({
      currentBet: sql`${table.bigBlind}`,
      buyIn: sql`${seats.buyIn} - ${table.bigBlind}`,
    })
    .where(eq(seats.id, bigBlindSeat.id));
}

async function resetGame(
  tx: TableTransaction,
  game: GameRow | null,
  orderedSeats: Array<SeatRow>,
): Promise<void> {
  if (!game) return;
  // Reset all seats
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

  // Mark current game as completed
  await tx
    .update(games)
    .set({ isCompleted: true })
    .where(eq(games.id, game.id));
}

async function createNewGame(
  tx: TableTransaction,
  table: TableRow,
  orderedSeats: Array<SeatRow>,
  dealerButtonSeatId: string,
): Promise<void> {
  // Create a new game object
  const createdRows = await (tx as DB)
    .insert(games)
    .values({
      tableId: table.id,
      isCompleted: false,
      state: "DEAL_HOLE_CARDS",
      dealerButtonSeatId,
      communityCards: [],
      potTotal: 0,
      betCount: 0,
      requiredBetCount: 0,
    })
    .returning();
  const game = createdRows?.[0];
  if (!game) throw new Error("Failed to create game");

  // Collect big and small blind
  await collectBigAndSmallBlind(tx, table, orderedSeats, game);
  const { smallBlindSeat } = getBigAndSmallBlindSeats(orderedSeats, game);

  // Small blind gets the first turn
  await tx
    .update(games)
    .set({
      assignedSeatId: smallBlindSeat.id,
    })
    .where(eq(games.id, game.id));
}

export const tableRouter = createTRPCRouter({
  checkExistingSeat: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Find if user has any existing seat
    const seat = await db.query.seats.findFirst({
      where: eq(seats.playerId, userId),
      with: {
        table: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!seat) {
      return { hasSeat: false };
    }

    return {
      hasSeat: true,
      tableId: seat.tableId,
    };
  }),

  livekitToken: protectedProcedure
    .input(z.object({ tableId: z.string(), roomName: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify table exists
      const table = await db.query.pokerTables.findFirst({
        where: eq(pokerTables.id, input.tableId),
      });
      if (!table) throw new Error("Table not found");

      // Authorization: dealer of this table OR seated player at this table
      let authorized = false;
      if (ctx.session.user.role === "dealer" && table.dealerId === userId) {
        authorized = true;
      } else if (ctx.session.user.role === "player") {
        const seat = await db.query.seats.findFirst({
          where: and(
            eq(seats.tableId, input.tableId),
            eq(seats.playerId, userId),
          ),
        });
        authorized = !!seat;
      }
      if (!authorized) throw new Error("FORBIDDEN: not part of this table");

      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;
      const serverUrl = process.env.LIVEKIT_URL;
      if (!apiKey || !apiSecret || !serverUrl) {
        throw new Error("LiveKit env vars are not configured");
      }

      // Create grant for this room (tableId). Participants can publish and subscribe.
      const grant: VideoGrant = {
        room: input.roomName ?? input.tableId,
        canPublish: true,
        canSubscribe: true,
        roomJoin: true,
      } as VideoGrant;

      const at = new AccessToken(apiKey, apiSecret, {
        identity: userId,
        ttl: "1h",
      });
      at.addGrant(grant);
      const token = await at.toJwt();
      return { token, serverUrl };
    }),
  list: publicProcedure.query(async () => {
    const rows = await db.query.pokerTables.findMany({
      orderBy: (t, { asc }) => [asc(t.createdAt)],
    });

    return Promise.all(
      rows.map(async (t) => {
        // Get current game and seat count for each table
        const game = await db.query.games.findFirst({
          where: eq(games.tableId, t.id),
          orderBy: (g, { desc }) => [desc(g.createdAt)],
        });

        const seatCount = await db.query.seats.findMany({
          where: eq(seats.tableId, t.id),
        });

        const isJoinable = !game || game.isCompleted;
        const availableSeats = t.maxSeats - seatCount.length;

        return {
          id: t.id,
          name: t.name,
          smallBlind: t.smallBlind,
          bigBlind: t.bigBlind,
          maxSeats: t.maxSeats,
          isJoinable,
          availableSeats,
          playerCount: seatCount.length,
        };
      }),
    );
  }),
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        smallBlind: z.number().int().positive(),
        bigBlind: z.number().int().positive(),
        maxSeats: z
          .number()
          .int()
          .positive()
          .max(MAX_SEATS_PER_TABLE)
          .default(MAX_SEATS_PER_TABLE),
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
            maxSeats: input.maxSeats,
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
      z.object({
        tableId: z.string(),
        buyIn: z.number().int().positive(),
        userPublicKey: z.string().min(1), // PEM SPKI
      }),
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
            eq(games.isCompleted, false),
          ),
        });
        if (activeGame) throw new Error("Cannot join: game already active");

        // Seat auto-assign: next index based on count
        const existingSeats = await tx.query.seats.findMany({
          where: eq(seats.tableId, input.tableId),
        });
        if (existingSeats.length >= table.maxSeats)
          throw new Error("Table is full");

        if (user.balance < input.buyIn)
          throw new Error("Insufficient balance for buy-in");

        const seatNumber = existingSeats.length; // contiguous 0..n-1

        // Store/refresh user's public key
        await tx
          .update(users)
          .set({ publicKey: input.userPublicKey })
          .where(eq(users.id, userId));

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

        // Generate ephemeral nonce and encrypt for user + seat's mapped Pi (if any)
        const nonce = crypto.randomUUID();

        async function importRsaSpkiPem(pem: string): Promise<CryptoKey> {
          const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
          const der = Buffer.from(b64, "base64");
          return await (crypto as any).subtle.importKey(
            "spki",
            der,
            { name: "RSA-OAEP", hash: "SHA-256" },
            true,
            ["encrypt"],
          );
        }
        async function rsaEncryptB64(
          publicPem: string,
          data: string,
        ): Promise<string> {
          const key = await importRsaSpkiPem(publicPem);
          const enc = new TextEncoder();
          const ct = await (crypto as any).subtle.encrypt(
            { name: "RSA-OAEP" },
            key,
            enc.encode(data),
          );
          return Buffer.from(new Uint8Array(ct)).toString("base64");
        }

        const encUser = await rsaEncryptB64(input.userPublicKey, nonce);

        // Find seat-mapped Pi (type 'card' with matching seatNumber)
        const pi = await tx.query.piDevices.findFirst({
          where: and(
            eq(piDevices.tableId, input.tableId),
            eq(piDevices.type, "card"),
            eq(piDevices.seatNumber, seat.seatNumber),
          ),
        });
        let encPi: string | null = null;
        if (pi?.publicKey) {
          try {
            encPi = await rsaEncryptB64(pi.publicKey, nonce);
          } catch {
            encPi = null;
          }
        }
        const updatedSeatRows = await tx
          .update(seats)
          .set({ encryptedUserNonce: encUser, encryptedPiNonce: encPi })
          .where(eq(seats.id, seat.id))
          .returning();
        if (!updatedSeatRows || updatedSeatRows.length === 0)
          throw new Error("Failed to update seat");
        const updatedSeat = updatedSeatRows[0]!;
        return { seat: updatedSeat } as const;
      });
      return {
        tableId: input.tableId,
        seatId: result.seat.id,
        encryptedUserNonce: result.seat.encryptedUserNonce,
      };
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
            eq(games.isCompleted, false),
          ),
        });
        // Allow leaving if table is joinable (no active game or game is completed)
        // This matches the isJoinable logic: !game || game.isCompleted
        if (active && active.isCompleted === false) {
          throw new Error("Cannot leave during an active hand");
        }

        // Refund remaining buy-in back to wallet
        if (seat.buyIn > 0) {
          await tx
            .update(users)
            .set({ balance: sql`${users.balance} + ${seat.buyIn}` })
            .where(eq(users.id, userId));
        }

        // Remove seat
        await tx.delete(seats).where(eq(seats.id, seat.id));
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
      await db.transaction(async (tx) => {
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
            eq(games.isCompleted, false),
          ),
        });

        const isDealerCaller = table.dealerId === userId;

        const findSeatById = (id: string) =>
          orderedSeats.find((s) => s.id === id)!;

        const toCardCode = (rank?: string, suit?: string) => {
          if (!rank || !suit) throw new Error("rank and suit required");
          return `${rank}${suit}`;
        };

        if (input.action === "RESET_TABLE") {
          if (!isDealerCaller) throw new Error("Only dealer can RESET_TABLE");
          // If there was a previous game, mark it as complete
          if (game) {
            await resetGame(tx, game, orderedSeats);
          }
          return { ok: true } as const;
        }

        if (input.action === "START_GAME") {
          if (!isDealerCaller) throw new Error("Only dealer can START_GAME");
          let dealerButtonSeatId = orderedSeats[0]!.id;
          // If there was a previous game, reset it
          if (game) {
            await resetGame(tx, game, orderedSeats);
            // Create a new game
            const prevButton = game.dealerButtonSeatId!;
            const prevIdx = orderedSeats.findIndex((s) => s.id === prevButton);
            dealerButtonSeatId =
              orderedSeats[pickNextIndex(prevIdx, orderedSeats.length)]!.id;
          }
          await createNewGame(tx, table, orderedSeats, dealerButtonSeatId);
          return { ok: true } as const;
        }

        if (!game) throw new Error("No active game");

        if (input.action === "DEAL_CARD") {
          if (!isDealerCaller) throw new Error("Only dealer can DEAL_CARD");
          const code = toCardCode(input.params?.rank, input.params?.suit);

          // Use shared game logic instead of duplicating code
          await dealCard(tx, input.tableId, game, code);
          return { ok: true } as const;
        }

        // Player actions require assigned seat
        const actorSeat = orderedSeats.find((s) => s.playerId === userId);
        if (!actorSeat) throw new Error("Actor has no seat at this table");

        if (game.state !== "BETTING")
          throw new Error("Player actions only allowed in BETTING");
        if (!game.assignedSeatId)
          throw new Error("No assigned seat for betting");
        if (game.assignedSeatId !== actorSeat.id)
          throw new Error("Not your turn");

        const maxBet = Math.max(
          ...orderedSeats.filter((s) => s.isActive).map((s) => s.currentBet),
        );

        if (input.action === "RAISE") {
          const amount = input.params?.amount ?? 0;
          // The raised amount has to be greater than the max bet
          if (amount <= 0 || amount < maxBet)
            throw new Error(
              `Invalid raise amount, must be greater than max bet, ${maxBet}`,
            );
          const total = amount - actorSeat.currentBet;
          if (actorSeat.buyIn < total)
            throw new Error("Insufficient chips to raise");
          await tx
            .update(seats)
            .set({
              buyIn: sql`${seats.buyIn} - ${total}`,
              currentBet: sql`${seats.currentBet} + ${total}`,
            })
            .where(eq(seats.id, actorSeat.id));
          actorSeat.buyIn -= total;
          actorSeat.currentBet += total;
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
        game.assignedSeatId = nextSeatId;

        // Determine if betting round finished using helper
        await evaluateBettingTransition(tx, input.tableId, game);
        return { ok: true } as const;
      });

      // Notify clients of table update after successful transaction
      await notifyTableUpdate(input.tableId);

      // transaction complete -> fetch committed snapshot
      const snapshot = await summarizeTable(db, input.tableId);
      return redactSnapshotForUser(snapshot, userId);
    }),

  get: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      const snapshot = await summarizeTable(db, input.tableId);
      return redactSnapshotForUser(snapshot, ctx.session.user.id);
    }),
});
