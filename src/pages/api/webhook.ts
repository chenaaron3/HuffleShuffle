import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq } from 'drizzle-orm';
import { WebhookReceiver } from 'livekit-server-sdk';
import { env } from '~/env';
import { db } from '~/server/db';
import { piDevices, seats } from '~/server/db/schema';
import {
    endDealerStream, endHandStream, startDealerStream, startHandStream
} from '~/server/signal';

const receiver = new WebhookReceiver(
  env.LIVEKIT_API_KEY,
  env.LIVEKIT_API_SECRET,
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  let event: Awaited<ReturnType<typeof receiver.receive>>;
  try {
    event = await receiver.receive(
      req.body,
      req.headers.authorization,
      false,
      60_000,
    );
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
      if (seat.encryptedPiNonce) {
        await startHandStream(pi.serial, {
          tableId,
          seatNumber: seat.seatNumber,
          encNonce: seat.encryptedPiNonce,
        });
      }

      // Also signal dealer to start if not already streaming
      const dealer = await db.query.piDevices.findFirst({
        where: and(
          eq(piDevices.tableId, tableId),
          eq(piDevices.type, "dealer"),
        ),
      });
      if (dealer?.serial) {
        await startDealerStream(dealer.serial);
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
      if (pi?.serial) {
        await endHandStream(pi.serial);
      }
      return res.status(200).json({ ok: true });
    }

    // Start dealer camera when room starts
    if (type === "room_started") {
      const device = await db.query.piDevices.findFirst({
        where: and(
          eq(piDevices.tableId, tableId),
          eq(piDevices.type, "dealer"),
        ),
      });
      if (device?.serial) {
        await startDealerStream(device.serial);
      }
      return res.status(200).json({ ok: true });
    }

    // Stop all streams if room finished
    if (type === "room_finished") {
      const devices = await db.query.piDevices.findMany({
        where: and(eq(piDevices.tableId, tableId), eq(piDevices.type, "card")),
      });
      await Promise.all(
        devices.map((d) =>
          d.serial ? endHandStream(d.serial) : Promise.resolve(),
        ),
      );

      // Also stop dealer camera(s)
      const dealer = await db.query.piDevices.findFirst({
        where: and(
          eq(piDevices.tableId, tableId),
          eq(piDevices.type, "dealer"),
        ),
      });
      if (dealer?.serial) {
        await endDealerStream(dealer.serial);
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
}
