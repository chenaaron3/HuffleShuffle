import type { DefaultSession, NextAuthConfig } from "next-auth";
import GoogleProvider from 'next-auth/providers/google';
import { db } from '~/server/db';
import { accounts, sessions, users, verificationTokens } from '~/server/db/schema';

import { DrizzleAdapter } from '@auth/drizzle-adapter';

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: "player" | "dealer";
      displayName: string;
    } & DefaultSession["user"];
  }
}

/** Drizzle `users` row shape; callback `user` is AdapterUser but loads from our table. */
type SessionCallbackUser = {
  id: string;
  role: "player" | "dealer";
  displayName: string;
};

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: [
    GoogleProvider,
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  callbacks: {
    session: ({ session, user }) => {
      const u = user as unknown as SessionCallbackUser;
      return {
        ...session,
        user: {
          ...session.user,
          id: u.id,
          role: u.role,
          displayName: u.displayName,
        },
      };
    },
  },
} satisfies NextAuthConfig;
