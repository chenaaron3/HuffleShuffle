import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { contactMethodEnum, contacts, users } from "~/server/db/schema";

export const CONTACT_METHODS = contactMethodEnum.enumValues;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

export const PREFERRED_FIELD_REQUIRED_ERROR =
  "Fill in your preferred contact before saving.";

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export function normalizeInstagram(raw: string): string {
  return raw.trim().replace(/^@+/, "");
}

const phoneSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) return true;
    const digits = value.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  }, "Enter a valid phone number");

const instagramSchema = z
  .string()
  .trim()
  .max(255)
  .refine(
    (value) => !value || /^@*[A-Za-z0-9._]{1,30}$/.test(value),
    "Enter a valid Instagram username",
  );

export const contactRouter = createTRPCRouter({
  /** The signed-in user's contact info; `contact` is null until they save it. */
  get: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({
        email: users.email,
        phone: contacts.phone,
        instagram: contacts.instagram,
        preferredContact: contacts.preferredContact,
      })
      .from(users)
      .leftJoin(contacts, eq(contacts.userId, users.id))
      .where(eq(users.id, ctx.session.user.id))
      .limit(1);

    return {
      email: row?.email ?? "",
      contact: row?.preferredContact
        ? {
            phone: row.phone,
            instagram: row.instagram,
            preferredContact: row.preferredContact,
          }
        : null,
    };
  }),

  save: protectedProcedure
    .input(
      z.object({
        phone: phoneSchema.optional(),
        instagram: instagramSchema.optional(),
        preferredContact: z.enum(CONTACT_METHODS),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const phone = input.phone ? normalizePhone(input.phone) : null;
      const instagram = input.instagram
        ? normalizeInstagram(input.instagram)
        : null;

      if (
        (input.preferredContact === "phone" && !phone) ||
        (input.preferredContact === "instagram" && !instagram)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: PREFERRED_FIELD_REQUIRED_ERROR,
        });
      }

      const values = {
        phone,
        instagram,
        preferredContact: input.preferredContact,
      };
      await ctx.db
        .insert(contacts)
        .values({ userId: ctx.session.user.id, ...values })
        .onConflictDoUpdate({
          target: contacts.userId,
          set: { ...values, updatedAt: new Date() },
        });

      return values;
    }),
});
