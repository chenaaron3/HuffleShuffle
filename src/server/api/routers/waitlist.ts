import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { waitlist } from "~/server/db/schema";

export const waitlistRouter = createTRPCRouter({
  join: publicProcedure
    .input(z.object({ email: z.string().email().max(255) }))
    .mutation(async ({ ctx, input }) => {
      const email = input.email.trim().toLowerCase();

      await ctx.db
        .insert(waitlist)
        .values({ email })
        .onConflictDoNothing({ target: waitlist.email });

      return { success: true } as const;
    }),
});
