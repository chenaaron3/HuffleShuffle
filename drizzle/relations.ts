import { relations } from "drizzle-orm/relations";
import { huffleShufflePokerTable, huffleShuffleSeat, huffleShuffleUser, huffleShuffleGame, huffleShuffleSession, huffleShuffleAccount } from "./schema";

export const huffleShuffleSeatRelations = relations(huffleShuffleSeat, ({one, many}) => ({
	huffleShufflePokerTable: one(huffleShufflePokerTable, {
		fields: [huffleShuffleSeat.tableId],
		references: [huffleShufflePokerTable.id]
	}),
	huffleShuffleUser: one(huffleShuffleUser, {
		fields: [huffleShuffleSeat.playerId],
		references: [huffleShuffleUser.id]
	}),
	huffleShuffleGames: many(huffleShuffleGame),
}));

export const huffleShufflePokerTableRelations = relations(huffleShufflePokerTable, ({one, many}) => ({
	huffleShuffleSeats: many(huffleShuffleSeat),
	huffleShuffleUser: one(huffleShuffleUser, {
		fields: [huffleShufflePokerTable.dealerId],
		references: [huffleShuffleUser.id]
	}),
	huffleShuffleGames: many(huffleShuffleGame),
}));

export const huffleShuffleUserRelations = relations(huffleShuffleUser, ({many}) => ({
	huffleShuffleSeats: many(huffleShuffleSeat),
	huffleShufflePokerTables: many(huffleShufflePokerTable),
	huffleShuffleSessions: many(huffleShuffleSession),
	huffleShuffleAccounts: many(huffleShuffleAccount),
}));

export const huffleShuffleGameRelations = relations(huffleShuffleGame, ({one}) => ({
	huffleShufflePokerTable: one(huffleShufflePokerTable, {
		fields: [huffleShuffleGame.tableId],
		references: [huffleShufflePokerTable.id]
	}),
	huffleShuffleSeat: one(huffleShuffleSeat, {
		fields: [huffleShuffleGame.assignedSeatId],
		references: [huffleShuffleSeat.id]
	}),
}));

export const huffleShuffleSessionRelations = relations(huffleShuffleSession, ({one}) => ({
	huffleShuffleUser: one(huffleShuffleUser, {
		fields: [huffleShuffleSession.userId],
		references: [huffleShuffleUser.id]
	}),
}));

export const huffleShuffleAccountRelations = relations(huffleShuffleAccount, ({one}) => ({
	huffleShuffleUser: one(huffleShuffleUser, {
		fields: [huffleShuffleAccount.userId],
		references: [huffleShuffleUser.id]
	}),
}));