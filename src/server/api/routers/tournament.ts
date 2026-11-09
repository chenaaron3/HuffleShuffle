import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { nextOccurrence } from "~/lib/tournament-schedule";
import {
  cancelTournament,
  isPending,
  scheduleNextInSeries,
} from "~/server/api/table/tournaments";
import {
  createTRPCRouter,
  dealerProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import {
  MAX_SEATS_PER_TABLE,
  tournamentRegistrations,
  tournaments,
  tournamentSeries,
  users,
} from "~/server/db/schema";

const seriesInput = z.object({
  tableId: z.string().min(1),
  name: z.string().trim().min(1).max(255),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm"),
});

export const tournamentRouter = createTRPCRouter({
  /** Lobby feed: every live (not ended/cancelled) tournament with its queue. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const isDealer = ctx.session.user.role === "dealer";
    const rows = await ctx.db.query.tournaments.findMany({
      where: and(isNull(tournaments.endedAt), isNull(tournaments.cancelledAt)),
      orderBy: (t, { asc }) => [asc(t.scheduledAt)],
      with: {
        table: {
          columns: { id: true, name: true, smallBlind: true, bigBlind: true },
          with: { seats: { columns: { playerId: true } } },
        },
        registrations: {
          orderBy: (r, { asc }) => [asc(r.queuedAt), asc(r.id)],
          with: {
            user: {
              columns: {
                name: true,
                displayName: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    });

    return rows.map((t) => {
      const atTable = new Set(t.table.seats.map((s) => s.playerId));
      const status = t.startedAt
        ? ("in_progress" as const)
        : t.scheduledAt && t.scheduledAt <= now
          ? ("open" as const)
          : ("upcoming" as const);
      return {
        id: t.id,
        name: t.name ?? "Tournament",
        scheduledAt: t.scheduledAt,
        status,
        table: {
          id: t.table.id,
          name: t.table.name,
          smallBlind: t.table.smallBlind,
          bigBlind: t.table.bigBlind,
        },
        registrations: t.registrations.map((r, i) => ({
          id: r.id,
          userId: r.userId,
          name: r.user.displayName ?? r.user.name ?? "Player",
          email: isDealer ? r.user.email : null,
          image: r.user.image,
          position: i + 1,
          isSeated: i < MAX_SEATS_PER_TABLE,
          isAtTable: atTable.has(r.userId),
        })),
      };
    });
  }),

  register: protectedProcedure
    .input(z.object({ tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.role !== "player") {
        throw new Error("Only players can register");
      }
      const open = await ctx.db.query.tournaments.findFirst({
        where: and(eq(tournaments.id, input.tournamentId), isPending),
        columns: { id: true },
      });
      if (!open) throw new Error("Registration is closed for this game");
      await ctx.db
        .insert(tournamentRegistrations)
        .values({ tournamentId: open.id, userId: ctx.session.user.id })
        .onConflictDoNothing();
    }),

  unregister: protectedProcedure
    .input(z.object({ tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(tournamentRegistrations)
        .where(
          and(
            eq(tournamentRegistrations.tournamentId, input.tournamentId),
            eq(tournamentRegistrations.userId, ctx.session.user.id),
          ),
        );
    }),

  // ---------------------------------------------------------------- admin

  /** One-off game. Omit `scheduledAt` for an on-demand game anyone can join now. */
  create: dealerProcedure
    .input(
      z.object({
        tableId: z.string().min(1),
        name: z.string().trim().min(1).max(255).optional(),
        scheduledAt: z.coerce.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .insert(tournaments)
        .values({
          tableId: input.tableId,
          name:
            input.name ?? (input.scheduledAt ? "Tournament" : "On-demand game"),
          scheduledAt: input.scheduledAt ?? new Date(),
        })
        .returning({ id: tournaments.id });
      return { tournamentId: rows[0]!.id };
    }),

  update: dealerProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        name: z.string().trim().min(1).max(255),
        scheduledAt: z.coerce.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .update(tournaments)
        .set({ name: input.name, scheduledAt: input.scheduledAt })
        .where(and(eq(tournaments.id, input.tournamentId), isPending))
        .returning({ id: tournaments.id });
      if (!rows[0]) throw new Error("Only upcoming games can be edited");
    }),

  /** Cancel an upcoming game; if it belongs to a series, next week's is scheduled. */
  cancel: dealerProcedure
    .input(z.object({ tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction((tx) =>
        cancelTournament(tx, input.tournamentId),
      );
    }),

  addPlayer: dealerProcedure
    .input(
      z.object({ tournamentId: z.string(), email: z.string().trim().email() }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: eq(sql`lower(${users.email})`, input.email.toLowerCase()),
        columns: { id: true },
      });
      if (!user) throw new Error("No player has signed in with that email yet");
      await ctx.db
        .insert(tournamentRegistrations)
        .values({ tournamentId: input.tournamentId, userId: user.id })
        .onConflictDoNothing();
    }),

  /** Move a player to `toIndex` (0-based) in the queue. */
  movePlayer: dealerProcedure
    .input(
      z.object({
        registrationId: z.string(),
        toIndex: z.number().int().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        const moving = await tx.query.tournamentRegistrations.findFirst({
          where: eq(tournamentRegistrations.id, input.registrationId),
        });
        if (!moving) throw new Error("Registration not found");
        const queue = await tx.query.tournamentRegistrations.findMany({
          where: eq(tournamentRegistrations.tournamentId, moving.tournamentId),
          orderBy: (r, { asc }) => [asc(r.queuedAt), asc(r.id)],
        });
        const reordered = queue.filter((r) => r.id !== moving.id);
        reordered.splice(Math.min(input.toIndex, reordered.length), 0, moving);
        // Rewrite queue times 1ms apart from the earliest, preserving the new order.
        const base = Math.min(...queue.map((r) => r.queuedAt.getTime()));
        for (const [i, r] of reordered.entries()) {
          await tx
            .update(tournamentRegistrations)
            .set({ queuedAt: new Date(base + i) })
            .where(eq(tournamentRegistrations.id, r.id));
        }
      });
    }),

  removePlayer: dealerProcedure
    .input(z.object({ registrationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(tournamentRegistrations)
        .where(eq(tournamentRegistrations.id, input.registrationId));
    }),

  listSeries: dealerProcedure.query(({ ctx }) =>
    ctx.db.query.tournamentSeries.findMany({
      orderBy: (s, { asc }) => [asc(s.dayOfWeek), asc(s.startTime)],
      with: { table: { columns: { name: true } } },
    }),
  ),

  /** Create or edit a series. Edits also apply to its upcoming game (registrations kept). */
  saveSeries: dealerProcedure
    .input(seriesInput.extend({ seriesId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { seriesId, ...values } = input;
      await ctx.db.transaction(async (tx) => {
        if (!seriesId) {
          const [created] = await tx
            .insert(tournamentSeries)
            .values(values)
            .returning();
          await scheduleNextInSeries(tx, created!.id);
          return;
        }
        const before = await tx.query.tournamentSeries.findFirst({
          where: eq(tournamentSeries.id, seriesId),
        });
        if (!before) throw new Error("Series not found");
        await tx
          .update(tournamentSeries)
          .set(values)
          .where(eq(tournamentSeries.id, seriesId));
        const timeChanged =
          before.dayOfWeek !== values.dayOfWeek ||
          before.startTime !== values.startTime;
        await tx
          .update(tournaments)
          .set({
            name: values.name,
            tableId: values.tableId,
            ...(timeChanged && {
              scheduledAt: nextOccurrence(
                values.dayOfWeek,
                values.startTime,
                new Date(),
              ),
            }),
          })
          .where(and(eq(tournaments.seriesId, seriesId), isPending));
      });
    }),

  /** Stops the series and drops its upcoming game. Past games are kept. */
  deleteSeries: dealerProcedure
    .input(z.object({ seriesId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        await tx
          .delete(tournaments)
          .where(and(eq(tournaments.seriesId, input.seriesId), isPending));
        await tx
          .delete(tournamentSeries)
          .where(eq(tournamentSeries.id, input.seriesId));
      });
    }),
});
