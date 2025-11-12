import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  computeBlindState,
  sanitizeStepSeconds,
} from "~/server/api/blind-timer";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { pokerTables } from "~/server/db/schema";

import { notifyTableUpdate } from "../game-logic";

const ensureDealerRole = (role: string | undefined) => {
  if (role !== "dealer") throw new Error("FORBIDDEN: dealer role required");
};

export const blindsRouter = createTRPCRouter({
  start: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      ensureDealerRole(ctx.session.user.role);
      const startedAt = new Date();
      const rows = await db
        .update(pokerTables)
        .set({ blindTimerStartedAt: startedAt })
        .where(
          and(
            eq(pokerTables.id, input.tableId),
            eq(pokerTables.dealerId, ctx.session.user.id),
          ),
        )
        .returning();

      const table = rows[0];
      if (!table)
        throw new Error("Table not found or you are not the dealer for it");

      await notifyTableUpdate(input.tableId);

      return { blinds: computeBlindState(table) };
    }),

  reset: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      ensureDealerRole(ctx.session.user.role);

      const rows = await db
        .update(pokerTables)
        .set({ blindTimerStartedAt: null })
        .where(
          and(
            eq(pokerTables.id, input.tableId),
            eq(pokerTables.dealerId, ctx.session.user.id),
          ),
        )
        .returning();

      const table = rows[0];
      if (!table)
        throw new Error("Table not found or you are not the dealer for it");

      await notifyTableUpdate(input.tableId);

      return { blinds: computeBlindState(table) };
    }),

  setInterval: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        stepSeconds: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      ensureDealerRole(ctx.session.user.role);
      const sanitized = sanitizeStepSeconds(input.stepSeconds);

      const rows = await db
        .update(pokerTables)
        .set({ blindStepSeconds: sanitized })
        .where(
          and(
            eq(pokerTables.id, input.tableId),
            eq(pokerTables.dealerId, ctx.session.user.id),
          ),
        )
        .returning();

      const table = rows[0];
      if (!table)
        throw new Error("Table not found or you are not the dealer for it");

      await notifyTableUpdate(input.tableId);

      return { blinds: computeBlindState(table) };
    }),
});
