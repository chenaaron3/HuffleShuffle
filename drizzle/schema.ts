import { sql } from 'drizzle-orm';
import {
    boolean, check, foreignKey, index, integer, pgEnum, pgSequence, pgTable, primaryKey, text,
    timestamp, uniqueIndex, varchar
} from 'drizzle-orm/pg-core';

export const gameState = pgEnum("game_state", [
  "INITIAL",
  "GAME_START",
  "DEAL_HOLE_CARDS",
  "BETTING",
  "DEAL_FLOP",
  "DEAL_TURN",
  "DEAL_RIVER",
  "SHOWDOWN",
  "RESET_TABLE",
]);
export const piDeviceType = pgEnum("pi_device_type", [
  "scanner",
  "dealer",
  "card",
  "button",
]);
export const userRole = pgEnum("user_role", ["player", "dealer"]);

export const podsearchPlaylistIdSeq = pgSequence("podsearch_playlist_id_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const podsearchPostIdSeq = pgSequence("podsearch_post_id_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const podsearchVideoIdSeq = pgSequence("podsearch_video_id_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const podsearchTranscriptIdSeq = pgSequence(
  "podsearch_transcript_id_seq",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const podsearchSearchExecutionIdSeq = pgSequence(
  "podsearch_search_execution_id_seq",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const podsearchTranscriptRequestIdSeq = pgSequence(
  "podsearch_transcript_request_id_seq",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const podsearchChapterSimilarityIdSeq = pgSequence(
  "podsearch_chapter_similarity_id_seq",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const podsearchChapterIdSeq = pgSequence("podsearch_chapter_id_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});

export const huffleShuffleSeat = pgTable(
  "huffle-shuffle_seat",
  {
    id: varchar({ length: 255 }).primaryKey().notNull(),
    tableId: varchar({ length: 255 }).notNull(),
    playerId: varchar({ length: 255 }).notNull(),
    seatNumber: integer().notNull(),
    buyIn: integer().default(0).notNull(),
    currentBet: integer().default(0).notNull(),
    cards: text().array().default(["RAY"]).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: "string" }),
    isActive: boolean().default(true).notNull(),
    encryptedUserNonce: text(),
    encryptedPiNonce: text(),
    handType: text(),
    handDescription: text(),
    winAmount: integer().default(0),
    winningCards: text().array().default(["RAY"]),
    startingBalance: integer().default(0).notNull(),
  },
  (table) => [
    uniqueIndex("seat_player_unique").using(
      "btree",
      table.playerId.asc().nullsLast().op("text_ops"),
    ),
    index("seat_table_id_idx").using(
      "btree",
      table.tableId.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("seat_table_number_unique").using(
      "btree",
      table.tableId.asc().nullsLast().op("text_ops"),
      table.seatNumber.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.tableId],
      foreignColumns: [huffleShufflePokerTable.id],
      name: "huffle-shuffle_seat_tableId_huffle-shuffle_poker_table_id_fk",
    }),
    foreignKey({
      columns: [table.playerId],
      foreignColumns: [huffleShuffleUser.id],
      name: "huffle-shuffle_seat_playerId_huffle-shuffle_user_id_fk",
    }),
  ],
);

export const huffleShuffleGame = pgTable(
  "huffle-shuffle_game",
  {
    id: varchar({ length: 255 }).primaryKey().notNull(),
    tableId: varchar({ length: 255 }).notNull(),
    dealerButtonSeatId: varchar({ length: 255 }),
    communityCards: text().array().default(["RAY"]).notNull(),
    potTotal: integer().default(0).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: "string" }),
    assignedSeatId: varchar({ length: 255 }),
    betCount: integer().default(0).notNull(),
    requiredBetCount: integer().default(0).notNull(),
    isCompleted: boolean().default(false).notNull(),
    state: gameState().default("DEAL_HOLE_CARDS").notNull(),
  },
  (table) => [
    index("game_assigned_seat_id_idx").using(
      "btree",
      table.assignedSeatId.asc().nullsLast().op("text_ops"),
    ),
    index("game_dealer_button_seat_id_idx").using(
      "btree",
      table.dealerButtonSeatId.asc().nullsLast().op("text_ops"),
    ),
    index("game_table_id_idx").using(
      "btree",
      table.tableId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.tableId],
      foreignColumns: [huffleShufflePokerTable.id],
      name: "huffle-shuffle_game_tableId_huffle-shuffle_poker_table_id_fk",
    }),
    foreignKey({
      columns: [table.assignedSeatId],
      foreignColumns: [huffleShuffleSeat.id],
      name: "huffle-shuffle_game_assignedSeatId_huffle-shuffle_seat_id_fk",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.dealerButtonSeatId],
      foreignColumns: [huffleShuffleSeat.id],
      name: "huffle-shuffle_game_dealerButtonSeatId_huffle-shuffle_seat_id_f",
    }),
  ],
);

export const huffleShufflePokerTable = pgTable(
  "huffle-shuffle_poker_table",
  {
    id: varchar({ length: 255 }).primaryKey().notNull(),
    name: varchar({ length: 255 }).notNull(),
    dealerId: varchar({ length: 255 }).notNull(),
    smallBlind: integer().notNull(),
    bigBlind: integer().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: "string" }),
    maxSeats: integer().default(8).notNull(),
  },
  (table) => [
    uniqueIndex("poker_table_dealer_id_unique").using(
      "btree",
      table.dealerId.asc().nullsLast().op("text_ops"),
    ),
    index("poker_table_name_idx").using(
      "btree",
      table.name.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.dealerId],
      foreignColumns: [huffleShuffleUser.id],
      name: "huffle-shuffle_poker_table_dealerId_huffle-shuffle_user_id_fk",
    }),
  ],
);

export const huffleShuffleUser = pgTable(
  "huffle-shuffle_user",
  {
    id: varchar({ length: 255 }).primaryKey().notNull(),
    name: varchar({ length: 255 }),
    email: varchar({ length: 255 }).notNull(),
    emailVerified: timestamp({ withTimezone: true, mode: "string" }).default(
      sql`CURRENT_TIMESTAMP`,
    ),
    image: varchar({ length: 255 }),
    role: userRole().default("player").notNull(),
    balance: integer().default(0).notNull(),
    publicKey: text(),
  },
  (table) => [check("user_balance_non_negative", sql`balance >= 0`)],
);

export const huffleShuffleSession = pgTable(
  "huffle-shuffle_session",
  {
    sessionToken: varchar({ length: 255 }).primaryKey().notNull(),
    userId: varchar({ length: 255 }).notNull(),
    expires: timestamp({ withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    index("session_user_id_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [huffleShuffleUser.id],
      name: "huffle-shuffle_session_userId_huffle-shuffle_user_id_fk",
    }),
  ],
);

export const huffleShufflePiDevice = pgTable(
  "huffle-shuffle_pi_device",
  {
    serial: varchar({ length: 128 }).primaryKey().notNull(),
    tableId: varchar({ length: 255 }).notNull(),
    type: piDeviceType().notNull(),
    seatNumber: integer(),
    lastSeenAt: timestamp({ withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    publicKey: text(),
  },
  (table) => [
    index("pi_device_table_id_idx").using(
      "btree",
      table.tableId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.tableId],
      foreignColumns: [huffleShufflePokerTable.id],
      name: "huffle-shuffle_pi_device_tableId_huffle-shuffle_poker_table_id_",
    }),
  ],
);

export const huffleShuffleVerificationToken = pgTable(
  "huffle-shuffle_verification_token",
  {
    identifier: varchar({ length: 255 }).notNull(),
    token: varchar({ length: 255 }).notNull(),
    expires: timestamp({ withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.identifier, table.token],
      name: "huffle-shuffle_verification_token_identifier_token_pk",
    }),
  ],
);

export const huffleShuffleAccount = pgTable(
  "huffle-shuffle_account",
  {
    userId: varchar({ length: 255 }).notNull(),
    type: varchar({ length: 255 }).notNull(),
    provider: varchar({ length: 255 }).notNull(),
    providerAccountId: varchar({ length: 255 }).notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    expiresAt: integer("expires_at"),
    tokenType: varchar("token_type", { length: 255 }),
    scope: varchar({ length: 255 }),
    idToken: text("id_token"),
    sessionState: varchar("session_state", { length: 255 }),
  },
  (table) => [
    index("accounts_user_id_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [huffleShuffleUser.id],
      name: "huffle-shuffle_account_userId_huffle-shuffle_user_id_fk",
    }),
    primaryKey({
      columns: [table.provider, table.providerAccountId],
      name: "huffle-shuffle_account_provider_providerAccountId_pk",
    }),
  ],
);
