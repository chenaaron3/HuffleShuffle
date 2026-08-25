import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NextApiRequest, NextApiResponse } from "next";

import scannerDiagnosticHandler from "~/pages/api/pi/scanner-diagnostic";
import { db } from "~/server/db";
import { piDevices, pokerTables, scannerTelemetry } from "~/server/db/schema";

const tableId = "scanner-diagnostic-test-table";
const scannerSerial = "scanner-diagnostic-test-device";

function createResponse(): NextApiResponse {
  const response = {
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response as unknown as NextApiResponse;
}

describe("scanner diagnostic API", () => {
  afterEach(async () => {
    await db.delete(pokerTables).where(eq(pokerTables.id, tableId));
  });

  it("stores telemetry and removes records older than three days", async () => {
    await db.insert(pokerTables).values({
      id: tableId,
      name: "Scanner diagnostic test",
      smallBlind: 1,
      bigBlind: 2,
    });
    await db.insert(piDevices).values({
      serial: scannerSerial,
      tableId,
      type: "scanner",
    });
    await db.insert(scannerTelemetry).values({
      serial: scannerSerial,
      tableId,
      event: "daemon_started",
      details: {},
      occurredAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    });

    const response = createResponse();
    await scannerDiagnosticHandler(
      {
        method: "POST",
        body: {
          serial: scannerSerial,
          event: "hid_selected",
          ts: Date.now(),
          details: { devicePath: "/dev/hidraw1" },
        },
      } as NextApiRequest,
      response,
    );

    expect(response.status).toHaveBeenCalledWith(202);
    const records = await db.query.scannerTelemetry.findMany({
      where: eq(scannerTelemetry.serial, scannerSerial),
    });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      event: "hid_selected",
      details: { devicePath: "/dev/hidraw1" },
    });
  });
});
