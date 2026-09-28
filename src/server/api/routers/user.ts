import { eq } from "drizzle-orm";
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
});
