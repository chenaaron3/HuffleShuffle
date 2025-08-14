import type { NextApiRequest, NextApiResponse } from "next";
import { and, desc, eq, sql } from 'drizzle-orm';
import { createVerify } from 'node:crypto';
import { z } from 'zod';
import { db } from '~/server/db';
import { games, piDevices, seats } from '~/server/db/schema';

const inputSchema = z.object({
  serial: z.string().min(1),
  barcode: z.string().regex(/^[0-9]{4}$/),
  ts: z.string().regex(/^\d+$/),
  signature: z.string().min(1),
});

function parseBarcodeToRankSuit(barcode: string): {
  rank: string;
  suit: string;
} {
  const suitCode = barcode.slice(0, 1);
  const rankCode = barcode.slice(1);
  const suitMap: Record<string, string> = {
    "1": "s",
    "2": "h",
    "3": "c",
    "4": "d",
  };
  const rankMap: Record<string, string> = {
    "010": "A",
    "020": "2",
    "030": "3",
    "040": "4",
    "050": "5",
    "060": "6",
    "070": "7",
    "080": "8",
    "090": "9",
    "100": "T",
    "110": "J",
    "120": "Q",
    "130": "K",
  };
  const suit = suitMap[suitCode];
  const rank = rankMap[rankCode];
  if (!suit || !rank) throw new Error("Invalid barcode");
  return { rank, suit };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  let body: z.infer<typeof inputSchema>;
  try {
    body = inputSchema.parse(req.body);
  } catch (e) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  // Freshness window to prevent replay (30s)
  const now = Math.floor(Date.now() / 1000);
  const tsNum = parseInt(body.ts, 10);
  if (!Number.isFinite(tsNum) || Math.abs(now - tsNum) > 30) {
    return res.status(401).json({ error: "stale timestamp" });
  }

  // Load device and verify type/public key
  const device = await db.query.piDevices.findFirst({
    where: eq(piDevices.serial, body.serial),
  });
  if (!device) return res.status(404).json({ error: "Device not registered" });
  if (device.type !== "scanner")
    return res.status(403).json({ error: "Invalid device type" });
  if (!device.publicKey)
    return res.status(403).json({ error: "Device key missing" });

  const canonical = `${body.serial}|${body.barcode}|${body.ts}`;
  const verify = createVerify("RSA-SHA256");
  verify.update(canonical);
  verify.end();
  const ok = verify.verify(
    device.publicKey,
    Buffer.from(body.signature, "base64"),
  );
  if (!ok) return res.status(401).json({ error: "signature invalid" });

  // Update last seen
  await db
    .update(piDevices)
    .set({ lastSeenAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(piDevices.serial, body.serial));

  // Parse barcode to rank/suit
  let rank: string, suit: string;
  try {
    ({ rank, suit } = parseBarcodeToRankSuit(body.barcode));
  } catch {
    return res.status(400).json({ error: "Invalid barcode" });
  }
  const code = `${rank}${suit}`;

  // Run the same logic as DEAL_CARD with validations, within a transaction
  try {
    await db.transaction(async (tx) => {
      const tableId = device.tableId;
      const game = await tx.query.games.findFirst({
        where: eq(games.tableId, tableId),
        orderBy: (g, { desc }) => [desc(g.createdAt)],
      });
      if (!game) throw new Error("No active game");

      const orderedSeats = await tx.query.seats.findMany({
        where: eq(seats.tableId, tableId),
        orderBy: (s, { asc }) => [asc(s.seatNumber)],
      });

      const seen = new Set<string>();
      orderedSeats.forEach((s) => s.cards.forEach((c) => seen.add(c)));
      (game.communityCards ?? []).forEach((c) => seen.add(c));
      if (seen.has(code)) throw new Error("Card already dealt");

      const n = orderedSeats.length;
      const findSeatById = (id: string) =>
        orderedSeats.find((s) => s.id === id)!;

      if (game.state === "DEAL_HOLE_CARDS") {
        const seat = findSeatById(game.assignedSeatId!);
        await tx
          .update(seats)
          .set({ cards: sql`array_append(${seats.cards}, ${code})` })
          .where(eq(seats.id, seat.id));

        // Import minimal helpers inline to mirror progression
        const fetchOrderedSeats = async () =>
          await tx.query.seats.findMany({
            where: eq(seats.tableId, tableId),
            orderBy: (s, { asc }) => [asc(s.seatNumber)],
          });
        const activeCountOf = (arr: typeof orderedSeats) =>
          arr.filter((s) => s.isActive).length;
        const pickNextIndex = (currentIndex: number, total: number) =>
          (currentIndex + 1) % total;
        const rotateToNextActiveSeatId = (
          arr: typeof orderedSeats,
          currentSeatId: string,
        ) => {
          const n = arr.length;
          const mapIndex: Record<string, number> = {};
          arr.forEach((s, i) => {
            mapIndex[s.id] = i;
          });
          let idx = mapIndex[currentSeatId] ?? 0;
          for (let i = 0; i < n; i++) {
            idx = pickNextIndex(idx, n);
            if (arr[idx]!.isActive) return arr[idx]!.id;
          }
          return arr[idx]!.id;
        };
        const freshSeats = await fetchOrderedSeats();
        const allHaveTwo = freshSeats.every((s) => s.cards.length >= 2);
        if (!allHaveTwo) {
          const nextSeatId = rotateToNextActiveSeatId(freshSeats, seat.id);
          await tx
            .update(games)
            .set({ assignedSeatId: nextSeatId })
            .where(eq(games.id, game.id));
        } else {
          const dealerIdx = freshSeats.findIndex(
            (s) => s.id === game.dealerButtonSeatId,
          );
          const bigBlindIdx = (dealerIdx + 2) % n;
          const firstToAct = freshSeats[(bigBlindIdx + 1) % n]!;
          const activeCount = activeCountOf(freshSeats);
          await tx
            .update(games)
            .set({
              state: "BETTING",
              assignedSeatId: firstToAct.id,
              betCount: 0,
              requiredBetCount: activeCount,
            })
            .where(eq(games.id, game.id));
        }
        return;
      }

      if (
        game.state === "DEAL_FLOP" ||
        game.state === "DEAL_TURN" ||
        game.state === "DEAL_RIVER"
      ) {
        const results = await tx
          .update(games)
          .set({
            communityCards: sql`array_append(${games.communityCards}, ${code})`,
          })
          .where(eq(games.id, game.id))
          .returning();
        const g = results?.[0];
        if (!g) throw new Error("Failed to update game");
        const cc = g.communityCards.length;
        if (
          (g.state === "DEAL_FLOP" && cc >= 3) ||
          (g.state === "DEAL_TURN" && cc >= 4) ||
          (g.state === "DEAL_RIVER" && cc >= 5)
        ) {
          // Start next betting round
          const freshSeats = await tx.query.seats.findMany({
            where: eq(seats.tableId, tableId),
            orderBy: (s, { asc }) => [asc(s.seatNumber)],
          });
          const dealerIdx = freshSeats.findIndex(
            (s) => s.id === g.dealerButtonSeatId,
          );
          const firstToAct = freshSeats[(dealerIdx + 1) % n]!;
          await tx
            .update(games)
            .set({
              state: "BETTING",
              assignedSeatId: firstToAct.id,
              betCount: 0,
              requiredBetCount: freshSeats.filter((s) => s.isActive).length,
            })
            .where(eq(games.id, g.id));
        }
        return;
      }

      throw new Error("DEAL_CARD not valid in current state");
    });
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || "Bad Request" });
  }

  return res.status(200).json({ ok: true });
}
