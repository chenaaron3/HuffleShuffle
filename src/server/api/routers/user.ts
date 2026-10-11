import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getCommittedTableId } from "~/server/api/table/membership";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";

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
      columns: { mediaConsent: true, mediaConsentUpdatedAt: true },
    });
    return {
      mediaConsent: user?.mediaConsent ?? false,
      mediaConsentUpdatedAt: user?.mediaConsentUpdatedAt ?? null,
    };
  }),

  /** Players may only opt in; opting out is handled by an admin via the dashboard. */
  optInConsent: protectedProcedure.mutation(async ({ ctx }) => {
    const [updated] = await db
      .update(users)
      .set({ mediaConsent: true, mediaConsentUpdatedAt: new Date() })
      .where(and(eq(users.id, ctx.session.user.id), eq(users.mediaConsent, false)))
      .returning({ mediaConsentUpdatedAt: users.mediaConsentUpdatedAt });
    if (updated) {
      return { mediaConsent: true, mediaConsentUpdatedAt: updated.mediaConsentUpdatedAt };
    }
    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.session.user.id),
      columns: { mediaConsentUpdatedAt: true },
    });
    return { mediaConsent: true, mediaConsentUpdatedAt: user?.mediaConsentUpdatedAt ?? null };
  }),
});
