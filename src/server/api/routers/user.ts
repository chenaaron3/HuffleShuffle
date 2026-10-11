import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getCommittedTableId } from "~/server/api/table/membership";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";

const consentColumns = {
  recordingConsent: true,
  socialMediaConsent: true,
} as const;

export const userRouter = createTRPCRouter({
  checkExistingSeat: protectedProcedure.query(async ({ ctx }) => {
    const tableId = await getCommittedTableId(
      ctx.session.user.id,
      ctx.session.user.role,
    );
    if (!tableId) {
      return { hasSeat: false };
    }
    return { hasSeat: true, tableId };
  }),

  updateDisplayName: protectedProcedure
    .input(
      z.object({
        displayName: z
          .string()
          .max(255)
          .transform((s) => s.trim())
          .refine((s) => s.length > 0, "Display name is required"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db
        .update(users)
        .set({ displayName: input.displayName })
        .where(eq(users.id, ctx.session.user.id));
      return { displayName: input.displayName } as const;
    }),

  getConsent: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.session.user.id),
      columns: consentColumns,
    });
    return {
      recordingConsent: user?.recordingConsent ?? false,
      socialMediaConsent: user?.socialMediaConsent ?? null,
    };
  }),

  /**
   * First-time consent from the join dialog: agrees to recording and records the
   * social media choice. Once recording consent is given, later changes go
   * through an admin via the dashboard, so repeat calls are no-ops.
   */
  submitConsent: protectedProcedure
    .input(z.object({ socialMediaConsent: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      await db
        .update(users)
        .set({
          recordingConsent: true,
          recordingConsentUpdatedAt: now,
          socialMediaConsent: input.socialMediaConsent,
          socialMediaConsentUpdatedAt: sql`case when ${users.socialMediaConsent} is distinct from ${input.socialMediaConsent}::boolean then ${now.toISOString()}::timestamptz else ${users.socialMediaConsentUpdatedAt} end`,
        })
        .where(
          and(
            eq(users.id, ctx.session.user.id),
            eq(users.recordingConsent, false),
          ),
        );
      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.session.user.id),
        columns: consentColumns,
      });
      return {
        recordingConsent: user?.recordingConsent ?? false,
        socialMediaConsent: user?.socialMediaConsent ?? null,
      };
    }),
});
