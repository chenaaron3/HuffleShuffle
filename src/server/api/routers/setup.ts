import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import { db } from '~/server/db';
import { piDevices, pokerTables } from '~/server/db/schema';

function ensureDealer(tableDealerId: string, userId: string) {
  if (tableDealerId !== userId) throw new Error("FORBIDDEN: dealer only");
}

export const setupRouter = createTRPCRouter({
  get: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      const table = await db.query.pokerTables.findFirst({
        where: eq(pokerTables.id, input.tableId),
      });
      if (!table) throw new Error("Table not found");
      ensureDealer(table.dealerId, ctx.session.user.id);

      const devices = await db.query.piDevices.findMany({
        where: eq(piDevices.tableId, input.tableId),
      });

      const dealer = devices.find((d) => d.type === "dealer")?.serial ?? "";
      const scanner = devices.find((d) => d.type === "scanner")?.serial ?? "";
      const hand = devices
        .filter((d) => d.type === "card")
        .sort((a, b) => (a.seatNumber ?? 0) - (b.seatNumber ?? 0))
        .map((d) => d.serial);
      while (hand.length < 8) hand.push("");

      return {
        dealerSerial: dealer,
        scannerSerial: scanner,
        handSerials: hand.slice(0, 8),
        available: devices.map((d) => ({
          serial: d.serial,
          type: d.type,
          seatNumber: d.seatNumber,
        })),
      };
    }),

  save: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        dealerSerial: z.string().optional().nullable(),
        scannerSerial: z.string().optional().nullable(),
        handSerials: z.array(z.string()).length(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = await db.query.pokerTables.findFirst({
        where: eq(pokerTables.id, input.tableId),
      });
      if (!table) throw new Error("Table not found");
      ensureDealer(table.dealerId, ctx.session.user.id);

      console.log("input", input);

      const desiredDealer = (input.dealerSerial ?? "").trim();
      const desiredScanner = (input.scannerSerial ?? "").trim();
      const desiredHand = input.handSerials.map((s) => s.trim());

      await db.transaction(async (tx) => {
        // Reset all devices for this table to baseline (card, no seat)
        await tx
          .update(piDevices)
          .set({ type: "card", seatNumber: null })
          .where(eq(piDevices.tableId, input.tableId));

        async function upsertDevice(
          serial: string,
          type: "dealer" | "scanner" | "card" | "button",
          seatNumber: number | null,
        ): Promise<void> {
          const s = serial.trim();
          if (!s) return;
          const existing = await tx.query.piDevices.findFirst({
            where: eq(piDevices.serial, s),
          });
          if (existing) {
            await tx
              .update(piDevices)
              .set({ tableId: input.tableId, type, seatNumber })
              .where(eq(piDevices.serial, s));
          } else {
            await tx
              .insert(piDevices)
              .values({ serial: s, tableId: input.tableId, type, seatNumber });
          }
        }

        if (desiredDealer) await upsertDevice(desiredDealer, "dealer", null);
        if (desiredScanner) await upsertDevice(desiredScanner, "scanner", null);

        for (let i = 0; i < Math.min(8, desiredHand.length); i++) {
          const serial = desiredHand[i] ?? "";
          if (!serial) continue;
          await upsertDevice(serial, "card", i);
        }
      });

      return { ok: true } as const;
    }),
});
