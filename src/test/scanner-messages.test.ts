import { describe, expect, it } from "vitest";

import { scannerTelemetryInputSchema } from "~/server/api/game/helpers/scanner-messages";

describe("scanner telemetry messages", () => {
  it("accepts structured scanner telemetry", () => {
    const result = scannerTelemetryInputSchema.parse({
      serial: "scanner-1",
      event: "sqs_error",
      ts: 1_787_517_782_001,
      details: {
        errorName: "CredentialsProviderError",
        devicePath: "/dev/hidraw1",
      },
    });

    expect(result).toMatchObject({
      event: "sqs_error",
    });
  });

  it("rejects arbitrary telemetry events and oversized detail values", () => {
    expect(() =>
      scannerTelemetryInputSchema.parse({
        serial: "scanner-1",
        event: "arbitrary_log",
        ts: Date.now(),
        details: {},
      }),
    ).toThrow();

    expect(() =>
      scannerTelemetryInputSchema.parse({
        serial: "scanner-1",
        event: "hid_error",
        ts: Date.now(),
        details: { message: "x".repeat(201) },
      }),
    ).toThrow();
  });
});
