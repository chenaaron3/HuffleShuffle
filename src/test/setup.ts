import 'dotenv/config';

import { vi } from 'vitest';

// Prevent next-auth from pulling in Next during Vitest runs
vi.mock("next-auth", () => ({
  default: () => ({
    auth: async () => null,
    handlers: {},
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

// Stub NextAuth wrapper exports
vi.mock("~/server/auth", () => ({
  auth: async () => null,
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// Adapter not needed in unit tests
vi.mock("@auth/drizzle-adapter", () => ({
  DrizzleAdapter: () => ({}),
}));
