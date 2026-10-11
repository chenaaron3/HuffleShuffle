import {
  and,
  asc,
  desc,
  eq,
  inArray,
  ne,
  notInArray,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { BOT_USER_IDS } from "~/server/api/bots/constants";
import { createTRPCRouter, dealerProcedure } from "~/server/api/trpc";
import {
  gameEvents,
  games,
  ledgerAccounts,
  users,
  waitlist,
} from "~/server/db/schema";

const paginationInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

export const dashboardRouter = createTRPCRouter({
  listWaitlist: dealerProcedure
    .input(paginationInput)
    .query(async ({ ctx, input }) => {
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

  deleteWaitlistEntries: dealerProcedure
    .input(z.object({ ids: z.array(z.string().min(1)).min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db
        .delete(waitlist)
        .where(inArray(waitlist.id, input.ids))
        .returning({ id: waitlist.id });
      return { deletedCount: deleted.length };
    }),

  listConsent: dealerProcedure
    .input(paginationInput)
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.pageSize;
      const humanPlayers = and(
        eq(users.role, "player"),
        notInArray(users.id, [...BOT_USER_IDS]),
      );

      const [rows, countRows] = await Promise.all([
        ctx.db
          .select({
            id: users.id,
            displayName: users.displayName,
            email: users.email,
            mediaConsent: users.mediaConsent,
            mediaConsentUpdatedAt: users.mediaConsentUpdatedAt,
          })
          .from(users)
          .where(humanPlayers)
          .orderBy(asc(users.displayName), asc(users.email))
          .limit(input.pageSize)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(humanPlayers),
      ]);

      return {
        rows,
        totalCount: countRows[0]?.count ?? 0,
      };
    }),

  setConsent: dealerProcedure
    .input(z.object({ userId: z.string().min(1), mediaConsent: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(users)
        .set({
          mediaConsent: input.mediaConsent,
          mediaConsentUpdatedAt: new Date(),
        })
        .where(
          and(
            eq(users.id, input.userId),
            eq(users.role, "player"),
            ne(users.mediaConsent, input.mediaConsent),
          ),
        )
        .returning({
          id: users.id,
          mediaConsent: users.mediaConsent,
          mediaConsentUpdatedAt: users.mediaConsentUpdatedAt,
        });
      if (updated) return updated;

      const existing = await ctx.db.query.users.findFirst({
        where: and(eq(users.id, input.userId), eq(users.role, "player")),
        columns: { id: true, mediaConsent: true, mediaConsentUpdatedAt: true },
      });
      if (!existing) throw new Error("Player not found");
      return existing;
    }),

  listPlayers: dealerProcedure
    .input(paginationInput)
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.pageSize;

      const [rows, countRows] = await Promise.all([
        ctx.db
          .select({
            id: users.id,
            displayName: users.displayName,
            email: users.email,
            balance:
              sql<number>`coalesce(${ledgerAccounts.balance}, 0)`.mapWith(
                Number,
              ),
          })
          .from(users)
          .leftJoin(
            ledgerAccounts,
            and(
              eq(ledgerAccounts.userId, users.id),
              eq(ledgerAccounts.kind, "USER_WALLET"),
            ),
          )
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

  listGames: dealerProcedure
    .input(paginationInput)
    .query(async ({ ctx, input }) => {
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
