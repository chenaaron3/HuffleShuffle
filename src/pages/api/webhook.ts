import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq } from 'drizzle-orm';
import { WebhookReceiver } from 'livekit-server-sdk';
import { env } from '~/env';
import { db } from '~/server/db';
import { piDevices, seats } from '~/server/db/schema';
import { pusher } from '~/server/pusher';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req: NextApiRequest): Promise<string> {
  const chunks: Buffer[] = [];
  const iterable = req as unknown as AsyncIterable<Buffer | string>;
  for await (const chunk of iterable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  // Enforce expected content type from LiveKit
  const contentType =
    req.headers["content-type"] || req.headers["Content-Type"];
  if (
    typeof contentType !== "string" ||
    !contentType.startsWith("application/webhook+json")
  ) {
    return res.status(415).end("Unsupported Media Type");
  }

  const receiver = new WebhookReceiver(
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET,
  );
  const authHeader = req.headers["authorization"] as string | undefined;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false });
  }

  let event: Awaited<ReturnType<typeof receiver.receive>>;
  try {
    const raw = await readRawBody(req);
    // Allow minor clock skew (in ms)
    event = await receiver.receive(raw, authHeader, false, 60_000);
  } catch (e) {
    return res.status(401).json({ ok: false });
  }

  const type = String(event.event);
  const tableId = event.room?.name;
  const userId = event.participant?.identity;

  // Only act on valid identities and known tables
  if (!tableId) return res.status(200).json({ ok: true });

  try {
    if (type === "participant_joined") {
      if (!userId) return res.status(200).json({ ok: true });
      // Find the player's seat for this table
      const seat = await db.query.seats.findFirst({
        where: and(eq(seats.tableId, tableId), eq(seats.playerId, userId)),
      });
      if (!seat) return res.status(200).json({ ok: true });

      // Find mapped Pi device by seatNumber
      const pi = await db.query.piDevices.findFirst({
        where: and(
          eq(piDevices.tableId, tableId),
          eq(piDevices.type, "card"),
          eq(piDevices.seatNumber, seat.seatNumber),
        ),
      });
      if (!pi?.serial) return res.status(200).json({ ok: true });

      // Send start-stream only if we have an encrypted nonce
      const client = pusher;
      if (seat.encryptedPiNonce && client) {
        await client.trigger(`device-${pi.serial}`, "start-stream", {
          tableId,
          seatNumber: seat.seatNumber,
          encNonce: seat.encryptedPiNonce,
        });
      }
      return res.status(200).json({ ok: true });
    }

    if (type === "participant_left") {
      if (!userId) return res.status(200).json({ ok: true });
      const seat = await db.query.seats.findFirst({
        where: and(eq(seats.tableId, tableId), eq(seats.playerId, userId)),
      });
      if (!seat) return res.status(200).json({ ok: true });
      const pi = await db.query.piDevices.findFirst({
        where: and(
          eq(piDevices.tableId, tableId),
          eq(piDevices.type, "card"),
          eq(piDevices.seatNumber, seat.seatNumber),
        ),
      });
      const client = pusher;
      if (pi?.serial && client) {
        await client.trigger(`device-${pi.serial}`, "stop-stream", {});
      }
      return res.status(200).json({ ok: true });
    }

    // Stop all streams if room ended/finished
    if (type === "room_finished" || type === "room_ended") {
      const devices = await db.query.piDevices.findMany({
        where: and(eq(piDevices.tableId, tableId), eq(piDevices.type, "card")),
      });
      const client = pusher;
      if (client) {
        await Promise.all(
          devices.map((d) =>
            d.serial
              ? client.trigger(`device-${d.serial}`, "stop-stream", {})
              : Promise.resolve(),
          ),
        );
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
}
