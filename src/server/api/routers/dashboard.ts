import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, dealerProcedure } from "~/server/api/trpc";
import {
  gameEvents,
  games,
  users,
  waitlist,
} from "~/server/db/schema";

const paginationInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

export const dashboardRouter = createTRPCRouter({
  listWaitlist: dealerProcedure.input(paginationInput).query(async ({ ctx, input }) => {
    const offset = (input.page - 1) * input.pageSize;

    const [rows, countRows] = await Promise.all([
      ctx.db
        .select({
          id: waitlist.id,
          name: waitlist.name,
          email: waitlist.email,
          phone: waitlist.phone,
          instagram: waitlist.instagram,
          createdAt: waitlist.createdAt,
        })
        .from(waitlist)
        .orderBy(desc(waitlist.createdAt))
        .limit(input.pageSize)
        .offset(offset),
      ctx.db.select({ count: sql<number>`count(*)::int` }).from(waitlist),
    ]);

    return {
      rows,
      totalCount: countRows[0]?.count ?? 0,
    };
  }),

  listPlayers: dealerProcedure.input(paginationInput).query(async ({ ctx, input }) => {
    const offset = (input.page - 1) * input.pageSize;

    const [rows, countRows] = await Promise.all([
      ctx.db
        .select({
          id: users.id,
          displayName: users.displayName,
          email: users.email,
          balance: users.balance,
        })
        .from(users)
        .where(eq(users.role, "player"))
        .orderBy(asc(users.displayName))
        .limit(input.pageSize)
        .offset(offset),
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.role, "player")),
    ]);

    return {
      rows,
      totalCount: countRows[0]?.count ?? 0,
    };
  }),

  listGames: dealerProcedure.input(paginationInput).query(async ({ ctx, input }) => {
    const offset = (input.page - 1) * input.pageSize;

    const [rows, countRows] = await Promise.all([
      ctx.db
        .select({
          id: games.id,
          createdAt: games.createdAt,
          state: games.state,
          potTotal: games.potTotal,
          communityCards: games.communityCards,
        })
        .from(games)
        .orderBy(desc(games.createdAt))
        .limit(input.pageSize)
        .offset(offset),
      ctx.db.select({ count: sql<number>`count(*)::int` }).from(games),
    ]);

    return {
      rows,
      totalCount: countRows[0]?.count ?? 0,
    };
  }),

  listGameEvents: dealerProcedure
    .input(z.object({ gameId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const events = await ctx.db
        .select({
          id: gameEvents.id,
          type: gameEvents.type,
          createdAt: gameEvents.createdAt,
        })
        .from(gameEvents)
        .where(eq(gameEvents.gameId, input.gameId))
        .orderBy(asc(gameEvents.id));

      return { events };
    }),
});
