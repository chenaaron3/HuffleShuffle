"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activeCountOf = exports.allActiveBetsEqual = exports.fetchOrderedSeats = exports.rotateToNextActiveSeatId = exports.pickNextIndex = void 0;
exports.mergeBetsIntoPotGeneric = mergeBetsIntoPotGeneric;
exports.ensureHoleCardsProgression = ensureHoleCardsProgression;
exports.ensurePostflopProgression = ensurePostflopProgression;
exports.evaluateBettingTransition = evaluateBettingTransition;
exports.dealCard = dealCard;
const drizzle_orm_1 = require("drizzle-orm");
const node_module_1 = require("node:module");
const db_1 = require("~/server/db");
const schema_1 = require("~/server/db/schema");
const requireCjs = (0, node_module_1.createRequire)(import.meta.url);
const Hand = requireCjs("pokersolver").Hand;
// --- Helper utilities ---
const pickNextIndex = (currentIndex, total) => (currentIndex + 1) % total;
exports.pickNextIndex = pickNextIndex;
const rotateToNextActiveSeatId = (orderedSeats, currentSeatId) => {
    const n = orderedSeats.length;
    const mapIndex = {};
    orderedSeats.forEach((s, i) => {
        mapIndex[s.id] = i;
    });
    let idx = mapIndex[currentSeatId] ?? 0;
    for (let i = 0; i < n; i++) {
        idx = (0, exports.pickNextIndex)(idx, n);
        if (orderedSeats[idx].isActive)
            return orderedSeats[idx].id;
    }
    return orderedSeats[idx].id;
};
exports.rotateToNextActiveSeatId = rotateToNextActiveSeatId;
const fetchOrderedSeats = async (tx, tableId) => {
    return await tx.query.seats.findMany({
        where: (0, drizzle_orm_1.eq)(schema_1.seats.tableId, tableId),
        orderBy: (s, { asc }) => [asc(s.seatNumber)],
    });
};
exports.fetchOrderedSeats = fetchOrderedSeats;
const allActiveBetsEqual = (orderedSeats) => {
    const active = orderedSeats.filter((s) => s.isActive);
    if (active.length === 0)
        return true;
    return active.every((s) => s.currentBet === active[0].currentBet);
};
exports.allActiveBetsEqual = allActiveBetsEqual;
const activeCountOf = (orderedSeats) => orderedSeats.filter((s) => s.isActive).length;
exports.activeCountOf = activeCountOf;
async function mergeBetsIntoPotGeneric(tx, gameObj, orderedSeats) {
    const total = orderedSeats.reduce((sum, s) => sum + s.currentBet, 0);
    await tx
        .update(schema_1.games)
        .set({
        potTotal: (0, drizzle_orm_1.sql) `${schema_1.games.potTotal} + ${total}`,
        betCount: 0,
        requiredBetCount: 0,
    })
        .where((0, drizzle_orm_1.eq)(schema_1.games.id, gameObj.id));
    for (const s of orderedSeats) {
        await tx.update(schema_1.seats).set({ currentBet: 0 }).where((0, drizzle_orm_1.eq)(schema_1.seats.id, s.id));
        s.currentBet = 0;
    }
    return {
        ...gameObj,
        potTotal: gameObj.potTotal + total,
        betCount: 0,
        requiredBetCount: 0,
    };
}
async function ensureHoleCardsProgression(tx, tableId, gameObj, currentSeatId, dealerButtonSeatId, n) {
    const freshSeats = await (0, exports.fetchOrderedSeats)(tx, tableId);
    const allHaveTwo = freshSeats.every((s) => s.cards.length >= 2);
    if (!allHaveTwo) {
        const nextSeatId = (0, exports.rotateToNextActiveSeatId)(freshSeats, currentSeatId);
        await tx
            .update(schema_1.games)
            .set({ assignedSeatId: nextSeatId })
            .where((0, drizzle_orm_1.eq)(schema_1.games.id, gameObj.id));
        return { ...gameObj, assignedSeatId: nextSeatId };
    }
    // Initialize betting round: preflop first actor is left of big blind
    const dealerIdx = freshSeats.findIndex((s) => s.id === dealerButtonSeatId);
    const bigBlindIdx = (dealerIdx + 2) % n;
    const firstToAct = freshSeats[(bigBlindIdx + 1) % n];
    const activeCount = (0, exports.activeCountOf)(freshSeats);
    await tx
        .update(schema_1.games)
        .set({
        state: "BETTING",
        assignedSeatId: firstToAct.id,
        betCount: 0,
        requiredBetCount: activeCount,
    })
        .where((0, drizzle_orm_1.eq)(schema_1.games.id, gameObj.id));
    return {
        ...gameObj,
        state: "BETTING",
        assignedSeatId: firstToAct.id,
        betCount: 0,
        requiredBetCount: activeCount,
    };
}
async function ensurePostflopProgression(tx, tableId, gameObj, dealerButtonSeatId, n) {
    const freshSeats = await (0, exports.fetchOrderedSeats)(tx, tableId);
    // Postflop: start left of dealer button
    const dealerIdx = freshSeats.findIndex((s) => s.id === dealerButtonSeatId);
    const firstToAct = freshSeats[(dealerIdx + 1) % n];
    const activeCount = (0, exports.activeCountOf)(freshSeats);
    await tx
        .update(schema_1.games)
        .set({
        state: "BETTING",
        assignedSeatId: firstToAct.id,
        betCount: 0,
        requiredBetCount: activeCount,
    })
        .where((0, drizzle_orm_1.eq)(schema_1.games.id, gameObj.id));
}
async function evaluateBettingTransition(tx, tableId, gameObj) {
    const freshSeats = await (0, exports.fetchOrderedSeats)(tx, tableId);
    const activeSeats = freshSeats.filter((s) => s.isActive);
    const singleActive = activeSeats.length === 1;
    const allEqual = (0, exports.allActiveBetsEqual)(freshSeats);
    const finished = (gameObj.betCount >= gameObj.requiredBetCount && allEqual) || singleActive;
    if (!finished)
        return;
    // Merge bets into pot
    const updatedGame = await mergeBetsIntoPotGeneric(tx, gameObj, freshSeats);
    const cc = updatedGame.communityCards.length;
    if (singleActive || cc === 5) {
        // SHOWDOWN
        const contenders = freshSeats.filter((s) => s.isActive);
        const hands = contenders.map((s) => Hand.solve([...s.cards, ...updatedGame.communityCards]));
        const winners = Hand.winners(hands);
        const winnerSeatIds = winners.map((w) => {
            const idx = hands.indexOf(w);
            return contenders[idx].id;
        });
        const share = Math.floor(updatedGame.potTotal / winnerSeatIds.length);
        for (const sid of winnerSeatIds) {
            await tx
                .update(schema_1.seats)
                .set({ buyIn: (0, drizzle_orm_1.sql) `${schema_1.seats.buyIn} + ${share}` })
                .where((0, drizzle_orm_1.eq)(schema_1.seats.id, sid));
        }
        await tx
            .update(schema_1.games)
            .set({ state: "SHOWDOWN" })
            .where((0, drizzle_orm_1.eq)(schema_1.games.id, updatedGame.id));
        return;
    }
    if (cc === 0) {
        await tx
            .update(schema_1.games)
            .set({ state: "DEAL_FLOP" })
            .where((0, drizzle_orm_1.eq)(schema_1.games.id, updatedGame.id));
    }
    if (cc === 3) {
        await tx
            .update(schema_1.games)
            .set({ state: "DEAL_TURN" })
            .where((0, drizzle_orm_1.eq)(schema_1.games.id, updatedGame.id));
    }
    if (cc === 4) {
        await tx
            .update(schema_1.games)
            .set({ state: "DEAL_RIVER" })
            .where((0, drizzle_orm_1.eq)(schema_1.games.id, updatedGame.id));
    }
}
// Card dealing logic that can be shared between consumer and table router
async function dealCard(tx, tableId, game, cardCode) {
    const orderedSeats = await (0, exports.fetchOrderedSeats)(tx, tableId);
    // Check if card already dealt
    const seen = new Set();
    orderedSeats.forEach((s) => s.cards.forEach((c) => seen.add(c)));
    (game.communityCards ?? []).forEach((c) => seen.add(c));
    if (seen.has(cardCode))
        throw new Error("Card already dealt");
    const n = orderedSeats.length;
    if (game.state === "DEAL_HOLE_CARDS") {
        const seat = orderedSeats.find((s) => s.id === game.assignedSeatId);
        await tx
            .update(schema_1.seats)
            .set({ cards: (0, drizzle_orm_1.sql) `array_append(${schema_1.seats.cards}, ${cardCode})` })
            .where((0, drizzle_orm_1.eq)(schema_1.seats.id, seat.id));
        await ensureHoleCardsProgression(tx, tableId, game, seat.id, game.dealerButtonSeatId, n);
        return;
    }
    if (game.state === "DEAL_FLOP" ||
        game.state === "DEAL_TURN" ||
        game.state === "DEAL_RIVER") {
        const results = await tx
            .update(schema_1.games)
            .set({
            communityCards: (0, drizzle_orm_1.sql) `array_append(${schema_1.games.communityCards}, ${cardCode})`,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.games.id, game.id))
            .returning();
        const updatedGame = results?.[0];
        if (!updatedGame)
            throw new Error("Failed to update game");
        const cc = updatedGame.communityCards.length;
        if ((updatedGame.state === "DEAL_FLOP" && cc >= 3) ||
            (updatedGame.state === "DEAL_TURN" && cc >= 4) ||
            (updatedGame.state === "DEAL_RIVER" && cc >= 5)) {
            await ensurePostflopProgression(tx, tableId, updatedGame, updatedGame.dealerButtonSeatId, n);
        }
        return;
    }
    throw new Error("DEAL_CARD not valid in current state");
}
