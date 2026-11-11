import {
  and,
  asc,
  desc,
  eq,
  notInArray,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { BOT_USER_IDS } from "~/server/api/bots/constants";
import { createTRPCRouter, dealerProcedure } from "~/server/api/trpc";
import {
  contacts,
  gameEvents,
  games,
  ledgerAccounts,
  users,
} from "~/server/db/schema";

const consentSelection = {
  recordingConsent: users.recordingConsent,
  recordingConsentUpdatedAt: users.recordingConsentUpdatedAt,
  socialMediaConsent: users.socialMediaConsent,
  socialMediaConsentUpdatedAt: users.socialMediaConsentUpdatedAt,
};

const paginationInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

export const dashboardRouter = createTRPCRouter({
  listContacts: dealerProcedure
    .input(paginationInput)
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.pageSize;

      const [rows, countRows] = await Promise.all([
        ctx.db
          .select({
            userId: contacts.userId,
            name: users.name,
            displayName: users.displayName,
            email: users.email,
            phone: contacts.phone,
            instagram: contacts.instagram,
            preferredContact: contacts.preferredContact,
            updatedAt: sql<string>`coalesce(${contacts.updatedAt}, ${contacts.createdAt})`,
          })
          .from(contacts)
          .innerJoin(users, eq(users.id, contacts.userId))
          .orderBy(desc(sql`coalesce(${contacts.updatedAt}, ${contacts.createdAt})`))
          .limit(input.pageSize)
          .offset(offset),
        ctx.db.select({ count: sql<number>`count(*)::int` }).from(contacts),
      ]);

      return {
        rows,
        totalCount: countRows[0]?.count ?? 0,
      };
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
            ...consentSelection,
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
    .input(
      z.object({
        userId: z.string().min(1),
        kind: z.enum(["recording", "socialMedia"]),
        value: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [valueColumn, updatedAtColumn] =
        input.kind === "recording"
          ? (["recordingConsent", "recordingConsentUpdatedAt"] as const)
          : (["socialMediaConsent", "socialMediaConsentUpdatedAt"] as const);

      await ctx.db
        .update(users)
        .set({ [valueColumn]: input.value, [updatedAtColumn]: new Date() })
        .where(
          and(
            eq(users.id, input.userId),
            eq(users.role, "player"),
            sql`${users[valueColumn]} is distinct from ${input.value}::boolean`,
          ),
        );

      const [row] = await ctx.db
        .select({ id: users.id, ...consentSelection })
        .from(users)
        .where(and(eq(users.id, input.userId), eq(users.role, "player")));
      if (!row) throw new Error("Player not found");
      return row;
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
