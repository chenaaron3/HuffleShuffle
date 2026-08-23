import { z } from "zod";

export const scannerTelemetryEvents = [
  "daemon_started",
  "hid_candidates",
  "hid_selected",
  "hid_error",
  "scan_rejected",
  "sqs_error",
  "heartbeat",
] as const;

export const scannerTelemetryEventSchema = z.enum(scannerTelemetryEvents);

const telemetryDetailValueSchema = z.union([
  z.string().max(200),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

const telemetryDetailsSchema = z
  .record(z.string().min(1).max(40), telemetryDetailValueSchema)
  .refine((details) => Object.keys(details).length <= 12, {
    message: "Telemetry details may contain at most 12 entries",
  });

export const scannerTelemetryInputSchema = z.object({
  serial: z.string().trim().min(1).max(128),
  event: scannerTelemetryEventSchema,
  ts: z.number().int().nonnegative().max(8_640_000_000_000_000),
  details: telemetryDetailsSchema.default({}),
});

export type ScannerTelemetryEvent = z.infer<typeof scannerTelemetryEventSchema>;
export type ScannerTelemetryInput = z.infer<typeof scannerTelemetryInputSchema>;
