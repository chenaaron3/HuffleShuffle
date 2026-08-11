import { and, eq } from "drizzle-orm";
import { AccessToken } from "livekit-server-sdk";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  games,
  MAX_SEATS_PER_TABLE,
  piDevices,
  pokerTables,
  protectedPokerTables,
  seats,
  users,
} from "~/server/db/schema";
import { getRoomServiceClient } from "~/server/livekit";
import { endHandStream, startHandStream } from "~/server/signal";
import { rsaEncryptB64 } from "~/utils/crypto";

import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { TrackSource, TrackType } from "@livekit/protocol";

import {
  generateBotPublicKey,
  getBotIdForSeat,
  getBotName,
} from "~/server/api/bots/constants";
import { generateRandomCard } from "~/server/api/game/dealing";
import {
  apiActionToDispatchEvent,
  dispatchGameEvent,
} from "~/server/api/game/dispatch";
import {
  notifyTableUpdate,
  triggerBotActions,
} from "~/server/api/game/hand-lifecycle";
import {
  parseBarcodeToRankSuit,
  parseRankSuitToBarcode,
} from "~/server/api/game/helpers/cards";
import { grantBotFunds } from "~/server/api/ledger";
import {
  createSeatTransaction,
  removePlayerSeatTransaction,
} from "~/server/api/table/seating";
import {
  redactSnapshotForUser,
  summarizeTable,
} from "~/server/api/table/snapshot";
import { withTableMutation } from "~/server/api/lib/table-transaction";
import type { VideoGrant } from "livekit-server-sdk";

const ensureDealerRole = (role: string | undefined) => {
  if (role !== "dealer") throw new Error("FORBIDDEN: dealer role required");
};

const ensurePlayerRole = (role: string | undefined) => {
  if (role !== "player") throw new Error("FORBIDDEN: player role required");
};

export const tableRouter = createTRPCRouter({
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
  list: protectedProcedure.query(async () => {
    const rows = await db.query.pokerTables.findMany({
      orderBy: (t, { asc }) => [asc(t.createdAt)],
      with: {
        games: { orderBy: (g, { desc }) => [desc(g.createdAt)], limit: 1 },
        seats: { columns: { id: true } },
        protection: true,
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
        dealerId: t.dealerId,
        /** DB row exists in `protected_poker_table` — blocks deleting the poker_table row. */
        isLocked: !!t.protection,
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

      await withTableMutation(db, input.tableId, async (tx) => {
        // Get the table and verify it's joinable
        const snapshot = await tx.query.pokerTables.findFirst({
          where: eq(pokerTables.id, input.tableId),
          with: {
            games: { orderBy: (g, { desc }) => [desc(g.createdAt)], limit: 1 },
          },
        });
        if (!snapshot) throw new Error("Table not found");
        // Assign dealer to table (overwrites existing dealer if present)
        await tx
          .update(pokerTables)
          .set({ dealerId: userId })
          .where(eq(pokerTables.id, input.tableId));
      });

      await notifyTableUpdate(input.tableId);

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

      await withTableMutation(db, input.tableId, async (tx) => {
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

  setTableDeleteLock: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        locked: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      ensureDealerRole(ctx.session.user.role);

      await withTableMutation(db, input.tableId, async (tx) => {
        const table = await tx.query.pokerTables.findFirst({
          where: eq(pokerTables.id, input.tableId),
          columns: { id: true },
        });
        if (!table) throw new Error("Table not found");

        if (input.locked) {
          const existing = await tx.query.protectedPokerTables.findFirst({
            where: eq(protectedPokerTables.tableId, input.tableId),
          });
          if (!existing) {
            await tx.insert(protectedPokerTables).values({
              tableId: input.tableId,
            });
          }
        } else {
          await tx
            .delete(protectedPokerTables)
            .where(eq(protectedPokerTables.tableId, input.tableId));
        }
      });

      return { locked: input.locked } as const;
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

      const result = await withTableMutation(db, input.tableId, async (tx) => {
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

      const result = await withTableMutation(db, input.tableId, async (tx) => {
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

      const result = await withTableMutation(db, input.tableId, async (tx) => {
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

        const botLabel = getBotName(seatNumber);
        if (!existingBot) {
          await tx.insert(users).values({
            id: botUserId,
            name: botLabel,
            displayName: botLabel,
            email: `bot-seat-${seatNumber}@huffle-shuffle.local`,
            role: "player",
            publicKey: botPublicKey,
          });
        } else {
          await tx
            .update(users)
            .set({ displayName: botLabel, name: botLabel })
            .where(eq(users.id, botUserId));
        }

        // One-time huge wallet; thereafter bots buy in / cash out like humans
        await grantBotFunds(tx, botUserId);

        // Default buy-in is 20x big blind
        const buyInAmount = input.buyIn ?? snapshot.bigBlind * 20;

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

      const result = await withTableMutation(db, input.tableId, async (tx) => {
        const table = await tx.query.pokerTables.findFirst({
          where: eq(pokerTables.id, input.tableId),
        });
        if (!table) throw new Error("Table not found");

        // Verify caller is the dealer
        if (table.dealerId !== userId) {
          throw new Error("FORBIDDEN: only the dealer can remove bots");
        }

        const botUserId = getBotIdForSeat(input.seatNumber);

        return await removePlayerSeatTransaction(tx, {
          tableId: input.tableId,
          playerId: botUserId,
        });
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

      const result = await withTableMutation(db, input.tableId, async (tx) => {
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
      const result = await withTableMutation(db, input.tableId, async (tx) => {
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
                startingBalance: true,
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
          startingBalance: fromSeat.startingBalance,
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
          "DEAL_RANDOM",
          "RESET_TABLE",
          "RAISE",
          "FOLD",
          "CHECK",
          "VOLUNTEER_SHOW",
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
      await withTableMutation(db, input.tableId, async (tx) => {
        // Deal path: resolve card / SQS in the adapter, then dispatch CARD_DEALT when inline.
        if (input.action === "DEAL_CARD" || input.action === "DEAL_RANDOM") {
          const snapshot = await tx.query.pokerTables.findFirst({
            where: eq(pokerTables.id, input.tableId),
            with: {
              games: {
                orderBy: (g, { desc }) => [desc(g.createdAt)],
                limit: 1,
              },
            },
          });
          if (!snapshot) throw new Error("Table not found");
          if (snapshot.dealerId !== userId)
            throw new Error("Only dealer can DEAL_CARD");

          const game = snapshot.games[0] ?? null;
          let cardCode: string;
          let barcode: string;
          if (input.action === "DEAL_CARD") {
            if (!input.params?.rank || !input.params?.suit)
              throw new Error("Rank and suit are required");
            cardCode = `${input.params.rank}${input.params.suit}`;
            barcode = parseRankSuitToBarcode(
              input.params.rank,
              input.params.suit,
            );
          } else {
            barcode = await generateRandomCard(tx, input.tableId, game);
            const { rank, suit } = parseBarcodeToRankSuit(barcode);
            cardCode = `${rank}${suit}`;
          }

          const useInlineDeal =
            (process.env.INLINE_DEAL === "true" &&
              process.env.NODE_ENV === "development") ||
            process.env.NODE_ENV === "test";
          if (useInlineDeal) {
            await dispatchGameEvent(
              tx,
              input.tableId,
              { type: "CARD_DEALT", cardCode },
              { actorUserId: userId },
            );
            return;
          }

          const scannerDevice = await tx.query.piDevices.findFirst({
            where: and(
              eq(piDevices.tableId, input.tableId),
              eq(piDevices.type, "scanner"),
            ),
          });
          if (!scannerDevice)
            throw new Error("No scanner registered for this table");

          const region = process.env.AWS_REGION || "us-east-1";
          const queueUrl = process.env.SQS_QUEUE_URL;
          const sqs = new SQSClient({ region });
          const ts = Date.now();
          await sqs.send(
            new SendMessageCommand({
              QueueUrl: queueUrl,
              MessageBody: JSON.stringify({
                serial: scannerDevice.serial,
                barcode,
                ts,
              }),
              MessageGroupId: input.tableId,
              MessageDeduplicationId: `${input.tableId}-${barcode}-${ts}`,
            }),
          );
          console.log(`published ${barcode} to SQS`);
          return;
        }

        const event = apiActionToDispatchEvent(input);
        await dispatchGameEvent(tx, input.tableId, event, {
          actorUserId: userId,
        });
      });

      await notifyTableUpdate(input.tableId);
      await triggerBotActions(db, input.tableId);

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

      await withTableMutation(db, input.tableId, async (tx) => {
        await dispatchGameEvent(
          tx,
          input.tableId,
          { type: "TIMEOUT", seatId: input.seatId },
          { actorUserId: userId },
        );
      });

      await notifyTableUpdate(input.tableId);
      await triggerBotActions(db, input.tableId);
      const snapshot = await summarizeTable(db, input.tableId);
      return redactSnapshotForUser(snapshot, userId);
    }),
});
