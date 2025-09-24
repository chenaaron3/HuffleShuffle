import { relations } from "drizzle-orm/relations";
import { huffleShufflePokerTable, huffleShuffleSeat, huffleShuffleUser, huffleShuffleGame, huffleShuffleSession, huffleShufflePiDevice, huffleShuffleAccount } from "./schema";

export const huffleShuffleSeatRelations = relations(huffleShuffleSeat, ({one, many}) => ({
	huffleShufflePokerTable: one(huffleShufflePokerTable, {
		fields: [huffleShuffleSeat.tableId],
		references: [huffleShufflePokerTable.id]
	}),
	huffleShuffleUser: one(huffleShuffleUser, {
		fields: [huffleShuffleSeat.playerId],
		references: [huffleShuffleUser.id]
	}),
	huffleShuffleGames_assignedSeatId: many(huffleShuffleGame, {
		relationName: "huffleShuffleGame_assignedSeatId_huffleShuffleSeat_id"
	}),
	huffleShuffleGames_dealerButtonSeatId: many(huffleShuffleGame, {
		relationName: "huffleShuffleGame_dealerButtonSeatId_huffleShuffleSeat_id"
	}),
}));

export const huffleShufflePokerTableRelations = relations(huffleShufflePokerTable, ({one, many}) => ({
	huffleShuffleSeats: many(huffleShuffleSeat),
	huffleShuffleGames: many(huffleShuffleGame),
	huffleShuffleUser: one(huffleShuffleUser, {
		fields: [huffleShufflePokerTable.dealerId],
		references: [huffleShuffleUser.id]
	}),
	huffleShufflePiDevices: many(huffleShufflePiDevice),
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
	huffleShuffleSeat_assignedSeatId: one(huffleShuffleSeat, {
		fields: [huffleShuffleGame.assignedSeatId],
		references: [huffleShuffleSeat.id],
		relationName: "huffleShuffleGame_assignedSeatId_huffleShuffleSeat_id"
	}),
	huffleShuffleSeat_dealerButtonSeatId: one(huffleShuffleSeat, {
		fields: [huffleShuffleGame.dealerButtonSeatId],
		references: [huffleShuffleSeat.id],
		relationName: "huffleShuffleGame_dealerButtonSeatId_huffleShuffleSeat_id"
	}),
}));

export const huffleShuffleSessionRelations = relations(huffleShuffleSession, ({one}) => ({
	huffleShuffleUser: one(huffleShuffleUser, {
		fields: [huffleShuffleSession.userId],
		references: [huffleShuffleUser.id]
	}),
}));

export const huffleShufflePiDeviceRelations = relations(huffleShufflePiDevice, ({one}) => ({
	huffleShufflePokerTable: one(huffleShufflePokerTable, {
		fields: [huffleShufflePiDevice.tableId],
		references: [huffleShufflePokerTable.id]
	}),
}));

export const huffleShuffleAccountRelations = relations(huffleShuffleAccount, ({one}) => ({
	huffleShuffleUser: one(huffleShuffleUser, {
		fields: [huffleShuffleAccount.userId],
		references: [huffleShuffleUser.id]
	}),
}));