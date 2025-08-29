import { eq, sql } from 'drizzle-orm';
import { createRequire } from 'node:module';
import { games, seats } from '~/server/db/schema';
const requireCjs = createRequire(import.meta.url);
const Hand = requireCjs("pokersolver").Hand;
// --- Helper utilities ---
export const pickNextIndex = (currentIndex, total) => (currentIndex + 1) % total;
export const rotateToNextActiveSeatId = (orderedSeats, currentSeatId) => {
    const n = orderedSeats.length;
    const mapIndex = {};
    orderedSeats.forEach((s, i) => {
        mapIndex[s.id] = i;
    });
    let idx = mapIndex[currentSeatId] ?? 0;
    for (let i = 0; i < n; i++) {
        idx = pickNextIndex(idx, n);
        if (orderedSeats[idx].isActive)
            return orderedSeats[idx].id;
    }
    return orderedSeats[idx].id;
};
export const fetchOrderedSeats = async (tx, tableId) => {
    return await tx.query.seats.findMany({
        where: eq(seats.tableId, tableId),
        orderBy: (s, { asc }) => [asc(s.seatNumber)],
    });
};
export const allActiveBetsEqual = (orderedSeats) => {
    const active = orderedSeats.filter((s) => s.isActive);
    if (active.length === 0)
        return true;
    return active.every((s) => s.currentBet === active[0].currentBet);
};
export const activeCountOf = (orderedSeats) => orderedSeats.filter((s) => s.isActive).length;
export async function mergeBetsIntoPotGeneric(tx, gameObj, orderedSeats) {
    const total = orderedSeats.reduce((sum, s) => sum + s.currentBet, 0);
    await tx
        .update(games)
        .set({
        potTotal: sql `${games.potTotal} + ${total}`,
        betCount: 0,
        requiredBetCount: 0,
    })
        .where(eq(games.id, gameObj.id));
    for (const s of orderedSeats) {
        await tx.update(seats).set({ currentBet: 0 }).where(eq(seats.id, s.id));
        s.currentBet = 0;
    }
    return {
        ...gameObj,
        potTotal: gameObj.potTotal + total,
        betCount: 0,
        requiredBetCount: 0,
    };
}
export async function ensureHoleCardsProgression(tx, tableId, gameObj, currentSeatId, dealerButtonSeatId, n) {
    const freshSeats = await fetchOrderedSeats(tx, tableId);
    const allHaveTwo = freshSeats.every((s) => s.cards.length >= 2);
    if (!allHaveTwo) {
        const nextSeatId = rotateToNextActiveSeatId(freshSeats, currentSeatId);
        await tx
            .update(games)
            .set({ assignedSeatId: nextSeatId })
            .where(eq(games.id, gameObj.id));
        return { ...gameObj, assignedSeatId: nextSeatId };
    }
    // Initialize betting round: preflop first actor is left of big blind
    const dealerIdx = freshSeats.findIndex((s) => s.id === dealerButtonSeatId);
    const bigBlindIdx = (dealerIdx + 2) % n;
    const firstToAct = freshSeats[(bigBlindIdx + 1) % n];
    const activeCount = activeCountOf(freshSeats);
    await tx
        .update(games)
        .set({
        state: "BETTING",
        assignedSeatId: firstToAct.id,
        betCount: 0,
        requiredBetCount: activeCount,
    })
        .where(eq(games.id, gameObj.id));
    return {
        ...gameObj,
        state: "BETTING",
        assignedSeatId: firstToAct.id,
        betCount: 0,
        requiredBetCount: activeCount,
    };
}
export async function ensurePostflopProgression(tx, tableId, gameObj, dealerButtonSeatId, n) {
    const freshSeats = await fetchOrderedSeats(tx, tableId);
    // Postflop: start left of dealer button
    const dealerIdx = freshSeats.findIndex((s) => s.id === dealerButtonSeatId);
    const firstToAct = freshSeats[(dealerIdx + 1) % n];
    const activeCount = activeCountOf(freshSeats);
    await tx
        .update(games)
        .set({
        state: "BETTING",
        assignedSeatId: firstToAct.id,
        betCount: 0,
        requiredBetCount: activeCount,
    })
        .where(eq(games.id, gameObj.id));
}
export async function evaluateBettingTransition(tx, tableId, gameObj) {
    const freshSeats = await fetchOrderedSeats(tx, tableId);
    const activeSeats = freshSeats.filter((s) => s.isActive);
    const singleActive = activeSeats.length === 1;
    const allEqual = allActiveBetsEqual(freshSeats);
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
                .update(seats)
                .set({ buyIn: sql `${seats.buyIn} + ${share}` })
                .where(eq(seats.id, sid));
        }
        await tx
            .update(games)
            .set({ state: "SHOWDOWN" })
            .where(eq(games.id, updatedGame.id));
        return;
    }
    if (cc === 0) {
        await tx
            .update(games)
            .set({ state: "DEAL_FLOP" })
            .where(eq(games.id, updatedGame.id));
    }
    if (cc === 3) {
        await tx
            .update(games)
            .set({ state: "DEAL_TURN" })
            .where(eq(games.id, updatedGame.id));
    }
    if (cc === 4) {
        await tx
            .update(games)
            .set({ state: "DEAL_RIVER" })
            .where(eq(games.id, updatedGame.id));
    }
}
// Card dealing logic that can be shared between consumer and table router
export async function dealCard(tx, tableId, game, cardCode) {
    const orderedSeats = await fetchOrderedSeats(tx, tableId);
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
            .update(seats)
            .set({ cards: sql `array_append(${seats.cards}, ${cardCode})` })
            .where(eq(seats.id, seat.id));
        await ensureHoleCardsProgression(tx, tableId, game, seat.id, game.dealerButtonSeatId, n);
        return;
    }
    if (game.state === "DEAL_FLOP" ||
        game.state === "DEAL_TURN" ||
        game.state === "DEAL_RIVER") {
        const results = await tx
            .update(games)
            .set({
            communityCards: sql `array_append(${games.communityCards}, ${cardCode})`,
        })
            .where(eq(games.id, game.id))
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
