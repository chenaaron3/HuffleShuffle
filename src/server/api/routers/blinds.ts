import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  computeBlindState,
  sanitizeStepSeconds,
} from "~/server/api/lib/blind-timer";
import { notifyTableUpdate } from "~/server/api/game/hand-lifecycle";
import { withTableMutation } from "~/server/api/lib/table-transaction";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { pokerTables } from "~/server/db/schema";

const ensureDealerRole = (role: string | undefined) => {
  if (role !== "dealer") throw new Error("FORBIDDEN: dealer role required");
};

export const blindsRouter = createTRPCRouter({
  start: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      ensureDealerRole(ctx.session.user.role);
      const table = await withTableMutation(db, input.tableId, async (tx) => {
        const startedAt = new Date();
        const rows = await tx
          .update(pokerTables)
          .set({
            blindTimerStartedAt: startedAt,
            blindTimerIsPaused: false,
            blindTimerFrozenElapsedSeconds: null,
          })
          .where(
            and(
              eq(pokerTables.id, input.tableId),
              eq(pokerTables.dealerId, ctx.session.user.id),
            ),
          )
          .returning();

        const updated = rows[0];
        if (!updated)
          throw new Error("Table not found or you are not the dealer for it");
        return updated;
      });

      await notifyTableUpdate(input.tableId);

      return { blinds: computeBlindState(table) };
    }),

  reset: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      ensureDealerRole(ctx.session.user.role);

      const table = await withTableMutation(db, input.tableId, async (tx) => {
        const rows = await tx
          .update(pokerTables)
          .set({
            blindTimerStartedAt: null,
            blindTimerIsPaused: false,
            blindTimerFrozenElapsedSeconds: null,
          })
          .where(
            and(
              eq(pokerTables.id, input.tableId),
              eq(pokerTables.dealerId, ctx.session.user.id),
            ),
          )
          .returning();

        const updated = rows[0];
        if (!updated)
          throw new Error("Table not found or you are not the dealer for it");
        return updated;
      });

      await notifyTableUpdate(input.tableId);

      return { blinds: computeBlindState(table) };
    }),

  pause: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      ensureDealerRole(ctx.session.user.role);

      const updated = await withTableMutation(db, input.tableId, async (tx) => {
        const table = await tx.query.pokerTables.findFirst({
          where: and(
            eq(pokerTables.id, input.tableId),
            eq(pokerTables.dealerId, ctx.session.user.id),
          ),
        });
        if (!table)
          throw new Error("Table not found or you are not the dealer for it");
        if (table.blindTimerIsPaused || table.blindTimerStartedAt == null) {
          throw new Error("Blind timer is not running");
        }

        const elapsed = computeBlindState(table).elapsedSeconds;

        const rows = await tx
          .update(pokerTables)
          .set({
            blindTimerStartedAt: null,
            blindTimerIsPaused: true,
            blindTimerFrozenElapsedSeconds: elapsed,
          })
          .where(
            and(
              eq(pokerTables.id, input.tableId),
              eq(pokerTables.dealerId, ctx.session.user.id),
            ),
          )
          .returning();

        const row = rows[0];
        if (!row)
          throw new Error("Table not found or you are not the dealer for it");
        return row;
      });

      await notifyTableUpdate(input.tableId);

      return { blinds: computeBlindState(updated) };
    }),

  resume: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      ensureDealerRole(ctx.session.user.role);

      const updated = await withTableMutation(db, input.tableId, async (tx) => {
        const table = await tx.query.pokerTables.findFirst({
          where: and(
            eq(pokerTables.id, input.tableId),
            eq(pokerTables.dealerId, ctx.session.user.id),
          ),
        });
        if (!table)
          throw new Error("Table not found or you are not the dealer for it");
        if (!table.blindTimerIsPaused) {
          throw new Error("Blind timer is not paused");
        }

        const frozen = table.blindTimerFrozenElapsedSeconds ?? 0;
        const startedAt = new Date(Date.now() - frozen * 1000);

        const rows = await tx
          .update(pokerTables)
          .set({
            blindTimerStartedAt: startedAt,
            blindTimerIsPaused: false,
            blindTimerFrozenElapsedSeconds: null,
          })
          .where(
            and(
              eq(pokerTables.id, input.tableId),
              eq(pokerTables.dealerId, ctx.session.user.id),
            ),
          )
          .returning();

        const row = rows[0];
        if (!row)
          throw new Error("Table not found or you are not the dealer for it");
        return row;
      });

      await notifyTableUpdate(input.tableId);

      return { blinds: computeBlindState(updated) };
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

      const table = await withTableMutation(db, input.tableId, async (tx) => {
        const rows = await tx
          .update(pokerTables)
          .set({ blindStepSeconds: sanitized })
          .where(
            and(
              eq(pokerTables.id, input.tableId),
              eq(pokerTables.dealerId, ctx.session.user.id),
            ),
          )
          .returning();

        const updated = rows[0];
        if (!updated)
          throw new Error("Table not found or you are not the dealer for it");
        return updated;
      });

      await notifyTableUpdate(input.tableId);

      return { blinds: computeBlindState(table) };
    }),
});
