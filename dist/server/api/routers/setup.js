"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRouter = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const zod_1 = require("zod");
const trpc_1 = require("~/server/api/trpc");
const db_1 = require("~/server/db");
const schema_1 = require("~/server/db/schema");
function ensureDealer(tableDealerId, userId) {
    if (tableDealerId !== userId)
        throw new Error("FORBIDDEN: dealer only");
}
exports.setupRouter = (0, trpc_1.createTRPCRouter)({
    get: trpc_1.protectedProcedure
        .input(zod_1.z.object({ tableId: zod_1.z.string() }))
        .query(async ({ ctx, input }) => {
        const table = await db_1.db.query.pokerTables.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.pokerTables.id, input.tableId),
        });
        if (!table)
            throw new Error("Table not found");
        ensureDealer(table.dealerId, ctx.session.user.id);
        const devices = await db_1.db.query.piDevices.findMany({
            where: (0, drizzle_orm_1.eq)(schema_1.piDevices.tableId, input.tableId),
        });
        const dealer = devices.find((d) => d.type === "dealer")?.serial ?? "";
        const scanner = devices.find((d) => d.type === "scanner")?.serial ?? "";
        const hand = devices
            .filter((d) => d.type === "card")
            .sort((a, b) => (a.seatNumber ?? 0) - (b.seatNumber ?? 0))
            .map((d) => d.serial);
        while (hand.length < 8)
            hand.push("");
        return {
            dealerSerial: dealer,
            scannerSerial: scanner,
            handSerials: hand.slice(0, 8),
            available: devices.map((d) => ({
                serial: d.serial,
                type: d.type,
                seatNumber: d.seatNumber,
                publicKey: d.publicKey ?? null,
            })),
        };
    }),
    save: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        tableId: zod_1.z.string(),
        dealerSerial: zod_1.z.string().optional().nullable(),
        dealerPublicKey: zod_1.z.string().optional().nullable(),
        scannerSerial: zod_1.z.string().optional().nullable(),
        scannerPublicKey: zod_1.z.string().optional().nullable(),
        handSerials: zod_1.z.array(zod_1.z.string()).length(8),
        handPublicKeys: zod_1.z.array(zod_1.z.string().nullable().optional()).length(8),
    }))
        .mutation(async ({ ctx, input }) => {
        const table = await db_1.db.query.pokerTables.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.pokerTables.id, input.tableId),
        });
        if (!table)
            throw new Error("Table not found");
        ensureDealer(table.dealerId, ctx.session.user.id);
        console.log("input", input);
        const desiredDealer = (input.dealerSerial ?? "").trim();
        const desiredScanner = (input.scannerSerial ?? "").trim();
        const desiredHand = input.handSerials.map((s) => s.trim());
        await db_1.db.transaction(async (tx) => {
            // Reset all devices for this table to baseline (card, no seat)
            await tx
                .update(schema_1.piDevices)
                .set({ type: "card", seatNumber: null })
                .where((0, drizzle_orm_1.eq)(schema_1.piDevices.tableId, input.tableId));
            async function upsertDevice(serial, type, seatNumber, publicKey) {
                const s = serial.trim();
                if (!s)
                    return;
                const existing = await tx.query.piDevices.findFirst({
                    where: (0, drizzle_orm_1.eq)(schema_1.piDevices.serial, s),
                });
                if (existing) {
                    await tx
                        .update(schema_1.piDevices)
                        .set({
                        tableId: input.tableId,
                        type,
                        seatNumber,
                        publicKey: publicKey ?? existing.publicKey,
                    })
                        .where((0, drizzle_orm_1.eq)(schema_1.piDevices.serial, s));
                }
                else {
                    await tx.insert(schema_1.piDevices).values({
                        serial: s,
                        tableId: input.tableId,
                        type,
                        seatNumber,
                        publicKey: publicKey ?? null,
                    });
                }
            }
            if (desiredDealer)
                await upsertDevice(desiredDealer, "dealer", null, input.dealerPublicKey ?? undefined);
            if (desiredScanner)
                await upsertDevice(desiredScanner, "scanner", null, input.scannerPublicKey ?? undefined);
            for (let i = 0; i < Math.min(8, desiredHand.length); i++) {
                const serial = desiredHand[i] ?? "";
                if (!serial)
                    continue;
                const pub = (input.handPublicKeys[i] ?? undefined);
                await upsertDevice(serial, "card", i, pub);
            }
        });
        return { ok: true };
    }),
});
