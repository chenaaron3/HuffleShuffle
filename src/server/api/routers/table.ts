import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { AccessToken } from "livekit-server-sdk";
import process from "process";
import ts from "typescript";
import { z } from "zod";
import { PLAYER_ACTION_TIMEOUT_MS } from "~/constants/timer";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  games,
  MAX_SEATS_PER_TABLE,
  piDevices,
  pokerTables,
  seats,
  users,
} from "~/server/db/schema";
import { getRoomServiceClient } from "~/server/livekit";
import { endHandStream, startHandStream } from "~/server/signal";
import { rsaEncryptB64 } from "~/utils/crypto";

import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { TrackSource, TrackType } from "@livekit/protocol";

import { computeBlindState } from "../blind-timer";
import {
  generateBotPublicKey,
  getBotIdForSeat,
  getBotName,
  isBot,
} from "../bot-constants";
import {
  createSeatTransaction,
  executeBettingAction,
  removePlayerSeatTransaction,
  triggerBotActions,
} from "../game-helpers";
import {
  createNewGame,
  dealCard,
  notifyTableUpdate,
  parseRankSuitToBarcode,
  resetGame,
} from "../game-logic";

import type { BlindState } from "../blind-timer";
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
  blinds: BlindState;
};

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
    blinds: computeBlindState(snapshot),
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

export const tableRouter = createTRPCRouter({
  checkExistingSeat: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const role = ctx.session.user.role;

    // For dealers, check if they're assigned to a table
    if (role === "dealer") {
      const table = await db.query.pokerTables.findFirst({
        where: eq(pokerTables.dealerId, userId),
        columns: {
          id: true,
          name: true,
        },
      });

      if (!table) {
        return { hasSeat: false };
      }

      return {
        hasSeat: true,
        tableId: table.id,
      };
    }

    // For players, check if they have a seat
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
        // Verify dealer is not currently assigned to another table
        const existing = await tx.query.pokerTables.findFirst({
          where: eq(pokerTables.dealerId, userId),
        });
        if (existing) throw new Error("Dealer is already assigned to a table");

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

  dealerJoin: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      ensureDealerRole(ctx.session.user.role);

      await db.transaction(async (tx) => {
        // Verify the dealer doesn't already have a table
        const existingTable = await tx.query.pokerTables.findFirst({
          where: eq(pokerTables.dealerId, userId),
        });
        if (existingTable)
          throw new Error("Dealer is already assigned to a table");

        // Get the table and verify it's joinable and has no dealer
        const snapshot = await tx.query.pokerTables.findFirst({
          where: eq(pokerTables.id, input.tableId),
          with: {
            games: { orderBy: (g, { desc }) => [desc(g.createdAt)], limit: 1 },
          },
        });
        if (!snapshot) throw new Error("Table not found");

        if (snapshot.dealerId !== null) {
          throw new Error("Table already has a dealer");
        }

        const latestGame = snapshot.games[0] ?? null;
        const isJoinable = !latestGame || latestGame.isCompleted;

        if (!isJoinable) {
          throw new Error("Cannot join table: game is in progress");
        }

        // Assign dealer to table
        await tx
          .update(pokerTables)
          .set({ dealerId: userId })
          .where(eq(pokerTables.id, input.tableId));
      });

      return { tableId: input.tableId };
    }),

  dealerLeave: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      ensureDealerRole(ctx.session.user.role);

      await db.transaction(async (tx) => {
        // Get the table
        const snapshot = await tx.query.pokerTables.findFirst({
          where: eq(pokerTables.id, input.tableId),
          with: {
            games: { orderBy: (g, { desc }) => [desc(g.createdAt)], limit: 1 },
          },
        });
        if (!snapshot) throw new Error("Table not found");

        // Verify caller is the dealer
        if (snapshot.dealerId !== userId) {
          throw new Error("FORBIDDEN: you are not the dealer of this table");
        }

        // Verify table is joinable (no active game)
        const latestGame = snapshot.games[0] ?? null;
        const isJoinable = !latestGame || latestGame.isCompleted;

        if (!isJoinable) {
          throw new Error("Cannot leave table: game is in progress");
        }

        // Remove dealer from table
        await tx
          .update(pokerTables)
          .set({ dealerId: null })
          .where(eq(pokerTables.id, input.tableId));
      });

      return { success: true };
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

        const existingSeats = snapshot.seats;
        if (existingSeats.length >= snapshot.maxSeats)
          throw new Error("Table is full");

        if (user.balance < input.buyIn)
          throw new Error("Insufficient balance for buy-in");

        // Find the first available seat number
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

        // Use shared helper to create seat
        const seat = await createSeatTransaction(tx, {
          tableId: input.tableId,
          playerId: userId,
          seatNumber,
          buyIn: input.buyIn,
          userPublicKey: input.userPublicKey,
        });

        return { seat } as const;
      });

      await notifyTableUpdate(input.tableId);

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
        return await removePlayerSeatTransaction(tx, {
          tableId: input.tableId,
          playerId: userId,
        });
      });

      await notifyTableUpdate(input.tableId);
      return result;
    }),

  addBot: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        seatNumber: z.number().int().nonnegative(),
        buyIn: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      ensureDealerRole(ctx.session.user.role);

      const result = await db.transaction(async (tx) => {
        const snapshot = await tx.query.pokerTables.findFirst({
          where: eq(pokerTables.id, input.tableId),
          with: {
            games: { orderBy: (g, { desc }) => [desc(g.createdAt)], limit: 1 },
            seats: { columns: { seatNumber: true } },
          },
        });
        if (!snapshot) throw new Error("Table not found");

        // Verify caller is the dealer
        if (snapshot.dealerId !== userId) {
          throw new Error("FORBIDDEN: only the dealer can add bots");
        }

        const latestGame = snapshot.games[0] ?? null;
        if (latestGame && !latestGame.isCompleted) {
          throw new Error("Cannot add bots during an active game");
        }

        // Validate seat number
        const seatNumber = input.seatNumber;
        if (seatNumber < 0 || seatNumber >= snapshot.maxSeats) {
          throw new Error("Seat number out of range");
        }
        const occupied = snapshot.seats.some(
          (s) => s.seatNumber === seatNumber,
        );
        if (occupied) {
          throw new Error("Seat is already occupied");
        }

        // Get bot user ID for this seat
        const botUserId = getBotIdForSeat(seatNumber);

        // Ensure bot user exists
        const existingBot = await tx.query.users.findFirst({
          where: eq(users.id, botUserId),
        });

        const botPublicKey = generateBotPublicKey();

        if (!existingBot) {
          // Create bot user with near-infinite balance
          await tx.insert(users).values({
            id: botUserId,
            name: getBotName(seatNumber),
            email: `bot-seat-${seatNumber}@huffle-shuffle.local`,
            role: "player",
            balance: 2147483647, // Max 32-bit integer
            publicKey: botPublicKey,
          });
        }

        // Default buy-in is 20x big blind
        const buyInAmount = input.buyIn ?? snapshot.bigBlind * 20;

        // Use shared helper to create bot seat (will deduct from bot's balance)
        const seat = await createSeatTransaction(tx, {
          tableId: input.tableId,
          playerId: botUserId,
          seatNumber,
          buyIn: buyInAmount,
          userPublicKey: botPublicKey,
        });

        return { seat } as const;
      });

      // Notify clients
      await notifyTableUpdate(input.tableId);

      return {
        tableId: input.tableId,
        seatId: result.seat.id,
        seatNumber: result.seat.seatNumber,
      };
    }),

  removeBot: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        seatNumber: z.number().int().nonnegative(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      ensureDealerRole(ctx.session.user.role);

      const result = await db.transaction(async (tx) => {
        const table = await tx.query.pokerTables.findFirst({
          where: eq(pokerTables.id, input.tableId),
        });
        if (!table) throw new Error("Table not found");

        // Verify caller is the dealer
        if (table.dealerId !== userId) {
          throw new Error("FORBIDDEN: only the dealer can remove bots");
        }

        // Get bot user ID for this seat
        const botUserId = getBotIdForSeat(input.seatNumber);

        // Find the bot's seat
        const seat = await tx.query.seats.findFirst({
          where: and(
            eq(seats.tableId, input.tableId),
            eq(seats.playerId, botUserId),
          ),
        });
        if (!seat) throw new Error("Bot not found at this seat");

        const latest = await tx.query.games.findFirst({
          where: eq(games.tableId, input.tableId),
          orderBy: (g, { desc }) => [desc(g.createdAt)],
        });
        if (latest && latest.isCompleted === false) {
          throw new Error("Cannot remove bot during an active hand");
        }

        // Bots don't get refunded (they have infinite balance)
        // Just remove the seat
        await tx.delete(seats).where(eq(seats.id, seat.id));
        return { ok: true } as const;
      });

      await notifyTableUpdate(input.tableId);
      return result;
    }),

  removePlayer: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        playerId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      ensureDealerRole(ctx.session.user.role);

      const result = await db.transaction(async (tx) => {
        // Verify caller is the dealer of this table
        const table = await tx.query.pokerTables.findFirst({
          where: eq(pokerTables.id, input.tableId),
        });
        if (!table) throw new Error("Table not found");
        if (table.dealerId !== userId) {
          throw new Error("FORBIDDEN: only the dealer can remove players");
        }

        // Use shared helper for the removal logic
        return await removePlayerSeatTransaction(tx, {
          tableId: input.tableId,
          playerId: input.playerId,
        });
      });

      await notifyTableUpdate(input.tableId);
      return result;
    }),

  setParticipantAudioMuted: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        playerId: z.string(),
        muted: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      ensureDealerRole(ctx.session.user.role);

      const table = await db.query.pokerTables.findFirst({
        where: eq(pokerTables.id, input.tableId),
        columns: {
          dealerId: true,
        },
      });

      if (!table) throw new Error("Table not found");
      if (table.dealerId !== userId) {
        throw new Error(
          "FORBIDDEN: only the assigned dealer can control audio",
        );
      }

      const roomService = getRoomServiceClient();
      const participants = await roomService.listParticipants(input.tableId);
      const participant = participants.find(
        (p) => p.identity === input.playerId,
      );

      if (!participant) {
        throw new Error("Participant not connected");
      }

      const audioTrack = (participant.tracks ?? []).find((track) => {
        if (track.type === TrackType.AUDIO) return true;
        return track.source === TrackSource.MICROPHONE;
      });

      if (!audioTrack?.sid) {
        throw new Error("No audio track available to mute");
      }

      await roomService.mutePublishedTrack(
        input.tableId,
        input.playerId,
        audioTrack.sid,
        input.muted,
      );

      return { ok: true } as const;
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
      const result = await db.transaction(async (tx) => {
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
            piDevices: {
              columns: { seatNumber: true, publicKey: true, serial: true },
            },
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
        const fromPi =
          table.piDevices.find((d) => d.seatNumber === fromSeat.seatNumber) ??
          null;

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
          encryptedUserNonce: encUser,
          encryptedPiNonce: encPi,
        });
        return {
          ok: true,
          fromPiSerial: fromPi?.serial ?? null,
          toPiSerial: toPi.serial ?? null,
          toSeatNumber: input.toSeatNumber,
          encPiNonce: encPi,
        } as const;
      });

      // Post-commit device signaling
      try {
        if (result.fromPiSerial) {
          await endHandStream(result.fromPiSerial);
        }
        if (result.toPiSerial && result.encPiNonce) {
          await startHandStream(result.toPiSerial, {
            tableId: input.tableId,
            seatNumber: result.toSeatNumber,
            encNonce: result.encPiNonce,
          });
        }
      } catch (e) {
        console.error("Seat-change device signaling failed", e);
      }

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
        const orderedSeats = snapshot.seats;
        const n = orderedSeats.length;
        if (n < 2 && input.action === "START_GAME")
          throw new Error("Need at least 2 players to start");

        // Get the last game, whether its finished or not
        let game = snapshot.games[0];
        const isDealerCaller = snapshot.dealerId === userId;

        if (input.action === "RESET_TABLE") {
          if (!isDealerCaller) throw new Error("Only dealer can RESET_TABLE");
          // If there was a previous game, mark it as complete
          if (game && !game.isCompleted) {
            await resetGame(tx, game, orderedSeats, true); // Reset buyIn to startingBalance
          }
          return { ok: true } as const;
        }

        // Deprecated API, since dealing a card will start the game
        if (input.action === "START_GAME") {
          if (!isDealerCaller) throw new Error("Only dealer can START_GAME");
          game = await createNewGame(tx, snapshot, orderedSeats, game ?? null);
          return { ok: true } as const;
        }

        if (input.action === "DEAL_CARD") {
          if (!isDealerCaller) throw new Error("Only dealer can DEAL_CARD");
          if (!input.params?.rank || !input.params?.suit)
            throw new Error("Rank and suit are required");
          const barcode = parseRankSuitToBarcode(
            input.params.rank,
            input.params.suit,
          );

          // Use shared game logic instead of duplicating code
          if (process.env.NODE_ENV === "test") {
            await dealCard(
              tx,
              input.tableId,
              game ?? null,
              `${input.params.rank}${input.params.suit}`,
            );
            return { ok: true } as const;
          }
          const region = process.env.AWS_REGION || "us-east-1";
          const queueUrl = process.env.SQS_QUEUE_URL;
          const sqs = new SQSClient({ region });
          const ts = Date.now();
          await sqs.send(
            new SendMessageCommand({
              QueueUrl: queueUrl,
              MessageBody: JSON.stringify({
                serial: "10000000672a9ed2",
                barcode,
                ts,
              }),
              MessageGroupId: input.tableId, // Ensures FIFO ordering per table
              MessageDeduplicationId: `${input.tableId}-${barcode}-${ts}`, // Prevents duplicates
            }),
          );
          console.log(`published ${barcode} to SQS`);
          return { ok: true } as const;
        }

        if (!game || game.isCompleted) throw new Error("No active game");

        // Player actions require assigned seat
        const actorSeat = orderedSeats.find((s) => s.playerId === userId);
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

        // Execute betting action using shared helper
        // This handles the action, betCount increment, turn rotation, and betting transition
        await executeBettingAction(tx, {
          tableId: input.tableId,
          game,
          actorSeat,
          orderedSeats,
          action: input.action,
          raiseAmount: input.params?.amount,
        });
        return { ok: true } as const;
      });

      // Notify clients of table update after successful transaction
      await notifyTableUpdate(input.tableId);

      // Process bot actions if it's a bot's turn
      await triggerBotActions(input.tableId);

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

  timeout: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        seatId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      ensureDealerRole(ctx.session.user.role);

      await db.transaction(async (tx) => {
        // Verify the caller is the dealer of this table
        const table = await tx.query.pokerTables.findFirst({
          where: eq(pokerTables.id, input.tableId),
        });
        if (!table) throw new Error("Table not found");
        if (table.dealerId !== userId)
          throw new Error("FORBIDDEN: not the dealer of this table");

        // Get current game state
        const snapshot = await tx.query.pokerTables.findFirst({
          where: eq(pokerTables.id, input.tableId),
          with: {
            games: { orderBy: (g, { desc }) => [desc(g.createdAt)], limit: 1 },
            seats: { orderBy: (s, { asc }) => [asc(s.seatNumber)] },
          },
        });
        if (!snapshot) throw new Error("Table not found");

        const game = snapshot.games[0];
        if (!game || game.isCompleted) throw new Error("No active game");
        if (game.state !== "BETTING")
          throw new Error("Timeout only allowed during betting");

        // Verify the seat ID matches the currently assigned seat
        if (game.assignedSeatId !== input.seatId) {
          throw new Error("Seat ID does not match current player's turn");
        }

        // Find the seat to timeout
        const seat = snapshot.seats.find((s) => s.id === input.seatId);
        if (!seat) throw new Error("Seat not found");
        if (seat.seatStatus !== "active") throw new Error("Seat is not active");

        // Fold the player due to timeout using shared helper
        // This handles the fold, betCount increment, turn rotation, and betting transition
        await executeBettingAction(tx, {
          tableId: input.tableId,
          game,
          actorSeat: seat,
          orderedSeats: snapshot.seats,
          action: "FOLD",
        });

        return { ok: true } as const;
      });

      // Notify clients of table update after successful transaction
      await notifyTableUpdate(input.tableId);

      // Process bot actions if it's a bot's turn
      await triggerBotActions(input.tableId);

      // Return fresh snapshot
      const snapshot = await summarizeTable(db, input.tableId);
      return redactSnapshotForUser(snapshot, userId);
    }),
});
