import { eq, lt, sql } from "drizzle-orm";

import type { NextApiRequest, NextApiResponse } from "next";

import { scannerTelemetryInputSchema } from "~/server/api/game/helpers/scanner-messages";
import { db } from "~/server/db";
import { piDevices, scannerTelemetry } from "~/server/db/schema";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const TELEMETRY_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

const rateLimits = new Map<
  string,
  { count: number; windowStartedAt: number }
>();
let lastCleanupAt = 0;

function isRateLimited(serial: string, now: number): boolean {
  const current = rateLimits.get(serial);
  if (!current || now - current.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
    rateLimits.set(serial, { count: 1, windowStartedAt: now });
    return false;
  }

  current.count += 1;
  return current.count > RATE_LIMIT_MAX_REQUESTS;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = scannerTelemetryInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid scanner diagnostic" });
  }

  const input = parsed.data;
  const device = await db.query.piDevices.findFirst({
    where: eq(piDevices.serial, input.serial),
    columns: { tableId: true, type: true },
  });
  if (!device || device.type !== "scanner") {
    return res.status(404).json({ error: "Scanner not registered" });
  }

  if (isRateLimited(input.serial, Date.now())) {
    return res.status(429).json({ error: "Too many scanner diagnostics" });
  }

  const now = new Date();
  const shouldCleanup = now.getTime() - lastCleanupAt >= CLEANUP_INTERVAL_MS;
  if (shouldCleanup) lastCleanupAt = now.getTime();

  try {
    await db.transaction(async (tx) => {
      if (shouldCleanup) {
        await tx
          .delete(scannerTelemetry)
          .where(
            lt(
              scannerTelemetry.createdAt,
              new Date(now.getTime() - TELEMETRY_RETENTION_MS),
            ),
          );
      }
      await tx.insert(scannerTelemetry).values({
        serial: input.serial,
        tableId: device.tableId,
        event: input.event,
        details: input.details,
        occurredAt: new Date(input.ts),
        createdAt: now,
      });
      await tx
        .update(piDevices)
        .set({ lastSeenAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(piDevices.serial, input.serial));
    });
  } catch (error) {
    if (shouldCleanup) lastCleanupAt = 0;
    throw error;
  }
  return res.status(202).json({ accepted: true });
}
