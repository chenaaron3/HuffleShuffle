import { relations, sql } from 'drizzle-orm';
import { check, index, pgEnum, pgTableCreator, primaryKey, uniqueIndex } from 'drizzle-orm/pg-core';

import type { AdapterAccount } from "next-auth/adapters";

// Constants
export const MAX_SEATS_PER_TABLE = 8;

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `huffle-shuffle_${name}`);

// User role enum
export const userRoleEnum = pgEnum("user_role", ["player", "dealer"]);

export const users = createTable(
  "user",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: d.varchar({ length: 255 }),
    email: d.varchar({ length: 255 }).notNull(),
    emailVerified: d
      .timestamp({
        mode: "date",
        withTimezone: true,
      })
      .default(sql`CURRENT_TIMESTAMP`),
    image: d.varchar({ length: 255 }),
    role: userRoleEnum("role").notNull().default("player"),
    balance: d.integer().notNull().default(100000),
    publicKey: d.text(),
  }),
  (t) => [check("user_balance_non_negative", sql`${t.balance} >= 0`)],
);

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
}));

export const accounts = createTable(
  "account",
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    type: d.varchar({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: d.varchar({ length: 255 }).notNull(),
    providerAccountId: d.varchar({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.varchar({ length: 255 }),
    scope: d.varchar({ length: 255 }),
    id_token: d.text(),
    session_state: d.varchar({ length: 255 }),
  }),
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("accounts_user_id_idx").on(t.userId),
  ],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  (d) => ({
    sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verification_token",
  (d) => ({
    identifier: d.varchar({ length: 255 }).notNull(),
    token: d.varchar({ length: 255 }).notNull(),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// Poker table entity
export const pokerTables = createTable(
  "poker_table",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: d.varchar({ length: 255 }).notNull(),
    dealerId: d.varchar({ length: 255 }).references(() => users.id),
    smallBlind: d.integer().notNull(),
    bigBlind: d.integer().notNull(),
    blindStepSeconds: d.integer().notNull().default(600),
    blindTimerStartedAt: d.timestamp({ withTimezone: true }),
    maxSeats: d.integer().notNull().default(MAX_SEATS_PER_TABLE),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("poker_table_name_idx").on(t.name),
    index("poker_table_dealer_id_idx").on(t.dealerId),
  ],
);

// Seat status enum for tracking player state
export const seatStatusEnum = pgEnum("seat_status", [
  "active",
  "all-in",
  "folded",
  "eliminated",
]);

// Seats (created on-demand; must have a player)
export const seats = createTable(
  "seat",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tableId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => pokerTables.id),
    playerId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    seatNumber: d.integer().notNull(), // 0..(MAX_SEATS_PER_TABLE-1) inclusive
    buyIn: d.integer().notNull().default(0),
    startingBalance: d.integer().notNull().default(0), // Initial buyIn amount before game starts
    currentBet: d.integer().notNull().default(0),
    cards: d
      .text()
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    seatStatus: seatStatusEnum("seat_status").notNull().default("active"), // 'active' | 'all-in' | 'folded' | 'eliminated'
    encryptedUserNonce: d.text(),
    encryptedPiNonce: d.text(),
    handType: d.text(), // Store poker hand type (e.g., "One Pair", "Straight Flush")
    handDescription: d.text(), // Store detailed hand description
    winAmount: d.integer().default(0), // Amount won in this hand (0 = no win, >0 = winner)
    winningCards: d
      .text()
      .array()
      .default(sql`ARRAY[]::text[]`), // Cards that make up the winning hand
    lastAction: d.varchar({ length: 16 }), // 'RAISE' | 'CALL' | 'CHECK' | 'FOLD' during current betting round
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    uniqueIndex("seat_table_number_unique").on(t.tableId, t.seatNumber),
    uniqueIndex("seat_player_unique").on(t.playerId), // player can be in only one table at a time
    index("seat_table_id_idx").on(t.tableId),
  ],
);

// Game entity

export const gameStateEnum = pgEnum("game_state", [
  "INITIAL", // DEPRECATED
  "GAME_START", // DEPRECATED
  "DEAL_HOLE_CARDS",
  "BETTING",
  "DEAL_FLOP",
  "DEAL_TURN",
  "DEAL_RIVER",
  "SHOWDOWN",
  "RESET_TABLE",
]);

export const games = createTable(
  "game",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tableId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => pokerTables.id),
    isCompleted: d.boolean().notNull().default(false),
    state: gameStateEnum("state").notNull().default("DEAL_HOLE_CARDS"),
    dealerButtonSeatId: d
      .varchar({ length: 255 })
      .references(() => seats.id, { onDelete: "set null" }),
    assignedSeatId: d
      .varchar({ length: 255 })
      .references(() => seats.id, { onDelete: "set null" }),
    turnStartTime: d.timestamp({ withTimezone: true }), // When the current player's turn started (for timer)
    communityCards: d
      .text()
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    potTotal: d.integer().notNull().default(0),
    sidePots: d
      .jsonb()
      .$type<Array<{ amount: number; eligibleSeatIds: string[] }>>()
      .notNull()
      .default(sql`'[]'::jsonb`), // Array of side pots with amount and eligible seat IDs
    betCount: d.integer().notNull().default(0),
    requiredBetCount: d.integer().notNull().default(0),
    effectiveSmallBlind: d.integer().notNull().default(0), // Effective small blind at game start
    effectiveBigBlind: d.integer().notNull().default(0), // Effective big blind at game start
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("game_table_id_idx").on(t.tableId),
    index("game_dealer_button_seat_id_idx").on(t.dealerButtonSeatId),
    index("game_assigned_seat_id_idx").on(t.assignedSeatId),
  ],
);

// --- Game events (append-only log) ---
export const gameEventEnum = pgEnum("game_event_type", [
  "START_GAME",
  "RAISE",
  "CALL",
  "CHECK",
  "FOLD",
  "FLOP",
  "TURN",
  "RIVER",
  "END_GAME",
]);

export const gameEvents = createTable(
  "game_event",
  (d) => ({
    id: d.bigserial({ mode: "number" }).primaryKey(),
    tableId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => pokerTables.id),
    gameId: d.varchar({ length: 255 }).references(() => games.id),
    type: gameEventEnum("type").notNull(),
    details: d
      .jsonb()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: d
      .timestamp({ withTimezone: true })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  }),
  (t) => [
    index("game_event_table_game_order_idx").on(t.tableId, t.gameId, t.id),
  ],
);

// Relations
// (moved below piDevices definition to ensure relation inference has complete context)

export const seatsRelations = relations(seats, ({ one }) => ({
  table: one(pokerTables, {
    fields: [seats.tableId],
    references: [pokerTables.id],
  }),
  player: one(users, { fields: [seats.playerId], references: [users.id] }),
}));

export const gamesRelations = relations(games, ({ one }) => ({
  table: one(pokerTables, {
    fields: [games.tableId],
    references: [pokerTables.id],
  }),
  dealerButtonSeat: one(seats, {
    fields: [games.dealerButtonSeatId],
    references: [seats.id],
  }),
}));

// Pi device type enum
export const piDeviceTypeEnum = pgEnum("pi_device_type", [
  "scanner",
  "dealer",
  "card",
  "button",
]);

// Raspberry Pi device registry
export const piDevices = createTable(
  "pi_device",
  (d) => ({
    serial: d.varchar({ length: 128 }).primaryKey(),
    tableId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => pokerTables.id),
    type: piDeviceTypeEnum("type").notNull(),
    seatNumber: d.integer(),
    publicKey: d.text(),
    lastSeenAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  }),
  (t) => [index("pi_device_table_id_idx").on(t.tableId)],
);

// Relations (now that all tables are declared)
export const pokerTablesRelations = relations(pokerTables, ({ one, many }) => ({
  dealer: one(users, {
    fields: [pokerTables.dealerId],
    references: [users.id],
  }),
  seats: many(seats),
  games: many(games),
  piDevices: many(piDevices),
}));

export const piDevicesRelations = relations(piDevices, ({ one }) => ({
  table: one(pokerTables, {
    fields: [piDevices.tableId],
    references: [pokerTables.id],
  }),
}));
