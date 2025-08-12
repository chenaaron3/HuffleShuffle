import type { NextApiRequest, NextApiResponse } from "next";
import { eq, sql } from 'drizzle-orm';
import { db } from '~/server/db';
import { piDevices } from '~/server/db/schema';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const serial = (req.query.serial as string | undefined)?.trim();
  if (!serial) return res.status(400).json({ error: "serial required" });

  const device = await db.query.piDevices.findFirst({
    where: eq(piDevices.serial, serial),
  });
  if (!device) return res.status(404).json({ error: "Device not registered" });
  await db
    .update(piDevices)
    .set({ lastSeenAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(piDevices.serial, serial));
  return res.status(200).json({
    tableId: device.tableId,
    type: device.type,
    seatNumber: device.seatNumber,
  });
}
