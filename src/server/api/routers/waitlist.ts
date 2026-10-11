import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { waitlist } from "~/server/db/schema";
import { TURNSTILE_ACTIONS, verifyTurnstileToken } from "~/server/turnstile";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function normalizeInstagram(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^@+/, "");
}

const optionalPhoneSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) return true;
    const digits = value.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  }, "Enter a valid phone number");

export const waitlistRouter = createTRPCRouter({
  join: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(1, "Name is required").max(255),
        email: z.string().email().max(255),
        phone: optionalPhoneSchema.optional(),
        instagram: z.string().trim().max(255).optional(),
        captchaToken: z.string().max(2048).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const captchaOk = await verifyTurnstileToken(
        input.captchaToken,
        TURNSTILE_ACTIONS.waitlist,
        ctx.clientIp,
      );
      if (!captchaOk) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Captcha verification failed. Please try again.",
        });
      }

      const email = input.email.trim().toLowerCase();
      const phoneRaw = input.phone?.trim();
      const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
      const instagram = normalizeInstagram(input.instagram);

      await ctx.db
        .insert(waitlist)
        .values({
          name: input.name.trim(),
          email,
          phone,
          instagram,
        })
        .onConflictDoNothing({ target: waitlist.email });

      return { success: true } as const;
    }),
});
