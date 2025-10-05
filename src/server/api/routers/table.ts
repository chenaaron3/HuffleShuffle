import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { AccessToken } from 'livekit-server-sdk';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '~/server/api/trpc';
import { db } from '~/server/db';
import {
    games, MAX_SEATS_PER_TABLE, piDevices, pokerTables, seats, users
} from '~/server/db/schema';
import { rsaEncryptB64 } from '~/utils/crypto';

import {
    logCall, logCheck, logEndGame, logFold, logRaise, logStartGame
} from '../game-event-logger';
import { dealCard, getNextActiveSeatId, notifyTableUpdate } from '../game-logic';
import { evaluateBettingTransition } from '../hand-solver';

import type { VideoGrant } from "livekit-server-sdk";

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
  const snapshot = await client.query.pokerTables.findFirst({
    where: eq(pokerTables.id, tableId),
    with: {
      games: {
        orderBy: (g, { desc }) => [desc(g.createdAt)],
        limit: 1,
      },
      seats: {
        orderBy: (s, { asc }) => [asc(s.seatNumber)],
        with: {
          player: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });
  if (!snapshot) throw new Error("Table not found");
  const latestGame = snapshot.games[0] ?? null;
  const tableSeats = snapshot.seats;
  // Determine if table is joinable
  const isJoinable = !latestGame || latestGame.isCompleted;
  const availableSeats = snapshot.maxSeats - tableSeats.length;

  return {
    table: snapshot,
    seats: tableSeats,
    game: latestGame,
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
    // During showdown, show all cards face up for all players
    // For other states, only show cards face up for the current user
    if (isShowdown || s.playerId === userId) {
      return s; // Show actual cards
    }
    const hiddenCount = (s.cards ?? []).length;
    return { ...s, cards: Array(hiddenCount).fill("FD") } as SeatWithPlayer;
  });
  return { ...snapshot, seats: redactedSeats };
}

function getBigAndSmallBlindSeats(
  orderedSeats: Array<SeatRow>,
  game: GameRow,
): { smallBlindSeat: SeatRow; bigBlindSeat: SeatRow } {
  const smallBlindSeat = getNextActiveSeatId(
    orderedSeats,
    game.dealerButtonSeatId!,
  );
  const bigBlindSeat = getNextActiveSeatId(orderedSeats, smallBlindSeat);
  return {
    smallBlindSeat: orderedSeats.find((s) => s.id === smallBlindSeat)!,
    bigBlindSeat: orderedSeats.find((s) => s.id === bigBlindSeat)!,
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
  resetBalance: boolean = false,
): Promise<void> {
  // Always reset all seats
  for (const s of orderedSeats) {
    const updateData: any = {
      cards: sql`ARRAY[]::text[]`,
      isActive: true,
      currentBet: 0,
      handType: null,
      handDescription: null,
      winAmount: 0,
      winningCards: sql`ARRAY[]::text[]`,
    };

    // Only reset buyIn to startingBalance if explicitly requested
    if (resetBalance) {
      updateData.buyIn = s.startingBalance;
    }

    await tx.update(seats).set(updateData).where(eq(seats.id, s.id));

    s.cards = [];
    s.isActive = true;
    s.currentBet = 0;
    s.handType = null;
    s.handDescription = null;
    s.winAmount = 0;
    s.winningCards = [];

    // Only reset buyIn to startingBalance if explicitly requested
    if (resetBalance) {
      s.buyIn = s.startingBalance;
    }
  }

  // Mark current game as completed and reset pot total (if there is one)
  if (game) {
    await tx
      .update(games)
      .set({
        assignedSeatId: null,
        isCompleted: true,
        potTotal: 0,
        state: "DEAL_HOLE_CARDS",
      })
      .where(eq(games.id, game.id));
  }
}

async function createNewGame(
  tx: TableTransaction,
  table: TableRow,
  orderedSeats: Array<SeatRow>,
  dealerButtonSeatId: string,
): Promise<GameRow> {
  // Validate that all players have enough chips to participate
  const minimumBet = table.bigBlind; // Players need at least the big blind amount
  const playersWithInsufficientChips = orderedSeats.filter(
    (seat) => seat.buyIn < minimumBet,
  );

  if (playersWithInsufficientChips.length > 0) {
    const playerNames = playersWithInsufficientChips
      .map((seat) => `Player at seat ${seat.seatNumber} (${seat.buyIn} chips)`)
      .join(", ");
    throw new Error(
      `Cannot start game: ${playerNames} have insufficient chips. Minimum required: ${minimumBet} chips (big blind amount)`,
    );
  }

  // Update startingBalance to current buyIn for all players before starting new game
  for (const seat of orderedSeats) {
    await tx
      .update(seats)
      .set({ startingBalance: seat.buyIn })
      .where(eq(seats.id, seat.id));
    seat.startingBalance = seat.buyIn; // Update in-memory object too
  }

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
  return game;
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
      with: {
        games: { orderBy: (g, { desc }) => [desc(g.createdAt)], limit: 1 },
        seats: { columns: { id: true } },
      },
    });

    return rows.map((t) => {
      const latestGame = t.games[0] ?? null;
      const isJoinable = !latestGame || latestGame.isCompleted;
      const playerCount = t.seats.length;
      const availableSeats = t.maxSeats - playerCount;

      return {
        id: t.id,
        name: t.name,
        smallBlind: t.smallBlind,
        bigBlind: t.bigBlind,
        maxSeats: t.maxSeats,
        isJoinable,
        availableSeats,
        playerCount,
      };
    });
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
        const snapshot = await tx.query.pokerTables.findFirst({
          where: eq(pokerTables.id, input.tableId),
          with: {
            games: { orderBy: (g, { desc }) => [desc(g.createdAt)], limit: 1 },
            seats: { columns: { seatNumber: true } },
          },
        });
        if (!snapshot) throw new Error("Table not found");
        const latestGame = snapshot.games[0] ?? null;
        if (latestGame && !latestGame.isCompleted)
          throw new Error("Cannot join: game already active");

        // Seat auto-assign: next index based on count
        const existingSeats = snapshot.seats;
        if (existingSeats.length >= snapshot.maxSeats)
          throw new Error("Table is full");

        if (user.balance < input.buyIn)
          throw new Error("Insufficient balance for buy-in");

        // Find the first available seat number (smallest available)
        const occupiedSeatNumbers = new Set(
          existingSeats.map((seat) => seat.seatNumber),
        );
        let seatNumber = -1;
        for (let i = 0; i < snapshot.maxSeats; i++) {
          if (!occupiedSeatNumbers.has(i)) {
            seatNumber = i;
            break;
          }
        }

        if (seatNumber === -1) {
          throw new Error("No available seats found");
        }

        // Store/refresh user's public key
        await tx
          .update(users)
          .set({ publicKey: input.userPublicKey })
          .where(eq(users.id, userId));

        // Deduct balance
        await tx
          .update(users)
          .set({ balance: sql`${users.balance} - ${input.buyIn}` })
          .where(eq(users.id, userId));

        // Generate ephemeral nonce and encrypt for user + seat's mapped Pi (if any)
        const nonce = crypto.randomUUID();
        const encUser = await rsaEncryptB64(input.userPublicKey, nonce);
        // Find seat-mapped Pi (type 'card' with matching seatNumber)
        const pi = await tx.query.piDevices.findFirst({
          where: and(
            eq(piDevices.tableId, input.tableId),
            eq(piDevices.type, "card"),
            eq(piDevices.seatNumber, seatNumber),
          ),
        });
        if (!pi || !pi.publicKey) throw new Error("Pi not found");
        const encPi = await rsaEncryptB64(pi.publicKey, nonce);

        // Create seat with encrypted nonce
        const updatedSeatRows = await tx
          .insert(seats)
          .values({
            tableId: input.tableId,
            playerId: userId,
            seatNumber,
            buyIn: input.buyIn,
            startingBalance: input.buyIn, // Set startingBalance to initial buyIn amount
            isActive: true,
            encryptedUserNonce: encUser,
            encryptedPiNonce: encPi,
          })
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

        const latest = await tx.query.games.findFirst({
          where: eq(games.tableId, input.tableId),
          orderBy: (g, { desc }) => [desc(g.createdAt)],
        });
        // Allow leaving if table is joinable (no active game or game is completed)
        // This matches the isJoinable logic: !game || game.isCompleted
        if (latest && latest.isCompleted === false) {
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

  // Change seats for the acting player when the table is joinable
  changeSeat: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        toSeatNumber: z.number().int().nonnegative(),
        userPublicKey: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      ensurePlayerRole(ctx.session.user.role);
      await db.transaction(async (tx) => {
        // Verify table exists, is joinable, and batch seats + pi devices
        const table = await tx.query.pokerTables.findFirst({
          where: eq(pokerTables.id, input.tableId),
          with: {
            games: { orderBy: (g, { desc }) => [desc(g.createdAt)], limit: 1 },
            seats: {
              columns: {
                id: true,
                playerId: true,
                seatNumber: true,
                buyIn: true,
              },
            },
            piDevices: { columns: { seatNumber: true, publicKey: true } },
          },
        });

        // Validate seat is valid and timing is correct
        if (!table) throw new Error("Table not found");
        const latestGame = table.games[0] ?? null;
        if (latestGame && !latestGame.isCompleted)
          throw new Error("Cannot change seats during an active hand");

        if (input.toSeatNumber < 0 || input.toSeatNumber >= table.maxSeats)
          throw new Error("Seat number out of range");

        const occupied = new Set(table.seats.map((s) => s.seatNumber));
        if (occupied.has(input.toSeatNumber))
          throw new Error("Target seat is occupied");

        // Find caller's current seat locally
        const fromSeat = table.seats.find((s) => s.playerId === userId);
        if (!fromSeat) throw new Error("You are not seated at this table");

        // Encrypt for Pi device mapped to the target seat (from batched relation)
        const toPi = table.piDevices.find(
          (d) => d.seatNumber === input.toSeatNumber,
        );
        if (!toPi) throw new Error("Target seat has no Pi device");
        if (!toPi.publicKey) throw new Error("Target Pi has no public key");

        // Persist the newly generated user public key for this table
        await tx
          .update(users)
          .set({ publicKey: input.userPublicKey })
          .where(eq(users.id, userId));

        // Remove old seat first to satisfy unique constraints
        await tx.delete(seats).where(eq(seats.id, fromSeat.id));

        // Generate fresh nonce and encrypt for user and mapped Pi (if any)
        const nonce = crypto.randomUUID();
        const encUser = await rsaEncryptB64(input.userPublicKey, nonce);
        const encPi = await rsaEncryptB64(toPi.publicKey, nonce);

        // Create new seat at target seatNumber with carried funds
        await (tx as any).insert(seats).values({
          tableId: input.tableId,
          playerId: userId,
          seatNumber: input.toSeatNumber,
          buyIn: fromSeat.buyIn,
          nonce: nonce,
          encryptedUserNonce: encUser,
          encryptedPiNonce: encPi,
        });
        return { ok: true } as const;
      });

      // Notify and return fresh snapshot
      await notifyTableUpdate(input.tableId);
      const snapshot = await summarizeTable(db, input.tableId);
      return redactSnapshotForUser(snapshot, userId);
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
        const snapshot = await tx.query.pokerTables.findFirst({
          where: eq(pokerTables.id, input.tableId),
          with: {
            games: { orderBy: (g, { desc }) => [desc(g.createdAt)], limit: 1 },
            seats: { orderBy: (s, { asc }) => [asc(s.seatNumber)] },
          },
        });
        if (!snapshot) throw new Error("Table not found");
        const orderedSeats = snapshot.seats.filter(
          (s) => s.buyIn > snapshot.bigBlind,
        );
        const n = orderedSeats.length;
        if (n < 2 && input.action === "START_GAME")
          throw new Error("Need at least 2 players to start");

        let game =
          snapshot.games[0] && !snapshot.games[0].isCompleted
            ? snapshot.games[0]
            : null;

        const isDealerCaller = snapshot.dealerId === userId;

        const toCardCode = (rank?: string, suit?: string) => {
          if (!rank || !suit) throw new Error("rank and suit required");
          return `${rank}${suit}`;
        };

        if (input.action === "RESET_TABLE") {
          if (!isDealerCaller) throw new Error("Only dealer can RESET_TABLE");
          // If there was a previous game, mark it as complete
          if (game) {
            await resetGame(tx, game, orderedSeats, true); // Reset buyIn to startingBalance
            // End game with no winners
            await logEndGame(tx, input.tableId, game.id, {
              winners: [],
            });
          }
          return { ok: true } as const;
        }

        if (input.action === "START_GAME") {
          if (!isDealerCaller) throw new Error("Only dealer can START_GAME");
          // Default dealer is the first seat
          let dealerButtonSeatId = orderedSeats[0]!.id;

          // Reset all seats and mark current game as completed (if exists)
          await resetGame(tx, game ?? null, orderedSeats);

          // If there was a previous game, progress the dealer button
          const prevButton = game?.dealerButtonSeatId;
          if (prevButton) {
            dealerButtonSeatId = getNextActiveSeatId(orderedSeats, prevButton);
          }

          game = await createNewGame(
            tx,
            snapshot,
            orderedSeats,
            dealerButtonSeatId,
          );
          await logStartGame(tx as any, input.tableId, game.id, {
            dealerButtonSeatId,
          });
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
        if (!actorSeat.isActive)
          throw new Error("Seat is inactive and cannot act");

        if (game.state !== "BETTING")
          throw new Error("Player actions only allowed in BETTING");
        if (!game.assignedSeatId)
          throw new Error("No assigned seat for betting");
        if (game.assignedSeatId !== actorSeat.id) {
          console.log("Expected seat id:", game.assignedSeatId);
          throw new Error("Not your turn");
        }

        const maxBet = Math.max(
          ...orderedSeats.filter((s) => s.isActive).map((s) => s.currentBet),
        );

        if (input.action === "RAISE") {
          const amount = input.params?.amount ?? 0;
          // The raised amount must be at least the max bet
          if (amount <= 0 || amount < maxBet)
            throw new Error(
              `Invalid raise amount, must be at least the max bet of ${maxBet}`,
            );
          const total = amount - actorSeat.currentBet;
          if (actorSeat.buyIn < total)
            throw new Error("Insufficient chips to raise");
          await tx
            .update(seats)
            .set({
              buyIn: sql`${seats.buyIn} - ${total}`,
              currentBet: sql`${seats.currentBet} + ${total}`,
              lastAction: "RAISE",
            })
            .where(eq(seats.id, actorSeat.id));
          actorSeat.buyIn -= total;
          actorSeat.currentBet += total;
          await logRaise(tx as any, input.tableId, game.id, {
            seatId: actorSeat.id,
            total: amount,
          });
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
                lastAction: "CALL",
              })
              .where(eq(seats.id, actorSeat.id));
            actorSeat.buyIn -= need;
            actorSeat.currentBet += need;
            await logCall(tx as any, input.tableId, game.id, {
              seatId: actorSeat.id,
              total: maxBet,
            });
          } else {
            await tx
              .update(seats)
              .set({ lastAction: "CHECK" })
              .where(eq(seats.id, actorSeat.id));
            await logCheck(tx as any, input.tableId, game.id, {
              seatId: actorSeat.id,
              total: maxBet,
            });
          }
        } else if (input.action === "FOLD") {
          await tx
            .update(seats)
            .set({ isActive: false, lastAction: "FOLD" })
            .where(eq(seats.id, actorSeat.id));
          actorSeat.isActive = false;
          await logFold(tx as any, input.tableId, game.id, {
            seatId: actorSeat.id,
          });
        }

        // Increment betCount and rotate assigned player
        await tx
          .update(games)
          .set({ betCount: sql`${games.betCount} + 1` })
          .where(eq(games.id, game.id));
        game.betCount += 1;
        const nextSeatId = getNextActiveSeatId(orderedSeats, actorSeat.id);
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

  // Returns a delta of events since `afterId` (exclusive) for the latest active game on the table,
  // plus table-level events (gameId null). If afterId is null, returns all events for the latest active game
  // and table-level events.
  eventsDelta: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        afterId: z.number().int().positive().nullable().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const after = input.afterId ?? null;
      // Fetch the latest events for the table
      const rows = await db.query.gameEvents.findMany({
        where: (ge, { eq: _eq, and: _and, gt }) =>
          _and(
            _eq(ge.tableId, input.tableId),
            after ? gt(ge.id, after) : _eq(ge.id, ge.id),
          ),
        orderBy: (ge, { desc }) => [desc(ge.id)],
        limit: 25,
      });
      return { events: rows };
    }),
});
