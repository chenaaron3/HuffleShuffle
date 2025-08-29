"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tableRouter = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const livekit_server_sdk_1 = require("livekit-server-sdk");
const node_module_1 = require("node:module");
const zod_1 = require("zod");
const trpc_1 = require("~/server/api/trpc");
const db_1 = require("~/server/db");
const schema_1 = require("~/server/db/schema");
const pusher_1 = require("~/server/pusher");
const game_logic_1 = require("../game-logic");
const requireCjs = (0, node_module_1.createRequire)(import.meta.url);
const Hand = requireCjs("pokersolver").Hand;
const ensureDealerRole = (role) => {
    if (role !== "dealer")
        throw new Error("FORBIDDEN: dealer role required");
};
const ensurePlayerRole = (role) => {
    if (role !== "player")
        throw new Error("FORBIDDEN: player role required");
};
const summarizeTable = async (client, tableId) => {
    const table = await client.query.pokerTables.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_1.pokerTables.id, tableId),
    });
    const tableSeats = await client.query.seats.findMany({
        where: (0, drizzle_orm_1.eq)(schema_1.seats.tableId, tableId),
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
        where: (0, drizzle_orm_1.eq)(schema_1.games.tableId, tableId),
        orderBy: (g, { desc }) => [desc(g.createdAt)],
    });
    return { table: table ?? null, seats: tableSeats, game: game ?? null };
};
function redactSnapshotForUser(snapshot, userId) {
    const isShowdown = snapshot.game?.state === "SHOWDOWN";
    const redactedSeats = snapshot.seats.map((s) => {
        if (isShowdown || s.playerId === userId)
            return s;
        const hiddenCount = (s.cards ?? []).length;
        return { ...s, cards: Array(hiddenCount).fill("FD") };
    });
    return { ...snapshot, seats: redactedSeats };
}
function getBigAndSmallBlindSeats(orderedSeats, game) {
    const dealerIdx = orderedSeats.findIndex((s) => s.id === game.dealerButtonSeatId);
    const n = orderedSeats.length;
    return {
        smallBlindSeat: orderedSeats[(0, game_logic_1.pickNextIndex)(dealerIdx, n)],
        bigBlindSeat: orderedSeats[(0, game_logic_1.pickNextIndex)(dealerIdx + 1, n)],
    };
}
async function collectBigAndSmallBlind(tx, table, orderedSeats, game) {
    const { smallBlindSeat, bigBlindSeat } = getBigAndSmallBlindSeats(orderedSeats, game);
    // Transfer buy-in into bets for big and small blind
    await tx
        .update(schema_1.seats)
        .set({
        currentBet: (0, drizzle_orm_1.sql) `${table.smallBlind}`,
        buyIn: (0, drizzle_orm_1.sql) `${schema_1.seats.buyIn} - ${table.smallBlind}`,
    })
        .where((0, drizzle_orm_1.eq)(schema_1.seats.id, smallBlindSeat.id));
    await tx
        .update(schema_1.seats)
        .set({
        currentBet: (0, drizzle_orm_1.sql) `${table.bigBlind}`,
        buyIn: (0, drizzle_orm_1.sql) `${schema_1.seats.buyIn} - ${table.bigBlind}`,
    })
        .where((0, drizzle_orm_1.eq)(schema_1.seats.id, bigBlindSeat.id));
}
async function resetGame(tx, game, orderedSeats) {
    if (!game)
        return;
    // Reset all seats
    for (const s of orderedSeats) {
        await tx
            .update(schema_1.seats)
            .set({
            cards: (0, drizzle_orm_1.sql) `ARRAY[]::text[]`,
            isActive: true,
            currentBet: 0,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.seats.id, s.id));
        s.cards = [];
        s.isActive = true;
        s.currentBet = 0;
    }
    // Mark current game complete and create a fresh one
    await tx
        .update(schema_1.games)
        .set({ status: "completed" })
        .where((0, drizzle_orm_1.eq)(schema_1.games.id, game.id));
}
async function createNewGame(tx, table, orderedSeats, dealerButtonSeatId) {
    // Create a new game object
    const createdRows = await tx
        .insert(schema_1.games)
        .values({
        tableId: table.id,
        status: "active",
        state: "DEAL_HOLE_CARDS",
        dealerButtonSeatId,
        communityCards: [],
        potTotal: 0,
        betCount: 0,
        requiredBetCount: 0,
    })
        .returning();
    const game = createdRows?.[0];
    if (!game)
        throw new Error("Failed to create game");
    // Collect big and small blind
    await collectBigAndSmallBlind(tx, table, orderedSeats, game);
    const { smallBlindSeat } = getBigAndSmallBlindSeats(orderedSeats, game);
    // Small blind gets the first turn
    await tx
        .update(schema_1.games)
        .set({
        assignedSeatId: smallBlindSeat.id,
    })
        .where((0, drizzle_orm_1.eq)(schema_1.games.id, game.id));
}
exports.tableRouter = (0, trpc_1.createTRPCRouter)({
    livekitToken: trpc_1.protectedProcedure
        .input(zod_1.z.object({ tableId: zod_1.z.string(), roomName: zod_1.z.string().optional() }))
        .query(async ({ ctx, input }) => {
        const userId = ctx.session.user.id;
        // Verify table exists
        const table = await db_1.db.query.pokerTables.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.pokerTables.id, input.tableId),
        });
        if (!table)
            throw new Error("Table not found");
        // Authorization: dealer of this table OR seated player at this table
        let authorized = false;
        if (ctx.session.user.role === "dealer" && table.dealerId === userId) {
            authorized = true;
        }
        else if (ctx.session.user.role === "player") {
            const seat = await db_1.db.query.seats.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.seats.tableId, input.tableId), (0, drizzle_orm_1.eq)(schema_1.seats.playerId, userId)),
            });
            authorized = !!seat;
        }
        if (!authorized)
            throw new Error("FORBIDDEN: not part of this table");
        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        const serverUrl = process.env.LIVEKIT_URL;
        if (!apiKey || !apiSecret || !serverUrl) {
            throw new Error("LiveKit env vars are not configured");
        }
        // Create grant for this room (tableId). Participants can publish and subscribe.
        const grant = {
            room: input.roomName ?? input.tableId,
            canPublish: true,
            canSubscribe: true,
            roomJoin: true,
        };
        const at = new livekit_server_sdk_1.AccessToken(apiKey, apiSecret, {
            identity: userId,
            ttl: "1h",
        });
        at.addGrant(grant);
        const token = await at.toJwt();
        return { token, serverUrl };
    }),
    list: trpc_1.publicProcedure.query(async () => {
        const rows = await db_1.db.query.pokerTables.findMany({
            orderBy: (t, { asc }) => [asc(t.createdAt)],
        });
        return rows.map((t) => ({
            id: t.id,
            name: t.name,
            smallBlind: t.smallBlind,
            bigBlind: t.bigBlind,
        }));
    }),
    create: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        name: zod_1.z.string().min(1),
        smallBlind: zod_1.z.number().int().positive(),
        bigBlind: zod_1.z.number().int().positive(),
    }))
        .mutation(async ({ ctx, input }) => {
        const userId = ctx.session.user.id;
        ensureDealerRole(ctx.session.user.role);
        const id = await db_1.db.transaction(async (tx) => {
            const existing = await tx.query.pokerTables.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_1.pokerTables.dealerId, userId),
            });
            if (existing)
                throw new Error("Dealer already has a table");
            const rows = await tx
                .insert(schema_1.pokerTables)
                .values({
                name: input.name,
                dealerId: userId,
                smallBlind: input.smallBlind,
                bigBlind: input.bigBlind,
            })
                .returning({ id: schema_1.pokerTables.id });
            const row = rows?.[0];
            if (!row)
                throw new Error("Failed to create table");
            return row.id;
        });
        return { tableId: id };
    }),
    join: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        tableId: zod_1.z.string(),
        buyIn: zod_1.z.number().int().positive(),
        userPublicKey: zod_1.z.string().min(1), // PEM SPKI
    }))
        .mutation(async ({ ctx, input }) => {
        const userId = ctx.session.user.id;
        ensurePlayerRole(ctx.session.user.role);
        const user = await db_1.db.query.users.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.users.id, userId),
        });
        if (!user)
            throw new Error("User not found");
        const result = await db_1.db.transaction(async (tx) => {
            const table = await tx.query.pokerTables.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_1.pokerTables.id, input.tableId),
            });
            if (!table)
                throw new Error("Table not found");
            const activeGame = await tx.query.games.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.games.tableId, input.tableId), (0, drizzle_orm_1.eq)(schema_1.games.status, "active")),
            });
            if (activeGame)
                throw new Error("Cannot join: game already active");
            // Seat auto-assign: next index based on count
            const existingSeats = await tx.query.seats.findMany({
                where: (0, drizzle_orm_1.eq)(schema_1.seats.tableId, input.tableId),
            });
            if (existingSeats.length >= 8)
                throw new Error("Table is full");
            if (user.balance < input.buyIn)
                throw new Error("Insufficient balance for buy-in");
            const seatNumber = existingSeats.length; // contiguous 0..n-1
            // Store/refresh user's public key
            await tx
                .update(schema_1.users)
                .set({ publicKey: input.userPublicKey })
                .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
            // Deduct balance and create seat
            await tx
                .update(schema_1.users)
                .set({ balance: (0, drizzle_orm_1.sql) `${schema_1.users.balance} - ${input.buyIn}` })
                .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
            const seatRows = await tx
                .insert(schema_1.seats)
                .values({
                tableId: input.tableId,
                playerId: userId,
                seatNumber,
                buyIn: input.buyIn,
                isActive: true,
            })
                .returning();
            const seat = seatRows?.[0];
            if (!seat)
                throw new Error("Failed to create seat");
            // Generate ephemeral nonce and encrypt for user + seat's mapped Pi (if any)
            const nonce = crypto.randomUUID();
            async function importRsaSpkiPem(pem) {
                const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
                const der = Buffer.from(b64, "base64");
                return await crypto.subtle.importKey("spki", der, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
            }
            async function rsaEncryptB64(publicPem, data) {
                const key = await importRsaSpkiPem(publicPem);
                const enc = new TextEncoder();
                const ct = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, key, enc.encode(data));
                return Buffer.from(new Uint8Array(ct)).toString("base64");
            }
            const encUser = await rsaEncryptB64(input.userPublicKey, nonce);
            // Find seat-mapped Pi (type 'card' with matching seatNumber)
            const pi = await tx.query.piDevices.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.piDevices.tableId, input.tableId), (0, drizzle_orm_1.eq)(schema_1.piDevices.type, "card"), (0, drizzle_orm_1.eq)(schema_1.piDevices.seatNumber, seat.seatNumber)),
            });
            let encPi = null;
            if (pi?.publicKey) {
                try {
                    encPi = await rsaEncryptB64(pi.publicKey, nonce);
                }
                catch {
                    encPi = null;
                }
            }
            const updatedSeatRows = await tx
                .update(schema_1.seats)
                .set({ encryptedUserNonce: encUser, encryptedPiNonce: encPi })
                .where((0, drizzle_orm_1.eq)(schema_1.seats.id, seat.id))
                .returning();
            if (!updatedSeatRows || updatedSeatRows.length === 0)
                throw new Error("Failed to update seat");
            const updatedSeat = updatedSeatRows[0];
            return { seat: updatedSeat };
        });
        return {
            tableId: input.tableId,
            seatId: result.seat.id,
            encryptedUserNonce: result.seat.encryptedUserNonce,
        };
    }),
    leave: trpc_1.protectedProcedure
        .input(zod_1.z.object({ tableId: zod_1.z.string() }))
        .mutation(async ({ ctx, input }) => {
        const userId = ctx.session.user.id;
        ensurePlayerRole(ctx.session.user.role);
        const result = await db_1.db.transaction(async (tx) => {
            const seat = await tx.query.seats.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.seats.tableId, input.tableId), (0, drizzle_orm_1.eq)(schema_1.seats.playerId, userId)),
            });
            if (!seat)
                throw new Error("Seat not found");
            const active = await tx.query.games.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.games.tableId, input.tableId), (0, drizzle_orm_1.eq)(schema_1.games.status, "active")),
            });
            if (active &&
                !["RESET_TABLE", "SHOWDOWN"].includes(active.state)) {
                throw new Error("Cannot leave during an active hand");
            }
            // Refund remaining buy-in back to wallet
            if (seat.buyIn > 0) {
                await tx
                    .update(schema_1.users)
                    .set({ balance: (0, drizzle_orm_1.sql) `${schema_1.users.balance} + ${seat.buyIn}` })
                    .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
            }
            // Remove seat and resequence seat numbers
            await tx.delete(schema_1.seats).where((0, drizzle_orm_1.eq)(schema_1.seats.id, seat.id));
            const remainingSeats = await tx.query.seats.findMany({
                where: (0, drizzle_orm_1.eq)(schema_1.seats.tableId, input.tableId),
                orderBy: (s, { asc }) => [asc(s.seatNumber)],
            });
            for (let i = 0; i < remainingSeats.length; i++) {
                const s = remainingSeats[i];
                if (s.seatNumber !== i) {
                    await tx
                        .update(schema_1.seats)
                        .set({ seatNumber: i })
                        .where((0, drizzle_orm_1.eq)(schema_1.seats.id, s.id));
                }
            }
            return { ok: true };
        });
        return result;
    }),
    action: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        tableId: zod_1.z.string(),
        action: zod_1.z.enum([
            "START_GAME",
            "DEAL_CARD",
            "RESET_TABLE",
            "RAISE",
            "FOLD",
            "CHECK",
        ]),
        params: zod_1.z
            .object({
            rank: zod_1.z.string().optional(),
            suit: zod_1.z.string().optional(),
            amount: zod_1.z.number().int().positive().optional(),
        })
            .optional(),
    }))
        .mutation(async ({ ctx, input }) => {
        const userId = ctx.session.user.id;
        await db_1.db.transaction(async (tx) => {
            const table = await tx.query.pokerTables.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_1.pokerTables.id, input.tableId),
            });
            if (!table)
                throw new Error("Table not found");
            const orderedSeats = await tx.query.seats.findMany({
                where: (0, drizzle_orm_1.eq)(schema_1.seats.tableId, input.tableId),
                orderBy: (s, { asc }) => [asc(s.seatNumber)],
            });
            const n = orderedSeats.length;
            if (n < 2 && input.action === "START_GAME")
                throw new Error("Need at least 2 players to start");
            let game = await tx.query.games.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.games.tableId, input.tableId), (0, drizzle_orm_1.eq)(schema_1.games.status, "active")),
            });
            const isDealerCaller = table.dealerId === userId;
            const findSeatById = (id) => orderedSeats.find((s) => s.id === id);
            const toCardCode = (rank, suit) => {
                if (!rank || !suit)
                    throw new Error("rank and suit required");
                return `${rank}${suit}`;
            };
            if (input.action === "START_GAME" || input.action === "RESET_TABLE") {
                if (!isDealerCaller)
                    throw new Error("Only dealer can START_GAME or RESET_TABLE");
                let dealerButtonSeatId = orderedSeats[0].id;
                // If there was a previous game, reset it
                if (game) {
                    await resetGame(tx, game, orderedSeats);
                    // Create a new game
                    const prevButton = game.dealerButtonSeatId;
                    const prevIdx = orderedSeats.findIndex((s) => s.id === prevButton);
                    dealerButtonSeatId =
                        orderedSeats[(0, game_logic_1.pickNextIndex)(prevIdx, orderedSeats.length)].id;
                }
                await createNewGame(tx, table, orderedSeats, dealerButtonSeatId);
                return { ok: true };
            }
            if (!game)
                throw new Error("No active game");
            if (input.action === "DEAL_CARD") {
                if (!isDealerCaller)
                    throw new Error("Only dealer can DEAL_CARD");
                const code = toCardCode(input.params?.rank, input.params?.suit);
                // Use shared game logic instead of duplicating code
                await (0, game_logic_1.dealCard)(tx, input.tableId, game, code);
                return { ok: true };
            }
            // Player actions require assigned seat
            const actorSeat = orderedSeats.find((s) => s.playerId === userId);
            if (!actorSeat)
                throw new Error("Actor has no seat at this table");
            if (game.state !== "BETTING")
                throw new Error("Player actions only allowed in BETTING");
            if (game.assignedSeatId !== actorSeat.id)
                throw new Error("Not your turn");
            const maxBet = Math.max(...orderedSeats.filter((s) => s.isActive).map((s) => s.currentBet));
            if (input.action === "RAISE") {
                const amount = input.params?.amount ?? 0;
                // The raised amount has to be greater than the max bet
                if (amount <= 0 || amount < maxBet)
                    throw new Error(`Invalid raise amount, must be greater than max bet, ${maxBet}`);
                const total = amount - actorSeat.currentBet;
                if (actorSeat.buyIn < total)
                    throw new Error("Insufficient chips to raise");
                await tx
                    .update(schema_1.seats)
                    .set({
                    buyIn: (0, drizzle_orm_1.sql) `${schema_1.seats.buyIn} - ${total}`,
                    currentBet: (0, drizzle_orm_1.sql) `${schema_1.seats.currentBet} + ${total}`,
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.seats.id, actorSeat.id));
                actorSeat.buyIn -= total;
                actorSeat.currentBet += total;
            }
            else if (input.action === "CHECK") {
                const need = maxBet - actorSeat.currentBet;
                if (need > 0) {
                    if (actorSeat.buyIn < need)
                        throw new Error("Insufficient chips to call");
                    await tx
                        .update(schema_1.seats)
                        .set({
                        buyIn: (0, drizzle_orm_1.sql) `${schema_1.seats.buyIn} - ${need}`,
                        currentBet: (0, drizzle_orm_1.sql) `${schema_1.seats.currentBet} + ${need}`,
                    })
                        .where((0, drizzle_orm_1.eq)(schema_1.seats.id, actorSeat.id));
                    actorSeat.buyIn -= need;
                    actorSeat.currentBet += need;
                }
            }
            else if (input.action === "FOLD") {
                await tx
                    .update(schema_1.seats)
                    .set({ isActive: false })
                    .where((0, drizzle_orm_1.eq)(schema_1.seats.id, actorSeat.id));
                actorSeat.isActive = false;
            }
            // Increment betCount and rotate assigned player
            await tx
                .update(schema_1.games)
                .set({ betCount: (0, drizzle_orm_1.sql) `${schema_1.games.betCount} + 1` })
                .where((0, drizzle_orm_1.eq)(schema_1.games.id, game.id));
            game.betCount += 1;
            const nextSeatId = (0, game_logic_1.rotateToNextActiveSeatId)(orderedSeats, actorSeat.id);
            await tx
                .update(schema_1.games)
                .set({ assignedSeatId: nextSeatId })
                .where((0, drizzle_orm_1.eq)(schema_1.games.id, game.id));
            game.assignedSeatId = nextSeatId;
            // Determine if betting round finished using helper
            await (0, game_logic_1.evaluateBettingTransition)(tx, input.tableId, game);
            return { ok: true };
        });
        // transaction complete -> fetch committed snapshot
        const snapshot = await summarizeTable(db_1.db, input.tableId);
        return redactSnapshotForUser(snapshot, userId);
    }),
    get: trpc_1.protectedProcedure
        .input(zod_1.z.object({ tableId: zod_1.z.string() }))
        .query(async ({ ctx, input }) => {
        const snapshot = await summarizeTable(db_1.db, input.tableId);
        return redactSnapshotForUser(snapshot, ctx.session.user.id);
    }),
});
