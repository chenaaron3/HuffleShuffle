import { eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";

export const userRouter = createTRPCRouter({
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
