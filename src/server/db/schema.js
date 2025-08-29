import { relations, sql } from 'drizzle-orm';
import { check, index, pgEnum, pgTableCreator, primaryKey, uniqueIndex } from 'drizzle-orm/pg-core';
/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `huffle-shuffle_${name}`);
// User role enum
export const userRoleEnum = pgEnum("user_role", ["player", "dealer"]);
export const posts = createTable("post", (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 256 }),
    createdById: d
        .varchar({ length: 255 })
        .notNull()
        .references(() => users.id),
    createdAt: d
        .timestamp({ withTimezone: true })
        .default(sql `CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
}), (t) => [
    index("created_by_idx").on(t.createdById),
    index("name_idx").on(t.name),
]);
export const users = createTable("user", (d) => ({
    id: d
        .varchar({ length: 255 })
        .notNull()
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    name: d.varchar({ length: 255 }),
    email: d.varchar({ length: 255 }).notNull(),
    emailVerified: d
        .timestamp({
        mode: "date",
        withTimezone: true,
    })
        .default(sql `CURRENT_TIMESTAMP`),
    image: d.varchar({ length: 255 }),
    role: userRoleEnum("role").notNull().default("player"),
    balance: d.integer().notNull().default(0),
    publicKey: d.text(),
}), (t) => [check("user_balance_non_negative", sql `${t.balance} >= 0`)]);
export const usersRelations = relations(users, ({ many }) => ({
    accounts: many(accounts),
}));
export const accounts = createTable("account", (d) => ({
    userId: d
        .varchar({ length: 255 })
        .notNull()
        .references(() => users.id),
    type: d.varchar({ length: 255 }).$type().notNull(),
    provider: d.varchar({ length: 255 }).notNull(),
    providerAccountId: d.varchar({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.varchar({ length: 255 }),
    scope: d.varchar({ length: 255 }),
    id_token: d.text(),
    session_state: d.varchar({ length: 255 }),
}), (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("account_user_id_idx").on(t.userId),
]);
export const accountsRelations = relations(accounts, ({ one }) => ({
    user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));
export const sessions = createTable("session", (d) => ({
    sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
    userId: d
        .varchar({ length: 255 })
        .notNull()
        .references(() => users.id),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
}), (t) => [index("t_user_id_idx").on(t.userId)]);
export const sessionsRelations = relations(sessions, ({ one }) => ({
    user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));
export const verificationTokens = createTable("verification_token", (d) => ({
    identifier: d.varchar({ length: 255 }).notNull(),
    token: d.varchar({ length: 255 }).notNull(),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
}), (t) => [primaryKey({ columns: [t.identifier, t.token] })]);
// Poker table entity
export const pokerTables = createTable("poker_table", (d) => ({
    id: d
        .varchar({ length: 255 })
        .notNull()
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    name: d.varchar({ length: 255 }).notNull(),
    dealerId: d
        .varchar({ length: 255 })
        .notNull()
        .references(() => users.id),
    smallBlind: d.integer().notNull(),
    bigBlind: d.integer().notNull(),
    createdAt: d
        .timestamp({ withTimezone: true })
        .default(sql `CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
}), (t) => [
    uniqueIndex("poker_table_dealer_id_unique").on(t.dealerId),
    index("poker_table_name_idx").on(t.name),
]);
// Seats (created on-demand; must have a player)
export const seats = createTable("seat", (d) => ({
    id: d
        .varchar({ length: 255 })
        .notNull()
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    tableId: d
        .varchar({ length: 255 })
        .notNull()
        .references(() => pokerTables.id),
    playerId: d
        .varchar({ length: 255 })
        .notNull()
        .references(() => users.id),
    seatNumber: d.integer().notNull(), // 0..7 inclusive
    buyIn: d.integer().notNull().default(0),
    currentBet: d.integer().notNull().default(0),
    cards: d
        .text()
        .array()
        .notNull()
        .default(sql `ARRAY[]::text[]`),
    isActive: d.boolean().notNull().default(true),
    encryptedUserNonce: d.text(),
    encryptedPiNonce: d.text(),
    createdAt: d
        .timestamp({ withTimezone: true })
        .default(sql `CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
}), (t) => [
    uniqueIndex("seat_table_number_unique").on(t.tableId, t.seatNumber),
    uniqueIndex("seat_player_unique").on(t.playerId), // player can be in only one table at a time
    index("seat_table_id_idx").on(t.tableId),
    check("seat_number_range", sql `${t.seatNumber} >= 0 AND ${t.seatNumber} <= 7`),
]);
// Game entity
export const gameStatusEnum = pgEnum("game_status", [
    "pending",
    "active",
    "completed",
]);
export const gameStateEnum = pgEnum("game_state", [
    "DEAL_HOLE_CARDS",
    "BETTING",
    "DEAL_FLOP",
    "DEAL_TURN",
    "DEAL_RIVER",
    "SHOWDOWN",
    "RESET_TABLE",
]);
export const games = createTable("game", (d) => ({
    id: d
        .varchar({ length: 255 })
        .notNull()
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    tableId: d
        .varchar({ length: 255 })
        .notNull()
        .references(() => pokerTables.id),
    status: gameStatusEnum("status").notNull().default("pending"),
    state: gameStateEnum("state").notNull().default("DEAL_HOLE_CARDS"),
    dealerButtonSeatId: d.varchar({ length: 255 }).references(() => seats.id),
    assignedSeatId: d.varchar({ length: 255 }).references(() => seats.id),
    communityCards: d
        .text()
        .array()
        .notNull()
        .default(sql `ARRAY[]::text[]`),
    potTotal: d.integer().notNull().default(0),
    betCount: d.integer().notNull().default(0),
    requiredBetCount: d.integer().notNull().default(0),
    createdAt: d
        .timestamp({ withTimezone: true })
        .default(sql `CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
}), (t) => [
    index("game_table_id_idx").on(t.tableId),
    index("game_dealer_button_seat_id_idx").on(t.dealerButtonSeatId),
    index("game_assigned_seat_id_idx").on(t.assignedSeatId),
]);
// Relations
export const pokerTablesRelations = relations(pokerTables, ({ one, many }) => ({
    dealer: one(users, {
        fields: [pokerTables.dealerId],
        references: [users.id],
    }),
    seats: many(seats),
    games: many(games),
}));
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
export const piDevices = createTable("pi_device", (d) => ({
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
        .default(sql `CURRENT_TIMESTAMP`)
        .notNull(),
}), (t) => [index("pi_device_table_id_idx").on(t.tableId)]);
