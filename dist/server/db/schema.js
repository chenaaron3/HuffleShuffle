"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.piDevices = exports.piDeviceTypeEnum = exports.gamesRelations = exports.seatsRelations = exports.pokerTablesRelations = exports.games = exports.gameStateEnum = exports.gameStatusEnum = exports.seats = exports.pokerTables = exports.verificationTokens = exports.sessionsRelations = exports.sessions = exports.accountsRelations = exports.accounts = exports.usersRelations = exports.users = exports.posts = exports.userRoleEnum = exports.createTable = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
exports.createTable = (0, pg_core_1.pgTableCreator)((name) => `huffle-shuffle_${name}`);
// User role enum
exports.userRoleEnum = (0, pg_core_1.pgEnum)("user_role", ["player", "dealer"]);
exports.posts = (0, exports.createTable)("post", (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 256 }),
    createdById: d
        .varchar({ length: 255 })
        .notNull()
        .references(() => exports.users.id),
    createdAt: d
        .timestamp({ withTimezone: true })
        .default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
}), (t) => [
    (0, pg_core_1.index)("created_by_idx").on(t.createdById),
    (0, pg_core_1.index)("name_idx").on(t.name),
]);
exports.users = (0, exports.createTable)("user", (d) => ({
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
        .default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
    image: d.varchar({ length: 255 }),
    role: (0, exports.userRoleEnum)("role").notNull().default("player"),
    balance: d.integer().notNull().default(0),
    publicKey: d.text(),
}), (t) => [(0, pg_core_1.check)("user_balance_non_negative", (0, drizzle_orm_1.sql) `${t.balance} >= 0`)]);
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, ({ many }) => ({
    accounts: many(exports.accounts),
}));
exports.accounts = (0, exports.createTable)("account", (d) => ({
    userId: d
        .varchar({ length: 255 })
        .notNull()
        .references(() => exports.users.id),
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
    (0, pg_core_1.primaryKey)({ columns: [t.provider, t.providerAccountId] }),
    (0, pg_core_1.index)("account_user_id_idx").on(t.userId),
]);
exports.accountsRelations = (0, drizzle_orm_1.relations)(exports.accounts, ({ one }) => ({
    user: one(exports.users, { fields: [exports.accounts.userId], references: [exports.users.id] }),
}));
exports.sessions = (0, exports.createTable)("session", (d) => ({
    sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
    userId: d
        .varchar({ length: 255 })
        .notNull()
        .references(() => exports.users.id),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
}), (t) => [(0, pg_core_1.index)("t_user_id_idx").on(t.userId)]);
exports.sessionsRelations = (0, drizzle_orm_1.relations)(exports.sessions, ({ one }) => ({
    user: one(exports.users, { fields: [exports.sessions.userId], references: [exports.users.id] }),
}));
exports.verificationTokens = (0, exports.createTable)("verification_token", (d) => ({
    identifier: d.varchar({ length: 255 }).notNull(),
    token: d.varchar({ length: 255 }).notNull(),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
}), (t) => [(0, pg_core_1.primaryKey)({ columns: [t.identifier, t.token] })]);
// Poker table entity
exports.pokerTables = (0, exports.createTable)("poker_table", (d) => ({
    id: d
        .varchar({ length: 255 })
        .notNull()
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    name: d.varchar({ length: 255 }).notNull(),
    dealerId: d
        .varchar({ length: 255 })
        .notNull()
        .references(() => exports.users.id),
    smallBlind: d.integer().notNull(),
    bigBlind: d.integer().notNull(),
    createdAt: d
        .timestamp({ withTimezone: true })
        .default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
}), (t) => [
    (0, pg_core_1.uniqueIndex)("poker_table_dealer_id_unique").on(t.dealerId),
    (0, pg_core_1.index)("poker_table_name_idx").on(t.name),
]);
// Seats (created on-demand; must have a player)
exports.seats = (0, exports.createTable)("seat", (d) => ({
    id: d
        .varchar({ length: 255 })
        .notNull()
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    tableId: d
        .varchar({ length: 255 })
        .notNull()
        .references(() => exports.pokerTables.id),
    playerId: d
        .varchar({ length: 255 })
        .notNull()
        .references(() => exports.users.id),
    seatNumber: d.integer().notNull(), // 0..7 inclusive
    buyIn: d.integer().notNull().default(0),
    currentBet: d.integer().notNull().default(0),
    cards: d
        .text()
        .array()
        .notNull()
        .default((0, drizzle_orm_1.sql) `ARRAY[]::text[]`),
    isActive: d.boolean().notNull().default(true),
    encryptedUserNonce: d.text(),
    encryptedPiNonce: d.text(),
    createdAt: d
        .timestamp({ withTimezone: true })
        .default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
}), (t) => [
    (0, pg_core_1.uniqueIndex)("seat_table_number_unique").on(t.tableId, t.seatNumber),
    (0, pg_core_1.uniqueIndex)("seat_player_unique").on(t.playerId), // player can be in only one table at a time
    (0, pg_core_1.index)("seat_table_id_idx").on(t.tableId),
    (0, pg_core_1.check)("seat_number_range", (0, drizzle_orm_1.sql) `${t.seatNumber} >= 0 AND ${t.seatNumber} <= 7`),
]);
// Game entity
exports.gameStatusEnum = (0, pg_core_1.pgEnum)("game_status", [
    "pending",
    "active",
    "completed",
]);
exports.gameStateEnum = (0, pg_core_1.pgEnum)("game_state", [
    "DEAL_HOLE_CARDS",
    "BETTING",
    "DEAL_FLOP",
    "DEAL_TURN",
    "DEAL_RIVER",
    "SHOWDOWN",
    "RESET_TABLE",
]);
exports.games = (0, exports.createTable)("game", (d) => ({
    id: d
        .varchar({ length: 255 })
        .notNull()
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    tableId: d
        .varchar({ length: 255 })
        .notNull()
        .references(() => exports.pokerTables.id),
    status: (0, exports.gameStatusEnum)("status").notNull().default("pending"),
    state: (0, exports.gameStateEnum)("state").notNull().default("DEAL_HOLE_CARDS"),
    dealerButtonSeatId: d.varchar({ length: 255 }).references(() => exports.seats.id),
    assignedSeatId: d.varchar({ length: 255 }).references(() => exports.seats.id),
    communityCards: d
        .text()
        .array()
        .notNull()
        .default((0, drizzle_orm_1.sql) `ARRAY[]::text[]`),
    potTotal: d.integer().notNull().default(0),
    betCount: d.integer().notNull().default(0),
    requiredBetCount: d.integer().notNull().default(0),
    createdAt: d
        .timestamp({ withTimezone: true })
        .default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
}), (t) => [
    (0, pg_core_1.index)("game_table_id_idx").on(t.tableId),
    (0, pg_core_1.index)("game_dealer_button_seat_id_idx").on(t.dealerButtonSeatId),
    (0, pg_core_1.index)("game_assigned_seat_id_idx").on(t.assignedSeatId),
]);
// Relations
exports.pokerTablesRelations = (0, drizzle_orm_1.relations)(exports.pokerTables, ({ one, many }) => ({
    dealer: one(exports.users, {
        fields: [exports.pokerTables.dealerId],
        references: [exports.users.id],
    }),
    seats: many(exports.seats),
    games: many(exports.games),
}));
exports.seatsRelations = (0, drizzle_orm_1.relations)(exports.seats, ({ one }) => ({
    table: one(exports.pokerTables, {
        fields: [exports.seats.tableId],
        references: [exports.pokerTables.id],
    }),
    player: one(exports.users, { fields: [exports.seats.playerId], references: [exports.users.id] }),
}));
exports.gamesRelations = (0, drizzle_orm_1.relations)(exports.games, ({ one }) => ({
    table: one(exports.pokerTables, {
        fields: [exports.games.tableId],
        references: [exports.pokerTables.id],
    }),
    dealerButtonSeat: one(exports.seats, {
        fields: [exports.games.dealerButtonSeatId],
        references: [exports.seats.id],
    }),
}));
// Pi device type enum
exports.piDeviceTypeEnum = (0, pg_core_1.pgEnum)("pi_device_type", [
    "scanner",
    "dealer",
    "card",
    "button",
]);
// Raspberry Pi device registry
exports.piDevices = (0, exports.createTable)("pi_device", (d) => ({
    serial: d.varchar({ length: 128 }).primaryKey(),
    tableId: d
        .varchar({ length: 255 })
        .notNull()
        .references(() => exports.pokerTables.id),
    type: (0, exports.piDeviceTypeEnum)("type").notNull(),
    seatNumber: d.integer(),
    publicKey: d.text(),
    lastSeenAt: d
        .timestamp({ withTimezone: true })
        .default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`)
        .notNull(),
}), (t) => [(0, pg_core_1.index)("pi_device_table_id_idx").on(t.tableId)]);
